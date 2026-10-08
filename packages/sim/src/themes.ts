import { Rng, mixSeed } from "./rng";
import type { SurfaceKind, WidthLetter } from "./track";

// Les thèmes du jour (lot 8). Le thème est tiré de la date (même graine que la palette avant le lot 8) ; il règle :
// - la palette (couleurs de la scène) ;
// - les largeurs de route (lot 12) : poids de l'étroite, de la normale et de la large, et nombre de changements de largeur ;
// - les zones de revêtement (terre, glace, herbe) : nombre de zones et poids de chaque revêtement ;
// - les virages relevés (chance qu'un virage le soit) et les blocs à effet (super turbo, moteur coupé) ;
// - le relief (lot 17) : nombre de reliefs marqués (montées, crêtes, descentes) et part des plus raides ;
// - les sauts : chance d'un vrai saut au-dessus du vide, et chance de sections sans rebords sur les parties surélevées ;
// - les cuves (lot 18) : chance d'une cuve droite, d'un mur latéral ou d'un virage en cuve ;
// - un passage signature, qui s'ajoute aux passages marquants ordinaires (chicane, épingle).
// Changer un thème (ou en ajouter un) change le circuit d'une date : `GENERATOR_VERSION` +1.

export const PALETTES = ["desert", "neige", "nuit", "neon", "campagne"] as const;
export type PaletteName = (typeof PALETTES)[number];

export const THEME_NAMES = ["stade", "rallye", "banquise", "nuit", "campagne"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Passages signature : voir `composeSpec` (generator.ts) pour les blocs de chacun. */
export type Signature = "turboBank" | "dirtJump" | "iceChicane" | "cutRun" | "dirtPinch";

export interface Theme {
  name: ThemeName;
  /** Nom affiché dans l'en-tête et les archives. */
  label: string;
  palette: PaletteName;
  /** Zones de revêtement : nombre (min, max) et poids de chaque revêtement ; `null` = route partout. */
  zones: { count: [number, number]; surfaces: [SurfaceKind, number][] } | null;
  /** Largeurs de route : poids de chacune (la largeur de départ et chaque changement s'en tirent) et nombre de changements (min, max). */
  widths: { weights: Record<WidthLetter, number>; changes: [number, number] };
  /** Chance (%) qu'un virage soit relevé. */
  bankChance: number;
  /** Chance (%) d'un super turbo dans un créneau calme. */
  turboChance: number;
  /** Un bloc de moteur coupé (suivi d'un point de contrôle) sur le circuit. */
  cut: boolean;
  /** Relief (lot 17) : nombre (min, max) de reliefs marqués (le premier est toujours d'au moins deux niveaux) et chance (%) qu'un relief soit raide (U2 / U3, D2 / D3). */
  relief: { hills: [number, number]; steep: number };
  /** Chance (%) d'un vrai saut (rampe, vide, réception) en plus de la signature ; 100 = tous les circuits du thème en ont un. */
  jumpChance: number;
  /** Chance (%) qu'une partie surélevée du circuit n'ait pas de rebords. */
  openChance: number;
  /** Chance (%) d'une cuve (lot 18) : cuve droite, mur latéral ou virage en cuve ; 100 = tous les circuits du thème en ont une. */
  cuveChance: number;
  signature: Signature;
}

export const THEMES: Readonly<Record<ThemeName, Readonly<Theme>>> = {
  stade: { name: "stade", label: "Stade", palette: "neon", zones: null, widths: { weights: { e: 1, n: 3, l: 6 }, changes: [1, 2] }, bankChance: 70, turboChance: 30, cut: false, relief: { hills: [1, 3], steep: 60 }, jumpChance: 100, openChance: 0, cuveChance: 100, signature: "turboBank" },
  rallye: { name: "rallye", label: "Rallye", palette: "desert", zones: { count: [2, 3], surfaces: [["dirt", 1]] }, widths: { weights: { e: 6, n: 3, l: 1 }, changes: [1, 2] }, bankChance: 10, turboChance: 0, cut: false, relief: { hills: [2, 3], steep: 50 }, jumpChance: 40, openChance: 40, cuveChance: 0, signature: "dirtJump" },
  banquise: { name: "banquise", label: "Banquise", palette: "neige", zones: { count: [2, 2], surfaces: [["ice", 3], ["dirt", 1]] }, widths: { weights: { e: 1, n: 3, l: 5 }, changes: [1, 2] }, bankChance: 15, turboChance: 0, cut: false, relief: { hills: [1, 3], steep: 30 }, jumpChance: 35, openChance: 0, cuveChance: 25, signature: "iceChicane" },
  nuit: { name: "nuit", label: "Nuit", palette: "nuit", zones: null, widths: { weights: { e: 3, n: 4, l: 3 }, changes: [2, 3] }, bankChance: 20, turboChance: 25, cut: true, relief: { hills: [2, 3], steep: 60 }, jumpChance: 100, openChance: 70, cuveChance: 100, signature: "cutRun" },
  campagne: { name: "campagne", label: "Campagne", palette: "campagne", zones: { count: [2, 3], surfaces: [["dirt", 2], ["grass", 1]] }, widths: { weights: { e: 6, n: 3, l: 1 }, changes: [1, 2] }, bankChance: 10, turboChance: 0, cut: false, relief: { hills: [2, 3], steep: 40 }, jumpChance: 40, openChance: 50, cuveChance: 0, signature: "dirtPinch" },
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
