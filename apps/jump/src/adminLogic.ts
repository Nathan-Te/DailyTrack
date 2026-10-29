import { JUMP_THEME_NAMES, type JumpThemeName } from "@cdj/jump-sim";
import { MODULE_INDEX } from "./moduleIndex";

// Page /jump/admin/ : construit l'adresse du jeu à partir de choix de test. Logique pure (testée par Vitest) ; le DOM est dans `admin.ts`. Rien de tout cela ne touche à la
// simulation : ce ne sont que les paramètres d'adresse que le jeu connaît déjà (`urlOptions.ts`, seul lecteur de l'adresse ; un test relit chaque adresse construite ici avec
// `readUrlOptions`). Le module n'importe ni `urlOptions.ts` ni `themes.ts` (la palette de chaque thème) : la page d'outils ne tire pas le jeu avec elle.

/** Ce que la page ouvre : le niveau du jour, un niveau écrit à la main (`?scenario=`), un morceau, la galerie des morceaux ou l'outil de la variété. */
export type Cible = "jour" | "essai" | "dangers" | "bac-a-sable" | "vent" | "morceau" | "galerie" | "semaine";
/** Les niveaux écrits à la main (`SCENARIOS` de `urlOptions.ts` : un test vérifie que ce sont les mêmes). */
export const SCENARIOS_ADMIN = ["essai", "dangers", "bac-a-sable", "vent"] as const;
export const CIBLES: readonly Cible[] = ["jour", "essai", "dangers", "bac-a-sable", "vent", "morceau", "galerie", "semaine"];

/** Le nom de chaque thème (le jeu lit `theme.<code>` de son catalogue ; la page d'outils, en français seulement, a le sien : un test vérifie la liste). */
export const NOMS_THEMES: Readonly<Record<JumpThemeName, string>> = { foret: "Forêt", usine: "Usine", glace: "Glace", nuit: "Nuit", neon: "Néon" };

export interface AdminJumpState {
  cible: Cible;
  /** AAAA-MM-JJ du niveau du jour (`?seed=`, "" : aujourd'hui) ; pour `semaine` : le premier des sept jours ("" : aujourd'hui). */
  date: string;
  /** Thème imposé (`?theme=`, "" : celui du jour) : sur le niveau du jour c'est un essai, jamais enregistré. */
  theme: "" | JumpThemeName;
  /** Le morceau à jouer (`?module=`) et sa variante, son entrée. Seulement pour la cible `morceau`. */
  morceau: string;
  variante: string;
  entree: "" | "elan";
  /** Regarder la rediffusion de l'auteur (`&solution`) : jour et morceau, **hors production** (lot R9). */
  solution: boolean;
  /** Avec `semaine` : `generateur=13` / `14`, la semaine telle que l'aurait faite un ancien générateur (hors production). */
  generateur: "" | "13" | "14";
  debug: boolean;
  tune: boolean;
  sprint: boolean;
  hitbox: boolean;
  /** `?pieces=off` : cache les limites des morceaux dessinées sur le niveau du jour (avec `debug`). */
  piecesOff: boolean;
  fxOff: boolean;
  metronomeOff: boolean;
  touch: "" | "1" | "0";
  zones: boolean;
  ghost: "" | "off" | "best" | "first";
  watch: "" | "best" | "first";
  /** `?carnage=demo` : un carnage de démonstration tout de suite (hors production). */
  carnageDemo: boolean;
  accueil: "" | "0" | "1";
  archives: boolean;
  /** Adresse de l'API de classement ("" : celle de la construction ; `demo` : le classement de démonstration). */
  api: string;
}

export const DEFAULT_ADMIN: Readonly<AdminJumpState> = Object.freeze({
  cible: "jour",
  date: "",
  theme: "",
  morceau: "",
  variante: "",
  entree: "",
  solution: false,
  generateur: "",
  debug: false,
  tune: false,
  sprint: false,
  hitbox: false,
  piecesOff: false,
  fxOff: false,
  metronomeOff: false,
  touch: "",
  zones: false,
  ghost: "",
  watch: "",
  carnageDemo: false,
  accueil: "",
  archives: false,
  api: "",
});

/** Le contexte de la page : le site publié ferme certains outils (lot R9), et `aujourdhui` (AAAA-MM-JJ, Paris) date l'outil de la variété. */
export interface ContexteAdmin {
  /** Construction de production : `&solution`, `?carnage=demo`, `?semaine=` et `&generateur=` sont fermés (le jeu les ignore) — la page ne les propose pas. */
  restreint: boolean;
  aujourdhui: string;
}

