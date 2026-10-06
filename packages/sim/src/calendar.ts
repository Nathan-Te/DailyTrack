// Dates du calendrier grégorien en jours entiers depuis le 01/01/1970, sans `Date` (la simulation est pure).
// Algorithmes « days_from_civil » / « civil_from_days » de Howard Hinnant.

export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(days: number): { y: number; m: number; d: number } {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const pad = (n: number, width: number) => {
  let s = String(n);
  while (s.length < width) s = "0" + s;
  return s;
};

/** « AAAA-MM-JJ » d'un numéro de jour. */
export function formatDay(day: number): string {
  const { y, m, d } = civilFromDays(day);
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** Numéro de jour d'une date « AAAA-MM-JJ » (UTC), ou `null` si le texte n'est pas une date valide. */
export function parseDay(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const day = daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3]));
  return formatDay(day) === text ? day : null; // refuse 2025-02-30, 2025-13-01…
}

/** Premier circuit du jour : le n° 1. */
export const LAUNCH_DAY = daysFromCivil(2026, 10, 6);

/** Numéro du « Circuit du Jour » (n° 1 le jour du lancement ; ≤ 0 avant). */
export function circuitNumber(day: number): number {
  return day - LAUNCH_DAY + 1;
}
