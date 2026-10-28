import { THEMES, themeByName, type Medal } from "@cdj/sim";
import { adminApiBase, apiCall } from "./api";
import { adminHeaders, loadToken } from "./adminBackend";
import { formatTime } from "./format";

// Lot 35 — section « Médailles » de la page d'admin : l'outil de calibrage, en lecture seule. Elle lit `GET /api/admin/medailles` (jeton de
// l'admin, celui du planning) et remplit deux tableaux (par thème, par jour) dont les en-têtes et la légende sont dans le HTML (le JS de
// l'admin compte dans le budget de Track) ; « Copier l'export » donne la réponse entière (JSON, sans identité) à coller dans la session de
// calibrage. Aucune écriture : la route n'en fait pas, la page n'appelle rien d'autre. Toutes les données passent par `textContent`.

/** Cibles du lot 35 (à confirmer par Nathan) : part des joueurs qui finissent ayant **au moins** cette médaille. */
export const MEDAL_TARGETS: Record<Medal, readonly [number, number]> = { author: [0.05, 0.1], gold: [0.25, 0.35], silver: [0.5, 0.6], bronze: [0.85, 0.9] };
const MEDALS = Object.keys(MEDAL_TARGETS) as Medal[];
const PCTS = [10, 25, 50, 75, 90];

type Pct = Record<string, number | null>;
type Shares = Record<Medal, number> | null;
interface Pool {
  days: number;
  players: number;
  ratios: Pct;
  shares: Shares;
  meanDayShares: Shares;
}
export interface MedalReport {
  days: { date: string; number: number; theme: string; open: boolean; pilotMs: number | null; players: number; stats: { percentiles: Pct; ratios: Pct; shares: Shares } | null }[];
  themes: (Pool & { theme: string })[];
  all: Pool;
}

/** Lecture prudente de la réponse du serveur ; `null` si elle n'a pas la forme attendue. */
export function parseMedalReport(raw: unknown): MedalReport | null {
  const r = raw as Partial<MedalReport> | null;
  return r && Array.isArray(r.days) && Array.isArray(r.themes) && r.all && typeof r.all === "object" ? (r as MedalReport) : null;
}

const dec = (x: number) => x.toFixed(1).replace(".", ",");
/** « 12,5 % ». */
export const pct = (x: number | null | undefined): string => (typeof x === "number" ? `${dec(x * 100)} %` : "—");
/** Un rapport au pilote, en écart : 1,052 → « +5,2 % ». */
export const vsPilot = (x: number | null | undefined): string => (typeof x === "number" ? `${x < 1 ? "−" : "+"}${dec(Math.abs(x - 1) * 100)} %` : "—");
/** Une part comparée à sa cible : dans, au-dessus, en dessous. */
export const targetState = (m: Medal, share: number): "in" | "over" | "under" => (share > MEDAL_TARGETS[m][1] ? "over" : share < MEDAL_TARGETS[m][0] ? "under" : "in");

function row(body: HTMLTableSectionElement, cells: (string | [Medal, Shares])[]): void {
  const tr = body.insertRow();
  for (const c of cells) {
    const td = tr.insertCell();
    if (typeof c === "string") td.textContent = c;
    else {
      const s = c[1]?.[c[0]];
      td.textContent = pct(s);
      if (typeof s === "number") td.dataset.cible = targetState(c[0], s);
    }
  }
}

const label = (name: string) => {
  const t = themeByName(name);
  return t ? THEMES[t.name].label : name;
};
const pool = (name: string, p: Pool) => [name, String(p.days), String(p.players), ...PCTS.map((k) => vsPilot(p.ratios[k])), ...MEDALS.map((m): [Medal, Shares] => [m, p.shares]), ...MEDALS.map((m): [Medal, Shares] => [m, p.meanDayShares])];

/** Remplit les deux tableaux de la section. */
export function renderMedalReport(r: MedalReport, themes: HTMLTableSectionElement, days: HTMLTableSectionElement): void {
  themes.replaceChildren();
  days.replaceChildren();
  for (const t of r.themes) row(themes, pool(label(t.theme), t));
  row(themes, pool("Tous", r.all));
  for (const d of r.days) {
    const s = d.stats;
    row(days, [
      d.date + (d.open ? " (en cours)" : ""),
      String(d.number),
      label(d.theme),
      d.pilotMs === null ? "—" : formatTime(d.pilotMs),
      String(d.players),
      ...PCTS.map((k) => (s?.percentiles[k] ? `${formatTime(s.percentiles[k])} (${vsPilot(s.ratios[k])})` : "—")),
      ...MEDALS.map((m): [Medal, Shares] => [m, d.players ? (s?.shares ?? null) : null]),
    ]);
  }
}

/** Monte la section : « Charger », pilotes fictifs, export. `stateApi` : l'adresse d'API choisie dans les outils. */
export function mountMedals(stateApi: () => string): void {
  const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
  let raw = "";
  const say = (s: string, error = false) => {
    $("med-state").textContent = s;
    $("med-state").dataset.kind = error ? "error" : "info";
  };
  $("med-load").addEventListener("click", async () => {
    const base = adminApiBase(stateApi());
    if (!base || base === "demo") return say("Demande le vrai serveur (recette ou production) : pas de médailles en démonstration.", true);
    say("Chargement…");
    const r = await apiCall<unknown>(base, "GET", `/api/admin/medailles${$("med-demo").checked ? "?demo=1" : ""}`, undefined, 20_000, adminHeaders(loadToken()));
    if (!r.ok) return say(`Échec : ${r.status || "réseau"} · ${r.code} (jeton : en haut de la page).`, true);
    const report = parseMedalReport(r.data);
    if (!report) return say("Réponse illisible.", true);
    raw = JSON.stringify(r.data);
    $("med-copy").hidden = false;
    $("med-out").hidden = false;
    say(`${base} · ${report.days.length} jours, ${report.all.players} temps sur les jours fermés.`);
    renderMedalReport(report, $("med-themes") as unknown as HTMLTableSectionElement, $("med-days") as unknown as HTMLTableSectionElement);
  });
  $("med-copy").addEventListener("click", () =>
    navigator.clipboard.writeText(raw).then(
      () => say("Export copié (JSON) : à coller dans la session de calibrage."),
      () => say("Copie refusée par le navigateur.", true),
    ),
  );
}
