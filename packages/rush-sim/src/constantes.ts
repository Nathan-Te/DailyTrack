// « Rush » (lot BR0, prototype) — un chevalier, des gelées, des chauves-souris et un golem. Tout est entier, à pas fixe de 60 Hz. Le prototype répond à trois questions (le combat, la direction artistique, le rejeu) :
// aucune règle ici n'est définitive. Les unités : 1 mètre = 4 096 unités (comme les tuiles de Jump), le temps en ticks, les vitesses en unités par tick.

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée. */
export const RUSH_SIM_VERSION = 1;
/** La version du générateur du contenu du jour. Elle monte à tout changement de ce que `dailyRush` produit. */
export const RUSH_GENERATOR_VERSION = 1;

export const TICKS_PAR_SECONDE = 60;
/** Une partie dure au plus 10 minutes ; au-delà elle est perdue (le pire temps). */
export const DUREE_TICKS = 36000;

/** 1 mètre en unités. */
export const M = 4096;
/** Des centimètres en unités (les constantes se lisent en centimètres ; la division est exacte à un tick près et n'est faite qu'au chargement). */
export const cm = (n: number): number => Math.trunc((n * M) / 100);

/** Le rayon de l'arène (un disque), en unités. */
export const RAYON_ARENE = cm(1150);

// Les corps (rayons de collision).
export const RAYON_CHEVALIER = cm(42);
export const RAYON_GELEE = cm(48);
export const RAYON_CHAUVE = cm(36);
export const RAYON_GOLEM = cm(170);

// Les entrées d'un tick tiennent dans un octet : la direction (0 = aucune, 1 à 32 = les 32 directions de la croix), le coup (bit 6) et l'esquive (bit 7).
export const BIT_COUP = 64;
export const BIT_ESQUIVE = 128;
export const MASQUE_DIRECTION = 63;
export const NB_DIRECTIONS_ENTREE = 32;

// La rediffusion : la suite des changements d'entrée (au plus MAX_CHANGEMENTS, 3 octets chacun en moyenne). Le jeu ne change pas de direction plus d'une fois tous les 3 ticks (20 Hz) pour rester sous ce plafond.
export const MAX_CHANGEMENTS = 8000;
export const MAX_CARACTERES = 40000;
export const PAS_MIN_DIRECTION = 3;

/** Le nombre de cœurs du chevalier. */
export const COEURS = 3;
/** Au plus autant de monstres vivants à la fois (le coût d'un tick reste borné). */
export const MAX_MONSTRES = 40;

/** Les contenus qu'une partie peut jouer : `jour` (le contenu du jour) et les scénarios d'essai (jamais classés). */
export type Scenario = "jour" | "arene" | "boss";
export const SCENARIOS: readonly Scenario[] = ["jour", "arene", "boss"];
