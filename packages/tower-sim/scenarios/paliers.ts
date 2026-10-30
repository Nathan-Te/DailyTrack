// Lot T2 — le scénario des paliers (`?scenario=paliers&effet=…`) : une tour déjà posée, à 9 m, juste sous le premier palier (10 m). Une pièce posée dessus suffit pour le franchir. Le
// premier palier est l'effet demandé (même un malus, pour essayer chacun), les cinq autres suivent dans l'ordre des effets. Ce n'est PAS le contenu du jour : aucun hasard, aucune date.
import type { PieceKind } from "../lab/interface";
import { EFFETS, type Effet, PALIERS_METRES } from "../src/paliers";
import type { PieceDepart, Scenario } from "../src/partie";

/** La tour de départ : quatre carrés (8 m) et un bâton couché (1 m), centrés sur la plateforme : 9 m. */
export const TOUR_DEPART: readonly PieceDepart[] = [
  { kind: "O", rot: 0, x8: 0, y8: 8 },
  { kind: "O", rot: 0, x8: 0, y8: 24 },
  { kind: "O", rot: 0, x8: 0, y8: 40 },
  { kind: "O", rot: 0, x8: 0, y8: 56 },
  { kind: "I", rot: 0, x8: 0, y8: 68 },
];
export const HAUTEUR_TOUR_DEPART_MM = 9000;

const SUITE = "OTILSZJ" + "ZIOJTSL" + "SLTZIJO" + "JZITLOS" + "OSTLJIZ" + "TOLSJ";

/** Le scénario des paliers dont le premier palier (10 m) est `effet`. */
export function scenarioPaliers(effet: Effet): Scenario {
  const autres = EFFETS.filter((e) => e !== effet);
  return {
    nom: `paliers-${effet}`,
    pieces: [...SUITE] as PieceKind[],
    plateformeDemi8: 28,
    paliers: PALIERS_METRES.map((metres, i) => ({ metres, effet: i === 0 ? effet : autres[i - 1]! })),
    ventSens: 1,
    depart: TOUR_DEPART,
  };
}
