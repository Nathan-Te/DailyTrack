import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES_GRAVITY } from "@cdj/gravity-sim";

// Lot GR4 — la musique suit le thème : la fiche nomme une scène par thème (`menu`, `theme:<code>`), le kit annonce celle du départ, et **la scène annonce chaque changement de thème** (le kit ne passe pas la musique à la partie :
// `musiqueDuJeu.ts` est l'instance commune). Les réglages de volume sont ceux du kit (la musique commune ; « Volume des effets » pour les effets).
const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), "utf8");
const fiche = JSON.parse(lire("../../../config/jeux/gravity.json")) as { musique: { scenes: string[] } };

describe("« Gravity » : la musique", () => {
  it("la fiche nomme le menu et une scène par thème", () => {
    expect([...fiche.musique.scenes].sort()).toEqual(["menu", ...THEMES_GRAVITY.map((t) => `theme:${t}`)].sort());
  });
  it("la scène annonce le thème traversé à la musique, et c'est la même instance que celle donnée au kit", () => {
    const scene = lire("../src/scene.ts");
    expect(scene).toMatch(/musique\.scene\(`theme:\$\{th\}`\)/);
    expect(scene).toContain('from "./musiqueDuJeu"');
    expect(lire("../src/main.ts")).toContain('from "./musiqueDuJeu"');
    expect(lire("../src/musiqueDuJeu.ts")).toMatch(/brancherMusique\("gravity", gameStorage\)/);
  });
  it("les effets ont leur réglage de volume (le kit le montre dans les Réglages) et la scène le lit à chaque son", () => {
    expect(lire("../src/definition.ts")).toMatch(/effets: true/);
    expect(lire("../src/scene.ts")).toMatch(/niveau: o\.volumeEffets/);
  });
});
