// « Pile poil » (lot K4f) — le jeu témoin du kit : 30 s, une grille de 8 × 6, 20 pilepoil tirées de la graine du jour qui apparaissent une à une ; on touche la case.
// Tout est entier, 30 Hz. Un jeu témoin n'a pas de vision à suivre : il reste SIMPLE (c'est le modèle que le générateur copie).

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée. */
export const PILEPOIL_SIM_VERSION = 1;
/** La version de la dérivation de la graine et du tirage du jour (un jeu Party n'a pas de générateur de niveaux). Elle monte à tout changement de ce que `dailyPilepoil` produit. */
export const PILEPOIL_GENERATOR_VERSION = 1;

export const TICKS_PAR_SECONDE = 30;
/** 30 secondes. */
export const DUREE_TICKS = 900;
export const COLONNES = 8;
export const LIGNES = 6;
export const NB_CASES = COLONNES * LIGNES;
export const NB_PILEPOIL = 20;
/** Au plus 200 touches par partie (un joueur qui tape partout) : au-delà, la rediffusion est refusée. */
export const MAX_TOUCHES = 200;
