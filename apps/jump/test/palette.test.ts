import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { PALETTES, paletteForDay } from "../src/palette";
import { STORAGE_PREFIX, storageKey } from "../src/storage";

describe("palette du jour", () => {
  const first = daysFromCivil(2026, 10, 13);

  it("est la même pour un même jour et vient de la liste", () => {
    for (let d = 0; d < 60; d++) {
      expect(paletteForDay(first + d)).toBe(paletteForDay(first + d));
      expect(PALETTES).toContain(paletteForDay(first + d));
    }
  });

  it("change d'un jour à l'autre (toutes les palettes sortent sur 60 jours)", () => {
    const names = new Set<string>();
    for (let d = 0; d < 60; d++) names.add(paletteForDay(first + d).name);
    expect(names.size).toBe(PALETTES.length);
  });

  it("le fond se distingue des tuiles et du personnage", () => {
    for (const p of PALETTES) {
      expect(p.background).not.toBe(p.tile);
      expect(p.background).not.toBe(p.player);
      expect(p.tile).not.toBe(p.player);
    }
  });
});

describe("stockage local", () => {
  it("toutes les clés portent le préfixe jump: (DailyTrack garde cdj:)", () => {
    expect(STORAGE_PREFIX).toBe("jump:");
    expect(storageKey("settings")).toBe("jump:settings");
  });
});
