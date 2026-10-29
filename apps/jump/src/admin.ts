import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { numeroDeJournee } from "@cdj/core/lancement";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, jumpThemeForDay, levelNumber } from "@cdj/jump-sim";
import { LIEN_CONNEXION, TEXTES_ACCES, baseDeLaPage, verifierAcces, type Acces } from "./adminAcces";
import {
  CIBLES,
  DEFAULT_ADMIN,
  MORCEAUX,
  NOMS_THEMES,
  PRESETS,
  cibleDe,
  gameHref,
  gameKeys,
  parseAdmin,
  type AdminJumpState,
  type Cible,
  type ContexteAdmin,
  type LigneJour,
} from "./adminLogic";
import { BUILD_API_URL, BUILD_RESTRICTED, gameStorage } from "./storage";
import { readUrlOptions } from "./urlOptions";

// Page /jump/admin/ : les outils de Jump (calendrier des niveaux, menu des outils de test, données locales). Sœur de /track/admin/ (`apps/web/src/admin.ts`). Choix mémorisés
// (`jump:admin`), adresse du jeu recalculée à chaque changement. **Rien n'est monté ni lu tant que la session du panneau d'administration n'est pas ouverte** (`adminAcces.ts`).

const KEY = "jump:admin";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
declare const __JUMP_FROZEN_DAYS__: readonly string[] | undefined;
const FIGES: readonly string[] = typeof __JUMP_FROZEN_DAYS__ === "undefined" ? [] : __JUMP_FROZEN_DAYS__;

const CIBLES_TEXTE: Record<Cible, string> = {
  jour: "Niveau du jour",
  essai: "Essai (tous les dangers)",
  dangers: "Dangers un à un",
  "bac-a-sable": "Bac à sable du personnage",
  vent: "Courants d'air (forêt)",
  morceau: "Un morceau",
  galerie: "Galerie des morceaux",
  semaine: "Variété de la semaine",
};

const ctx = (): ContexteAdmin => ({ restreint: BUILD_RESTRICTED, aujourdhui: formatDay(parisDay(Date.now())) });
const aujourdhui = () => parisDay(Date.now());

let state: AdminJumpState = (() => {
  try {
    return parseAdmin(gameStorage()?.getItem(KEY) ?? null);
  } catch {
    return { ...DEFAULT_ADMIN };
  }
})();

// `/jump/admin/?api=demo` (ou une adresse d'API) : l'adresse de l'URL prime sur la porte ; le champ « Adresse de l'API » ne sert qu'à composer le lien du jeu.
const urlApi = readUrlOptions(location.search, BUILD_RESTRICTED).api; // `urlOptions.ts` est le seul lecteur de l'adresse du jeu (et de cette page : même `?api=`)
if (urlApi) state = { ...state, api: urlApi.slice(0, 300) };

function save() {
  try {
    gameStorage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible */
  }
}

function set(patch: Partial<AdminJumpState>) {
  state = { ...state, ...patch };
  save();
  render();
}

// --- Les contrôles, construits une fois -------------------------------------------------------------------------------------------------------------
const cibles = $("cibles");
for (const c of CIBLES) {
  const l = document.createElement("label");
  l.className = "opt";
  const r = document.createElement("input");
  r.type = "radio";
  r.name = "cible";
  r.value = c;
  r.addEventListener("change", () => set({ cible: c }));
  l.append(r, CIBLES_TEXTE[c]);
  cibles.append(l);
}

const theme = $<HTMLSelectElement>("theme");
theme.append(new Option("Thème du jour", ""));
for (const [nom, label] of Object.entries(NOMS_THEMES)) theme.append(new Option(label, nom));
theme.addEventListener("change", () => set({ theme: theme.value as AdminJumpState["theme"] }));

const morceau = $<HTMLSelectElement>("morceau");
morceau.append(new Option("(choisir un morceau)", ""));
for (const [id, n] of MORCEAUX) morceau.append(new Option(`${id} (${n} variante${n > 1 ? "s" : ""})`, id));
morceau.addEventListener("change", () => set({ morceau: morceau.value, variante: "" }));

$<HTMLInputElement>("variante").addEventListener("input", (e) => set({ variante: (e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 2) }));
$<HTMLSelectElement>("entree").addEventListener("change", (e) => set({ entree: (e.target as HTMLSelectElement).value as AdminJumpState["entree"] }));
$<HTMLSelectElement>("generateur").addEventListener("change", (e) => set({ generateur: (e.target as HTMLSelectElement).value as AdminJumpState["generateur"] }));
$<HTMLInputElement>("date").addEventListener("change", (e) => set({ date: (e.target as HTMLInputElement).value }));
$("today").addEventListener("click", () => set({ date: "" }));

