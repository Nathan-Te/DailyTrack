import { describe, expect, it } from "vitest";
import type { ClasseDuJour, MedaillePortail } from "../src/games";
import { classerLaJournee, comparer, ligneDe, placer, type ClassementDuJour, type ResultatJeu } from "../src/classementDuJour";

// Lot I3 (plateforme, phase 3), refait au lot A1 : le classement du jour **au chrono** — le calcul pur. Une vue par jeu (l'ordre du jeu) et le cumul :
// les joueurs qui ont tout fini par la somme de leurs temps, puis ceux qui n'ont fini qu'une partie des jeux par leur meilleur rang ; à égalité, le
// premier à avoir atteint son temps (l'horodatage le plus tardif de ses essais classés), puis l'identifiant. Plus de points : la médaille n'est qu'une pastille.

const c = (playerId: string, tempsMs: number, at = 1, medaille: MedaillePortail | null = null): ClasseDuJour => ({ playerId, tempsMs, medaille, at });
const ids = (r: ClassementDuJour) => r.cumul.map((l) => l.id);

describe("le classement du jour au chrono (pur)", () => {
  it("la liste d'un jeu garde l'ordre du jeu ; le rang d'un joueur est sa position dans ce jeu", () => {
    const r = classerLaJournee([{ jeu: "cdj", classes: [c("a", 30_000), c("b", 30_000), c("c", 31_000)] }]);
    expect(r.parJeu[0]!.map((l) => [l.id, l.resultats[0]!.rang])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
    expect(r.classesParJeu).toEqual([3]);
  });

  it("le cumul : les joueurs qui ont fini tous les jeux par la somme de leurs temps, puis les autres par leur meilleur rang (le jeu du registre d'abord)", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", 28_000), c("b", 30_000), c("c", 31_000), c("d", 40_000)] },
      { jeu: "jump", classes: [c("e", 20_000), c("c", 24_000), c("b", 26_000), c("f", 27_000)] },
    ]);
    // b : 56 000 ; c : 55 000 ; complets : c, b. Autres : a (Track 1er), e (Jump 1er), d (Track 4e), f (Jump 4e).
    expect(ids(r)).toEqual(["c", "b", "a", "e", "d", "f"]);
    expect(r.cumul.map((l) => [l.id, l.complet, l.cumulMs])).toEqual([
      ["c", true, 55_000],
      ["b", true, 56_000],
      ["a", false, null],
      ["e", false, null],
      ["d", false, null],
      ["f", false, null],
    ]);
    expect(r.index.get("a")).toBe(2);
    expect(r.index.has("z")).toBe(false); // un joueur qui n'a rien fini n'est pas là
  });

  it("un joueur lent aux deux jeux passe avant un joueur rapide à un seul : un jeu non fini ne compte jamais pour un temps", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("rapide", 10_000), c("lent", 90_000)] },
      { jeu: "jump", classes: [c("lent", 99_000)] },
    ]);
    expect(ids(r)).toEqual(["lent", "rapide"]);
  });

  it("à cumul égal : le premier arrivé à ce temps (l'essai le plus tardif de chacun), puis l'identifiant", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", 30_000, 100), c("b", 30_000, 400), c("z", 30_000, 50), c("y", 30_000, 50)] },
      { jeu: "jump", classes: [c("b", 25_000, 200), c("a", 25_000, 700), c("z", 25_000, 60), c("y", 25_000, 60)] },
    ]);
    // a atteint 55 000 à 700, b à 400, y et z à 60 (même instant : l'identifiant).
    expect(ids(r)).toEqual(["y", "z", "b", "a"]);
  });

  it("un jour avec un seul jeu : tous sont complets, le cumul est le classement du jeu", () => {
    const r = classerLaJournee([{ jeu: "cdj", classes: [c("a", 30_000), c("b", 31_000)] }]);
    expect(r.cumul.map((l) => [l.id, l.complet, l.cumulMs])).toEqual([["a", true, 30_000], ["b", true, 31_000]]);
  });

  it("trois jeux : « tous » veut dire les trois ; deux sur trois est un classement partiel, au meilleur rang", () => {
    const r = classerLaJournee([
      { jeu: "g1", classes: [c("a", 10), c("b", 11), c("c", 12)] },
      { jeu: "g2", classes: [c("a", 20), c("c", 21)] },
      { jeu: "g3", classes: [c("a", 30), c("b", 31)] },
    ]);
    expect(r.cumul.map((l) => [l.id, l.complet])).toEqual([["a", true], ["b", false], ["c", false]]);
  });

  it("aucun classé : un classement vide", () => {
    const r = classerLaJournee([{ jeu: "cdj", classes: [] }, { jeu: "jump", classes: [] }]);
    expect(r.cumul).toEqual([]);
    expect(r.parJeu).toEqual([[], []]);
    expect(r.classesParJeu).toEqual([0, 0]);
  });

  it("`comparer` est un ordre total stable (ni NaN ni cycle)", () => {
    const r = (rang: number, tempsMs: number, at: number): ResultatJeu => ({ rang, tempsMs, medaille: null, at });
    const l1 = ligneDe("a", [r(1, 10, 5), r(2, 10, 6)]);
    const l2 = ligneDe("b", [r(2, 10, 5), r(1, 10, 6)]);
    const l3 = ligneDe("c", [r(1, 10, 5), null]);
    expect([l1, l2, l3].sort(comparer).map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(comparer(l1, l1)).toBe(0);
    expect(comparer(l1, l2)).toBe(-comparer(l2, l1));
  });
});

