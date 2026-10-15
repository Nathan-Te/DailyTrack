// Source unique des paramètres d'adresse de DailyJump : nom, description, valeurs. Le jeu ne lit l'adresse que par `readUrlOptions`
// (un test vérifie qu'aucun autre fichier ne lit un paramètre absent de cette liste). La future page d'admin de DailyJump lira `URL_OPTIONS`
// pour construire ses liens, comme `adminLogic.ts` de DailyTrack.

import { parseDay } from "@cdj/core";
import { MODULES, MODULE_ENTRIES, type ModuleEntry } from "@cdj/jump-sim";

export interface UrlOption {
  name: string;
  description: string;
  /** Valeurs permises ; vide = drapeau (sa seule présence compte). */
  values: readonly string[];
  /** Valeur prise sans le paramètre (ou avec une valeur inconnue). */
  default?: string;
}

/** Les niveaux qu'on peut ouvrir par `?scenario=`. */
export const SCENARIOS = ["essai", "dangers", "bac-a-sable"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const URL_OPTIONS: readonly UrlOption[] = [
  {
    name: "scenario",
    description:
      "Niveau écrit à la main à ouvrir au lieu du niveau du jour (la page par défaut depuis le lot 5). « essai » : le niveau d'essai du lot 2 (≈ 22 s, tous les dangers) ; « dangers » : la galerie, chaque danger seul ; « bac-a-sable » : le bac à sable du personnage (lot 1). Une valeur inconnue ouvre l'essai.",
    values: SCENARIOS,
  },
  {
    name: "seed",
    description:
      "Le niveau du jour d'une date (AAAA-MM-JJ) : `?seed=2026-10-20`. Une date passée se joue en archive. Sur le site publié, une date future est refusée (le niveau d'aujourd'hui s'ouvre, « Ce niveau n'est pas encore sorti ») ; sur un aperçu de branche ou en local, toutes les dates sont ouvertes. Une date illisible ouvre le niveau du jour.",
    values: [],
  },
  {
    name: "debug",
    description: "Outils de test : surimpression (vitesse, état, compteurs, position) et `window.__jump` (phase, manual, advance, input…).",
    values: [],
  },
  {
    name: "tune",
    description: "Avec `debug` : panneau de réglages du personnage (mémorisé dans `jump:tune`). Une partie aux réglages modifiés n'est jamais enregistrée.",
    values: [],
  },
  {
    name: "sprint",
    description:
      "Avec `debug&tune` : `1` allume l'essai d'élan progressif (lot 8b) aux valeurs de départ (15 tuiles/s après 0,4 s à pleine vitesse au sol, atteint en ≈ 0,57 s). Désactivé par défaut ; une partie avec l'élan est `tuned`, jamais enregistrée. Exemple : `?scenario=bac-a-sable&debug&tune&sprint=1`.",
    values: ["1"],
  },
  {
    name: "hitbox",
    description: "Avec `debug` : dessine les boîtes de collision « justes » (personnage, pics réduits, disques mortels des scies) et les sections.",
    values: [],
  },
  {
    name: "fx",
    description:
      "`off` coupe les effets visuels : éclatement à la mort, poussière, débris, confettis, traînée, tremblement d'écran (comme « Effets visuels : aucun » du menu ⏸, sans toucher au réglage mémorisé). Les taches restent. Affichage seulement.",
    values: ["off"],
  },
  {
    name: "touch",
    description: "Commandes tactiles : `1` les force (la souris simule le doigt, boutons visibles), `0` les coupe ; sans le paramètre, l'appareil décide (pointeur grossier).",
    values: ["1", "0"],
  },
  {
    name: "ghost",
    description: "`off` cache le fantôme de ton meilleur essai du jour (sans changer le réglage mémorisé, bouton 👻 ou touche G).",
    values: ["off"],
  },
  {
    name: "carnage",
    description:
      "`demo` lance tout de suite un carnage de démonstration sur l'essai : le héros est la solution de l'auteur, les autres vies sont des essais fictifs déterministes (perturbations à graine fixe de la solution, rejouées comme des vraies). Rien n'est enregistré.",
    values: ["demo"],
  },
  {
    name: "watch",
    description: "`best` rejoue ton meilleur essai du jour, seul, sans pouvoir jouer (R le relance). Sans meilleur essai, la partie est normale.",
    values: ["best"],
  },
  {
    name: "modules",
    description: "La galerie des morceaux (lot 4) : intention, étiquettes, exigence et durée de chaque variante, avec « Jouer » et « Regarder ».",
    values: [],
  },
  {
    name: "module",
    description: "Joue un morceau du catalogue (lot 4) au lieu d'un scénario : `?module=cheminee`. Un identifiant inconnu ouvre la galerie.",
    values: MODULES.map((m) => m.id),
  },
  {
    name: "variante",
    description: "Avec `module` : la variante (0 par défaut). Une variante qui n'existe pas revient à 0.",
    values: ["0", "1", "2", "3"],
    default: "0",
  },
  {
    name: "entree",
    description: "Avec `module` : `arret` (au départ, immobile ; par défaut) ou `elan` (un couloir de lancement est ajouté devant le palier d'entrée ; la solution part lancée).",
    values: MODULE_ENTRIES,
    default: "arret",
  },
  {
    name: "solution",
    description:
      "Avec `module` : regarder la solution stockée du morceau ; sur le niveau du jour (sans paramètre ou avec `seed`) : regarder la rediffusion de l'auteur (rejouée par `replayAttempt`, qui donne le temps de l'auteur). Sans jouer (R la relance). Ne lève jamais le refus d'une date future.",
    values: [],
  },
  {
    name: "zones",
    description: "Dessine les zones tactiles (←, →, saut, bande haute) et un point par doigt posé : de quoi vérifier les frontières sur un vrai téléphone.",
    values: [],
  },
];

export interface UrlChoices {
  /** Un niveau écrit à la main (`?scenario=`), ou null : le niveau du jour. */
  scenario: Scenario | null;
  /** Le niveau du jour (lot 5) : ni `scenario`, ni morceau, ni galerie. */
  daily: boolean;
  /** `?seed=AAAA-MM-JJ` lu (numéro de jour), null s'il est absent ou illisible. */
  seed: number | null;
  /** `&solution` sur le niveau du jour : la rediffusion de l'auteur. */
  solution: boolean;
  debug: boolean;
  /** Panneau de réglages : seulement avec `debug`. */
  tune: boolean;
  /** Lot 8b : l'essai d'élan progressif aux valeurs de départ (`?sprint=1`) : seulement avec `debug&tune`. */
  sprint: boolean;
  /** `1` / `0` : tactile imposé ou coupé ; `null` : l'appareil décide. */
  touch: "1" | "0" | null;
  /** Zones et doigts dessinés. */
  zones: boolean;
  /** Boîtes de collision dessinées : seulement avec `debug`. */
  hitbox: boolean;
  /** Effets visuels (particules, secousses, traînée) ; `?fx=off` les coupe (pas les taches). */
  fx: boolean;
  /** Fantôme forcé à « caché » (`?ghost=off`). */
  ghostOff: boolean;
  /** Carnage de démonstration au chargement (`?carnage=demo`). */
  carnageDemo: boolean;
  /** Lecture du meilleur essai, sans jouer (`?watch=best`). */
  watchBest: boolean;
  /** La galerie des morceaux (`?modules`, ou un `?module=` inconnu). */
  gallery: boolean;
  /** Le morceau à jouer (`?module=<id>`), sa variante, son entrée, et la lecture de sa solution (`&solution`) ; null : un scénario. */
  module: { id: string; variant: number; entry: ModuleEntry; solution: boolean } | null;
}

export function readUrlOptions(search: string): UrlChoices {
  const params = new URLSearchParams(search);
  const scenario = params.get("scenario");
  const debug = params.has("debug");
  const mod = moduleOf(params);
  const gallery = params.has("modules") || (params.has("module") && mod === null);
  const chosen = scenario === null ? null : (SCENARIOS as readonly string[]).includes(scenario) ? (scenario as Scenario) : "essai";
  const daily = chosen === null && mod === null && !gallery;
  return {
    scenario: chosen,
    daily,
    seed: daily ? parseDay(params.get("seed") ?? "") : null,
    solution: daily && params.has("solution"),
    debug,
    tune: debug && params.has("tune"),
    sprint: debug && params.has("tune") && params.get("sprint") === "1",
    touch: params.get("touch") === "1" ? "1" : params.get("touch") === "0" ? "0" : null,
    zones: params.has("zones"),
    hitbox: debug && params.has("hitbox"),
    fx: params.get("fx") !== "off",
    ghostOff: params.get("ghost") === "off",
    carnageDemo: params.get("carnage") === "demo",
    watchBest: params.get("watch") === "best",
    gallery,
    module: mod,
  };
}

function moduleOf(params: URLSearchParams): UrlChoices["module"] {
  const id = params.get("module");
  const def = MODULES.find((m) => m.id === id);
  if (!def) return null;
  const v = Number(params.get("variante") ?? "0");
  const variant = Number.isInteger(v) && v >= 0 && v < def.variants.length ? v : 0;
  return { id: def.id, variant, entry: params.get("entree") === "elan" ? "elan" : "arret", solution: params.has("solution") };
}

/** Ce qu'un lien interne garde de l'adresse actuelle : les outils et réglages d'affichage (debug, tactile, effets, fantôme). */
function carried(from: UrlChoices): string[] {
  const out: string[] = [];
  if (from.debug) out.push("debug");
  if (from.touch) out.push(`touch=${from.touch}`);
  if (!from.fx) out.push("fx=off");
  if (from.ghostOff) out.push("ghost=off");
  return out;
}

/** Lien vers un morceau : `?module=<id>&variante=<n>[&entree=elan][&solution]`, plus ce que l'adresse actuelle garde. */
export function moduleHref(target: { id: string; variant: number; entry: ModuleEntry; solution?: boolean }, from: UrlChoices): string {
  const parts = [`module=${encodeURIComponent(target.id)}`, `variante=${target.variant}`];
  if (target.entry === "elan") parts.push("entree=elan");
  if (target.solution) parts.push("solution");
  return `?${[...parts, ...carried(from)].join("&")}`;
}

/** Lien vers la galerie des morceaux. */
export function galleryHref(from: UrlChoices): string {
  return `?${["modules", ...carried(from)].join("&")}`;
}

/** Lien vers le niveau d'aujourd'hui (passage de minuit, lot 5) : sans `seed` ni `solution`, avec ce que l'adresse actuelle garde. */
export function dailyHref(from: UrlChoices): string {
  return `?${carried(from).join("&")}`;
}
