import { describe, expect, it } from "vitest";
import { idiv, isqrt, mul, div, mulDiv, ONE } from "../lab/a/fixe";

describe("virgule fixe Q16 (moteur A)", () => {
  it("idiv tronque vers zéro et ne rend jamais -0", () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(7, -2)).toBe(-3);
    expect(Object.is(idiv(-1, 2), -0)).toBe(false);
    expect(idiv(0, 5)).toBe(0);
  });

  it("idiv est exact jusqu'à 2^53 (quotients au bord d'un entier)", () => {
    for (const b of [3, 7, 65535, 65536, 1000003]) {
      const a = b * 1000000 - 1; // juste sous un multiple
      expect(idiv(a, b)).toBe(999999);
      expect(idiv(-a, b)).toBe(-999999);
    }
    const grand = 2 ** 52 + 1;
    expect(idiv(grand, 2)).toBe(2 ** 51);
  });

  it("mul, div et mulDiv sont cohérents", () => {
    expect(mul(ONE, ONE)).toBe(ONE);
    expect(mul(3 * ONE, ONE / 2)).toBe(1.5 * ONE);
    expect(mul(-1, 1)).toBe(0);
    expect(Object.is(mul(-1, 1), -0)).toBe(false);
    expect(div(ONE, 2 * ONE)).toBe(ONE / 2);
    expect(mulDiv(10, 3, 4)).toBe(7);
  });

  it("isqrt est la racine entière", () => {
    for (const n of [0, 1, 2, 3, 4, 15, 16, 17, 65535, 65536, 2 ** 40, 2 ** 52 - 1]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
  });
});
