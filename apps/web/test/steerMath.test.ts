import { describe, expect, it } from "vitest";
import { clamp, shape, wrap180 } from "../src/steerMath";

// Lot 52 : l'arithmétique commune de la glissière, du volant et du gyroscope. `shape` est la forme qu'avait le glissement du joystick (lot 10, 70 px de débattement) :
// les nombres des anciens tests de `dragSteer` y sont repris tels quels (course normalisée = dx / 70).
describe("shape : zone morte, puis linéaire jusqu'au plein braquage", () => {
  const dx = (px: number) => px / 70;
  it("zéro dans la zone morte, 1 au bout, symétrique, borné par le plein braquage", () => {
    expect(shape(0, 0.08)).toBe(0);
    expect(shape(dx(70 * 0.08), 0.08)).toBe(0); // pile sur la zone morte
    expect(shape(1, 0.08)).toBe(1);
    expect(shape(-1, 0.08)).toBe(-1);
    expect(shape(100, 0.08)).toBe(1);
    const mid = shape(0.5, 0.08);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.55);
    expect(shape(-dx(20), 0.08)).toBeCloseTo(-shape(dx(20), 0.08), 12);
  });

  it("monotone : plus on va loin, plus on braque", () => {
    let last = -1;
    for (let d = 0; d <= 1; d += 0.02) {
      const v = shape(d, 0.08);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("une zone morte plus large retarde le départ ; jamais −0", () => {
    expect(shape(0.1, 0.3)).toBe(0);
    expect(shape(0.5, 0.3)).toBeGreaterThan(0);
    expect(Object.is(shape(-0.01, 0.08), 0)).toBe(true);
  });
});

describe("outils", () => {
  it("clamp et wrap180", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
    expect(wrap180(190)).toBeCloseTo(-170, 9);
    expect(wrap180(-190)).toBeCloseTo(170, 9);
    expect(wrap180(180)).toBe(180);
    expect(wrap180(-180)).toBe(180);
    expect(wrap180(720)).toBe(0);
  });
});
