import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { contenuDeScenario, dailyBlocks, grilleEnTexte, jouer, Partie, SCENARIOS } from "../src/index";
import { coupFaible, jouerFaible } from "../src/faible";
import { coupGlouton, jouerGlouton } from "../src/glouton";
import { jouerDiamant } from "../src/diamant";
import { contenuDEssai } from "./aide";

const PREMIER = daysFromCivil(2026, 11, 2);
const jours = (n: number): number[] => Array.from({ length: n }, (_, i) => PREMIER + i);

describe("le bot faible (lot B8) : la plus grosse pièce, au premier endroit qui efface, sinon au plus bas à gauche", () => {
  it("prend la plus grosse pièce de la série (à égalité, l'emplacement le plus à gauche)", () => {
    const p = new Partie(contenuDEssai(["domino-0", "carre2-0", "barre3-0"]));
    expect(coupFaible(p)!.emplacement).toBe(1); // 4 cases contre 3 et 2
    const q = new Partie(contenuDEssai(["domino-0", "barre3-0", "barre3-1"]));
    expect(coupFaible(q)!.emplacement).toBe(1);
  });
  it("sans effacement possible, la pose est au plus bas à gauche : la ligne la plus basse, puis la colonne la plus à gauche", () => {
    const p = new Partie(contenuDEssai(["carre2-0", "domino-0", "domino-0"]));
    expect(coupFaible(p)).toEqual({ emplacement: 0, col: 0, ligne: 6 }); // le carré 2 × 2 en bas à gauche
    p.poser(0, 0, 6);
    expect(coupFaible(p)).toEqual({ emplacement: 1, col: 2, ligne: 7 });
  });
  it("au premier endroit qui efface une ligne ou une colonne, de préférence à tout autre (lignes de haut en bas, puis colonnes)", () => {
    const depart = ["........", "XXXXXX..", "........", "........", "........", "........", "........", "........"];
    const p = new Partie(contenuDEssai(["domino-0", "domino-0", "domino-0"], depart));
    expect(coupFaible(p)).toEqual({ emplacement: 0, col: 6, ligne: 1 }); // le domino achève la ligne 1, même s'il y a plus bas
  });
  it("ne prend jamais une pièce grisée : la plus grosse qui tient quelque part", () => {
    const depart = ["..X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X"];
    const p = new Partie(contenuDEssai(["barre3-0", "domino-0", "coin-0"], depart));
    expect(coupFaible(p)).toEqual({ emplacement: 1, col: 0, ligne: 0 });
  });
});

describe("le bot moyen (lot B8) : la meilleure pose immédiate, toutes pièces confondues, sans recherche d'ordre", () => {
  it("efface plutôt que de poser ailleurs, et choisit la pièce qui efface parmi les trois", () => {
    const depart = ["........", "........", "........", "........", "........", "........", "XXXXX...", "........"];
    const p = new Partie(contenuDEssai(["domino-0", "carre2-0", "barre3-0"], depart));
    // Seule la barre de 3 (emplacement 2) achève la ligne 6.
    expect(coupGlouton(p)).toEqual({ emplacement: 2, col: 5, ligne: 6 });
  });
  it("ne regarde pas plus loin que la pose : à valeur égale l'emplacement le plus à gauche", () => {
    const p = new Partie(contenuDEssai(["domino-0", "domino-0", "domino-0"]));
    expect(coupGlouton(p)!.emplacement).toBe(0);
  });
});

describe("les trois bots : purs, déterministes, des rediffusions valides", () => {
  const bots = { faible: jouerFaible, moyen: jouerGlouton, diamant: jouerDiamant } as const;
  for (const [nom, jouerBot] of Object.entries(bots)) {
    it(`${nom} : deux fois la même partie, une rediffusion que le serveur (jouer) rejoue à l'identique`, () => {
      for (const j of jours(4)) {
        const c = dailyBlocks(j);
        const a = jouerBot(c);
        expect(jouerBot(c)).toEqual(a);
        expect(jouer(c, a.actions)).toEqual(a.resultat);
        expect(a.actions.length).toBe(a.resultat.poses);
      }
    });
    it(`${nom} : joue aussi les scénarios d'essai`, () => {
      for (const s of SCENARIOS) {
        const c = contenuDeScenario(s);
        const a = jouerBot(c);
        expect(jouer(c, a.actions)).toEqual(a.resultat);
      }
    });
  }
  it("la force est graduée : faible < moyen < Diamant sur la grande majorité de 30 jours, et dans cet ordre en médiane (un bot meurt parfois d'un hasard de la suite : jamais 100 % des jours)", () => {
    let fm = 0;
    let md = 0;
    const scores: number[][] = [[], [], []];
    for (const j of jours(30)) {
      const c = dailyBlocks(j);
      const f = jouerFaible(c).resultat.score;
      const m = jouerGlouton(c).resultat.score;
      const d = jouerDiamant(c).resultat.score;
      if (f < m) fm++;
      if (m < d) md++;
      scores[0]!.push(f), scores[1]!.push(m), scores[2]!.push(d);
    }
    expect(fm).toBeGreaterThanOrEqual(24);
    expect(md).toBeGreaterThanOrEqual(24);
    const med = scores.map((a) => a.sort((x, y) => x - y)[15]!);
    expect(med[0]!).toBeLessThan(med[1]!);
    expect(med[1]!).toBeLessThan(med[2]!);
  }, 60000);
  it("le scénario « blocage » : aucun bot ne joue, la partie est finie", () => {
    const c = contenuDeScenario("blocage");
    for (const b of Object.values(bots)) expect(b(c).actions).toEqual([]);
    expect(grilleEnTexte(new Partie(c).grille)[0]).toBe("X.X.X.X.");
  });
});
