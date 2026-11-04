import type { Boite8 } from "@cdj/visuels/blocs";
import type { Piece } from "@cdj/blocks-sim";

// Les BOÎTES d'un dessin de pièces (le langage du module commun `@cdj/visuels/blocs` : huitièmes de case autour de l'origine, y vers le haut). **Une boîte par suite de cases d'une même ligne** : deux boîtes qui se
// touchent par une arête sont réunies par le module sans joint d'encre ; quatre cases autour d'un même point, elles, laisseraient un point d'encre au milieu du bloc.
export interface Case {
  col: number;
  ligne: number;
}

/** Les boîtes de ces cases, rapportées au point `(ox, oy)` (en cases, y vers le bas). */
export function boitesDeCases(cases: readonly Case[], ox: number, oy: number): Boite8[] {
  const parLigne = new Map<number, number[]>();
  for (const c of cases) parLigne.set(c.ligne, [...(parLigne.get(c.ligne) ?? []), c.col]);
  const boites: Boite8[] = [];
  for (const [ligne, cols] of [...parLigne].sort((a, b) => a[0] - b[0])) {
    cols.sort((a, b) => a - b);
    let debut = cols[0]!;
    for (let i = 0; i < cols.length; i++) {
      if (i + 1 === cols.length || cols[i + 1] !== cols[i]! + 1) {
        const n = cols[i]! - debut + 1;
        boites.push({ cx: (debut + n / 2 - ox) * 8, cy: -(ligne + 0.5 - oy) * 8, hw: n * 4, hh: 4 });
        debut = cols[i + 1]!;
      }
    }
  }
  return boites;
}

/** Les cases d'une pièce (colonne, ligne dans sa boîte). */
export function casesDe(p: Piece): Case[] {
  const out: Case[] = [];
  p.rangees.forEach((o, ligne) => {
    for (let col = 0; col < p.largeur; col++) if (o & (1 << col)) out.push({ col, ligne });
  });
  return out;
}

/** Les boîtes d'une pièce, centrées sur le centre de sa boîte englobante. */
export const boitesDePiece = (p: Piece): Boite8[] => boitesDeCases(casesDe(p), p.largeur / 2, p.hauteur / 2);
