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
 * Lot 48 : **une surface nouvelle qu'aucun ancien circuit n'utilise** (l'herbe de course, `S/z`) **ne la change pas** — elle ne touche le
 * résultat d'aucune course enregistrée, et l'incrémenter rendrait injouables toutes les rediffusions gardées (classements, « revoir le
 * meilleur tour »). Un ancien paramètre changé, lui, l'incrémente toujours.
 */
export const SIM_VERSION = 14;

/**
 * Version du générateur de circuits du jour. À incrémenter dès que le circuit d'une date change
 * (règles de construction, pilote de validation, fenêtre de durée) : elle fait partie de l'identifiant du circuit,
 * donc les records et rediffusions d'un autre générateur ne se mélangent pas.
 * Lot 34 : **la dernière version**, celle des jours à partir de la bascule (`BASCULE_LOT_34`) et du Salon ; un jour garde la version
 * de son générateur (`generatorVersionOf`, dailyId.ts) : 15 avant le 28/10/2026, 16 ensuite (freinage possible après un boost), 17 à partir
 * du 04/11/2026 (lot 48 : l'herbe de course de la Campagne, `BASCULE_LOT_48`).
 */
export const GENERATOR_VERSION = 17;
