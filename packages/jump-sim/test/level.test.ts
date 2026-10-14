import { describe, expect, it } from "vitest";
import { LevelError, TILE_EMPTY, TILE_SOLID, UNITS_PER_TILE, cellOrigin, parseLevel, tileAt } from "../src/index";

const GRID = `
......
.S..F.
######
`;

describe("parseLevel", () => {
  it("lit les dimensions, les tuiles, le départ et l'arrivée", () => {
    const level = parseLevel(GRID);
    expect(level.width).toBe(6);
    expect(level.height).toBe(3);
    expect(level.start).toEqual({ col: 1, row: 1 });
    expect(level.finish).toEqual({ col: 4, row: 1 });
    expect(tileAt(level, 0, 0)).toBe(TILE_EMPTY);
    expect(tileAt(level, 1, 1)).toBe(TILE_EMPTY); // le départ est une tuile vide
    expect(tileAt(level, 4, 1)).toBe(TILE_EMPTY); // l'arrivée aussi
    expect(tileAt(level, 3, 2)).toBe(TILE_SOLID);
    expect(level.tiles.filter((t) => t === TILE_SOLID)).toHaveLength(6);
  });

  it("ignore les lignes vides autour et les fins de ligne Windows", () => {
    expect(parseLevel("\r\n\r\nS.F\r\n###\r\n\r\n")).toEqual(parseLevel("S.F\n###"));
  });

  it("le monde est clos : hors de la grille, c'est plein", () => {
    const level = parseLevel(GRID);
    for (const [c, r] of [[-1, 0], [6, 0], [0, -1], [0, 3]] as const) expect(tileAt(level, c, r)).toBe(TILE_SOLID);
  });

  it("place une tuile en unités entières (1 tuile = 4 096 unités)", () => {
    expect(UNITS_PER_TILE).toBe(4096);
    expect(cellOrigin({ col: 3, row: 2 })).toEqual({ x: 3 * 4096, y: 2 * 4096 });
    expect(Object.is(cellOrigin({ col: 0, row: 0 }).x, 0)).toBe(true);
  });

  it("refuse les grilles mal formées", () => {
    expect(() => parseLevel("")).toThrow(LevelError);
    expect(() => parseLevel("   \n\n")).toThrow("vide");
    expect(() => parseLevel("S.F\n##")).toThrow("Ligne 2");
    expect(() => parseLevel("S.X\n###")).toThrow("caractère « X » inconnu");
    expect(() => parseLevel("..F\n###")).toThrow("un départ");
    expect(() => parseLevel("SSF\n###")).toThrow("un départ");
    expect(() => parseLevel("S..\n###")).toThrow("une arrivée");
    expect(() => parseLevel("SFF\n###")).toThrow("une arrivée");
  });
});
