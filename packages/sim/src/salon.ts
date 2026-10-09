import { GENERATOR_VERSION } from "./constants";
import { bestPilotRun } from "./autopilot";
import { createTestTrack } from "./circuits";
import { generateCircuit, medalsFor, type Medals, type PlacedFigure } from "./generator";
import { Rng, mixSeed } from "./rng";
import { THEME_NAMES, themeByName, type PaletteName, type ThemeName } from "./themes";
import type { Track } from "./track";

// Le Salon (lot 26) : un circuit qui change toutes les 10 minutes, à heure fixe pour tout le monde. Une **session** est un entier,
// `floor(heure UTC en ms / durée)` : l'horloge se lit hors de `sim` (jeu, serveur), qui reçoit l'entier. Le circuit d'une session ne
// dépend que de ce numéro (graine propre au Salon, distincte de celle des circuits du jour), donc le jeu, le serveur qui rejoue les
// courses et les pilotes fictifs de la démonstration obtiennent exactement le même.

/** Durée d'une session du Salon (ms). Le jeu et le serveur peuvent la raccourcir pour des essais (`?salonMinutes`, `SALON_MINUTES`). */
export const SALON_SESSION_MS = 600_000;

/**
 * Décalage de la graine : un numéro de session (≈ 3 millions) et un numéro de jour (≈ 20 000) ne se rencontrent jamais, et la graine d'une
 * session ne retombe jamais sur celle d'un circuit du jour.
 */
export const SALON_SEED_BASE = 0x40000000;

/** Numéro de la session qui contient l'instant `ms` (ms depuis 1970, UTC). */
export const salonSessionAt = (ms: number, lengthMs: number = SALON_SESSION_MS): number => Math.floor(ms / lengthMs);
/** Début de la session (ms UTC). */
export const salonSessionStart = (session: number, lengthMs: number = SALON_SESSION_MS): number => session * lengthMs;
/** Fin de la session (ms UTC) : début de la suivante. */
export const salonSessionEnd = (session: number, lengthMs: number = SALON_SESSION_MS): number => (session + 1) * lengthMs;

/** Thème tiré au sort pour la session, sans règle d'enchaînement. */
const rawTheme = (session: number): ThemeName => THEME_NAMES[new Rng(mixSeed(session, 0x5a10)).int(THEME_NAMES.length)]!;
const isEven = (session: number): boolean => (((session % 2) + 2) % 2) === 0;

/**
 * Thème de la session, **jamais le même que celui de la session d'avant (ni d'après)**. Les sessions paires prennent leur tirage tel quel ;
 * les impaires tirent parmi les thèmes qui diffèrent des tirages de leurs deux voisines paires. Deux sessions de suite ont donc toujours
 * un thème différent, et le calcul ne touche que des thèmes (jamais le circuit d'une autre session).
 */
export function salonTheme(session: number): ThemeName {
  if (isEven(session)) return rawTheme(session);
  const before = rawTheme(session - 1);
  const after = rawTheme(session + 1);
  const allowed = THEME_NAMES.filter((t) => t !== before && t !== after);
  return allowed[new Rng(mixSeed(session, 0x5a11)).int(allowed.length)]!;
}

/** Identifiant du circuit d'une session : `salon-<session>-g<GENERATOR_VERSION>`. */
export const salonTrackId = (session: number): string => `salon-${session}-g${GENERATOR_VERSION}`;

export interface SalonCircuit {
  session: number;
  /** Identifiant du circuit (celui de `track` et des rediffusions). */
  id: string;
  spec: string;
  figures: PlacedFigure[];
  track: Track;
  authorMs: number;
  medals: Medals;
  palette: PaletteName;
  theme: ThemeName;
  /** Vrai si aucune tentative n'a abouti et que le circuit d'essai a servi de secours (ne doit jamais arriver). */
  fallback: boolean;
}

/** Le circuit d'une session : même générateur, mêmes thèmes et mêmes durées que le circuit du jour, graine propre au Salon. */
export function salonCircuit(session: number): SalonCircuit {
  const theme = themeByName(salonTheme(session))!;
  const id = salonTrackId(session);
  const found = generateCircuit(SALON_SEED_BASE + session, theme, 0, id);
  if (found) return { session, id, ...found, palette: theme.palette, theme: theme.name, fallback: false };
  const track = createTestTrack();
  const pilot = bestPilotRun(track);
  const authorMs = pilot ? pilot.finishMs : 40_000;
  return { session, id: track.id, spec: "", figures: [], track, authorMs, medals: medalsFor(authorMs), palette: theme.palette, theme: theme.name, fallback: true };
}
