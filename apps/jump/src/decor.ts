import { Rng } from "@cdj/core";
import { TILE_EMPTY, TILE_SOLID, TILE_SPRING, UNITS_PER_TILE, isSpikeTile, type Level } from "@cdj/jump-sim";
import { Art } from "./artKit";
import { isMatterTile } from "./autotile";
import type { DecorKind, DecorPart, Theme } from "./themes";

// Décor du lot 9, **pur et déterministe** : graine = identifiant du niveau + thème. Purement visuel (aucune collision : la simulation ne le
// voit pas). Règles de lisibilité, vérifiées par `test/themes.test.ts` :
//   - aucune forme pointue ni dentée (les formes possibles sont rectangle, disque, demi-disque bombé : `DecorPart`), jamais au plafond ;
//   - rien à moins de `DECOR_KEEPOUT` (1,5 tuile) d'un danger (pic, trajet complet d'une scie), d'un ressort, d'un fanion, du départ ou
//     de l'arrivée (boîte contre boîte) ;
//   - rien au premier plan : tout le décor se dessine **derrière** le personnage, les dangers et les tuiles (`DECOR_Z`, `scene.ts`) ;
//   - une densité plafonnée (`DECOR_PER_COLUMN`, dont au plus `DECOR_WALL_SHARE` sur les murs), réduite de moitié avec les effets
//     réduits (les éléments `lite` d'abord).
// Coordonnées : tuiles, **y vers le bas** comme la simulation (rangée 0 en haut).

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

export type KeepoutKind = "pic" | "scie" | "ressort" | "fanion" | "depart" | "arrivee";

/** Ce dont un décor doit rester loin : une boîte, ou le trajet d'une scie (polyligne et rayon). */
export interface Keepout {
  kind: KeepoutKind;
  box: Box;
  /** Scie : points du trajet (centres, tuiles) et rayon dessiné (dents comprises). */
  path?: readonly { x: number; y: number }[];
  radius?: number;
}

const cellBox = (col: number, row: number): Box => ({ x0: col, y0: row, x1: col + 1, y1: row + 1 });

/** Tout ce que le décor doit éviter dans un niveau. Le fanion se dessine au-dessus de sa case (1,3 tuile), le drapeau d'arrivée aussi (2,2). */
export function keepouts(level: Level): Keepout[] {
  const out: Keepout[] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const t = level.tiles[row * level.width + col]!;
      if (isSpikeTile(t)) out.push({ kind: "pic", box: cellBox(col, row) });
      else if (t === TILE_SPRING) out.push({ kind: "ressort", box: cellBox(col, row) });
    }
  }
  const T = UNITS_PER_TILE;
  for (const saw of level.saws) {
    const r = saw.radius / T + 0.15;
    const pts = (saw.nodes.length > 0 ? saw.nodes : saw.points).map((p) => ({ x: p.x / T, y: p.y / T }));
    const path = pts.length > 1 ? [...pts, pts[0]!] : pts;
    const xs = path.map((p) => p.x);
    const ys = path.map((p) => p.y);
    out.push({ kind: "scie", box: { x0: Math.min(...xs) - r, y0: Math.min(...ys) - r, x1: Math.max(...xs) + r, y1: Math.max(...ys) + r }, path, radius: r });
  }
  for (const c of level.checkpoints) out.push({ kind: "fanion", box: { x0: c.col, y0: c.row - 0.4, x1: c.col + 1, y1: c.row + 1 } });
  out.push({ kind: "depart", box: cellBox(level.start.col, level.start.row) });
  out.push({ kind: "arrivee", box: { x0: level.finish.col, y0: level.finish.row - 1.4, x1: level.finish.col + 1.2, y1: level.finish.row + 1 } });
  return out;
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

/** Distance d'une boîte à un élément à éviter (pour une scie : au disque qui parcourt son trajet, échantillonné tous les 0,1 tuile). */
export function keepoutDistance(box: Box, k: Keepout): number {
  if (!k.path) return boxDistance(box, k.box);
  if (boxDistance(box, k.box) > DECOR_KEEPOUT + 1) return boxDistance(box, k.box);
  const r = k.radius ?? 0;
  let best = Infinity;
  const pts = k.path;
  if (pts.length === 1) return Math.max(0, pointBoxDistance(pts[0]!.x, pts[0]!.y, box) - r);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / 0.1));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      best = Math.min(best, pointBoxDistance(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, box) - r);
    }
  }
  return Math.max(0, best);
}

