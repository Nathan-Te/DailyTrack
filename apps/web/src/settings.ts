import { fNombre } from "./i18n";
import { gameStorage } from "./storage";
import { CHOIX_GRAPHISMES, type ChoixGraphismes } from "./qualite";

// Réglages du jeu (lot 29) : graphismes et jeu, mémorisés dans le navigateur (`cdj:settings`) et versionnés comme les réglages tactiles
// (`cdj:touch`, voir touch.ts). Logique pure, sans DOM : le panneau (settingsUi.ts) lit et écrit ces valeurs, main.ts les applique.
// Présentation seule : rien ici ne touche à la simulation ni aux rediffusions.
//
// Hors de ce fichier, restent à leur place : le son (`cdj:audio`, audioLogic.ts), les commandes tactiles (`cdj:touch`, touch.ts) et la
// caméra (`cdj:camera`, la touche C la change aussi : une seule vérité pour « caméra par défaut »).

/** Sensation de vitesse : champ de vision, lignes de vitesse, vibration de la caméra. */
export type SpeedFeel = "off" | "soft" | "normal" | "strong";
/** Fantôme suivi au départ. */
export type GhostChoice = "mine" | "first" | "ahead" | "none";
export type SpeedUnit = "kmh" | "mph";

export interface GameSettings {
  /** Lot 45 : « Qualité graphique » — le palier de la scène (Auto : la règle de `qualite.ts`). Seul réglage de qualité du joueur : la fluidité dans un palier est toujours automatique (`QualityGovernor`). */
  graphismes: ChoixGraphismes;
  /** Particules (fumée, étincelles, flammes, confettis). */
  particles: boolean;
  /** Traces de pneus. */
  skids: boolean;
  /** Secousses de caméra (chocs, réceptions, vibreurs). */
  shake: boolean;
  speedFeel: SpeedFeel;
  /** Ombres portées (retirées seules par le régulateur de fluidité si le jeu ramerait). */
  shadows: boolean;
  ghost: GhostChoice;
  /** Classement affiché en course (la touche L, ou le bouton du classement, change aussi ce choix : il est mémorisé). */
  board: boolean;
  /** Temps intermédiaires affichés en course. */
  splits: boolean;
  unit: SpeedUnit;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  graphismes: "auto",
  particles: true,
  skids: true,
  shake: true,
  speedFeel: "normal",
  shadows: true,
  ghost: "mine",
  board: true,
  splits: true,
  unit: "kmh",
});

/**
 * Version des réglages enregistrés. Elle monte quand un défaut change de sens : un réglage enregistré avant (autre numéro) retrouve
 * une fois la valeur par défaut des champs concernés, puis le choix du joueur est respecté (même idée que `TOUCH_SETTINGS_VERSION`).
 * Version 1 : première version (lot 29) ; rien à migrer. (Le réglage « Qualité » du lot 9 a été retiré : un `quality` enregistré est ignoré et disparaît à la prochaine
 * écriture, sans changer de version.)
 */
export const SETTINGS_VERSION = 1;

export const SETTINGS_KEY = "cdj:settings";

export const SPEED_FEEL_CHOICES: readonly SpeedFeel[] = ["off", "soft", "normal", "strong"];
export const SPEED_FEEL_KEY: Record<SpeedFeel, string> = { off: "reglages.sensation.off", soft: "reglages.sensation.soft", normal: "reglages.sensation.normal", strong: "reglages.sensation.strong" };
/** Facteur appliqué à l'ouverture du champ de vision, aux lignes de vitesse et à la vibration de la caméra. */
export const SPEED_FEEL_FACTOR: Record<SpeedFeel, number> = { off: 0, soft: 0.5, normal: 1, strong: 1.5 };

export const GHOST_CHOICES: readonly GhostChoice[] = ["mine", "first", "ahead", "none"];
export const GHOST_KEY: Record<GhostChoice, string> = { mine: "reglages.fantome.mine", first: "reglages.fantome.first", ahead: "reglages.fantome.ahead", none: "reglages.fantome.none" };

/** Les unités s'écrivent pareil dans les deux langues. */
export const UNIT_LABEL: Record<SpeedUnit, string> = { kmh: "km/h", mph: "mph" };

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

/** Réglages lus d'un texte JSON ; toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseSettings(raw: string | null): GameSettings {
  const s: GameSettings = { ...DEFAULT_SETTINGS };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof GameSettings | "version", unknown>>;
    s.graphismes = oneOf(CHOIX_GRAPHISMES, o.graphismes) ?? s.graphismes;
    s.speedFeel = oneOf(SPEED_FEEL_CHOICES, o.speedFeel) ?? s.speedFeel;
    s.ghost = oneOf(GHOST_CHOICES, o.ghost) ?? s.ghost;
    s.unit = oneOf(["kmh", "mph"] as const, o.unit) ?? s.unit;
    for (const k of ["particles", "skids", "shake", "shadows", "board", "splits"] as const) if (typeof o[k] === "boolean") s[k] = o[k] as boolean;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return s;
}

/** Un téléphone (écran tactile ou peu de hauteur) : le classement y est replié par défaut en course (charte rév. 7 : le centre et les bords restent libres) ; la pastille du rang l'ouvre. */
export function compactDevice(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse), (max-height: 520px)").matches;
}

/**
 * Réglages enregistrés, sinon ceux par défaut. Sans enregistrement, le classement en course est replié sur téléphone ; **un joueur qui a déjà enregistré ses réglages
 * garde son choix** (limite : un enregistrement ne dit pas si `board` a été choisi ou hérité du défaut).
 */
export function loadSettings(): GameSettings {
  try {
    const raw = gameStorage().getItem(SETTINGS_KEY);
    const s = parseSettings(raw);
    if (raw === null && compactDevice()) s.board = false;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Readonly<GameSettings>): void {
  try {
    gameStorage().setItem(SETTINGS_KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION }));
  } catch {
    /* stockage indisponible : les réglages ne survivront pas à la session */
  }
}

/** Vitesse affichée (`ms` m/s) dans l'unité choisie : « 142 km/h » ou « 88 mph » (espace insécable entre le nombre et l'unité, nombre au format de la langue). */
export function formatSpeed(ms: number, unit: SpeedUnit): string {
  return `${fNombre(Math.round(unit === "mph" ? ms * 2.2369363 : ms * 3.6))}\u00a0${UNIT_LABEL[unit]}`;
}

/**
 * Qualité de fluidité à appliquer : `?quality=0|1|2` (essais) la fige ; sinon elle est automatique (`fixed: false`) : le régulateur part de haut (niveau 2) et
 * baisse seul les détails si le jeu ramerait, puis les remonte. Plus de choix du joueur (« Qualité graphique » décide de la scène, le reste suit la fluidité).
 */
export function qualityPlan(urlLevel: string | null): { fixed: boolean; level: 0 | 1 | 2 } {
  if (urlLevel === "0" || urlLevel === "1" || urlLevel === "2") return { fixed: true, level: Number(urlLevel) as 0 | 1 | 2 };
  return { fixed: false, level: 2 };
}
