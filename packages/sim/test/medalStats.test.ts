import { describe, expect, it } from "vitest";
import { MEDAL_PERCENTILES, medalDayStats, medalPoolStats, medalsFor, percentileOf, ratiosOf, thresholdsOf } from "../src/index";

// Lot 35 : statistiques de l'outil de calibrage des médailles (pures).

describe("percentileOf", () => {
  it("rang le plus proche, sur une liste triée ; null sans valeur", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentileOf(xs, 10)).toBe(1);
    expect(percentileOf(xs, 25)).toBe(3);
    expect(percentileOf(xs, 50)).toBe(5);
    expect(percentileOf(xs, 90)).toBe(9);
    expect(percentileOf(xs, 100)).toBe(10);
    expect(percentileOf(xs, 0)).toBe(1);
    expect(percentileOf([42], 75)).toBe(42);
    expect(percentileOf([], 50)).toBeNull();
  });
});

describe("medalDayStats", () => {
  const pilot = 30_000;
  const medals = medalsFor(pilot); // auteur 30 000, or 32 400, argent 36 000, bronze 42 000

  it("parts cumulées et comptes exacts ; seuil atteint = médaille", () => {
    const times = [45_000, 29_000, 30_000, 32_400, 33_000, 36_000, 41_000, 50_000]; // non triés : la fonction trie
    const s = medalDayStats(times, pilot, medals);
    expect(s.players).toBe(8);
    expect(s.counts).toEqual({ author: 2, gold: 1, silver: 2, bronze: 1, none: 2 });
    expect(s.shares).toEqual({ author: 0.25, gold: 0.375, silver: 0.625, bronze: 0.75 });
    expect(s.percentiles[50]).toBe(33_000);
    expect(s.ratios[50]).toBe(1.1);
    expect(Object.keys(s.percentiles).map(Number)).toEqual([...MEDAL_PERCENTILES]);
  });

  it("sans joueur : percentiles nuls, parts à zéro", () => {
    const s = medalDayStats([], pilot, medals);
    expect(s.players).toBe(0);
    expect(s.percentiles[10]).toBeNull();
    expect(s.shares).toEqual({ author: 0, gold: 0, silver: 0, bronze: 0 });
  });
});

describe("medalPoolStats", () => {
  it("réunit les journées : parts sur tous les joueurs et moyenne des journées ; simule d'autres seuils", () => {
    const a = { ratios: ratiosOf([29_000, 31_000, 35_000, 50_000], 30_000), thresholds: thresholdsOf(medalsFor(30_000), 30_000) };
    const b = { ratios: ratiosOf([40_000, 44_000], 40_000), thresholds: thresholdsOf(medalsFor(40_000), 40_000) };
    expect(a.ratios).toEqual([0.9667, 1.0333, 1.1667, 1.6667]);
    const s = medalPoolStats([a, b, { ratios: [], thresholds: a.thresholds }]);
    expect(s.days).toBe(2);
    expect(s.players).toBe(6);
    expect(s.shares).toEqual({ author: 0.3333, gold: 0.5, silver: 0.8333, bronze: 0.8333 });
    expect(s.meanDayShares).toEqual({ author: 0.375, gold: 0.5, silver: 0.875, bronze: 0.875 });
    // Des seuils plus exigeants (auteur à 0,95 du pilote) : personne n'a l'auteur.
    const harder = medalPoolStats([a, b].map((d) => ({ ...d, thresholds: { author: 0.95, gold: 1.02, silver: 1.1, bronze: 1.25 } })));
    expect(harder.shares.author).toBe(0);
    expect(medalPoolStats([]).meanDayShares).toBeNull();
  });
});
