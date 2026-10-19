import { msUntilNextParisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { PREMIER_JOUR_JUMP, levelNumber, type JumpMedal, type JumpMedals } from "@cdj/jump-sim";
import { MEDAL_ICON, MEDAL_WORD, levelTitle, shortDate } from "./dailyInfo";
import type { DayRecord } from "./history";
import type { KeyValue } from "./memory";
import { storageKey } from "./storage";
import { formatTicks } from "./session";
import type { UrlChoices } from "./urlOptions";

// L'accueil, l'écran d'arrivée et les archives (lot 10), **logique pure** (testée sans DOM) : quand l'accueil s'affiche, les textes, la liste
// des archives, le compte à rebours jusqu'au prochain niveau (minuit, heure de Paris, par `@cdj/clock`), l'aide « Comment jouer ».

/**
 * L'accueil s'ouvre-t-il ? Sur la page du niveau du jour, oui, sauf `?accueil=0` ; jamais pour un lien direct (`seed`, `solution`, `watch`,
 * `carnage`, et bien sûr `module`, `modules`, `scenario`, qui ne sont pas le niveau du jour). `?archives` l'ouvre (sur la liste).
 */
export function wantsHome(o: Pick<UrlChoices, "daily" | "seed" | "solution" | "watchBest" | "carnageDemo" | "home" | "archives"> & Partial<Pick<UrlChoices, "watchFirst">>): boolean {
  if (!o.daily || o.seed !== null || o.solution || o.watchBest || o.watchFirst || o.carnageDemo) return false;
  return o.archives || o.home !== false;
}

/** « 07:42:09 » (les heures peuvent valoir 24 le jour du retour à l'heure d'hiver, qui dure 25 h). */
export function hhmmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(Math.floor(total / 3600))}:${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
}

/** « Prochain niveau dans 07:42:09 » à l'instant `nowMs` (minuit de Paris, heure d'été comprise). */
export function countdownText(nowMs: number): string {
  return `Prochain niveau dans ${hhmmss(msUntilNextParisDay(nowMs))}`;
}

/** « Forêt » (le nom du thème avec sa majuscule). */
export function capitalize(label: string): string {
  return label.charAt(0).toLocaleUpperCase("fr") + label.slice(1);
}

/** Le titre de l'accueil et sa date : « DailyJump #5 », « 20 oct. 2026 · Forêt ». */
export function homeHeading(day: number, themeLabel: string): { title: string; subtitle: string } {
  return { title: levelTitle(levelNumber(day)), subtitle: `${shortDate(formatDay(day))} · ${capitalize(themeLabel)}` };
}

/** « 0 mort », « 1 mort », « 47 morts » ; « 1 essai », « 3 essais » (en français, 0 et 1 prennent le singulier). */
export const plural = (n: number, one: string, many: string): string => `${n} ${n <= 1 ? one : many}`;

/** L'état du joueur sur l'accueil : « Pas encore joué », sinon son meilleur temps, sa médaille et ses morts du jour. */
export function homeStatus(rec: DayRecord | null): { played: boolean; finished: boolean; text: string } {
  if (!rec || (rec.attempts === 0 && rec.deaths === 0 && rec.best === null)) return { played: false, finished: false, text: "Pas encore joué" };
  const deaths = plural(rec.deaths, "mort", "morts");
  if (rec.best === null) return { played: true, finished: false, text: `Pas encore d'arrivée · ${deaths} · ${plural(rec.attempts, "essai", "essais")}` };
  const medal = rec.medal ? `${MEDAL_ICON[rec.medal]} ` : "";
  return { played: true, finished: true, text: `${medal}Meilleur : ${formatTicks(rec.best)} · ${deaths}` };
}

/** « Série : 3 jours », « Série : 1 jour », « Pas de série en cours ». */
export function streakText(n: number): string {
  return n > 0 ? `Série : ${plural(n, "jour", "jours")}` : "Pas de série en cours";
}

/** Une archive ne compte jamais dans la série (texte de l'écran d'arrivée). */
export const ARCHIVE_STREAK_TEXT = "Archive : ne compte pas dans ta série";

