// Les modules de niveau et l'enchaînement (lot V2) : **un point d'entrée à part** (`@cdj/vertige-sim/modules`), pas dans `index.ts` — la bibliothèque est à la demande (la galerie, l'enchaînement, les outils et les tests),
// le premier chargement du jeu (budget `vertige.jsCss`) ne doit pas la voir. Charger ce fichier enregistre aussi le niveau « enchainement » (`niveau("enchainement")`).
export * from "./solution";
export * from "./jauges";
export * from "./modules";
export * from "./bibliotheque";
export * from "./enchainement";
export * from "./verifModules";
// Lot V3 : les variantes (miroir, longueurs ajustées), le générateur du niveau du jour et les jours figés.
export * from "./miroir";
export * from "./pilote";
export * from "./variantes";
export * from "./niveauDuJour";
export * from "./jours";
