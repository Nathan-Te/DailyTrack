// Page /admin : construit l'adresse du jeu à partir de choix de test. Logique pure (testée par Vitest) ; le DOM est dans
// `admin.ts`. Rien de tout cela ne touche à la simulation : ce ne sont que les paramètres d'adresse que le jeu connaît déjà.

export type Scenario = "jour" | "essai" | "pilotage" | "surfaces" | "plat";

export interface AdminState {
  scenario: Scenario;
  /** AAAA-MM-JJ du circuit du jour ("" : aujourd'hui). Seulement pour le scénario `jour`. */
  date: string;
  /** Thème forcé ("" : celui du jour). Seulement pour le scénario `jour`. */
  theme: string;
  /** Panneau de réglages de la voiture (`debug` + `tune`). */
  tune: boolean;
  /** Outils de test (`debug`). */
  debug: boolean;
  demo: boolean;
  fxOff: boolean;
  quality: "" | "0" | "1" | "2";
  shakeOff: boolean;
  ghostOff: boolean;
  touch: "" | "1" | "0";
  /** Accélération du temps (outil `debug`), "" : normal. */
  timescale: string;
  /** Adresse de l'API de classement ("" : aucune). */
  api: string;
}

export const DEFAULT_ADMIN: Readonly<AdminState> = Object.freeze({
  scenario: "jour",
  date: "",
  theme: "",
  tune: false,
  debug: false,
  demo: false,
  fxOff: false,
  quality: "",
  shakeOff: false,
  ghostOff: false,
  touch: "",
  timescale: "",
  api: "",
});

/** Paramètres d'adresse (sans « ? ») : uniquement ce qui s'écarte de la valeur par défaut. */
export function buildQuery(s: Readonly<AdminState>): string {
  const p = new URLSearchParams();
  if (s.scenario !== "jour") p.set("scenario", s.scenario);
  if (s.scenario === "jour") {
    if (s.date) p.set("seed", s.date);
    if (s.theme) p.set("theme", s.theme);
  }
  // `tune` et `timescale` ne marchent qu'avec `debug` : on le sous-entend.
  const debug = s.debug || s.tune || s.timescale !== "";
  if (debug) p.set("debug", "");
  if (s.tune) p.set("tune", "");
  if (s.timescale !== "") p.set("timescale", s.timescale);
  if (s.demo) p.set("demo", "");
  if (s.fxOff) p.set("fx", "off");
  if (s.quality !== "") p.set("quality", s.quality);
  if (s.shakeOff) p.set("shake", "0");
  if (s.ghostOff) p.set("ghost", "off");
  if (s.touch !== "") p.set("touch", s.touch);
  if (s.api.trim() !== "") p.set("api", s.api.trim());
  return p.toString().replace(/=(?=&|$)/g, "");
}

/** Adresse relative du jeu depuis `/admin/` (le jeu est à la racine : `../`). */
export function gameHref(s: Readonly<AdminState>): string {
  const q = buildQuery(s);
  return q ? `../?${q}` : "../";
}

/** Lit un état depuis un texte JSON ; toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseAdmin(raw: string | null): AdminState {
  const s: AdminState = { ...DEFAULT_ADMIN };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof AdminState, unknown>>;
    if (o.scenario === "jour" || o.scenario === "essai" || o.scenario === "pilotage" || o.scenario === "surfaces" || o.scenario === "plat") s.scenario = o.scenario;
    if (typeof o.date === "string" && /^(\d{4}-\d{2}-\d{2})?$/.test(o.date)) s.date = o.date;
    if (typeof o.theme === "string" && ["", "stade", "rallye", "banquise", "nuit", "campagne"].includes(o.theme)) s.theme = o.theme;
    for (const k of ["tune", "debug", "demo", "fxOff", "shakeOff", "ghostOff"] as const) if (typeof o[k] === "boolean") s[k] = o[k] as boolean;
    if (o.quality === "" || o.quality === "0" || o.quality === "1" || o.quality === "2") s.quality = o.quality;
    if (o.touch === "" || o.touch === "1" || o.touch === "0") s.touch = o.touch;
    if (typeof o.timescale === "string" && /^\d{0,2}$/.test(o.timescale)) s.timescale = o.timescale;
    if (typeof o.api === "string") s.api = o.api.slice(0, 300);
  } catch {
    /* état illisible : valeurs par défaut */
  }
  return s;
}

/** Clés de stockage du jeu (`cdj:…`) : records, réglages, caméra, son. */
export function gameKeys(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith("cdj:") && k !== "cdj:admin").sort();
}

export const PRESETS: { label: string; hint: string; state: Partial<AdminState> }[] = [
  { label: "Réglage de la voiture", hint: "circuit de pilotage + panneau de réglages", state: { scenario: "pilotage", tune: true } },
  { label: "Revêtements et blocs", hint: "terre, glace, herbe, turbo, relevés, plaque", state: { scenario: "surfaces" } },
  { label: "Démo automatique", hint: "le pilote roule seul, tous les effets", state: { scenario: "surfaces", demo: true } },
  { label: "Tremplin et sauts", hint: "circuit d'essai", state: { scenario: "essai" } },
  { label: "Essai tactile (souris = doigt)", hint: "interface mobile sur ordinateur", state: { touch: "1" } },
];
