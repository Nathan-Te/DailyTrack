import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS, JETONS, cssDesJetons, valeurJeton, varJeton } from "../src/jetons";

// Lot I1 : une seule source pour les jetons (jetons.ts) ; jetons.css en est généré et doit être à jour. Les feuilles et les composants
// n'écrivent aucune couleur ni police en dur : tout passe par `var(--…)`.
const SRC = join(__dirname, "../src");

describe("jetons de la charte", () => {
  it("jetons.css est généré depuis jetons.ts (MAJ_JETONS=1 pour le réécrire)", () => {
    const fichier = join(SRC, "jetons.css");
    if (process.env.MAJ_JETONS) writeFileSync(fichier, cssDesJetons());
    expect(readFileSync(fichier, "utf8")).toBe(cssDesJetons());
  });

  it("les couleurs de la charte (§ 3), au format #RRGGBB ou en renvoi vers un autre jeton", () => {
    for (const [nom, v] of Object.entries(COULEURS)) {
      expect(nom, nom).toMatch(/^(dj|track|jump)-/);
      expect(v, nom).toMatch(/^(#[0-9A-F]{6}|--(dj|track|jump)-[a-z0-9-]+)$/);
      expect(valeurJeton(nom as keyof typeof COULEURS), nom).toMatch(/^#[0-9A-F]{6}$/);
    }
    // Quelques valeurs de la charte, recopiées ici exprès : un jeton ne change pas sans que la charte change.
    expect(valeurJeton("dj-creme")).toBe("#EDE3CF");
    expect(valeurJeton("dj-terre")).toBe("#C2401F");
    expect(valeurJeton("track-livree")).toBe("#E8552D");
    expect(valeurJeton("jump-jaune")).toBe("#FFD23F");
    expect(valeurJeton("jump-papier")).toBe("#FFF6E0");
    expect(varJeton("dj-encre")).toBe("var(--dj-encre)");
    expect(() => valeurJeton("dj-inconnu" as never)).toThrow(/inconnu/);
  });

  it("un nom de jeton n'apparaît qu'une fois, toutes familles confondues", () => {
    const noms = Object.values(JETONS).flatMap((f) => Object.keys(f));
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("feuilles et composants : aucune couleur ni police en dur (jetons seulement), aucune ombre floue ni translucidité", () => {
    const fichiers = readdirSync(SRC).filter((f) => (f.endsWith(".css") && f !== "jetons.css") || /^(composants|icones|dom)\.ts$/.test(f));
    expect(fichiers.length).toBeGreaterThanOrEqual(5);
    for (const f of fichiers) {
      const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(texte, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texte, f).not.toMatch(/\b(rgba?|hsla?|oklch|color-mix)\(/);
      expect(texte, f).not.toMatch(/font-family:(?!\s*var\()/);
      expect(texte, f).not.toMatch(/\bopacity\s*:/);
      expect(texte, f).not.toMatch(/backdrop-filter|filter:\s*blur|linear-gradient\((?!90deg|115deg)/);
      // Ombres : jamais de flou (troisième longueur non nulle).
      for (const m of texte.matchAll(/box-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).not.toMatch(/-?\d+px\s+-?\d+px\s+[1-9]\d*px/);
    }
  });
});
