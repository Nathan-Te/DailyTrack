import type { JumpThemeName } from "../themes";
import { RESTART_VERSION, SINGLE_CLOCK_VERSION } from "../constants";

// Lot 30 : les suites de secours d'avant le maintien minimal du saut, gardées pour les références v3 à v12 (tests et outils seulement : le jeu ne les embarque pas).

/**
 * Le niveau de secours : une suite fixe de variantes, choisie parmi les tirages valides de 400 dates (celle qui tombe le plus près du centre
 * de la cible : 30,13 s, exigence 497 ; lot 7), qui tient toutes les règles. Il ignore le repos. Assemblé et validé comme les autres (test) ; la
 * mesure (`measure:jump`) montre qu'il ne sert jamais. Lot 11 : un thème à mécanique a le sien (il doit tenir le quota de signature).
 */
export const LEGACY_FALLBACK_PIECES: readonly { id: string; variant: number }[] = [
  { id: "cheminee-vide", variant: 1 },
  { id: "pont-friable", variant: 3 },
  { id: "escalier-scies", variant: 0 },
  { id: "descente", variant: 2 },
  { id: "mur-friable", variant: 1 },
  { id: "piliers-scie", variant: 1 },
  { id: "puits", variant: 1 },
  { id: "ascenseur", variant: 5 },
  { id: "chute-pics", variant: 0 },
  { id: "iles-friables", variant: 1 },
];

/** Lot 11 : les suites de secours des thèmes à mécanique (remplies avec le catalogue : voir `fallbackFor`). */
export const LEGACY_FALLBACK_BY_THEME: Readonly<Partial<Record<JumpThemeName, readonly { id: string; variant: number }[]>>> = {
  // Choisies, comme `FALLBACK_PIECES`, parmi les tirages valides (80 dates, thème forcé) : celle qui tombe le plus près du centre.
  usine: [
    { id: "cheminee", variant: 1 },
    { id: "tapis-alternes", variant: 0 },
    { id: "tapis-escalier", variant: 2 },
    { id: "mur-trous", variant: 3 },
    { id: "tunnel", variant: 0 },
    { id: "descente-scies", variant: 1 },
    { id: "escalier-friable", variant: 2 },
    { id: "tapis-mur", variant: 3 },
    { id: "saut-long", variant: 2 },
    { id: "pendule", variant: 3 },
    { id: "tapis-lance", variant: 3 },
  ],
  glace: [
    { id: "pendule", variant: 2 },
    { id: "ressorts-trous", variant: 0 },
    { id: "mur-trous", variant: 2 },
    { id: "petits-trous", variant: 1 },
    { id: "glace-relais", variant: 0 },
    { id: "glace-cheminee", variant: 0 },
    { id: "chute-pics", variant: 2 },
    { id: "iles-friables", variant: 1 },
    { id: "cheminee", variant: 0 },
  ],
  // Lot 12 : choisies par `npm run secours:modules -w @cdj/jump-sim` parmi les tirages valides de 80 dates (thème forcé), les plus proches du centre.
  // Lot 18 (g13) : rechoisie (`secours:modules -- --theme=nuit`, 80 niveaux valides sur 80 dates) — l'ancienne (`FALLBACK_NUIT_V3`) pose des phases de moins de 1,5 s.
  nuit: [
    { id: "nuit-cheminee", variant: 5 },
    { id: "cheminee-pics", variant: 0 },
    { id: "ressort-mur", variant: 1 },
    { id: "scie-ronde", variant: 0 },
    { id: "nuit-opposition", variant: 7 },
    { id: "puits-descente", variant: 2 },
    { id: "nuit-marelle", variant: 4 },
    { id: "piliers", variant: 3 },
    { id: "escalier-friable", variant: 2 },
    { id: "mur-seul", variant: 5 },
    { id: "pendule", variant: 5 },
  ],
  // Lot 16 : l'ancienne suite dépassait 56 rangées avec la galerie de ses voies lentes ; rechoisie (`secours:modules -- --theme=neon`).
  neon: [
    { id: "neon-pics", variant: 2 },
    { id: "mur-trous", variant: 4 },
    { id: "cheminee-scie", variant: 2 },
    { id: "petits-trous", variant: 1 },
    { id: "neon-cheminee", variant: 0 },
    { id: "saut-long", variant: 3 },
    { id: "descente-scies", variant: 0 },
    { id: "cheminee-vide", variant: 3 },
    { id: "grande-scie", variant: 4 },
    { id: "neon-couloir", variant: 2 },
  ],
  // Lot 13 : la forêt (courants d'air), choisie de même (`secours:modules -- --theme=foret`, 80 dates valides sur 80).
  // Lot 19 (g14) : rechoisie (`secours:modules -- --theme=foret`, 80 niveaux valides sur 80 dates) — l'ancienne (`FALLBACK_FORET_V3`) casse la règle
  // de la reprise près d'une voie lente (`slowRespawnProblems`).
  // Lot 27 (g21) : rechoisie (`secours:modules -- --theme=foret`, 80 niveaux valides sur 80 dates) — l'ancienne (`FALLBACK_FORET_V10`) a `vent-rafale` et `vent-relais:1`, à rafales.
  foret: [
    { id: "tunnel-scies", variant: 1 },
    { id: "vent-pont", variant: 1 },
    { id: "chute-pics", variant: 4 },
    { id: "monte-charge", variant: 1 },
    { id: "corniches", variant: 2 },
    { id: "vent-colonne", variant: 0 },
    { id: "marelle", variant: 0 },
    { id: "escalier-friable", variant: 2 },
    { id: "lucarne", variant: 1 },
    { id: "iles-friables", variant: 1 },
    { id: "vent-derive", variant: 3 },
  ],
};

