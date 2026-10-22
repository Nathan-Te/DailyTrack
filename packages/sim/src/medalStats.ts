import { medalFor, type Medal, type Medals } from "./medals";

// Lot 35 — calibrage des médailles sur de vrais joueurs : statistiques d'une journée (ou d'un groupe de journées) à partir des meilleurs
// temps des joueurs, en lecture seule. Pur : sert la route d'admin `GET /api/admin/medailles` (cdj.ts), la page d'admin et la simulation
// de nouveaux facteurs sur les jours passés.

/** Percentiles donnés par l'outil de calibrage (en % des joueurs, du plus rapide au plus lent). */
export const MEDAL_PERCENTILES = [10, 25, 50, 75, 90] as const;
export type MedalPercentile = (typeof MEDAL_PERCENTILES)[number];

/** Les médailles, de la plus exigeante à la moins exigeante. */
export const MEDAL_ORDER: readonly Medal[] = ["author", "gold", "silver", "bronze"];

/**
 * Percentile `p` (0 à 100) d'une liste **triée** (croissante), au rang le plus proche : la plus petite valeur telle qu'au moins `p` % des
 * valeurs lui sont inférieures ou égales. `null` pour une liste vide.
 */
export function percentileOf(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1]!;
}

/** Part (0 à 1) des valeurs inférieures ou égales à `limit` dans une liste triée. */
function shareAtMost(sorted: readonly number[], limit: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= limit) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length === 0 ? 0 : lo / sorted.length;
}

/** Parts **cumulées** des joueurs : `gold` = part des joueurs qui ont au moins l'or (auteur compris). */
export type MedalShares = Record<Medal, number>;

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export interface MedalDayStats {
  players: number;
  /** Meilleurs temps (ms) aux percentiles `MEDAL_PERCENTILES` ; `null` sans joueur. */
  percentiles: Record<MedalPercentile, number | null>;
  /** Les mêmes, divisés par le temps du pilote (1,05 = 5 % plus lent que le pilote). */
  ratios: Record<MedalPercentile, number | null>;
  /** Parts cumulées des joueurs pour chaque médaille, avec les seuils donnés. */
  shares: MedalShares;
  /** Médaille exacte de chaque joueur (comptes, non cumulés) ; `none` : fini sans médaille. */
  counts: Record<Medal | "none", number>;
}

/** Statistiques d'une journée : les meilleurs temps de ses joueurs (un par joueur, ms), le temps du pilote et les seuils de ce jour. */
export function medalDayStats(times: readonly number[], pilotMs: number, medals: Medals): MedalDayStats {
  const sorted = [...times].sort((a, b) => a - b);
  const percentiles = {} as Record<MedalPercentile, number | null>;
  const ratios = {} as Record<MedalPercentile, number | null>;
  for (const p of MEDAL_PERCENTILES) {
    const v = percentileOf(sorted, p);
    percentiles[p] = v;
    ratios[p] = v === null ? null : round4(v / pilotMs);
  }
  const counts: Record<Medal | "none", number> = { author: 0, gold: 0, silver: 0, bronze: 0, none: 0 };
  for (const ms of sorted) counts[medalFor(ms, medals) ?? "none"]++;
  const shares = {} as MedalShares;
  for (const m of MEDAL_ORDER) shares[m] = round4(shareAtMost(sorted, medals[m]));
  return { players: sorted.length, percentiles, ratios, shares, counts };
}

/** Les temps d'une journée rapportés au temps du pilote (triés, arrondis à 1e-4) : ce que l'export garde pour simuler d'autres facteurs. */
export function ratiosOf(times: readonly number[], pilotMs: number): number[] {
  return times.map((ms) => round4(ms / pilotMs)).sort((a, b) => a - b);
}

/** Seuils exprimés en multiples du temps du pilote (`author` = 1 aujourd'hui). */
export type MedalRatios = Record<Medal, number>;

export interface MedalPoolStats {
  days: number;
  players: number;
  /** Percentiles des temps rapportés au pilote, tous joueurs des journées réunies. */
  ratios: Record<MedalPercentile, number | null>;
  /** Parts cumulées, tous joueurs réunis (chaque joueur compte une fois par journée). */
  shares: MedalShares;
  /** Parts cumulées journée par journée, en moyenne (chaque journée compte autant) ; `null` sans journée. */
  meanDayShares: MedalShares | null;
}

/**
 * Statistiques d'un groupe de journées (un thème, ou toutes) à partir des temps rapportés au pilote de chaque journée (`ratiosOf`) et de
 * seuils en multiples du pilote : sert à la fois à décrire les jours passés (seuils de chaque jour) et à **simuler** d'autres facteurs.
 */
export function medalPoolStats(days: readonly { ratios: readonly number[]; thresholds: MedalRatios }[]): MedalPoolStats {
  const all: number[] = [];
  const hits: MedalShares = { author: 0, gold: 0, silver: 0, bronze: 0 };
  const dayShares: MedalShares = { author: 0, gold: 0, silver: 0, bronze: 0 };
  let counted = 0;
  for (const d of days) {
    if (d.ratios.length === 0) continue;
    const sorted = [...d.ratios].sort((a, b) => a - b);
    all.push(...sorted);
    counted++;
    for (const m of MEDAL_ORDER) {
      const s = shareAtMost(sorted, d.thresholds[m]);
      hits[m] += Math.round(s * sorted.length);
      dayShares[m] += s;
    }
  }
  all.sort((a, b) => a - b);
  const ratios = {} as Record<MedalPercentile, number | null>;
  for (const p of MEDAL_PERCENTILES) ratios[p] = percentileOf(all, p);
  const shares = {} as MedalShares;
  const meanDayShares = {} as MedalShares;
  for (const m of MEDAL_ORDER) {
    shares[m] = all.length ? round4(hits[m] / all.length) : 0;
    meanDayShares[m] = counted ? round4(dayShares[m] / counted) : 0;
  }
  return { days: counted, players: all.length, ratios, shares, meanDayShares: counted ? meanDayShares : null };
}

/** Seuils d'une journée en multiples de son temps de pilote. */
export function thresholdsOf(medals: Medals, pilotMs: number): MedalRatios {
  return { author: medals.author / pilotMs, gold: medals.gold / pilotMs, silver: medals.silver / pilotMs, bronze: medals.bronze / pilotMs };
}
