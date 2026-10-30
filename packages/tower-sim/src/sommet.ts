// Lot T1 — le point le plus haut d'une pièce, SANS sinus ni cosinus : l'angle rendu par Rapier (radians, flottant) est ramené en « brads » (2^20 par tour) et lu dans
// la table de sinus du lot T0 (`lab/a/trig.ts`, générée une fois). Que des multiplications et des additions : le même résultat sur Node et dans les navigateurs.
import { cos, sin } from "../lab/a/trig";
import type { PieceKind } from "../lab/interface";
import { type Box8, pieceBoxes } from "../lab/pieces";

const CACHE = new Map<string, Box8[]>();
/** Les boîtes d'une pièce (huitièmes de case, autour du centre de masse), mémorisées : la forme ne change jamais. */
export function boites(kind: PieceKind, rot: number): readonly Box8[] {
  const cle = `${kind}${rot & 3}`;
  let b = CACHE.get(cle);
  if (!b) CACHE.set(cle, (b = pieceBoxes(kind, rot & 3)));
  return b;
}

/** Brads par radian (2^20 / 2π). */
const BRADS_PAR_RADIAN = 166886.05;
const Q16 = 65536;

/** Ordonnée la plus haute de la pièce (mètres) : centre de masse en (x, y), angle `angle` (radians), formes de départ `kind` / `rot` (quarts de tour). */
export function sommetPiece(kind: PieceKind, rot: number, y: number, angle: number): number {
  const a = Math.round(angle * BRADS_PAR_RADIAN);
  const s = sin(a) / Q16;
  const c = cos(a) / Q16;
  let haut = -Infinity;
  for (const b of boites(kind, rot)) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xl = (b.cx + sx * b.hw) / 8;
        const yl = (b.cy + sy * b.hh) / 8;
        const v = xl * s + yl * c;
        if (v > haut) haut = v;
      }
    }
  }
  return y + haut;
}

/** Hauteur en millimètres entiers (arrondie au plus proche). */
export const enMillimetres = (metres: number): number => Math.round(metres * 1000);
