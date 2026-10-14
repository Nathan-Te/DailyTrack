import { civilFromDays, daysFromCivil } from "@cdj/sim";

// Horloge du jeu (lot 31) : « aujourd'hui » est la **date à Paris** (Europe/Paris, heure d'été comprise), la même pour tout le monde au
// même instant, où que soit le joueur. Une seule définition, utilisée par le jeu, l'API et l'admin ; `packages/sim` ne la connaît pas
// (il reçoit toujours une date : pas de `Date`, pas d'`Intl` dans la simulation). Les circuits de chaque date ne changent pas : seul l'instant
// où « aujourd'hui » passe au jour suivant dépend de ce module.

export const PARIS_TZ = "Europe/Paris";
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Dernier dimanche du mois (numéro de jour). */
function lastSunday(year: number, month: number): number {
  const last = daysFromCivil(year, month, 31);
  const weekday = (((last + 4) % 7) + 7) % 7; // 1970-01-01 était un jeudi ; 0 = dimanche
  return last - weekday;
}

/**
 * Décalage de Paris par rapport à UTC à l'instant `ms`, d'après la règle de l'Union européenne : heure d'été (UTC+2) du dernier dimanche
 * de mars à 01 h UTC au dernier dimanche d'octobre à 01 h UTC, heure d'hiver (UTC+1) le reste de l'année. Sert de repli si l'environnement
 * n'a pas les fuseaux horaires, et de contrôle du résultat d'`Intl`.
 */
export function parisOffsetByRule(ms: number): number {
  const year = civilFromDays(Math.floor(ms / DAY_MS)).y;
  const start = lastSunday(year, 3) * DAY_MS + HOUR_MS;
  const end = lastSunday(year, 10) * DAY_MS + HOUR_MS;
  return ms >= start && ms < end ? 2 * HOUR_MS : HOUR_MS;
}

/** Numéro de jour (jours depuis 1970) de la date à Paris à l'instant `ms`, par la règle d'heure d'été. */
export function parisDayByRule(ms: number): number {
  return Math.floor((ms + parisOffsetByRule(ms)) / DAY_MS);
}

let formatter: Intl.DateTimeFormat | null | undefined;
function intlFormatter(): Intl.DateTimeFormat | null {
  if (formatter !== undefined) return formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: PARIS_TZ, year: "numeric", month: "numeric", day: "numeric" });
  } catch {
    formatter = null; // pas de données de fuseaux dans cet environnement
  }
  return formatter;
}

/** Numéro de jour de la date à Paris, lue par `Intl` ; `null` si l'environnement ne sait pas le faire. */
export function parisDayByIntl(ms: number): number | null {
  const f = intlFormatter();
  if (!f) return null;
  try {
    let y = 0;
    let m = 0;
    let d = 0;
    for (const p of f.formatToParts(ms)) {
      if (p.type === "year") y = Number(p.value);
      else if (p.type === "month") m = Number(p.value);
      else if (p.type === "day") d = Number(p.value);
    }
    return y > 0 && m > 0 && d > 0 ? daysFromCivil(y, m, d) : null;
  } catch {
    return null;
  }
}

/** Instants de contrôle : été, hiver, et de part et d'autre des deux changements d'heure de 2026. */
const PROBES = [
  Date.UTC(2026, 0, 15, 12),
  Date.UTC(2026, 6, 15, 12),
  Date.UTC(2026, 2, 28, 23, 30),
  Date.UTC(2026, 2, 29, 0, 30),
  Date.UTC(2026, 2, 29, 1, 30),
  Date.UTC(2026, 9, 24, 22, 30),
  Date.UTC(2026, 9, 24, 23, 30),
  Date.UTC(2026, 9, 25, 22, 30),
  Date.UTC(2026, 9, 25, 23, 30),
];

/** `Intl` n'est utilisé que s'il donne les mêmes dates que la règle sur les instants de contrôle ; sinon, la règle. */
export const parisClockSource: "intl" | "table" = PROBES.every((t) => parisDayByIntl(t) === parisDayByRule(t)) ? "intl" : "table";

/** **La date du jour** : numéro de jour (jours depuis 1970, comme `parseDay` / `formatDay`) de la date à Paris à l'instant `ms`. */
export function parisDay(ms: number): number {
  if (parisClockSource === "intl") {
    const d = parisDayByIntl(ms);
    if (d !== null) return d;
  }
  return parisDayByRule(ms);
}

/**
 * Instant (ms UTC) où commence le jour `day` à Paris, c'est-à-dire minuit de Paris. Le jour du passage à l'heure d'été dure 23 h, celui du
 * retour à l'heure d'hiver 25 h : on cherche l'instant, on ne suppose pas 24 h.
 */
export function parisDayStart(day: number): number {
  const base = day * DAY_MS;
  for (const offset of [2 * HOUR_MS, HOUR_MS]) {
    const t = base - offset;
    if (parisDayByRule(t) === day && parisDayByRule(t - 1) === day - 1) return t;
  }
  return base - HOUR_MS; // inatteignable : minuit existe toujours à Paris
}

/** Durée jusqu'au prochain minuit de Paris (ms, > 0). */
export function msUntilNextParisDay(ms: number): number {
  return parisDayStart(parisDay(ms) + 1) - ms;
}
