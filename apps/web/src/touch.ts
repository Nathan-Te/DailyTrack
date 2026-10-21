import type { Axes } from "./input";
import { gameStorage } from "./storage";

// Commandes tactiles (lot 10) : logique pure, sans DOM, testée par Vitest. Le tactile produit les mêmes axes
// que le clavier et la manette ; ils passent ensuite par `makeInput` (commandes entières) : rien ne change dans
// `sim`, les rediffusions sont identiques.
//
// Disposition (paysage, lot I4 retouche 2 — charte rév. 7 : « commandes aux bords, boutons par défaut, jamais devant le véhicule ») :
// - mode « Boutons » (défaut) : ← et → en bas à gauche, FREIN et GAZ en bas à droite ; chaque bouton a sa zone de toucher, qui épouse le
//   bouton dessiné (voir `touchLayout`) ; le milieu de l'écran n'a aucune zone : un toucher y est ignoré, le centre reste libre.
// - mode « Glisser » : moitié gauche = direction au glissement relatif au point de pose (analogique, zone morte, sensibilité réglable),
//   comme au lot 10 ; à droite, frein et gaz sont les mêmes boutons qu'en mode boutons.
// - accélérateur automatique : un seul grand FREIN en bas à droite ; l'accélérateur se coupe tant qu'on freine.
// - plusieurs doigts à la fois : on dirige et on freine en même temps.

export type SteerMode = "drag" | "buttons";
export type ButtonSize = "small" | "medium" | "large";

export interface TouchSettings {
  steerMode: SteerMode;
  /** Sensibilité du glissement : 1 = braquage à fond après `FULL_LOCK_PX` pixels ; 2 = deux fois moins. */
  sensitivity: number;
  /** Zone morte, en part du débattement (0–0,3). */
  deadzone: number;
  /** Accélérateur automatique (sinon, par défaut : bouton de gaz, donc deux pédales). */
  autoThrottle: boolean;
  /** Vibration courte au point de contrôle et au choc (si le téléphone sait vibrer). */
  vibration: boolean;
  /** Taille des boutons dessinés (la zone active ne change pas : elle va toujours jusqu'aux bords). */
  buttonSize: ButtonSize;
}

/**
 * Défaut : les **boutons** (charte rév. 7), plus le joystick. Un réglage déjà enregistré (`cdj:touch`) garde ce qu'il a enregistré : `parseTouchSettings`
 * ne force rien. Limite assumée : l'enregistrement écrit tous les réglages d'un coup, il ne dit donc pas si `steerMode` a été choisi ou hérité de
 * l'ancien défaut ; un joueur qui a réglé autre chose (la taille, la vibration) avec l'ancien défaut garde le glissement et peut repasser en boutons
 * dans Réglages › Commandes.
 */
export const DEFAULT_TOUCH_SETTINGS: Readonly<TouchSettings> = Object.freeze({
  steerMode: "buttons",
  sensitivity: 1,
  deadzone: 0.08,
  autoThrottle: false,
  vibration: true,
  buttonSize: "medium",
});

/**
 * Version des réglages enregistrés. Passée à 2 à la retouche 18b (deux pédales par défaut) : un réglage enregistré avant (sans numéro
 * de version) retrouve une fois le nouveau défaut pour l'accélérateur ; ensuite le choix du joueur est respecté.
 */
export const TOUCH_SETTINGS_VERSION = 2;

export const SENSITIVITY_RANGE = { min: 0.5, max: 2, step: 0.05 } as const;
export const DEADZONE_RANGE = { min: 0, max: 0.3, step: 0.01 } as const;

/** Débattement (pixels CSS) qui donne le braquage à fond à sensibilité 1. */
export const FULL_LOCK_PX = 70;

