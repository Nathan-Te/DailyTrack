import { Rng, mixSeed } from "@cdj/core";
import { mix } from "./contrast";
import type { Palette } from "./palette";

// Thèmes du jour (lot 9) : une identité visuelle et sonore complète — palette, traitement des tuiles, décor, fond en parallaxe, ambiance.
// **Cosmétique** : le thème n'entre ni dans l'identifiant du niveau ni dans aucune version, et rien de la simulation ne le lit. Il le
// restera tant qu'aucun élément de jeu ne dépendra de lui (une glace glissante, par exemple, serait un élément de jeu, dans son propre lot).
//
// Couleurs réservées, identiques dans tous les thèmes : les **dangers** (pics, scies : `HAZARD`, cernés de `HAZARD_OUTLINE`) et le
// **personnage** (`PLAYER`, ses taches comprises). Les seuils de contraste sont vérifiés par `test/themes.test.ts`.

export const THEME_NAMES = ["foret", "usine", "glace", "nuit", "neon"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Danger : le même rouge partout ; sombre cerne autour des pics et des scies (il les détache d'un bloc friable ou d'un contour clair). */
export const HAZARD = 0xff3b3b;
export const HAZARD_OUTLINE = 0x1a0408;
/** Personnage : le même jaune partout (ses éclats, son fantôme et ses taches aussi). */
export const PLAYER = 0xffd23f;

/** Garniture des faces du dessus. */
export type TrimKind = "herbe" | "rivets" | "givre" | "etoiles" | "neon";
/** Motif du plein intérieur. */
export type PatternKind = "pierres" | "plaques" | "cristaux" | "briques" | "grille";

export interface TileStyle {
  /** Coins extérieurs : arrondis ou chanfreinés, et leur taille (tuiles). */
  corner: "arrondi" | "chanfrein";
  radius: number;
  /** Bande du bord (tuile touchant le vide), plein intermédiaire, plein profond (loin de toute face exposée). */
  face: number;
  fill: number;
  deep: number;
  /** Contours clairs : face du dessus, des côtés, du dessous. */
  rimTop: number;
  rimSide: number;
  rimBottom: number;
  trim: TrimKind;
  /** Couleurs de la garniture (principale, accent). */
  trimA: number;
  trimB: number;
  pattern: PatternKind;
  /** Couleur du motif intérieur (proche du plein profond : un relief, pas un dessin). */
  speck: number;
  /** Fissures des blocs friables. */
  crack: number;
}

/**
 * Une forme de décor : rectangle, disque ou demi-disque (bombé vers le haut). **Aucune forme pointue ni dentée n'existe** : un décor
 * ne peut pas ressembler à un pic ni à une scie (test). Coordonnées locales en tuiles, origine au point d'ancrage, y vers le haut ;
 * pour un décor « mur », x s'éloigne du mur.
 */
export type DecorPart =
  | { shape: "rect"; x: number; y: number; w: number; h: number; color: number }
  | { shape: "disque"; x: number; y: number; r: number; color: number }
  | { shape: "demi"; x: number; y: number; r: number; color: number };

/** Où un décor se pose : sur une face du dessus, contre un mur, ou derrière (au fond, posé au sol, sombre). Jamais au plafond. */
export type DecorAnchor = "dessus" | "mur" | "fond";

export interface DecorKind {
  id: string;
  label: string;
  anchor: DecorAnchor;
  parts: readonly DecorPart[];
  /** Poids du tirage. */
  weight: number;
}

/** Un plan du fond : son motif, sa couleur (sombre, peu contrastée), son facteur de parallaxe (0 : figé à l'écran, 1 : avec le niveau). */
export type ParallaxKind = "collines" | "arbres" | "cheminees" | "poutres" | "montagnes" | "etoiles" | "lune" | "grille" | "skyline";

/** Plans qui remplissent le bas de l'écran (tout sauf les étoiles et la lune, qui ne sont que des points dans le ciel). */
export const fillsBelow = (kind: ParallaxKind): boolean => kind !== "etoiles" && kind !== "lune";

export interface ParallaxLayer {
  kind: ParallaxKind;
  color: number;
  /** Couleur d'accent (fenêtres, cratères, lignes) : elle aussi peu contrastée. */
  accent: number;
  factor: number;
  /** Hauteur de l'horizon du plan, en tuiles sous le centre de l'écran quand la caméra est au milieu du niveau (négatif : au-dessus). */
  horizon: number;
  /** Amplitude des formes (tuiles). */
  height: number;
}

export type AmbienceId = ThemeName;

export interface Theme {
  name: ThemeName;
  label: string;
  palette: Palette;
  tiles: TileStyle;
  decor: readonly DecorKind[];
  /** Du plus lointain au plus proche. */
  parallax: readonly ParallaxLayer[];
  ambience: AmbienceId;
}

const rect = (x: number, y: number, w: number, h: number, color: number): DecorPart => ({ shape: "rect", x, y, w, h, color });
const disc = (x: number, y: number, r: number, color: number): DecorPart => ({ shape: "disque", x, y, r, color });
const half = (x: number, y: number, r: number, color: number): DecorPart => ({ shape: "demi", x, y, r, color });

function palette(name: string, background: number, tile: number, crumble: number, spring: number, finish: number): Palette {
  return { name, background, tile, finish, player: PLAYER, hazard: HAZARD, crumble, spring };
}

// ——— Forêt : herbe et mousse, coins arrondis, collines et arbres ———
const FORET_TILES: TileStyle = {
  corner: "arrondi",
  radius: 0.34,
  face: 0x2a4426,
  fill: 0x1f3420,
  deep: 0x16261a,
  rimTop: 0x8fc46a,
  rimSide: 0x456d3a,
  rimBottom: 0x33522d,
  trim: "herbe",
  trimA: 0x5f9e3c,
  trimB: 0x9fd46f,
  pattern: "pierres",
  speck: 0x1c2f1e,
  crack: 0x4a3f22,
};

// ——— Usine : bandes et rivets, coins chanfreinés, cheminées et poutres ———
const USINE_TILES: TileStyle = {
  corner: "chanfrein",
  radius: 0.22,
  face: 0x363b44,
  fill: 0x2a2e36,
  deep: 0x1e2128,
  rimTop: 0xaab4c0,
  rimSide: 0x59616d,
  rimBottom: 0x454b55,
  trim: "rivets",
  trimA: 0x6c7480,
  trimB: 0xb8c0ca,
  pattern: "plaques",
  speck: 0x181b21,
  crack: 0x3c3a33,
};

// ——— Glace : givre, coins arrondis, montagnes de glace ———
const GLACE_TILES: TileStyle = {
  corner: "arrondi",
  radius: 0.3,
  face: 0x1c3e58,
  fill: 0x18374f,
  deep: 0x122a3e,
  rimTop: 0xdff4ff,
  rimSide: 0x4f86a8,
  rimBottom: 0x2f5c7c,
  trim: "givre",
  trimA: 0xcdeeff,
  trimB: 0x9fd4f0,
  pattern: "cristaux",
  speck: 0x1a3954,
  crack: 0x2f4f66,
};

// ——— Nuit : lisière étoilée, coins chanfreinés, ciel étoilé et lune ———
const NUIT_TILES: TileStyle = {
  corner: "chanfrein",
  radius: 0.18,
  face: 0x2b3260,
  fill: 0x20264a,
  deep: 0x161b36,
  rimTop: 0x9fb0ff,
  rimSide: 0x46508c,
  rimBottom: 0x363f74,
  trim: "etoiles",
  trimA: 0x7f8fe0,
  trimB: 0xe8ecff,
  pattern: "briques",
  speck: 0x121731,
  crack: 0x3a3550,
};

// ——— Néon : liseré lumineux, coins chanfreinés, grille et skyline ———
const NEON_TILES: TileStyle = {
  corner: "chanfrein",
  radius: 0.26,
  face: 0x40306e,
  fill: 0x2f2252,
  deep: 0x201638,
  rimTop: 0x5ff3ff,
  rimSide: 0x7a2fa0,
  rimBottom: 0x5a2078,
  trim: "neon",
  trimA: 0x5ff3ff,
  trimB: 0xff6ad5,
  pattern: "grille",
  speck: 0x281c48,
  crack: 0x4a2a5c,
};

export const THEMES: Record<ThemeName, Theme> = {
  foret: {
    name: "foret",
    label: "forêt",
    palette: palette("forêt", 0x070f0d, FORET_TILES.face, 0xa89a62, 0x39c6ff, 0xf4efe2),
    tiles: FORET_TILES,
    decor: [
      { id: "touffe", label: "touffe d'herbe", anchor: "dessus", weight: 5, parts: [half(-0.16, 0, 0.13, 0x4f8a34), half(0.02, 0, 0.17, 0x5f9e3c), half(0.18, 0, 0.11, 0x467d2f)] },
      { id: "fleur", label: "fleur", anchor: "dessus", weight: 3, parts: [rect(-0.02, 0, 0.04, 0.3, 0x4f8a34), disc(0, 0.34, 0.08, 0xf2eccf), disc(0, 0.34, 0.035, 0xe0b94a)] },
      { id: "fleur-bleue", label: "fleur bleue", anchor: "dessus", weight: 2, parts: [rect(-0.02, 0, 0.04, 0.24, 0x4f8a34), disc(0, 0.27, 0.07, 0x7fa8e8), disc(0, 0.27, 0.03, 0xf2eccf)] },
      { id: "champignon", label: "champignon", anchor: "dessus", weight: 2, parts: [rect(-0.04, 0, 0.08, 0.14, 0xd9cfb0), half(0, 0.13, 0.14, 0x8a7a5a)] },
      { id: "lierre", label: "lierre", anchor: "mur", weight: 3, parts: [rect(0, -0.4, 0.05, 0.8, 0x34582c), disc(0.07, 0.25, 0.07, 0x3f6b33), disc(0.06, -0.05, 0.06, 0x3f6b33), disc(0.08, -0.3, 0.07, 0x3a6330)] },
      { id: "tronc", label: "tronc (fond)", anchor: "fond", weight: 2, parts: [rect(-0.18, 0, 0.36, 2.6, 0x14261c), disc(0, 2.9, 0.75, 0x152a1e), disc(-0.45, 2.5, 0.5, 0x152a1e), disc(0.45, 2.55, 0.55, 0x152a1e)] },
    ],
    parallax: [
      { kind: "collines", color: 0x0d1a1c, accent: 0x0f1d1f, factor: 0.18, horizon: -1, height: 5 },
      { kind: "arbres", color: 0x10201f, accent: 0x132423, factor: 0.38, horizon: 2, height: 4 },
    ],
    ambience: "foret",
  },
  usine: {
    name: "usine",
    label: "usine",
    palette: palette("usine", 0x07090c, USINE_TILES.face, 0x8f8a7c, 0x39ff88, 0x5fd0ff),
    tiles: USINE_TILES,
    decor: [
      { id: "tuyau", label: "tuyau", anchor: "mur", weight: 4, parts: [rect(0, -0.5, 0.16, 1, 0x4a525e), rect(0, 0.18, 0.22, 0.08, 0x5c6572), rect(0, -0.26, 0.22, 0.08, 0x5c6572)] },
      { id: "vanne", label: "vanne", anchor: "dessus", weight: 2, parts: [rect(-0.05, 0, 0.1, 0.22, 0x4a525e), disc(0, 0.3, 0.12, 0x5c6572), disc(0, 0.3, 0.05, 0x2f343c)] },
      { id: "borne", label: "borne", anchor: "dessus", weight: 3, parts: [rect(-0.14, 0, 0.28, 0.26, 0x3f4650), rect(-0.08, 0.16, 0.16, 0.05, 0x6fae6a)] },
      { id: "manometre", label: "manomètre", anchor: "mur", weight: 2, parts: [rect(0, -0.04, 0.08, 0.08, 0x4a525e), disc(0.2, 0, 0.13, 0x5c6572), disc(0.2, 0, 0.09, 0x9aa3ad), rect(0.19, -0.01, 0.07, 0.025, 0x2f343c)] },
      { id: "cheminee", label: "conduit (fond)", anchor: "fond", weight: 2, parts: [rect(-0.25, 0, 0.5, 3, 0x161a20), rect(-0.32, 2.2, 0.64, 0.14, 0x191d24), rect(-0.32, 1.1, 0.64, 0.14, 0x191d24)] },
    ],
    parallax: [
      { kind: "cheminees", color: 0x0f1218, accent: 0x151922, factor: 0.16, horizon: 0, height: 7 },
      { kind: "poutres", color: 0x101218, accent: 0x13161d, factor: 0.36, horizon: 3, height: 5 },
    ],
    ambience: "usine",
  },
  glace: {
    name: "glace",
    label: "glace",
    palette: palette("glace", 0x050c18, GLACE_TILES.face, 0x8fb8cf, 0xd27dff, 0x8affc8),
    tiles: GLACE_TILES,
    decor: [
      { id: "congere", label: "congère", anchor: "dessus", weight: 5, parts: [half(-0.1, 0, 0.18, 0xbfe2f5), half(0.14, 0, 0.12, 0xa9d5ee)] },
      { id: "boule", label: "boule de neige", anchor: "dessus", weight: 2, parts: [disc(0, 0.12, 0.12, 0xd6eefa), disc(0.04, 0.16, 0.04, 0xf2fbff)] },
      { id: "rocher", label: "rocher gelé", anchor: "dessus", weight: 2, parts: [half(0, 0, 0.22, 0x3a6582), half(-0.04, 0.12, 0.1, 0x9fd0ec)] },
      { id: "givre-mur", label: "givre", anchor: "mur", weight: 3, parts: [disc(0.08, 0.2, 0.08, 0x9fd0ec), disc(0.06, -0.05, 0.06, 0xbfe2f5), disc(0.07, -0.28, 0.07, 0x9fd0ec)] },
      { id: "pilier", label: "pilier de glace (fond)", anchor: "fond", weight: 2, parts: [rect(-0.3, 0, 0.6, 2.4, 0x13283f), disc(0, 2.4, 0.3, 0x13283f)] },
    ],
    parallax: [
      { kind: "montagnes", color: 0x0b1630, accent: 0x13213f, factor: 0.14, horizon: -2, height: 8 },
      { kind: "montagnes", color: 0x0e1c3a, accent: 0x162648, factor: 0.32, horizon: 2, height: 5 },
    ],
    ambience: "glace",
  },
  nuit: {
    name: "nuit",
    label: "nuit",
    palette: palette("nuit", 0x04060e, NUIT_TILES.face, 0x8a84a8, 0x39ff88, 0xf0f2ff),
    tiles: NUIT_TILES,
    decor: [
      { id: "lanterne", label: "lanterne", anchor: "dessus", weight: 3, parts: [rect(-0.025, 0, 0.05, 0.5, 0x3a4170), rect(-0.08, 0.5, 0.16, 0.16, 0x4a5290), rect(-0.05, 0.53, 0.1, 0.1, 0xe8c98a)] },
      { id: "herbe-nuit", label: "herbe sombre", anchor: "dessus", weight: 4, parts: [half(-0.12, 0, 0.12, 0x2a3a5c), half(0.08, 0, 0.15, 0x31436a)] },
      { id: "champignon-bleu", label: "champignon lumineux", anchor: "dessus", weight: 2, parts: [rect(-0.03, 0, 0.06, 0.12, 0x8a94c8), half(0, 0.11, 0.11, 0x6fd0e8)] },
      { id: "lierre-nuit", label: "lierre", anchor: "mur", weight: 2, parts: [rect(0, -0.4, 0.05, 0.8, 0x2a3458), disc(0.07, 0.2, 0.06, 0x334070), disc(0.06, -0.15, 0.06, 0x334070)] },
      { id: "arbre-nuit", label: "arbre (fond)", anchor: "fond", weight: 2, parts: [rect(-0.14, 0, 0.28, 2.2, 0x0c1022), disc(0, 2.5, 0.65, 0x0d1226), disc(0.4, 2.2, 0.45, 0x0d1226)] },
    ],
    parallax: [
      { kind: "etoiles", color: 0x1e2448, accent: 0x252b58, factor: 0.04, horizon: -9, height: 14 },
      { kind: "lune", color: 0x252b58, accent: 0x1c2148, factor: 0.06, horizon: -6, height: 2 },
      { kind: "collines", color: 0x0a0e1e, accent: 0x0d1226, factor: 0.24, horizon: 2, height: 4 },
    ],
    ambience: "nuit",
  },
  neon: {
    name: "neon",
    label: "néon",
    palette: palette("néon", 0x07020f, NEON_TILES.face, 0x9a6ad0, 0x7dff5f, 0xff6ad5),
    tiles: NEON_TILES,
    decor: [
      { id: "borne-neon", label: "borne lumineuse", anchor: "dessus", weight: 3, parts: [rect(-0.1, 0, 0.2, 0.32, 0x2a1040), rect(-0.06, 0.06, 0.12, 0.04, 0x5ff3ff), rect(-0.06, 0.16, 0.12, 0.04, 0xff6ad5)] },
      { id: "panneau-neon", label: "panneau néon", anchor: "mur", weight: 3, parts: [rect(0, -0.22, 0.06, 0.44, 0x2a1040), rect(0.06, -0.2, 0.2, 0.4, 0x3a1652), rect(0.1, -0.12, 0.12, 0.05, 0xff6ad5), rect(0.1, 0.02, 0.12, 0.05, 0x5ff3ff)] },
      { id: "cable-neon", label: "câble lumineux", anchor: "mur", weight: 2, parts: [rect(0, -0.5, 0.04, 1, 0x5a2a8a), disc(0.05, 0.1, 0.05, 0x5ff3ff)] },
      { id: "plot", label: "plot", anchor: "dessus", weight: 2, parts: [half(0, 0, 0.16, 0x3a1652), disc(0, 0.06, 0.04, 0x5ff3ff)] },
      { id: "antenne", label: "mât (fond)", anchor: "fond", weight: 2, parts: [rect(-0.08, 0, 0.16, 3, 0x1a0a2a), rect(-0.3, 2.6, 0.6, 0.1, 0x1d0c30), disc(0, 3.1, 0.1, 0x2a1240)] },
    ],
    parallax: [
      { kind: "skyline", color: 0x120a24, accent: 0x2a1450, factor: 0.16, horizon: 0, height: 7 },
      { kind: "grille", color: 0x160c2c, accent: 0x24123f, factor: 0.4, horizon: 4, height: 6 },
    ],
    ambience: "neon",
  },
};

/** Le thème d'un nom (`?theme=`), null si le nom est inconnu. Accepte aussi les noms accentués (« forêt », « néon »). */
export function themeByName(name: string | null | undefined): Theme | null {
  if (!name) return null;
  const key = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return (THEME_NAMES as readonly string[]).includes(key) ? THEMES[key as ThemeName] : null;
}

/** Sel propre aux thèmes de DailyJump (le même numéro de jour ne donne pas la même graine que DailyTrack ni que la palette du lot 0). */
const THEME_SALT = 0x74686d39;

const draw = (day: number, n: number): number => new Rng(mixSeed(day, THEME_SALT)).int(n);

/**
 * Le thème d'un jour (numéro de jour de `@cdj/core`), **pur**. Deux jours consécutifs n'ont jamais le même thème : un jour pair tire
 * librement parmi les cinq ; un jour impair tire parmi ceux que n'ont pas ses deux voisins (pairs, donc connus sans récurrence).
 */
export function themeForDay(day: number): Theme {
  const even = (d: number) => THEME_NAMES[draw(d, THEME_NAMES.length)]!;
  if (((day % 2) + 2) % 2 === 0) return THEMES[even(day)];
  const banned = new Set([even(day - 1), even(day + 1)]);
  const allowed = THEME_NAMES.filter((n) => !banned.has(n));
  return THEMES[allowed[draw(day, allowed.length)]!];
}

/** Toutes les couleurs du fond (ciel et plans de parallaxe, accents compris) : ce qu'un danger ou le personnage peut avoir derrière lui. */
export function backdropColors(t: Theme): number[] {
  return [t.palette.background, ...t.parallax.flatMap((l) => [l.color, l.accent])];
}

/** Couleurs des tuiles pleines qu'un danger peut toucher (bande du bord, plein, plein profond, motif). */
export function solidColors(t: Theme): number[] {
  return [t.tiles.face, t.tiles.fill, t.tiles.deep, t.tiles.speck];
}

/** Couleur d'un niveau de profondeur du plein (0 : bord, 1 : intermédiaire, ≥ 2 : profond). */
export function depthColor(t: TileStyle, depth: number): number {
  if (depth <= 0) return t.face;
  if (depth === 1) return mix(t.face, t.fill, 0.75);
  if (depth === 2) return mix(t.fill, t.deep, 0.5);
  return t.deep;
}
