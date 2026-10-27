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
  | "champignon"
  | "stalactiteTremble"
  | "stalactiteCasse"
  | "pontAllume"
  | "friableCraque"
  | "friableTombe"
  | "pointDePassage"
  | "arrivee"
  | "medaille"
  | "derapage"
  | "tapisDebut"
  | "glaceDebut"
  | "glaceFrein"
  | "bascule"
  | "metronome"
  | "ventDebut"
  | "rafale";

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

/** Volume de crête du tic du métronome de la nuit (lot 12) : sous le quart du saut (0,07 + 0,05) : un tempo, jamais un bruit de jeu. */
export const METRONOME_GAIN = 0.03;

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
      else if (e.cause === "presse") base.unshift(tone("sine", 70, 0.2, 0.2, 0, 40));
      // Lot 24 : une stalactite : le même « splat », avec un éclat clair de glace par-dessus.
      else if (e.cause === "stalactite") base.push(noise(3600, 0.12, 0.09, 0, 2200, "bandpass", 2), tone("sine", 3100, 0.1, 0.04, 0.01, 2400));
      // Lot 25 : un rayon laser : le même « splat », avec un court bourdonnement qui retombe et une étincelle (le seul son des lasers : pas de son continu).
      else if (e.cause === "laser") base.push(tone("sawtooth", 140, 0.16, 0.06, 0, 70), noise(5200, 0.07, 0.07, 0.01, 3000, "highpass", 1.2));
      else base.push(noise(4200, 0.05, 0.07, 0, 2500, "highpass", 0.8));
      return spec("mort", 3, base);
    }
    case "reapparition":
      // Petit « pop ».
      return spec("reapparition", 2, [tone("sine", 380, 0.07, 0.14, 0, 1100), noise(3000, 0.03, 0.04, 0.01, 5000, "highpass", 0.7)]);
    case "ressort":
      // « Boing » : une note qui monte puis vibre.
      return spec("ressort", 2, [tone("triangle", 160, 0.08, 0.18, 0, 520), tone("sine", 520, 0.28, 0.12, 0.07, 340), tone("sine", 780, 0.2, 0.05, 0.08, 560)]);
    case "champignon":
      // Lot 23 : un « boup » rond et mou (pas le « boing » métallique du ressort) ; plus haut et plus long quand le rebond est renforcé.
      return spec("champignon", 2, e.boost ? [tone("sine", 190, 0.1, 0.17, 0, 520), tone("sine", 620, 0.22, 0.1, 0.05, 460), tone("triangle", 930, 0.16, 0.04, 0.06, 700)] : [tone("sine", 170, 0.09, 0.15, 0, 400), tone("sine", 470, 0.17, 0.09, 0.05, 360)]);
    case "stalactiteTremble":
      // Lot 24 : un craquement très fin, aigu, de la glace qui se fissure (à peine audible : le tremblement s'annonce surtout à l'œil).
      return spec("stalactiteTremble", 1, [noise(5200, 0.16, 0.05, 0, 3600, "highpass", 2), tone("sine", 2300, 0.14, 0.03, 0.02, 2100)]);
    case "stalactiteCasse":
      // Lot 24 : la glace qui éclate : un souffle clair, deux tintements qui descendent, un éclat plus sourd.
      return spec("stalactiteCasse", 2, [noise(4200, 0.18, 0.14, 0, 2600, "bandpass", 2), tone("triangle", 2600, 0.1, 0.06, 0, 1900), tone("sine", 3500, 0.12, 0.04, 0.03, 2800), noise(2000, 0.12, 0.08, 0.06, 1200, "bandpass", 3)]);
    case "pontAllume":
      // Lot 26 : un « clic » net suivi d'un petit arpège clair et montant (la lumière qui court le long du pont) ; discret, aucun son continu.
      return spec("pontAllume", 2, [tone("square", 520, 0.03, 0.05, 0, 400), tone("sine", 880, 0.16, 0.07, 0.02, 1180), tone("sine", 1320, 0.2, 0.05, 0.07, 1760), tone("triangle", 1980, 0.18, 0.025, 0.12, 2400)]);
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
    case "derapage": {
      // Lot 8b : un frottement court, un peu plus fort et plus long quand on dérape vite. Lot 11 : sur la glace, le crissement de la glace.
      const k = Math.min(1, e.speed / 15);
      if (e.ice) return spec("derapage", 1, iceScreech(k, v, 1.3));
      return spec("derapage", 1, [noise(3200 + 600 * v, 0.1 + 0.06 * k, 0.06 + 0.04 * k, 0, 1300, "bandpass", 1.6), noise(900, 0.06, 0.03 * k, 0.02, 500, "bandpass", 1)]);
    }
    case "tapisDebut":
      // Lot 11 : un « clac » mécanique, sourd, quand on se pose sur un tapis (le ronronnement continu est spatialisé : `beltMix`).
      return spec("tapisDebut", 0, [noise(800 + 300 * v, 0.045, 0.06, 0, 420, "bandpass", 2), tone("square", 110, 0.06, 0.035, 0, 70)]);
    case "glaceDebut":
      // Lot 11 : un souffle clair, à peine : le contact de la glace.
      return spec("glaceDebut", 0, [noise(5200 + 600 * v, 0.07, 0.04, 0, 3400, "highpass", 0.7)]);
    case "glaceFrein":
      // Lot 11 : crissement de glisse sur la glace, sobre, plus aigu et un peu plus long quand on va vite.
      return spec("glaceFrein", 1, iceScreech(Math.min(1, e.speed / 15), v, 1));
    case "bascule":
      // Lot 12 : le « clic » du néon, sec, un peu plus aigu quand B devient solide (la parité s'entend) ; la remise à A par un point de passage
      // y ajoute une petite note claire (le fanion).
      return spec("bascule", 1, [
        noise(3400 + 500 * v, 0.022, 0.085, 0, 1900, "bandpass", 3),
        tone("square", (e.alt === 1 ? 1500 : 1180) * (1 + 0.03 * v), 0.03, 0.045, 0, e.alt === 1 ? 1900 : 1500),
        ...(e.reset ? [tone("sine", noteFreq(22), 0.22, 0.05, 0.03)] : []),
      ]);
    case "metronome":
      // Lot 12 : le tempo de la nuit : un tic très discret (un peu plus haut et plus fort sur les deux bascules du cycle).
      return spec("metronome", 0, [tone("sine", e.accent ? 880 : 660, e.accent ? 0.05 : 0.04, e.accent ? METRONOME_GAIN : METRONOME_GAIN * 0.55)]);
    case "ventDebut":
      // Lot 13 : un souffle doux qui se lève quand le vent prend le personnage (le souffle continu est spatialisé : `windMix`, wind.ts).
      return spec("ventDebut", 0, [noise(700 + 200 * v, 0.32, 0.035, 0, e.dir === "haut" ? 1500 : 1100, "bandpass", 0.8)]);
    case "rafale":
      // Lot 13 : la rafale qui part : un coup de vent plus franc, qui monte puis retombe.
      return spec("rafale", 1, [noise(500 + 150 * v, 0.5, 0.06, 0, 1600, "bandpass", 0.9), noise(2400, 0.3, 0.018, 0.08, 1200, "highpass", 0.6)]);
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

