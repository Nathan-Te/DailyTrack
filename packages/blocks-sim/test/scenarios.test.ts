import { describe, expect, it } from "vitest";
import { estScenario, jouer, Partie, SCENARIOS, contenuDeScenario, estClassable } from "../src/index";

describe("les scénarios d'essai", () => {
  it("cinq scénarios, jamais classables, une suite complète", () => {
    expect([...SCENARIOS]).toEqual(["presque-plein", "blocage", "plateau-vide", "combo", "suivantes"]);
    for (const nom of SCENARIOS) {
      const c = contenuDeScenario(nom);
      expect(c.scenario).toBe(nom);
      expect(estClassable(c)).toBe(false);
      expect(c.suite).toHaveLength(2000);
      expect(estScenario(nom)).toBe(true);
    }
    expect(estScenario("autre")).toBe(false);
  });
  it("presque-plein : une pose, 2 lignes et 1 colonne ; blocage : fin immédiate ; plateau-vide : la grille se vide", () => {
    const a = new Partie(contenuDeScenario("presque-plein"));
    expect(a.poser(5, 6)).toMatchObject({ n: 3 });
    expect(new Partie(contenuDeScenario("blocage")).finie).toBe(true);
    const c = new Partie(contenuDeScenario("plateau-vide"));
    expect(c.poser(7, 6)).toMatchObject({ plateauVide: true });
  });
  it("combo : quatre poses de suite effacent chacune une ligne, le combo monte jusqu'à ×4, la grille n'est jamais vide", () => {
    const p = new Partie(contenuDeScenario("combo"));
    const poses = [4, 5, 6, 7].map((l) => p.poser(6, l)!);
    expect(poses.map((r) => ({ n: r.n, combo: r.combo, effacement: r.effacement, plateauVide: r.plateauVide }))).toEqual([
      { n: 1, combo: 1, effacement: 10, plateauVide: false },
      { n: 1, combo: 2, effacement: 20, plateauVide: false },
      { n: 1, combo: 3, effacement: 30, plateauVide: false },
      { n: 1, combo: 4, effacement: 40, plateauVide: false },
    ]);
    expect(p.comboMax).toBe(4);
    expect(p.finie).toBe(false);
  });
  it("suivantes (lot B7) : une grille vide, une suite qui alterne petites et grosses pièces, jouable sans contrainte", () => {
    const c = contenuDeScenario("suivantes");
    const p = new Partie(c);
    expect(p.grille).toEqual(new Partie(contenuDeScenario("suivantes")).grille);
    expect(p.score).toBe(0);
    const noms: string[] = [];
    // Les six premières pièces de la suite : petite, grosse, petite, grosse, petite, grosse (domino, carré 3 × 3, coin, barre de 5, carré 2 × 2, grand L).
    for (let i = 0; i < 6; i++) {
      noms.push(p.piece!.nom);
      expect(p.suivante).not.toBeNull();
      // Une position légale existe toujours : on pose à la première (la grille est neuve ou presque).
      let posee = false;
      for (let l = 0; l < 8 && !posee; l++) for (let col = 0; col < 8 && !posee; col++) if (p.legale(col, l)) posee = p.poser(col, l) !== null;
      expect(posee).toBe(true);
    }
    expect(noms).toEqual(["domino-0", "carre3-0", "coin-0", "barre5-0", "carre2-0", "grandl-0"]);
    expect(p.finie).toBe(false);
  });
  it("le blocage se rejoue sans aucune pose", () => {
    expect(jouer(contenuDeScenario("blocage"), []).raison).toBe("bloquee");
  });
});