/** La plus petite distance d'une boîte à tout ce qu'il faut éviter. */
export function nearestKeepout(box: Box, list: readonly Keepout[]): number {
  let best = Infinity;
  for (const k of list) {
    if (boxDistance(box, k.box) >= best) continue;
    best = Math.min(best, keepoutDistance(box, k));
  }
  return best;
}

/** Distance approchée de chaque case à ce qu'il faut éviter (boîte de la case contre l'élément), plafonnée à 4 tuiles. */
export function keepoutField(level: Level, list: readonly Keepout[]): Float32Array {
  const f = new Float32Array(level.width * level.height).fill(4);
  for (const k of list) {
    const c0 = Math.max(0, Math.floor(k.box.x0) - 4);
    const c1 = Math.min(level.width - 1, Math.ceil(k.box.x1) + 4);
    const r0 = Math.max(0, Math.floor(k.box.y0) - 4);
    const r1 = Math.min(level.height - 1, Math.ceil(k.box.y1) + 4);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * level.width + c;
        if (boxDistance(cellBox(c, r), k.box) >= f[i]!) continue;
        f[i] = Math.min(f[i]!, keepoutDistance(cellBox(c, r), k));
      }
    }
  }
  return f;
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

export interface DecorItem {
  /** Indice du décor dans `theme.decor`. */
  kind: number;
  anchor: DecorKind["anchor"];
  /** Point d'ancrage (tuiles, y vers le bas) : bas-milieu pour « dessus » et « fond », point du mur pour « mur ». */
  x: number;
  y: number;
  /** Mur : −1 mur à droite (le décor part vers la gauche), 1 mur à gauche ; sinon 1 ou −1 (miroir). */
  side: number;
  scale: number;
  /** Gardé avec les effets réduits. */
  lite: boolean;
  /** Boîte occupée (tuiles, y vers le bas). */
  box: Box;
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

function isFree(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.width || row < 0 || row >= level.height) return false;
  if (level.tiles[row * level.width + col] !== TILE_EMPTY) return false;
  if (level.start.col === col && level.start.row === row) return false;
  if (level.finish.col === col && level.finish.row === row) return false;
  return !level.checkpoints.some((c) => c.col === col && c.row === row);
}

/** Lot 11 : la matière (bloc plein, tapis, glace) : les murs et le sol où un décor de fond s'ancre. Un décor « dessus » ne se pose que sur un bloc ordinaire. */
const solidAt = (level: Level, col: number, row: number) => col >= 0 && col < level.width && row >= 0 && row < level.height && isMatterTile(level.tiles[row * level.width + col]!);
const plainAt = (level: Level, col: number, row: number) => col >= 0 && col < level.width && row >= 0 && row < level.height && level.tiles[row * level.width + col] === TILE_SOLID;

/** Les cases d'une boîte (y vers le bas) sont-elles toutes libres ? (Un décor de face ne déborde jamais sur une tuile ni sur un objet.) */
function boxInFreeCells(level: Level, b: Box): boolean {
  for (let r = Math.floor(b.y0 + 1e-6); r <= Math.floor(b.y1 - 1e-6); r++) {
    for (let c = Math.floor(b.x0 + 1e-6); c <= Math.floor(b.x1 - 1e-6); c++) if (!isFree(level, c, r)) return false;
  }
  return true;
}

/**
 * Pose le décor d'un niveau pour un thème. Déterministe : même niveau, même identifiant, même thème → mêmes décors. Les candidats
 * (au-dessus d'un bloc plein, contre un mur, au fond) sont mélangés par la graine, puis acceptés s'ils respectent toutes les règles.
 */
