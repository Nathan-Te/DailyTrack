/** Fréquence de simulation, en pas par seconde. */
export const TICK_RATE = 120;

/** Durée d'un pas de simulation, en secondes. */
export const DT = 1 / TICK_RATE;

/** Convertit un nombre de pas en millisecondes entières (le chrono est exact, sans flottants cumulés). */
export function ticksToMs(ticks: number): number {
  return Math.round((ticks * 1000) / TICK_RATE);
}

/**
 * Version de la simulation. À incrémenter dès que la physique, un bloc ou le circuit d'essai change le
 * résultat d'une course : les rediffusions enregistrées avec une autre version ne sont plus rejouables
 * (le fantôme est alors ignoré, et le serveur les refuse).
 */
export const SIM_VERSION = 1;
