import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS, JETONS, VOILES, cssDesJetons, valeurJeton, varJeton } from "../src/jetons";
import { luminance } from "../src/contraste";

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
      expect(nom, nom).toMatch(/^(dj|track|jump|tower)-/);
      expect(v, nom).toMatch(/^(#[0-9A-F]{6}|--(dj|track|jump|tower)-[a-z0-9-]+)$/);
      expect(valeurJeton(nom as keyof typeof COULEURS), nom).toMatch(/^#[0-9A-F]{6}$/);
    }
    // Quelques valeurs de la charte, recopiées ici exprès : un jeton ne change pas sans que la charte change.
    expect(valeurJeton("dj-creme")).toBe("#EDE3CF");
    expect(valeurJeton("dj-terre")).toBe("#C2401F");
    expect(valeurJeton("track-livree")).toBe("#E8552D");
    expect(valeurJeton("jump-jaune")).toBe("#FFD23F");
    expect(valeurJeton("jump-papier")).toBe("#FFF6E0");
    expect(valeurJeton("tower-menthe")).toBe("#9ED9BE");
    expect(valeurJeton("tower-coque")).toBe("#2F7D62");
    expect(valeurJeton("tower-bonus")).toBe("#5DBB63");
    expect(varJeton("dj-encre")).toBe("var(--dj-encre)");
    expect(() => valeurJeton("dj-inconnu" as never)).toThrow(/inconnu/);
  });

  it("un nom de jeton n'apparaît qu'une fois, toutes familles confondues", () => {
    const noms = Object.values(JETONS).flatMap((f) => Object.keys(f));
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("feuilles et composants : aucune couleur ni police en dur (jetons seulement), aucune ombre floue ni translucidité", () => {
    const fichiers = readdirSync(SRC).filter((f) => (f.endsWith(".css") && f !== "jetons.css") || /^(composants|cadre|icones|dom)\.ts$/.test(f));
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
  // Lot S1b (charte rév. 16, § 9) : le voile des écrans de jeu a deux tons sombres alternés, jamais une bande transparente ; une seule définition (`--dj-voile`), lue partout.
  it("le voile : deux tons sombres distincts, assez couverts pour qu'une scène claire n'y fasse pas de zèbre, une seule définition", () => {
    const tons = Object.values(VOILES);
    expect(tons).toHaveLength(2);
    expect(new Set(tons).size).toBe(2);
    const alphas = tons.map((v) => {
      expect(v).toMatch(/^#[0-9A-F]{8}$/);
      return parseInt(v.slice(7), 16) / 255;
    });
    for (const a of alphas) expect(a, "jamais une bande transparente : au moins 70 % de couverture").toBeGreaterThanOrEqual(0.7);
    // Sur de la neige (blanc), chaque bande reste sombre et les deux sont proches : un voile calme.
    const sur = (v: string, fond: number) => {
      const a = parseInt(v.slice(7), 16) / 255;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
      return [r, g, b].map((c) => c! * a + fond * (1 - a));
    };
    const [clair, moyen] = tons.map((v) => sur(v, 255)[0]!);
    expect(Math.max(clair!, moyen!)).toBeLessThan(110);
    expect(Math.abs(clair! - moyen!)).toBeLessThan(45);
    expect(luminance("#1E1B19")).toBeLessThan(0.02);
    // Une seule définition : aucune feuille d'application ne redessine un voile (ni `--cadre-voile` ni `--voile-rayures`).
    for (const f of ["apps/web/src/interface.css", "apps/jump/src/interface.css", "apps/tower/src/base.css", "apps/portail/src/vitrine.css"]) {
      const texte = readFileSync(join(SRC, "../../..", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(texte, f).not.toMatch(/--(cadre-voile|voile-rayures)\s*:/);
    }
    expect(cssDesJetons()).toContain("--dj-voile: repeating-linear-gradient(115deg, #1E1B19D9 0 5px, #1E1B19B3 5px 10px)");
  });
});
