import { TILE_SOLID, tileAt } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { clampCenterX } from "../src/scene";
import { TEST_LEVEL } from "../src/testLevel";

describe("grille d'essai", () => {
  it("fait deux à trois écrans de long (un écran = 32 tuiles de 18 de haut)", () => {
    expect(TEST_LEVEL.height).toBe(18);
    expect(TEST_LEVEL.width).toBeGreaterThanOrEqual(64);
    expect(TEST_LEVEL.width).toBeLessThanOrEqual(96);
  });

  it("pose le départ et l'arrivée sur du plein", () => {
    const { start, finish } = TEST_LEVEL;
    expect(tileAt(TEST_LEVEL, start.col, start.row + 1)).toBe(TILE_SOLID);
    expect(tileAt(TEST_LEVEL, finish.col, finish.row + 1)).toBe(TILE_SOLID);
    expect(start.col).toBeLessThan(finish.col);
  });
});

describe("cadrage de la vue", () => {
  it("reste dans le niveau, ou le centre s'il tient à l'écran", () => {
    expect(clampCenterX(TEST_LEVEL, 16, -5)).toBe(16);
    expect(clampCenterX(TEST_LEVEL, 16, 1000)).toBe(TEST_LEVEL.width - 16);
    expect(clampCenterX(TEST_LEVEL, 16, 40)).toBe(40);
    expect(clampCenterX(TEST_LEVEL, 60, 10)).toBe(TEST_LEVEL.width / 2);
  });
});