/** Lot 11 : le crissement d'un freinage sur la glace (un bruit étroit qui descend, un fil aigu) ; `k` ∈ [0, 1] : vitesse ; `v` : variation ; `weight` : force. */
function iceScreech(k: number, v: number, weight: number): Layer[] {
  return [
    noise(4300 + 700 * v + 500 * k, 0.09 + 0.07 * k, (0.045 + 0.035 * k) * weight, 0, 2500, "bandpass", 5),
    tone("sine", 2400 + 300 * v, 0.08 + 0.05 * k, (0.008 + 0.01 * k) * weight, 0, 1700),
  ];
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

// ——— Tapis roulants spatialisés (lot 11) ———

/** Portée de l'écoute d'un tapis (tuiles) et nombre de tapis audibles (comme les scies : trois voix). */
export const BELT_RANGE = 9;
export const BELT_VOICES = 3;
/** Volume d'un tapis collé au personnage : un ronronnement discret, sous la scie (0,07) et très sous les sons de jeu. */
export const BELT_GAIN = 0.035;
/** Écart horizontal (tuiles) qui donne la stéréo pleine : au-dessus du tapis, le son est au centre. */
export const BELT_PAN_SPAN = 7;
/** Longueur (tuiles) d'une plage au-delà de laquelle elle ne ronronne plus plus fort. */
export const BELT_LONG = 8;

export interface BeltVoice {
  /** Indice de la plage dans la liste donnée à `beltMix` (la voix garde sa plage tant qu'elle reste audible). */
  index: number;
  gain: number;
  /** −1 gauche … 1 droite. */
  pan: number;
  distance: number;
}

/**
 * Les tapis qu'on entend depuis `listener` (tuiles, y vers le bas) : chaque plage est `{ row, col0, col1 }` (colonnes incluses, la face du
 * dessus à `row`). Distance = au point le plus proche de la plage (une plage longue s'entend de partout où elle passe) ; volume =
 * (1 − d / portée)² × (0,6 + 0,4 × longueur ÷ `BELT_LONG`), stéréo = écart horizontal jusqu'à ce point ÷ `BELT_PAN_SPAN` (0 au-dessus du
 * tapis). Les `max` plus proches à moins de `range` tuiles ; au-delà, le tapis se tait. **Pur** : ni silence de pause ni plafond de pool ici
 * (`JumpAudio.update` ne reçoit rien en pause, `setActive`).
 */
export function beltMix(runs: readonly { row: number; col0: number; col1: number }[], listener: { x: number; y: number }, max = BELT_VOICES, range = BELT_RANGE): BeltVoice[] {
  const near: BeltVoice[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]!;
    const nx = Math.min(Math.max(listener.x, r.col0), r.col1 + 1);
    const dx = nx - listener.x;
    const dy = r.row - listener.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= range) continue;
    const k = 1 - d / range;
    const len = 0.6 + 0.4 * Math.min(1, (r.col1 - r.col0 + 1) / BELT_LONG);
    near.push({ index: i, gain: BELT_GAIN * k * k * len, pan: Math.max(-1, Math.min(1, dx / BELT_PAN_SPAN)), distance: d });
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

// ——— Lot 9 : ambiances sonores par thème (bus « ambiance ») ———
// Une boucle procédurale discrète par thème : des **nappes** continues (bruit filtré ou notes tenues, lentement modulées) et des
// **événements** espacés (un oiseau, un train de grillons, un coup de machine). Tout reste **sous les sons de jeu** : le niveau de crête de
// l'ambiance ne dépasse pas `AMBIENCE_HEADROOM` × la crête du plus discret des sons qui comptent (le saut ; test). Le bus suit le curseur
// « ambiance » du menu et se tait quand l'onglet est caché (`ambienceTarget`). Les instants des événements sont tirés d'une graine : la
// même ambiance s'entend de la même façon, et ce hasard-là n'est jamais celui de la simulation.

/** Une nappe continue : bruit filtré ou note tenue, dont le volume ondule (`lfoRate` Hz, `lfoDepth` = part du volume). */
export interface AmbientBed {
  type: "noise" | "tone";
  /** Note : forme d'onde et fréquence ; bruit : centre du filtre. */
  wave?: OscillatorType;
  freq: number;
  /** Bruit, ou note filtrée : type de filtre, résonance ; balayage du filtre (Hz) au rythme de l'ondulation. */
  filter?: BiquadFilterType;
  filterFreq?: number;
  q?: number;
  sweep?: number;
  /** Seconde note désaccordée (cents), pour une nappe plus large. */
  detune?: number;
  gain: number;
  lfoRate: number;
  lfoDepth: number;
}

/** Un événement espacé : ses couches (comme un son de jeu), joué toutes les `every[0]` à `every[1]` secondes. */
export interface AmbientEvent {
  id: string;
  every: readonly [number, number];
  layers: readonly Layer[];
}

export interface AmbienceSpec {
  id: string;
  label: string;
  beds: readonly AmbientBed[];
  events: readonly AmbientEvent[];
}

/** L'ambiance ne dépasse jamais cette part de la crête du saut (le plus discret des sons qui comptent, hors pas). */
export const AMBIENCE_HEADROOM = 0.6;

const chirp = (f: number, delay: number, g: number): Layer => ({ type: "tone", wave: "sine", freq: f, to: f * 1.25, dur: 0.07, gain: g, delay });

export const AMBIENCES: Record<"foret" | "usine" | "glace" | "nuit" | "neon", AmbienceSpec> = {
  foret: {
    id: "foret",
    label: "vent et oiseaux",
    beds: [{ type: "noise", freq: 520, filter: "lowpass", q: 0.6, sweep: 180, gain: 0.016, lfoRate: 0.07, lfoDepth: 0.55 }],
    events: [
      { id: "oiseau", every: [4, 9], layers: [chirp(2700, 0, 0.012), chirp(3100, 0.11, 0.01), chirp(2900, 0.24, 0.008)] },
      { id: "oiseau-loin", every: [7, 14], layers: [chirp(3600, 0, 0.006), chirp(3400, 0.15, 0.005)] },
    ],
  },
  usine: {
    id: "usine",
    label: "machines lointaines",
    beds: [
      { type: "tone", wave: "sawtooth", freq: 55, filter: "lowpass", filterFreq: 170, q: 0.8, detune: 9, gain: 0.012, lfoRate: 0.35, lfoDepth: 0.25 },
      { type: "noise", freq: 900, filter: "bandpass", q: 0.7, sweep: 120, gain: 0.006, lfoRate: 0.11, lfoDepth: 0.4 },
    ],
    events: [
      {
        id: "machine",
        every: [1.6, 3.2],
        layers: [
          { type: "noise", freq: 160, to: 90, dur: 0.22, gain: 0.014, filter: "lowpass", q: 1 },
          { type: "noise", freq: 150, to: 90, dur: 0.2, gain: 0.01, filter: "lowpass", q: 1, delay: 0.42 },
        ],
      },
      { id: "vapeur", every: [9, 16], layers: [{ type: "noise", freq: 3200, to: 2200, dur: 0.6, gain: 0.006, filter: "highpass", q: 0.7 }] },
    ],
  },
  glace: {
    id: "glace",
    label: "vent froid",
    beds: [
      { type: "noise", freq: 1200, filter: "bandpass", q: 1.1, sweep: 500, gain: 0.014, lfoRate: 0.09, lfoDepth: 0.6 },
      { type: "noise", freq: 300, filter: "lowpass", q: 0.5, sweep: 60, gain: 0.008, lfoRate: 0.05, lfoDepth: 0.4 },
    ],
    events: [{ id: "sifflement", every: [6, 12], layers: [{ type: "tone", wave: "sine", freq: 1400, to: 1100, dur: 1.2, gain: 0.004 }] }],
  },
  nuit: {
    id: "nuit",
    label: "grillons",
    beds: [{ type: "noise", freq: 400, filter: "lowpass", q: 0.5, sweep: 80, gain: 0.006, lfoRate: 0.06, lfoDepth: 0.4 }],
    events: [
      {
        id: "grillon",
        every: [0.9, 2.4],
        layers: [0, 0.07, 0.14, 0.21].map((d) => ({ type: "tone" as const, wave: "sine" as OscillatorType, freq: 4400, dur: 0.035, gain: 0.008, delay: d })),
      },
      {
        id: "grillon-loin",
        every: [1.7, 3.8],
        layers: [0, 0.08, 0.16].map((d) => ({ type: "tone" as const, wave: "sine" as OscillatorType, freq: 3900, dur: 0.03, gain: 0.004, delay: d })),
      },
    ],
  },
  neon: {
    id: "neon",
    label: "nappe synthétique",
    beds: [
      { type: "tone", wave: "sawtooth", freq: noteFreq(-17), filter: "lowpass", filterFreq: 700, q: 1.4, sweep: 350, detune: 12, gain: 0.008, lfoRate: 0.08, lfoDepth: 0.3 },
      { type: "tone", wave: "sawtooth", freq: noteFreq(-10), filter: "lowpass", filterFreq: 600, q: 1.2, sweep: 300, detune: -10, gain: 0.006, lfoRate: 0.06, lfoDepth: 0.35 },
    ],
    events: [{ id: "scintillement", every: [5, 10], layers: [{ type: "tone", wave: "triangle", freq: noteFreq(15), dur: 0.5, gain: 0.004 }, { type: "tone", wave: "triangle", freq: noteFreq(22), dur: 0.6, gain: 0.003, delay: 0.18 }] }],
  },
};

export function ambienceFor(theme: keyof typeof AMBIENCES): AmbienceSpec {
  return AMBIENCES[theme];
}

/** Crête d'un son : la plus forte des couches qui sonnent en même temps (au pire, toutes se superposent). */
export function layersPeak(layers: readonly Layer[]): number {
  let peak = 0;
  for (const a of layers) {
    let sum = 0;
    for (const b of layers) {
      const a0 = a.delay ?? 0;
      const b0 = b.delay ?? 0;
      if (b0 < a0 + a.dur && a0 < b0 + b.dur) sum += b.gain;
    }
    peak = Math.max(peak, sum);
  }
  return peak;
}

/** Crête de l'ambiance : toutes les nappes au sommet de leur ondulation, plus deux événements qui se superposent au pire. */
export function ambiencePeak(spec: AmbienceSpec): number {
  const beds = spec.beds.reduce((s, b) => s + b.gain * (1 + b.lfoDepth) * (b.detune ? 2 : 1), 0);
  const events = spec.events.map((e) => layersPeak(e.layers)).sort((a, b) => b - a);
  return beds + (events[0] ?? 0) + (events[1] ?? 0);
}

/** Crête du son de jeu le plus discret qui compte (le saut) : l'ambiance reste dessous. */
export function quietestGameSoundPeak(): number {
  const s = soundFor({ kind: "saut", x: 0, y: 0, tick: 0, source: "jeu" })!;
  return layersPeak(s.layers);
}

/** Volume visé du bus d'ambiance : le curseur (au carré), zéro quand l'onglet est caché. */
export function ambienceTarget(ambience: number, hidden: boolean): number {
  return hidden ? 0 : sliderGain(ambience);
}

/**
 * Calendrier des événements d'une ambiance, **pur** : tirages d'une graine (générateur congruentiel maison, jamais `Math.random`).
 * `due(t)` rend les événements à jouer jusqu'à l'instant `t` (secondes du contexte audio) et prépare les suivants.
 */
export class AmbientScheduler {
  private readonly next: number[];
  private state: number;
  constructor(
    readonly spec: AmbienceSpec,
    seed: number,
    start = 0,
  ) {
    this.state = seed >>> 0 || 1;
    // Le premier de chaque événement arrive entre son minimum et son maximum (jamais tout de suite à l'ouverture).
    this.next = spec.events.map((e) => start + this.between(e.every));
  }

  private rand(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  private between(range: readonly [number, number]): number {
    return range[0] + (range[1] - range[0]) * this.rand();
  }

  /** Événements dus jusqu'à `t` : leur indice et l'instant prévu. Après une longue absence (onglet caché), on ne rattrape pas : un seul chacun. */
  due(t: number): { index: number; at: number }[] {
    const out: { index: number; at: number }[] = [];
    this.spec.events.forEach((e, i) => {
      if (this.next[i]! > t) return;
      out.push({ index: i, at: this.next[i]! });
      this.next[i] = Math.max(this.next[i]!, t) + this.between(e.every);
    });
    return out;
  }
}
