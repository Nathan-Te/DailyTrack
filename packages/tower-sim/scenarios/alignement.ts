// Lot T6 — la suite fixe pour essayer de poser juste (`?scenario=alignement`, hors production) : O, O, I, J, L, T, T, S, Z, O, I, T sur une plateforme de 7 m, sans palier. Deux carrés, un bâton, un J et un L,
// deux T (de quoi tourner et caler dans un creux), un S et un Z, puis de quoi terminer. Ce n'est pas le contenu du jour : aucun hasard, aucune date.
import type { PieceKind } from "../lab/interface";
import type { Scenario } from "../src/partie";

export const SCENARIO_ALIGNEMENT: Scenario = {
  nom: "alignement",
  pieces: [..."OOIJLTTSZOIT"] as PieceKind[],
  plateformeDemi8: 28,
};
