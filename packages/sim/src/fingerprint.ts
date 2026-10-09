import type { PilotRun } from "./autopilot";
import { choiceMoments } from "./choices";
import { trackJumps } from "./jump";
import { HALF_PI } from "./math";
import { CELL, curveCenter, isCurve, type Block, type BlockSurface, type Track } from "./track";

// Empreinte d'un circuit (lot 25) : ce qui fait qu'un thème « se joue autrement », en nombres. Elle se calcule sur le tracé et sur la course
// du pilote d'auteur ; le script de mesure (`npm run measure:generator`) en fait la moyenne par thème et une table de distance entre thèmes,
// et les tests vérifient les écarts promis (Rallye ≠ Canyon, Col alpin ≠ Banquise). Lecture seule : rien ici ne change un circuit.

export interface Fingerprint {
  /** Longueur de l'axe de la route (m). */
  length: number;
  /** Dénivelé net : hauteur de l'arrivée − hauteur du départ (m). */
  net: number;
  /** Amplitude du relief : point le plus haut − point le plus bas de la route (m). */
  relief: number;
  /** Part de la longueur en descente (blocs `D`, `D2`, `D3` et virages en pente `L2/d`…). */
  descent: number;
  /** Plus haute montée d'une suite de blocs qui montent sans interruption (m). */
  climb: number;
  /** Largeur moyenne de la route (m, pondérée par la longueur). */
  width: number;
  /** Part de la longueur à la largeur la plus présente du circuit, et cette largeur (m). */
  mainWidthShare: number;
  mainWidth: number;
  /** Virages (blocs de virage) par 100 m. */
  turns: number;
  /** Plus longue suite de blocs sans virage (blocs). */
  straight: number;
  /** Vitesse moyenne du pilote d'auteur (longueur de l'axe ÷ temps, m/s) et sa pointe (m/s). */
  meanSpeed: number;
  peakSpeed: number;
  /** Part du temps passée en l'air (pilote d'auteur). */
  air: number;
  /** Sauts au-dessus du vide, et vide le plus long (cellules). */
  jumps: number;
  longestGap: number;
  /** Part de la longueur sur chaque revêtement de bloc. */
  surfaces: Record<BlockSurface, number>;
  /** Moments de choix (lot 21) : freinages, roue libre et total. */
  brakes: number;
  coasts: number;
  choices: number;
}

/** Longueur de l'axe d'un bloc (m) : 32 m pour un bloc droit, l'arc d'un quart de cercle pour un virage. */
export function blockLength(b: Pick<Block, "kind">): number {
  return isCurve(b.kind) ? HALF_PI * curveCenter(b.kind).r : CELL;
}

/** Empreinte du tracé seul (sans pilote) : ce que le générateur peut vérifier avant de faire rouler le pilote. */
export type ShapeFingerprint = Pick<Fingerprint, "length" | "net" | "relief" | "descent" | "climb" | "width" | "mainWidthShare" | "mainWidth" | "turns" | "straight" | "jumps" | "longestGap" | "surfaces">;

export function shapeFingerprint(track: Track): ShapeFingerprint {
  let length = 0;
  let descent = 0;
  let widthSum = 0;
  let turns = 0;
  let straight = 0;
  let run = 0;
  let climb = 0;
  let rising = 0;
  let hi = 0;
  let lo = 0;
  const byWidth = new Map<number, number>();
  const surfaces: Record<BlockSurface, number> = { road: 0, dirt: 0, ice: 0, grass: 0, sand: 0 };
  const first = track.blocks[0]!;
  for (const b of track.blocks) {
    const len = blockLength(b);
    length += len;
    const w = (b.w0 + b.w1) / 2;
    widthSum += w * len;
    byWidth.set(w, (byWidth.get(w) ?? 0) + len);
    surfaces[b.surface] += len;
    if (b.kind === "down" || (isCurve(b.kind) && b.rise < 0)) descent += len;
    if (isCurve(b.kind)) {
      turns++;
      run = 0;
    } else straight = Math.max(straight, ++run);
    if (b.rise > 0 && b.kind !== "gap") climb = Math.max(climb, (rising += b.rise));
    else rising = 0;
    hi = Math.max(hi, b.y0, b.y0 + b.rise);
    lo = Math.min(lo, b.y0, b.y0 + b.rise);
  }
  let mainWidth = 0;
  let mainLen = -1;
  for (const [w, len] of byWidth) {
    if (len > mainLen) {
      mainLen = len;
      mainWidth = w;
    }
  }
  for (const k of Object.keys(surfaces) as BlockSurface[]) surfaces[k] /= length;
  const last = track.blocks[track.blocks.length - 1]!;
  const jumps = trackJumps(track);
  return {
    length,
    net: last.y0 + last.rise - first.y0,
    relief: hi - lo,
    descent: descent / length,
    climb,
    width: widthSum / length,
    mainWidthShare: mainLen / length,
    mainWidth,
    turns: (100 * turns) / length,
    straight,
    jumps: jumps.length,
    longestGap: jumps.reduce((m, j) => Math.max(m, j.gapCells), 0),
    surfaces,
  };
}

