import { describe, expect, it } from "vitest";
import {
  aireDuJour,
  COEFFICIENT_GEOMETRIQUE_PCT,
  dailyTower,
  estimationGeometrique,
  medailleObtenue,
  medailleVisee,
  medaillesDe,
  NOMS_MEDAILLES,
  POURCENTAGES_MEDAILLES,
} from "../src";

// Lot T3 — les médailles : seuils en millimètres entiers (Or 90 %, Argent 75 %, Bronze 55 % du Diamant), médaille obtenue à chaque bord, repli géométrique.
describe("medaillesDe : des entiers, tronqués vers zéro", () => {
  it("les pourcentages du seed", () => {
    expect(POURCENTAGES_MEDAILLES).toEqual({ or: 90, argent: 75, bronze: 55 });
    expect(medaillesDe(50_000)).toEqual({ auteur: 50_000, or: 45_000, argent: 37_500, bronze: 27_500 });
  });
  it("jamais de flottant : un Diamant qui ne se divise pas est tronqué", () => {
    const m = medaillesDe(48_273);
    expect(m).toEqual({ auteur: 48_273, or: 43_445, argent: 36_204, bronze: 26_550 }); // 43 445,7 · 36 204,75 · 26 550,15
    for (const n of NOMS_MEDAILLES) expect(Number.isInteger(m[n])).toBe(true);
    expect(m.bronze).toBeLessThanOrEqual(m.argent);
    expect(m.argent).toBeLessThanOrEqual(m.or);
    expect(m.or).toBeLessThanOrEqual(m.auteur);
  });
  it("un Diamant minuscule ne casse rien", () => {
    expect(medaillesDe(0)).toEqual({ auteur: 0, or: 0, argent: 0, bronze: 0 });
    expect(medaillesDe(1)).toEqual({ auteur: 1, or: 0, argent: 0, bronze: 0 });
  });
});

describe("medailleObtenue : la plus haute dont la hauteur atteint le seuil (≥)", () => {
  const m = medaillesDe(50_000); // bronze 27 500 · argent 37 500 · or 45 000 · diamant 50 000
  it("à chaque bord : un millimètre de moins ne suffit pas, le seuil exact suffit", () => {
    expect(medailleObtenue(27_499, m)).toBeNull();
    expect(medailleObtenue(27_500, m)).toBe("bronze");
    expect(medailleObtenue(37_499, m)).toBe("bronze");
    expect(medailleObtenue(37_500, m)).toBe("argent");
    expect(medailleObtenue(44_999, m)).toBe("argent");
    expect(medailleObtenue(45_000, m)).toBe("or");
    expect(medailleObtenue(49_999, m)).toBe("or");
    expect(medailleObtenue(50_000, m)).toBe("auteur"); // le Diamant s'obtient à hauteur ÉGALE à celle du bot
    expect(medailleObtenue(80_000, m)).toBe("auteur");
    expect(medailleObtenue(0, m)).toBeNull();
  });
});

describe("medailleVisee : la prochaine médaille et ce qu'il en reste", () => {
  const m = medaillesDe(50_000);
  it("de la première à la dernière, puis plus rien", () => {
    expect(medailleVisee(0, m)).toEqual({ nom: "bronze", seuil: 27_500, reste: 27_500 });
    expect(medailleVisee(27_500, m)).toEqual({ nom: "argent", seuil: 37_500, reste: 10_000 });
    expect(medailleVisee(40_906, m)).toEqual({ nom: "or", seuil: 45_000, reste: 4_094 }); // « Or : encore 4,094 m »
    expect(medailleVisee(45_000, m)).toEqual({ nom: "auteur", seuil: 50_000, reste: 5_000 });
    expect(medailleVisee(50_000, m)).toBeNull();
  });
});

describe("le repli géométrique : aire des pièces ÷ largeur de la plateforme × coefficient", () => {
  it("une pièce fait 4 m² (quatre cases d'un mètre) : 40 pièces font 160 m²", () => {
    const c = dailyTower(20_000);
    expect(aireDuJour(c.pieces)).toBe(40 * 4 * 64); // huitièmes de mètre au carré
  });
  it("à 100 %, 160 m² sur 5 m de large : 32 m, sur 8 m : 20 m — en millimètres entiers", () => {
    const c = dailyTower(20_000);
    expect(estimationGeometrique({ pieces: c.pieces, plateformeDemi8: 20 }, 100).auteur).toBe(32_000);
    expect(estimationGeometrique({ pieces: c.pieces, plateformeDemi8: 32 }, 100).auteur).toBe(20_000);
    expect(estimationGeometrique({ pieces: c.pieces, plateformeDemi8: 20 }, 150).auteur).toBe(48_000);
  });
  it("le coefficient par défaut est celui de la constante, et les médailles qui en viennent sont de vrais seuils", () => {
    const c = dailyTower(20_001);
    const m = estimationGeometrique(c);
    expect(m).toEqual(medaillesDe(m.auteur));
    expect(m).toEqual(estimationGeometrique(c, COEFFICIENT_GEOMETRIQUE_PCT));
  });
});
