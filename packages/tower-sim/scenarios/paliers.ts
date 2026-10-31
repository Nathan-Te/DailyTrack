// Lot T2 — le scénario des paliers (`?scenario=paliers&effet=…`) : une tour déjà posée, juste sous le premier palier. Une pièce posée dessus suffit pour le franchir. Le
// premier palier est l'effet demandé (même un malus, pour essayer chacun), les cinq autres suivent dans l'ordre des effets. Ce n'est PAS le contenu du jour : aucun hasard, aucune date.
// Lot T4 (décision de Nathan) : le scénario suit les paliers du générateur 3 (8, 16… 48 m) ; sa tour de départ fait 7 m (`TOUR_DEPART_V3`). La tour à 9 m du lot T2 (`TOUR_DEPART`) reste
// exportée : les tests des paliers de 10 m s'en servent. Le scénario n'est pas versionné (aucune rediffusion ne le nomme dans le golden).
import type { PieceKind } from "../lab/interface";
import { EFFETS, type Effet, PALIERS_METRES_V3 } from "../src/paliers";
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

/** Lot T4 : la tour de départ du scénario (paliers de 8 m) : trois carrés (6 m) et un bâton couché (1 m), centrés sur la plateforme : 7 m, juste sous le premier palier. */
export const TOUR_DEPART_V3: readonly PieceDepart[] = [
  { kind: "O", rot: 0, x8: 0, y8: 8 },
  { kind: "O", rot: 0, x8: 0, y8: 24 },
  { kind: "O", rot: 0, x8: 0, y8: 40 },
  { kind: "I", rot: 0, x8: 0, y8: 52 },
];
export const HAUTEUR_TOUR_DEPART_V3_MM = 7000;

const SUITE = "OTILSZJ" + "ZIOJTSL" + "SLTZIJO" + "JZITLOS" + "OSTLJIZ" + "TOLSJ";

/** Le scénario des paliers dont le premier palier (8 m) est `effet`. */
export function scenarioPaliers(effet: Effet): Scenario {
  const autres = EFFETS.filter((e) => e !== effet);
  return {
    nom: `paliers-${effet}`,
    pieces: [...SUITE] as PieceKind[],
    plateformeDemi8: 28,
    paliers: PALIERS_METRES_V3.map((metres, i) => ({ metres, effet: i === 0 ? effet : autres[i - 1]! })),
    ventSens: 1,
    depart: TOUR_DEPART_V3,
  };
}
