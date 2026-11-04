import { PIECE_KINDS, THEMES_TOWER } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { PALETTE_PORT, type PaletteTheme } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { clarte, HEX } from "./_couleurs";

// Lot T3 — les six palettes de Tower : un contraste de clarté minimal entre chaque pièce et chaque fond de chaque thème (des aplats bordés d'encre), des couleurs bien formées, aucun
// dégradé ni image (que des couleurs unies). Lot T9 : le décor n'est plus dans la palette ; ses trois plans et son ciel haut ont leur test (`decors.test.ts`, qui réutilise `clarte`).
const TOUTES: Record<(typeof THEMES_TOWER)[number], PaletteTheme> = { port: PALETTE_PORT, ...PALETTES };
/** La plus petite différence de clarté entre une pièce et un fond (le ciel, le sol) d'un thème. */
const ecartMin = (p: PaletteTheme): { ecart: number; paire: string } => {
  let ecart = Infinity;
  let paire = "";
  for (const kind of PIECE_KINDS) for (const [nom, fond] of [["ciel", p.ciel], ["sol", p.sol]] as const) {
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
      for (const c of [...PIECE_KINDS.map((k) => p.pieces[k]), p.ciel, p.sol, p.vague, p.plateforme, p.plateformeReflet, p.pilier]) expect(c, th).toMatch(HEX);
    }
  });

  it("deux thèmes ne se confondent pas : le ciel de chacun est différent", () => {
    expect(new Set(THEMES_TOWER.map((th) => TOUTES[th].ciel)).size).toBe(6);
  });
});