const KEY = "cdj:touch";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Réglages lus d'un texte JSON ; toute valeur absente ou hors limites retombe sur la valeur par défaut. */
export function parseTouchSettings(raw: string | null): TouchSettings {
  const s: TouchSettings = { ...DEFAULT_TOUCH_SETTINGS };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof TouchSettings | "version", unknown>>;
    if (o.steerMode === "drag" || o.steerMode === "buttons") s.steerMode = o.steerMode;
    if (typeof o.sensitivity === "number" && Number.isFinite(o.sensitivity)) s.sensitivity = clamp(o.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max);
    if (typeof o.deadzone === "number" && Number.isFinite(o.deadzone)) s.deadzone = clamp(o.deadzone, DEADZONE_RANGE.min, DEADZONE_RANGE.max);
    // L'ancien défaut (accélérateur automatique) est remis une fois au nouveau ; un choix fait depuis la version 2 est gardé.
    if (typeof o.autoThrottle === "boolean" && o.version === TOUCH_SETTINGS_VERSION) s.autoThrottle = o.autoThrottle;
    if (typeof o.vibration === "boolean") s.vibration = o.vibration;
    if (o.buttonSize === "small" || o.buttonSize === "medium" || o.buttonSize === "large") s.buttonSize = o.buttonSize;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return s;
}

export function loadTouchSettings(): TouchSettings {
  try {
    return parseTouchSettings(gameStorage().getItem(KEY));
  } catch {
    return { ...DEFAULT_TOUCH_SETTINGS };
  }
}

export function saveTouchSettings(s: Readonly<TouchSettings>): void {
  try {
    gameStorage().setItem(KEY, JSON.stringify({ ...s, version: TOUCH_SETTINGS_VERSION }));
  } catch {
    /* stockage indisponible : les réglages ne survivront pas à la session */
  }
}

/**
 * Interface tactile ? `?touch=1` la force (la souris simule le doigt), `?touch=0` la coupe ; sinon l'appareil
 * décide : pointeur principal grossier (`pointer: coarse`).
 */
export function wantsTouch(search: URLSearchParams, coarsePointer: boolean): boolean {
  const forced = search.get("touch");
  if (forced === "1") return true;
  if (forced === "0") return false;
  return coarsePointer;
}

/** Braquage ∈ [-1, 1] pour un glissement horizontal de `dx` pixels : zone morte, puis linéaire jusqu'au plein braquage. */
export function dragSteer(dx: number, s: Pick<TouchSettings, "sensitivity" | "deadzone">): number {
  const range = FULL_LOCK_PX / s.sensitivity;
  const d = Math.abs(dx) / range;
  if (d <= s.deadzone) return 0;
  const v = Math.min(1, (d - s.deadzone) / (1 - s.deadzone));
  return dx < 0 ? -v : v;
}

export type Zone = "steer" | "left" | "right" | "brake" | "gas";

/** Une zone active : tranche verticale de l'écran, de la largeur `x0`–`x1` (parts de la largeur), sur toute la hauteur. */
export interface ZoneSpan {
  zone: Zone;
  x0: number;
  x1: number;
}

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** L'écran de jeu : sa taille (pixels CSS) et ses zones sûres (encoche, barre d'accueil). Les boutons et les zones en dépendent. */
export interface Geometry {
  width: number;
  height: number;
  insets: Insets;
}

const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
/** Un téléphone en paysage, faute de mieux (tests, avant la première mesure de l'écran). */
export const DEFAULT_GEOMETRY: Readonly<Geometry> = Object.freeze({ width: 844, height: 390, insets: NO_INSETS });

/** Marge entre un bouton dessiné et le bord de l'écran (ou la zone sûre) : maquette `track-hud-paysage.html` (10 px), 12 px pour les gestes du bord. */
export const EDGE_MARGIN_PX = 12;
/** Écart entre deux boutons voisins. */
export const BUTTON_GAP_PX = 8;
/** Un bouton fait au moins 44 px de côté, quelle que soit la taille choisie (charte § 10). */
export const MIN_BUTTON_PX = 44;
/** Un doigt déborde un peu de son bouton : la zone active dépasse le dessin de cette marge, du côté du centre (jamais dans le tiers central de l'écran). */
export const ZONE_SLACK_PX = 16;
/** Le centre de l'écran, libre de tout bouton : les groupes de boutons tiennent hors de [30 %, 70 %] de la largeur. */
export const CENTER_FREE = { x0: 0.3, x1: 0.7 } as const;

