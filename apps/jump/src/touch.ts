import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";

// Commandes tactiles de DailyJump (lot 1b) : logique pure, sans DOM, testée par Vitest. Le tactile produit les mêmes trois bits de commande
// que le clavier et la manette (rien ne change dans la simulation).
//
// Disposition (paysage comme portrait) : une bande haute (lot I5 : la pause et la bande du HUD) exclue des zones de jeu ; sous elle, de bord à bord
// et **sans trou** : [0, frontière[ = ←, [frontière, ½[ = →, [½, 1] = saut. **La frontière ← / → est entre les deux flèches dessinées** (elle dépend de leur
// taille et des zones sûres : `layoutFor`, `zoneSpans`) ; celle du saut reste à ½. Les boutons dessinés (`buttonRects`, aux bords de l'écran) ne sont qu'un
// visuel : le toucher se décide par la zone, jamais par le bouton. Taille des boutons réglable (`ButtonSize`) : les zones ne changent pas, sauf la
// frontière ← / → qui suit les flèches.
//
//   ┌──────────────────────────────────────┐
//   │ ⏸  bande haute (pas de zone de jeu)  │
//   ├─────┬─────────────────┬──────────────┤
//   │  ←  │        →        │     saut     │
//   │     │ frontière – ½   │    ½ – 1     │
//   └─────┴─────────────────┴──────────────┘

export type Zone = "left" | "right" | "jump";
/** Ce que touche un doigt : une zone de jeu, ou la bande haute (aucune commande). */
export type Hit = Zone | "band";

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const NO_INSETS: Readonly<Insets> = Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });

/** Hauteur de la bande haute (pixels CSS), hors zone sûre : de quoi loger un bouton de 44 px et sa marge. */
export const BAND_PX = 60;
/** Cible tactile minimale (pixels CSS). */
export const MIN_TARGET_PX = 44;

/** Taille des boutons dessinés (réglage du joueur) : petits, moyens, grands. */
export type ButtonSize = "small" | "medium" | "large";
export const BUTTON_SIZES: readonly ButtonSize[] = ["small", "medium", "large"];

export interface Layout {
  width: number;
  height: number;
  /** Ordonnée où finit la bande haute (zone sûre haute comprise) : au-dessous, les zones de jeu. */
  band: number;
  insets: Insets;
  size: ButtonSize;
  /** Abscisse (pixels CSS) de la frontière entre les zones ← et → : au milieu de l'écart entre les deux flèches dessinées. */
  frontier: number;
}

export function layoutFor(width: number, height: number, insets: Insets = NO_INSETS, size: ButtonSize = "medium"): Layout {
  const band = BAND_PX + Math.max(insets.top, 0);
  return { width, height, band, insets, size, frontier: metrics(width, height, band, insets, size).frontier };
}

/** Une zone active : tranche verticale de l'écran, en parts de la largeur. */
export interface ZoneSpan {
  zone: Zone;
  x0: number;
  x1: number;
}

/** Les trois zones, de gauche à droite. */
export const ZONES: readonly Zone[] = ["left", "right", "jump"];

/** Définition unique des zones d'un écran : les tranches se touchent et couvrent [0, 1] de bord à bord (le saut commence toujours à ½). */
export function zoneSpans(layout: Layout): ZoneSpan[] {
  const f = layout.width > 0 ? Math.min(Math.max(layout.frontier / layout.width, 0), 0.5) : 0.25;
  return [
    { zone: "left", x0: 0, x1: f },
    { zone: "right", x0: f, x1: 0.5 },
    { zone: "jump", x0: 0.5, x1: 1 },
  ];
}

/** Zone touchée en (x, y) ; hors de l'écran, la zone du bord. */
export function zoneAt(layout: Layout, x: number, y: number): Hit {
  if (y < layout.band) return "band";
  if (x < layout.frontier) return "left";
  return x < layout.width / 2 ? "right" : "jump";
}

/**
 * Direction d'un doigt de direction, d'après son abscisse seule : un doigt qui sort de la moitié gauche compte pour la zone **la plus proche**
 * de cette moitié (→ à droite de la moitié, ← à gauche de l'écran), jamais pour le saut.
 */
export function directionAt(layout: Layout, x: number): -1 | 1 {
  return x < layout.frontier ? -1 : 1;
}

