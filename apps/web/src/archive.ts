import { PREMIER_JOUR, THEME_NAMES, circuitNumber, formatDay, medalsFor, themeForDay } from "@cdj/sim";
import { medaille, nomMedaille } from "@cdj/ui";
import { MEDAL_TYPE } from "./boardView";
import { creerCadre } from "./cadre";
import { el } from "./dom";
import { fDate, fDateCourte, fNumero, fRang, fTemps, nomTheme, onLangue, t, traducteurDuSocle } from "./i18n";
import { iconeTrack } from "./icones";
import type { DayBest } from "./records";
import { watchHrefFor } from "./watch";

export interface ArchiveDay {
  day: number;
  date: string;
  number: number;
  /** Le thème du jour : son code (`rallye`, `col`…), traduit à l'affichage par `nomTheme`. */
  theme: string;
  isToday: boolean;
  best: DayBest | null;
}

/** Jours jouables : d'aujourd'hui au lancement, du plus récent au plus ancien (`max` au plus). */
export function archiveDays(today: number, bests: Map<string, DayBest>, max = 120): ArchiveDay[] {
  const days: ArchiveDay[] = [];
  for (let day = today; day >= PREMIER_JOUR && days.length < max; day--) {
    const date = formatDay(day);
    days.push({ day, date, number: circuitNumber(day), theme: themeForDay(day).name, isToday: day === today, best: bests.get(date) ?? null });
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

/** Thème suivant dans l'ordre : auto → stade → … → ville → auto. */
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
/**
 * Jours dont la ligne est à l'écran dans le panneau ouvert. Lot R3 : une miniature est voulue tant que SON JOUR est à l'écran, et un
 * redessin (les détails arrivent) garde ces jours tant que le nouvel observateur n'a pas répondu. Avant, la demande dépendait de la case
 * dessinée : redessiné pendant la fabrication de la première miniature, le panneau rendait la demande caduque avant que sa nouvelle case
 * se signale ; elle était abandonnée et redemandée au bout de la file (aujourd'hui en dernier, 60 s et plus sur le runner de la CI).
 */
let shownDays = new Set<string>();

function stopObserving() {
  lineObserver?.disconnect();
  lineObserver = null;
  currentPanel = null;
}

/** Arrête la surveillance des lignes (panneau fermé) : plus aucune miniature n'est demandée. */
export function disposeArchive() {
  stopObserving();
  shownDays = new Set();
}

const thumbLabel = (d: ArchiveDay) => (d.number >= 1 ? t("archives.vignette", { numero: d.number, date: fDate(d.day) }) : t("archives.vignetteSansNumero", { date: fDate(d.day) }));

function showThumb(box: HTMLElement, day: ArchiveDay, url: string) {
  const img = new Image();
  img.alt = thumbLabel(day);
  img.decoding = "async";
  img.draggable = false;
  img.src = url;
  box.dataset.state = "ready";
  box.replaceChildren(img);
}

/** Les arguments de `renderArchive` gardés par `mountArchive` pour redessiner la liste quand la langue change. */
export interface ArchiveArgs {
  days: ArchiveDay[];
  search: string;
  currentDate: string | null;
  currentTheme: string | null;
  extras: ArchiveExtras | null;
  thumbs: ThumbSource | null;
  trialTools: boolean;
}

export interface ArchiveView {
  /** Le contenu défilant de l'étiquette (la racine des `IntersectionObserver` des miniatures). */
  corps: HTMLElement;
  render(args: ArchiveArgs): void;
}

/**
 * Les archives (lot I4 ; lot I4b : un sous-écran posé sur la scène) : le cadre (retour « ‹ TRACK » = `onClose`) et l'étiquette Track qui porte la liste. `root` est `#archive`
 * (déjà dans la page). La liste se redessine toute seule quand la langue change, si elle est ouverte.
 */
export function mountArchive(root: HTMLElement, onClose: () => void): ArchiveView {
  const cadre = creerCadre({ racine: root, titreAria: "archives.aria", retour: "jeu", onRetour: onClose, haut: true });
  cadre.corps.classList.add("panel"); // le panneau que visent les tests (`#archive .panel`)
  let last: ArchiveArgs | null = null;
  const view: ArchiveView = {
    corps: cadre.corps,
    render(args) {
      last = args;
      renderArchive(cadre.corps, args.days, args.search, args.currentDate, args.currentTheme, args.extras, args.thumbs, args.trialTools);
    },
  };
  onLangue(() => {
    if (last && !root.hidden) view.render(last);
  });
  return view;
}

/** Remplit le panneau des archives : une ligne-lien par jour. */
export function renderArchive(panel: HTMLElement, days: ArchiveDay[], search: string, currentDate: string | null, currentTheme: string | null = null, extras: ArchiveExtras | null = null, thumbs: ThumbSource | null = null, trialTools = true) {
  stopObserving(); // redessin : les jours à l'écran restent voulus (`shownDays`) jusqu'à la réponse du nouvel observateur
  currentPanel = {};
  const head = el("div", "etiquette__tete");
  head.append(el("h1", "etiquette__titre title", t("archives.titre")));

  // Essais : un circuit tiré au hasard, et le choix du thème (circuits d'essai : jamais classés).
  const tools = el("div", "tools");
  const dice = el("button", "dj-bouton dj-bouton--secondaire dice", t("archives.hasard"));
  dice.type = "button";
  dice.addEventListener("click", () => location.assign(randomSeedHref(location.search)));
  const chips = el("div", "chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", t("archives.themes"));
  const chip = (label: string, theme: string | null) => {
    const a = el("a", theme === currentTheme ? "puce on" : "puce", label);
    a.href = themeHref(search, theme);
    chips.append(a);
  };
  chip(t("archives.themeDuJour"), null);
  for (const name of THEME_NAMES) chip(nomTheme(name), name);
  tools.append(dice, chips);

  // Miniatures : une case de taille fixe par ligne (la liste ne bouge pas quand l'image arrive), remplie quand la ligne
  // apparaît à l'écran — `IntersectionObserver` sur le panneau qui défile.
  const boxes = new Map<Element, ArchiveDay>();
  const ask = (box: HTMLElement, day: ArchiveDay) => {
    if (!thumbs || box.dataset.state === "ready") return;
    const known = thumbs.peek(day);
    if (known) return showThumb(box, day, known);
    box.dataset.state = "wait";
    void thumbs.request(day, () => currentPanel !== null && shownDays.has(day.date)).then((url) => {
      if (url && box.isConnected) showThumb(box, day, url);
      else if (box.dataset.state === "wait") box.dataset.state = "none";
    });
  };
  if (thumbs && typeof IntersectionObserver !== "undefined") {
    lineObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const day = boxes.get(e.target)!;
          if (e.isIntersecting) {
            shownDays.add(day.date);
            ask(e.target as HTMLElement, day);
          } else shownDays.delete(day.date);
        }
      },
      { root: panel, rootMargin: "120px 0px" },
    );
  }

  const list = el("div", "list");
  for (const d of days) {
    const a = el("a", d.date === currentDate ? "day current" : "day");
    a.href = archiveHref(search, d.date, d.isToday);
    a.dataset.date = d.date;
    const box = el("span", "thumb");
    box.dataset.state = thumbs ? "idle" : "none";
    box.setAttribute("role", "img");
    a.append(box);
    if (thumbs) {
      boxes.set(box, d);
      const known = thumbs.peek(d);
      if (known) showThumb(box, d, known);
      else if (lineObserver) lineObserver.observe(box);
      else {
        shownDays.add(d.date);
        ask(box, d);
      }
    }
    const what = el("span", "what");
    const cell = (cls: string, text: string, into: HTMLElement) => {
      const span = el("span", cls, text);
      into.append(span);
      return span;
    };
    cell("num", d.number >= 1 ? fNumero(d.number) : "—", what);
    cell("date", d.isToday ? `${fDateCourte(d.day)} · ${t("archives.aujourdhui")}` : fDateCourte(d.day), what);
    cell("theme", nomTheme(d.theme), what);
    // Revoir le meilleur tour (lot 27b) : seulement pour un jour qui a un classement (connu quand les détails sont arrivés).
    if ((extras?.meta.get(d.date)?.participants ?? 0) > 0) {
      const href = watchHrefFor(archiveHref(search, d.date, d.isToday));
      const watch = el("span", "watch");
      watch.setAttribute("role", "link");
      watch.tabIndex = 0;
      watch.title = t("archives.revoir.titre");
      watch.append(iconeTrack("lecture", 14), t("archives.revoir"));
      const go = (e: Event) => {
        e.preventDefault(); // la ligne est un lien vers le jour : celui-ci mène à sa rediffusion
        e.stopPropagation();
        location.assign(href);
      };
      watch.addEventListener("click", go);
      watch.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && go(e));
      what.append(watch);
    }
    a.append(what);
    const rank = extras?.ranks.get(d.date);
    const best = el("span", "best");
    if (d.best) {
      if (d.best.medal) best.append(medaille(traducteurDuSocle(), { type: MEDAL_TYPE[d.best.medal], obtenue: true, forme: "pastille", jeu: "track" }), " ");
      best.append(el("span", "chiffres", fTemps(d.best.ms)));
      if (rank) best.append(` · ${fRang(rank.rank)}/${rank.participants}`);
    } else best.textContent = "—";
    a.append(best);
    const meta = extras?.meta.get(d.date);
    if (meta) {
      const m = medalsFor(meta.authorMs);
      const nom = (type: "auteur" | "or" | "argent" | "bronze") => nomMedaille(traducteurDuSocle(), type);
      cell("sub", `${nom("auteur")} ${fTemps(m.author)}  ${nom("or")} ${fTemps(m.gold)}  ${nom("argent")} ${fTemps(m.silver)}  ${nom("bronze")} ${fTemps(m.bronze)}  · ${t("archives.pilotes", { n: meta.participants })}`, a);
    }
    list.append(a);
  }
  const note = el("p", "note", t("archives.note"));
  const top = panel.scrollTop; // redessiné quand les détails arrivent : on reste où le joueur a défilé
  // Production (lot 31) : ni circuit au hasard (il pourrait tomber après aujourd'hui), ni thème forcé.
  panel.replaceChildren(head, ...(trialTools ? [tools] : []), list, note);
  panel.scrollTop = top;
}
