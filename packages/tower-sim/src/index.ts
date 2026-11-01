// Lot T1 — la simulation de jeu de Tower. `lab/` (lot T0) garde le banc d'essai et le moteur A de repli ; ce paquet n'exporte que la partie.
// Lot T2 — la rediffusion, le contenu du jour (générateur versionné), les paliers et les jours figés.
export {
  COMMANDE,
  COMMANDES_CONNUES,
  DEMI_CASE_8,
  DISTANCE_SOUDURE,
  FIGEE_TICKS,
  FROTTEMENT_GLISSANT,
  MARGE_CONTACT,
  PHYSIQUE,
  REGLAGES_DEFAUT,
  STABILISATION_MAX_TICKS,
  TICKS_PAR_SECONDE,
  TOWER_SIM_VERSION,
  type Reglages,
  VERSIONS_SIM_JOUABLES,
  VENT_PERIODE_TICKS,
} from "./constantes";
export { PHYSIQUE_REGLEE_DEFAUT, physiqueEstDEssai, physiqueResolue, type ReglagesPhysique } from "./physique";
export { numeroTower, PREMIER_JOUR_TOWER } from "./calendrier";
export { empreinteContenu, empreinteVue } from "./empreinte";
export { type Contenu, dailyTower, dateDuContenu, ErreurGenerateur, GENERATEUR_TIRAGE, type ThemeTower, TOWER_GENERATOR_VERSION, VERSIONS_GENERATEUR } from "./generateur";
export { aDoublon, aEcartMaximal, NB_PIECES, PLATEFORME_BORNES, PLATEFORME_DEMI8_CHOIX, suiteParSacs, tirerPaliers } from "./generateur/v1";
export { DUREE_EFFET, EFFETS, type Effet, estBonus, PALIERS_METRES, PALIERS_METRES_V3, type Palier, problemePaliers, type Taille } from "./paliers";
export { figerJour, FORMAT_JOUR_FIGE, type JourFige, type JourLu, jsonJourFige, lireJour, lireJourFige } from "./jours";
// Lot T3 — les médailles et les thèmes. Le bot (`@cdj/tower-sim/bot`) n'est pas réexporté ici : il se charge à la demande.
export {
  aireDuJour,
  COEFFICIENT_GEOMETRIQUE_PCT,
  diamantDe,
  estimationGeometrique,
  type Medailles,
  medailleObtenue,
  medailleVisee,
  medaillesDe,
  MEDAILLES_VERSION,
  type NomMedaille,
  NOMS_MEDAILLES,
  PLAFOND_DIAMANT_MM,
  POURCENTAGES_MEDAILLES,
} from "./medailles";
// Lot T3b — le tirage du contenu du jour : la plage du Diamant, le nombre d'essais, la règle de choix.
export { choisirTirage, dansLaPlage, ecartALaPlage, type Essai, PLAGE_DIAMANT_MM, TIRAGES_MAX } from "./tirage";
export { REGLES_THEMES, THEMES_TOWER, themeDuJour } from "./themes";
export { type EtatPiece, Partie, type PieceDepart, type Phase, type Resultat, type Scenario, type Visee, type VuePartie, type VuePiece } from "./partie";
// Lot T6 : la grille de la pièce active (boîte englobante, pivot) et les paramètres de contact de la version 4.
export { cadreDe, type Cadre, departGauche8, PAS_GRILLE_8, pivoter } from "./grille";
export { CONTACT_V3, CONTACT_V4, DECALAGES_SECOURS, MARGE_LATERALE, type ParamsContact, ROTATION_SECOURS } from "./contact";
// Le chargeur de Rapier (`@cdj/tower-sim/rapier`) n'est pas réexporté ici : le jeu le charge à la demande (un import dynamique), hors du premier chargement.
export type { Rapier } from "./rapier";
export {
  BORNES_REGLAGES,
  type CodeRefusTower,
  decoderRediffusion,
  encoderRediffusion,
  enregistrer,
  ErreurRediffusion,
  FORMAT_REDIFFUSION,
  idDuContenu,
  type IdContenu,
  MAX_TICKS_JEU,
  MAX_TICKS_REJEU,
  type Plage,
  type Rediffusion,
  type Rejeu,
  rejouer,
  rejouerComplet,
  rejouerParTranches,
  reglagesValides,
  ticksRediffusion,
  TRANCHE_TICKS,
} from "./rediffusion";
export { boitesE, type Echelles } from "./echelles";
export { boites, etenduePiece, sinCos, sommetPiece } from "./sommet";
export { PIECE_KINDS, type PieceKind } from "../lab/interface";
export { SCENARIO_ESSAI } from "../scenarios/essai";
export { SCENARIO_ALIGNEMENT } from "../scenarios/alignement";
import { SCENARIO_ALIGNEMENT as ALIGNEMENT } from "../scenarios/alignement";
import { SCENARIO_ESSAI as ESSAI } from "../scenarios/essai";
import type { Scenario as ScenarioNomme } from "./partie";
/** Lot T6 : un scénario nommé d'une rediffusion (`essai`, `alignement`), pour les outils et les tests qui rejouent une partie de référence ; undefined s'il est inconnu. */
export const scenarioNomme = (nom: string): ScenarioNomme | undefined => (nom === ESSAI.nom ? ESSAI : nom === ALIGNEMENT.nom ? ALIGNEMENT : undefined);
export { HAUTEUR_TOUR_DEPART_MM, HAUTEUR_TOUR_DEPART_V3_MM, scenarioPaliers, TOUR_DEPART, TOUR_DEPART_V3 } from "../scenarios/paliers";
