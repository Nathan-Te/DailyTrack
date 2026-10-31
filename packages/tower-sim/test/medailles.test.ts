import { describe, expect, it } from "vitest";
import {
  aireDuJour,
  COEFFICIENT_GEOMETRIQUE_PCT,
  dailyTower,
  diamantDe,
  estimationGeometrique,
  medailleObtenue,
  medailleVisee,
  medaillesDe,
  MEDAILLES_VERSION,
  NOMS_MEDAILLES,
  PLAFOND_DIAMANT_MM,
  POURCENTAGES_MEDAILLES,
} from "../src";

// Lot T3 — les médailles : seuils en millimètres entiers, médaille obtenue à chaque bord, repli géométrique. Lot T3b : Or 50 %, Argent 30 %, Bronze 15 % du Diamant (version 2 des médailles,
// décision de Nathan ; à recalibrer au lot T5 sur des parties humaines), et le Diamant plafonné à 60 m.
describe("medaillesDe : des entiers, tronqués vers zéro", () => {
  it("lot T3b — les pourcentages calibrés (15, 30 et 50 %), version 2", () => {
    expect(MEDAILLES_VERSION).toBe(2);
    expect(POURCENTAGES_MEDAILLES).toEqual({ or: 50, argent: 30, bronze: 15 });
    expect(medaillesDe(50_000)).toEqual({ auteur: 50_000, or: 25_000, argent: 15_000, bronze: 7_500 });
    expect(medaillesDe(60_000)).toEqual({ auteur: 60_000, or: 30_000, argent: 18_000, bronze: 9_000 });
  });
  it("jamais de flottant : un Diamant qui ne se divise pas est tronqué", () => {
    const m = medaillesDe(48_273);
    expect(m).toEqual({ auteur: 48_273, or: 24_136, argent: 14_481, bronze: 7_240 }); // 24 136,5 · 14 481,9 · 7 240,95
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
  const m = medaillesDe(50_000); // bronze 7 500 · argent 15 000 · or 25 000 · diamant 50 000
  it("à chaque bord : un millimètre de moins ne suffit pas, le seuil exact suffit", () => {
    expect(medailleObtenue(7_499, m)).toBeNull();
    expect(medailleObtenue(7_500, m)).toBe("bronze");
    expect(medailleObtenue(14_999, m)).toBe("bronze");
    expect(medailleObtenue(15_000, m)).toBe("argent");
    expect(medailleObtenue(24_999, m)).toBe("argent");
    expect(medailleObtenue(25_000, m)).toBe("or");
    expect(medailleObtenue(49_999, m)).toBe("or");
    expect(medailleObtenue(50_000, m)).toBe("auteur"); // le Diamant s'obtient à hauteur ÉGALE à celle du bot
    expect(medailleObtenue(80_000, m)).toBe("auteur");
    expect(medailleObtenue(0, m)).toBeNull();
  });
});

describe("medailleVisee : la prochaine médaille et ce qu'il en reste", () => {
  const m = medaillesDe(50_000);
  it("de la première à la dernière, puis plus rien", () => {
    expect(medailleVisee(0, m)).toEqual({ nom: "bronze", seuil: 7_500, reste: 7_500 });
    expect(medailleVisee(7_500, m)).toEqual({ nom: "argent", seuil: 15_000, reste: 7_500 });
    expect(medailleVisee(20_906, m)).toEqual({ nom: "or", seuil: 25_000, reste: 4_094 }); // « Or : encore 4,094 m »
    expect(medailleVisee(25_000, m)).toEqual({ nom: "auteur", seuil: 50_000, reste: 25_000 });
    expect(medailleVisee(50_000, m)).toBeNull();
  });
});

describe("lot T3b — le Diamant est plafonné à 60 m (générateur 3), la preuve reste la vraie partie du bot", () => {
  it("min(hauteur du bot, plafond), aux bords", () => {
    expect(PLAFOND_DIAMANT_MM).toBe(60_000);
    expect(diamantDe(59_999)).toBe(59_999);
    expect(diamantDe(60_000)).toBe(60_000);
    expect(diamantDe(60_001)).toBe(60_000);
    expect(diamantDe(103_400)).toBe(60_000);
    expect(diamantDe(0)).toBe(0);
  });
  it("les générateurs 1 et 2 n'ont pas de plafond : leurs jours servis gardent leur Diamant", () => {
    expect(diamantDe(103_400, 1)).toBe(103_400);
    expect(diamantDe(103_400, 2)).toBe(103_400);
    expect(diamantDe(103_400, 3)).toBe(60_000);
  });
  it("les médailles d'un Diamant plafonné se calculent sur le plafond (30 m, 18 m, 9 m)", () => {
    expect(medaillesDe(diamantDe(103_400))).toEqual({ auteur: 60_000, or: 30_000, argent: 18_000, bronze: 9_000 });
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
  it("lot T3b — l'estimation est plafonnée comme le Diamant (60 m) ; à 100 % elle ne dépasse jamais 32 m, le plafond ne joue pas dans la mesure du coefficient", () => {
    const c = dailyTower(20_000);
    const cinqMetres = { pieces: c.pieces, plateformeDemi8: 20 };
    expect(estimationGeometrique(cinqMetres, 100).auteur).toBe(32_000);
    expect(estimationGeometrique(cinqMetres, 187).auteur).toBe(59_840);
    expect(estimationGeometrique(cinqMetres, 188).auteur).toBe(60_000); // 60 160 mm plafonnés
    expect(estimationGeometrique(cinqMetres, 250)).toEqual(medaillesDe(60_000));
  });
  it("le coefficient par défaut est celui de la constante, et les médailles qui en viennent sont de vrais seuils", () => {
    const c = dailyTower(20_001);
    const m = estimationGeometrique(c);
    expect(m).toEqual(medaillesDe(m.auteur));
    expect(m).toEqual(estimationGeometrique(c, COEFFICIENT_GEOMETRIQUE_PCT));
  });
});
