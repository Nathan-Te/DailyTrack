import type { NomMedaille, Taille } from "@cdj/tower-sim";
import type { EvenementJeu, GenreEvenement } from "./evenements";

// Les sons de Tower (lot T5), **logique pure et testée, sans Web Audio** — sur le modèle de `audioLogic.ts` de Jump : quel son pour quel événement (recettes procédurales : notes et bruits
// filtrés, zéro fichier), la famille de volume, le plafond de polyphonie, la règle des cris, la conversion des réglages en gains. `sons.ts` ne fait que jouer ce qu'on décide ici.

/** Une couche d'un son : une note (oscillateur) ou un bruit filtré, avec son enveloppe (attaque brève, décroissance exponentielle). */
export interface Couche {
  type: "note" | "bruit";
  onde?: OscillatorType;
  /** Fréquence de départ (Hz) : la note, ou le centre du filtre d'un bruit. */
  freq: number;
  /** Fréquence d'arrivée (glissando, ou balayage du filtre). */
  vers?: number;
  duree: number;
  /** Volume de crête, avant les volumes de famille et général. */
  gain: number;
  retard?: number;
  filtre?: BiquadFilterType;
  q?: number;
}

/** Les familles de volume du second groupe de `?debug&tune` (un curseur chacune). */
export const FAMILLES = ["clics", "contacts", "paliers", "chute", "effondrement", "vent", "fin", "cris"] as const;
export type Famille = (typeof FAMILLES)[number];
export type VolumesFamilles = Record<Famille, number>;
export const VOLUMES_DEFAUT: Readonly<VolumesFamilles> = { clics: 1, contacts: 1, paliers: 1, chute: 1, effondrement: 1, vent: 1, fin: 1, cris: 1 };

export interface Recette {
  famille: Famille;
  couches: Couche[];
  /** 0 discret (les clics) à 3 essentiel (la fin, la médaille) : un son essentiel passe toujours, même polyphonie pleine. */
  priorite: number;
  /** Durée totale (s), couches et retards compris. */
  duree: number;
}

export const FAMILLE_DE: Readonly<Record<GenreEvenement, Famille>> = {
  deplacement: "clics",
  rotation: "clics",
  contact: "contacts",
  palier: "paliers",
  effet: "paliers",
  perte: "chute",
  plouf: "chute",
  effondrement: "effondrement",
  ventDebut: "vent",
  ventFin: "vent",
  cri: "cris",
  fin: "fin",
  medaille: "fin",
};

/** Fréquence d'une note, en demi-tons depuis le la 440 Hz. */
export const noteFreq = (demiTons: number): number => 440 * 2 ** (demiTons / 12);

const note = (onde: OscillatorType, freq: number, duree: number, gain: number, retard = 0, vers?: number): Couche => ({ type: "note", onde, freq, duree, gain, retard, vers });
const bruit = (freq: number, duree: number, gain: number, retard = 0, vers?: number, filtre: BiquadFilterType = "bandpass", q = 1.2): Couche => ({ type: "bruit", freq, duree, gain, retard, vers, filtre, q });

function recette(famille: Famille, priorite: number, couches: Couche[]): Recette {
  return { famille, priorite, couches, duree: couches.reduce((m, c) => Math.max(m, (c.retard ?? 0) + c.duree), 0) };
}

/** La phrase de chaque médaille : la plus belle est la plus haute et la plus longue (demi-tons depuis le la). */
export const PHRASES_MEDAILLES: Record<NomMedaille, readonly { note: number; a: number; duree: number }[]> = {
  bronze: [{ note: 3, a: 0, duree: 0.14 }, { note: 7, a: 0.12, duree: 0.22 }],
  argent: [{ note: 3, a: 0, duree: 0.12 }, { note: 7, a: 0.1, duree: 0.12 }, { note: 10, a: 0.2, duree: 0.26 }],
  or: [{ note: 3, a: 0, duree: 0.1 }, { note: 7, a: 0.09, duree: 0.1 }, { note: 10, a: 0.18, duree: 0.1 }, { note: 15, a: 0.27, duree: 0.36 }],
  auteur: [{ note: 3, a: 0, duree: 0.1 }, { note: 7, a: 0.08, duree: 0.1 }, { note: 10, a: 0.16, duree: 0.1 }, { note: 15, a: 0.24, duree: 0.12 }, { note: 19, a: 0.34, duree: 0.12 }, { note: 22, a: 0.44, duree: 0.5 }],
};
/** La médaille joue après la fin de partie. */
export const RETARD_MEDAILLE = 0.55;

/** Le « plouf » suit le sifflement de la chute : la scène le lève quand la pièce touche l'eau. */
const HAUTEUR_TAILLE: Readonly<Record<Taille, number>> = { petite: 1.6, normale: 1, geante: 0.55 };
const borne = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/**
 * Le son d'un événement. `variation` ∈ [0, 1) fait varier un peu la hauteur : le jeu la tire du hasard d'AFFICHAGE, jamais de la simulation.
 * Le choc d'un contact : sa hauteur dépend de la TAILLE de la pièce (petite : aiguë, géante : grave) et son volume de la VITESSE au contact (m/s, 5 = plein).
 */
