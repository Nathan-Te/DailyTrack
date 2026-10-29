import { describe, expect, it } from "vitest";
import { BASCULE_LOT_35, GENERATOR_MEDAILLES_G1, GENERATOR_VERSION, MEDAL_FACTORS, MEDAL_FACTORS_35, MEDAL_FACTORS_G1, PREMIER_JOUR, dailyCircuit, formatDay, medalsFor, salonCircuit } from "../src/index";

// Lot 35 : médailles calibrées sur de vrais joueurs, à partir de la date de bascule seulement (docs/lots/lot-35-medailles.md).

describe("médailles du lot 35", () => {
  it("bascule le 28/10/2026 : les jours d'avant gardent leurs seuils (auteur = pilote, or ×1,08, argent ×1,20, bronze ×1,40)", () => {
    expect(formatDay(BASCULE_LOT_35)).toBe("2026-10-28");
    for (const day of [PREMIER_JOUR, BASCULE_LOT_35 - 6, BASCULE_LOT_35 - 1]) {
      expect(medalsFor(40_000, day)).toEqual({ author: 40_000, gold: 43_200, silver: 48_000, bronze: 56_000 });
    }
    expect(medalsFor(40_000)).toEqual(medalsFor(40_000, BASCULE_LOT_35 - 1)); // sans jour : les seuils d'avant
    expect(MEDAL_FACTORS).toEqual({ gold: 1.08, silver: 1.2, bronze: 1.4 });
  });

  it("lot 35 : avec un générateur d'avant la v19, à partir du 28/10 : auteur à 0,84 du pilote, or ×1,045, argent ×1,07, bronze ×1,13 de l'auteur", () => {
    expect(MEDAL_FACTORS_35).toEqual({ author: 0.84, gold: 1.045, silver: 1.07, bronze: 1.13 });
    for (const day of [BASCULE_LOT_35, BASCULE_LOT_35 + 100]) {
      expect(medalsFor(40_000, day, GENERATOR_MEDAILLES_G1 - 1)).toEqual({ author: 33_600, gold: 35_112, silver: 35_952, bronze: 37_968 });
    }
  });

  it("lot G1 : plus de date — les circuits du générateur v19 et suivants ont le Diamant à 0,92 du pilote, mêmes écarts ; un jour que le registre ne nomme pas prend la dernière version", () => {
    expect(GENERATOR_MEDAILLES_G1).toBe(19);
    expect(GENERATOR_VERSION).toBeGreaterThanOrEqual(GENERATOR_MEDAILLES_G1);
    expect(MEDAL_FACTORS_G1).toEqual({ author: 0.92, gold: 1.045, silver: 1.07, bronze: 1.13 });
    expect(medalsFor(40_000, BASCULE_LOT_35 + 100, GENERATOR_MEDAILLES_G1)).toEqual({ author: 36_800, gold: 38_456, silver: 39_376, bronze: 41_584 });
    // un jour lointain : pas dans le registre, donc la dernière version, donc les seuils du lot G1 ; un jour du registre garde les siens
    expect(medalsFor(40_000, BASCULE_LOT_35 + 400)).toEqual(medalsFor(40_000, BASCULE_LOT_35 + 400, GENERATOR_MEDAILLES_G1));
    expect(medalsFor(40_000, BASCULE_LOT_35)).toEqual({ author: 33_600, gold: 35_112, silver: 35_952, bronze: 37_968 }); // le 28/10 : servi en v16
    expect(medalsFor(40_000, BASCULE_LOT_35 - 1)).toEqual({ author: 40_000, gold: 43_200, silver: 48_000, bronze: 56_000 });
    // rouler comme le pilote rapporte le bronze
    const m = medalsFor(40_000, 0, GENERATOR_MEDAILLES_G1);
    expect(m.bronze).toBeGreaterThan(40_000);
    expect(m.silver).toBeLessThan(40_000);
  });

  it("le circuit du jour porte les seuils de sa date ; son temps de pilote ne change pas", () => {
    const before = dailyCircuit(BASCULE_LOT_35 - 1);
    expect(before.medals).toEqual(medalsFor(before.authorMs, 0));
    expect(before.medals.author).toBe(before.authorMs);
    const after = dailyCircuit(BASCULE_LOT_35);
    expect(after.medals).toEqual(medalsFor(after.authorMs, BASCULE_LOT_35));
    expect(after.medals.author).toBe(Math.round(after.authorMs * 0.84));
    expect(after.medals.bronze).toBeLessThan(after.authorMs); // rouler comme le pilote ne rapporte plus de médaille
  });

  it("le Salon suit les nouveaux seuils", () => {
    const c = salonCircuit(5_000_000);
    expect(c.medals.author).toBe(Math.round(c.authorMs * 0.92));
  });
});
