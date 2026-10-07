import { MAX_VARIANT, PREMIER_JOUR, isVariant, themeForDay, type ThemeName } from "@cdj/sim";
import { PLAN_HORIZON, type PlanEntry } from "./planning";

// Logique pure du panneau d'admin (lot 14) : dates du planning, variantes proposées, histogramme, règles de remplacement.
// Le DOM est dans `admin.ts`.

/** Nombre de jours de planning montrés (les 14 prochains). */
export const PLANNING_DAYS = 14;
/** Variantes proposées par page quand on remplace un circuit. */
export const CANDIDATES = 5;

/** Les jours à venir montrés : demain, après-demain… (`n` jours). */
export function planningDays(today: number, n = PLANNING_DAYS): number[] {
  return Array.from({ length: n }, (_, i) => today + 1 + i);
}

/** « J+1 » ; « demain » pour le premier. */
export function relativeLabel(day: number, today: number): string {
  const d = day - today;
  return d === 1 ? "demain" : d > 1 ? `J+${d}` : d === 0 ? "aujourd'hui" : `J${d}`;
}

/**
 * Numéros de variante proposés à la page `page` (0, 1, …) : 1 à 5, puis 6 à 10… ; la variante en vigueur est sautée
 * (on propose autre chose). Jamais au-delà de `MAX_VARIANT`.
 */
export function candidateVariants(page: number, current: number, count = CANDIDATES): number[] {
  const out: number[] = [];
  for (let n = 1 + Math.max(0, page) * count; out.length < count && n <= MAX_VARIANT; n++) if (n !== current) out.push(n);
  return out;
}

/** Y a-t-il une page suivante de variantes ? */
export const hasMoreCandidates = (page: number, count = CANDIDATES): boolean => 1 + (page + 1) * count <= MAX_VARIANT;

/** Le thème à envoyer : `null` si c'est celui de la date (il n'est alors pas « imposé »). */
export function imposedTheme(day: number, theme: ThemeName | null): ThemeName | null {
  return theme === null || theme === themeForDay(day).name ? null : theme;
}

/** Règle de remplacement (la même côté serveur) : seulement un jour à venir, dans l'horizon. Renvoie le message d'erreur ou `null`. */
export function replaceProblem(today: number, day: number, entry: PlanEntry): string | null {
  if (day <= today) return "Ce jour a déjà commencé : son circuit est figé";
  if (day > today + PLAN_HORIZON) return `Pas plus de ${PLAN_HORIZON} jours à l'avance`;
  if (day < PREMIER_JOUR) return "Avant le lancement";
  if (!isVariant(entry.variant)) return `Variante attendue : un entier de 0 à ${MAX_VARIANT}`;
  return null;
}

export interface Histogram {
  /** Bornes (ms) de chaque case : `edges.length = counts.length + 1`. */
  edges: number[];
  counts: number[];
}

/** Répartition des temps en `bins` cases égales, de la plus rapide à la plus lente (vide : aucune case). */
export function histogram(times: readonly number[], bins = 12): Histogram {
  if (times.length === 0 || bins < 1) return { edges: [], counts: [] };
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (min === max) return { edges: [min, min + 1], counts: [times.length] };
  const width = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const t of times) counts[Math.min(bins - 1, Math.floor((t - min) / width))]!++;
  return { edges: Array.from({ length: bins + 1 }, (_, i) => Math.round(min + i * width)), counts };
}

