import { formatDay, parseDay, type Medal } from "@cdj/sim";

// Profil du joueur (lot 29) : ce qu'on peut dire de lui sans serveur, à partir de ses records gardés dans le navigateur — jours joués,
// médailles, série de jours, meilleure place. Logique pure (stockage injecté), testée par Vitest.

/** Un jour joué : son meilleur temps, sa médaille. */
export interface PlayedDay {
  date: string;
  ms: number;
  medal: Medal | null;
}

/** Place vue au classement d'un jour : gardée à part (`cdj:rank:AAAA-MM-JJ`), car le serveur ne sait pas la redonner pour tous les jours. */
export interface RankMark {
  rank: number;
  participants: number;
}

export interface ProfileStats {
  /** Jours joués. */
  days: number;
  /** Médailles gagnées : pour chaque jour, la meilleure médaille obtenue ce jour-là. */
  medals: Record<Medal, number>;
  /** Meilleure place vue (au classement d'un jour). */
  bestRank: (RankMark & { date: string }) | null;
  /** Jours consécutifs jusqu'à aujourd'hui (ou jusqu'à hier si aujourd'hui n'est pas encore joué). */
  streak: number;
}

type ReadStorage = Pick<Storage, "length" | "key" | "getItem">;
type WriteStorage = ReadStorage & Pick<Storage, "setItem" | "removeItem">;

export const RANK_PREFIX = "cdj:rank:";
const BEST = /^cdj:best:jour-(\d{4}-\d{2}-\d{2})-g\d+/;
const MEDAL_ORDER: Record<Medal, number> = { author: 4, gold: 3, silver: 2, bronze: 1 };
const isMedal = (m: unknown): m is Medal => m === "author" || m === "gold" || m === "silver" || m === "bronze";

/**
 * Tous les jours joués dans ce navigateur, **quelle que soit la version du générateur** : un record d'une ancienne version ne sert plus
 * de fantôme (voir `records.ts`), mais le jour a bien été joué et sa médaille bien gagnée. Un jour joué sous deux versions garde la
 * meilleure médaille (à égalité, le meilleur temps).
 */
export function listPlayedDays(storage: ReadStorage = localStorage): PlayedDay[] {
  const out = new Map<string, PlayedDay>();
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return [];
  }
  for (let i = 0; i < count; i++) {
    try {
      const key = storage.key(i) ?? "";
      const m = BEST.exec(key);
      if (!m) continue;
      const r = JSON.parse(storage.getItem(key) ?? "null") as { ms?: unknown; medal?: unknown } | null;
      if (!r || typeof r.ms !== "number" || !Number.isFinite(r.ms) || r.ms <= 0) continue;
      const day: PlayedDay = { date: m[1]!, ms: r.ms, medal: isMedal(r.medal) ? r.medal : null };
      const old = out.get(day.date);
      if (!old || betterDay(day, old)) out.set(day.date, day);
    } catch {
      /* une entrée illisible ne doit pas masquer les autres */
    }
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function betterDay(a: PlayedDay, b: PlayedDay): boolean {
  const ma = a.medal ? MEDAL_ORDER[a.medal] : 0;
  const mb = b.medal ? MEDAL_ORDER[b.medal] : 0;
  return ma !== mb ? ma > mb : a.ms < b.ms;
}

/** Les mêmes jours, depuis les records d'un code de transfert (aperçu du profil trouvé avant de le charger). */
export function playedFromRecords(best: Record<string, { ms: number; medal?: string | null }>): PlayedDay[] {
  const out = new Map<string, PlayedDay>();
  for (const [trackId, r] of Object.entries(best)) {
    const m = BEST.exec(`cdj:best:${trackId}`);
    if (!m || typeof r.ms !== "number" || r.ms <= 0) continue;
    const day: PlayedDay = { date: m[1]!, ms: r.ms, medal: isMedal(r.medal) ? r.medal : null };
    const old = out.get(day.date);
    if (!old || betterDay(day, old)) out.set(day.date, day);
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Places gardées (`cdj:rank:*`). */
export function loadRanks(storage: ReadStorage = localStorage): Map<string, RankMark> {
  const out = new Map<string, RankMark>();
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return out;
  }
  for (let i = 0; i < count; i++) {
    try {
      const key = storage.key(i) ?? "";
      if (!key.startsWith(RANK_PREFIX)) continue;
      const date = key.slice(RANK_PREFIX.length);
      const mark = parseRank(storage.getItem(key));
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && mark) out.set(date, mark);
    } catch {
      /* ignorée */
    }
  }
  return out;
}

export function parseRank(raw: unknown): RankMark | null {
  try {
    const o = (typeof raw === "string" ? JSON.parse(raw) : raw) as { rank?: unknown; participants?: unknown } | null;
    if (!o || !Number.isInteger(o.rank) || !Number.isInteger(o.participants)) return null;
    const rank = o.rank as number;
    const participants = o.participants as number;
    return rank >= 1 && rank <= 1_000_000 && participants >= rank && participants <= 1_000_000 ? { rank, participants } : null;
  } catch {
    return null;
  }
}

/** Retient la place vue ce jour-là (la dernière vue : elle bouge tant que le jour n'est pas fini). */
export function rememberRank(date: string, mark: RankMark, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseRank(mark)) return;
  try {
    storage?.setItem(RANK_PREFIX + date, JSON.stringify({ rank: mark.rank, participants: mark.participants }));
  } catch {
    /* stockage indisponible : tant pis */
  }
}

