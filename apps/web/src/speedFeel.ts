import { DEFAULT_CAR_PARAMS, type Block, type Track } from "@cdj/sim";

// Sensation de vitesse (lot 15) : logique pure (testée), sans effet sur `sim`. Au-delà de la pointe du plat (48 m/s),
// la caméra s'ouvre, descend et traîne un peu, une petite vibration apparaît, les lignes de vitesse et le vent
// s'intensifient et le compteur change de couleur. Tout est une fonction de la vitesse lue sur la voiture.

const FLAT_TOP = DEFAULT_CAR_PARAMS.maxSpeed;
/** Vitesse à laquelle « au-delà de la pointe » vaut 1 : la poussée maximale d'un super turbo. */
const FULL = DEFAULT_CAR_PARAMS.turboMaxSpeed;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** 0 jusqu'à la pointe du plat, 1 à la vitesse du super turbo : de combien on est « au-delà ». */
export function overSpeed(speed: number): number {
  return clamp01((speed - FLAT_TOP) / (FULL - FLAT_TOP));
}

/** 0 à l'arrêt, 1 à la pointe du plat (la part « normale » de la sensation de vitesse). */
export function flatRatio(speed: number): number {
  return clamp01(speed / FLAT_TOP);
}

export interface SpeedCamera {
  /** Degrés de champ de vision en plus. */
  fov: number;
  /** Mètres de hauteur en moins. */
  lower: number;
  /** Mètres de recul en plus. */
  back: number;
  /** Rapidité de suivi retranchée (1/s) : la caméra traîne un peu plus. */
  lag: number;
}

/** Réglages de caméra à haute vitesse (aucun avant la pointe). */
export function speedCamera(speed: number): SpeedCamera {
  const o = overSpeed(speed);
  return { fov: 10 * o, lower: 0.35 * o, back: 1.6 * o, lag: 4 * o };
}

/** Amplitude (m) de la petite vibration de la caméra : rien jusqu'à mi-chemin entre la pointe et le turbo, 5 cm au maximum. */
export function buzzAmplitude(speed: number): number {
  const o = overSpeed(speed);
  return o > 0.45 ? ((o - 0.45) / 0.55) * 0.05 : 0;
}

/** Opacité des lignes de vitesse (0–0,6) : montent à partir de 75 % de la pointe, plus fortes au-delà. */
export function speedLinesOpacity(speed: number, turbo: boolean): number {
  const r = speed / FLAT_TOP;
  return clamp01((r - 0.75) / 0.35) * 0.34 + overSpeed(speed) * 0.22 + (turbo ? 0.04 : 0);
}

/** Niveau du compteur : 0 normal, 1 à la pointe passée (jaune), 2 nettement au-delà (orange), 3 vitesse de turbo (rouge). */
export function speedLevel(speed: number): 0 | 1 | 2 | 3 {
  if (speed <= FLAT_TOP + 0.5) return 0;
  const o = overSpeed(speed);
  return o < 0.3 ? 1 : o < 0.75 ? 2 : 3;
}

/** Débit supplémentaire de la qualité : à qualité basse, on garde les poteaux mais plus la vibration (voir main.ts). */
export function buzzAllowed(quality: number): boolean {
  return quality >= 1;
}

// --- Portions rapides du circuit (poteaux plus serrés, arches, chevrons au sol) ------------------

/**
 * Blocs d'une portion rapide : un super turbo et ses six blocs suivants, une plaque suivie d'une descente (jusqu'à deux blocs
 * après la dernière pente), toute descente d'au moins trois blocs, une plaque seule et les deux blocs suivants.
 * Même résultat que la lecture du texte du circuit : le décor ne dépend que des blocs.
 */
export function fastZones(track: Pick<Track, "blocks">): boolean[] {
  const blocks: readonly Block[] = track.blocks;
  const zone = new Array<boolean>(blocks.length).fill(false);
  const mark = (from: number, to: number) => {
    for (let i = Math.max(0, from); i <= Math.min(blocks.length - 1, to); i++) zone[i] = true;
  };
  for (let i = 0; i < blocks.length; i++) {
    const kind = blocks[i]!.kind;
    if (kind === "turbo") mark(i, i + 6);
    else if (kind === "boost") {
      let j = i + 1;
      while (blocks[j]?.kind === "down") j++;
      mark(i, j > i + 1 ? j + 1 : i + 2);
    } else if (kind === "down") {
      let j = i;
      while (blocks[j]?.kind === "down") j++;
      if (j - i >= 3) mark(i, j + 1);
      i = j - 1;
    }
  }
  return zone;
}

/** Fractions du bloc où se dressent les poteaux de chaque côté : tous les 16 m, tous les 8 m dans une portion rapide. */
export function postFractions(fast: boolean): readonly number[] {
  return fast ? [0.125, 0.375, 0.625, 0.875] : [0.25, 0.75];
}
