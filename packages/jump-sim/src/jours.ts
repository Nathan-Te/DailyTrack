import { daysFromCivil, formatDay } from "@cdj/core";
import { BRIDGE_VERSION, JUMP_GENERATOR_VERSION, LASER_VERSION, MUSHROOM_VERSION, PLATFORM_VERSION, PRESS_VERSION, RESTART_VERSION, SINGLE_CLOCK_VERSION, STALACTITE_VERSION } from "./constants";
import { idiv } from "./idiv";
import { jumpThemeForDay, type JumpThemeName } from "./themes";
import type { SlowRoute } from "./voies";

// Lot 21 : le numéro du niveau du jour, son identifiant et ses médailles (venus de `daily.ts`, le générateur, sans rien changer) : la page du jeu les lit au
// premier chargement, sans le catalogue des morceaux ni le générateur. `daily.ts` les réexporte : tout importeur d'avant les trouve où il les trouvait.

/** Le niveau n° 1 : le 16/10/2026 (numéro de jour, comme `parseDay`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

/** Numéro du niveau du jour (1 le 16/10/2026 ; 0 ou moins avant). */
export function levelNumber(day: number): number {
  return day - PREMIER_JOUR_JUMP + 1;
}

/**
 * Identifiant du niveau d'une date : `jour-AAAA-MM-JJ-g<JUMP_GENERATOR_VERSION>` (identifiant des rediffusions et de la mémoire). Un thème
 * **forcé** (lot 11 : un autre que celui de la date) y ajoute `-t<thème>` : c'est un essai (`forcedTheme`), jamais enregistré.
 */
export function dailyLevelId(day: number, forced: JumpThemeName | null = null, simVersion = RESTART_VERSION): string {
  const natural = jumpThemeForDay(day);
  const g = simVersion >= RESTART_VERSION ? JUMP_GENERATOR_VERSION : simVersion >= BRIDGE_VERSION ? BRIDGE_GENERATOR : simVersion >= LASER_VERSION ? LASER_GENERATOR : simVersion >= STALACTITE_VERSION ? STALACTITE_GENERATOR : simVersion >= MUSHROOM_VERSION ? MUSHROOM_GENERATOR : simVersion >= PRESS_VERSION ? PRESS_GENERATOR : simVersion >= PLATFORM_VERSION ? PLATFORM_GENERATOR : simVersion >= SINGLE_CLOCK_VERSION ? SINGLE_CLOCK_GENERATOR : SECTION_CLOCK_GENERATOR;
  return `jour-${formatDay(day)}-g${g}${forced !== null && forced !== natural ? `-t${forced}` : ""}`;
}

/** Lot 15 : le dernier générateur des niveaux en version 3 (g9, lot 13) : `dailyLevel(jour, thème, 3)` le rend encore, à l'identique. */
export const SECTION_CLOCK_GENERATOR = 9;
/**
 * Lot 20 : le dernier générateur des niveaux en version 4 (g14, lot 19) : `dailyLevel(jour, thème, 4)` le rend encore, à l'identique (référence v4 : le catalogue
 * sans les morceaux à plateformes, la même règle de variété). Les niveaux du jour depuis le générateur g15 (`PLATFORM_GENERATOR`) sont en version 5.
 */
export const SINGLE_CLOCK_GENERATOR = 14;
export const PLATFORM_GENERATOR = 15;
/**
 * Lot 22 : le dernier générateur des niveaux en version 5 est g15 : `dailyLevel(jour, thème, 5)` le rend encore, à l'identique (référence v5 : le catalogue sans
 * les morceaux à presses, la même règle de variété). Les niveaux du jour depuis le générateur g16 (`PRESS_GENERATOR`) sont en version 6.
 */
export const PRESS_GENERATOR = 16;
/**
 * Lot 23 : le dernier générateur des niveaux en version 6 est g16 : `dailyLevel(jour, thème, 6)` le rend encore, à l'identique (référence v6 : le catalogue sans les
 * morceaux à champignons, la même règle de variété). Les niveaux du jour depuis le générateur g17 (`MUSHROOM_GENERATOR`) sont en version 7.
 */
export const MUSHROOM_GENERATOR = 17;
/**
 * Lot 24 : le dernier générateur des niveaux en version 7 est g17 : `dailyLevel(jour, thème, 7)` le rend encore, à l'identique (référence v7 : le catalogue sans les
 * morceaux à stalactites, la même règle de variété). Les niveaux du jour depuis le générateur g18 (`STALACTITE_GENERATOR`) sont en version 8.
 */
