// « Rush » (lots BR0, BR0b, BR0c, BR1 et BR1b) — un chevalier, des gelées, des chauves-souris et un golem. Tout est entier, à pas fixe de 60 Hz. Le prototype répond à trois questions (le combat, la direction artistique, le rejeu) :
// aucune règle ici n'est définitive. Les unités : 1 mètre = 4 096 unités (comme les tuiles de Jump), le temps en ticks, les vitesses en unités par tick.

/** La version de la simulation (les règles de la partie). Elle monte à tout changement qui change une partie rejouée. */
export const RUSH_SIM_VERSION = 5;
/** La version du générateur du contenu du jour. Elle monte à tout changement de ce que `dailyRush` produit. */
export const RUSH_GENERATOR_VERSION = 3;

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

// Les entrées d'un tick (lot BR0b : deux octets) : l'octet bas porte la direction du DÉPLACEMENT (0 = aucune, 1 à 32 = les 32 directions de la croix), le coup (bit 6) et l'esquive (bit 7) ; l'octet haut
// porte la VISÉE, séparée du déplacement (0 = pas de visée, 1 à 32 = les 32 directions : le chevalier regarde et frappe de ce côté). Sans visée (doigt, manette sans stick droit), le chevalier regarde où il va
// et la visée est assistée (vers l'ennemi proche).
export const BIT_COUP = 64;
export const BIT_ESQUIVE = 128;
export const MASQUE_DIRECTION = 63;
export const NB_DIRECTIONS_ENTREE = 32;
/** La visée occupe l'octet haut : `e >> DECALAGE_VISEE` (0 à 63, 0 = aucune). */
export const DECALAGE_VISEE = 8;
export const MASQUE_VISEE = 63;

// La rediffusion : la suite des changements d'entrée (au plus MAX_CHANGEMENTS, 4 octets au plus chacun : l'écart en ticks, l'octet bas, l'octet haut). Le jeu ne change pas de direction plus d'une fois tous les 3 ticks
// (20 Hz), ni de visée plus d'une fois tous les 4 ticks (15 Hz) pour rester sous ces plafonds.
export const MAX_CHANGEMENTS = 8000;
export const MAX_CARACTERES = 40000;
export const PAS_MIN_DIRECTION = 3;
export const PAS_MIN_VISEE = 4;

/** Le nombre de cœurs du chevalier. */
export const COEURS = 3;
/** Au plus autant de monstres vivants à la fois (le coût d'un tick reste borné). */
export const MAX_MONSTRES = 40;
/** Les vagues de l'arène d'essai (`?scenario=arene`, sans `&monstres=`) : au plus autant de monstres en même temps, puis une pause avant la suivante. `&monstres=N` garde N monstres en vie (le test de charge). */
export const MAX_MONSTRES_VAGUE = 8;

/** Les contenus qu'une partie peut jouer : `jour` (le contenu du jour) et les scénarios d'essai (jamais classés). `vitrine` est une scène figée (lot BR0b) qui sert à comparer le rendu à `docs/rush/maquettes/cible-ia.png` ; `mannequin` (lot BR0c) : six gelées immobiles qui ne meurent pas et un golem qui ne frappe pas, pour juger le coup. */
export type Scenario = "jour" | "arene" | "boss" | "vitrine" | "mannequin";
export const SCENARIOS: readonly Scenario[] = ["jour", "arene", "boss", "vitrine", "mannequin"];