const coches = ["solution", "debug", "tune", "sprint", "hitbox", "piecesOff", "fxOff", "metronomeOff", "zones", "carnageDemo", "archives"] as const;
for (const id of coches) $<HTMLInputElement>(id).addEventListener("change", (e) => set({ [id]: (e.target as HTMLInputElement).checked }));
$<HTMLSelectElement>("touch").addEventListener("change", (e) => set({ touch: (e.target as HTMLSelectElement).value as AdminJumpState["touch"] }));
$<HTMLSelectElement>("ghost").addEventListener("change", (e) => set({ ghost: (e.target as HTMLSelectElement).value as AdminJumpState["ghost"] }));
$<HTMLSelectElement>("watch").addEventListener("change", (e) => set({ watch: (e.target as HTMLSelectElement).value as AdminJumpState["watch"] }));
$<HTMLSelectElement>("accueil").addEventListener("change", (e) => set({ accueil: (e.target as HTMLSelectElement).value as AdminJumpState["accueil"] }));
$<HTMLInputElement>("api").addEventListener("input", (e) => set({ api: (e.target as HTMLInputElement).value }));

// Raccourcis : un état complet (les options non citées repartent de zéro). Sur le site publié, ceux qui reposent sur un outil fermé ne sont pas proposés.
const presets = $("presets");
for (const p of PRESETS) {
  if (p.ferme && BUILD_RESTRICTED) continue;
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
    await navigator.clipboard.writeText(new URL(gameHref(state, ctx()), location.href).href);
    b.textContent = "Copié ✓";
  } catch {
    b.textContent = "Copie impossible";
  }
  setTimeout(() => (b.textContent = label), 1500);
});

function renderKeys() {
  let keys: string[] = [];
  try {
    const st = gameStorage();
    if (st) keys = gameKeys(Array.from({ length: st.length }, (_, i) => st.key(i) ?? "").filter(Boolean));
  } catch {
    /* stockage indisponible */
  }
  $("keys").textContent = keys.length ? keys.join("\n") : "(rien)";
}
$("wipe").addEventListener("click", () => {
  if (!confirm("Effacer les meilleurs essais, l'historique, les réglages et le fantôme de ce navigateur ?")) return;
  try {
    const st = gameStorage();
    if (st) for (const k of gameKeys(Array.from({ length: st.length }, (_, i) => st.key(i) ?? "").filter(Boolean))) st.removeItem(k);
    $("wiped").textContent = "Effacé.";
  } catch {
    $("wiped").textContent = "Impossible.";
  }
  renderKeys();
});

// --- Le rendu : ce qui se montre selon la cible ---------------------------------------------------------------------------------------------------
function render() {
  const c = ctx();
  const cible = cibleDe(state, c);
  for (const r of cibles.querySelectorAll<HTMLInputElement>("input")) {
    r.checked = r.value === cible;
    r.disabled = c.restreint && r.value === "semaine"; // l'outil de la variété est fermé sur le site publié (lot R9)
  }
  const jour = cible === "jour";
  const semaine = cible === "semaine";
  const ouvreUnNiveau = cible !== "galerie" && !semaine;
  $("dayrow").hidden = !(jour || semaine);
  $("date-nom").textContent = semaine ? "Premier jour" : "Date";
  $("date-aide").textContent = semaine ? "les sept niveaux du jour à partir de cette date" : "une date passée s'ouvre en archive ; un jour à venir est refusé sur le site publié";
  $("themerow").hidden = !ouvreUnNiveau;
  $("modulerow").hidden = cible !== "morceau";
  $("generateurrow").hidden = !semaine || c.restreint;
  $("solutionrow").hidden = c.restreint || !(jour || cible === "morceau");
  $("carnagerow").hidden = c.restreint || !ouvreUnNiveau;
  $("archivesrow").hidden = !jour;
  $("watchrow").hidden = !ouvreUnNiveau;
  $("accueilrow").hidden = !jour;
  $<HTMLInputElement>("date").value = state.date;
  theme.value = state.theme;
  morceau.value = state.morceau;
  $<HTMLInputElement>("variante").value = state.variante;
  $<HTMLSelectElement>("entree").value = state.entree;
  $<HTMLSelectElement>("generateur").value = state.generateur;
  for (const id of coches) $<HTMLInputElement>(id).checked = state[id];
  $<HTMLSelectElement>("touch").value = state.touch;
  $<HTMLSelectElement>("ghost").value = state.ghost;
  $<HTMLSelectElement>("watch").value = state.watch;
  $<HTMLSelectElement>("accueil").value = state.accueil;
  $<HTMLInputElement>("api").value = state.api;
  const href = gameHref(state, c);
  $<HTMLAnchorElement>("launch").href = href;
  $("url").textContent = new URL(href, location.href).href;
}

// --- Aujourd'hui et le calendrier -----------------------------------------------------------------------------------------------------------------
const AVANT = 7;
const APRES = 14;

/** Les jours autour d'aujourd'hui : date, numéro de niveau, thème (le code du jeu), état. */
function lignesDuCalendrier(jour: number): LigneJour[] {
  const out: LigneJour[] = [];
  for (let d = jour - AVANT; d <= jour + APRES; d++) {
    const date = formatDay(d);
    out.push({ date, numero: levelNumber(d), theme: jumpThemeForDay(d), etat: d < jour ? "passe" : d === jour ? "aujourdhui" : "avenir", fige: FIGES.includes(date) });
  }
  return out;
}