/** Les morceaux du catalogue (identifiant, nombre de variantes) : l'index léger du jeu, sans charger un morceau. */
export const MORCEAUX: readonly (readonly [string, number])[] = MODULE_INDEX;

/** Ce qui est fermé sur le site publié (rien dans l'adresse ne le rouvre : `readUrlOptions(…, restricted)`). */
export const FERME_EN_PRODUCTION = ["solution", "carnage", "semaine", "generateur"] as const;

/** La cible permise : l'outil de la variété n'existe pas en production. */
export function cibleDe(s: Readonly<AdminJumpState>, c: ContexteAdmin): Cible {
  return c.restreint && s.cible === "semaine" ? "jour" : s.cible;
}

/**
 * Les paramètres en train de s'écrire (`urlOptions.ts` est le seul fichier du jeu qui lit une adresse, `jeu.test.ts` y veille : ici on n'en écrit que le texte, sans classe de lecture d'adresse).
 * `set(nom)` écrit un drapeau, `set(nom, valeur)` un paramètre ; un seul paramètre de chaque nom (le dernier écrit l'emporte).
 */
function adresse() {
  const parametres = new Map<string, string>();
  return {
    set: (nom: string, valeur = "") => void parametres.set(nom, valeur),
    toString: () => [...parametres].map(([nom, valeur]) => (valeur === "" ? nom : `${nom}=${encodeURIComponent(valeur)}`)).join("&"),
  };
}

/** Paramètres d'adresse (sans « ? ») : uniquement ce qui s'écarte de la valeur par défaut. */
export function buildQuery(s: Readonly<AdminJumpState>, c: ContexteAdmin): string {
  const p = adresse();
  const cible = cibleDe(s, c);
  const jour = cible === "jour";
  const morceau = cible === "morceau" && MORCEAUX.some(([id]) => id === s.morceau);

  if (cible === "semaine") {
    p.set("semaine", s.date || c.aujourdhui);
    if (s.generateur) p.set("generateur", s.generateur);
  } else if (cible === "galerie" || (cible === "morceau" && !morceau)) {
    p.set("modules", ""); // un morceau absent ouvre la galerie (comme le jeu)
  } else if (morceau) {
    p.set("module", s.morceau);
    const n = MORCEAUX.find(([id]) => id === s.morceau)![1];
    if (s.variante !== "" && Number(s.variante) > 0 && Number(s.variante) < n) p.set("variante", String(Number(s.variante)));
    if (s.entree === "elan") p.set("entree", "elan");
    if (s.solution && !c.restreint) p.set("solution", "");
  } else if (cible !== "jour") {
    p.set("scenario", cible);
  } else {
    if (s.date) p.set("seed", s.date);
    if (s.solution && !c.restreint) p.set("solution", "");
    if (s.watch) p.set("watch", s.watch);
    if (s.archives) p.set("archives", "");
  }
  // Le thème imposé : le niveau du jour devient un essai ; sur un morceau ou un scénario il ne change que le décor (le jeu le lit partout).
  if (s.theme && cible !== "semaine" && cible !== "galerie") p.set("theme", s.theme);
  if (!jour && s.watch === "best" && cible !== "semaine" && cible !== "galerie") p.set("watch", "best");
  if (s.carnageDemo && !c.restreint && cible !== "semaine" && cible !== "galerie") p.set("carnage", "demo");

  // `tune`, `sprint`, `hitbox` et `pieces` ne marchent qu'avec `debug` : on le sous-entend.
  const debug = s.debug || s.tune || s.hitbox || s.piecesOff || s.sprint;
  if (debug) p.set("debug", "");
  const tune = s.tune || s.sprint;
  if (tune) p.set("tune", "");
  if (s.sprint) p.set("sprint", "1");
  if (s.hitbox) p.set("hitbox", "");
  if (s.piecesOff) p.set("pieces", "off");
  if (s.fxOff) p.set("fx", "off");
  if (s.metronomeOff) p.set("metronome", "off");
  if (s.touch !== "") p.set("touch", s.touch);
  if (s.zones) p.set("zones", "");
  if (s.ghost !== "") p.set("ghost", s.ghost);
  if (jour && s.accueil !== "" && !s.archives) p.set("accueil", s.accueil);
  if (s.api.trim() !== "") p.set("api", s.api.trim());
  return p.toString();
}

/** Adresse relative du jeu depuis `/jump/admin/` (le jeu est dans le dossier du dessus : `../`). */
export function gameHref(s: Readonly<AdminJumpState>, c: ContexteAdmin): string {
  const q = buildQuery(s, c);
  return q ? `../?${q}` : "../";
}

