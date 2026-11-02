/**
 * Les dates des niveaux figés, écrites dans le premier chargement à la construction (`vite.config.ts`, seul lecteur de ce module ; le jeu les déplie dans `frozen.ts`, `deplier`), **en plages de jours consécutifs** `[du, au]` : chaque mise en
 * production fige quelques jours de plus, et une liste de dates grossissait le premier chargement d'environ 3 o par jour (mesuré le 02/11/2026 : 15 o pour cinq jours,
 * de quoi faire sauter le plafond de `e2e/poids.spec.ts` à chaque PR « Jours figés »). En plages, la taille ne dépend que du nombre de trous, pas du nombre de jours.
 */
export type PlagesJours = readonly (readonly [string, string])[];

// Sans `@cdj/core` : `vite.config.ts` importe ce module à la construction (le chargeur de la configuration ne lit pas les imports sans extension du socle).
const parseDay = (date: string): number | null => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 864e5 : null);
const formatDay = (jour: number): string => new Date(jour * 864e5).toISOString().slice(0, 10);

/** Dates triées AAAA-MM-JJ → plages de jours consécutifs. */
export function enPlages(dates: readonly string[]): [string, string][] {
  const plages: [string, string][] = [];
  let debut: number | null = null;
  let fin = 0;
  for (const date of [...dates].sort()) {
    const jour = parseDay(date);
    if (jour === null) continue;
    if (debut !== null && jour === fin + 1) {
      fin = jour;
      continue;
    }
    if (debut !== null) plages.push([formatDay(debut), formatDay(fin)]);
    debut = fin = jour;
  }
  if (debut !== null) plages.push([formatDay(debut), formatDay(fin)]);
  return plages;
}
