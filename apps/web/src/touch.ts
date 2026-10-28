import type { Axes } from "./input";
import { gameStorage } from "./storage";

// Commandes tactiles (lot 10) : logique pure, sans DOM, testée par Vitest. Le tactile produit les mêmes axes
// que le clavier et la manette ; ils passent ensuite par `makeInput` (commandes entières) : rien ne change dans
// `sim`, les rediffusions sont identiques.
//
// Disposition (paysage, lot I4 retouche 2 — charte rév. 7 : « commandes aux bords, boutons par défaut, jamais devant le véhicule ») :
// - mode « Boutons » (défaut) : ← et → en bas à gauche, FREIN et GAZ en bas à droite ; chaque bouton a sa zone de toucher, qui épouse le
//   bouton dessiné (voir `buttonRects`) ; le milieu de l'écran n'a aucune zone : un toucher y est ignoré, le centre reste libre.
// - lot 52, trois autres façons de tourner, **chargées à la demande** (`steerSlider.ts`, `steerWheel.ts`, `steerGyro.ts` : ce fichier ne garde que les
//   boutons, les pédales et la place des commandes) : « Glissière » (un rail au bord, le curseur suit le pouce ; remplace l'ancien joystick), « Volant »
//   (tourné au doigt, autour de son centre) et « Gyroscope » (le téléphone incliné comme un volant, frein à gauche et gaz à droite). Toutes donnent
//   la même direction analogique ∈ [-1, 1] ; `makeInput` la quantifie (−64 à 64) : la simulation et la rediffusion ne changent pas.
// - disposition inversée (`mirrored`) : pédales à gauche, direction à droite.
// - accélérateur automatique : un seul grand FREIN ; l'accélérateur se coupe tant qu'on freine.
// - plusieurs doigts à la fois : on dirige et on freine en même temps.

export type SteerMode = "buttons" | "slider" | "wheel" | "gyro";
export type ButtonSize = "small" | "medium" | "large";

/** Ce que fait une direction chargée à la demande : la direction à cet instant et, selon le mode, les doigts ou le capteur (lot 52). */
export interface Steerer {
  /** Direction ∈ [-1, 1] ; 0 dans la zone morte. */
  steer(): number;
  /** Un doigt est posé dans la zone de direction (glissière, volant) : `x`, `y` en pixels de l'écran de jeu. */
  down?(id: number, x: number, y: number): void;
  move?(id: number, x: number, y: number): void;
  up?(id: number): void;
  /** Lève tout (changement de réglage, perte de focus…). */
  release?(): void;
  /** Une course commence (début du décompte) / le décompte finit (« PARTEZ ! ») : le gyroscope prend son neutre. */
  begin?(): void;
  go?(): void;
}

export interface TouchSettings {
  steerMode: SteerMode;
  /** Sensibilité de la glissière : 1 = braquage à fond quand le curseur touche le bout du rail ; 2 = deux fois moins de course. */
  sensitivity: number;
  /** Zone morte de la glissière, en part du débattement (0–0,3). */
  deadzone: number;
  /** Volant : angle maximal (butoir), 90° ou 135° ; c'est aussi sa sensibilité. */
  wheelAngle: 90 | 135;
  /** Volant : zone morte, en part de l'angle maximal. */
  wheelDeadzone: number;
  /** Gyroscope : 1 = braquage à fond à `GYRO_FULL_LOCK_DEG` d'inclinaison ; 2 = deux fois moins. */
  gyroSensitivity: number;
  gyroDeadzone: number;
  /** Gyroscope : la petite jauge d'inclinaison à côté de la vitesse. */
  gyroGauge: boolean;
  /** Disposition inversée : pédales à gauche, direction à droite (gyroscope : gaz à gauche, frein à droite). */
  mirrored: boolean;
  /** Accélérateur automatique (sinon, par défaut : bouton de gaz, donc deux pédales). */
  autoThrottle: boolean;
  /** Vibration courte au point de contrôle et au choc (si le téléphone sait vibrer). */
  vibration: boolean;
  /** Taille des boutons dessinés, de la glissière et du volant (la zone active ne change pas : elle va toujours jusqu'aux bords). */
  buttonSize: ButtonSize;
}

