import type { JumpMedal } from "@cdj/jump-sim";
import type { GameEvent } from "./events";

// Son de DailyJump (lot 8), **logique pure** et testée, sans Web Audio : quel son pour quel événement (recettes procédurales : notes et
// bruits filtrés, zéro fichier), atténuation des scies par la distance, plafond de polyphonie, débit des morts pendant le carnage, et
// conversion des réglages en gains. `audio.ts` ne fait que jouer ce qu'on décide ici.

/** Une couche d'un son : une note (oscillateur) ou un bruit filtré, avec son enveloppe (attaque brève, décroissance exponentielle). */
export interface Layer {
  type: "tone" | "noise";
  /** Forme d'onde d'une note. */
  wave?: OscillatorType;
  /** Fréquence de départ (Hz) : note, ou centre du filtre d'un bruit. */
  freq: number;
  /** Fréquence d'arrivée (glissando, ou balayage du filtre). */
  to?: number;
  /** Durée (s). */
  dur: number;
  /** Volume de crête (avant le bus et le volume général). */
  gain: number;
  /** Départ retardé (s). */
  delay?: number;
  /** Filtre d'un bruit (passe-bande par défaut) et sa résonance. */
  filter?: BiquadFilterType;
  q?: number;
}

export type SoundId =
  | "pas"
  | "saut"
  | "sautMural"
  | "atterrissage"
  | "mort"
  | "reapparition"
  | "ressort"
  | "friableCraque"
  | "friableTombe"
  | "pointDePassage"
  | "arrivee"
  | "medaille";

export interface SoundSpec {
  id: SoundId;
  layers: Layer[];
  /** 0 discret (pas) … 3 essentiel (mort, arrivée, médaille) : un son essentiel passe toujours, même polyphonie pleine. */
  priority: number;
  /** Durée totale (s), couches et retards compris. */
  duration: number;
}

/** Fréquence d'une note, en demi-tons depuis le la 440 Hz. */
export const noteFreq = (semitones: number): number => 440 * 2 ** (semitones / 12);

const tone = (wave: OscillatorType, freq: number, dur: number, gain: number, delay = 0, to?: number): Layer => ({ type: "tone", wave, freq, dur, gain, delay, to });
const noise = (freq: number, dur: number, gain: number, delay = 0, to?: number, filter: BiquadFilterType = "bandpass", q = 1.2): Layer => ({ type: "noise", freq, dur, gain, delay, to, filter, q });

/** Phrase de chaque médaille : la plus belle est la plus haute et la plus longue (notes en demi-tons depuis le la). */
export const MEDAL_PHRASES: Record<JumpMedal, readonly { note: number; at: number; dur: number }[]> = {
  bronze: [
    { note: 3, at: 0, dur: 0.14 },
    { note: 7, at: 0.12, dur: 0.22 },
  ],
  silver: [
    { note: 3, at: 0, dur: 0.12 },
    { note: 7, at: 0.1, dur: 0.12 },
    { note: 10, at: 0.2, dur: 0.26 },
  ],
  gold: [
    { note: 3, at: 0, dur: 0.1 },
    { note: 7, at: 0.09, dur: 0.1 },
    { note: 10, at: 0.18, dur: 0.1 },
    { note: 15, at: 0.27, dur: 0.36 },
  ],
  author: [
    { note: 3, at: 0, dur: 0.1 },
    { note: 7, at: 0.08, dur: 0.1 },
    { note: 10, at: 0.16, dur: 0.1 },
    { note: 15, at: 0.24, dur: 0.12 },
    { note: 19, at: 0.34, dur: 0.12 },
    { note: 22, at: 0.44, dur: 0.5 },
  ],
};

/** La médaille joue après la fanfare d'arrivée. */
export const MEDAL_DELAY = 0.55;

function spec(id: SoundId, priority: number, layers: Layer[]): SoundSpec {
  const duration = layers.reduce((m, l) => Math.max(m, (l.delay ?? 0) + l.dur), 0);
  return { id, priority, layers, duration };
}

/**
 * Le son d'un événement (null : pas de son ponctuel ; la glisse est une boucle, voir `slideLoop`). `variation` ∈ [0, 1) fait varier un peu
 * la hauteur (pas, sauts) : le jeu la tire d'un compteur, pas du hasard de la simulation.
 */
