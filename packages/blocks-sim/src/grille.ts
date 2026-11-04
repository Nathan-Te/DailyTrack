import { COLONNES, LIGNE_PLEINE, LIGNES } from "./constantes";
import type { Piece } from "./pieces";

// La grille de 8 × 8 en MASQUE DE BITS : deux entiers de 32 bits, `bas` = lignes 0 à 3 (haut de la grille) et `haut` = lignes 4 à 7 ; une ligne = un octet, le bit `c` = la colonne `c`. Les fonctions sont
// pures (elles rendent une nouvelle grille) : le bot de B3 teste toutes les positions de chaque pièce sans rien allouer d'autre que deux entiers.

export interface Grille {
  readonly lo: number;
  readonly hi: number;
}
export const VIDE: Grille = { lo: 0, hi: 0 };

/** L'octet de la ligne `l` (0 en haut). */
export const rangee = (g: Grille, l: number): number => ((l < 4 ? g.lo : g.hi) >>> ((l & 3) * 8)) & LIGNE_PLEINE;

function avecRangee(g: Grille, l: number, octet: number): Grille {
  const dec = (l & 3) * 8;
  const mot = ((l < 4 ? g.lo : g.hi) & ~(LIGNE_PLEINE << dec)) | (octet << dec);
  return l < 4 ? { lo: mot >>> 0, hi: g.hi } : { lo: g.lo, hi: mot >>> 0 };
}

export const caseOccupee = (g: Grille, col: number, ligne: number): boolean => (rangee(g, ligne) & (1 << col)) !== 0;
export const estVide = (g: Grille): boolean => g.lo === 0 && g.hi === 0;

const bitsEnMain = (n: number): number => {
  let v = n >>> 0;
  let c = 0;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
};
export const casesOccupees = (g: Grille): number => bitsEnMain(g.lo) + bitsEnMain(g.hi);

/** La boîte de la pièce, posée en (col, ligne), tient-elle dans la grille et sur des cases vides ? */
export function peutPoser(g: Grille, p: Piece, col: number, ligne: number): boolean {
  if (!Number.isInteger(col) || !Number.isInteger(ligne) || col < 0 || ligne < 0 || col + p.largeur > COLONNES || ligne + p.hauteur > LIGNES) return false;
  for (let k = 0; k < p.hauteur; k++) if ((rangee(g, ligne + k) & (p.rangees[k]! << col)) !== 0) return false;
  return true;
}

/** Pose sans rien vérifier (à appeler après `peutPoser`). */
export function poser(g: Grille, p: Piece, col: number, ligne: number): Grille {
  let r = g;
  for (let k = 0; k < p.hauteur; k++) r = avecRangee(r, ligne + k, rangee(r, ligne + k) | (p.rangees[k]! << col));
  return r;
}

/** Les lignes pleines (un bit par ligne, bit `l` = ligne `l`) et les colonnes pleines (un bit par colonne). */
export function pleines(g: Grille): { lignes: number; colonnes: number } {
  let lignes = 0;
  let colonnes = LIGNE_PLEINE;
  for (let l = 0; l < LIGNES; l++) {
    const o = rangee(g, l);
    if (o === LIGNE_PLEINE) lignes |= 1 << l;
    colonnes &= o;
  }
  return { lignes, colonnes };
}

/** Efface en une fois les lignes et colonnes données (les masques de `pleines`) : une case au croisement part avec les deux. */
export function effacer(g: Grille, lignes: number, colonnes: number): Grille {
  let r = g;
  for (let l = 0; l < LIGNES; l++) r = avecRangee(r, l, (lignes >> l) & 1 ? 0 : rangee(r, l) & ~colonnes & LIGNE_PLEINE);
  return r;
}

/** Combien de lignes et de colonnes sont pleines (`n` du barème). */
export const compterPleines = (m: { lignes: number; colonnes: number }): number => bitsEnMain(m.lignes) + bitsEnMain(m.colonnes);

/** Y a-t-il une position où la pièce tient ? */
export function tientQuelquePart(g: Grille, p: Piece): boolean {
  for (let l = 0; l + p.hauteur <= LIGNES; l++) for (let c = 0; c + p.largeur <= COLONNES; c++) if (peutPoser(g, p, c, l)) return true;
  return false;
}

/** Une grille depuis des lignes de texte (`X` = occupée), du haut vers le bas ; pour les scénarios et les tests. */
export function grilleDepuis(art: readonly string[]): Grille {
  let g: Grille = VIDE;
  art.forEach((txt, l) => {
    g = avecRangee(g, l, [...txt].reduce((o, ch, c) => (ch === "X" ? o | (1 << c) : o), 0));
  });
  return g;
}

/** La grille en texte (`X` / `.`), ligne par ligne : lisible dans un test qui échoue. */
export const grilleEnTexte = (g: Grille): string[] => Array.from({ length: LIGNES }, (_, l) => Array.from({ length: COLONNES }, (_, c) => (caseOccupee(g, c, l) ? "X" : ".")).join(""));
