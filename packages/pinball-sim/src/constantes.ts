// « Pinball » (lot PB1) — la simulation d'un flipper : une table par jour, trois billes, tout est ENTIER. Les chiffres de la maquette (`docs/pinball/maquettes/pinball-maquette-jouable.html`, en flottants, 10 pas par image de
// 1/60 s) sont portés tels quels ; ce fichier ne garde que ce qui ne se règle jamais à la main. Les constantes de SENSATION (pente, rebonds, force des batteurs et du lanceur) sont dans `reglages.ts`, en un seul objet.

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée (une règle, un réglage par défaut, la géométrie). */
export const PINBALL_SIM_VERSION = 6;
/** La version du générateur de la table du jour. Elle monte à tout changement de ce que `dailyPinball` produit. Jamais une date. */
export const PINBALL_GENERATOR_VERSION = 6;
/** La version du calcul des seuils des médailles : le robot du lot PB4 (version 1 : les seuils provisoires du PB1, les mêmes tous les jours). Elle monte à tout changement du robot, de ses constantes ou des pourcentages (`seuils.ts`). */
export const PINBALL_BOT_VERSION = 5;

/** Le pas : 600 par seconde (celui de la maquette). La bille va à 1 500 px/s au plus, soit 2,5 px par pas, pour un rayon de 9 px : elle ne saute jamais un mur (`test/traversee.test.ts`). */
export const TICKS_PAR_SECONDE = 600;
/** Une partie dure au plus 15 minutes (mesuré : voir le README du lot PB1). */
export const DUREE_MAX_TICKS = 15 * 60 * TICKS_PAR_SECONDE;
/** Au plus 12 000 changements d'état des commandes (appui ou relâchement) par partie : ≈ 13 par seconde en moyenne sur 15 minutes (un joueur très nerveux en fait 8). */
export const MAX_EVENEMENTS = 12000;

/** Point fixe : **1 pixel de la table = 4 096 unités** (2^12). Positions en unités ; vitesses en unités par seconde ; un pas déplace `vitesse / 600` tronqué vers zéro. */
export const UNITE = 4096;
/** L'échelle d'un vecteur unitaire (cosinus, sinus, normale) : 2^14. */
export const NORME = 16384;
/** Un tour complet de la table des angles : 2^14 angles ; l'angle droit est `QUART`. */
export const TOUR = 16384;
export const QUART = 4096;

/** La table (pixels de la maquette). */
export const LARGEUR = 375;
export const HAUTEUR = 760;
export const AXE = 184;
/** Le rayon de la bille. */
export const RAYON = 9;
/** Où la bille attend dans le couloir du lanceur (demi-pixels : 360,5), et sa hauteur. */
export const LANCE_X2 = 721;
export const LANCE_Y = 700;
/** La bille est perdue quand elle passe sous le bas de la table de 20 px. */
export const PERDUE_Y = HAUTEUR + 20;

export const NB_BILLES = 3;
/** Lot PBG2 : le nombre de billes à verrouiller pour que la multibille parte (la deuxième la lance : trois billes en jeu avec celle du lanceur). */
export const VERROU_BILLES = 2;
export const MULT_MAX = 6;
export const NB_VOIES = 3;
/** Les bits des événements du pas (`Partie.ev`), pour le rendu et les essais. */
export const EV_BUMPER = 1;
export const EV_SLING = 2;
export const EV_CIBLE = 4;
export const EV_BANQUE = 8;
export const EV_SPINNER = 16;
export const EV_VOIE = 32;
export const EV_MULT = 64;
export const EV_TROU = 128;
export const EV_LANCE = 256;
export const EV_PERDUE = 512;
export const EV_SAUVEE = 1024;
export const EV_FIN = 2048;
/** Lot PB3 : les éléments des thèmes et la mission. */
export const EV_MANEGE = 4096;
export const EV_TOURBILLON = 8192;
export const EV_PORTAIL = 16384;
export const EV_GEYSER = 32768;
export const EV_COULEE = 65536;
export const EV_MISSION = 131072;
/** Lot PBG1 : une rampe ou l'orbite menée à son bout, et un combo qui monte (au moins deux de suite). */
export const EV_RAMPE = 262144;
export const EV_ORBITE = 524288;
export const EV_COMBO = 1048576;
/** Lot PBG1 : la bille quitte le plateau pour un rail (elle y entre assez vite) / elle en retombe par son entrée (trop lente). */
export const EV_RAIL = 2097152;
export const EV_RECUL = 4194304;
/** Lot PBG2 : le verrou s'allume (la mission est réussie), une bille y est verrouillée, la multibille part, un jackpot est pris, la multibille finit, la mission du niveau suivant revient. */
export const EV_VERROU_ALLUME = 8388608;
export const EV_VERROUILLEE = 16777216;
export const EV_MULTI = 33554432;
export const EV_JACKPOT = 67108864;
export const EV_MULTI_FIN = 134217728;
export const EV_NIVEAU = 268435456;

/**
 * Lot PBG3 : les événements de la porte, du poteau sauveur et de l'aiguillage sont dans **un second mot** (`Partie.ev2`) : les 29 bits de `ev` sont presque pris (un entier de 32 bits). La porte qui s'ouvre, le passage, la
 * porte qui se ferme, une lampe de couloir qui s'allume, le poteau qui s'arme, le poteau qui renvoie la bille, la bille dérivée par l'aiguillage.
 */
export const EV2_PORTE_OUVRE = 1;
export const EV2_PORTE_PASSAGE = 2;
export const EV2_PORTE_FERME = 4;
export const EV2_LAMPE = 8;
export const EV2_SAUVEUR_ARME = 16;
export const EV2_SAUVEUR = 32;
export const EV2_AIGUILLAGE = 64;

/** Lot PBG3 : le poteau sauveur sort au milieu des batteurs : son centre (px), son rayon, le couloir de retour où se pose chaque lampe (le centre du couloir et la ligne qu'elle surveille). */
export const SAUVEUR_X = 184;
export const SAUVEUR_Y = 668;
export const SAUVEUR_R = 8;
export const LAMPE_Y = 505;
export const LAMPE_DEMI = 11;
export const LAMPE_X = 31;

/** Les points de la maquette et du seed (lot PB3 : les éléments des thèmes et la mission). */
export const POINTS = { sling: 10, spinner: 50, bumper: 100, voie: 100, cible: 250, trouVoies: 1000, trou: 1500, banque: 2000, manege: 500, coulee: 300, geyser: 750, portail: 800, tourbillon: 2000, mission: 10000 } as const;

export type Controle = 0 | 1 | 2;
/** Les trois commandes : le batteur gauche, le batteur droit, le lanceur. */
export const GAUCHE = 0;
export const DROITE = 1;
export const LANCEUR = 2;
