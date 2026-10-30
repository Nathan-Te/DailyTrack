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
  VENT_PERIODE_TICKS,
} from "./constantes";
export { empreinteContenu, empreinteVue } from "./empreinte";
export { type Contenu, dailyTower, dateDuContenu, ErreurGenerateur, type ThemeTower, TOWER_GENERATOR_VERSION, VERSIONS_GENERATEUR } from "./generateur";
export { aDoublon, aEcartMaximal, NB_PIECES, PLATEFORME_BORNES, PLATEFORME_DEMI8_CHOIX, suiteParSacs, tirerPaliers } from "./generateur/v1";
export { DUREE_EFFET, EFFETS, type Effet, estBonus, PALIERS_METRES, type Palier, problemePaliers, type Taille } from "./paliers";
export { figerJour, FORMAT_JOUR_FIGE, type JourFige, jsonJourFige, lireJourFige } from "./jours";
export { type EtatPiece, Partie, type PieceDepart, type Phase, type Resultat, type Scenario, type VuePartie, type VuePiece } from "./partie";
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
export { boites, sinCos, sommetPiece } from "./sommet";
export { PIECE_KINDS, type PieceKind } from "../lab/interface";
export { SCENARIO_ESSAI } from "../scenarios/essai";
export { HAUTEUR_TOUR_DEPART_MM, scenarioPaliers, TOUR_DEPART } from "../scenarios/paliers";
