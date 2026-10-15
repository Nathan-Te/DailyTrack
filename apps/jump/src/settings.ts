import type { KeyValue } from "./memory";
import { storageKey } from "./storage";

// Réglages du joueur (lot 8) : son, vibrations, tremblement, effets visuels, mouvement réduit. Mémorisés sous `jump:settings`, lectures et
// écritures **toujours protégées** (le jeu marche sans stockage). Ils ne touchent jamais à la simulation : une partie n'est jamais
// `tuned` à cause d'eux (seuls les réglages du personnage, `?debug&tune`, le font).

export const SETTINGS_KEY = storageKey("settings");
/** À monter quand un défaut change de sens (un enregistrement plus ancien reprend alors ce défaut). */
export const SETTINGS_VERSION = 1;

export type EffectsLevel = "normal" | "reduit" | "aucun";
export const EFFECTS_LEVELS: readonly EffectsLevel[] = ["normal", "reduit", "aucun"];

export interface PlayerSettings {
  /** Volume général, effets sonores, ambiance (lot 9) : 0 … 1. */
  volume: number;
  sfx: number;
  ambience: number;
  vibration: boolean;
  /** Tremblement d'écran (mort, grosses chutes). */
  shake: boolean;
  effects: EffectsLevel;
  /** Mouvement réduit : ni secousse, ni particules, ni traînée, écrasement discret. Par défaut : ce que demande le système. */
  reducedMotion: boolean;
}

export function defaultSettings(systemReducedMotion = false): PlayerSettings {
  return { volume: 0.8, sfx: 1, ambience: 0.7, vibration: true, shake: true, effects: "normal", reducedMotion: systemReducedMotion };
}

const unit = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

/** Lit un enregistrement (texte JSON ou null) : chaque champ absent ou invalide reprend son défaut. */
export function parseSettings(raw: string | null, systemReducedMotion = false): PlayerSettings {
  const d = defaultSettings(systemReducedMotion);
  if (!raw) return d;
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return d;
    o = parsed as Record<string, unknown>;
  } catch {
    return d;
  }
  if (o.v !== SETTINGS_VERSION) return d;
  return {
    volume: unit(o.volume, d.volume),
    sfx: unit(o.sfx, d.sfx),
    ambience: unit(o.ambience, d.ambience),
    vibration: bool(o.vibration, d.vibration),
    shake: bool(o.shake, d.shake),
    effects: EFFECTS_LEVELS.includes(o.effects as EffectsLevel) ? (o.effects as EffectsLevel) : d.effects,
    reducedMotion: bool(o.reducedMotion, d.reducedMotion),
  };
}

export function loadSettings(store: KeyValue | null, systemReducedMotion = false): PlayerSettings {
  let raw: string | null = null;
  try {
    raw = store?.getItem(SETTINGS_KEY) ?? null;
  } catch {
    raw = null;
  }
  return parseSettings(raw, systemReducedMotion);
}

/** Écrit les réglages ; rend faux si le stockage manque ou lève (rien n'est perdu pour la partie en cours). */
export function saveSettings(store: KeyValue | null, s: PlayerSettings): boolean {
  if (!store) return false;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify({ v: SETTINGS_VERSION, ...s }));
    return true;
  } catch {
    return false;
  }
}

/** Ce que les réglages (et `?fx=off`) permettent à l'affichage : affichage seulement, la simulation n'en sait rien. */
export interface FeelLevels {
  /** Part des particules gardées (0 : aucune ; la mort compris). */
  particles: number;
  /** Poussière de course, frottement de glisse, traînée : les effets continus. */
  continuous: boolean;
  /** Amplitude du tremblement (0 : aucun). */
  shake: number;
  /** Amplitude de l'écrasement et de l'étirement (1 : ceux du lot 8 ; ceux du lot 1 valent ≈ 0,7). */
  squash: number;
  /** Le fanion se lève en douceur (sinon il est posé tout de suite en haut). */
  animate: boolean;
  vibration: boolean;
}

/**
 * Niveaux d'effets. `fxParam` : faux avec `?fx=off` (comme « effets : aucun », sans toucher au réglage mémorisé). Le mouvement réduit
 * coupe particules, secousses et traînée, et garde un écrasement discret. Les taches de peinture ne dépendent jamais de ceci.
 */
export function feelLevels(s: PlayerSettings, fxParam = true): FeelLevels {
  const effects: EffectsLevel = fxParam ? s.effects : "aucun";
  const calm = s.reducedMotion;
  const particles = calm || effects === "aucun" ? 0 : effects === "reduit" ? 0.5 : 1;
  const shakeAmp = calm || !s.shake || effects === "aucun" ? 0 : effects === "reduit" ? 0.5 : 1;
  return {
    particles,
    continuous: particles === 1,
    shake: shakeAmp,
    squash: calm ? 0.35 : effects === "aucun" ? 0.7 : effects === "reduit" ? 0.85 : 1,
    animate: !calm && effects !== "aucun",
    vibration: s.vibration,
  };
}