const DATE = /^(\d{4}-\d{2}-\d{2})?$/;
const dans = <T extends string>(v: unknown, permis: readonly T[]): v is T => typeof v === "string" && (permis as readonly string[]).includes(v);

/** Lit un état depuis un texte JSON ; toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseAdmin(raw: string | null): AdminJumpState {
  const s: AdminJumpState = { ...DEFAULT_ADMIN };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof AdminJumpState, unknown>>;
    if (dans(o.cible, CIBLES)) s.cible = o.cible;
    if (typeof o.date === "string" && DATE.test(o.date)) s.date = o.date;
    if (dans(o.theme, ["", ...JUMP_THEME_NAMES] as const)) s.theme = o.theme;
    if (typeof o.morceau === "string" && (o.morceau === "" || MORCEAUX.some(([id]) => id === o.morceau))) s.morceau = o.morceau;
    if (typeof o.variante === "string" && /^\d{0,2}$/.test(o.variante)) s.variante = o.variante;
    if (dans(o.entree, ["", "elan"] as const)) s.entree = o.entree;
    if (dans(o.generateur, ["", "13", "14"] as const)) s.generateur = o.generateur;
    for (const k of ["solution", "debug", "tune", "sprint", "hitbox", "piecesOff", "fxOff", "metronomeOff", "zones", "carnageDemo", "archives"] as const) if (typeof o[k] === "boolean") s[k] = o[k] as boolean;
    if (dans(o.touch, ["", "1", "0"] as const)) s.touch = o.touch;
    if (dans(o.ghost, ["", "off", "best", "first"] as const)) s.ghost = o.ghost;
    if (dans(o.watch, ["", "best", "first"] as const)) s.watch = o.watch;
    if (dans(o.accueil, ["", "0", "1"] as const)) s.accueil = o.accueil;
    if (typeof o.api === "string") s.api = o.api.slice(0, 300);
  } catch {
    /* état illisible : valeurs par défaut */
  }
  return s;
}

/** Clés de stockage du jeu (`jump:…`) : records, réglages, mémoire du jour, historique, fantôme. Les choix de la page d'outils (`jump:admin…`) restent. */
export function gameKeys(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith("jump:") && !k.startsWith("jump:admin")).sort();
}

/** Un jour de la liste « Calendrier » : sa date, son numéro de niveau (celui que le jeu écrit : `levelNumber`), son thème, s'il est figé, passé, aujourd'hui ou à venir. */
export interface LigneJour {
  date: string;
  numero: number;
  theme: JumpThemeName;
  etat: "passe" | "aujourdhui" | "avenir";
  fige: boolean;
}

export const PRESETS: { label: string; hint: string; state: Partial<AdminJumpState>; ferme?: boolean }[] = [
  { label: "Réglage du personnage", hint: "bac à sable + panneau de réglages (?scenario=bac-a-sable&debug&tune)", state: { cible: "bac-a-sable", tune: true } },
  { label: "Niveau d'essai", hint: "≈ 22 s, tous les dangers (?scenario=essai)", state: { cible: "essai" } },
  { label: "Boîtes de collision", hint: "l'essai avec les boîtes justes, les surfaces et les blocs (?debug&hitbox)", state: { cible: "essai", hitbox: true } },
  { label: "Dangers un à un", hint: "la galerie : chaque danger seul (?scenario=dangers)", state: { cible: "dangers" } },
  { label: "Courants d'air", hint: "la galerie du vent dans le thème forêt (?scenario=vent&debug&hitbox)", state: { cible: "vent", hitbox: true } },
  { label: "Galerie des morceaux", hint: "intention, étiquettes, exigence et durée de chaque variante (?modules)", state: { cible: "galerie" } },
  { label: "Niveau du jour, outils de test", hint: "le niveau du jour avec window.__jump (?debug)", state: { debug: true } },
  { label: "Classement de démonstration", hint: "des joueurs fictifs sur 14 jours, rien n'est envoyé (?api=demo)", state: { api: "demo" } },
  { label: "Archives de démonstration", hint: "l'accueil ouvert sur la liste des archives (?api=demo&archives)", state: { api: "demo", archives: true } },
  { label: "Carnage de démonstration", hint: "la solution de l'auteur en héros, des vies fictives (?scenario=essai&carnage=demo) ; fermé sur le site publié", state: { cible: "essai", carnageDemo: true }, ferme: true },
  { label: "Essai tactile", hint: "la souris simule le doigt, zones dessinées (?touch=1&zones)", state: { touch: "1", zones: true } },
  { label: "Variété de la semaine", hint: "les 7 niveaux du jour côte à côte (?semaine=…) ; fermé sur le site publié", state: { cible: "semaine" }, ferme: true },
];
