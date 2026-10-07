import { PREMIER_JOUR, THEMES, THEME_NAMES, circuitNumber, formatDay, medalsFor, themeForDay } from "@cdj/sim";
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
  for (let day = today; day >= PREMIER_JOUR && days.length < max; day--) {
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
  params.set("seed", formatDay(PREMIER_JOUR + Math.floor(rnd() * RANDOM_SPAN)));
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

/** Ce qu'on sait de plus d'un jour (chargé après coup : mode démo ou API) : seuils de médailles, nombre de pilotes, ta place figée. */
export interface ArchiveExtras {
  meta: Map<string, { authorMs: number; participants: number }>;
  ranks: Map<string, { rank: number; participants: number }>;
}

/** D'où viennent les miniatures des lignes (lot 13) : le service du jeu, ou un faux dans les tests. */
export interface ThumbSource {
  /** Adresse de l'image si elle est déjà en mémoire (le panneau redessiné ne clignote pas). */
  peek(day: ArchiveDay): string | null;
  /** Fabrique (ou retrouve) l'image ; `wanted` dit si la ligne est toujours à l'écran. `null` : pas d'image. */
  request(day: ArchiveDay, wanted: () => boolean): Promise<string | null>;
}

let lineObserver: IntersectionObserver | null = null;
/** Le dessin du panneau en cours : une demande de miniature n'est utile que tant que son panneau est le courant. */
let currentPanel: object | null = null;

/** Arrête la surveillance des lignes (panneau fermé ou redessiné) : plus aucune miniature n'est demandée. */
export function disposeArchive() {
  lineObserver?.disconnect();
  lineObserver = null;
  currentPanel = null;
}

const THUMB_LABEL = (d: ArchiveDay) => `Vue aérienne du circuit${d.number >= 1 ? ` n° ${d.number}` : ""} du ${d.date}`;

function showThumb(box: HTMLElement, day: ArchiveDay, url: string) {
  const img = new Image();
  img.alt = THUMB_LABEL(day);
  img.decoding = "async";
  img.draggable = false;
  img.src = url;
  box.dataset.state = "ready";
  box.replaceChildren(img);
}

/** « 1ᵉʳ », « 4ᵉ » : le rang en français. */
export function ordinal(rank: number): string {
  return rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`;
}

/** Remplit le panneau des archives : une ligne-lien par jour. */
export function renderArchive(panel: HTMLElement, days: ArchiveDay[], search: string, currentDate: string | null, onClose: () => void, currentTheme: string | null = null, extras: ArchiveExtras | null = null, thumbs: ThumbSource | null = null) {
  disposeArchive();
  const drawing = (currentPanel = {});
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

  // Miniatures : une case de taille fixe par ligne (la liste ne bouge pas quand l'image arrive), remplie quand la ligne
  // apparaît à l'écran — `IntersectionObserver` sur le panneau qui défile.
  const boxes = new Map<Element, ArchiveDay>();
  const visible = new Set<Element>();
  const ask = (box: HTMLElement, day: ArchiveDay) => {
    if (!thumbs || box.dataset.state === "ready") return;
    const known = thumbs.peek(day);
    if (known) return showThumb(box, day, known);
    box.dataset.state = "wait";
    void thumbs.request(day, () => currentPanel === drawing && visible.has(box) && box.isConnected).then((url) => {
      if (url && box.isConnected) showThumb(box, day, url);
      else if (box.dataset.state === "wait") box.dataset.state = "none";
    });
  };
  if (thumbs && typeof IntersectionObserver !== "undefined") {
    lineObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.add(e.target);
            ask(e.target as HTMLElement, boxes.get(e.target)!);
          } else visible.delete(e.target);
        }
      },
      { root: panel, rootMargin: "120px 0px" },
    );
  }

  const list = document.createElement("div");
  list.className = "list";
  for (const d of days) {
    const a = document.createElement("a");
    a.href = archiveHref(search, d.date, d.isToday);
    a.className = d.date === currentDate ? "day current" : "day";
    const box = document.createElement("span");
    box.className = "thumb";
    box.dataset.state = thumbs ? "idle" : "none";
    box.setAttribute("role", "img");
    a.append(box);
    if (thumbs) {
      boxes.set(box, d);
      const known = thumbs.peek(d);
      if (known) showThumb(box, d, known);
      else if (lineObserver) lineObserver.observe(box);
      else {
        visible.add(box);
        ask(box, d);
      }
    }
    const what = document.createElement("span");
    what.className = "what";
    const cell = (cls: string, text: string, into: HTMLElement) => {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      into.append(span);
    };
    cell("num", d.number >= 1 ? `#${d.number}` : "—", what);
    cell("date", d.isToday ? `${d.date} · aujourd'hui` : d.date, what);
    cell("theme", d.theme, what);
    a.append(what);
    const rank = extras?.ranks.get(d.date);
    cell("best", d.best ? `${d.best.medal ? MEDAL_ICON[d.best.medal] + " " : ""}${formatTime(d.best.ms)}${rank ? ` · ${ordinal(rank.rank)}/${rank.participants}` : ""}` : "—", a);
    const meta = extras?.meta.get(d.date);
    if (meta) {
      const m = medalsFor(meta.authorMs);
      cell("sub", `${MEDAL_ICON.author} ${formatTime(m.author)}  ${MEDAL_ICON.gold} ${formatTime(m.gold)}  ${MEDAL_ICON.silver} ${formatTime(m.silver)}  ${MEDAL_ICON.bronze} ${formatTime(m.bronze)}  · ${meta.participants} pilotes`, a);
    }
    list.append(a);
  }
  const note = document.createElement("div");
  note.className = "note";
  note.textContent = "Les jours passés, les circuits au hasard et les thèmes forcés se rejouent sans classement (touches N : au hasard, T : thème suivant).";
  const top = panel.scrollTop; // redessiné quand les détails arrivent : on reste où le joueur a défilé
  panel.replaceChildren(head, tools, list, note);
  panel.scrollTop = top;
}
