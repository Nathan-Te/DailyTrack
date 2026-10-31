import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dailyTower } from "@cdj/tower-sim";
import { SCENES } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot « musique » : les scènes de la musique de Tower (`packages/musique/src/scenes.ts`) : `menu` (prêt pour son accueil) et le thème du contenu du jour. Un thème de plus (lot T3) fait
// échouer ce test jusqu'à sa ligne de `SCENES` ; `jeu.ts` annonce la scène du thème.
describe("la musique de Tower : une scène par thème", () => {
  it("les scènes connues de Tower sont `menu` et le thème du contenu du jour", () => {
    expect([...SCENES.tower]).toEqual(["menu", `theme:${dailyTower(20_000).theme}`]);
  });

  it("jeu.ts annonce la scène du thème, celle que la liste connaît", () => {
    const code = readFileSync(join(__dirname, "../src/jeu.ts"), "utf8");
    expect(code).toMatch(/const THEME_MUSIQUE = "(\w+)"/);
    expect(`theme:${/const THEME_MUSIQUE = "(\w+)"/.exec(code)![1]}`).toBe(`theme:${dailyTower(20_000).theme}`);
    expect(code).toContain("musique.scene(`theme:${THEME_MUSIQUE}`)");
  });
});
