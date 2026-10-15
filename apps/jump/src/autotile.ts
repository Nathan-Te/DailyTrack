import { TILE_SOLID, type Level } from "@cdj/jump-sim";

// Auto-tuilage (lot 9), **pur** : chaque bloc plein se dessine selon ses 8 voisins. Rien ici ne touche à la simulation : on lit la grille.
// Seuls les blocs pleins `#` comptent comme matière (un bloc friable peut tomber, un ressort est un objet à part : la face d'un bloc plein
// qui les touche est exposée et garde son contour). Hors de la grille, la gauche, la droite et le haut sont pleins (les bords du niveau),
// le bas est ouvert (on en meurt en tombant).

export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/** Les 8 voisins, dans l'ordre des bits : décalage (colonne, rangée) — rangée vers le bas. */
export const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [N, 0, -1],
  [NE, 1, -1],
  [E, 1, 0],
  [SE, 1, 1],
  [S, 0, 1],
  [SW, -1, 1],
  [W, -1, 0],
  [NW, -1, -1],
];

/** Vrai si la case est de la matière pour l'auto-tuilage. */
export function isMatter(level: Pick<Level, "width" | "height" | "tiles">, col: number, row: number): boolean {
  if (row >= level.height) return false;
  if (col < 0 || col >= level.width || row < 0) return true;
  return level.tiles[row * level.width + col] === TILE_SOLID;
}

/** Masque des 8 voisins d'une case (bit levé = voisin plein). */
export function neighbourMask(level: Pick<Level, "width" | "height" | "tiles">, col: number, row: number): number {
  let m = 0;
  for (const [bit, dc, dr] of NEIGHBOURS) if (isMatter(level, col + dc, row + dr)) m |= bit;
  return m;
}

/** Coins, dans l'ordre : haut-gauche, haut-droite, bas-droite, bas-gauche. */
export type Corner = 0 | 1 | 2 | 3;
export const CORNERS: readonly Corner[] = [0, 1, 2, 3];

export interface TileShape {
  /** Faces exposées (le voisin direct n'est pas plein). */
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  /** Coins extérieurs (les deux faces qui s'y rejoignent sont exposées) : arrondis ou chanfreinés selon le thème. */
  outer: readonly [boolean, boolean, boolean, boolean];
  /** Coins intérieurs (les deux voisins directs sont pleins, la diagonale est vide) : le contour des voisins s'y raccorde. */
  inner: readonly [boolean, boolean, boolean, boolean];
  /** Aucune face exposée ni coin intérieur : plein intérieur. */
  interior: boolean;
}

/** La forme d'une tuile d'après le masque de ses voisins : 256 configurations, une seule forme chacune. */
export function tileShape(mask: number): TileShape {
  const has = (b: number) => (mask & b) !== 0;
  const top = !has(N);
  const right = !has(E);
  const bottom = !has(S);
  const left = !has(W);
  const outer = [top && left, top && right, bottom && right, bottom && left] as const;
  const inner = [has(N) && has(W) && !has(NW), has(N) && has(E) && !has(NE), has(S) && has(E) && !has(SE), has(S) && has(W) && !has(SW)] as const;
  return { top, right, bottom, left, outer, inner, interior: !top && !right && !bottom && !left && !inner.some(Boolean) };
}

/**
 * Profondeur de chaque case pleine : distance (en cases, 8-connexité) à la plus proche case qui n'est pas pleine, moins un — 0 pour une
 * tuile du bord, 1 juste derrière, etc. ; −1 pour une case qui n'est pas pleine. Les bords gauche, droit et haut du niveau ne comptent
 * pas comme du vide (ils sont pleins), le dessous de la grille si. Parcours en largeur, linéaire.
 */
export function depthMap(level: Pick<Level, "width" | "height" | "tiles">): Int16Array {
  const { width, height } = level;
  const depth = new Int16Array(width * height).fill(-1);
  const big = 0x7fff;
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      if (!isMatter(level, col, row)) continue;
      depth[i] = big;
      for (const [, dc, dr] of NEIGHBOURS) {
        if (!isMatter(level, col + dc, row + dr)) {
          depth[i] = 0;
          queue[tail++] = i;
          break;
        }
      }
    }
  }
  while (head < tail) {
    const i = queue[head++]!;
    const col = i % width;
    const row = (i - col) / width;
    const d = depth[i]! + 1;
    for (const [, dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= width || r < 0 || r >= height) continue;
      const j = r * width + c;
      if (depth[j]! > d) {
        depth[j] = d;
        queue[tail++] = j;
      }
    }
  }
  // Une masse sans aucun vide (impossible dans un vrai niveau) reste « profonde ».
  for (let i = 0; i < depth.length; i++) if (depth[i] === big) depth[i] = 8;
  return depth;
}

/** Hachage entier déterministe d'une case (motif procédural : texture, garniture). 0 … 2³² − 1. */
export function cellHash(col: number, row: number, salt = 0): number {
  let h = Math.imul(col | 0, 0x27d4eb2d) ^ Math.imul(row | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Le même hachage ramené à [0, 1). */
export const cellNoise = (col: number, row: number, salt = 0): number => cellHash(col, row, salt) / 4294967296;
