import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { UNITS_PER_TILE, tileOf } from "../src/index";

// `tileOf(v)` = `v >> 12` : l'indice de tuile d'une coordonnée, seul décalage permis dans la simulation (lot 1b).
describe("tileOf", () => {
  it("vaut Math.floor(v / 4096) sur une plage qui traverse zéro, aux bords de chaque tuile", () => {
    for (let v = -3 * UNITS_PER_TILE - 5; v <= 3 * UNITS_PER_TILE + 5; v++) {
      expect(tileOf(v), `v = ${v}`).toBe(Math.floor(v / UNITS_PER_TILE));
    }
  });

  it("vaut Math.floor(v / 4096) sur des coordonnées tirées au hasard, négatives comprises, jusqu'aux grands niveaux", () => {
    const rng = new Rng(11);
    const span = 2000 * UNITS_PER_TILE; // 2 000 tuiles de chaque côté de zéro
    for (let i = 0; i < 200_000; i++) {
      const v = rng.int(2 * span + 1) - span;
      expect(tileOf(v)).toBe(Math.floor(v / UNITS_PER_TILE));
    }
  });

  it("ne renvoie jamais -0", () => {
    for (const v of [0, -0, 1, -1, 4095, -4095, 4096, -4096, -4097, 2 ** 20, -(2 ** 20)]) {
      expect(Object.is(tileOf(v), -0), `v = ${v}`).toBe(false);
    }
    expect(tileOf(-0)).toBe(0);
    expect(Object.is(tileOf(-1), -1)).toBe(true);
  });

  it("les frontières : la dernière unité d'une tuile et la première de la suivante", () => {
    expect(tileOf(UNITS_PER_TILE - 1)).toBe(0);
    expect(tileOf(UNITS_PER_TILE)).toBe(1);
    expect(tileOf(-1)).toBe(-1);
    expect(tileOf(-UNITS_PER_TILE)).toBe(-1);
    expect(tileOf(-UNITS_PER_TILE - 1)).toBe(-2);
  });
});
