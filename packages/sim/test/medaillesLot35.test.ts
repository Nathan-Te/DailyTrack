import { describe, expect, it } from "vitest";
import { BASCULE_LOT_35, MEDAL_FACTORS, MEDAL_FACTORS_35, PREMIER_JOUR, dailyCircuit, formatDay, medalsFor, salonCircuit } from "../src/index";

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

  it("à partir de la bascule : auteur à 0,84 du pilote, or ×1,045, argent ×1,07, bronze ×1,13 de l'auteur", () => {
    expect(MEDAL_FACTORS_35).toEqual({ author: 0.84, gold: 1.045, silver: 1.07, bronze: 1.13 });
    for (const day of [BASCULE_LOT_35, BASCULE_LOT_35 + 100]) {
      expect(medalsFor(40_000, day)).toEqual({ author: 33_600, gold: 35_112, silver: 35_952, bronze: 37_968 });
    }
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
    expect(c.medals.author).toBe(Math.round(c.authorMs * 0.84));
  });
});
