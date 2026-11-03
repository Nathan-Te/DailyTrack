import { describe, expect, it } from "vitest";
import { classerLesGroupes, comparerGroupes, meilleurs, scoreDuGroupe, type ResultatMembre } from "../src/groupesScore";

// Lot C1, partie C — le score d'un groupe : la moyenne des 3 meilleurs, 3 classés au moins, le sens selon la vue, les égalités.
const r = (id: string, valeur: number, at = 1000): ResultatMembre => ({ id, valeur, at });

describe("scoreDuGroupe (au temps)", () => {
  it("exemple chiffré : 5 membres classés → la moyenne des 3 meilleurs temps", () => {
    // 31,2 s · 32,4 s · 34,2 s · 35,0 s · 40,0 s → (31 200 + 32 400 + 34 200) / 3 = 32 600 ms ; le 4e est 35 000.
    const s = scoreDuGroupe([r("e", 40_000), r("a", 31_200), r("c", 34_200), r("b", 32_400), r("d", 35_000)], "temps");
    expect(s).toMatchObject({ classes: 5, classe: true, score: 32_600, somme: 97_800, quatrieme: 35_000, retenus: ["a", "b", "c"] });
  });
  it("moins de 3 classés : pas de score, pas de rang", () => {
    expect(scoreDuGroupe([r("a", 30_000), r("b", 31_000)], "temps")).toMatchObject({ classes: 2, classe: false, score: null, somme: null });
    expect(scoreDuGroupe([], "temps")).toMatchObject({ classes: 0, classe: false });
  });
  it("exactement 3 : classé, sans 4e résultat ; la moyenne est arrondie au plus proche", () => {
    const s = scoreDuGroupe([r("a", 30_000), r("b", 30_001), r("c", 30_001)], "temps");
    expect(s).toMatchObject({ classe: true, quatrieme: null, somme: 90_002, score: 30_001 });
  });
});

describe("la hauteur (Tower) : le plus grand est le meilleur", () => {
  it("garde les 3 plus hautes parties", () => {
    const s = scoreDuGroupe([r("a", 40_000), r("b", 52_000), r("c", 31_000), r("d", 45_000)], "hauteur");
    expect(s).toMatchObject({ retenus: ["b", "d", "a"], score: 45_667, quatrieme: 31_000 });
  });
});

describe("meilleurs : à valeur égale, le premier arrivé", () => {
  it("départage par l'instant puis par l'identifiant", () => {
    expect(meilleurs([r("b", 10, 5), r("a", 10, 9), r("c", 10, 5)], "temps").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("classerLesGroupes : l'ordre et « Moins de 3 classés »", () => {
  const g = (id: string, valeurs: number[], ats: number[] = []) => ({ id, score: scoreDuGroupe(valeurs.map((v, i) => r(`${id}${i}`, v, ats[i] ?? 100 + i)), "temps") });
  it("la moyenne la plus basse d'abord ; à moyenne égale le 4e résultat ; puis le premier arrivé ; puis l'identifiant", () => {
    const { classes, moins } = classerLesGroupes([g("z", [30, 30, 30]), g("y", [30, 30, 30, 50]), g("x", [30, 30, 30, 40]), g("w", [29, 30, 30]), g("a", [30, 30, 30], [1, 2, 3]), g("v", [20, 20])], "temps");
    // w (89) devant ; puis les moyennes égales (90) : x (4e = 40), y (4e = 50), puis ceux sans 4e : a (arrivé à 3) devant z (arrivé à 102) ; v n'a que 2 classés.
    expect(classes.map((x) => [x.id, x.rang])).toEqual([["w", 1], ["x", 2], ["y", 3], ["a", 4], ["z", 5]]);
    expect(moins.map((x) => x.id)).toEqual(["v"]);
  });
  it("comparerGroupes est antisymétrique", () => {
    const a = g("a", [30, 31, 32]);
    const b = g("b", [30, 31, 33]);
    expect(Math.sign(comparerGroupes(a, b, "temps"))).toBe(-Math.sign(comparerGroupes(b, a, "temps")));
  });
  it("à la hauteur, l'ordre est inversé", () => {
    const h = (id: string, v: number[]) => ({ id, score: scoreDuGroupe(v.map((x, i) => r(`${id}${i}`, x)), "hauteur") });
    expect(classerLesGroupes([h("a", [10, 10, 10]), h("b", [20, 20, 20])], "hauteur").classes.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
