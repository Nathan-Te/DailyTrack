import { THEMES, THEME_NAMES, themeForDay } from "./themes";

// Palette du jour : le fond uni, les tuiles, le personnage. Depuis le lot 9, elle est **la palette du thème du jour** (`themes.ts`) :
// les dangers et le personnage y gardent leurs couleurs réservées. Présentation seulement : la simulation ne la connaît pas.

export interface Palette {
  name: string;
  /** Fond uni (le ciel, derrière les plans de parallaxe). */
  background: number;
  /** Tuiles pleines (la bande du bord : les taches s'y fondent en s'effaçant). */
  tile: number;
  /** Arrivée. */
  finish: number;
  /** Personnage (et ses éclats à la mort, son fantôme, ses taches) : la même couleur dans tous les thèmes. */
  player: number;
  /** Dangers : pics et scies (lot 2) : la même couleur dans tous les thèmes. */
  hazard: number;
  /** Blocs friables. */
  crumble: number;
  /** Ressorts (le plateau). */
  spring: number;
}

export const PALETTES: readonly Palette[] = THEME_NAMES.map((n) => THEMES[n].palette);

export function paletteForDay(day: number): Palette {
  return themeForDay(day).palette;
}