type Role = "dir" | "jump";

interface Finger {
  role: Role;
  x: number;
  y: number;
  /** Ordre de pose : parmi plusieurs doigts de direction, le plus récent l'emporte. */
  seq: number;
}

/**
 * Suivi des doigts. Un doigt prend son rôle à la pose, d'après la zone touchée : direction (← ou →, glissable de l'une à l'autre sans
 * lever) ou saut (suit son propre doigt) ; la bande haute n'en donne aucun. Seul le lever (ou l'annulation) arrête une commande.
 */
export class TouchPad {
  private readonly fingers = new Map<number, Finger>();
  private seq = 0;

  constructor(public layout: Layout) {}

  /** Pose un doigt. Rend ce qu'il touche (`band` : ignoré). */
  down(id: number, x: number, y: number): Hit {
    const hit = zoneAt(this.layout, x, y);
    if (hit === "band") {
      this.fingers.delete(id);
      return hit;
    }
    this.fingers.set(id, { role: hit === "jump" ? "jump" : "dir", x, y, seq: this.seq++ });
    return hit;
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
  }

  /** Lève (ou annule) un doigt. */
  up(id: number): void {
    this.fingers.delete(id);
  }

  /** Plus aucun doigt (fenêtre perdue, panneau ouvert, nouvelle taille d'écran). */
  releaseAll(): void {
    this.fingers.clear();
  }

  get count(): number {
    return this.fingers.size;
  }

  /** −1 gauche, 0 neutre, 1 droite : le doigt de direction posé en dernier décide. */
  get direction(): -1 | 0 | 1 {
    let best: Finger | null = null;
    for (const f of this.fingers.values()) if (f.role === "dir" && (!best || f.seq > best.seq)) best = f;
    return best ? directionAt(this.layout, best.x) : 0;
  }

  /** Vrai tant qu'un doigt de saut est posé. */
  get jump(): boolean {
    for (const f of this.fingers.values()) if (f.role === "jump") return true;
    return false;
  }

  /** Les trois bits de commande tels que la simulation les attend. */
  get bits(): number {
    const d = this.direction;
    return (d < 0 ? INPUT_LEFT : 0) | (d > 0 ? INPUT_RIGHT : 0) | (this.jump ? INPUT_JUMP : 0);
  }

  /** La zone est-elle « appuyée » (pour l'état visible des boutons) ? */
  pressed(zone: Zone): boolean {
    if (zone === "jump") return this.jump;
    const d = this.direction;
    return zone === "left" ? d < 0 : d > 0;
  }

  /** Doigts posés, pour `?zones=1` et les tests. */
  list(): { id: number; role: Role; x: number; y: number }[] {
    return [...this.fingers].map(([id, f]) => ({ id, role: f.role, x: f.x, y: f.y }));
  }
}

