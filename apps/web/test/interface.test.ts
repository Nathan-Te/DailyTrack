import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot I4 : les feuilles de DailyTrack suivent la charte « Cartouches » (docs/plateforme/identite.md, § 5 et § 11) comme celles du socle : toute couleur et toute
// police viennent des jetons de @cdj/ui (`var(--…)`), jamais de valeur en dur ; ombres nettes (aucun flou) ; aucune transparence d'arrière-plan ni dégradé de fond
// (seuls les motifs : rayures, livrée, rayons de vitesse). Une exception assumée : `opacity: 0`, l'état de départ des effets de rendu de la course (`#lines`, `#flash`,
// `#fall`), dont main.ts anime l'opacité (présentation seule).
const SRC = join(__dirname, "../src");
const feuilles = readdirSync(SRC).filter((f) => f.endsWith(".css"));

describe("feuilles de style de DailyTrack", () => {
  it("les feuilles du jeu existent (lot 41 : `garage.css`, chargée avec le Garage ; lot 52 : `steer*.css`, chargées avec leur mode de direction)", () => {
    expect(feuilles.sort()).toEqual(["accueil.css", "arrivee.css", "garage.css", "hud.css", "interface.css", "reglages.css", "salon.css", "steerGyro.css", "steerSlider.css", "steerWheel.css", "tactile.css"]);
  });

  for (const f of feuilles) {
    const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    it(`${f} : jetons seulement (aucune couleur ni police en dur), aucune ombre floue, aucune translucidité ni dégradé de fond`, () => {
      expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texte).not.toMatch(/\b(rgba?|hsla?|oklch|color-mix)\(/);
      expect(texte).not.toMatch(/font-family:(?!\s*var\()/);
      expect(texte).not.toMatch(/\bopacity\s*:\s*(?=\S)(?!0\s*;)/);
      expect(texte).not.toMatch(/backdrop-filter|filter:\s*blur|text-shadow/);
      expect(texte).not.toMatch(/(?<!repeating-)linear-gradient\(/);
      expect(texte).not.toMatch(/(?<!mask-image: )radial-gradient\(/);
      for (const m of texte.matchAll(/box-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).not.toMatch(/-?\d+px\s+-?\d+px\s+[1-9]\d*px/);
    });
  }

  it("les polices viennent des jetons (Archivo Black, Archivo, JetBrains Mono, Barlow Condensed) ; aucun émoji dans les feuilles", () => {
    for (const f of feuilles) {
      const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // les commentaires peuvent citer ◀ ▶ : seul ce qui s'affiche compte
      expect(texte, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
