import { parseDay } from "@cdj/sim";
import { fDate, fDateCourte } from "./i18n";

// Dates « AAAA-MM-JJ » écrites dans la langue du jeu (lot I4), avec les formats du socle (`@cdj/ui`) : plus de mois écrits à la main. Séparé de profile.ts,
// qui reste pur (stockage injecté) et que le projet de test de navigateur (e2e) compile sans l'interface.

/** « 2026-10-13 » → « mar. 13 oct. » / « Tue, Oct 13 » (la date elle-même si elle est illisible). */
export function dayShort(date: string): string {
  const day = parseDay(date);
  return day === null ? date : fDateCourte(day);
}

/** « 2026-10-13 » → « mardi 13 octobre » / « Tuesday, October 13 ». */
export function dayLong(date: string): string {
  const day = parseDay(date);
  return day === null ? date : fDate(day);
}
