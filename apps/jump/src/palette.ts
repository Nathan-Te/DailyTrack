import type { Palette } from "@cdj/visuels/plateformes";
import { THEMES, THEME_NAMES, themeForDay } from "./themes";

// Palette du jour : le fond uni, les tuiles, le personnage. Depuis le lot 9, elle est **la palette du thème du jour** (`themes.ts`) :
// les dangers et le personnage y gardent leurs couleurs réservées. Présentation seulement : la simulation ne la connaît pas.

// Lot DA2 : le type `Palette` est celui du module des plateformes.
export type { Palette };

export const PALETTES: readonly Palette[] = THEME_NAMES.map((n) => THEMES[n].palette);

export function paletteForDay(day: number): Palette {
  return themeForDay(day).palette;
}
