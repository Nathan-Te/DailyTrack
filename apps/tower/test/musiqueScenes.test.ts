import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES_TOWER } from "@cdj/tower-sim";
import { SCENES } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot « musique » : les scènes de la musique de Tower (`packages/musique/src/scenes.ts`) : `menu` (l'accueil, lot T4) et **un thème de niveaux chacun** (`THEMES_TOWER`, lot T3). Un
// thème ajouté à Tower sans sa ligne de `SCENES` fait échouer ce test ; `accueil.ts` annonce `menu` et `jeu.ts` le thème de la partie (celui de la palette).
describe("la musique de Tower : une scène par thème", () => {
  it("les scènes connues de Tower sont `menu` et un `theme:<code>` par thème", () => {
    expect([...SCENES.tower]).toEqual(["menu", ...THEMES_TOWER.map((n) => `theme:${n}`)]);
  });

  it("jeu.ts annonce `theme:<thème de la partie>` : celui de la palette (`preparation.theme`) ; l'accueil annonce `menu`", () => {
    const jeu = readFileSync(join(__dirname, "../src/jeu.ts"), "utf8");
    expect(jeu).toContain("musique.scene(`theme:${preparation.theme}`)");
    expect(jeu).toContain("chargerPalette(preparation.theme)"); // la même règle que la palette
    expect(readFileSync(join(__dirname, "../src/accueil.ts"), "utf8")).toContain('musique.scene("menu")');
  });

  it("main.ts branche la musique une seule fois (une instance pour l'accueil et le jeu)", () => {
    const main = readFileSync(join(__dirname, "../src/main.ts"), "utf8");
    expect(main).toContain('brancherMusique("tower", gameStorage)');
    expect(readFileSync(join(__dirname, "../src/jeu.ts"), "utf8")).not.toContain("brancherMusique(");
  });
});
