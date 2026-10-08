import { THEMES, THEME_NAMES, circuitNumber, dailyTrackId, formatDay, medalsFor, parseDay, themeForDay, type ThemeName } from "@cdj/sim";
import { DEMO_BASE, apiBase, type ApiResult } from "./api";
import { DemoAdmin, HttpAdmin, loadToken, saveToken, type AdminBackend, type AdminOverview, type DayRow } from "./adminBackend";
import { CANDIDATES, candidateVariants, hasMoreCandidates, histogram, imposedTheme, planningDays, relativeLabel } from "./adminPlan";
import { SURFACE_LABEL, circuitStats, effectsText, reliefText, widthsText } from "./circuitStats";
import { formatTime } from "./format";
import { isReplaced, type PlanEntry } from "./planning";
import { createCircuitMaker } from "./thumbGen";
import { createThumbnailService } from "./thumbnails";
import type { ThumbnailCircuit } from "./thumbnail";

// Panneau d'admin (lot 14) : aujourd'hui, planning des 14 prochains jours, remplacement d'un circuit, historique.
// Les circuits sont générés dans le navigateur (fil de travail) avec le même code que le serveur ; seul le choix du
// remplacement part vers l'API (jeton) ou, en démo, reste dans ce navigateur. Toutes les données affichées passent par
// `textContent` : jamais de HTML construit à partir d'une réponse du serveur.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Child = Node | string | null | false | undefined;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Record<"className" | "id" | "href" | "type" | "title" | "textContent", string>> & { disabled?: boolean; hidden?: boolean } = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c) node.append(c);
  return node;
}
const text = (cls: string, s: string, tag: "div" | "span" | "p" = "span") => el(tag, { className: cls, textContent: s });
const button = (label: string, onClick: () => void, className = "") => {
  const b = el("button", { type: "button", className, textContent: label });
  b.addEventListener("click", onClick);
  return b;
};

const themeLabel = (t: ThemeName) => THEMES[t].label;

// --- Génération des circuits et miniatures ---------------------------------------------------------------------------

const maker = createCircuitMaker();
const thumbs = createThumbnailService(() => true);
const circuits = new Map<string, Promise<ThumbnailCircuit | null>>();

/** Le circuit de (jour, variante, thème imposé) : généré une fois (fil de travail), gardé en mémoire. */
function circuitFor(day: number, e: PlanEntry): Promise<ThumbnailCircuit | null> {
  const key = dailyTrackId(day, e.theme, e.variant);
  let p = circuits.get(key);
  if (!p) circuits.set(key, (p = maker(day, e.theme, e.variant)));
  return p;
}

/** Parmi les circuits à générer, un seul à la fois, dans l'ordre demandé (le fil de travail les traite déjà en file). */
async function fillCircuit(box: HTMLElement, day: number, e: PlanEntry, wanted: () => boolean, onReady: (c: ThumbnailCircuit) => void): Promise<void> {
  const c = await circuitFor(day, e);
  if (!wanted()) return;
  if (!c) {
    box.dataset.state = "none";
    box.textContent = "circuit indisponible";
    return;
  }
  onReady(c);
  const url = await thumbs.request({ day, theme: e.theme, variant: e.variant, circuit: c }, wanted);
  if (!url || !wanted()) return;
  const img = new Image();
  img.alt = `Vue aérienne du circuit du ${formatDay(day)}`;
  img.decoding = "async";
  img.src = url;
  box.dataset.state = "ready";
  box.replaceChildren(img);
}

function thumbBox(): HTMLElement {
  const box = el("div", { className: "thumb" });
  box.dataset.state = "wait";
  box.setAttribute("role", "img");
  return box;
}

// --- Liens vers le jeu --------------------------------------------------------------------------------------------------

