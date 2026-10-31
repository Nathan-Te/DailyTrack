import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_NAMES } from "@cdj/sim";
import { SCENES } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot « musique » : les scènes de la musique de Track (`packages/musique/src/scenes.ts`) sont **ses thèmes** : un thème ajouté à Track sans sa ligne de `SCENES` fait échouer ce test (et
// la commande `npm run musique` refuserait un morceau qui le nomme). Le jeu annonce sa scène à la musique : `menu` à l'accueil, sinon `theme:<code>` du circuit en cours.
describe("la musique de Track : une scène par thème", () => {
  it("les scènes connues de Track sont `menu` et un `theme:<code>` par thème de niveaux", () => {
    expect([...SCENES.track]).toEqual(["menu", ...THEME_NAMES.map((n) => `theme:${n}`)]);
  });

  it("main.ts annonce la scène à l'accueil, au départ d'un circuit et au changement de circuit du Salon", () => {
    const code = readFileSync(join(__dirname, "../src/main.ts"), "utf8");
    expect(code).toMatch(/musique\.scene\(homeOpen \? "menu" : themeMusique && `theme:\$\{themeMusique\}`\)/);
    expect(code.match(/syncMusique\(\);/g)?.length).toBeGreaterThanOrEqual(4); // au chargement, à l'accueil, au départ du circuit, au changement de circuit du Salon
  });
});
