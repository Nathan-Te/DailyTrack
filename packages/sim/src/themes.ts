import { Rng, mixSeed } from "./rng";
import type { SurfaceKind } from "./track";

// Les thèmes du jour (lot 8). Le thème est tiré de la date (même graine que la palette avant le lot 8) ; il règle :
// - la palette (couleurs de la scène) ;
// - les zones de revêtement (terre, glace, herbe) : nombre de zones et poids de chaque revêtement ;
// - les virages relevés (chance qu'un virage le soit) et les blocs à effet (super turbo, moteur coupé) ;
// - un passage signature, qui s'ajoute aux passages marquants ordinaires (tremplin, chicane, épingle).
// Changer un thème (ou en ajouter un) change le circuit d'une date : `GENERATOR_VERSION` +1.

export const PALETTES = ["desert", "neige", "nuit", "neon", "campagne"] as const;
export type PaletteName = (typeof PALETTES)[number];

export const THEME_NAMES = ["stade", "rallye", "banquise", "nuit", "campagne"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Passages signature : voir `composeSpec` (generator.ts) pour les blocs de chacun. */
export type Signature = "turboBank" | "dirtJump" | "iceChicane" | "cutRun" | "dirtHairpin";

export interface Theme {
  name: ThemeName;
  /** Nom affiché dans l'en-tête et les archives. */
  label: string;
  palette: PaletteName;
  /** Zones de revêtement : nombre (min, max) et poids de chaque revêtement ; `null` = route partout. */
  zones: { count: [number, number]; surfaces: [SurfaceKind, number][] } | null;
  /** Chance (%) qu'un virage soit relevé. */
  bankChance: number;
  /** Chance (%) d'un super turbo dans un créneau calme. */
  turboChance: number;
  /** Un bloc de moteur coupé (suivi d'un point de contrôle) sur le circuit. */
  cut: boolean;
  signature: Signature;
}

export const THEMES: Readonly<Record<ThemeName, Readonly<Theme>>> = {
  stade: { name: "stade", label: "Stade", palette: "neon", zones: null, bankChance: 70, turboChance: 30, cut: false, signature: "turboBank" },
  rallye: { name: "rallye", label: "Rallye", palette: "desert", zones: { count: [2, 3], surfaces: [["dirt", 1]] }, bankChance: 10, turboChance: 0, cut: false, signature: "dirtJump" },
  banquise: { name: "banquise", label: "Banquise", palette: "neige", zones: { count: [2, 2], surfaces: [["ice", 3], ["dirt", 1]] }, bankChance: 15, turboChance: 0, cut: false, signature: "iceChicane" },
  nuit: { name: "nuit", label: "Nuit", palette: "nuit", zones: null, bankChance: 20, turboChance: 25, cut: true, signature: "cutRun" },
  campagne: { name: "campagne", label: "Campagne", palette: "campagne", zones: { count: [2, 3], surfaces: [["dirt", 2], ["grass", 1]] }, bankChance: 10, turboChance: 0, cut: false, signature: "dirtHairpin" },
};

/** Thème de la journée : tiré de la date (graine = jour UTC), identique pour tout le monde. */
export function themeForDay(day: number): Theme {
  return THEMES[THEME_NAMES[new Rng(mixSeed(day, 0x70a1)).int(THEME_NAMES.length)]!];
}

export function paletteForDay(day: number): PaletteName {
  return themeForDay(day).palette;
}

/** Thème demandé par un nom (`?theme=banquise`), ou `null`. */
export function themeByName(name: string | null | undefined): Theme | null {
  return name && (THEME_NAMES as readonly string[]).includes(name) ? THEMES[name as ThemeName] : null;
}
