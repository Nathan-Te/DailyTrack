import { describe, expect, it } from "vitest";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, TICK_RATE, UNITS_PER_TILE } from "../src/index";

describe("constantes", () => {
  it("valent ce que le seed demande", () => {
    expect(TICK_RATE).toBe(120);
    expect(UNITS_PER_TILE).toBe(16 * 256);
    expect(JUMP_SIM_VERSION).toBe(3); // lot 4 : point de passage pris en franchissant sa colonne
    expect(JUMP_GENERATOR_VERSION).toBe(4); // lot 7b : respirations adoucies, tension jusqu’à la fin ; lot 7 : variété (mutateurs, familles, enchaînements longs, repos sur 7 groupes)
  });
});