/** Lot 27 : la suite de secours de la forêt de g14 à g20 (versions 4 à 10), gardée pour les références : elle a des rafales (`vent-rafale`, `vent-relais:1`). */
const FALLBACK_FORET_V10: readonly { id: string; variant: number }[] = [
  { id: "tunnel-scies", variant: 1 },
  { id: "vent-puits", variant: 0 },
  { id: "vent-rafale", variant: 0 },
  { id: "saut-plafond", variant: 4 },
  { id: "tunnel", variant: 0 },
  { id: "vent-relais", variant: 1 },
  { id: "puits", variant: 0 },
  { id: "scies-jumelles", variant: 4 },
  { id: "ressort-mur", variant: 3 },
  { id: "cheminee-pics", variant: 1 },
];

/** Lot 16 : la suite de secours du néon d'avant (lot 12), gardée pour la référence v3 (`dailyLevel(jour, thème, 3)` ne change pas). */
const FALLBACK_NEON_V3: readonly { id: string; variant: number }[] = [
  { id: "neon-cheminee", variant: 1 },
  { id: "ressort-scie", variant: 1 },
  { id: "paroi-friable", variant: 2 },
  { id: "escalier-scies", variant: 0 },
  { id: "puits", variant: 2 },
  { id: "petits-trous", variant: 5 },
  { id: "piliers-scie", variant: 5 },
  { id: "demi-tour", variant: 3 },
  { id: "pont-friable", variant: 4 },
  { id: "neon-couloir", variant: 2 },
];

/** Lot 18 : la suite de secours de la nuit d'avant (g9 à g12), gardée pour la référence v3 : certaines de ses variantes ont des phases de moins de 1,5 s. */
const FALLBACK_NUIT_V3: readonly { id: string; variant: number }[] = [
  { id: "mur-seul", variant: 0 },
  { id: "grande-scie", variant: 3 },
  { id: "puits-descente", variant: 1 },
  { id: "marelle", variant: 5 },
  { id: "nuit-marelle", variant: 0 },
  { id: "nuit-escalier", variant: 1 },
  { id: "piliers", variant: 1 },
  { id: "cheminee-quinconce", variant: 1 },
  { id: "plongeon", variant: 1 },
  { id: "nuit-portes", variant: 0 },
];

/** Lot 19 : la suite de secours de la forêt d'avant (g9 à g13), gardée pour la référence v3. */
const FALLBACK_FORET_V3: readonly { id: string; variant: number }[] = [
  { id: "scie-sol", variant: 1 },
  { id: "tremplin", variant: 1 },
  { id: "demi-tour", variant: 0 },
  { id: "mur-friable", variant: 3 },
  { id: "ressort-mur-iles", variant: 3 },
  { id: "corniches", variant: 4 },
  { id: "vent-piliers", variant: 1 },
  { id: "chute-pics", variant: 0 },
  { id: "ressort-scie", variant: 2 },
  { id: "lucarne", variant: 3 },
  { id: "quinconce", variant: 3 },
];

/** La suite de secours d'un thème pour une version de la simulation d'avant la 13. */
export function legacyFallbackFor(theme: JumpThemeName, simVersion: number): readonly { id: string; variant: number }[] {
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "neon") return FALLBACK_NEON_V3;
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "nuit") return FALLBACK_NUIT_V3;
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "foret") return FALLBACK_FORET_V3;
  if (simVersion < RESTART_VERSION && theme === "foret") return FALLBACK_FORET_V10;
  return LEGACY_FALLBACK_BY_THEME[theme] ?? LEGACY_FALLBACK_PIECES;
}
