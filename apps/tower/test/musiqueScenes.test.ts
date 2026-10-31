import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES_TOWER } from "@cdj/tower-sim";
import { SCENES } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot « musique » : les scènes de la musique de Tower (`packages/musique/src/scenes.ts`) : `menu` (prêt pour son accueil) et **un thème de niveaux chacun** (`THEMES_TOWER`, lot T3). Un
// thème ajouté à Tower sans sa ligne de `SCENES` fait échouer ce test ; `jeu.ts` annonce le thème de la partie (celui de la palette).
describe("la musique de Tower : une scène par thème", () => {
  it("les scènes connues de Tower sont `menu` et un `theme:<code>` par thème", () => {
    expect([...SCENES.tower]).toEqual(["menu", ...THEMES_TOWER.map((n) => `theme:${n}`)]);
  });

  it("jeu.ts annonce `theme:<thème de la partie>` : celui de `?theme=`, sinon du contenu du jour, sinon le port (comme la palette)", () => {
    const code = readFileSync(join(__dirname, "../src/jeu.ts"), "utf8");
    expect(code).toContain('musique.scene(`theme:${options.theme ?? (contenu as Partial<Contenu>).theme ?? "port"}`)');
    expect(code).toContain('chargerPalette(options.theme ?? (contenu as Partial<Contenu>).theme ?? "port")'); // la même règle que la palette
  });
});
