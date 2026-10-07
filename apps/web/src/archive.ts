import { LAUNCH_DAY, THEMES, THEME_NAMES, circuitNumber, formatDay, themeForDay } from "@cdj/sim";
import { formatTime } from "./format";
import type { DayBest } from "./records";
import { MEDAL_ICON } from "./share";

export interface ArchiveDay {
  day: number;
  date: string;
  number: number;
  theme: string;
  isToday: boolean;
  best: DayBest | null;
}

/** Jours jouables : d'aujourd'hui au lancement, du plus récent au plus ancien (`max` au plus). */
export function archiveDays(today: number, bests: Map<string, DayBest>, max = 120): ArchiveDay[] {
  const days: ArchiveDay[] = [];
  for (let day = today; day >= LAUNCH_DAY && days.length < max; day--) {
    const date = formatDay(day);
    days.push({ day, date, number: circuitNumber(day), theme: themeForDay(day).label, isToday: day === today, best: bests.get(date) ?? null });
  }
  return days;
}

/** Adresse d'un jour : l'adresse actuelle, `seed` remplacé (aujourd'hui = pas de `seed`). Les réglages de test sont conservés. */
export function archiveHref(search: string, date: string, isToday: boolean): string {
  const params = new URLSearchParams(search);
  if (isToday) params.delete("seed");
  else params.set("seed", date);
  const q = params.toString();
  return q ? `?${q}` : "./";
}

/** Nombre de jours (depuis le lancement) parmi lesquels on tire un circuit « au hasard » : de quoi essayer longtemps. */
export const RANDOM_SPAN = 3650;

/** Adresse d'un circuit tiré au hasard (une date quelconque ; thème et réglages de test conservés). Jamais classé. */
export function randomSeedHref(search: string, rnd: () => number = Math.random): string {
  const params = new URLSearchParams(search);
  params.set("seed", formatDay(LAUNCH_DAY + Math.floor(rnd() * RANDOM_SPAN)));
  return `?${params.toString()}`;
}

/** Adresse du même circuit avec un autre thème (`null` : le thème du jour). Un thème forcé n'est jamais classé. */
export function themeHref(search: string, theme: string | null): string {
  const params = new URLSearchParams(search);
  if (theme === null) params.delete("theme");
  else params.set("theme", theme);
  const q = params.toString();
  return q ? `?${q}` : "./";
}

/** Thème suivant dans l'ordre : auto → stade → … → campagne → auto. */
export function nextTheme(current: string | null): string | null {
  const i = current === null ? -1 : THEME_NAMES.indexOf(current as (typeof THEME_NAMES)[number]);
  return i + 1 >= THEME_NAMES.length ? null : THEME_NAMES[i + 1]!;
}

/** Remplit le panneau des archives : une ligne-lien par jour. */
export function renderArchive(panel: HTMLElement, days: ArchiveDay[], search: string, currentDate: string | null, onClose: () => void, currentTheme: string | null = null) {
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "Archives";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Fermer");
  close.addEventListener("click", onClose);
  head.append(title, close);

  // Essais : un circuit tiré au hasard, et le choix du thème (circuits d'essai : jamais classés).
  const tools = document.createElement("div");
  tools.className = "tools";
  const dice = document.createElement("button");
  dice.type = "button";
  dice.className = "dice";
  dice.textContent = "🎲 Circuit au hasard";
  dice.addEventListener("click", () => location.assign(randomSeedHref(location.search)));
  const chips = document.createElement("div");
  chips.className = "chips";
  const chip = (label: string, theme: string | null) => {
    const a = document.createElement("a");
    a.href = themeHref(search, theme);
    a.textContent = label;
    if (theme === currentTheme) a.className = "on";
    chips.append(a);
  };
  chip("Thème du jour", null);
  for (const name of THEME_NAMES) chip(THEMES[name].label, name);
  tools.append(dice, chips);

  const list = document.createElement("div");
  list.className = "list";
  for (const d of days) {
    const a = document.createElement("a");
    a.href = archiveHref(search, d.date, d.isToday);
    a.className = d.date === currentDate ? "day current" : "day";
    const cells: [string, string][] = [
      ["num", d.number >= 1 ? `#${d.number}` : "—"],
      ["date", d.isToday ? `${d.date} · aujourd'hui` : d.date],
      ["theme", d.theme],
      ["best", d.best ? `${d.best.medal ? MEDAL_ICON[d.best.medal] + " " : ""}${formatTime(d.best.ms)}` : "—"],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      a.append(span);
    }
    list.append(a);
  }
  const note = document.createElement("div");
  note.className = "note";
  note.textContent = "Les jours passés, les circuits au hasard et les thèmes forcés se rejouent sans classement (touches N : au hasard, T : thème suivant).";
  panel.replaceChildren(head, tools, list, note);
}
