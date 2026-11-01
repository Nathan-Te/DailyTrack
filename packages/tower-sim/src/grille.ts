// Lot T6 — la grille de la pièce active (simulation, version 4). Les bords de la pièce active restent sur la grille des DEMI-CASES (4 huitièmes de mètre), quelle que soit la forme et quel que soit
// le quart de tour : la position pilotée est celle de la BOÎTE ENGLOBANTE (son bord gauche), pas celle du centre de masse. Le centre de masse d'un T couché tombe à un quart de case de la grille :
// piloté par lui, ses bords n'y étaient plus jamais et aucun déplacement d'une demi-case ne pouvait les réaligner (relevé de Nathan, 1er novembre 2026).
// Tout est en huitièmes de mètre et en ENTIERS (sauf la hauteur d'un pivot, qui peut valoir un demi-huitième) : aucune transcendante, aucun hasard.
import type { Box8 } from "../lab/pieces";
import { DEMI_CASE_8 } from "./constantes";

/** La boîte englobante d'une forme, en huitièmes de mètre, RAPPORTÉE AU CENTRE DE MASSE (comme les boîtes de `lab/pieces.ts`). */
export interface Cadre {
  gauche: number;
  droite: number;
  bas: number;
  haut: number;
}

export function cadreDe(bs: readonly Box8[]): Cadre {
  let gauche = Infinity;
  let droite = -Infinity;
  let bas = Infinity;
  let haut = -Infinity;
  for (const b of bs) {
    gauche = Math.min(gauche, b.cx - b.hw);
    droite = Math.max(droite, b.cx + b.hw);
    bas = Math.min(bas, b.cy - b.hh);
    haut = Math.max(haut, b.cy + b.hh);
  }
  return { gauche, droite, bas, haut };
}

/** Le pas d'un déplacement : la demi-case. */
export const PAS_GRILLE_8 = DEMI_CASE_8;

/**
 * Le bord gauche d'une pièce qui naît, centrée sur l'axe de la plateforme, sur la grille : `-4 × ⌈largeur / 8⌉` (une pièce de taille normale a une largeur multiple de 8 : elle est exactement
 * centrée ; une petite pièce, dont la largeur est un multiple de 4, se cale sur la demi-case la plus proche à gauche de son centre).
 */
export function departGauche8(c: Cadre): number {
  return -PAS_GRILLE_8 * Math.ceil((c.droite - c.gauche) / (2 * PAS_GRILLE_8));
}

/**
 * Le quart de tour autour d'un POINT DE LA GRILLE, à la manière des pivots de Tetris : le centre de la boîte englobante. Les bords gauche et droit de la boîte d'arrivée restent sur la grille de
 * la demi-case : la largeur d'arrivée est la hauteur de départ, tous deux multiples de la demi-case (de la case pour une pièce de taille normale), donc `(largeur − hauteur) / 2` en est un aussi ;
 * pour une pièce de taille réduite (la moitié : multiples de 4) ce décalage tombe parfois sur un demi-pas, arrondi vers la gauche (`Math.floor`), ce qui garde la grille.
 * Rend le bord gauche et le bas de la boîte d'arrivée, en huitièmes de mètre, à partir de ceux de la boîte de départ ; le bas suit le même pivot (le centre de la boîte), sans arrondi.
 */
export function pivoter(avant: Cadre, apres: Cadre, gauche8: number, bas8: number): { gauche8: number; bas8: number } {
  const L = avant.droite - avant.gauche;
  const H = avant.haut - avant.bas;
  const Lp = apres.droite - apres.gauche;
  const Hp = apres.haut - apres.bas;
  return { gauche8: gauche8 + PAS_GRILLE_8 * Math.floor((L - Lp) / (2 * PAS_GRILLE_8)), bas8: bas8 + (H - Hp) / 2 };
}