export interface ButtonRect {
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Marge entre un bouton dessiné et la frontière de sa zone (ou le bord de l'écran). */
export const BUTTON_GAP_PX = 12;
/** Écart des flèches au bord gauche de l'écran (hors zone sûre) : un pouce posé en bas à gauche les trouve sans chercher. */
export const ARROWS_EDGE_PX = 24;
/** Écart du bas : au-dessus de la bande de geste système (barre d'accueil de l'iPhone, retour d'Android). */
export const BUTTON_BOTTOM_PX = 36;
/** Lot I5 (charte rév. 7, maquette `jump-hud.html`) : les flèches font 76 px, le gros bouton jaune « SAUT » 110 × 92 px (moins si l'écran est petit). Taille « moyens ». */
export const DIR_BUTTON_PX = 76;
export const JUMP_BUTTON_W = 110;
export const JUMP_BUTTON_H = 92;
/** Facteur de chaque taille, appliqué aux tailles ci-dessus (comme DailyTrack : 0,72 · 1 · 1,3). */
export const SIZE_FACTOR: Readonly<Record<ButtonSize, number>> = { small: 0.72, medium: 1, large: 1.3 };
/** Le personnage se tient dans [30 %, 70 %] de la largeur : une taille plus grande que « moyens » ne mord pas dessus plus que « moyens » ne le fait déjà. */
const CENTRE_LIBRE_X = 0.3;

interface Metrics {
  dir: number;
  jumpW: number;
  jumpH: number;
  /** Bord gauche de la flèche ←. */
  leftX: number;
  /** Bord droit de l'écran utile (zone sûre retirée) et bas des boutons. */
  right: number;
  bottom: number;
  /** Frontière des zones ← / → : au milieu de l'écart entre les deux flèches. */
  frontier: number;
}

/**
 * Mesures des boutons. ← et → sont **calés contre le bord gauche** (`ARROWS_EDGE_PX`, zone sûre comprise), séparés de `2 × BUTTON_GAP_PX` (la frontière
 * ← / → passe au milieu : `BUTTON_GAP_PX` de chaque côté) ; le gros « SAUT » est contre le bord droit. Chaque taille se réduit si l'écran manque de place :
 * les flèches tiennent avant la moitié de l'écran (zone du saut) et sous la bande haute, jamais moins de la taille de `MIN_TARGET_PX` quand l'écran le permet.
 */
function metrics(width: number, height: number, band: number, insets: Insets, size: ButtonSize): Metrics {
  const left = Math.max(insets.left, 0);
  const right = width - Math.max(insets.right, 0);
  // Au-dessus de la bande de geste : `BUTTON_BOTTOM_PX` depuis le bord, ou la zone sûre si elle est plus haute (elle contient déjà la barre d'accueil).
  const bottom = height - Math.max(insets.bottom, BUTTON_BOTTOM_PX);
  const room = bottom - band - BUTTON_GAP_PX;
  const half = width / 2;
  const leftX = left + ARROWS_EDGE_PX;
  const k = SIZE_FACTOR[size];
  // Deux flèches et leur écart tiennent entre le bord et la moitié de l'écran (à `BUTTON_GAP_PX` de la zone du saut).
  const fit = Math.min((half - BUTTON_GAP_PX - leftX - 2 * BUTTON_GAP_PX) / 2, room * 0.5);
  const medium = Math.min(DIR_BUTTON_PX, fit);
  const centre = (CENTRE_LIBRE_X * width - leftX - 2 * BUTTON_GAP_PX) / 2;
  const dir = Math.floor(Math.max(0, Math.min(Math.round(DIR_BUTTON_PX * k), fit, Math.max(medium, centre))));
  const jumpW = Math.floor(Math.max(0, Math.min(Math.round(JUMP_BUTTON_W * k), right - BUTTON_GAP_PX - (half + BUTTON_GAP_PX))));
  const jumpH = Math.floor(Math.max(0, Math.min(Math.round(JUMP_BUTTON_H * k), room * 0.6)));
  return { dir, jumpW, jumpH, leftX, right, bottom, frontier: leftX + dir + BUTTON_GAP_PX };
}

/**
 * Boutons dessinés (pixels CSS). **Aux bords de l'écran**, jamais devant le personnage (charte rév. 7, § 9) : ← et → en bas à gauche, le gros bouton
 * « SAUT » en bas à droite contre le bord. Chaque bouton reste dans sa zone (`zoneSpans`), à `BUTTON_GAP_PX` au moins de ses frontières et des zones
 * sûres. N'est qu'un visuel : le toucher se décide par la zone, jamais par le bouton.
 */
export function buttonRects(layout: Layout): ButtonRect[] {
  const m = metrics(layout.width, layout.height, layout.band, layout.insets, layout.size);
  const y = (h: number) => Math.round(m.bottom - h);
  return [
    { zone: "left", x: m.leftX, y: y(m.dir), w: m.dir, h: m.dir },
    { zone: "right", x: m.leftX + m.dir + 2 * BUTTON_GAP_PX, y: y(m.dir), w: m.dir, h: m.dir },
    { zone: "jump", x: Math.floor(m.right - BUTTON_GAP_PX - m.jumpW), y: y(m.jumpH), w: m.jumpW, h: m.jumpH },
  ];
}

/** Interface tactile ? `?touch=1` la force (la souris simule le doigt), `?touch=0` la coupe ; sinon l'appareil décide (pointeur grossier). */
export function wantsTouch(forced: "1" | "0" | null, coarsePointer: boolean): boolean {
  if (forced === "1") return true;
  if (forced === "0") return false;
  return coarsePointer;
}