export function soundFor(e: GameEvent, variation = 0.5): SoundSpec | null {
  const v = variation - 0.5; // −0,5 … 0,5
  switch (e.kind) {
    case "pas": {
      // Discret : un petit « tap » filtré, plus sourd quand on marche lentement.
      const k = Math.min(1, e.speed / 11);
      return spec("pas", 0, [noise(1800 + 900 * v, 0.045, 0.05 + 0.04 * k, 0, 900, "bandpass", 2.2), tone("sine", 150 + 30 * v, 0.04, 0.035 * k)]);
    }
    case "saut":
      // Un « hop » qui monte.
      return spec("saut", 1, [tone("square", 300 * (1 + 0.04 * v), 0.13, 0.07, 0, 620), noise(2600, 0.05, 0.05, 0, 4200, "highpass", 0.7)]);
    case "sautMural":
      // Plus sec et plus brillant : un claquement contre le mur, puis un « hop » qui part plus haut.
      return spec("sautMural", 1, [noise(1200, 0.05, 0.11, 0, 500, "bandpass", 3), tone("triangle", 430 * (1 + 0.04 * v), 0.12, 0.09, 0.01, 900)]);
    case "atterrissage": {
      if (e.intensity < 0.06) return null;
      const g = 0.25 + 0.75 * e.intensity;
      return spec("atterrissage", 1, [noise(500 + 400 * e.intensity, 0.08 + 0.1 * e.intensity, 0.16 * g, 0, 140), tone("sine", 110, 0.1 + 0.08 * e.intensity, 0.2 * g, 0, 45)]);
    }
    case "mort": {
      // « Splat » coloré, pas gore : un bruit mouillé qui tombe, une note ronde qui glisse vers le bas, et la couleur de la cause.
      const base = [noise(900, 0.22, 0.32, 0, 160, "bandpass", 1.6), tone("sine", 520, 0.22, 0.2, 0, 90), tone("triangle", 260, 0.16, 0.08, 0.02, 120)];
      if (e.cause === "scie") base.push(tone("sawtooth", 1500, 0.12, 0.05, 0, 900));
      else if (e.cause === "chute") base.unshift(tone("sine", 900, 0.25, 0.07, 0, 300));
      else base.push(noise(4200, 0.05, 0.07, 0, 2500, "highpass", 0.8));
      return spec("mort", 3, base);
    }
    case "reapparition":
      // Petit « pop ».
      return spec("reapparition", 2, [tone("sine", 380, 0.07, 0.14, 0, 1100), noise(3000, 0.03, 0.04, 0.01, 5000, "highpass", 0.7)]);
    case "ressort":
      // « Boing » : une note qui monte puis vibre.
      return spec("ressort", 2, [tone("triangle", 160, 0.08, 0.18, 0, 520), tone("sine", 520, 0.28, 0.12, 0.07, 340), tone("sine", 780, 0.2, 0.05, 0.08, 560)]);
    case "friableCraque":
      // Craquement : deux grains secs.
      return spec("friableCraque", 1, [noise(2400, 0.04, 0.12, 0, 1500, "bandpass", 4), noise(1700, 0.05, 0.1, 0.05, 1100, "bandpass", 4)]);
    case "friableTombe":
      // La chute : un éboulis grave qui s'éloigne.
      return spec("friableTombe", 1, [noise(700, 0.3, 0.16, 0, 160, "bandpass", 1), tone("sine", 90, 0.22, 0.1, 0.02, 50)]);
    case "pointDePassage":
      // Tintement : deux notes claires.
      return spec("pointDePassage", 2, [tone("sine", noteFreq(15), 0.18, 0.12), tone("sine", noteFreq(22), 0.4, 0.1, 0.08), tone("triangle", noteFreq(27), 0.25, 0.03, 0.08)]);
    case "arrivee":
      // Courte fanfare : ta-ta-taa.
      return spec("arrivee", 3, [
        tone("square", noteFreq(3), 0.11, 0.08),
        tone("square", noteFreq(3), 0.11, 0.08, 0.13),
        tone("square", noteFreq(10), 0.32, 0.09, 0.26),
        tone("triangle", noteFreq(-2), 0.42, 0.1, 0.26),
      ]);
    case "medaille": {
      const phrase = MEDAL_PHRASES[e.medal];
      const wave: OscillatorType = e.medal === "author" ? "square" : e.medal === "gold" ? "triangle" : "sine";
      const layers = phrase.map((n) => tone(wave, noteFreq(n.note + 12), n.dur, e.medal === "author" ? 0.07 : 0.11, MEDAL_DELAY + n.at));
      if (e.medal === "gold" || e.medal === "author") layers.push(tone("sine", noteFreq(phrase[phrase.length - 1]!.note), 0.5, 0.06, MEDAL_DELAY + phrase[phrase.length - 1]!.at));
      return spec("medaille", 3, layers);
    }
    default:
      return null;
  }
}