function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Efface les places gardées (code de transfert chargé : celles de l'ancienne identité ne sont plus les tiennes). */
export function clearRanks(storage: WriteStorage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(RANK_PREFIX)) keys.push(k);
  }
  for (const k of keys) storage.removeItem(k);
}

/**
 * Série de jours consécutifs : en comptant à rebours depuis aujourd'hui (si aujourd'hui est joué) ou depuis hier (sinon : la série
 * n'est pas perdue tant que la journée n'est pas finie). Zéro si ni aujourd'hui ni hier n'ont été joués.
 */
export function streakOf(dates: readonly string[], today: string): number {
  const played = new Set(dates);
  const t = parseDay(today);
  if (t === null) return 0;
  let day = played.has(today) ? t : t - 1;
  let n = 0;
  while (played.has(formatDay(day))) {
    n++;
    day--;
  }
  return n;
}

export function profileStats(days: readonly PlayedDay[], ranks: ReadonlyMap<string, RankMark>, today: string): ProfileStats {
  const medals: Record<Medal, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
  for (const d of days) if (d.medal) medals[d.medal]++;
  let bestRank: ProfileStats["bestRank"] = null;
  for (const [date, mark] of ranks) {
    if (!bestRank || mark.rank < bestRank.rank || (mark.rank === bestRank.rank && mark.participants > bestRank.participants)) bestRank = { ...mark, date };
  }
  return { days: days.length, medals, bestRank, streak: streakOf(days.map((d) => d.date), today) };
}

// --- Dates en français -------------------------------------------------------------------------------------------------

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-10-13 » → « 13 oct. » (la date elle-même si elle est illisible). */
export function dayShort(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = m ? Number(m[2]) : 0;
  return m && month >= 1 && month <= 12 ? `${Number(m[3])} ${MONTHS_SHORT[month - 1]}` : date;
}

/** « 2026-10-13 » → « 13 octobre 2026 ». */
export function dayLong(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = m ? Number(m[2]) : 0;
  return m && month >= 1 && month <= 12 ? `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}` : date;
}

// --- Pseudos ---------------------------------------------------------------------------------------------------------------

/**
 * Deux joueurs au même pseudo se distinguent par un court suffixe : le premier (par ordre d'affichage) garde son nom, les suivants
 * deviennent « Nom·2 », « Nom·3 »… Le même classement montre les mêmes suffixes à tout le monde. (Les pseudos réservés du lot 30
 * rendront ce suffixe inutile, sauf pour les comptes déjà existants.)
 */
export function disambiguateNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLocaleLowerCase("fr");
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? name : `${name}·${n}`;
  });
}
