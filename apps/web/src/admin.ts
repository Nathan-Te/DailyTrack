import { FIGURES, PREMIER_JOUR, THEMES, THEME_NAMES, formatDay } from "@cdj/sim";
import { RANDOM_SPAN } from "./archive";
import { mountPlanning } from "./adminPlanning";
import { DEFAULT_ADMIN, PRESETS, buildQuery, gameHref, gameKeys, parseAdmin, type AdminState, type Scenario } from "./adminLogic";

// Page /admin : menu des outils de test. Choix mémorisés (`cdj:admin`), adresse du jeu recalculée à chaque changement.

const KEY = "cdj:admin";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let state: AdminState = (() => {
  try {
    return parseAdmin(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_ADMIN };
  }
})();

// `/admin/?api=demo` (ou une adresse d'API) : l'adresse de l'URL prime et se retrouve dans les liens du constructeur.
const urlApi = new URLSearchParams(location.search).get("api");
if (urlApi) state = { ...state, api: urlApi.slice(0, 300) };

const SCENARIOS: [Scenario, string][] = [
  ["jour", "Circuit du jour"],
  ["essai", "Essai (tremplin)"],
  ["pilotage", "Pilotage"],
  ["surfaces", "Surfaces"],
  ["largeurs", "Largeurs"],
  ["vitesse", "Vitesse"],
  ["glace", "Glace"],
  ["relief", "Relief"],
  ["cuves", "Cuves"],
  ["air", "Air"],
  ["bas-cotes", "Bas-côtés"],
  ["figures", "Figures (tour)"],
  ["figure", "Une figure"],
  ["plat", "Terrain plat"],
];

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible */
  }
}

function set(patch: Partial<AdminState>) {
  state = { ...state, ...patch };
  save();
  render();
}

// Scénarios (boutons radio)
const scenarios = $("scenarios");
for (const [value, label] of SCENARIOS) {
  const l = document.createElement("label");
  l.className = "opt";
  const r = document.createElement("input");
  r.type = "radio";
  r.name = "scenario";
  r.value = value;
  r.addEventListener("change", () => set({ scenario: value }));
  l.append(r, label);
  scenarios.append(l);
}

// Thèmes
const theme = $<HTMLSelectElement>("theme");
theme.append(new Option("Thème du jour", ""));
for (const name of THEME_NAMES) theme.append(new Option(THEMES[name].label, name));
theme.addEventListener("change", () => set({ theme: theme.value }));

// Figures (lot 20)
const figureSel = $<HTMLSelectElement>("figure");
figureSel.append(new Option("(première de la liste)", ""));
for (const f of FIGURES) figureSel.append(new Option(`${f.label} (${f.category})`, f.name));
figureSel.addEventListener("change", () => set({ figure: figureSel.value, figureVariant: "" }));
$<HTMLInputElement>("figurevariant").addEventListener("input", (e) => set({ figureVariant: (e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 2) }));
$<HTMLInputElement>("figuremirror").addEventListener("change", (e) => set({ figureMirror: (e.target as HTMLInputElement).checked }));

$<HTMLInputElement>("variant").addEventListener("input", (e) => set({ variant: (e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 2) }));
$<HTMLInputElement>("date").addEventListener("change", (e) => set({ date: (e.target as HTMLInputElement).value }));
$("today").addEventListener("click", () => set({ date: "" }));
$("random").addEventListener("click", () => set({ date: formatDay(PREMIER_JOUR + Math.floor(Math.random() * RANDOM_SPAN)) }));

const checks = ["tune", "debug", "demo", "fxOff", "shakeOff", "ghostOff", "zones"] as const;
for (const id of checks) $<HTMLInputElement>(id).addEventListener("change", (e) => set({ [id]: (e.target as HTMLInputElement).checked }));
$<HTMLSelectElement>("quality").addEventListener("change", (e) => set({ quality: (e.target as HTMLSelectElement).value as AdminState["quality"] }));
$<HTMLSelectElement>("steer").addEventListener("change", (e) => set({ steer: (e.target as HTMLSelectElement).value as AdminState["steer"] }));
$<HTMLSelectElement>("touch").addEventListener("change", (e) => set({ touch: (e.target as HTMLSelectElement).value as AdminState["touch"] }));
$<HTMLSelectElement>("thumbs").addEventListener("change", (e) => set({ thumbs: (e.target as HTMLSelectElement).value as AdminState["thumbs"] }));
$<HTMLInputElement>("timescale").addEventListener("input", (e) => set({ timescale: (e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 2) }));
$<HTMLInputElement>("api").addEventListener("input", (e) => set({ api: (e.target as HTMLInputElement).value }));

// Raccourcis : un état complet (les options non citées repartent de zéro).
const presets = $("presets");
for (const p of PRESETS) {
  const b = document.createElement("button");
  b.type = "button";
  b.append(p.label);
  const small = document.createElement("small");
  small.textContent = p.hint;
  b.append(small);
  b.addEventListener("click", () => set({ ...DEFAULT_ADMIN, api: state.api, ...p.state }));
  presets.append(b);
}

$("reset").addEventListener("click", () => set({ ...DEFAULT_ADMIN }));
$("copy").addEventListener("click", async (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  const label = b.textContent;
  try {
    await navigator.clipboard.writeText(new URL(gameHref(state), location.href).href);
    b.textContent = "Copié ✓";
  } catch {
    b.textContent = "Copie impossible";
  }
  setTimeout(() => (b.textContent = label), 1500);
});

function renderKeys() {
  let keys: string[] = [];
  try {
    keys = gameKeys(Object.keys(localStorage));
  } catch {
    /* stockage indisponible */
  }
  $("keys").textContent = keys.length ? keys.join("\n") : "(rien)";
  $("keys").style.whiteSpace = "pre-line";
}
$("wipe").addEventListener("click", () => {
  if (!confirm("Effacer les records, réglages, caméra et son de ce navigateur ?")) return;
  try {
    for (const k of gameKeys(Object.keys(localStorage))) localStorage.removeItem(k);
    $("wiped").textContent = "Effacé.";
  } catch {
    $("wiped").textContent = "Impossible.";
  }
  renderKeys();
});

function render() {
  for (const r of scenarios.querySelectorAll<HTMLInputElement>("input")) r.checked = r.value === state.scenario;
  const isDay = state.scenario === "jour";
  $("dayrow").hidden = !isDay;
  $("themerow").hidden = !isDay;
  $("variantrow").hidden = !isDay;
  $("figurerow").hidden = state.scenario !== "figure";
  figureSel.value = state.figure;
  $<HTMLInputElement>("figurevariant").value = state.figureVariant;
  $<HTMLInputElement>("figuremirror").checked = state.figureMirror;
  $<HTMLInputElement>("date").value = state.date;
  $<HTMLInputElement>("variant").value = state.variant;
  theme.value = state.theme;
  for (const id of checks) $<HTMLInputElement>(id).checked = state[id];
  $<HTMLSelectElement>("quality").value = state.quality;
  $<HTMLSelectElement>("touch").value = state.touch;
  $<HTMLSelectElement>("thumbs").value = state.thumbs;
  $<HTMLSelectElement>("steer").value = state.steer;
  $<HTMLInputElement>("timescale").value = state.timescale;
  $<HTMLInputElement>("api").value = state.api;
  const href = gameHref(state);
  $<HTMLAnchorElement>("launch").href = href;
  $("url").textContent = new URL(href, location.href).href;
  void buildQuery;
}

render();
renderKeys();
mountPlanning(() => state.api);
