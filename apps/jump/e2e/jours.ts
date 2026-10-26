import { readFileSync, readdirSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import { randomBytes } from "node:crypto";
import { dailyLevel, demoAttempts, encodeReplay, jumpMedalFor, repriseParPhase, replayAttempt, thawLevel, type DailyLevel, type JumpMedal } from "@cdj/jump-sim";

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

/**
 * Lot 15 : l'identifiant du niveau d'une date tel que la page le charge (un jour figé garde celui de son générateur, `…-g9` jusqu'au 22/10/2026 ;
 * un jour généré prend le générateur en vigueur). Un thème forcé est toujours généré : `jour-<date>-g<générateur en vigueur>-t<thème>`.
 */
export function dayId(date: string): string {
  return pageLevel(date).id;
}

/**
 * Lot R9 : une rediffusion qui arrive et qui **n'est pas la preuve de l'auteur** : le serveur refuse les copies (409 `replay_copy`), un test qui envoie « une
 * course valide » à un vrai serveur ne peut plus jouer la preuve. C'est la plus rapide de `attempts` essais fictifs d'une graine **tirée au hasard** (un essai
 * relancé sur la même base en mémoire n'envoie donc pas, sous un autre pseudo, la course du premier essai : ce serait une copie). Calculée avant d'ouvrir la
 * page (le jeu tourne en temps réel dès qu'il est prêt) ; `medal` : celle que le serveur rend pour ce temps.
 */
export function honestRun(date: string, attempts = 40): { code: string; ticks: number; deaths: number; medal: JumpMedal | null } {
  const level = pageLevel(date);
  const seed = randomBytes(4).readUInt32BE();
  let best: { code: string; ticks: number; deaths: number } | null = null;
  for (const a of demoAttempts(level.level, level.replay, seed, { attempts, reprise: repriseParPhase(level) })) {
    if (a.end !== "arrivée") continue;
    const code = encodeReplay(a.replay);
    const r = replayAttempt(level.level, a.replay, level.id);
    if (!r.finished || code === level.code || (best && r.time >= best.ticks)) continue;
    best = { code, ticks: r.time, deaths: r.deaths.length };
  }
  if (!best) throw new Error(`aucune course fictive n'arrive sur ${date}`);
  return { ...best, medal: jumpMedalFor(best.ticks, level.medals) };
}