describe("placer : où se place un joueur dont on connaît le résultat exact", () => {
  const jeux = () =>
    classerLaJournee([
      { jeu: "cdj", classes: [c("a", 30_000, 10), c("b", 31_000, 20), c("c", 32_000, 30)] },
      { jeu: "jump", classes: [c("a", 25_000, 10), c("b", 25_000, 20), c("d", 26_000, 40)] },
    ]);
  const r = (rang: number, tempsMs: number): ResultatJeu => ({ rang, tempsMs, medaille: null, at: 0 });

  it("gardé et inchangé : sa place gardée", () => {
    const k = jeux();
    expect(placer(k, ligneDe("b", [r(2, 31_000), r(2, 25_000)]))).toEqual({ rang: 2, classes: 4 });
  });

  it("un joueur absent (il vient de finir) : après tous ceux qui valent son temps ou le devancent, et il s'ajoute au nombre de classés", () => {
    const k = jeux();
    // 56 000 : comme b (56 000, arrivé avant) → derrière lui ; devant rien d'autre que a (55 000) et b.
    expect(placer(k, ligneDe("x", [r(2, 31_000), r(2, 25_000)]))).toEqual({ rang: 3, classes: 5 });
    // 50 000 : premier.
    expect(placer(k, ligneDe("y", [r(1, 25_000), r(1, 25_000)]))).toEqual({ rang: 1, classes: 5 });
    // Un seul jeu fini : sous les complets (a et b), parmi les partiels : c (Track 3e) et d (Jump 3e) ; son meilleur rang 1 → devant eux.
    expect(placer(k, ligneDe("z", [r(1, 20_000), null]))).toEqual({ rang: 3, classes: 5 });
  });

  it("un joueur gardé dont le résultat a changé (il vient de finir son deuxième jeu) ne se compte pas deux fois", () => {
    const k = jeux();
    // c n'avait fini que Track (partiel) ; il finit Jump à 26 000 : 32 000 + 26 000 = 58 000, derrière a (55 000) et b (56 000) → 3e sur 4.
    expect(placer(k, ligneDe("c", [r(3, 32_000), r(3, 26_000)]))).toEqual({ rang: 3, classes: 4 });
  });
});