/** Empreinte complète : le tracé et la course du pilote d'auteur. */
export function circuitFingerprint(track: Track, run: PilotRun): Fingerprint {
  const shape = shapeFingerprint(track);
  const seconds = run.ticks / 120;
  const choices = choiceMoments(track, run);
  return {
    ...shape,
    meanSpeed: shape.length / seconds,
    peakSpeed: run.maxSpeed,
    air: run.airTicks / run.ticks,
    brakes: choices.brakes,
    coasts: choices.coasts,
    choices: choices.total,
  };
}

/**
 * Axes de la table de distance entre thèmes, avec leur échelle : l'écart qui compte comme « net » sur cet axe. Les échelles sont fixes (et non
 * l'écart-type des mesures) : une distance mesurée avant le lot 25 se compare à une distance mesurée après.
 */
export const FINGERPRINT_AXES: readonly { key: string; label: string; scale: number; get: (f: Fingerprint) => number }[] = [
  { key: "net", label: "dénivelé net (m)", scale: 20, get: (f) => f.net },
  { key: "relief", label: "amplitude (m)", scale: 10, get: (f) => f.relief },
  { key: "descent", label: "part en descente", scale: 0.15, get: (f) => f.descent },
  { key: "width", label: "largeur moyenne (m)", scale: 4, get: (f) => f.width },
  { key: "turns", label: "virages / 100 m", scale: 0.15, get: (f) => f.turns },
  { key: "straight", label: "plus longue droite (blocs)", scale: 2, get: (f) => f.straight },
  { key: "meanSpeed", label: "vitesse moyenne (m/s)", scale: 4, get: (f) => f.meanSpeed },
  { key: "peakSpeed", label: "pointe (m/s)", scale: 8, get: (f) => f.peakSpeed },
  { key: "air", label: "temps en l'air", scale: 0.03, get: (f) => f.air },
  { key: "jumps", label: "sauts au-dessus du vide", scale: 1, get: (f) => f.jumps },
  { key: "ice", label: "part de glace", scale: 0.15, get: (f) => f.surfaces.ice },
  { key: "dirt", label: "part de terre", scale: 0.15, get: (f) => f.surfaces.dirt },
  { key: "sand", label: "part de sable", scale: 0.15, get: (f) => f.surfaces.sand },
  { key: "grass", label: "part d'herbe", scale: 0.15, get: (f) => f.surfaces.grass },
  { key: "coasts", label: "passages en roue libre", scale: 3, get: (f) => f.coasts },
  { key: "brakes", label: "freinages", scale: 2, get: (f) => f.brakes },
];

/** Moyenne de chaque axe sur une liste d'empreintes (l'empreinte d'un thème). */
export function meanFingerprint(list: readonly Fingerprint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of FINGERPRINT_AXES) out[a.key] = list.reduce((s, f) => s + a.get(f), 0) / Math.max(1, list.length);
  return out;
}

/** Distance entre deux empreintes moyennes : racine de la moyenne des carrés des écarts, chacun divisé par l'échelle de son axe. */
export function fingerprintDistance(a: Record<string, number>, b: Record<string, number>): number {
  let sum = 0;
  for (const ax of FINGERPRINT_AXES) {
    const d = (a[ax.key]! - b[ax.key]!) / ax.scale;
    sum += d * d;
  }
  return Math.sqrt(sum / FINGERPRINT_AXES.length);
}

/** Axes sur lesquels deux empreintes moyennes diffèrent « nettement » (d'au moins une échelle). */
export function clearAxes(a: Record<string, number>, b: Record<string, number>, keys: readonly string[]): string[] {
  return keys.filter((k) => {
    const ax = FINGERPRINT_AXES.find((x) => x.key === k)!;
    return Math.abs(a[k]! - b[k]!) >= ax.scale;
  });
}
