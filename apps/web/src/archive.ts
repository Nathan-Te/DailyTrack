import { LAUNCH_DAY, circuitNumber, formatDay, paletteForDay } from "@cdj/sim";
import { formatTime } from "./format";
import { PALETTE_LABELS } from "./labels";
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
    days.push({ day, date, number: circuitNumber(day), theme: PALETTE_LABELS[paletteForDay(day)], isToday: day === today, best: bests.get(date) ?? null });
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

/** Remplit le panneau des archives : une ligne-lien par jour. */
export function renderArchive(panel: HTMLElement, days: ArchiveDay[], search: string, currentDate: string | null, onClose: () => void) {
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
  note.textContent = "Les jours passés se rejouent sans classement : leur classement est figé.";
  panel.replaceChildren(head, list, note);
}
