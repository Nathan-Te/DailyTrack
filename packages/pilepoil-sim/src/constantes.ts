// « Pile poil » (lot PA2) — le premier jeu Party : dix jauges ; un curseur va et vient, on appuie pour l'arrêter pile sur la cible. Reprise de la maquette validée par Nathan
// (`docs/pilepoil/maquettes/pile-poil-maquette-jouable.html`, elle fait foi pour les règles et les nombres). Tout est entier, à pas fixes de 1/120 s.

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée. */
export const PILEPOIL_SIM_VERSION = 1;
/** La version de la dérivation de la graine et du tirage du jour (un jeu Party n'a pas de générateur de niveaux). Elle monte à tout changement de ce que `dailyPilepoil` produit. */
export const PILEPOIL_GENERATOR_VERSION = 1;

/** Pas de 1/120 s, comme la maquette. */
export const TICKS_PAR_SECONDE = 120;
/** Dix jauges à la suite. */
export const JAUGES = 10;
/** La longueur d'une jauge, en millièmes de pixel de jauge. */
export const LONGUEUR = 1_000_000;
/** Un appui par jauge au plus : la rediffusion a dix pas au plus. */
export const MAX_APPUIS = JAUGES;
