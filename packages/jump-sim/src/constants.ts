/** Fréquence de simulation, en pas par seconde (pas fixe : jamais de `dt` variable). */
export const TICK_RATE = 120;

/**
 * Version de la simulation du saut. À incrémenter dès que la physique, un élément de niveau ou un niveau d'essai change le résultat d'un essai
 * (même règle que `SIM_VERSION` de DailyTrack) : les rediffusions d'une autre version ne sont plus rejouables.
 */
export const JUMP_SIM_VERSION = 3;

/**
 * Version du générateur de niveaux du jour. À incrémenter dès que le niveau d'une date change (morceaux, assemblage, règles, solveur) :
 * même règle que `GENERATOR_VERSION` de DailyTrack.
 */
export const JUMP_GENERATOR_VERSION = 1;

/** Unités entières par tuile : 16 px × 256 sous-pixels. Tout l'état de la simulation (positions, vitesses par tick) est en unités. */
export const UNITS_PER_TILE = 4096;
