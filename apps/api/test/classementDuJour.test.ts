import { describe, expect, it } from "vitest";
import type { ClasseDuJour, MedaillePortail } from "../src/games";
import { BAREME_POINTS, classerLaJournee, placer, pointsDe, sommeDesRangs } from "../src/classementDuJour";

// Lot I3 (plateforme, phase 3) : les points du jour et le classement du jour tous jeux confondus — le calcul pur. Barème : auteur 4 · or 3 · argent 2 ·
// bronze 1 · fini sans médaille 0, par jeu. Ordre : points, puis somme des rangs (un jeu non fini compte pour le nombre de classés + 1), puis le premier
// à avoir atteint son total (l'horodatage le plus tardif de ses essais classés), puis l'identifiant.

const c = (playerId: string, medaille: MedaillePortail | null, at = 1): ClasseDuJour => ({ playerId, medaille, at });
const ids = (r: ReturnType<typeof classerLaJournee>) => r.lignes.map((l) => l.id);

describe("barème des points", () => {
  it("auteur 4 · or 3 · argent 2 · bronze 1 · fini sans médaille 0", () => {
    expect(BAREME_POINTS).toEqual({ author: 4, gold: 3, silver: 2, bronze: 1 });
    expect([pointsDe("author"), pointsDe("gold"), pointsDe("silver"), pointsDe("bronze"), pointsDe(null)]).toEqual([4, 3, 2, 1, 0]);
  });
});

describe("le classement du jour (pur)", () => {
  it("le total est la somme des points sur les jeux du jour ; seuls les joueurs qui ont fini un jeu y sont", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", "gold"), c("b", "silver"), c("c", null)] },
      { jeu: "jump", classes: [c("b", "author"), c("d", "bronze")] },
    ]);
    expect(r.lignes.map((l) => [l.id, l.points])).toEqual([
      ["b", 6],
      ["a", 3],
      ["d", 1],
      ["c", 0],
    ]);
    // `c` a fini sans médaille : classé avec 0 point. Un joueur qui n'a rien fini n'est pas là.
    expect(r.index.has("z")).toBe(false);
    expect(r.classesParJeu).toEqual([3, 2]);
  });

  it("à égalité de points : la somme des rangs, un jeu non fini comptant pour le nombre de classés + 1", () => {
    // a : Track 1er (or), Jump non fini → 1 + (2 + 1) = 4 ; b : Track 3e (or), Jump 1er (argent) → 3 + 1 = 4… on construit des totaux égaux à 3 points.
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", "gold"), c("x", null), c("b", "bronze")] },
      { jeu: "jump", classes: [c("b", "silver"), c("y", null)] },
    ]);
    // a : 3 points, rangs 1 + (2 + 1) = 4 ; b : 1 + 2 = 3 points, rangs 3 + 1 = 4 → égalité parfaite des sommes aussi : le temps tranche.
    const a = r.lignes.find((l) => l.id === "a")!;
    const b = r.lignes.find((l) => l.id === "b")!;
    expect([a.points, a.sommeRangs, b.points, b.sommeRangs]).toEqual([3, 4, 3, 4]);

    const s = classerLaJournee([
      { jeu: "cdj", classes: [c("p", "gold"), c("q", "silver"), c("r", "bronze")] },
      { jeu: "jump", classes: [c("r", "gold"), c("q", "bronze")] },
    ]);
    // p : 3 points, rangs 1 + (2 + 1) = 4 ; q : 2 + 1 = 3 points, rangs 2 + 2 = 4 ; r : 1 + 3 = 4 points, rangs 3 + 1 = 4.
    expect(s.lignes.map((l) => [l.id, l.points, l.sommeRangs])).toEqual([
      ["r", 4, 4],
      ["p", 3, 4],
      ["q", 3, 4],
    ]);
  });

  it("la somme des rangs départage deux joueurs de mêmes points", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", "gold"), c("b", "gold"), c("c", "gold")] },
      { jeu: "jump", classes: [c("c", "silver"), c("a", "silver"), c("b", "silver")] },
    ]);
    // Tous à 5 points : sommes a = 1 + 2 = 3, b = 2 + 3 = 5, c = 3 + 1 = 4.
    expect(ids(r)).toEqual(["a", "c", "b"]);
    expect(r.lignes.map((l) => l.sommeRangs)).toEqual([3, 4, 5]);
  });

  it("encore à égalité : le premier à avoir atteint son total (l'essai classé le plus tardif de chacun)", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", "gold", 100), c("b", "gold", 300)] },
      { jeu: "jump", classes: [c("b", "silver", 50), c("a", "silver", 200)] },
    ]);
    // a : 5 points, rangs 1 + 2 = 3, total atteint à 200 ; b : 5 points, rangs 2 + 1 = 3, total atteint à 300 → a d'abord.
    expect(ids(r)).toEqual(["a", "b"]);
    expect(r.lignes.map((l) => l.at)).toEqual([200, 300]);
  });

  it("égalité parfaite : l'identifiant, pour un ordre toujours le même", () => {
    const r = classerLaJournee([{ jeu: "cdj", classes: [c("b", "gold", 5), c("a", "gold", 5)] }]);
    // Mêmes points, rangs 1 et 2 : ce sont les rangs qui séparent ; avec un seul jeu l'égalité parfaite n'existe que sur des rangs égaux, donc jamais.
    expect(ids(r)).toEqual(["b", "a"]);
    const t = classerLaJournee([
      { jeu: "cdj", classes: [c("b", "gold", 5)] },
      { jeu: "jump", classes: [c("a", "gold", 5)] },
    ]);
    // b : 3 points, rangs 1 + (1 + 1) = 3 ; a : 3 points, rangs (1 + 1) + 1 = 3 ; même instant → l'identifiant.
    expect(ids(t)).toEqual(["a", "b"]);
  });

  it("un jour sans classé, ou sans jeu : classement vide", () => {
    expect(classerLaJournee([{ jeu: "cdj", classes: [] }]).lignes).toEqual([]);
    expect(classerLaJournee([]).lignes).toEqual([]);
  });

  it("un jeu de plus (n° 3) entre sans changer le calcul : ses points s'ajoutent, ses non-classés comptent", () => {
    const r = classerLaJournee([
      { jeu: "cdj", classes: [c("a", "bronze")] },
      { jeu: "jump", classes: [c("b", "bronze")] },
      { jeu: "lune", classes: [c("a", "author"), c("b", null)] },
    ]);
    expect(r.lignes.map((l) => [l.id, l.points])).toEqual([
      ["a", 5],
      ["b", 1],
    ]);
    expect(sommeDesRangs(r.lignes[0]!.resultats, r.classesParJeu)).toBe(1 + 2 + 1);
  });

  it("le rang de chaque jeu est la position dans son classement", () => {
    const r = classerLaJournee([{ jeu: "cdj", classes: [c("a", "gold"), c("b", "silver"), c("c", null)] }]);
    expect(r.lignes.map((l) => l.resultats[0])).toEqual([
      { rang: 1, medaille: "gold" },
      { rang: 2, medaille: "silver" },
      { rang: 3, medaille: null },
    ]);
  });
});

