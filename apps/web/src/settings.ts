// Réglages du jeu (lot 29) : graphismes et jeu, mémorisés dans le navigateur (`cdj:settings`) et versionnés comme les réglages tactiles
// (`cdj:touch`, voir touch.ts). Logique pure, sans DOM : le panneau (settingsUi.ts) lit et écrit ces valeurs, main.ts les applique.
// Présentation seule : rien ici ne touche à la simulation ni aux rediffusions.
//
// Hors de ce fichier, restent à leur place : le son (`cdj:audio`, audioLogic.ts), les commandes tactiles (`cdj:touch`, touch.ts) et la
// caméra (`cdj:camera`, la touche C la change aussi : une seule vérité pour « caméra par défaut »).

export type QualityChoice = "auto" | "low" | "medium" | "high";
/** Sensation de vitesse : champ de vision, lignes de vitesse, vibration de la caméra. */
export type SpeedFeel = "off" | "soft" | "normal" | "strong";
/** Fantôme suivi au départ. */
export type GhostChoice = "mine" | "first" | "ahead" | "none";
export type SpeedUnit = "kmh" | "mph";

export interface GameSettings {
  quality: QualityChoice;
  /** Particules (fumée, étincelles, flammes, confettis). */
  particles: boolean;
  /** Traces de pneus. */
  skids: boolean;
  /** Secousses de caméra (chocs, réceptions, vibreurs). */
  shake: boolean;
  speedFeel: SpeedFeel;
  /** Ombres portées (qualité moyenne et haute). */
  shadows: boolean;
  ghost: GhostChoice;
  /** Classement affiché en course (la touche L, ou le bouton du classement, change aussi ce choix : il est mémorisé). */
  board: boolean;
  /** Temps intermédiaires affichés en course. */
  splits: boolean;
  unit: SpeedUnit;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  quality: "auto",
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
 * Version 1 : première version (lot 29) ; rien à migrer.
 */
export const SETTINGS_VERSION = 1;

export const SETTINGS_KEY = "cdj:settings";

export const QUALITY_CHOICES: readonly QualityChoice[] = ["auto", "low", "medium", "high"];
export const QUALITY_LABEL: Record<QualityChoice, string> = { auto: "Automatique", low: "Basse", medium: "Moyenne", high: "Haute" };
/** Niveau de qualité du rendu (0 basse, 1 moyenne, 2 haute) d'un choix fixe ; `null` pour l'automatique. */
export const QUALITY_LEVEL: Record<QualityChoice, 0 | 1 | 2 | null> = { auto: null, low: 0, medium: 1, high: 2 };

export const SPEED_FEEL_CHOICES: readonly SpeedFeel[] = ["off", "soft", "normal", "strong"];
export const SPEED_FEEL_LABEL: Record<SpeedFeel, string> = { off: "Aucune", soft: "Douce", normal: "Normale", strong: "Forte" };
/** Facteur appliqué à l'ouverture du champ de vision, aux lignes de vitesse et à la vibration de la caméra. */
export const SPEED_FEEL_FACTOR: Record<SpeedFeel, number> = { off: 0, soft: 0.5, normal: 1, strong: 1.5 };

export const GHOST_CHOICES: readonly GhostChoice[] = ["mine", "first", "ahead", "none"];
export const GHOST_LABEL: Record<GhostChoice, string> = { mine: "Mon record", first: "Le premier", ahead: "Le joueur devant", none: "Aucun" };

export const UNIT_LABEL: Record<SpeedUnit, string> = { kmh: "km/h", mph: "mph" };

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

/** Réglages lus d'un texte JSON ; toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function parseSettings(raw: string | null): GameSettings {
  const s: GameSettings = { ...DEFAULT_SETTINGS };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof GameSettings | "version", unknown>>;
    s.quality = oneOf(QUALITY_CHOICES, o.quality) ?? s.quality;
    s.speedFeel = oneOf(SPEED_FEEL_CHOICES, o.speedFeel) ?? s.speedFeel;
    s.ghost = oneOf(GHOST_CHOICES, o.ghost) ?? s.ghost;
    s.unit = oneOf(["kmh", "mph"] as const, o.unit) ?? s.unit;
    for (const k of ["particles", "skids", "shake", "shadows", "board", "splits"] as const) if (typeof o[k] === "boolean") s[k] = o[k] as boolean;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return s;
}

export function loadSettings(): GameSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Readonly<GameSettings>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION }));
  } catch {
    /* stockage indisponible : les réglages ne survivront pas à la session */
  }
}

/** Vitesse affichée (`ms` m/s) dans l'unité choisie : « 142 km/h » ou « 88 mph ». */
export function formatSpeed(ms: number, unit: SpeedUnit): string {
  return unit === "mph" ? `${Math.round(ms * 2.2369363)} mph` : `${Math.round(ms * 3.6)} km/h`;
}

/**
 * Qualité à appliquer : `?quality=0|1|2` (essais) l'emporte, sinon le choix du joueur. `fixed` : le niveau est figé ; sinon c'est le
 * réglage automatique (selon la fluidité) qui décide.
 */
export function qualityPlan(choice: QualityChoice, urlLevel: string | null): { fixed: boolean; level: 0 | 1 | 2 } {
  if (urlLevel === "0" || urlLevel === "1" || urlLevel === "2") return { fixed: true, level: Number(urlLevel) as 0 | 1 | 2 };
  const level = QUALITY_LEVEL[choice];
  return level === null ? { fixed: false, level: 2 } : { fixed: true, level };
}
