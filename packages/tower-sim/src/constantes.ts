// Lot T1 — les constantes de la partie de Tower (la simulation de jeu, `src/`). La physique est celle de Rapier 2D déterministe (docs/tower/consignes.md) ;
// tout ce qui entre dans le moteur est un ENTIER ÷ 8 (positions en huitièmes de mètre, vitesses en huitièmes de m/s), jamais le résultat d'une transcendante.

/**
 * Version de la simulation de jeu. Elle monte à tout changement de règle ou de réglage qui change une partie rejouée, et le golden (`test/fixtures/golden-tower.json`) ne
 * se régénère qu'avec elle. Version 2 (lot T2) : les paliers (lierre, pièce figée, petite, géante, coup de vent, glissante). Version 3 (lot T2) : « descendre » n'a plus aucun effet physique (la pièce se pose à la vitesse d'une chute normale) et la pièce figée se fige au contact.
 * **Version 4 (lot T6) : la grille et la pose juste** — la pièce active est pilotée par sa boîte englobante (ses bords restent sur la grille des demi-cases), le quart de tour pivote autour d'un point
 * de la grille avec un décalage de secours, la pièce ne lâche plus le long d'un voisin collé, et les paramètres de contact de Rapier changent (`contact.ts`). La version 3 reste rejouable telle quelle.
 */
export const TOWER_SIM_VERSION = 4;
/** Les versions de la simulation que ce code sait jouer (lot T6 : la 3 reste rejouable au bit près, la 4 est celle des parties nouvelles). */
export const VERSIONS_SIM_JOUABLES: readonly number[] = [3, 4];

/** Pas fixe : 60 Hz (décision de Nathan après le lot T0). */
export const TICKS_PAR_SECONDE = 60;

/**
 * Les commandes d'UN tick, dans un masque de bits (un entier, ce qu'un enregistrement stockera au lot T2).
 * - `GAUCHE`, `DROITE`, `TOURNER` sont des ordres **de ce tick** : chaque bit levé déplace d'une demi-case, ou fait pivoter d'un quart de tour, une fois. La répétition
 *   d'une touche maintenue (délai, cadence) est l'affaire du client : il lève le bit aux instants voulus, la simulation ne lit ni horloge ni état de touche.
 * - `DESCENDRE` est un **niveau** : tant que le bit est levé, la chute est multipliée par `facteurDescente`.
 */
export const COMMANDE = { GAUCHE: 1, DROITE: 2, TOURNER: 4, DESCENDRE: 8 } as const;
/** Tous les bits de commande connus : un masque qui en porte un autre est refusé par une rediffusion (lot T2). */
export const COMMANDES_CONNUES = COMMANDE.GAUCHE | COMMANDE.DROITE | COMMANDE.TOURNER | COMMANDE.DESCENDRE;

/** Une demi-case, en huitièmes de mètre. */
export const DEMI_CASE_8 = 4;
/** La pièce active ne va jamais plus loin que cette distance de l'axe de la plateforme (huitièmes de mètre : 16 m). */
export const LIMITE_X8 = 128;

/** Sur la plateforme de la partie, « le niveau de la plateforme » est y = 0 : le dessus de la plateforme. */
export const NIVEAU_PLATEFORME = 0;

/** Après la dernière pièce (ou la dernière vie), on attend la stabilisation 5 s au plus. */
export const STABILISATION_MAX_TICKS = 5 * TICKS_PAR_SECONDE;

/** Une pièce posée est « calme » sous cette vitesse (m/s) : seule une pièce devenue calme (ou endormie) compte dans la hauteur en direct et la plus haute atteinte. */
export const VITESSE_CALME = 0.3;

/** Un contact est « prévu » quand la pièce active, au pas suivant, serait à moins de 3 cm d'un autre corps. */
export const MARGE_CONTACT = 0.03;
/** Un déplacement ou un quart de tour est refusé s'il enfonce la pièce de plus de 1 mm dans un autre corps (collé, c'est permis : la pièce lâche alors au pas suivant). */
export const MARGE_REFUS = 0.001;

/** Physique de la partie (Rapier) : les valeurs du banc du lot T0, sauf la plateforme (donnée du scénario). */
export const PHYSIQUE = { gravite: 9.81, frottement: 0.6, rebond: 0, iterations: 30 } as const;

/** Les réglages de sensation (curseurs de `?debug&tune`) : tous entiers, donc exacts. Ils font partie de ce qu'un rejeu doit connaître (lot T2). */
export interface Reglages {
  /** Vitesse de chute de la pièce active, en huitièmes de m/s (20 = 2,5 m/s). */
  vitesseChute8: number;
  /** Facteur de la chute quand `DESCENDRE` est levé (entier). */
  facteurDescente: number;
  /** Hauteur d'apparition : la plus basse pointe de la pièce naît à cette distance au-dessus du point le plus haut de la tour, en huitièmes de mètre (56 = 7 m). */
  hauteurApparition8: number;
  /** Nombre de vies. */
  vies: number;
}

export const REGLAGES_DEFAUT: Readonly<Reglages> = { vitesseChute8: 20, facteurDescente: 4, hauteurApparition8: 56, vies: 3 };

// ---- Lot T2 : les paliers ----

/** Un coup de vent pousse la pièce active d'un huitième de mètre (12,5 cm) tous les `VENT_PERIODE_TICKS` ticks : 0,75 m/s, une poussée constante en ENTIERS (pas de force flottante). */
export const VENT_PERIODE_TICKS = 10;
/** Une pièce glissante a ce frottement (règle « minimum » de Rapier : celui de la pièce ou du support qui en a le moins) au lieu de `PHYSIQUE.frottement`. */
export const FROTTEMENT_GLISSANT = 0.05;
/** Pièce figée : elle devient un corps fixe pour toujours AU CONTACT (le premier après le lâcher, voir `DISTANCE_SOUDURE`), quitte à flotter ; au plus tard `FIGEE_TICKS` ticks (2 s) après le lâcher si ce contact a été manqué. */
export const FIGEE_TICKS = 120;
/** Le « premier contact » (lierre, pièce figée) : le premier tick, après le lâcher, où Rapier rapporte un point de contact à moins de 3 cm d'un autre corps. Mesuré : deux corps qui se touchent y sont rapportés à ≈ 1,7 cm (la marge de contact de Rapier), à 0 point de contact avant ; 5 mm ne voyait donc jamais le contact. */
export const DISTANCE_SOUDURE = 0.03;