export const STALACTITE_GENERATOR = 18;
/**
 * Lot 25 : le dernier générateur des niveaux en version 8 est g18 : `dailyLevel(jour, thème, 8)` le rend encore, à l'identique (référence v8 : le catalogue sans les
 * morceaux à lasers, la règle de variété à 3 jours). Les niveaux du jour depuis le générateur g19 (`LASER_GENERATOR`) sont en version 9.
 */
export const LASER_GENERATOR = 19;
/**
 * Lot 26 : le dernier générateur des niveaux en version 9 est g19 : `dailyLevel(jour, thème, 9)` le rend encore, à l'identique (référence v9 : le catalogue sans les morceaux
 * à ponts, sans la règle d'équilibre des mécaniques). Les niveaux du jour depuis le générateur g20 (`BRIDGE_GENERATOR`) sont en version 10.
 */
export const BRIDGE_GENERATOR = 20;
/**
 * Lot 27 : le dernier générateur des niveaux en version 10 est g20 : `dailyLevel(jour, thème, 10)` le rend encore, à l'identique (référence v10 : mort avant le premier point = reprise au départ,
 * chrono qui continue ; forêt à rafales). Les niveaux du jour depuis le générateur g21 (`RESTART_GENERATOR`) sont en version 11.
 */
export const RESTART_GENERATOR = 21;

/** Médailles : facteurs (en pour cent) du temps de l'auteur, arrondis au pas supérieur. À calibrer sur de vraies parties (seed § 5). */
export const MEDAL_PERCENT = { gold: 110, silver: 130, bronze: 160 } as const;

/** Les médailles d'un niveau, en pas (le temps de l'auteur est le palier au-dessus de l'or). */
export interface JumpMedals {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

export type JumpMedal = keyof JumpMedals;

/** Pas × pour cent ÷ 100, arrondi au pas supérieur (entiers seulement). */
const ceilPercent = (ticks: number, percent: number): number => idiv(ticks * percent + 99, 100);

export function jumpMedalsFor(authorTicks: number): JumpMedals {
  return {
    author: authorTicks,
    gold: ceilPercent(authorTicks, MEDAL_PERCENT.gold),
    silver: ceilPercent(authorTicks, MEDAL_PERCENT.silver),
    bronze: ceilPercent(authorTicks, MEDAL_PERCENT.bronze),
  };
}

/** La meilleure médaille d'un temps (en pas), ou null. */
export function jumpMedalFor(ticks: number, medals: JumpMedals): JumpMedal | null {
  if (ticks <= medals.author) return "author";
  if (ticks <= medals.gold) return "gold";
  if (ticks <= medals.silver) return "silver";
  if (ticks <= medals.bronze) return "bronze";
  return null;
}

/** Lot 16 : marge du bronze au-dessus du temps « toutes voies lentes » (pour cent). */
export const SLOW_BRONZE_MARGIN = 110;

/**
 * Lot 16 — les médailles d'un niveau à voies lentes : celles du temps de l'auteur (`jumpMedalsFor`), puis, au minimum, **l'or sous le temps
 * de n'importe quelle voie lente** (auteur + le plus petit surcoût − 1 pas) et **le bronze au-dessus du temps « toutes voies lentes »** avec
 * `SLOW_BRONZE_MARGIN` ; l'argent reste entre les deux. La calibration complète est pour le lot 17.
 */
export function medalsWithSlow(author: number, slow: readonly Pick<SlowRoute, "fastTicks" | "slowTicks">[]): JumpMedals {
  const m = jumpMedalsFor(author);
  if (slow.length === 0) return m;
  const minExtra = slow.reduce((n, r) => (r.slowTicks - r.fastTicks < n ? r.slowTicks - r.fastTicks : n), slow[0]!.slowTicks - slow[0]!.fastTicks);
  const all = author + slow.reduce((n, r) => n + r.slowTicks - r.fastTicks, 0);
  const goldMax = author + minExtra - 1;
  const gold = m.gold > goldMax ? goldMax : m.gold;
  const bronzeMin = ceilPercent(all, SLOW_BRONZE_MARGIN);
  const bronze = m.bronze < bronzeMin ? bronzeMin : m.bronze;
  const silver = m.silver < gold ? gold : m.silver > bronze ? bronze : m.silver;
  return { author, gold, silver, bronze };
}