/** La glisse murale : une boucle de bruit frotté, tant qu'elle dure (niveau et filtre). */
export const SLIDE_LOOP = { freq: 2400, q: 0.9, gain: 0.07, fade: 0.04 } as const;

// ——— Scies spatialisées ———

/** Portée de l'écoute d'une scie (tuiles) et nombre de scies audibles. */
export const SAW_RANGE = 8;
export const SAW_VOICES = 3;
/** Volume d'une scie collée au personnage. */
export const SAW_GAIN = 0.07;

export interface SawVoice {
  /** Indice de la scie dans le niveau. */
  index: number;
  gain: number;
  /** −1 gauche … 1 droite. */
  pan: number;
  distance: number;
}

/**
 * Les scies qu'on entend depuis `listener` (tuiles) : les `max` plus proches à moins de `range` tuiles. Volume = (1 − d / portée)²,
 * stéréo = écart horizontal ÷ portée (borné à ±1). Une scie plus loin que la portée ne s'entend pas.
 */
export function sawMix(saws: readonly { x: number; y: number }[], listener: { x: number; y: number }, max = SAW_VOICES, range = SAW_RANGE): SawVoice[] {
  const near: SawVoice[] = [];
  for (let i = 0; i < saws.length; i++) {
    const s = saws[i]!;
    const dx = s.x - listener.x;
    const dy = s.y - listener.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= range) continue;
    const k = 1 - d / range;
    near.push({ index: i, gain: SAW_GAIN * k * k, pan: Math.max(-1, Math.min(1, dx / range)), distance: d });
  }
  near.sort((a, b) => a.distance - b.distance || a.index - b.index);
  return near.slice(0, max);
}

// ——— Plafonds ———

/** Sons ponctuels joués en même temps, au plus. */
export const MAX_VOICES = 12;

/**
 * Plafond de polyphonie : on compte les sons en cours (leur fin) ; plein, un nouveau son est refusé sauf s'il est essentiel (priorité 3),
 * qui passe toujours (ils sont rares : mort, arrivée, médaille). `now` et les durées en secondes.
 */
export class VoiceLimiter {
  private ends: number[] = [];
  /** Sons refusés depuis le départ (mesure). */
  refused = 0;
  constructor(readonly max = MAX_VOICES) {}

  admit(now: number, duration: number, priority: number): boolean {
    this.ends = this.ends.filter((t) => t > now);
    if (this.ends.length >= this.max && priority < 3) {
      this.refused++;
      return false;
    }
    this.ends.push(now + duration);
    return true;
  }

  active(now: number): number {
    return this.ends.filter((t) => t > now).length;
  }
}

/** Carnage : au plus ce nombre de sons de mort (ou d'arrivée) d'autres vies par tranche de 100 ms, atténués. */
export const CARNAGE_SOUNDS_PER_100MS = 3;
export const CARNAGE_SOUND_WINDOW_TICKS = 12;
export const CARNAGE_SOUND_GAIN = 0.35;

/** Débit des sons du carnage, compté en pas (12 pas = 100 ms). */
export class SoundRate {
  private start = -Infinity;
  private count = 0;
  dropped = 0;
  constructor(
    readonly max = CARNAGE_SOUNDS_PER_100MS,
    readonly window = CARNAGE_SOUND_WINDOW_TICKS,
  ) {}
  admit(tick: number): boolean {
    if (tick >= this.start + this.window) {
      this.start = tick;
      this.count = 0;
    }
    if (this.count >= this.max) {
      this.dropped++;
      return false;
    }
    this.count++;
    return true;
  }
}

/** Gain d'un curseur (0 … 1) : au carré, pour qu'il suive l'oreille (la moitié du curseur sonne à peu près « à moitié »). */
export function sliderGain(v: number): number {
  const c = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  return c * c;
}

/** Ce que joue le son pour un événement, compte tenu de sa source : le carnage n'en garde que les morts et l'arrivée, atténuées. */
export function soundGainFor(e: GameEvent): number {
  return e.source === "vie" ? CARNAGE_SOUND_GAIN : 1;
}
