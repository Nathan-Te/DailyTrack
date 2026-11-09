import { describe, expect, it } from "vitest";
import { QUART, TOUR, cosinus, idiv, sinus } from "../src/index";
import { SINUS_QUART } from "../src/tableSinus";

describe("trigonométrie entière", () => {
  it("la table est celle que calcule l'outil (jamais modifiée à la main)", () => {
    const attendu = Array.from({ length: 257 }, (_, i) => Math.round(65536 * Math.sin((i / 256) * (Math.PI / 2))));
    expect([...SINUS_QUART]).toEqual(attendu);
  });
  it("les points remarquables", () => {
    expect([sinus(0), sinus(QUART), sinus(2 * QUART), sinus(3 * QUART)]).toEqual([0, 65536, 0, -65536]);
    expect([cosinus(0), cosinus(QUART), cosinus(2 * QUART), cosinus(3 * QUART)]).toEqual([65536, 0, -65536, 0]);
    expect(sinus(TOUR / 8)).toBe(46341);
  });
  it("reste proche du vrai sinus (moins de 3 sur 65 536) et antisymétrique, sur un tour entier et au-delà", () => {
    let pire = 0;
    for (let a = -TOUR; a < 2 * TOUR; a += 7) {
      pire = Math.max(pire, Math.abs(sinus(a) - 65536 * Math.sin((a / TOUR) * 2 * Math.PI)));
      expect(sinus(-a) + sinus(a)).toBe(0);
    }
    expect(pire).toBeLessThan(3);
  });
  it("sin² + cos² ≈ 1", () => {
    for (let a = 0; a < TOUR; a += 97) expect(Math.abs(sinus(a) ** 2 + cosinus(a) ** 2 - 65536 ** 2)).toBeLessThan(65536 * 8);
  });
  it("la division entière va vers zéro", () => {
    expect([idiv(7, 2), idiv(-7, 2), idiv(-1, 120), idiv(0, 5)]).toEqual([3, -3, 0, 0]);
  });
});
