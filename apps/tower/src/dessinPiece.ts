import type { Box8 } from "@cdj/tower-sim/lab/pieces";

// Lot T6 — le DESSIN d'une pièce, égal à son COLLIDER. Avant ce lot le trait d'encre était un rectangle plus grand que la boîte de Rapier (7 cm de chaque côté) : deux pièces qui se touchaient
// se recouvraient à l'écran (14 cm d'encre sur 14 cm de pièce) et le bord qu'on voyait n'était pas celui de la physique. Maintenant le trait d'encre est ENTIÈREMENT à l'intérieur de la forme physique :
// l'encre est la forme elle-même (les boîtes du collider, à l'identique), la couleur de la pièce (et le liseré d'un effet) la recouvre en retrait de `BORD`. Deux pièces qui se touchent montrent
// un seul trait double (2 × `BORD`), sans recouvrement ni jour. Fonction pure (mètres, repère de la pièce, centre de masse à l'origine), partagée par la scène et son test.

/** L'épaisseur du trait d'encre, en mètres (à l'intérieur de la forme). */
export const BORD = 0.07;
/** L'épaisseur du liseré d'un effet (lierre, pièce figée, pièce glissante), en mètres, entre l'encre et la couleur de la pièce : lui aussi à l'intérieur. */
export const LISERE = 0.09;

/** Un rectangle : centre et dimensions, en mètres. */
export interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const EPS = 1e-6;
const bords = (b: Box8): { x0: number; x1: number; y0: number; y1: number } => ({ x0: (b.cx - b.hw) / 8, x1: (b.cx + b.hw) / 8, y0: (b.cy - b.hh) / 8, y1: (b.cy + b.hh) / 8 });
const rect = (x0: number, x1: number, y0: number, y1: number): Rect => ({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(0.001, x1 - x0), h: Math.max(0.001, y1 - y0) });

/** Le collider : les boîtes de Rapier de la pièce, en mètres (ce que la scène dessine en encre, ni plus ni moins). */
export const colliderDe = (bs: readonly Box8[]): Rect[] => bs.map((b) => ({ cx: b.cx / 8, cy: b.cy / 8, w: (2 * b.hw) / 8, h: (2 * b.hh) / 8 }));

/**
 * La forme rétrécie de `retrait` mètres tout autour (l'érosion de la forme) : chaque boîte rétrécie, plus un pont sur chaque arête que deux boîtes partagent (il recouvre l'encre qui, sans lui,
 * marquerait la jonction à l'intérieur de la pièce). Aux coins rentrants (un T, un L…) le pont s'arrête à `retrait` du coin : l'encre y tourne comme le contour.
 */
export function interieur(bs: readonly Box8[], retrait: number): Rect[] {
  const b = bs.map(bords);
  const out: Rect[] = b.map((r) => rect(r.x0 + retrait, r.x1 - retrait, r.y0 + retrait, r.y1 - retrait));
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const a = b[i]!;
      const c = b[j]!;
      const gx0 = Math.max(a.x0, c.x0);
      const gx1 = Math.min(a.x1, c.x1);
      const gy0 = Math.max(a.y0, c.y0);
      const gy1 = Math.min(a.y1, c.y1);
      // Une arête horizontale commune (l'une au-dessus de l'autre) : le pont couvre l'encre de part et d'autre.
      if ((Math.abs(a.y1 - c.y0) < EPS || Math.abs(a.y0 - c.y1) < EPS) && gx1 - gx0 > 2 * retrait) {
        const y = Math.abs(a.y1 - c.y0) < EPS ? a.y1 : a.y0;
        out.push(rect(gx0 + retrait, gx1 - retrait, y - retrait, y + retrait));
      } else if ((Math.abs(a.x1 - c.x0) < EPS || Math.abs(a.x0 - c.x1) < EPS) && gy1 - gy0 > 2 * retrait) {
        const x = Math.abs(a.x1 - c.x0) < EPS ? a.x1 : a.x0;
        out.push(rect(x - retrait, x + retrait, gy0 + retrait, gy1 - retrait));
      }
    }
  }
  return out;
}

/** Les trois couches d'une pièce, de bas en haut : l'encre (le collider), le liseré d'un effet (s'il y en a un), la couleur de la pièce. Toutes dans la forme physique. */
export function couchesDe(bs: readonly Box8[], avecLisere: boolean): { encre: Rect[]; lisere: Rect[]; couleur: Rect[] } {
  return { encre: colliderDe(bs), lisere: avecLisere ? interieur(bs, BORD) : [], couleur: interieur(bs, avecLisere ? BORD + LISERE : BORD) };
}