const SIZE_FACTOR: Record<ButtonSize, number> = { small: 0.72, medium: 1, large: 1.3 };
/** Tailles de la maquette (taille « normale ») : flèches 72 × 72, FREIN 64 × 56, GAZ 84 × 84. */
const BASE = { arrow: 72, brakeW: 64, brakeH: 56, gas: 84 } as const;

export interface ButtonRect {
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Layout = Pick<TouchSettings, "steerMode" | "autoThrottle" | "buttonSize">;

/**
 * Échelle des boutons : celle de la taille choisie, réduite si besoin pour que chaque groupe tienne entre son bord (marge et zone sûre
 * comprises) et le centre libre de l'écran. Les trois tailles respectent donc les bords et le centre, sur tous les écrans.
 */
function scaleFor(g: Geometry, s: Layout): number {
  const left = Math.max(g.insets.left, 0) + EDGE_MARGIN_PX;
  const right = Math.max(g.insets.right, 0) + EDGE_MARGIN_PX;
  // (2 px de réserve : les tailles sont arrondies au pixel, chacune vers le haut au plus d'un demi-pixel)
  let k = SIZE_FACTOR[s.buttonSize];
  if (s.steerMode === "buttons") k = Math.min(k, (CENTER_FREE.x0 * g.width - left - 2) / (2 * BASE.arrow + BUTTON_GAP_PX));
  k = Math.min(k, (CENTER_FREE.x0 * g.width - right - 2) / (BASE.brakeW + BASE.gas + BUTTON_GAP_PX));
  return Math.max(k, 0.1);
}

/**
 * Boutons dessinés (pixels CSS), **une seule définition** pour le dessin et pour les zones (`zoneSpans`) : ← et → en bas à gauche, FREIN et GAZ en
 * bas à droite (un seul grand FREIN avec l'accélérateur automatique), collés aux bords (marge `EDGE_MARGIN_PX`, zones sûres comprises), jamais au
 * centre. Mode glisser : pas de flèches (le joystick apparaît sous le doigt), les pédales sont les mêmes.
 */
export function buttonRects(width: number, height: number, s: Layout, insets: Insets = NO_INSETS): ButtonRect[] {
  const g: Geometry = { width, height, insets };
  const k = scaleFor(g, s);
  const px = (base: number) => Math.max(MIN_BUTTON_PX, Math.round(base * k));
  const bottom = height - Math.max(insets.bottom, 0) - EDGE_MARGIN_PX;
  const right = width - Math.max(insets.right, 0) - EDGE_MARGIN_PX;
  const out: ButtonRect[] = [];
  if (s.steerMode === "buttons") {
    const a = px(BASE.arrow);
    const x0 = Math.max(insets.left, 0) + EDGE_MARGIN_PX;
    out.push({ zone: "left", x: x0, y: bottom - a, w: a, h: a }, { zone: "right", x: x0 + a + BUTTON_GAP_PX, y: bottom - a, w: a, h: a });
  }
  const gas = px(BASE.gas);
  const bw = px(BASE.brakeW);
  const bh = px(BASE.brakeH);
  if (s.autoThrottle) {
    const w = bw + BUTTON_GAP_PX + gas; // un seul grand frein : la place des deux pédales
    out.push({ zone: "brake", x: right - w, y: bottom - gas, w, h: gas });
  } else {
    out.push({ zone: "gas", x: right - gas, y: bottom - gas, w: gas, h: gas }, { zone: "brake", x: right - gas - BUTTON_GAP_PX - bw, y: bottom - bh, w: bw, h: bh });
  }
  return out;
}

/**
 * Découpage de l'écran en zones actives. Chaque zone **épouse son bouton dessiné** (toucher un bouton = sa commande) et va **de bord à bord** sur toute la
 * hauteur : ← de 0 à la frontière entre les deux flèches, → de cette frontière un peu au-delà du bord droit de la flèche ; frein et gaz de même, jusqu'au
 * bord droit de l'écran. Sans trou à l'intérieur d'un groupe ; **le milieu de l'écran n'a aucune zone** (un toucher y est ignoré : le centre reste
 * libre). Mode glisser : la zone de direction est la moitié gauche, comme au lot 10 ; les pédales suivent les boutons.
 */
export function zoneSpans(s: Layout, g: Readonly<Geometry> = DEFAULT_GEOMETRY): ZoneSpan[] {
  const w = g.width;
  const rects = buttonRects(w, g.height, s, g.insets);
  const rect = (z: Zone) => rects.find((r) => r.zone === z);
  const out: ZoneSpan[] = [];
  const left = rect("left");
  const rightArrow = rect("right");
  if (left && rightArrow) {
    const border = (rightArrow.x - BUTTON_GAP_PX / 2) / w;
    out.push({ zone: "left", x0: 0, x1: border }, { zone: "right", x0: border, x1: Math.min(CENTER_FREE.x0 + 0.02, (rightArrow.x + rightArrow.w + ZONE_SLACK_PX) / w) });
  } else out.push({ zone: "steer", x0: 0, x1: 0.5 });
  const brake = rect("brake")!;
  const gas = rect("gas");
  const brakeX0 = (brake.x - ZONE_SLACK_PX) / w;
  if (gas) {
    const border = (gas.x - BUTTON_GAP_PX / 2) / w;
    out.push({ zone: "brake", x0: brakeX0, x1: border }, { zone: "gas", x0: border, x1: 1 });
  } else out.push({ zone: "brake", x0: brakeX0, x1: 1 });
  return out;
}

/** Zone touchée par un doigt posé à l'abscisse `x` (hors de l'écran : la zone du bord) ; `null` au milieu de l'écran : aucune zone, le toucher est ignoré. */
export function zoneAt(x: number, width: number, s: Layout, g?: Readonly<Geometry>): Zone | null {
  const f = width > 0 ? x / width : 0;
  const spans = zoneSpans(s, g ?? { width, height: Math.round((width * DEFAULT_GEOMETRY.height) / DEFAULT_GEOMETRY.width), insets: NO_INSETS });
  if (f < 0) return spans[0]!.zone;
  if (f >= 1) return spans[spans.length - 1]!.zone;
  for (const sp of spans) if (f >= sp.x0 && f < sp.x1) return sp.zone;
  return null;
}

/**
 * Un doigt qui reste dans sa famille de boutons (← → à gauche, frein / gaz à droite) peut glisser de l'un à l'autre, même hors de l'écran ou hors de
 * la zone : la frontière entre les deux boutons de la famille décide (le doigt ne change jamais de famille).
 */
function regroup(zone: Zone, x: number, g: Readonly<Geometry>, s: Layout): Zone {
  const family: Zone[] = zone === "left" || zone === "right" ? ["left", "right"] : zone === "brake" || zone === "gas" ? ["brake", "gas"] : [];
  if (family.length === 0) return zone;
  const spans = zoneSpans(s, g).filter((sp) => family.includes(sp.zone));
  if (spans.length < 2) return spans[0]?.zone ?? zone; // accélérateur automatique : un seul frein
  const f = g.width > 0 ? x / g.width : 0;
  return f < spans[0]!.x1 ? spans[0]!.zone : spans[1]!.zone;
}

interface Finger {
  zone: Zone;
  /** Point de pose du glissement (l'abscisse se déplace derrière le doigt au-delà du plein braquage). */
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface TouchSnapshot {
  steer: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  gas: boolean;
  /** Glissement en cours : point de pose et position du doigt (pour dessiner le curseur). */
  drag: { originX: number; originY: number; x: number; y: number } | null;
}

/** État des doigts posés sur l'écran. Les événements arrivent des « pointer events » (voir `touchUi.ts`). */
export class TouchPad {
  private readonly fingers = new Map<number, Finger>();
  /** Le premier toucher a eu lieu (sert à masquer l'aide). */
  touched = false;
  /** L'écran de jeu (taille et zones sûres) : les zones actives en dépendent ; `touchUi.ts` le met à jour à chaque mesure de l'écran. */
  geometry: Geometry = { ...DEFAULT_GEOMETRY };