export function placeDecor(level: Level, theme: Theme, levelId: string, list: readonly Keepout[] = keepouts(level)): DecorItem[] {
  const rng = new Rng(textSeed(`${levelId}:${theme.name}`));
  const kinds = theme.decor;
  const byAnchor = (a: DecorKind["anchor"]) => kinds.map((k, i) => ({ k, i })).filter((e) => e.k.anchor === a);
  const pools = { dessus: byAnchor("dessus"), mur: byAnchor("mur"), fond: byAnchor("fond") };
  const candidates: { anchor: DecorKind["anchor"]; col: number; row: number; side: number }[] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (!isFree(level, col, row)) continue;
      const floor = solidAt(level, col, row + 1);
      if (floor) {
        if (plainAt(level, col, row + 1)) candidates.push({ anchor: "dessus", col, row, side: 1 });
        if (isFree(level, col, row - 1) && isFree(level, col, row - 2)) candidates.push({ anchor: "fond", col, row, side: 1 });
      } else {
        if (solidAt(level, col - 1, row)) candidates.push({ anchor: "mur", col, row, side: 1 });
        if (solidAt(level, col + 1, row)) candidates.push({ anchor: "mur", col, row, side: -1 });
      }
    }
  }
  const order = rng.shuffle(candidates);
  const cap = Math.floor(level.width * DECOR_PER_COLUMN);
  const wallCap = Math.floor(cap * DECOR_WALL_SHARE);
  let walls = 0;
  const items: DecorItem[] = [];
  const pick = (pool: { k: DecorKind; i: number }[]) => {
    const total = pool.reduce((s, e) => s + e.k.weight, 0);
    let r = rng.int(Math.max(1, total));
    for (const e of pool) {
      r -= e.k.weight;
      if (r < 0) return e;
    }
    return pool[0]!;
  };
  for (const c of order) {
    if (items.length >= cap) break;
    if (!rng.chance(DECOR_CHANCE)) continue;
    const pool = pools[c.anchor];
    if (pool.length === 0) continue;
    // Le fond est plus rare (un candidat sur trois), les murs aussi (un sur deux : on y glisse, on les veut nets).
    if (c.anchor === "fond" && !rng.chance(30)) continue;
    if (c.anchor === "mur" && (walls >= wallCap || !rng.chance(45))) continue;
    const e = pick(pool);
    const scale = 0.85 + rng.int(31) / 100;
    const b = partsBounds(e.k.parts);
    let x: number;
    let y: number;
    let side = c.side;
    if (c.anchor === "mur") {
      x = c.side === 1 ? c.col : c.col + 1;
      y = c.row + 0.5;
    } else {
      side = rng.chance(50) ? 1 : -1;
      const half = (Math.max(Math.abs(b.x0), Math.abs(b.x1)) * scale) as number;
      const room = Math.max(0, 0.5 - half - 0.02);
      x = c.col + 0.5 + ((rng.int(201) - 100) / 100) * room;
      y = c.row + 1;
    }
    const box = itemBox(e.k, x, y, side, scale);
    if (c.anchor !== "fond" && !boxInFreeCells(level, box)) continue;
    if (nearestKeepout(box, list) < DECOR_KEEPOUT) continue;
    const ax = x;
    const ay = y;
    if (items.some((o) => (o.anchor === "fond") === (c.anchor === "fond") && Math.hypot(o.x - ax, o.y - ay) < DECOR_SPACING)) continue;
    items.push({ kind: e.i, anchor: c.anchor, x, y, side, scale, lite: false, box });
    if (c.anchor === "mur") walls++;
  }
  const lite = Math.ceil(items.length * DECOR_LITE_SHARE);
  for (let i = 0; i < lite; i++) items[i]!.lite = true;
  return items;
}

export interface DecorChunk {
  col0: number;
  col1: number;
  art: Art;
  /** Indices (×3 : triangles) des décors `lite`, rangés en tête : avec les effets réduits on ne dessine que ceux-là. */
  liteIndices: number;
}

/** Dessine le décor posé, par tronçons de `columns` colonnes (les `lite` d'abord dans chaque tronçon). */
export function buildDecorArt(theme: Theme, items: readonly DecorItem[], width: number, columns: number): DecorChunk[] {
  const chunks: DecorChunk[] = [];
  for (let c0 = 0; c0 < width; c0 += columns) {
    const c1 = Math.min(width, c0 + columns);
    const art = new Art();
    const mine = items.filter((it) => it.x >= c0 && it.x < c1);
    let liteIndices = 0;
    for (const pass of [true, false]) {
      for (const it of mine) {
        if (it.lite !== pass) continue;
        drawItem(art, theme.decor[it.kind]!, it);
      }
      if (pass) liteIndices = art.idx.length;
    }
    chunks.push({ col0: c0, col1: c1, art, liteIndices });
  }
  return chunks;
}

function drawItem(art: Art, kind: DecorKind, it: DecorItem): void {
  const z0 = it.anchor === "fond" ? DECOR_Z.fond : DECOR_Z.face;
  const s = it.scale;
  const ox = it.x;
  const oy = -it.y;
  kind.parts.forEach((p, k) => {
    const z = z0 + k * 0.001;
    if (p.shape === "rect") {
      const xa = ox + it.side * p.x * s;
      const xb = ox + it.side * (p.x + p.w) * s;
      art.rect(Math.min(xa, xb), oy + p.y * s, Math.max(xa, xb), oy + (p.y + p.h) * s, z, p.color);
    } else if (p.shape === "disque") art.disc(ox + it.side * p.x * s, oy + p.y * s, p.r * s, z, p.color, 10);
    else art.half(ox + it.side * p.x * s, oy + p.y * s, p.r * s, z, p.color, 8);
  });
}
