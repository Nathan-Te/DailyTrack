import { describe, expect, it } from "vitest";
import { Rng, mixSeed } from "../src/index";

describe("Rng", () => {
  it("donne toujours la même suite pour la même graine (valeurs figées)", () => {
    const r = new Rng(12345);
    expect([r.next(), r.next(), r.next()]).toMatchInlineSnapshot(`
      [
        4207900869,
        1317490944,
        2079646450,
      ]
    `);
  });

  it("donne des suites différentes pour des graines différentes", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("int(n) reste dans [0, n) et couvre toutes les valeurs", () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("mélange sans perdre ni dupliquer d'éléments, sans toucher l'original", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new Rng(99).shuffle(items);
    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffled).not.toEqual(items);
  });

  it("mixSeed sépare les jours et les tentatives voisins", () => {
    const seeds = new Set<number>();
    for (let d = 0; d < 30; d++) for (let a = 0; a < 10; a++) seeds.add(mixSeed(20000 + d, a));
    expect(seeds.size).toBe(300);
  });
});
