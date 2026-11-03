// Lot K2 — le module des jeux : voir `module.ts` (ce qu'il fait), `contrat.ts` (ce qu'un jeu fournit), `adaptateur.ts` (la table), `fil.ts` (le fil de calcul des rejeux).
export { type AdaptateurTable, adaptateurResultatsJeu, CLES_RESULTATS_JEU, type ColonneClassement, DEPARTAGES, type SqlDuJeu, sqlDe, verifierAdaptateur, versFiche, versTable } from "./adaptateur";
export { type ContexteTableau, type ContexteValidation, type ContratJeu, type LigneBrute, type LigneNiveau, type NiveauCalcule, type Rejouee, RefusJeu, type Validation } from "./contrat";
export { DELAI_REJEU_MS, type ExecuteurRejeu, FILE_MAX_DEFAUT, RefusDuFil, executeurFil } from "./fil";
export { type ConfigJeu, type DebitDuJeu, type FicheServeur, type OutilsModule, type RoutePropre, creerJeu } from "./module";
export { type ContratMinimal, contratDeFiche, definirJeuNeuf, medailleParSeuils, type OptionsJeuNeuf, refusDEnveloppe, type RejeuNeuf, type SeuilsMedailles } from "./defauts";