describe("placer : sa place exacte dans un classement gardé", () => {
  const base = classerLaJournee([
    { jeu: "cdj", classes: [c("a", "author"), c("b", "gold"), c("c", "silver"), c("d", "bronze"), c("e", null)] },
  ]);
  // a 4, b 3, c 2, d 1, e 0

  it("gardé et au même total : sa place gardée", () => {
    expect(placer(base, { id: "c", points: 2, sommeRangs: 3 })).toEqual({ rang: 3, classes: 5 });
  });

  it("absent (il vient de finir) : inséré après tous ceux de même total et de somme de rangs au plus égale", () => {
    // 3 points, rangs 3 : entre b (3 points, rang 2) et c (2 points) → derrière b.
    expect(placer(base, { id: "n", points: 3, sommeRangs: 3 })).toEqual({ rang: 3, classes: 6 });
    // Mieux que tout le monde.
    expect(placer(base, { id: "n", points: 5, sommeRangs: 1 })).toEqual({ rang: 1, classes: 6 });
    // Moins bien que tout le monde, y compris celui qui a fini sans médaille (0 point, somme de rangs 5).
    expect(placer(base, { id: "n", points: 0, sommeRangs: 9 })).toEqual({ rang: 6, classes: 6 });
  });

  it("gardé mais son total a changé : il ne se compte pas deux fois", () => {
    // « e » (0 point) vient de gagner un bronze : 1 point, somme des rangs 5 → derrière d (1 point, rang 4), donc 5e, sur 5 classés.
    expect(placer(base, { id: "e", points: 1, sommeRangs: 5 })).toEqual({ rang: 5, classes: 5 });
    // « d » monte à 4 points avec la somme des rangs 1 : devant a (somme 1, même total, a est arrivé avant lui) → il est inséré après les égaux.
    expect(placer(base, { id: "d", points: 4, sommeRangs: 1 })).toEqual({ rang: 2, classes: 5 });
  });
});