/**
 * Défaut : les **boutons** (charte rév. 7). Un réglage déjà enregistré (`cdj:touch`) garde ce qu'il a enregistré : `parseTouchSettings`
 * ne force rien. Lot 52 : un ancien choix « joystick » (`drag`) devient « glissière » et garde sa sensibilité et sa zone morte.
 */
export const DEFAULT_TOUCH_SETTINGS: Readonly<TouchSettings> = Object.freeze({
  steerMode: "buttons",
  sensitivity: 1,
  deadzone: 0.08,
  wheelAngle: 90,
  wheelDeadzone: 0.06,
  gyroSensitivity: 1,
  gyroDeadzone: 0.05,
  gyroGauge: true,
  mirrored: false,
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

const KEY = "cdj:touch";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Réglages lus d'un texte JSON ; toute valeur absente ou hors limites retombe sur la valeur par défaut. */
export function parseTouchSettings(raw: string | null): TouchSettings {
  const s: TouchSettings = { ...DEFAULT_TOUCH_SETTINGS };
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof TouchSettings | "version", unknown>>;
    if (o.steerMode === "drag") s.steerMode = "slider"; // lot 52 : l'ancien joystick est la glissière
    else if (o.steerMode === "buttons" || o.steerMode === "slider" || o.steerMode === "wheel" || o.steerMode === "gyro") s.steerMode = o.steerMode;
    const number = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d);
    s.sensitivity = number(o.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, s.sensitivity);
    s.deadzone = number(o.deadzone, DEADZONE_RANGE.min, DEADZONE_RANGE.max, s.deadzone);
    s.wheelDeadzone = number(o.wheelDeadzone, DEADZONE_RANGE.min, DEADZONE_RANGE.max, s.wheelDeadzone);
    s.gyroSensitivity = number(o.gyroSensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, s.gyroSensitivity);
    s.gyroDeadzone = number(o.gyroDeadzone, DEADZONE_RANGE.min, DEADZONE_RANGE.max, s.gyroDeadzone);
    if (o.wheelAngle === 90 || o.wheelAngle === 135) s.wheelAngle = o.wheelAngle;
    if (typeof o.gyroGauge === "boolean") s.gyroGauge = o.gyroGauge;
    if (typeof o.mirrored === "boolean") s.mirrored = o.mirrored;
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
/** Tailles de la maquette (taille « normale ») : flèches 72 × 72, FREIN 64 × 56, GAZ 84 × 84 ; lot 52 : glissière 236 × 64, volant 140 (maquettes du lot 52). */
const BASE = { arrow: 72, brakeW: 64, brakeH: 56, gas: 84, sliderW: 236, sliderH: 64, wheel: 140 } as const;

export interface ButtonRect {
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Layout = Pick<TouchSettings, "steerMode" | "autoThrottle" | "buttonSize"> & { mirrored?: boolean };

/** Les marges des deux côtés : celui de la direction (à gauche, à droite si la disposition est inversée) et celui des pédales. */
function edges(g: Geometry, s: Layout): { dir: number; ped: number } {
  const left = Math.max(g.insets.left, 0) + EDGE_MARGIN_PX;
  const right = Math.max(g.insets.right, 0) + EDGE_MARGIN_PX;
  return s.mirrored ? { dir: right, ped: left } : { dir: left, ped: right };
}

/**
 * Échelle des boutons : celle de la taille choisie, réduite si besoin pour que chaque groupe tienne entre son bord (marge et zone sûre
 * comprises) et le centre libre de l'écran. Les trois tailles respectent donc les bords et le centre, sur tous les écrans.
 */
function scaleFor(g: Geometry, s: Layout): number {
  const e = edges(g, s);
  // (2 px de réserve : les tailles sont arrondies au pixel, chacune vers le haut au plus d'un demi-pixel)
  const place = (bord: number) => CENTER_FREE.x0 * g.width - bord - 2;
  let k = SIZE_FACTOR[s.buttonSize];
  if (s.steerMode === "buttons") k = Math.min(k, place(e.dir) / (2 * BASE.arrow + BUTTON_GAP_PX));
  if (s.steerMode === "gyro") {
    k = Math.min(k, place(e.dir) / (s.autoThrottle ? BASE.gas : BASE.arrow)); // le frein, sous le pouce de la direction
    if (!s.autoThrottle) k = Math.min(k, place(e.ped) / BASE.gas);
  } else k = Math.min(k, place(e.ped) / (BASE.brakeW + BASE.gas + BUTTON_GAP_PX));
  return Math.max(k, 0.1);
}

/**
 * Boutons dessinés (pixels CSS), **une seule définition** pour le dessin et pour les zones (`zoneSpans`) : ← et → en bas à gauche, FREIN et GAZ en
 * bas à droite (un seul grand FREIN avec l'accélérateur automatique), collés aux bords (marge `EDGE_MARGIN_PX`, zones sûres comprises), jamais au
 * centre. Lot 52 : « glissière » et « volant » ont une commande (`steer`) à la place des flèches ; « gyroscope » n'en a pas, le frein prend la place
 * de la direction (sous le pouce gauche) et le gaz reste à droite ; `mirrored` met la direction à droite et les pédales à gauche.
 */
export function buttonRects(width: number, height: number, s: Layout, insets: Insets = NO_INSETS): ButtonRect[] {
  const g: Geometry = { width, height, insets };
  const k = scaleFor(g, s);
  const e = edges(g, s);
  const mir = !!s.mirrored;
  const px = (base: number) => Math.max(MIN_BUTTON_PX, Math.round(base * k));
  const bottom = height - Math.max(insets.bottom, 0) - EDGE_MARGIN_PX;
  const out: ButtonRect[] = [];
  /** Un bloc de largeur `w` collé au bord de la direction. */
  const dirX = (w: number) => (mir ? width - e.dir - w : e.dir);
  /** Un bloc de largeur `w` collé au bord des pédales. */
  const pedX = (w: number) => (mir ? e.ped : width - e.ped - w);
  const f = SIZE_FACTOR[s.buttonSize];
  const place = Math.floor(CENTER_FREE.x0 * width - e.dir - 2);
  if (s.steerMode === "buttons") {
    const a = px(BASE.arrow);
    const x0 = dirX(2 * a + BUTTON_GAP_PX); // le groupe change de côté, pas l'ordre : ← reste à gauche de →
    out.push({ zone: "left", x: x0, y: bottom - a, w: a, h: a }, { zone: "right", x: x0 + a + BUTTON_GAP_PX, y: bottom - a, w: a, h: a });
  } else if (s.steerMode === "slider") {
    const w = Math.min(Math.round(BASE.sliderW * f), place);
    const h = Math.max(MIN_BUTTON_PX, Math.round(BASE.sliderH * f));
    out.push({ zone: "steer", x: dirX(w), y: bottom - h, w, h });
  } else if (s.steerMode === "wheel") {
    const d = Math.min(Math.round(BASE.wheel * f), place, Math.floor(height / 2));
    out.push({ zone: "steer", x: dirX(d), y: bottom - d, w: d, h: d });
  }
  const gas = px(BASE.gas);
  const bw = px(BASE.brakeW);
  const bh = px(BASE.brakeH);
  if (s.steerMode === "gyro") {
    const b = px(s.autoThrottle ? BASE.gas : BASE.arrow);
    out.push({ zone: "brake", x: dirX(b), y: bottom - b, w: b, h: b });
    if (!s.autoThrottle) out.push({ zone: "gas", x: pedX(gas), y: bottom - gas, w: gas, h: gas });
  } else if (s.autoThrottle) {
    const w = bw + BUTTON_GAP_PX + gas; // un seul grand frein : la place des deux pédales
    out.push({ zone: "brake", x: pedX(w), y: bottom - gas, w, h: gas });
  } else {
    // Inversé, le gaz reste au bord et le frein est de l'autre côté (l'image dans un miroir).
    out.push({ zone: "gas", x: pedX(gas), y: bottom - gas, w: gas, h: gas }, { zone: "brake", x: mir ? e.ped + gas + BUTTON_GAP_PX : width - e.ped - gas - BUTTON_GAP_PX - bw, y: bottom - bh, w: bw, h: bh });
  }
  return out;
}

/** Les boutons voisins (écart de `BUTTON_GAP_PX`) forment un groupe : le doigt y passe de l'un à l'autre sans changer de groupe. */
function clusters(rects: ButtonRect[]): ButtonRect[][] {
  const sorted = rects.filter((r) => r.zone !== "steer").sort((a, b) => a.x - b.x);
  const out: ButtonRect[][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev && r.x - (prev.x + prev.w) <= BUTTON_GAP_PX + 1) last.push(r);
    else out.push([r]);
  }
  return out;
}

/** Les zones d'un groupe de boutons, du plus à gauche au plus à droite (voir `zoneSpans`). */
function spansOf(group: ButtonRect[], w: number): ZoneSpan[] {
  const xa = group[0]!.x;
  const last = group[group.length - 1]!;
  const xb = last.x + last.w;
  const bordGauche = (xa + xb) / 2 < w / 2; // groupe collé au bord gauche : sa zone va de 0 à un peu au-delà de son dernier bouton
  const borders = group.slice(1).map((r) => (r.x - BUTTON_GAP_PX / 2) / w);
  const start = bordGauche ? 0 : (xa - ZONE_SLACK_PX) / w;
  const end = bordGauche ? Math.min(CENTER_FREE.x0 + 0.02, (xb + ZONE_SLACK_PX) / w) : 1;
  const edgesX = [start, ...borders, end];
  return group.map((r, i) => ({ zone: r.zone, x0: edgesX[i]!, x1: edgesX[i + 1]! }));
}

/**
 * Découpage de l'écran en zones actives. Chaque zone **épouse son bouton dessiné** (toucher un bouton = sa commande) et va **de bord à bord** sur toute la
 * hauteur : ← de 0 à la frontière entre les deux flèches, → de cette frontière un peu au-delà du bord droit de la flèche ; frein et gaz de même, jusqu'au
 * bord droit de l'écran. Sans trou à l'intérieur d'un groupe ; **le milieu de l'écran n'a aucune zone** (un toucher y est ignoré : le centre reste
 * libre). Lot 52 : la zone de la glissière et du volant est tout le tiers du bord (de 0 à 30 % de la largeur, ou de 70 à 100 % inversée) ; les pédales
 * suivent leurs boutons.
 */
export function zoneSpans(s: Layout, g: Readonly<Geometry> = DEFAULT_GEOMETRY): ZoneSpan[] {
  const w = g.width;
  const rects = buttonRects(w, g.height, s, g.insets);
  const out: ZoneSpan[] = [];
  if (rects.some((r) => r.zone === "steer")) out.push(s.mirrored ? { zone: "steer", x0: 1 - CENTER_FREE.x0, x1: 1 } : { zone: "steer", x0: 0, x1: CENTER_FREE.x0 });
  for (const group of clusters(rects)) out.push(...spansOf(group, w));
  return out.sort((a, b) => a.x0 - b.x0);
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
 * Un doigt qui reste dans sa famille de boutons (← → d'un côté, frein / gaz de l'autre) peut glisser de l'un à l'autre, même hors de l'écran ou hors de
 * la zone : la frontière entre les deux boutons de la famille décide (le doigt ne change jamais de famille).
 */
function regroup(zone: Zone, x: number, g: Readonly<Geometry>, s: Layout): Zone {
  if (zone === "steer") return zone;
  const group = clusters(buttonRects(g.width, g.height, s, g.insets)).find((c) => c.some((r) => r.zone === zone));
  if (!group || group.length < 2) return zone; // accélérateur automatique, ou un bouton seul : un seul frein
  const spans = spansOf(group, g.width);
  const f = g.width > 0 ? x / g.width : 0;
  return (spans.find((sp) => f < sp.x1) ?? spans[spans.length - 1]!).zone;
}

interface Finger {
  zone: Zone;
  x: number;
  y: number;
}

export interface TouchSnapshot {
  steer: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  gas: boolean;
}

/** État des doigts posés sur l'écran. Les événements arrivent des « pointer events » (voir `touchUi.ts`). */
export class TouchPad {
  private readonly fingers = new Map<number, Finger>();
  /** Le premier toucher a eu lieu (sert à masquer l'aide). */
  touched = false;
  /** L'écran de jeu (taille et zones sûres) : les zones actives en dépendent ; `touchUi.ts` le met à jour à chaque mesure de l'écran. */
  geometry: Geometry = { ...DEFAULT_GEOMETRY };
  /** Lot 52 : la direction de la glissière, du volant ou du gyroscope, une fois son module chargé (`touchUi.ts`) ; sans elle, ces modes ne tournent pas. */
  steerer: Steerer | null = null;

  constructor(public settings: TouchSettings = { ...DEFAULT_TOUCH_SETTINGS }) {}

  setGeometry(width: number, height: number, insets: Insets = NO_INSETS): void {
    this.geometry = { width, height, insets };
  }

  /** Le bouton ou la commande dessinés d'une zone (pixels de l'écran de jeu), pour les modules chargés à la demande. */
  rect(zone: Zone): ButtonRect | undefined {
    return buttonRects(this.geometry.width, this.geometry.height, this.settings, this.geometry.insets).find((r) => r.zone === zone);
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
    this.fingers.set(id, { zone, x, y });
    if (zone === "steer") this.steerer?.down?.(id, x, y);
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
    if (f.zone === "steer") this.steerer?.move?.(id, x, y);
    else f.zone = regroup(f.zone, x, this.geometry, this.settings);
  }

  up(id: number): void {
    if (this.fingers.get(id)?.zone === "steer") this.steerer?.up?.(id);
    this.fingers.delete(id);
  }

  /** Lève tous les doigts (changement de réglages, perte de focus…). */
  releaseAll(): void {
    this.fingers.clear();
    this.steerer?.release?.();
  }

  /** Une course commence (décompte) / le décompte finit : le gyroscope prend son neutre (lot 52). */
  begin(): void {
    this.steerer?.begin?.();
  }

  go(): void {
    this.steerer?.go?.();
  }

  private isSteering(zone: Zone): boolean {
    return zone === "steer" || zone === "left" || zone === "right";
  }

  snapshot(): TouchSnapshot {
    const out: TouchSnapshot = { steer: false, left: false, right: false, brake: false, gas: false };
    for (const f of this.fingers.values()) out[f.zone] = true;
    return out;
  }

  /**
   * Axes demandés : même forme que le clavier et la manette. Accélérateur automatique : plein gaz, coupé tant
   * qu'on freine (frein et gaz ensemble s'annuleraient).
   */
  axes(): Axes {
    let steer = this.steerer?.steer() ?? 0; // glissière, volant, gyroscope ; les flèches s'y ajoutent (jamais ensemble : un seul mode à la fois)
    let brake = 0;
    let gas = 0;
    for (const f of this.fingers.values()) {
      if (f.zone === "left") steer -= 1;
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
