import { PIECE_KINDS, THEMES_TOWER } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { PALETTE_PORT, type PaletteTheme } from "../src/palette";
import { PALETTES } from "../src/palettes";

// Lot T3 — les six palettes de Tower : un contraste de clarté minimal entre chaque pièce et chaque fond de chaque thème (des aplats bordés d'encre), des couleurs bien formées, aucun
// dégradé ni image (que des couleurs unies), un décor semé à la main (rien de hasardeux : deux lectures donnent la même chose).
const HEX = /^#[0-9A-Fa-f]{6}$/;
const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** La clarté L* (CIE Lab, 0 à 100) d'une couleur `#RRGGBB`. */
export function clarte(hex: string): number {
  const y = 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

const TOUTES: Record<(typeof THEMES_TOWER)[number], PaletteTheme> = { port: PALETTE_PORT, ...PALETTES };
/** La plus petite différence de clarté entre une pièce et un fond (le ciel, le sol, le décor) d'un thème. */
const ecartMin = (p: PaletteTheme): { ecart: number; paire: string } => {
  let ecart = Infinity;
  let paire = "";
  for (const kind of PIECE_KINDS) for (const [nom, fond] of [["ciel", p.ciel], ["sol", p.sol], ["décor", p.decor]] as const) {
    const d = Math.abs(clarte(p.pieces[kind]) - clarte(fond));
    if (d < ecart) [ecart, paire] = [d, `${kind} sur ${nom}`];
  }
  return { ecart, paire };
};

describe("les six palettes", () => {
  it("un thème, une palette : les six du sac, port compris", () => {
    expect(Object.keys(TOUTES).sort()).toEqual([...THEMES_TOWER].sort());
  });

  it("chaque pièce garde une différence de clarté d'au moins 3 (L*) avec chaque fond de chaque thème ; les cinq nouveaux thèmes d'au moins 7", () => {
    for (const th of THEMES_TOWER) {
      const { ecart, paire } = ecartMin(TOUTES[th]);
      expect(ecart, `${th} : ${paire}`).toBeGreaterThanOrEqual(th === "port" ? 3 : 7);
    }
  });

  it("sept pièces de sept couleurs différentes par thème, que des couleurs unies #RRGGBB", () => {
    for (const th of THEMES_TOWER) {
      const p = TOUTES[th];
      expect(new Set(PIECE_KINDS.map((k) => p.pieces[k])).size, th).toBe(7);
      for (const c of [...PIECE_KINDS.map((k) => p.pieces[k]), p.ciel, p.sol, p.vague, p.decor, p.plateforme, p.plateformeReflet, p.pilier]) expect(c, th).toMatch(HEX);
    }
  });

  it("deux thèmes ne se confondent pas : le ciel de chacun est différent", () => {
    expect(new Set(THEMES_TOWER.map((th) => TOUTES[th].ciel)).size).toBe(6);
  });

  it("le décor est fait de rectangles à taille positive, en nombre raisonnable (aplats)", () => {
    for (const th of THEMES_TOWER) {
      const f = TOUTES[th].formes;
      expect(f.length, th).toBeGreaterThan(20);
      expect(f.length, th).toBeLessThan(400);
      for (const [x, y, w, h] of f) {
        expect(Number.isFinite(x + y + w + h), th).toBe(true);
        expect(w > 0 && h > 0, th).toBe(true);
      }
    }
  });
});
