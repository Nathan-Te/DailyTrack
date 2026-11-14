import { TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE, TILE_SOLID, type Level } from "@cdj/jump-sim";
import { depthMap as depthMapGrille, isMatter as isMatterGrille, neighbourMask as neighbourMaskGrille } from "@cdj/visuels/plateformes";

// Auto-tuilage (lot 9), **pur** : chaque bloc plein se dessine selon ses 8 voisins. **Lot DA2 : l'assemblage (bits, voisins, `tileShape`, profondeur,
// bruit de case) est dans `@cdj/visuels/plateformes`** ; ce fichier ne dit que ce qui est de la matière dans Jump. Rien ici ne touche à la simulation :
// on lit la grille. Seuls les blocs pleins `#` — et, depuis le lot 11, les **tapis roulants** `[` `]` et la **glace** `~`, qui sont des blocs pleins
// dont seule la face du dessus a un traitement propre — comptent comme matière (un bloc friable peut tomber, un ressort est un objet à part : la
// face d'un bloc plein qui les touche est exposée et garde son contour). Hors de la grille, la gauche, la droite et le haut sont pleins (les bords du
// niveau), le bas est ouvert (on en meurt en tombant).

export { CORNERS, E, N, NE, NEIGHBOURS, NW, S, SE, SW, W, cellHash, cellNoise, tileShape } from "@cdj/visuels/plateformes";
export type { Corner, TileShape } from "@cdj/visuels/plateformes";

/** Lot 11 : vrai pour un bloc plein, un tapis roulant ou de la glace (la matière de l'auto-tuilage, du pochoir des taches, de l'ancrage du décor). */
export function isMatterTile(t: number): boolean {
  return t === TILE_SOLID || t === TILE_BELT_LEFT || t === TILE_BELT_RIGHT || t === TILE_ICE;
}

type Grille = Pick<Level, "width" | "height" | "tiles">;

/** Vrai si la case est de la matière pour l'auto-tuilage. */
export function isMatter(level: Grille, col: number, row: number): boolean {
  return isMatterGrille(level, col, row, isMatterTile);
}

/** Masque des 8 voisins d'une case (bit levé = voisin plein). */
export function neighbourMask(level: Grille, col: number, row: number): number {
  return neighbourMaskGrille(level, col, row, isMatterTile);
}

/**
 * Profondeur de chaque case pleine : distance (en cases, 8-connexité) à la plus proche case qui n'est pas pleine, moins un — 0 pour une
 * tuile du bord, 1 juste derrière, etc. ; −1 pour une case qui n'est pas pleine. Les bords gauche, droit et haut du niveau ne comptent
 * pas comme du vide (ils sont pleins), le dessous de la grille si. Parcours en largeur, linéaire.
 */
export function depthMap(level: Grille): Int16Array {
  return depthMapGrille(level, isMatterTile);
}
