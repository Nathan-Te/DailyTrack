import { UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";
import { TILE_SOLID, tileAt, type Level } from "./level";

// Collisions boîte contre grille, en unités entières. Une boîte = [x, x + w) × [y, y + h) (x vers la droite, y vers le bas).
// Les déplacements se font axe par axe et ne parcourent que les colonnes (ou rangées) **nouvellement** couvertes : la boîte s'arrête
// contre la première tuile pleine rencontrée, quelle que soit la vitesse (et la vitesse reste sous une tuile par pas, `MAX_SPEED`).

/** Division arrondie vers le bas (−1 ÷ 4 096 = −1), bâtie sur `idiv` : la tuile qui contient une coordonnée, même négative. */
export function floorDiv(a: number, b: number): number {
  const q = idiv(a, b);
  return a % b !== 0 && a < 0 !== b < 0 ? q - 1 : q;
}

/** Tuile (colonne ou rangée) qui contient la coordonnée `v`. */
export function tileOf(v: number): number {
  return floorDiv(v, UNITS_PER_TILE);
}

/** Vrai si une tuile pleine se trouve dans les colonnes [c0, c1] × rangées [r0, r1]. */
export function solidIn(level: Level, c0: number, c1: number, r0: number, r1: number): boolean {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) if (tileAt(level, c, r) === TILE_SOLID) return true;
  }
  return false;
}

/** Vrai si la boîte chevauche une tuile pleine. */
export function boxHits(level: Level, x: number, y: number, w: number, h: number): boolean {
  return solidIn(level, tileOf(x), tileOf(x + w - 1), tileOf(y), tileOf(y + h - 1));
}

/** Résultat d'un déplacement sur un axe : la nouvelle coordonnée, et si une tuile pleine a arrêté la boîte. */
export interface Move {
  pos: number;
  blocked: boolean;
}

/**
 * Déplace la boîte de `d` unités sur l'axe principal (`pos`, taille `size`), l'autre axe couvrant [`o`, `o + osize`).
 * `horizontal` : l'axe principal est x (colonnes) ; sinon y (rangées). Ne parcourt que les tuiles nouvellement couvertes.
 */
export function sweep(level: Level, pos: number, size: number, d: number, o: number, osize: number, horizontal: boolean): Move {
  if (d === 0) return { pos, blocked: false };
  const o0 = tileOf(o);
  const o1 = tileOf(o + osize - 1);
  const hit = (t: number) => (horizontal ? solidIn(level, t, t, o0, o1) : solidIn(level, o0, o1, t, t));
  if (d > 0) {
    const first = tileOf(pos + size - 1) + 1;
    const last = tileOf(pos + size + d - 1);
    for (let t = first; t <= last; t++) if (hit(t)) return { pos: t * UNITS_PER_TILE - size, blocked: true };
  } else {
    const first = tileOf(pos) - 1;
    const last = tileOf(pos + d);
    for (let t = first; t >= last; t--) if (hit(t)) return { pos: (t + 1) * UNITS_PER_TILE, blocked: true };
  }
  return { pos: pos + d, blocked: false };
}
