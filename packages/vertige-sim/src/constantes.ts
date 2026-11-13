// « Vertige » (lot V0, prototype) — la simulation d'un plateformer à la première personne : tout est ENTIER, à pas fixe de 120 Hz.
// Unités : les positions sont en micromètres (1 m = 1 000 000), les vitesses en micromètres par seconde, les angles en 1/65 536 de tour. Aucun flottant n'entre dans l'état d'une partie.

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée. 2 : la gravité par quarts de tour, les orbes et les portails (lot V1). 3 : les orbes sont retirées, la gravité ne tourne qu'au contact d'une surface marquée ou par un portail (lot V2). */
export const VERTIGE_SIM_VERSION = 3;
/** La version du générateur du contenu du jour. Elle monte à tout changement de ce que `dailyVertige` produit. 2 : le niveau du jour assemblé de modules, miroirs et longueurs ajustées (lot V3) ; la version 1 (le parcours de la maquette) reste appelable. */
export const VERTIGE_GENERATOR_VERSION = 2;

/** La version du robot et du barème des médailles (lot V3), écrite dans le fichier d'un jour figé : elle monte quand ce qui produit les seuils change (la solution d'un module, le pilote des variantes, la façon de lire le barème). */
export const VERTIGE_BOT_VERSION = 1;

export const TICKS_PAR_SECONDE = 120;
/** 120 secondes : au-delà, la partie s'arrête et vaut le pire temps. */
export const DUREE_MAX_TICKS = 120 * TICKS_PAR_SECONDE;

/** Un mètre, un centimètre (les niveaux s'écrivent en centimètres), en micromètres. */
export const M = 1_000_000;
export const CM = 10_000;
/** La distance laissée entre le joueur et ce qu'il touche (100 µm) : les pieds posés sont à cette hauteur au-dessus de la surface. */
export const POUSSEE = 100;
/** La boîte du joueur : 0,6 × 1,8 × 0,6 m ; la position est celle des pieds, au milieu de la boîte. */
export const DEMI = 300_000;
export const HAUT = 1_800_000;
/** La hauteur des yeux au-dessus des pieds (rendu seulement). */
export const YEUX = 1_620_000;

/** Un tour d'angle, un quart de tour. */
export const TOUR = 65536;
export const QUART = 16384;
/** Le tangage est borné à ± 0,2287 tour (≈ ± 82°). */
export const TANGAGE_MAX = 15000;

/** Les touches d'un pas, en bits (7 depuis le lot V2 : la reprise). */
export const T_AVANT = 1;
export const T_ARRIERE = 2;
export const T_GAUCHE = 4;
export const T_DROITE = 8;
export const T_SAUT = 16;
export const T_DASH = 32;
/** La touche de reprise (lot V2) : un appui ramène au dernier palier, comme une chute (le chrono continue) ; la même que « point de contrôle » de Track et Jump (R). */
export const T_REPRISE = 64;
export const TOUCHES_TOUTES = 127;

/** Au plus ce que la sensibilité peut produire en un pas (un demi-tour) : un pas plus brusque est refusé à la lecture. */
export const REGARD_MAX = 32767;

/** La longueur maximale du texte de rediffusion : 120 s de pas, la souris comprise, en base64url (la mesure du lot est dans son README). */
export const MAX_CARACTERES = 200_000;
