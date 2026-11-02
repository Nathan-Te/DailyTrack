// Lot T8 — pour essayer le taquet, le déplacement intelligent et la tolérance d'emboîtement (`?scenario=emboitement`, hors production). Une plateforme de 16 m et une tour de départ qui a :
//   - **une niche latérale** : un L debout (sa tige de 3 m) porte un bâton couché qui dépasse d'un mètre et demi à sa gauche ; dessous, entre le dessus de la plateforme et le bâton, une niche de 3 m de
//     haut, ouverte à gauche, que le bâton ferme par le haut : un carré ne peut pas y TOMBER. Il faut le mener à gauche du bout du bâton, le laisser descendre, et au bon moment (son bas passe sous
//     le bâton, avant qu'il touche le sol) lui donner UN élan de taquet vers la droite : il file sous le bâton jusqu'à la tige du L, où il s'arrête net, calé. Trop tôt, l'élan frappe le bout du bâton
//     (qui reçoit un choc et glisse un peu sur sa tige) ;
//   - **un trou du dessus rétréci de 1 cm** : deux carrés posés à 99 cm l'un de l'autre (au lieu d'un mètre) : un bâton debout y entre malgré le centimètre qui manque (la tolérance d'emboîtement et le
//     recalage du déplacement intelligent).
// Puis une suite de pièces qui y entrent (un carré, un bâton, puis de quoi continuer). Pas de palier ; ce n'est pas le contenu du jour : aucun hasard, aucune date.
import type { PieceKind } from "../lab/interface";
import type { PieceDepart, Scenario } from "../src/partie";

const O = (xMetres: number, yMetres: number, dxMm = 0): PieceDepart => ({ kind: "O", rot: 0, x8: (xMetres + 1) * 8, y8: (yMetres + 1) * 8, dxMm });
const I = (xMetres: number, yMetres: number): PieceDepart => ({ kind: "I", rot: 0, x8: (xMetres + 2) * 8, y8: yMetres * 8 + 4 });

/** Les positions sont les bords gauche et bas des pièces, en mètres. */
export const DEPART_EMBOITEMENT: readonly PieceDepart[] = [
  { kind: "L", rot: 3, x8: 6, y8: 10 }, // le L debout : sa tige de x = 0 à 1, de y = 0 à 3 (son pied de 1 à 2 au ras de la plateforme)
  I(-1.5, 3), //                      le bâton couché sur la tige : x de −1,5 à 2,5, y de 3 à 4 (il dépasse d'un mètre et demi à gauche, son centre de masse est au-dessus de la tige)
  O(3, 0), //                         le mur gauche du trou rétréci : x de 3 à 5
  O(6, 0, -10), //                    le mur droit : x de 6 à 8, décalé de 10 mm vers la gauche — le trou fait 99 cm de large au lieu d'un mètre
];

export const SCENARIO_EMBOITEMENT: Scenario = {
  nom: "emboitement",
  pieces: [..."OIOLJTSZIO"] as PieceKind[],
  plateformeDemi8: 64,
  depart: DEPART_EMBOITEMENT,
};
