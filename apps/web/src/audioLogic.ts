// Logique pure du son (lot 9) : régime du moteur, crissement, bruit de roulement, réglages. Aucun accès à Web Audio
// ici : testé par Vitest. Rien de tout cela ne touche à la simulation.

import type { SurfaceKind } from "@cdj/sim";

/** Vitesses (m/s) de changement de rapport : le son simule six rapports, la voiture n'en a pas. */
export const GEAR_SPEEDS = [0, 11, 20, 29, 38, 48, 70] as const;

export interface EngineSound {
  gear: number;
  /** Régime ∈ [0, 1]. */
  rpm: number;
  /** Fréquence fondamentale (Hz). */
  freq: number;
  /** Volume ∈ [0, 1]. */
  gain: number;
}

/** Régime simulé : monte dans un rapport, retombe au suivant ; plus bas sans gaz. */
export function engineSound(speed: number, throttle: number): EngineSound {
  const v = speed < 0 ? 0 : speed;
  let gear = 0;
  while (gear < GEAR_SPEEDS.length - 2 && v >= GEAR_SPEEDS[gear + 1]!) gear++;
  const lo = GEAR_SPEEDS[gear]!;
  const hi = GEAR_SPEEDS[gear + 1]!;
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  const load = Math.min(1, Math.max(0, throttle));
  const rpm = (0.2 + 0.8 * t) * (0.82 + 0.18 * load);
  return { gear: gear + 1, rpm, freq: 48 + rpm * 150, gain: 0.07 + 0.1 * load + 0.04 * rpm };
}

/** Niveau de crissement ∈ [0, 1] : dérive (vitesse latérale ÷ vitesse), vitesse, freinage à fond. En l'air : rien. */
export function skidLevel(slide: number, speed: number, braking: boolean, grounded: boolean): number {
  if (!grounded || speed < 4) return 0;
  const s = slide < 0 ? -slide : slide;
  const over = Math.max(0, s - 0.12); // en dessous, l'adhérence tient
  const lock = braking && speed > 12 ? 0.18 : 0;
  return Math.min(1, over * 3.2 + lock * Math.min(1, speed / 30));
}

export interface SurfaceSound {
  /** Fréquence (Hz) et volume du bruit de roulement, à 30 m/s. */
  rollFreq: number;
  rollGain: number;
  /** Fréquence (Hz) du crissement. */
  skidFreq: number;
}

/** Chaque revêtement a sa voix : sifflement de la route, grondement de la terre, froissement de l'herbe, glissement de la glace. */
export const SURFACE_SOUNDS: Record<SurfaceKind, SurfaceSound> = {
  road: { rollFreq: 900, rollGain: 0.05, skidFreq: 1500 },
  dirt: { rollFreq: 380, rollGain: 0.11, skidFreq: 800 },
  grass: { rollFreq: 600, rollGain: 0.1, skidFreq: 500 },
  ice: { rollFreq: 2400, rollGain: 0.025, skidFreq: 2600 },
};

/** Vent : volume ∈ [0, 0.12] en fonction de la vitesse (au carré, il ne se fait entendre qu'à haute vitesse). */
export function windGain(speed: number): number {
  const r = Math.min(1.5, speed / 48);
  return 0.12 * r * r * 0.6;
}

/** Niveaux de volume du bouton son : muet, puis trois crans. */
export const VOLUME_STEPS = [0, 0.25, 0.55, 1] as const;

export interface AudioSettings {
  /** Volume ∈ [0, 1] (0 = muet). */
  volume: number;
  /** Dernier volume non nul, que la touche M rétablit. */
  last: number;
}

export const DEFAULT_AUDIO: Readonly<AudioSettings> = { volume: 0.55, last: 0.55 };

export function parseAudioSettings(raw: string | null): AudioSettings {
  const s: AudioSettings = { ...DEFAULT_AUDIO };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as { volume?: unknown; last?: unknown };
    if (typeof o.volume === "number" && Number.isFinite(o.volume)) s.volume = Math.min(1, Math.max(0, o.volume));
    if (typeof o.last === "number" && Number.isFinite(o.last) && o.last > 0) s.last = Math.min(1, o.last);
    else if (s.volume > 0) s.last = s.volume;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return s;
}

/** Touche M : muet ↔ dernier volume. */
export function toggleMute(s: AudioSettings): AudioSettings {
  return s.volume > 0 ? { volume: 0, last: s.volume } : { volume: s.last > 0 ? s.last : DEFAULT_AUDIO.last, last: s.last };
}

/** Bouton son : cran suivant (muet → 25 % → 55 % → 100 % → muet). */
export function nextVolume(s: AudioSettings): AudioSettings {
  const i = VOLUME_STEPS.findIndex((v) => v >= s.volume - 1e-9);
  const next = VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length]!;
  return { volume: next, last: next > 0 ? next : s.last };
}

export function volumeIcon(volume: number): string {
  return volume <= 0 ? "🔇" : volume < 0.4 ? "🔈" : volume < 0.8 ? "🔉" : "🔊";
}

/** Fréquence (Hz) d'une note, `semitones` demi-tons au-dessus de 440 Hz (la). */
export function noteFreq(semitones: number): number {
  // 2^(n/12) sans Math.pow : suffit pour un bip (le son n'est pas dans `sim`, mais on garde la même discipline).
  return 440 * Math.exp((semitones * Math.LN2) / 12);
}
