// Lot T8 — pour essayer le taquet et la tolérance d'emboîtement (`?scenario=emboitement`, hors production). Une plateforme de 16 m et une tour de départ qui a :
//   - **une niche latérale** : un pilier (un carré) porte un bâton couché qui dépasse d'un mètre à sa gauche ; dessous, entre le dessus de la plateforme et le bâton, une niche de 2 m de haut, ouverte à
//     gauche, où seul un CARRÉ qui arrive par le côté entre exactement (le bâton la ferme par le haut) : poser le carré à gauche du bâton, puis le caler d'un taquet vers la droite ;
//   - **un trou du dessus rétréci de 1 cm** : deux carrés posés à 99 cm l'un de l'autre (au lieu d'un mètre) : un bâton debout y entre malgré le centimètre qui manque (la tolérance d'emboîtement).
// Puis une suite de pièces qui y entrent (un carré, un bâton, puis de quoi continuer). Pas de palier ; ce n'est pas le contenu du jour : aucun hasard, aucune date.
import type { PieceKind } from "../lab/interface";
import type { PieceDepart, Scenario } from "../src/partie";

const O = (xMetres: number, yMetres: number, dxMm = 0): PieceDepart => ({ kind: "O", rot: 0, x8: (xMetres + 1) * 8, y8: (yMetres + 1) * 8, dxMm });
const I = (xMetres: number, yMetres: number): PieceDepart => ({ kind: "I", rot: 0, x8: (xMetres + 2) * 8, y8: yMetres * 8 + 4 });

/** Les positions sont les bords gauche et bas des pièces, en mètres. */
export const DEPART_EMBOITEMENT: readonly PieceDepart[] = [
  O(0, 0), //                   le pilier : x de 0 à 2, y de 0 à 2
  I(-1, 2), //                  le bâton couché sur le pilier : x de −1 à 3, y de 2 à 3 (il dépasse d'un mètre à gauche)
  O(3, 0), //                   le mur gauche du trou rétréci : x de 3 à 5
  O(6, 0, -10), //              le mur droit : x de 6 à 8, décalé de 10 mm vers la gauche — le trou fait 99 cm de large au lieu d'un mètre
];

export const SCENARIO_EMBOITEMENT: Scenario = {
  nom: "emboitement",
  pieces: [..."OIOLJTSZIO"] as PieceKind[],
  plateformeDemi8: 64,
  depart: DEPART_EMBOITEMENT,
};
