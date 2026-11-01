// Lot T3b — les scénarios d'essai en UN point d'entrée à la demande : le jeu les charge par un import dynamique (`?scenario=essai`, `?scenario=alignement` et `?scenario=paliers`, trois outils fermés en production),
// donc ils ne pèsent rien au premier chargement.
export { SCENARIO_ALIGNEMENT } from "./alignement";
export { SCENARIO_ESSAI } from "./essai";
export { scenarioPaliers } from "./paliers";
