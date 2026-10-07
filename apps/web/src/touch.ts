import type { Axes } from "./input";

// Commandes tactiles (lot 10) : logique pure, sans DOM, testée par Vitest. Le tactile produit les mêmes axes
// que le clavier et la manette ; ils passent ensuite par `makeInput` (commandes entières) : rien ne change dans
// `sim`, les rediffusions sont identiques.
//
// Disposition (paysage) :
// - moitié gauche : direction. « Glisser » : glissement horizontal relatif au point de pose (analogique, zone
//   morte, sensibilité réglable) ; « Boutons » : quart gauche = ←, deuxième quart = →.
// - moitié droite : frein / marche arrière ; avec l'accélérateur manuel, elle se partage en frein (à gauche) et
//   gaz (à droite). L'accélérateur est automatique par défaut : il se coupe tant qu'on freine.
// - plusieurs doigts à la fois : on dirige et on freine en même temps.

export type SteerMode = "drag" | "buttons";
export type ButtonSize = "small" | "medium" | "large";

export interface TouchSettings {
  steerMode: SteerMode;
  /** Sensibilité du glissement : 1 = braquage à fond après `FULL_LOCK_PX` pixels ; 2 = deux fois moins. */
  sensitivity: number;
  /** Zone morte, en part du débattement (0–0,3). */
  deadzone: number;
  /** Accélérateur automatique (sinon : bouton de gaz). */
  autoThrottle: boolean;
  /** Vibration courte au point de contrôle et au choc (si le téléphone sait vibrer). */
  vibration: boolean;
  /** Taille des boutons dessinés (la zone active ne change pas : elle va toujours jusqu'aux bords). */
  buttonSize: ButtonSize;
}

export const DEFAULT_TOUCH_SETTINGS: Readonly<TouchSettings> = Object.freeze({
  steerMode: "drag",
  sensitivity: 1,
  deadzone: 0.08,
  autoThrottle: true,
  vibration: true,
  buttonSize: "medium",
});

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
    const o = JSON.parse(raw) as Partial<Record<keyof TouchSettings, unknown>>;
    if (o.steerMode === "drag" || o.steerMode === "buttons") s.steerMode = o.steerMode;
    if (typeof o.sensitivity === "number" && Number.isFinite(o.sensitivity)) s.sensitivity = clamp(o.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max);
    if (typeof o.deadzone === "number" && Number.isFinite(o.deadzone)) s.deadzone = clamp(o.deadzone, DEADZONE_RANGE.min, DEADZONE_RANGE.max);
    if (typeof o.autoThrottle === "boolean") s.autoThrottle = o.autoThrottle;
    if (typeof o.vibration === "boolean") s.vibration = o.vibration;
    if (o.buttonSize === "small" || o.buttonSize === "medium" || o.buttonSize === "large") s.buttonSize = o.buttonSize;
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return s;
}

export function loadTouchSettings(): TouchSettings {
  try {
    return parseTouchSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_TOUCH_SETTINGS };
  }
}

export function saveTouchSettings(s: Readonly<TouchSettings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
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

/**
 * Découpage de l'écran en zones actives, **sans trou** : les tranches se touchent et couvrent [0, 1] de bord à bord
 * (le visuel est plus petit, jamais la zone). Moitié gauche : direction (glissement, ou ← | →) ; moitié droite :
 * frein (ou frein | gaz avec l'accélérateur manuel).
 */
export function zoneSpans(s: Pick<TouchSettings, "steerMode" | "autoThrottle">): ZoneSpan[] {
  const out: ZoneSpan[] = s.steerMode === "drag" ? [{ zone: "steer", x0: 0, x1: 0.5 }] : [{ zone: "left", x0: 0, x1: 0.25 }, { zone: "right", x0: 0.25, x1: 0.5 }];
  if (s.autoThrottle) out.push({ zone: "brake", x0: 0.5, x1: 1 });
  else out.push({ zone: "brake", x0: 0.5, x1: 0.75 }, { zone: "gas", x0: 0.75, x1: 1 });
  return out;
}

/** Zone touchée par un doigt posé à l'abscisse `x` d'un écran de largeur `width` (hors de l'écran : la zone du bord). */
export function zoneAt(x: number, width: number, s: Pick<TouchSettings, "steerMode" | "autoThrottle">): Zone {
  const f = width > 0 ? x / width : 0;
  const spans = zoneSpans(s);
  for (const sp of spans) if (f < sp.x1) return sp.zone;
  return spans[spans.length - 1]!.zone;
}

/** Marge minimale entre un bouton dessiné et le bord de l'écran : bandes de gestes système (retour Android, barre iOS). */
export const GESTURE_MARGIN_PX = 24;

const SIZE_FACTOR: Record<ButtonSize, number> = { small: 0.72, medium: 1, large: 1.3 };

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ButtonRect {
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Boutons dessinés (en pixels) : compacts, centrés dans leur zone, écartés des bords par les zones sûres (encoche,
 * barre d'accueil) et par les bandes de gestes système. Ne sert qu'à l'affichage : le toucher se décide par
 * `zoneSpans`, sur tout l'écran.
 */
export function buttonRects(width: number, height: number, s: Pick<TouchSettings, "steerMode" | "autoThrottle" | "buttonSize">, insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }): ButtonRect[] {
  const k = SIZE_FACTOR[s.buttonSize];
  const bh = Math.round(Math.min(130, Math.max(72, height * 0.24)) * k);
  const left = Math.max(insets.left, 0) + GESTURE_MARGIN_PX;
  const right = width - Math.max(insets.right, 0) - GESTURE_MARGIN_PX;
  const bottom = height - Math.max(insets.bottom, 0) - Math.max(GESTURE_MARGIN_PX, 112);
  const out: ButtonRect[] = [];
  for (const sp of zoneSpans(s)) {
    if (sp.zone === "steer") continue; // le glissement n'a pas de bouton : la bague apparaît sous le doigt
    const zx0 = Math.max(sp.x0 * width, left);
    const zx1 = Math.min(sp.x1 * width, right);
    const gap = Math.min(12, (zx1 - zx0) * 0.05);
    const bw = Math.min((zx1 - zx0 - 2 * gap) * Math.min(1, 0.7 * k + 0.1), 260 * k);
    const cx = (zx0 + zx1) / 2;
    out.push({ zone: sp.zone, x: Math.round(cx - bw / 2), y: Math.round(bottom - bh), w: Math.round(bw), h: bh });
  }
  return out;
}

/** Un doigt qui reste dans sa famille de boutons (← → à gauche, frein / gaz à droite) peut glisser de l'un à l'autre, même hors de l'écran ou hors de la moitié. */
function regroup(zone: Zone, x: number, width: number, s: Pick<TouchSettings, "autoThrottle">): Zone {
  const f = width > 0 ? x / width : 0;
  if (zone === "left" || zone === "right") return f < 0.25 ? "left" : "right";
  if (zone === "brake" || zone === "gas") return s.autoThrottle ? "brake" : f < 0.75 ? "brake" : "gas";
  return zone;
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
  /** Écran ou zone de jeu : largeur en pixels CSS. */
  width = 800;

  constructor(public settings: TouchSettings = { ...DEFAULT_TOUCH_SETTINGS }) {}

  get active(): boolean {
    return this.fingers.size > 0;
  }

  down(id: number, x: number, y: number): void {
    this.touched = true;
    const zone = zoneAt(x, this.width, this.settings);
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
      f.zone = regroup(f.zone, x, this.width, this.settings);
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
