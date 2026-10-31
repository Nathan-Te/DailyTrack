// Lot T1 — le point le plus haut d'une pièce, SANS sinus ni cosinus : l'angle rendu par Rapier (radians, flottant) est ramené en « brads » (2^20 par tour) et lu dans
// la table de sinus du lot T0 (`lab/a/trig.ts`, générée une fois). Que des multiplications et des additions : le même résultat sur Node et dans les navigateurs.
import { cos, sin } from "../lab/a/trig";
import type { PieceKind } from "../lab/interface";
import { type Box8, pieceBoxes } from "../lab/pieces";
import type { Taille } from "./paliers";

const CACHE = new Map<string, Box8[]>();
/**
 * Les boîtes d'une pièce (huitièmes de mètre, autour du centre de masse), mémorisées : la forme ne change jamais. Lot T2 : `petite` est la moitié (toutes les valeurs des sept
 * tétrominos sont paires : la moitié reste un entier du huitième), `geante` le double.
 */
export function boites(kind: PieceKind, rot: number, taille: Taille = "normale"): readonly Box8[] {
  const cle = `${kind}${rot & 3}${taille}`;
  let b = CACHE.get(cle);
  if (!b) {
    const base = pieceBoxes(kind, rot & 3);
    if (taille === "geante") b = base.map((x) => ({ cx: x.cx * 2, cy: x.cy * 2, hw: x.hw * 2, hh: x.hh * 2 }));
    else if (taille === "petite") {
      b = base.map((x) => {
        if ((x.cx | x.cy | x.hw | x.hh) & 1) throw new Error("pièce impossible à réduire de moitié sur la grille du huitième");
        return { cx: x.cx / 2, cy: x.cy / 2, hw: x.hw / 2, hh: x.hh / 2 };
      });
    } else b = base;
    CACHE.set(cle, b);
  }
  return b;
}

/** Brads par radian (2^20 / 2π). */
const BRADS_PAR_RADIAN = 166886.05;
const Q16 = 65536;

/** Sinus et cosinus d'un angle (radians) lus dans la table, sans transcendante : le même résultat sur Node et dans les navigateurs. */
export function sinCos(angle: number): { s: number; c: number } {
  const a = Math.round(angle * BRADS_PAR_RADIAN);
  return { s: sin(a) / Q16, c: cos(a) / Q16 };
}

/** Ordonnée la plus haute d'un ensemble de boîtes : centre de masse à l'ordonnée `y`, angle `angle` (radians). */
export function sommetDeBoites(bs: readonly Box8[], y: number, angle: number): number {
  const { s, c } = sinCos(angle);
  let haut = -Infinity;
  for (const b of bs) {
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

/** Ordonnée la plus haute de la pièce (mètres) : centre de masse en (x, y), angle `angle` (radians), formes de départ `kind` / `rot` (quarts de tour) et `taille`. */
export const sommetPiece = (kind: PieceKind, rot: number, y: number, angle: number, taille: Taille = "normale"): number => sommetDeBoites(boites(kind, rot, taille), y, angle);

/** Hauteur en millimètres entiers (arrondie au plus proche). */
export const enMillimetres = (metres: number): number => Math.round(metres * 1000);

/** Les abscisses extrêmes (mètres) d'un ensemble de boîtes : centre de masse en (x, ·), angle `angle`. Lot T3 : la largeur du sommet que mesure le bot. */
export function etendueDeBoites(bs: readonly Box8[], x: number, angle: number): { gauche: number; droite: number } {
  const { s, c } = sinCos(angle);
  let gauche = Infinity;
  let droite = -Infinity;
  for (const b of bs) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xl = (b.cx + sx * b.hw) / 8;
        const yl = (b.cy + sy * b.hh) / 8;
        const v = x + xl * c - yl * s;
        if (v < gauche) gauche = v;
        if (v > droite) droite = v;
      }
    }
  }
  return { gauche, droite };
}

/** Les abscisses extrêmes (mètres) de la pièce : centre de masse en (x, ·), angle `angle` (radians), formes de départ `kind` / `rot` et `taille`. */
export const etenduePiece = (kind: PieceKind, rot: number, x: number, angle: number, taille: Taille = "normale"): { gauche: number; droite: number } => etendueDeBoites(boites(kind, rot, taille), x, angle);
