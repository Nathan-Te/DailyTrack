/** Fréquence de simulation, en pas par seconde. */
export const TICK_RATE = 120;

/** Durée d'un pas de simulation, en secondes. */
export const DT = 1 / TICK_RATE;

/** Convertit un nombre de pas en millisecondes entières (le chrono est exact, sans flottants cumulés). */
export function ticksToMs(ticks: number): number {
  return Math.round((ticks * 1000) / TICK_RATE);
}
