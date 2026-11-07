import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { arrondir, dailyBlocks, medailleDe, PART_DU_DIAMANT_MEDIAN, REFERENCES_MEDAILLES, seuilsDepuis } from "../src/index";
import { jouerDiamant, seuilsDe } from "../src/diamant";

// Les médailles (lots B3 et B8) : le Diamant est le score du bot ; bronze, argent et or sont les références mesurées sur les bots de force graduée ; seuils strictement croissants, arrondis.
describe("les seuils des médailles", () => {
  it("le Diamant est le score du bot sur la suite du jour, arrondi vers le bas (clé `author`) : le bot gagne toujours son propre Diamant", () => {
    for (const j of [daysFromCivil(2026, 11, 4), daysFromCivil(2026, 11, 8)]) {
      const c = dailyBlocks(j);
      const score = jouerDiamant(c).resultat.score;
      const s = seuilsDe(c);
      expect(s.author).toBe(arrondir(score));
      expect(s.author).toBeLessThanOrEqual(score);
      expect(medailleDe([score, 0], s)).toBe("author");
    }
  });

  it("bronze, argent et or sont les références, les mêmes tous les jours, tant que le Diamant est assez haut", () => {
    expect(REFERENCES_MEDAILLES).toEqual({ bronze: 1200, silver: 7500, gold: 11000 });
    expect(seuilsDepuis(32_142)).toEqual({ author: 32_000, gold: 11_000, silver: 7500, bronze: 1200 });
    expect(seuilsDepuis(125_685)).toEqual({ author: 125_500, gold: 11_000, silver: 7500, bronze: 1200 });
    expect(seuilsDepuis(15_000)).toEqual({ author: 15_000, gold: 11_000, silver: 7500, bronze: 1200 });
  });

  it("un Diamant faible ramène les autres sous lui, sans jamais les monter (or ≤ 3/4 du Diamant, argent ≤ 3/4 de l'or, bronze ≤ la moitié de l'argent)", () => {
    expect(seuilsDepuis(9184)).toEqual({ author: 9000, gold: 6500, silver: 4500, bronze: 1200 });
    expect(seuilsDepuis(5648)).toEqual({ author: 5500, gold: 4000, silver: 3000, bronze: 1200 });
    expect(seuilsDepuis(2102)).toEqual({ author: 2000, gold: 1500, silver: 1100, bronze: 500 });
    for (const d of [200, 500, 1000, 3000, 8000, 14_000]) {
      const s = seuilsDepuis(d);
      expect(s.bronze).toBeLessThanOrEqual(REFERENCES_MEDAILLES.bronze);
      expect(s.silver).toBeLessThanOrEqual(REFERENCES_MEDAILLES.silver);
      expect(s.gold).toBeLessThanOrEqual(REFERENCES_MEDAILLES.gold);
      expect(s.author).toBeLessThanOrEqual(Math.max(d, 4));
    }
  });

  it("arrondis : à 100 près jusqu'à 2 000, à 500 près au-delà, vers le bas", () => {
    expect([0, 99, 100, 1234, 1999, 2000, 2001, 2499, 2500, 7425, 11_211, 32_142].map(arrondir)).toEqual([0, 0, 100, 1200, 1900, 2000, 2000, 2000, 2500, 7000, 11_000, 32_000]);
    for (const j of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const s = seuilsDe(dailyBlocks(daysFromCivil(2026, 11, 2) + j));
      for (const v of [s.bronze, s.silver, s.gold, s.author]) expect(v % (v <= 2000 ? 100 : 500), `${v}`).toBe(0);
    }
  });

  it("strictement croissants, bronze < argent < or < Diamant : pour 40 jours, et même pour un Diamant minuscule ou nul", () => {
    for (let i = 0; i < 40; i++) {
      const s = seuilsDe(dailyBlocks(daysFromCivil(2026, 11, 2) + i));
      expect(s.bronze, `jour ${i}`).toBeGreaterThan(0);
      expect(s.bronze).toBeLessThan(s.silver);
      expect(s.silver).toBeLessThan(s.gold);
      expect(s.gold).toBeLessThan(s.author);
    }
    for (const d of [0, 1, 2, 3, 4, 5, 9, 20, 99, 100, 101, 150, 199, 250, 600, 1500, 1999, 2000, 2400, 2600]) {
      const s = seuilsDepuis(d);
      expect(s.bronze, `diamant ${d}`).toBeGreaterThan(0);
      expect(s.bronze < s.silver && s.silver < s.gold && s.gold < s.author, `diamant ${d}`).toBe(true);
      expect(Object.values(s).every(Number.isInteger)).toBe(true);
    }
  });

  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { author: 1000, gold: 670, silver: 330, bronze: 110 };
    expect([0, 109, 110, 329, 330, 669, 670, 999, 1000, 5000].map((v) => medailleDe([v, 3], s))).toEqual([null, null, "bronze", "bronze", "silver", "silver", "gold", "gold", "author", "author"]);
  });

  it("la fiche ne porte qu'une indication : la part du Diamant médian que valent les références (34 %, 23 %, 4 %)", () => {
    expect(PART_DU_DIAMANT_MEDIAN).toEqual({ gold: 34, silver: 23, bronze: 4 });
    expect(Math.round((100 * REFERENCES_MEDAILLES.gold) / 32_142)).toBe(PART_DU_DIAMANT_MEDIAN.gold);
    expect(Math.round((100 * REFERENCES_MEDAILLES.silver) / 32_142)).toBe(PART_DU_DIAMANT_MEDIAN.silver);
    expect(Math.round((100 * REFERENCES_MEDAILLES.bronze) / 32_142)).toBe(PART_DU_DIAMANT_MEDIAN.bronze);
  });
});
