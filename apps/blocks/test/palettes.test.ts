import { THEMES_BLOCKS } from "@cdj/blocks-sim";
import { ENCRE, PALETTE_PORT, PAPIER, type PaletteTheme } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { describe, expect, it } from "vitest";
import { couleurDeFamille, couleursDeTheme, estSombre, FAMILLES } from "../src/couleurs";

// Lot B3 — les palettes par thème de Blocks : celles de Tower (module commun), huit familles de pièces de huit couleurs bien distinctes, lisibles sur les fonds de chaque thème. Des aplats seulement.
const TOUTES: Record<(typeof THEMES_BLOCKS)[number], PaletteTheme> = { port: PALETTE_PORT, ...PALETTES };
const HEX = /^#[0-9A-Fa-f]{6}$/;
const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const xyz = (hex: string): [number, number, number] => {
  const r = lin(parseInt(hex.slice(1, 3), 16));
  const g = lin(parseInt(hex.slice(3, 5), 16));
  const b = lin(parseInt(hex.slice(5, 7), 16));
  return [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
};
const f = (v: number): number => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
/** CIE Lab (L*, a*, b*) d'une couleur `#RRGGBB`. */
const lab = (hex: string): [number, number, number] => {
  const [x, y, z] = xyz(hex);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const deltaE = (a: string, b: string): number => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]!));
const clarte = (hex: string): number => lab(hex)[0];

describe("les palettes par thème de Blocks", () => {
  it("un thème, une palette : les six du sac, port compris, ceux de Tower", () => {
    expect(Object.keys(TOUTES).sort()).toEqual([...THEMES_BLOCKS].sort());
  });

  it("huit familles, huit couleurs : au moins ΔE 25 les unes des autres dans chaque thème, que des couleurs unies #RRGGBB", () => {
    for (const th of THEMES_BLOCKS) {
      const cs = FAMILLES.map((fam) => couleurDeFamille(TOUTES[th], fam));
      expect(new Set(cs).size, th).toBe(8);
      for (const c of cs) expect(c, th).toMatch(HEX);
      let min = Infinity;
      let paire = "";
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (deltaE(cs[i]!, cs[j]!) < min) [min, paire] = [deltaE(cs[i]!, cs[j]!), `${FAMILLES[i]} / ${FAMILLES[j]}`];
      expect(min, `${th} : ${paire}`).toBeGreaterThanOrEqual(25);
    }
  });

  it("le rectangle, huitième couleur, n'est dans aucune des sept formes du module : un mélange du bleu (J) et du vert (S)", () => {
    for (const th of THEMES_BLOCKS) expect(Object.values(TOUTES[th].pieces), th).not.toContain(couleurDeFamille(TOUTES[th], "rectangle"));
  });

  it("chaque famille garde une différence de clarté d'au moins 3 (L*) avec le ciel et le sol du thème (7 pour les cinq nouveaux thèmes), comme dans Tower", () => {
    for (const th of THEMES_BLOCKS) {
      const p = TOUTES[th];
      const t = couleursDeTheme(p);
      for (const fam of FAMILLES) for (const [nom, fond] of [["ciel", t.fond], ["grille", t.grille]] as const) {
        expect(Math.abs(clarte(t.familles[fam]) - clarte(fond)), `${th} : ${fam} sur ${nom}`).toBeGreaterThanOrEqual(th === "port" ? 3 : 7);
      }
    }
  });

  it("une case vide se distingue de la grille, la grille du ciel ; les cartes sont claires dans tous les thèmes (leurs étiquettes restent en encre)", () => {
    for (const th of THEMES_BLOCKS) {
      const t = couleursDeTheme(TOUTES[th]);
      expect(deltaE(t.caseVide, t.grille), `${th} : case / grille`).toBeGreaterThanOrEqual(6);
      expect(deltaE(t.grille, t.fond), `${th} : grille / ciel`).toBeGreaterThanOrEqual(8); // et le cadre (encre, ou papier la nuit) l'entoure
      for (const zone of [t.zone, t.zoneSuivante]) expect(clarte(zone), th).toBeGreaterThan(60);
      for (const c of [t.fond, t.grille, t.caseVide, t.cadre, t.zone, t.zoneSuivante, t.depart]) expect(c, th).toMatch(HEX);
    }
  });

  it("seul le thème de nuit est sombre : ses textes et son cadre passent en clair", () => {
    expect(THEMES_BLOCKS.filter((th) => estSombre(TOUTES[th]))).toEqual(["nuit"]);
    expect(couleursDeTheme(PALETTES.nuit).cadre).toBe(PAPIER);
    expect(couleursDeTheme(PALETTE_PORT).cadre).toBe(ENCRE);
  });

  it("deux thèmes ne se confondent pas : le ciel de chacun est différent", () => {
    expect(new Set(THEMES_BLOCKS.map((th) => TOUTES[th].ciel)).size).toBe(6);
  });
});
