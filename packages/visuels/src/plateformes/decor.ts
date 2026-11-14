import type { DecorKind, DecorPart } from "./themes";

// Les règles du décor posé, **pures** : distances, densité, profondeurs et géométrie des boîtes. La pose elle-même (quels éléments, où) dépend de la
// grille du jeu : elle reste dans le jeu. Décor purement visuel (aucune collision). Coordonnées : tuiles, **y vers le bas** (rangée 0 en haut).

/** Distance minimale (tuiles) entre un décor et un danger, un ressort, un fanion, le départ ou l'arrivée. */
export const DECOR_KEEPOUT = 1.5;
/** Décors au plus par colonne du niveau, en moyenne (plafond total : largeur × ceci). */
export const DECOR_PER_COLUMN = 0.4;
/** Part du décor gardée avec les effets réduits (et « aucun ») : les premiers tirés. */
export const DECOR_LITE_SHARE = 0.5;
/** Part du plafond laissée aux décors de mur (les parois où l'on glisse restent nettes). */
export const DECOR_WALL_SHARE = 0.45;
/** Chance qu'une place candidate reçoive un décor (avant les règles). */
export const DECOR_CHANCE = 38;
/** Écart minimal entre deux décors (tuiles, d'ancrage à ancrage). */
export const DECOR_SPACING = 1.25;
/** Profondeur de dessin : derrière les tuiles (0), les dangers et le personnage ; le fond plus loin encore. */
export const DECOR_Z = { face: -0.2, fond: -0.6 } as const;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}


/** Distance entre deux boîtes (0 si elles se touchent ou se chevauchent). */
export function boxDistance(a: Box, b: Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.sqrt(dx * dx + dy * dy);
}

function pointBoxDistance(x: number, y: number, b: Box): number {
  const dx = Math.max(0, b.x0 - x, x - b.x1);
  const dy = Math.max(0, b.y0 - y, y - b.y1);
  return Math.sqrt(dx * dx + dy * dy);
}



/** Boîte d'une liste de formes (coordonnées locales, y vers le haut). */
export function partsBounds(parts: readonly DecorPart[]): Box {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    if (p.shape === "rect") {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x + p.w);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y + p.h);
    } else {
      x0 = Math.min(x0, p.x - p.r);
      x1 = Math.max(x1, p.x + p.r);
      y0 = Math.min(y0, p.shape === "demi" ? p.y : p.y - p.r);
      y1 = Math.max(y1, p.y + p.r);
    }
  }
  return { x0, y0, x1, y1 };
}



/** Boîte d'un décor posé (tuiles, y vers le bas). */
export function itemBox(kind: DecorKind, x: number, y: number, side: number, scale: number): Box {
  const b = partsBounds(kind.parts);
  const xs = [x + side * b.x0 * scale, x + side * b.x1 * scale];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: y - b.y1 * scale, y1: y - b.y0 * scale };
}

/** Empreinte FNV-1a 32 bits d'un texte (graine du décor). */
export function textSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

