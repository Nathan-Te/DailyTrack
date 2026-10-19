import { UNITS_PER_TILE, isSpikeTile, type Level } from "@cdj/jump-sim";
import { stainFor, type StainDisc } from "./stains";

// Les taches de tout le monde (lot P3 de la plateforme), **placement seulement** (pur, testé ; le dessin est le `StainLayer` du lot 3, une
// seconde couche instanciée) : la carte des morts du jour du serveur (`GET /api/jump/day/<date>/deaths`, comptes agrégés par tuile) devient
// des taches **plus pâles et plus petites** que les tiennes, posées comme elles sur la face de bloc plein la plus proche (`stainFor`).
//   - **Intensité** : elle suit le nombre de morts de la tuile, avec un plafond (`OTHERS_COUNT_CAP` morts = l'intensité la plus forte, qui
//     reste pâle : `OTHERS_STRENGTH_MAX`) ; les tuiles les plus meurtrières d'abord, `OTHERS_MAX_TILES` au plus.
//   - **Lisibilité (règles du lot 9)** : une tache des autres ne masque jamais un danger ni un fanion : tout disque à moins de
//     `OTHERS_KEEPOUT` tuile d'un pic, du trajet d'une scie (rayon compris), d'un point de passage, du départ ou de l'arrivée est retiré.
//   - Les tiennes ne changent pas (couleur, taille, plafond de 300) ; celles des autres sont dessinées dessous.

/** Les taches des autres sont plus petites que les tiennes (rayon × 0,55). */
export const OTHERS_SCALE = 0.55;
/** Intensité (0 à 1, part de la couleur de la peinture face à celle des blocs) : de `MIN` pour une mort à `MAX` à `OTHERS_COUNT_CAP` morts et au-delà. */
export const OTHERS_STRENGTH_MIN = 0.22;
export const OTHERS_STRENGTH_MAX = 0.55;
export const OTHERS_COUNT_CAP = 12;
/** Tuiles dessinées au plus (la carte du serveur en rend 300 ; les plus meurtrières d'abord). */
export const OTHERS_MAX_TILES = 200;
/** Distance minimale (tuiles) entre le centre d'un disque et un danger ou un fanion. */
export const OTHERS_KEEPOUT = 1;

/** Une tuile de la carte des morts : `[col, row, morts, cause dominante]`. */
export type DeathTile = readonly [number, number, number, number];

export interface OthersStain {
  discs: StainDisc[];
  /** 0 à 1 : la part de couleur de peinture (le reste : la couleur des blocs). Toujours sous celle de tes taches (1). */
  strength: number;
  count: number;
}

/** L'intensité d'une tuile de `count` morts : croissante, plafonnée. */
export function othersStrength(count: number): number {
  const k = Math.min(1, Math.max(0, (count - 1) / (OTHERS_COUNT_CAP - 1)));
  return OTHERS_STRENGTH_MIN + (OTHERS_STRENGTH_MAX - OTHERS_STRENGTH_MIN) * k;
}

/** Ce qu'une tache des autres ne doit jamais couvrir : pics (cases), trajets des scies, points de passage, départ, arrivée (tuiles). */
export interface Keepout {
  boxes: { x0: number; y0: number; x1: number; y1: number }[];
  segments: { ax: number; ay: number; bx: number; by: number; r: number }[];
}

export function keepoutOf(level: Level): Keepout {
  const boxes: Keepout["boxes"] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) if (isSpikeTile(level.tiles[row * level.width + col]!)) boxes.push({ x0: col, y0: row, x1: col + 1, y1: row + 1 });
  }
  // Fanions : la case du point de passage et la hauteur de la porte au-dessus (deux tuiles) ; départ et arrivée de même.
  for (const c of [...level.checkpoints, level.start, level.finish]) boxes.push({ x0: c.col, y0: c.row - 2, x1: c.col + 1, y1: c.row + 1 });
  const T = UNITS_PER_TILE;
  const segments: Keepout["segments"] = [];
  for (const saw of level.saws) {
    const r = saw.radius / T;
    const pts = saw.nodes.length ? saw.nodes : saw.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      segments.push({ ax: a.x / T, ay: a.y / T, bx: b.x / T, by: b.y / T, r });
    }
    if (pts.length === 1) segments.push({ ax: pts[0]!.x / T, ay: pts[0]!.y / T, bx: pts[0]!.x / T, by: pts[0]!.y / T, r });
  }
  return { boxes, segments };
}

/** Distance (tuiles) d'un point au danger ou au fanion le plus proche (0 dedans). */
export function keepoutDistance(k: Keepout, x: number, y: number): number {
  let best = Infinity;
  for (const b of k.boxes) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dy = Math.max(b.y0 - y, 0, y - b.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  for (const s of k.segments) {
    const vx = s.bx - s.ax;
    const vy = s.by - s.ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / len2));
    best = Math.min(best, Math.max(0, Math.hypot(x - (s.ax + t * vx), y - (s.ay + t * vy)) - s.r));
  }
  return best;
}

/**
 * Les taches de tout le monde pour une carte des morts : pour chaque tuile (les plus meurtrières d'abord, `OTHERS_MAX_TILES` au plus), la tache
 * de `stainFor` au centre de la tuile, réduite, sans les disques trop proches d'un danger ou d'un fanion ; une tuile dont il ne reste rien
 * n'est pas dessinée.
 */
export function othersStains(level: Level, tiles: readonly DeathTile[], keepout: Keepout = keepoutOf(level)): OthersStain[] {
  const T = UNITS_PER_TILE;
  const out: OthersStain[] = [];
  const sorted = [...tiles].filter((t) => Array.isArray(t) && t.length >= 3 && Number.isInteger(t[0]) && Number.isInteger(t[1]) && t[2] > 0).sort((a, b) => b[2] - a[2] || a[1] - b[1] || a[0] - b[0]);
  for (const [col, row, count] of sorted.slice(0, OTHERS_MAX_TILES)) {
    if (col < 0 || row < 0 || col >= level.width || row >= level.height + 8) continue;
    const discs = stainFor(level, col * T + T / 2, row * T + T / 2)
      .map((d) => ({ ...d, r: d.r * OTHERS_SCALE }))
      .filter((d) => keepoutDistance(keepout, d.x, d.y) >= OTHERS_KEEPOUT);
    if (discs.length) out.push({ discs, strength: othersStrength(count), count });
  }
  return out;
}
