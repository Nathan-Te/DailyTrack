import { daysFromCivil } from "@cdj/core";

// Les dates du calendrier grégorien (jours entiers depuis le 01/01/1970, sans `Date`) vivent dans `@cdj/core` ; elles sont ré-exportées
// par `index.ts`, donc `daysFromCivil`, `civilFromDays`, `formatDay` et `parseDay` s'importent toujours de `@cdj/sim`.
// Reste ici ce qui est propre à DailyTrack : le premier jour et la numérotation.

/**
 * Premier jour : le circuit n° 1, **le 13/10/2026**, date de la mise en ligne (lot 28). Seule la numérotation en dépend : le circuit
 * d'un jour ne vient que de sa date (graine = date). Le serveur ne reçoit aucun temps avant ce jour (`unknown_day`).
 */
export const PREMIER_JOUR = daysFromCivil(2026, 10, 13);

/** Numéro du « Circuit du Jour » (n° 1 le premier jour ; ≤ 0 avant). */
export function circuitNumber(day: number): number {
  return day - PREMIER_JOUR + 1;
}