  constructor(public settings: TouchSettings = { ...DEFAULT_TOUCH_SETTINGS }) {}

  setGeometry(width: number, height: number, insets: Insets = NO_INSETS): void {
    this.geometry = { width, height, insets };
  }

  get active(): boolean {
    return this.fingers.size > 0;
  }

  down(id: number, x: number, y: number): void {
    this.touched = true;
    const zone = zoneAt(x, this.geometry.width, this.settings, this.geometry);
    if (zone === null) return; // le milieu de l'écran n'a aucune zone : le toucher est ignoré, le centre reste libre
    // Un seul doigt dirige : un second doigt à gauche est ignoré.
    if (this.isSteering(zone) && [...this.fingers.values()].some((f) => this.isSteering(f.zone))) return;
    this.fingers.set(id, { zone, originX: x, originY: y, x, y });
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
    if (f.zone === "steer") {
      // Au-delà du plein braquage, le point de pose suit le doigt : pour revenir, on ne refait pas tout le chemin.
      const range = FULL_LOCK_PX / this.settings.sensitivity;
      const dx = x - f.originX;
      if (dx > range) f.originX = x - range;
      else if (dx < -range) f.originX = x + range;
    } else {
      f.zone = regroup(f.zone, x, this.geometry, this.settings);
    }
  }

