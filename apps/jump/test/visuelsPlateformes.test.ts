import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JUMP_THEME_NAMES } from "@cdj/jump-sim";
import { THEME_NAMES as NOMS_MODULE, THEMES as THEMES_MODULE } from "@cdj/visuels/plateformes";
import { THEMES } from "../src/themes";
import { BLOCK_STYLE } from "../src/blocks";
import { WIND_STYLE } from "../src/wind";

// Lot DA2 : Jump lit sa direction artistique dans `@cdj/visuels/plateformes`. Ces tests tiennent le lien : mêmes thèmes que la simulation, mêmes objets que le module, aucune constante recopiée.
const source = (f: string): string => readFileSync(new URL(`../src/${f}.ts`, import.meta.url), "utf8");

describe("Jump lit la description du module", () => {
  it("les thèmes du module sont ceux de la simulation, dans le même ordre", () => {
    expect([...NOMS_MODULE]).toEqual([...JUMP_THEME_NAMES]);
  });
  it("ce que Jump exporte est l'objet du module (pas une copie)", () => {
    expect(THEMES).toBe(THEMES_MODULE);
    expect(BLOCK_STYLE.blink.fill).toBe(0x6a8cff);
    expect(WIND_STYLE.leaf).toBe(0x9ad48a);
  });
  it("les fichiers de Jump ne recopient ni couleur de thème ni réglage du personnage", () => {
    expect(source("themes")).not.toMatch(/0x2a4426|0x363b44|FORET_TILES/);
    expect(source("look")).not.toMatch(/takeoff: -0\.36|footW: 0\.2/);
    expect(source("blocks")).not.toMatch(/0x6a8cff/);
    expect(source("wind")).not.toMatch(/0x9ad48a/);
    expect(source("decor")).not.toMatch(/DECOR_KEEPOUT = 1\.5/);
  });
});
