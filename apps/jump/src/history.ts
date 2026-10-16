import { parseDay } from "@cdj/core";
import type { JumpMedal } from "@cdj/jump-sim";
import type { KeyValue } from "./memory";
import { storageKey } from "./storage";

// Historique persistant (lot 10), **logique pure** (le stockage arrive par l'interface `KeyValue`) : pour chaque niveau du jour joué, le
// meilleur temps (recalculé par le rejeu), sa médaille, les morts et les essais du jour. Il **survit à la purge du jour** de la mémoire
// (`memory.ts`, clés `jump:jour|meilleur|vies|morts:<niveau>`) : une seule clé, `jump:historique`, que rien d'autre ne balaie.
//
// Règles :
//   - seul le **niveau du jour**, joué **le jour même** (date de Paris), y entre ; une archive, un jour à venir, une lecture, une partie aux
//     réglages modifiés n'y entrent jamais (c'est `main.ts` qui en décide, par `mayRecord`) ;
//   - **la série** = le nombre de jours consécutifs avec au moins une arrivée sur le niveau du jour, jusqu'à aujourd'hui (ou jusqu'à hier si
//     aujourd'hui n'a pas encore d'arrivée : la série n'est pas perdue avant minuit) ;
//   - au plus `HISTORY_MAX` (400) entrées, les plus récentes ; lectures et écritures protégées : sans stockage, l'historique vit le temps de la
//     page.

export const HISTORY_KEY = storageKey("historique");
export const HISTORY_VERSION = 1;
export const HISTORY_MAX = 400;

const MEDALS: readonly JumpMedal[] = ["author", "gold", "silver", "bronze"];

/** Un jour joué. */
export interface DayRecord {
  /** Identifiant du niveau (`jour-AAAA-MM-JJ-g<N>`) : un changement de générateur garde une entrée par niveau. */
  id: string;
  /** AAAA-MM-JJ. */
  date: string;
  /** Meilleur temps (pas), null : pas encore d'arrivée. */
  best: number | null;
  /** Médaille de ce meilleur temps (gardée avec lui : un recalibrage des médailles ne change pas le passé). */
  medal: JumpMedal | null;
  deaths: number;
  attempts: number;
}

interface Stored {
  v: number;
  jours: DayRecord[];
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Une entrée lue du stockage est-elle bien formée ? (Un stockage peut contenir n'importe quoi.) */
export function isDayRecord(v: unknown): v is DayRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.date === "string" &&
    parseDay(r.date) !== null &&
    (r.best === null || (isCount(r.best) && r.best > 0)) &&
    (r.medal === null || MEDALS.includes(r.medal as JumpMedal)) &&
    isCount(r.deaths) &&
    isCount(r.attempts)
  );
}

/** Rangées par date puis identifiant, les `HISTORY_MAX` plus récentes. */
function tidy(list: readonly DayRecord[]): DayRecord[] {
  const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.slice(-HISTORY_MAX);
}

/** Lit l'historique (protégé : un stockage absent, qui lève ou illisible rend une liste vide ; une entrée mal formée est ignorée). */
export function readHistory(store: KeyValue | null): DayRecord[] {
  try {
    const raw = store?.getItem(HISTORY_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Partial<Stored>;
    if (s.v !== HISTORY_VERSION || !Array.isArray(s.jours)) return [];
    const seen = new Set<string>();
    const out: DayRecord[] = [];
    for (const r of s.jours) {
      if (!isDayRecord(r) || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, date: r.date, best: r.best, medal: r.medal, deaths: r.deaths, attempts: r.attempts });
    }
    return tidy(out);
  } catch {
    return [];
  }
}

/** L'historique d'une page : lu une fois, tenu en mémoire, réécrit à chaque changement (sans erreur si le stockage refuse). */
export class History {
  private list: DayRecord[];

  constructor(private readonly store: KeyValue | null) {
    this.list = readHistory(store);
  }

  get entries(): readonly DayRecord[] {
    return this.list;
  }

  /** Remplace (ou ajoute) l'entrée de ce niveau ; garde les 400 plus récentes ; rend vrai si le stockage l'a prise. */
  put(record: DayRecord): boolean {
    this.list = tidy([...this.list.filter((r) => r.id !== record.id), { ...record }]);
    try {
      this.store?.setItem(HISTORY_KEY, JSON.stringify({ v: HISTORY_VERSION, jours: this.list } satisfies Stored));
      return this.store !== null;
    } catch {
      return false; // quota, stockage refusé : l'historique vit le temps de la page
    }
  }

  /** Le jour `date` (AAAA-MM-JJ) : ses entrées réunies (un changement de générateur peut en laisser deux), null s'il n'a pas été joué. */
  forDate(date: string): DayRecord | null {
    return mergeDay(this.list.filter((r) => r.date === date));
  }

  /** La série au jour `today` (numéro de jour, date de Paris). */
  streak(today: number): number {
    return streakOf(this.list, today);
  }
}

/** Réunit les entrées d'un même jour : le meilleur temps (et sa médaille), les morts et les essais additionnés. */
export function mergeDay(list: readonly DayRecord[]): DayRecord | null {
  if (list.length === 0) return null;
  let best: DayRecord | null = null;
  for (const r of list) if (r.best !== null && (best === null || r.best < best.best!)) best = r;
  const last = list[list.length - 1]!;
  return {
    id: (best ?? last).id,
    date: last.date,
    best: best?.best ?? null,
    medal: best?.medal ?? null,
    deaths: list.reduce((n, r) => n + r.deaths, 0),
    attempts: list.reduce((n, r) => n + r.attempts, 0),
  };
}

/**
 * La série : jours consécutifs avec au moins une arrivée, finissant aujourd'hui, ou hier si aujourd'hui n'a pas encore d'arrivée (on a
 * jusqu'à minuit, heure de Paris, pour la prolonger). 0 si ni aujourd'hui ni hier.
 */
export function streakOf(list: readonly DayRecord[], today: number): number {
  const done = new Set<number>();
  for (const r of list) {
    const d = parseDay(r.date);
    if (r.best !== null && d !== null) done.add(d);
  }
  let day = done.has(today) ? today : today - 1;
  let n = 0;
  while (done.has(day)) {
    n++;
    day--;
  }
  return n;
}

/** Le niveau ouvert peut-il entrer dans l'historique ? Le niveau du jour seulement (jamais un essai de thème forcé, lot 11), joué le jour même, ni lecture ni réglages modifiés. */
export function mayRecord(o: { mode: "jour" | "archive" | "futur" | "essai"; levelDay: number; today: number; watching: boolean; tuned: boolean }): boolean {
  return o.mode === "jour" && o.levelDay === o.today && !o.watching && !o.tuned;
}