  up(id: number): void {
    this.fingers.delete(id);
  }

  /** Lève tous les doigts (changement de réglages, perte de focus…). */
  releaseAll(): void {
    this.fingers.clear();
  }

  private isSteering(zone: Zone): boolean {
    return zone === "steer" || zone === "left" || zone === "right";
  }

  snapshot(): TouchSnapshot {
    const out: TouchSnapshot = { steer: false, left: false, right: false, brake: false, gas: false, drag: null };
    for (const f of this.fingers.values()) {
      if (f.zone === "steer") {
        out.steer = true;
        out.drag = { originX: f.originX, originY: f.originY, x: f.x, y: f.y };
      } else out[f.zone] = true;
    }
    return out;
  }

  /**
   * Axes demandés : même forme que le clavier et la manette. Accélérateur automatique : plein gaz, coupé tant
   * qu'on freine (frein et gaz ensemble s'annuleraient).
   */
  axes(): Axes {
    let steer = 0;
    let brake = 0;
    let gas = 0;
    for (const f of this.fingers.values()) {
      if (f.zone === "steer") steer = dragSteer(f.x - f.originX, this.settings);
      else if (f.zone === "left") steer -= 1;
      else if (f.zone === "right") steer += 1;
      else if (f.zone === "brake") brake = 1;
      else if (f.zone === "gas") gas = 1;
    }
    return {
      steer: clamp(steer, -1, 1),
      throttle: this.settings.autoThrottle ? (brake ? 0 : 1) : gas,
      brake,
    };
  }
}

// --- Retour de vibration -----------------------------------------------------------------------

/** Chute de vitesse (m/s) en un pas de simulation au-delà de laquelle on sent un choc (le freinage à fond en perd ≈ 0,33). */
export const IMPACT_DROP = 0.6;
/** Délai minimal entre deux chocs vibrés (ms). */
export const IMPACT_COOLDOWN_MS = 250;

/** Un choc vient-il d'avoir lieu ? Lecture seule de la vitesse avant et après un pas ; ne touche jamais à la simulation. */
export function impactFelt(speedBefore: number, speedAfter: number): boolean {
  return speedBefore - speedAfter > IMPACT_DROP;
}

/** Vibration courte (rien si le navigateur ne sait pas vibrer, ou si on l'a désactivée). */
export function vibrate(settings: Pick<TouchSettings, "vibration">, pattern: number | number[]): boolean {
  if (!settings.vibration || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
