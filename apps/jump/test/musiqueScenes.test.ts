import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JUMP_THEME_NAMES } from "@cdj/jump-sim";
import { SCENES } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot « musique » : les scènes de la musique de Jump (`packages/musique/src/scenes.ts`) sont **ses thèmes** : un thème ajouté à Jump sans sa ligne de `SCENES` fait échouer ce test.
describe("la musique de Jump : une scène par thème", () => {
  it("les scènes connues de Jump sont `menu` et un `theme:<code>` par thème de niveaux", () => {
    expect([...SCENES.jump]).toEqual(["menu", ...JUMP_THEME_NAMES.map((n) => `theme:${n}`)]);
  });

  it("main.ts annonce `menu` à l'accueil et `theme:<thème du niveau>` sinon (à chaque changement d'écran : `syncPause`)", () => {
    const code = readFileSync(join(__dirname, "../src/main.ts"), "utf8");
    expect(code).toMatch(/musique\.scene\(homeOpen\(\) \? "menu" : `theme:\$\{theme\.name\}`\)/);
  });
});
