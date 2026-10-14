import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { idiv } from "../src/index";

describe("idiv", () => {
  it("tronque vers zéro, pas vers le bas", () => {
    const cases: [number, number, number][] = [
      [7, 2, 3], [-7, 2, -3], [7, -2, -3], [-7, -2, 3],
      [6, 3, 2], [-6, 3, -2], [1, 4096, 0], [-1, 4096, 0], [4095, 4096, 0], [-4095, 4096, 0], [-4096, 4096, -1], [4097, 4096, 1],
    ];
    for (const [a, b, q] of cases) expect(idiv(a, b), `${a} ÷ ${b}`).toBe(q);
  });

  it("ne renvoie jamais -0", () => {
    for (const [a, b] of [[0, 5], [0, -5], [-1, 2], [1, -2], [-3, 4], [3, -4], [-4095, 4096]] as const) {
      expect(Object.is(idiv(a, b), 0), `${a} ÷ ${b}`).toBe(true);
    }
    expect(Object.is(idiv(-0, 3), 0)).toBe(true);
  });

  it("est exacte sur de grands entiers (comme BigInt, qui tronque aussi vers zéro)", () => {
    const r = new Rng(2024);
    for (let i = 0; i < 2000; i++) {
      const a = (r.int(2 ** 30) * 2 ** 20 + r.int(2 ** 20)) * (r.chance(50) ? 1 : -1);
      const b = (r.int(1_000_000) + 1) * (r.chance(50) ? 1 : -1);
      expect(idiv(a, b), `${a} ÷ ${b}`).toBe(Number(BigInt(a) / BigInt(b)));
    }
  });

  it("vérifie q × b + reste = a, reste du signe de a, |reste| < |b|", () => {
    const r = new Rng(7);
    for (let i = 0; i < 2000; i++) {
      const a = r.int(2_000_000) - 1_000_000;
      const b = (r.int(5000) + 1) * (r.chance(50) ? 1 : -1);
      const q = idiv(a, b);
      const rest = a - q * b;
      expect(Math.abs(rest)).toBeLessThan(Math.abs(b));
      expect(rest === 0 || Math.sign(rest) === Math.sign(a)).toBe(true);
    }
  });

  it("refuse la division par zéro et ce qui n'est pas un entier", () => {
    expect(() => idiv(1, 0)).toThrow(RangeError);
    expect(() => idiv(1.5, 2)).toThrow(RangeError);
    expect(() => idiv(3, 0.5)).toThrow(RangeError);
    expect(() => idiv(Number.NaN, 2)).toThrow(RangeError);
    expect(() => idiv(Infinity, 2)).toThrow(RangeError);
  });
});
