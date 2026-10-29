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
 * Lot R11 : **la dernière version**, celle des jours que le registre (`jours-track.json`, `generatorVersionOf`, dailyId.ts) ne nomme pas : les jours à partir du jour de
 * bascule de la prochaine mise en production, et le Salon. **Changer le générateur = monter ce numéro, jamais écrire une date** : un jour déjà servi garde la version
 * que le registre note (écrit par « Mettre en production »), et l'ancienne version reste dans le code tant qu'un jour du registre s'en sert. Historique : 15 (jusqu'au
 * 27/10/2026), 16 (freinage possible après un boost, lot 34), 17 (herbe de course, lot 48), 18 (identité des thèmes, lot 49 ; la v17 n'a servi aucun jour), 19 (médailles assouplies du lot G1 de la plateforme : les circuits sont ceux de la v18, seuls leurs
 * seuils changent, `GENERATOR_MEDAILLES_G1` de medals.ts).
 */
export const GENERATOR_VERSION = 19;
