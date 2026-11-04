import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, FRACTIONS_MEDAILLES, medailleDe, seuilsDepuis } from "../src/index";
import { jouerDiamant, seuilsDe } from "../src/diamant";

// Les médailles (lot B3) : le Diamant est le score du bot ; or, argent, bronze en fractions entières ; seuils strictement croissants.
describe("les seuils des médailles", () => {
  it("le Diamant est le score du bot sur la suite du jour (clé `author`)", () => {
    const c = dailyBlocks(daysFromCivil(2026, 11, 4));
    expect(seuilsDe(c).author).toBe(jouerDiamant(c).resultat.score);
  });

  it("or, argent et bronze sont des fractions entières du Diamant (en pour cent), arrondies vers le bas", () => {
    const s = seuilsDepuis(10_000);
    expect(s).toEqual({ author: 10_000, gold: 100 * FRACTIONS_MEDAILLES.gold, silver: 100 * FRACTIONS_MEDAILLES.silver, bronze: 100 * FRACTIONS_MEDAILLES.bronze });
    expect(seuilsDepuis(1234)).toEqual({ author: 1234, gold: Math.floor((1234 * FRACTIONS_MEDAILLES.gold) / 100), silver: Math.floor((1234 * FRACTIONS_MEDAILLES.silver) / 100), bronze: Math.floor((1234 * FRACTIONS_MEDAILLES.bronze) / 100) });
  });

  it("les fractions sont croissantes et en dessous du Diamant", () => {
    const f = FRACTIONS_MEDAILLES;
    expect(0 < f.bronze && f.bronze < f.silver && f.silver < f.gold && f.gold < 100).toBe(true);
    for (const v of Object.values(f)) expect(Number.isInteger(v)).toBe(true);
  });

  it("strictement croissants, bronze < argent < or < Diamant : pour 60 jours, et même pour un Diamant minuscule", () => {
    for (let i = 0; i < 60; i++) {
      const s = seuilsDe(dailyBlocks(daysFromCivil(2026, 11, 2) + i));
      expect(s.bronze, `jour ${i}`).toBeGreaterThan(0);
      expect(s.bronze).toBeLessThan(s.silver);
      expect(s.silver).toBeLessThan(s.gold);
      expect(s.gold).toBeLessThan(s.author);
    }
    for (const d of [0, 1, 2, 3, 4, 5, 9, 20, 99]) {
      const s = seuilsDepuis(d);
      expect(s.bronze).toBeGreaterThan(0);
      expect(s.bronze < s.silver && s.silver < s.gold && s.gold < s.author, `diamant ${d}`).toBe(true);
    }
  });

  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { author: 1000, gold: 670, silver: 330, bronze: 110 };
    expect([0, 109, 110, 329, 330, 669, 670, 999, 1000, 5000].map((v) => medailleDe([v, 3], s))).toEqual([null, null, "bronze", "bronze", "silver", "silver", "gold", "gold", "author", "author"]);
  });

  it("le seuil est bien celui de l'écran de fin : le bot lui-même obtient le Diamant", () => {
    const c = dailyBlocks(daysFromCivil(2026, 11, 3));
    const s = seuilsDe(c);
    expect(medailleDe([jouerDiamant(c).resultat.score, 0], s)).toBe("author");
  });
});