/** Adresse du jeu pour essayer une variante (jamais classée) ; `watch` : le pilote automatique roule seul. */
export function planHref(date: string, e: PlanEntry, watch = false): string {
  const p = new URLSearchParams({ seed: date, variant: String(e.variant) });
  if (e.theme) p.set("theme", e.theme);
  let q = p.toString();
  if (watch) q += "&demo";
  return `../?${q}`;
}

// --- Page ----------------------------------------------------------------------------------------------------------------

export function mountPlanning(stateApi: () => string): void {
  const computeBase = () => (new URLSearchParams(location.search).get("api") || stateApi().trim() || apiBase() || "").replace(/\/+$/, "");
  let base = computeBase(); // recalculée à chaque « Actualiser » : on peut changer l'adresse de l'API plus bas
  let token = loadToken();
  const backendFor = (): AdminBackend | null => (base === DEMO_BASE ? new DemoAdmin() : base ? new HttpAdmin(base, token) : null);
  let overview: AdminOverview | null = null;
  let generation = 0; // chaque rafraîchissement abandonne les miniatures du précédent

  const todayUtc = () => Math.floor(Date.now() / 86_400_000);
  const apiParam = () => (base ? `?api=${encodeURIComponent(base)}` : "");

  function status(message: string, kind: "info" | "error" = "info") {
    const s = $("conn-state");
    s.textContent = message;
    s.dataset.kind = kind;
  }

  function showTokenForm(show: boolean) {
    $("token-form").hidden = !show;
    $("logout").hidden = show || base === DEMO_BASE || !base || !token;
  }

  async function refresh(): Promise<void> {
    base = computeBase();
    const backend = backendFor();
    $("demo-banner").hidden = backend?.kind !== "demo";
    if (!backend) {
      status("Aucune API configurée : le planning montre les circuits d'origine, sans pouvoir les remplacer. Ouvre /admin/?api=demo pour essayer sans serveur, ou renseigne l'adresse de l'API plus bas (Outils).", "info");
      showTokenForm(false);
      overview = { today: formatDay(todayUtc()), plan: [], days: [], times: [] };
      render();
      return;
    }
    if (backend.kind === "api" && !token) {
      status(`API : ${backend.label}. Saisis le jeton d'admin (variable ADMIN_TOKEN du serveur).`);
      showTokenForm(true);
      overview = { today: formatDay(todayUtc()), plan: [], days: [], times: [] };
      render();
      return;
    }
    status(`Connexion à ${backend.label}…`);
    const r = await backend.overview();
    if (!r.ok) {
      if (r.status === 401) {
        token = "";
        saveToken("");
        status("Jeton refusé. Saisis-le à nouveau.", "error");
        showTokenForm(true);
      } else if (r.status === 404 && r.code === "not_found") {
        status("Cette API n'a pas d'admin : le serveur n'a pas de ADMIN_TOKEN (≥ 16 caractères).", "error");
        showTokenForm(false);
      } else {
        status(`${r.message}${r.status === 429 ? " (trop d'essais, attends un peu)" : ""}.`, "error");
        showTokenForm(r.status === 429);
      }
      overview = { today: formatDay(todayUtc()), plan: [], days: [], times: [] };
      render();
      return;
    }
    overview = r.data;
    status(`Connecté : ${backend.label}. Aujourd'hui (UTC) : ${overview.today}.`);
    showTokenForm(false);
    render();
  }

  $("token-form").addEventListener("submit", (e) => {
    e.preventDefault();
    token = $<HTMLInputElement>("token").value.trim();
    $<HTMLInputElement>("token").value = "";
    saveToken(token);
    void refresh();
  });
  $("logout").addEventListener("click", () => {
    token = "";
    saveToken("");
    void refresh();
  });
  $("refresh").addEventListener("click", () => void refresh());

  // --- Rendu ------------------------------------------------------------------------------------------------------

  function planOf(date: string): PlanEntry {
    const p = overview?.plan.find((r) => r.date === date);
    return p ? { variant: p.variant, theme: p.theme } : { variant: 0, theme: null };
  }

  function render() {
    if (!overview) return;
    generation++;
    const mine = generation;
    const wanted = () => generation === mine;
    renderToday(wanted);
    renderPlanning(wanted);
    renderHistory();
  }

  function statLines(c: ThumbnailCircuit | null, authorMs?: number): HTMLElement {
    const dl = el("dl", { className: "stats" });
    const row = (k: string, v: string) => dl.append(el("dt", { textContent: k }), el("dd", { textContent: v }));
    if (!c) {
      row("Circuit", "en préparation…");
      return dl;
    }
    const s = circuitStats(c.track);
    row("Temps de l'auteur", authorMs !== undefined ? formatTime(authorMs) : c.authorMs ? formatTime(c.authorMs) : "—");
    row("Largeurs", widthsText(s.widths));
    row("Revêtements", s.surfaces.map((k) => SURFACE_LABEL[k]).join(" · "));
    row("Blocs à effet", effectsText(s));
    row("Virages serrés", String(s.tight));
    row("Relief", reliefText(s));
    return dl;
  }

  // Aujourd'hui
  function renderToday(wanted: () => boolean) {
    const box = $("daynow");
    const o = overview!;
    const day = parseDay(o.today)!;
    const row: DayRow | undefined = o.days.find((d) => d.date === o.today);
    const entry: PlanEntry = row ? { variant: row.variant, theme: row.theme } : planOf(o.today);
    const t = thumbBox();
    const stats = el("div", { className: "statbox" });
    const theme = entry.theme ?? themeForDay(day).name;
    const title = el("div", { className: "title" }, text("num", `#${circuitNumber(day)}`), text("date", o.today), text("theme", themeLabel(theme)), isReplaced(entry) && text("badge", entry.variant > 0 ? `variante ${entry.variant}` : "thème imposé"));
    const nums = el("div", { className: "figures" });
    const fig = (v: string, k: string) => nums.append(el("div", { className: "fig" }, text("v", v), text("k", k)));
    fig(String(row?.participants ?? 0), (row?.participants ?? 0) > 1 ? "joueurs" : "joueur");
    fig(row?.bestMs != null ? formatTime(row.bestMs) : "—", "meilleur temps");
    const hist = el("div", { className: "hist", id: "hist" });
    const medalsNote = text("hint", "", "p");
    stats.append(title, nums, hist, medalsNote);
    box.replaceChildren(el("div", { className: "daycard" }, t, stats), el("div", { className: "actions" }, el("a", { className: "btn", href: `../${apiParam()}`, textContent: "Jouer" }), el("a", { className: "btn", href: planHref(o.today, entry, true), textContent: "Regarder le pilote" })));
    const drawHistogram = (authorMs: number | null) => {
      hist.replaceChildren();
      const h = histogram(o.times, 12);
      if (h.counts.length === 0) {
        hist.append(text("hint", o.times.length === 0 ? "Aucun temps pour l'instant." : "", "p"));
        return;
      }
      const max = Math.max(...h.counts);
      const bars = el("div", { className: "bars" });
      h.counts.forEach((n, i) => {
        const bar = el("div", { className: "bar", title: `${formatTime(h.edges[i]!)} – ${formatTime(h.edges[i + 1]!)} : ${n}` });
        bar.style.height = `${Math.max(4, Math.round((n / max) * 100))}%`;
        bar.dataset.count = String(n);
        bars.append(bar);
      });
      hist.append(bars, el("div", { className: "axis" }, text("lo", formatTime(h.edges[0]!)), text("hi", formatTime(h.edges[h.edges.length - 1]!))));
      void authorMs;
    };
    const known = row?.authorMs ?? null;
    if (known !== null) {
      const m = medalsFor(known);
      medalsNote.textContent = `🏅 auteur ${formatTime(m.author)} · or ${formatTime(m.gold)} · argent ${formatTime(m.silver)} · bronze ${formatTime(m.bronze)}`;
    }
    drawHistogram(known);
    void fillCircuit(t, day, entry, wanted, (c) => {
      const a = c.authorMs ?? known ?? undefined;
      if (a !== undefined) {
        const m = medalsFor(a);
        medalsNote.textContent = `🏅 auteur ${formatTime(m.author)} · or ${formatTime(m.gold)} · argent ${formatTime(m.silver)} · bronze ${formatTime(m.bronze)}`;
      }
      stats.insertBefore(statLines(c, a), hist);
    });
  }

  // Planning
  function renderPlanning(wanted: () => boolean) {
    const list = $("planning");
    const o = overview!;
    const today = parseDay(o.today)!;
    const canReplace = backendFor() !== null && !(backendFor()!.kind === "api" && !token);
    list.replaceChildren();
    for (const day of planningDays(today)) {
      const date = formatDay(day);
      const entry = planOf(date);
      const card = el("article", { className: "card" });
      card.dataset.date = date;
      card.dataset.variant = String(entry.variant);
      const t = thumbBox();
      const theme = entry.theme ?? themeForDay(day).name;
      const head = el("div", { className: "title" }, text("rel", relativeLabel(day, today)), text("date", date), text("num", `#${circuitNumber(day)}`), text("theme", themeLabel(theme)), isReplaced(entry) && text("badge", entry.variant > 0 ? `variante ${entry.variant}` : "thème imposé"));
      const stats = el("div", { className: "statbox" });
      stats.append(statLines(null));
      const actions = el("div", { className: "actions" });
      actions.append(
        el("a", { className: "btn", href: planHref(date, entry), textContent: "Jouer" }),
        el("a", { className: "btn", href: planHref(date, entry, true), textContent: "Regarder le pilote" }),
        button("Remplacer", () => openReplace(day), "replace-btn"),
      );
      (actions.querySelector(".replace-btn") as HTMLButtonElement).disabled = !canReplace;
      if (!canReplace) (actions.querySelector(".replace-btn") as HTMLButtonElement).title = "Pas de serveur connecté";
      card.append(t, el("div", { className: "body" }, head, stats, actions));
      list.append(card);
      void fillCircuit(t, day, entry, wanted, (c) => stats.replaceChildren(statLines(c)));
    }
  }

  // Historique
  function renderHistory() {
    const box = $("history");
    const o = overview!;
    box.replaceChildren();
    const past = o.days.filter((d) => d.date !== o.today);
    if (past.length === 0) {
      box.append(text("hint", "Pas encore de jours passés.", "p"));
      return;
    }
    for (const d of past) {
      const day = parseDay(d.date)!;
      const theme = d.theme ?? themeForDay(day).name;
      const used = d.variant > 0 ? `variante ${d.variant}` : d.theme ? "thème imposé" : "circuit d'origine";
      const link = el("a", { className: "btn small", href: `../?seed=${d.date}${base ? `&api=${encodeURIComponent(base)}` : ""}`, textContent: "Rejouer" });
      box.append(
        el("div", { className: "hrow" }, text("num", `#${d.number}`), text("date", d.date), text("theme", themeLabel(theme)), text("players", `${d.participants} joueur${d.participants > 1 ? "s" : ""}`), text("best", d.bestMs != null ? formatTime(d.bestMs) : "—"), text("used", used), link),
      );
    }
  }

  // --- Remplacement -----------------------------------------------------------------------------------------------

  function openReplace(day: number) {
    const found = backendFor();
    if (!found) return;
    const backend: AdminBackend = found;
    const date = formatDay(day);
    const panel = $("replace");
    const current = planOf(date);
    const natural = themeForDay(day).name;
    let theme: ThemeName = current.theme ?? natural;
    let page = 0;
    let tick = 0;
    const close = () => {
      tick++;
      panel.hidden = true;
      panel.replaceChildren();
    };

    const message = text("hint", "", "p");
    message.id = "replace-msg";
    const grid = el("div", { className: "cards", id: "candidates" });
    const themeSel = el("select", { id: "replace-theme" });
    for (const n of THEME_NAMES) themeSel.append(new Option(n === natural ? `${themeLabel(n)} (thème du jour)` : themeLabel(n), n));
    themeSel.value = theme;
    themeSel.addEventListener("change", () => {
      theme = themeSel.value as ThemeName;
      page = 0;
      drawCandidates();
    });
    const more = button("Autres variantes", () => {
      page++;
      drawCandidates();
    }, "more");
    const revert = button("Revenir à l'original", () => confirmStep(revertBtnHost, "Revenir au circuit d'origine ?", async () => apply(() => backend.revert(date), "Circuit d'origine rétabli.")), "revert");
    revert.hidden = !isReplaced(current);
    const revertBtnHost = el("span", { className: "confirmhost" }, revert);

    function confirmStep(host: HTMLElement, question: string, go: () => Promise<void>) {
      const original = [...host.childNodes];
      const ok = button("Confirmer", () => void go(), "go");
      const no = button("Annuler", () => host.replaceChildren(...original));
      host.replaceChildren(text("ask", question), ok, no);
    }

    async function apply(call: () => Promise<ApiResult<unknown>>, done: string) {
      message.textContent = "Enregistrement…";
      const r = await call();
      if (!r.ok) {
        message.textContent = r.message;
        message.dataset.kind = "error";
        return;
      }
      close();
      await refresh();
      status(`${done} (${date})`);
    }

    function candidateCard(variant: number): HTMLElement {
      const entry: PlanEntry = { variant, theme: imposedTheme(day, theme) };
      const card = el("article", { className: "card candidate" });
      card.dataset.variant = String(variant);
      const t = thumbBox();
      const stats = el("div", { className: "statbox" });
      stats.append(statLines(null));
      const actions = el("div", { className: "actions" });
      const host = el("span", { className: "confirmhost" });
      const choose = button("Choisir", () =>
        confirmStep(host, `Remplacer le ${date} par la variante ${variant} ?`, () => apply(() => backend.replace(date, entry), `Variante ${variant} choisie`)),
      "choose");
      host.append(choose);
      actions.append(el("a", { className: "btn", href: planHref(date, entry), textContent: "Jouer" }), el("a", { className: "btn", href: planHref(date, entry, true), textContent: "Regarder le pilote" }), host);
      card.append(t, el("div", { className: "body" }, el("div", { className: "title" }, text("rel", `Variante ${variant}`), text("theme", themeLabel(theme))), stats, actions));
      const mine = tick;
      void fillCircuit(t, day, entry, () => tick === mine && !panel.hidden, (c) => stats.replaceChildren(statLines(c)));
      return card;
    }

    function drawCandidates() {
      tick++;
      grid.replaceChildren(...candidateVariants(page, current.variant).map(candidateCard));
      more.hidden = !hasMoreCandidates(page);
      message.textContent = "";
      message.dataset.kind = "";
    }

    panel.replaceChildren(
      el("div", { className: "sheet" },
        el("div", { className: "head" }, text("h", `Remplacer le circuit du ${date}`, "div"), button("✕", close, "close")),
        text("hint", `Les ${CANDIDATES} variantes sont générées dans ce navigateur, avec le même code que le serveur. Tu peux les essayer (Jouer, Regarder le pilote) avant de choisir.`, "p"),
        el("div", { className: "row" }, el("label", { className: "name", textContent: "Thème" }), themeSel, text("hint", isReplaced(current) ? `En vigueur : ${current.variant > 0 ? `variante ${current.variant}` : "thème imposé"}` : "En vigueur : circuit d'origine")),
        grid,
        el("div", { className: "actions" }, more, revertBtnHost),
        message,
      ),
    );
    panel.hidden = false;
    drawCandidates();
  }

  $("replace").addEventListener("click", (e) => {
    if (e.target === $("replace")) {
      $("replace").hidden = true;
      $("replace").replaceChildren();
    }
  });

  void refresh();
}
