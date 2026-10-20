import { readFileSync, readdirSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import { dailyLevel, thawLevel, type DailyLevel } from "@cdj/jump-sim";

// Lot R5 (plateforme) : les jours figés (`public/levels/AAAA-MM-JJ.json`) changent à chaque mise en production (`freeze:days -- demain`). Un test
// qui a besoin d'un niveau **généré** calcule un jour sans fichier figé ; un test qui rejoue le niveau d'une date prend **celui que la page
// charge** (le fichier figé s'il existe, sinon le générateur) — jamais une date écrite en dur qu'on suppose générée.

const LEVELS = new URL("../public/levels/", import.meta.url);

/** Les dates figées, triées. */
export const FROZEN_DATES: readonly string[] = readdirSync(LEVELS)
  .map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
  .filter((d): d is string => !!d)
  .sort();

/** Un jour sans fichier figé, où la page génère son niveau : le lendemain du dernier jour figé (ou `after` s'il n'y en a pas, ou s'il est plus tard). */
export function generatedDay(after = "2026-10-20"): string {
  const last = FROZEN_DATES.at(-1);
  if (!last || last < after) return after;
  return formatDay(parseDay(last)! + 1); // un numéro de jour : le lendemain est + 1
}

/** Midi UTC d'une date : à Paris, c'est bien ce jour-là (heure d'été ou d'hiver). */
export function noonOf(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

/** Le niveau que la page joue pour une date : son fichier figé (preuve rejouée) s'il existe, sinon le générateur — la règle de `loadDaily`. */
export function pageLevel(date: string): DailyLevel {
  const day = parseDay(date)!;
  if (FROZEN_DATES.includes(date)) {
    const thawed = thawLevel(JSON.parse(readFileSync(new URL(`${date}.json`, LEVELS), "utf8")), day);
    if (typeof thawed !== "string") return thawed;
  }
  return dailyLevel(day);
}