function cellule(tr: HTMLTableRowElement, texte: string): HTMLTableCellElement {
  const td = tr.insertCell();
  td.textContent = texte;
  return td;
}

function lien(texte: string, href: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = texte;
  return a;
}

function dessinerCalendrier() {
  const jour = aujourdhui();
  const corps = $<HTMLTableSectionElement>("calendrier");
  corps.replaceChildren();
  for (const l of lignesDuCalendrier(jour)) {
    const tr = corps.insertRow();
    tr.dataset.etat = l.etat;
    tr.dataset.date = l.date;
    cellule(tr, l.date);
    cellule(tr, l.numero >= 1 ? String(l.numero) : "—");
    cellule(tr, NOMS_THEMES[l.theme]);
    cellule(tr, `${l.etat === "aujourdhui" ? "aujourd'hui" : l.etat === "avenir" ? "à venir" : "passé"}${l.fige ? " · figé" : ""}`);
    const ouvrir = tr.insertCell();
    // Sur le site publié le jeu refuse un jour à venir : on ne propose pas un lien qui ne mène nulle part ; la rediffusion de l'auteur y est fermée aussi (lot R9).
    if (l.etat !== "avenir" || !BUILD_RESTRICTED) {
      ouvrir.append(lien("Ouvrir", `../?seed=${l.date}&accueil=0`));
      if (!BUILD_RESTRICTED) ouvrir.append(" · ", lien("Solution", `../?seed=${l.date}&solution`));
    }
  }
}

function dessinerAujourdhui() {
  const jour = aujourdhui();
  const date = formatDay(jour);
  const lignes: [string, string][] = [
    ["Date (Paris)", date],
    ["Niveau", String(levelNumber(jour))],
    ["Journée Du Jour", numeroDeJournee(jour) === null ? "avant le lancement" : `n° ${numeroDeJournee(jour)}`],
    ["Thème", NOMS_THEMES[jumpThemeForDay(jour)]],
    ["Générateur", `g${JUMP_GENERATOR_VERSION}`],
    ["Simulation", `v${JUMP_SIM_VERSION}`],
    ["Niveau figé", FIGES.includes(date) ? "oui (publié tel quel)" : "non (généré par le code en vigueur)"],
    ["Niveaux figés publiés", String(FIGES.length)],
  ];
  $("daynow").replaceChildren(
    ...lignes.flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

// --- La porte : rien n'est montré ni lu tant que le serveur n'a pas dit que la session du panneau d'administration (connexion Google) est ouverte -------
const ENVIRONNEMENTS: Record<string, string> = { "playdujour.com": "production", "recette.playdujour.com": "recette" };
const env = ENVIRONNEMENTS[location.hostname] ?? (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname) ? "aperçu" : "local");
$("barre-env").textContent = env;
$("barre-env").dataset.env = env;

const base = () => baseDeLaPage(urlApi, BUILD_API_URL, location.origin);
const memeOrigine = (b: string) => {
  try {
    return new URL(b, location.href).origin === location.origin;
  } catch {
    return false;
  }
};
const verifier = () => verifierAcces(base(), { production: BUILD_RESTRICTED, memeOrigine: memeOrigine(base()) });

function montrerPorte(acces: Extract<Acces, { ouvert: false }>) {
  const texte = TEXTES_ACCES[acces.raison];
  $("outils").hidden = true;
  $("acces").hidden = false;
  $("acces-titre").textContent = texte.titre;
  $("acces-texte").textContent = texte.texte;
  const lienConnexion = $<HTMLAnchorElement>("acces-connexion");
  lienConnexion.hidden = !texte.connexion;
  lienConnexion.href = LIEN_CONNEXION;
}

function dire(texte: string, erreur = false) {
  const el = $("conn-state");
  el.textContent = texte;
  if (erreur) el.dataset.kind = "error";
  else delete el.dataset.kind;
}

let outilsMontes = false;
function ouvrirOutils(acces: Extract<Acces, { ouvert: true }>) {
  $("acces").hidden = true;
  $("outils").hidden = false;
  $("barre-acces").textContent = acces.mode === "session" ? "Connecté" : acces.mode === "demo" ? "Démonstration" : "Local";
  $("demo-banner").hidden = acces.mode !== "demo";
  dire(acces.mode === "session" ? "Connecté par la session du panneau d'administration." : acces.mode === "demo" ? "Démonstration : pas de serveur." : "Poste local : pas de serveur.");
  if (outilsMontes) return;
  outilsMontes = true;
  dessinerAujourdhui();
  dessinerCalendrier();
  render();
  renderKeys();
}

$("refresh").addEventListener("click", () => {
  void verifier().then((acces) => {
    if (acces.ouvert) {
      ouvrirOutils(acces);
      dessinerAujourdhui();
      dessinerCalendrier();
    } else montrerPorte(acces);
  });
});

void verifier().then((acces) => {
  if (acces.ouvert) ouvrirOutils(acces);
  else montrerPorte(acces);
});
