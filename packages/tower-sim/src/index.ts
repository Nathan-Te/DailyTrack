// Lot T1 — la simulation de jeu de Tower. `lab/` (lot T0) garde le banc d'essai et le moteur A de repli ; ce paquet n'exporte que la partie.
export { COMMANDE, DEMI_CASE_8, MARGE_CONTACT, PHYSIQUE, REGLAGES_DEFAUT, STABILISATION_MAX_TICKS, TICKS_PAR_SECONDE, TOWER_SIM_VERSION, type Reglages } from "./constantes";
export { empreinteVue } from "./empreinte";
export { type EtatPiece, Partie, type Phase, type Resultat, type Scenario, type VuePartie, type VuePiece } from "./partie";
// Le chargeur de Rapier (`@cdj/tower-sim/rapier`) n'est pas réexporté ici : le jeu le charge à la demande (un import dynamique), hors du premier chargement.
export type { Rapier } from "./rapier";
export { boites, sommetPiece } from "./sommet";
export { PIECE_KINDS, type PieceKind } from "../lab/interface";
export { SCENARIO_ESSAI } from "../scenarios/essai";
