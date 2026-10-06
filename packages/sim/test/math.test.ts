import { describe, expect, it } from "vitest";
import { PI, cos, sin, wrapAngle } from "../src/math";

describe("math déterministe", () => {
  it("sin/cos collent à Math.sin/Math.cos (< 1e-12) sur plusieurs tours", () => {
    for (let i = -2000; i <= 2000; i++) {
      const x = i * 0.0173;
      expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(1e-12);
      expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(1e-12);
    }
  });

  it("valeurs remarquables", () => {
    expect(sin(0)).toBe(0);
    expect(cos(0)).toBeCloseTo(1, 14);
    expect(sin(PI / 2)).toBeCloseTo(1, 14);
  });

  it("wrapAngle ramène dans [-π, π]", () => {
    for (let i = -500; i <= 500; i++) {
      const w = wrapAngle(i * 0.37);
      expect(w).toBeGreaterThanOrEqual(-PI - 1e-12);
      expect(w).toBeLessThanOrEqual(PI + 1e-12);
    }
  });
});