/** Les jours des archives, du plus récent (hier) au niveau n° 1 ; rien avant le premier jour. */
export function archiveDays(today: number, first: number = PREMIER_JOUR_JUMP): number[] {
  const out: number[] = [];
  for (let d = today - 1; d >= first; d--) out.push(d);
  return out;
}

/** Une ligne des archives : numéro, date, thème, et le résultat du joueur s'il a joué ce jour-là. */
export interface ArchiveRow {
  date: string;
  number: number;
  title: string;
  subtitle: string;
  result: string;
  medal: JumpMedal | null;
}

export function archiveRow(day: number, themeLabel: string, rec: DayRecord | null): ArchiveRow {
  const date = formatDay(day);
  const result = !rec ? "" : rec.best === null ? `pas d'arrivée · ${plural(rec.deaths, "mort", "morts")}` : `${rec.medal ? `${MEDAL_ICON[rec.medal]} ` : ""}${formatTicks(rec.best)}`;
  return { date, number: levelNumber(day), title: `#${levelNumber(day)}`, subtitle: `${shortDate(date)} · ${capitalize(themeLabel)}`, result, medal: rec?.medal ?? null };
}

/** Les seuils des médailles, de l'auteur au bronze, avec leur temps ; `reached` : le temps donné les tient. */
export function medalThresholds(medals: JumpMedals, time: number | null): { medal: JumpMedal; icon: string; label: string; time: string; reached: boolean }[] {
  return (["author", "gold", "silver", "bronze"] as const).map((m) => ({
    medal: m,
    icon: MEDAL_ICON[m],
    label: MEDAL_WORD[m],
    time: formatTicks(medals[m]),
    reached: time !== null && time <= medals[m],
  }));
}

/** La médaille obtenue, en toutes lettres : « Médaille d'or », « Temps de l'auteur battu », « Pas de médaille ». */
export function medalText(medal: JumpMedal | null): string {
  if (medal === "author") return "Temps de l'auteur battu !";
  if (medal === "gold") return "Médaille d'or";
  if (medal === "silver") return "Médaille d'argent";
  if (medal === "bronze") return "Médaille de bronze";
  return "Pas de médaille";
}

/** Aide « Comment jouer » : courte, une section par sujet. */
export const HELP: readonly { title: string; lines: readonly string[] }[] = [
  {
    title: "Commandes",
    lines: [
      "Clavier : ← → (ou Q D) pour courir, Espace, ↑ ou Z pour sauter, R pour recommencer, Échap pour le menu.",
      "Manette : stick ou croix, A ou B pour sauter, Select pour recommencer, Start pour le menu.",
      "Tactile : moitié gauche de l'écran pour ← →, moitié droite pour sauter, ↻ pour recommencer.",
    ],
  },
  {
    title: "Sauter",
    lines: [
      "Tiens le saut pour monter plus haut ; lâche tôt pour un petit saut.",
      "Pousse contre un mur pour glisser plus lentement, puis saute : le saut mural te repousse du mur.",
      "L'élan : pas de bouton de course, la vitesse vient de l'élan. Lancé, on saute plus loin qu'à l'arrêt.",
    ],
  },
  {
    title: "Mourir et recommencer",
    lines: [
      "La mort ne coûte rien : on repart aussitôt. Les fanions sont des points de passage : on y reprend, le chrono continue.",
      "« Recommencer » repart du départ, chrono à zéro.",
    ],
  },
  {
    title: "Médailles",
    lines: ["Bronze, argent, or, puis le temps de l'auteur à battre. Ton meilleur essai du jour compte ; un nouveau niveau sort chaque jour à minuit (heure de Paris)."],
  },
];

/** Clé du « déjà vu » de l'aide : « Comment jouer » ne s'ouvre de lui-même qu'à la toute première visite. */
export const HELP_SEEN_KEY = storageKey("aide");

/** L'aide a-t-elle déjà été montrée ? (Stockage absent ou qui lève : on la considère vue, pour ne pas la remontrer à chaque page.) */
export function helpSeen(store: KeyValue | null): boolean {
  if (!store) return true;
  try {
    return store.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHelpSeen(store: KeyValue | null): void {
  try {
    store?.setItem(HELP_SEEN_KEY, "1");
  } catch {
    /* rien */
  }
}