export function sonDe(e: EvenementJeu, variation = 0.5): Recette {
  const v = variation - 0.5;
  switch (e.genre) {
    case "deplacement":
      return recette("clics", 0, [note("square", 640 * (1 + 0.06 * v), 0.025, 0.035)]);
    case "rotation":
      return recette("clics", 0, [note("square", 760 * (1 + 0.06 * v), 0.05, 0.04, 0, 980 * (1 + 0.06 * v))]);
    case "contact": {
      const k = borne(e.vitesse / 5);
      const f = 150 * HAUTEUR_TAILLE[e.taille] * (1 + 0.1 * v);
      return recette("contacts", 1, [note("sine", f * 1.4, 0.1, 0.05 + 0.2 * k, 0, f * 0.7), bruit(1100 * HAUTEUR_TAILLE[e.taille], 0.07, 0.03 + 0.14 * k, 0, 320, "lowpass", 0.8)]);
    }
    case "palier":
      // Un bonus monte, un malus descend : quatre notes.
      return recette("paliers", 2, (e.bonus ? [0, 4, 7, 12] : [7, 3, 0, -5]).map((n, i) => note(e.bonus ? "triangle" : "sawtooth", noteFreq(n + (e.bonus ? 3 : -2)), e.bonus ? 0.1 : 0.12, e.bonus ? 0.09 : 0.06, i * (e.bonus ? 0.07 : 0.09))));
    case "effet":
      return recette("paliers", 2, e.bonus ? [note("sine", 880 * (1 + 0.03 * v), 0.14, 0.1, 0, 1320)] : [note("sawtooth", 220 * (1 + 0.03 * v), 0.26, 0.07, 0, 110), bruit(300, 0.22, 0.05, 0, 120, "lowpass")]);
    case "perte":
      // Le sifflement de la chute (un son qui descend), plus rageur pour une cascade.
      return recette("chute", 2, [note("sine", 1500 * (1 + 0.08 * v), 0.6, 0.07 + Math.min(2, e.cascade) * 0.015, 0, 320), bruit(2600, 0.5, 0.025, 0, 700, "highpass", 0.7)]);
    case "plouf": {
      const h = HAUTEUR_TAILLE[e.taille];
      return recette("chute", 2, [bruit(1300 * h, 0.28, 0.2, 0, 220, "lowpass", 0.9), note("sine", 280 * h * (1 + 0.1 * v), 0.2, 0.14, 0, 90 * h)]);
    }
    case "effondrement":
      return recette("effondrement", 3, [bruit(220, 0.75, 0.22 + 0.06 * (e.force - 1), 0, 70, "lowpass", 0.7), note("sawtooth", 58, 0.7, 0.12, 0, 34)]);
    case "ventDebut":
      // Le souffle est une boucle : son début est un petit coup de vent qui prend de l'élan (la boucle continue ensuite, `Sons.souffle`).
      return recette("vent", 1, [bruit(500, 0.5, 0.05, 0, 900, "bandpass", 0.7)]);
    case "ventFin":
      return recette("vent", 0, [bruit(800, 0.4, 0.03, 0, 300, "bandpass", 0.7)]);
    case "cri":
      // Un petit cri aigu, discret : deux notes qui montent puis retombent.
      return recette("cris", 0, [note("triangle", 900 * (1 + 0.15 * v), 0.08, 0.05, 0, 1400), note("triangle", 1500 * (1 + 0.15 * v), 0.12, 0.045, 0.07, 800)]);
    case "fin":
      return recette("fin", 3, (e.motif === "pieces" ? [0, 4, 7] : [7, 3, 0]).map((n, i) => note("triangle", noteFreq(n - 5), 0.16, 0.12, i * 0.14)));
    case "medaille": {
      const phrase = PHRASES_MEDAILLES[e.nom];
      return recette("fin", 3, phrase.map((p) => note("square", noteFreq(p.note), p.duree, 0.07, RETARD_MEDAILLE + p.a)));
    }
  }
}

// ---- plafonds et gains ----

/** Le plafond de sons joués en même temps : au-delà, un son moins prioritaire est laissé de côté. */
export const VOIX_MAX = 10;
/** Un son essentiel passe toujours ; un autre cède quand la polyphonie est pleine (les clics d'abord). */
export function accepter(priorite: number, enCours: number): boolean {
  if (priorite >= 3) return true;
  return enCours < VOIX_MAX - (3 - priorite) * 1;
}

/** Les cris : rares et bornés — une seule voix à la fois, et au plus un tous les `ATTENTE_CRIS_S` secondes. */
export const ATTENTE_CRIS_S = 3;
export class FiltreCris {
  private finDuDernier = -Infinity;
  private dernier = -Infinity;
  /** `t` : l'heure du contexte audio (s) ; `duree` : celle du cri. Rend vrai si ce cri peut sonner (et le compte). */
  accepter(t: number, duree: number): boolean {
    if (t < this.finDuDernier || t - this.dernier < ATTENTE_CRIS_S) return false;
    this.dernier = t;
    this.finDuDernier = t + duree;
    return true;
  }
}

/** Du curseur de volume (0 à 1) au gain : quadratique, comme le son des autres jeux (le bas du curseur est fin). */
export const gainDuCurseur = (v: number): number => borne(v) ** 2;

/** Le gain d'un événement : le volume général (coupé si « Sons : non »), celui de sa famille, et le curseur des cris. */
export function gainDe(e: EvenementJeu, general: { actifs: boolean; volume: number }, familles: Readonly<VolumesFamilles>): number {
  if (!general.actifs) return 0;
  return gainDuCurseur(general.volume) * Math.max(0, familles[FAMILLE_DE[e.genre]]);
}
