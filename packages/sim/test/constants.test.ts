import { describe, expect, it } from "vitest";
import { DT, TICK_RATE, ticksToMs } from "../src/index";

describe("constantes", () => {
  it("utilise un pas fixe de 120 Hz", () => {
    expect(TICK_RATE).toBe(120);
    expect(DT * TICK_RATE).toBeCloseTo(1, 12);
  });

  it("convertit les pas en millisecondes", () => {
    expect(ticksToMs(0)).toBe(0);
    expect(ticksToMs(120)).toBe(1000);
    expect(ticksToMs(60)).toBe(500);
  });
});
