import { describe, expect, it } from "vitest";
import { actionDe, compterPleines, contenuDeScenario, effacer, estClassable, estScenario, jouer, Partie, peutPoser, pleines, poser, SCENARIOS, type Grille, type Piece } from "../src/index";

describe("les scénarios d'essai", () => {
  it("cinq scénarios (ordre ajouté, suivantes retiré au lot B8), jamais classables, une suite complète", () => {
    expect([...SCENARIOS]).toEqual(["presque-plein", "blocage", "plateau-vide", "combo", "ordre"]);
    for (const nom of SCENARIOS) {
      const c = contenuDeScenario(nom);
      expect(c.scenario).toBe(nom);
      expect(estClassable(c)).toBe(false);
      expect(c.suite).toHaveLength(2000);
      expect(estScenario(nom)).toBe(true);
    }
    expect(estScenario("autre")).toBe(false);
    expect(estScenario("suivantes")).toBe(false);
  });
  it("presque-plein : une pose, 2 lignes et 1 colonne ; blocage : fin immédiate, trois pièces grisées ; plateau-vide : la grille se vide", () => {
    const a = new Partie(contenuDeScenario("presque-plein"));
    expect(a.poser(0, 5, 6)).toMatchObject({ n: 3 });
    const b = new Partie(contenuDeScenario("blocage"));
    expect(b.finie).toBe(true);
    expect(b.dernieresPieces.map((p) => p?.nom)).toEqual(["domino-0", "domino-1", "barre3-0"]);
    const c = new Partie(contenuDeScenario("plateau-vide"));
    expect(c.poser(0, 7, 6)).toMatchObject({ plateauVide: true });
  });
  it("combo : quatre poses de suite (trois dominos, puis le premier de la série suivante) effacent chacune une ligne, le combo monte jusqu'à ×4, la grille n'est jamais vide", () => {
    const p = new Partie(contenuDeScenario("combo"));
    const poses = [4, 5, 6].map((l, i) => p.poser(i, 6, l)!);
    poses.push(p.poser(0, 6, 7)!);
    expect(poses.map((r) => ({ n: r.n, combo: r.combo, effacement: r.effacement, plateauVide: r.plateauVide }))).toEqual([
      { n: 1, combo: 1, effacement: 10, plateauVide: false },
      { n: 1, combo: 2, effacement: 20, plateauVide: false },
      { n: 1, combo: 3, effacement: 30, plateauVide: false },
      { n: 1, combo: 4, effacement: 40, plateauVide: false },
    ]);
    expect(poses[2]!.serieNouvelle).toBe(true);
    expect(p.comboMax).toBe(4);
    expect(p.finie).toBe(false);
  });
  it("le blocage se rejoue sans aucune pose", () => {
    expect(jouer(contenuDeScenario("blocage"), []).raison).toBe("bloquee");
  });
});

// Lot B8 — `ordre` : on essaie TOUTES les poses de TOUS les ordres des trois pièces.
interface Issue {
  survit: boolean;
  lignes: number;
  /** Les grilles où la troisième pièce est grisée (la partie finit) quand on ne survit pas. */
  bloquees: number;
}
function explorer(depart: Grille, pieces: readonly Piece[], ordre: readonly number[]): Issue {
  const issue: Issue = { survit: false, lignes: 0, bloquees: 0 };
  const rec = (g: Grille, k: number, n: number): void => {
    if (k === ordre.length) {
      issue.survit = true;
      issue.lignes = Math.max(issue.lignes, n);
      return;
    }
    const p = pieces[ordre[k]!]!;
    let place = false;
    for (let l = 0; l + p.hauteur <= 8; l++) {
      for (let c = 0; c + p.largeur <= 8; c++) {
        if (!peutPoser(g, p, c, l)) continue;
        place = true;
        let g2 = poser(g, p, c, l);
        const m = pleines(g2);
        const nn = compterPleines(m);
        if (nn > 0) g2 = effacer(g2, m.lignes, m.colonnes);
        rec(g2, k + 1, n + nn);
      }
    }
    if (!place) issue.bloquees++;
  };
  rec(depart, 0, 0);
  return issue;
}

describe("le scénario « ordre » (lot B8) : l'ordre des trois pièces décide de tout", () => {
  const contenu = contenuDeScenario("ordre");
  const depart = new Partie(contenu);
  const pieces = depart.pieces.map((p) => p!);
  const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  it("les trois pièces sont saisissables au départ (aucune n'est grisée), et la partie n'est pas finie", () => {
    expect(pieces.map((p) => p.nom)).toEqual(["coin-1", "domino-1", "carre2-0"]);
    expect([0, 1, 2].map((e) => depart.grisee(e))).toEqual([false, false, false]);
    expect(depart.finie).toBe(false);
  });
  it("sur les six ordres et TOUTES les poses possibles, un seul ordre laisse une place à chacune des trois : le carré, le domino, le coin — et il efface deux lignes", () => {
    const issues = PERMUTATIONS.map((o) => ({ o, ...explorer(depart.grille, pieces, o) }));
    const bons = issues.filter((i) => i.survit);
    expect(bons.map((i) => i.o)).toEqual([[2, 1, 0]]);
    expect(bons[0]!.lignes).toBe(2);
    // Toutes les autres : quelles que soient les poses, la troisième est grisée et la partie finit.
    for (const i of issues.filter((x) => !x.survit)) expect(i.bloquees, `ordre ${i.o}`).toBeGreaterThan(0);
  });
  it("jouée à la main dans le bon ordre, la série se termine, deux lignes sont effacées et la série suivante arrive ; dans le mauvais, la troisième est grisée et la partie finit", () => {
    // Le bon ordre : le carré 2 × 2 dans la poche en bas à gauche (il efface la ligne 7), le domino debout en (7, 6) (il achève la ligne 6), puis le coin où l'on veut.
    const bon = new Partie(contenu);
    const un = bon.jouerAction(actionDe(2, 0, 6))!;
    const deux = bon.jouerAction(actionDe(1, 7, 6))!;
    expect([un.n, deux.n, un.combo, deux.combo]).toEqual([1, 1, 1, 2]);
    expect(bon.finie).toBe(false);
    const trois = bon.jouerAction(actionDe(0, 0, 6))!;
    expect(trois.serieNouvelle).toBe(true);
    expect(un.n + deux.n + trois.n).toBe(2);
    expect(bon.finie).toBe(false);
    // Le mauvais : le coin d'abord, dans la poche.
    const mauvais = new Partie(contenu);
    expect(mauvais.poser(0, 0, 6)).not.toBeNull();
    expect(mauvais.poser(1, 0, 4)).toBeNull(); // le domino ne tient plus dans ce qui reste
    expect([1, 2].map((e) => mauvais.grisee(e))).toEqual([true, true]);
    expect(mauvais.finie).toBe(true);
    expect(mauvais.resultat()!.raison).toBe("bloquee");
  });
});
