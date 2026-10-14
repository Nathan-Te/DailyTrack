import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";

// Commandes tactiles de DailyJump (lot 1b) : logique pure, sans DOM, testée par Vitest. Le tactile produit les mêmes trois bits de commande
// que le clavier et la manette (rien ne change dans la simulation).
//
// Disposition (paysage comme portrait) : une bande haute (bouton « recommencer ») exclue des zones de jeu ; sous elle, de bord à bord et
// **sans trou** : [0, ¼[ = ←, [¼, ½[ = →, [½, 1] = saut. Les zones sont définies une fois par taille d'écran (`layoutFor`) ; les boutons dessinés
// (`buttonRects`) sont plus petits et écartés des frontières, mais le toucher se décide par la zone, jamais par le bouton.
//
//   ┌──────────────────────────────────────┐
//   │ ↻  bande haute (pas de zone de jeu)  │
//   ├───────────┬───────────┬──────────────┤
//   │     ←     │     →     │     saut     │
//   │  0 – ¼    │  ¼ – ½    │    ½ – 1     │
//   └───────────┴───────────┴──────────────┘

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

export interface Layout {
  width: number;
  height: number;
  /** Ordonnée où finit la bande haute (zone sûre haute comprise) : au-dessous, les zones de jeu. */
  band: number;
  insets: Insets;
}

export function layoutFor(width: number, height: number, insets: Insets = NO_INSETS): Layout {
  return { width, height, band: BAND_PX + Math.max(insets.top, 0), insets };
}

/** Une zone active : tranche verticale de l'écran, en parts de la largeur. */
export interface ZoneSpan {
  zone: Zone;
  x0: number;
  x1: number;
}

/** Définition unique des zones : les tranches se touchent et couvrent [0, 1] de bord à bord. */
export const ZONE_SPANS: readonly ZoneSpan[] = [
  { zone: "left", x0: 0, x1: 0.25 },
  { zone: "right", x0: 0.25, x1: 0.5 },
  { zone: "jump", x0: 0.5, x1: 1 },
];

/** Zone touchée en (x, y) ; hors de l'écran, la zone du bord. */
export function zoneAt(layout: Layout, x: number, y: number): Hit {
  if (y < layout.band) return "band";
  const f = layout.width > 0 ? x / layout.width : 0;
  for (const s of ZONE_SPANS) if (f < s.x1) return s.zone;
  return "jump";
}

/**
 * Direction d'un doigt de direction, d'après son abscisse seule : un doigt qui sort de la moitié gauche compte pour la zone **la plus proche**
 * de cette moitié (→ à droite de la moitié, ← à gauche de l'écran), jamais pour le saut.
 */
export function directionAt(layout: Layout, x: number): -1 | 1 {
  const f = layout.width > 0 ? x / layout.width : 0;
  return f < ZONE_SPANS[0]!.x1 ? -1 : 1;
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
/** Écart du bas : au-dessus de la bande de geste système (barre d'accueil de l'iPhone, retour d'Android). */
export const BUTTON_BOTTOM_PX = 36;
const BUTTON_MAX_PX = 104;

/**
 * Boutons dessinés (pixels CSS) : un carré par zone, centré dans la partie utile de sa zone (écartée des zones sûres), à `BUTTON_GAP_PX`
 * au moins des frontières, posé en bas. N'est qu'un visuel : la zone active va, elle, de bord à bord.
 */
export function buttonRects(layout: Layout): ButtonRect[] {
  const { width, height, insets } = layout;
  const out: ButtonRect[] = [];
  const bottom = height - Math.max(insets.bottom, 0) - BUTTON_BOTTOM_PX;
  for (const s of ZONE_SPANS) {
    const x0 = Math.max(s.x0 * width, s.x0 === 0 ? Math.max(insets.left, 0) : 0) + BUTTON_GAP_PX;
    const x1 = Math.min(s.x1 * width, s.x1 === 1 ? width - Math.max(insets.right, 0) : width) - BUTTON_GAP_PX;
    const room = bottom - layout.band - BUTTON_GAP_PX;
    const size = Math.floor(Math.max(0, Math.min(x1 - x0, room * 0.5, BUTTON_MAX_PX)));
    const cx = (x0 + x1) / 2;
    out.push({ zone: s.zone, x: Math.round(cx - size / 2), y: Math.round(bottom - size), w: size, h: size });
  }
  return out;
}

/** Interface tactile ? `?touch=1` la force (la souris simule le doigt), `?touch=0` la coupe ; sinon l'appareil décide (pointeur grossier). */
export function wantsTouch(forced: "1" | "0" | null, coarsePointer: boolean): boolean {
  if (forced === "1") return true;
  if (forced === "0") return false;
  return coarsePointer;
}
