// Lot K2 — le module des jeux : voir `module.ts` (ce qu'il fait), `contrat.ts` (ce qu'un jeu fournit), `adaptateur.ts` (la table), `fil.ts` (le fil de calcul des rejeux).
export { type AdaptateurTable, type ColonneClassement, DEPARTAGES, type SqlDuJeu, sqlDe, verifierAdaptateur, versFiche, versTable } from "./adaptateur";
export { type ContratJeu, type LigneBrute, type LigneNiveau, type NiveauCalcule, type Rejouee, RefusJeu } from "./contrat";
export { DELAI_REJEU_MS, type ExecuteurRejeu, FILE_MAX_DEFAUT, RefusDuFil, executeurFil } from "./fil";
export { type ConfigJeu, type DebitDuJeu, type FicheServeur, type RoutePropre, creerJeu } from "./module";
