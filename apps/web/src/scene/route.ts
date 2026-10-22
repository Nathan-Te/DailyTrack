// Lot 38 — la route paramétrable : la géométrie de la piste de `trackMesh.ts` (surface, jupe, piliers, cuves, bas-côtés, sauts, marques des
// revêtements), dont les **rebords, vibreurs, bordures du vide et marquages** sont confiés à un style (`StyleRoute`) : chaque direction de la vitrine
// y met les siens. La géométrie qui porte la voiture ne change jamais (mêmes points que la simulation : `blockPoint`, `bankAt`, cuves…).
//
// **Copie de travail** des fonctions de `trackMesh.ts` (lot 38 : la scène du jeu ne change pas, et le lot 37 nettoie `trackMesh.ts` en même
// temps) ; le premier lot de mise en œuvre fera de ce module la route du jeu et retirera la copie de `trackMesh.ts` (voir le README du lot 38).
import {
  CELL,
  CUVE_LEFT,
  CUVE_RIGHT,
  JUMP_LIP,
  JUMP_RISE,
  KERB_WIDTH,
  KICK_START,
  SHOULDER_EDGE,
  WALL_HEIGHT,
  bankAt,
  blockHalfWidth,
  blockHeight,
  blockReachAt,
  blockWidth,
  cuveAmplitude,
  cuveRadius,
  cuveTop,
  curveCenter,
  curveSize,
  isCurve,
  isWide,
  rippleAt,
  turnsLeft,
  type BankSample,
  type Block,
  type Track,
} from "@cdj/sim";
import { Builder, shade, world, type V3 } from "../meshKit";
import { SURFACE_COLORS, type Palette } from "../trackMesh";

/** Une « tranche » de route : deux bords (gauche, droite) à une avance donnée. */
export interface Row {
  left: V3;
  right: V3;
}

/**
 * Un tronçon de rebord, entre deux tranches : le pied du mur de `a` à `b` (au niveau de la route), `dehors` (x, z unitaire) vers l'extérieur.
 * `s` = distance (m) parcourue le long de ce bord depuis le départ (bandes alignées sur tout le circuit), `longueur` = celle du tronçon.
 */
export interface TronconRebord {
  a: V3;
  b: V3;
  dehors: [number, number];
  cote: "left" | "right";
  s: number;
  longueur: number;
  /** Couleurs du rebord (bandes alternées) : celles du thème au bout d'un bas-côté (`Palette.fence`), sinon `wallA` / `wallB`. */
  couleurs: [number, number];
  /** Au bout d'un bas-côté (lot 21) plutôt qu'au bord de la route. */
  bande: boolean;
  hauteur: number;
}

/** Ce qu'une direction dessine sur la route. Rien de ce qui porte la voiture : seulement ce qui la borde et ce qui est peint dessus. */
export interface StyleRoute {
  /** Le rebord (face intérieure, chapeau, ce qu'on veut derrière) ; `lum` : calque sans éclairage (catadioptres). */
  rebord(g: Builder, t: TronconRebord, pal: Palette, lum: Builder): void;
  /** La bordure au bord du vide (route sans rebords) ; `lum` : calque sans éclairage (néon de Nuit). */
  bordureVide(g: Builder, lum: Builder, t: TronconRebord, pal: Palette, milieu: V3): void;
  /** Vibreurs d'un virage sur route (lot 21), dans le calque `g` (sans éclairage dans le jeu). */
  vibreurs(g: Builder, rows: Row[], pal: Palette): void;
  /** Lignes de rive et sillons d'une tranche de bitume. */
  rives(g: Builder, a: Row, b: Row, couleur: number, pal: Palette): void;
  /** Tirets au centre d'un bloc. */
  tirets(g: Builder, b: Block, pal: Palette): void;
  /** Couleur de la route d'un bloc (deux tons en alternance). */
  couleurRoute(b: Block, pal: Palette): number;
  /** Couleur de la jupe (le remblai sous la route). */
  jupe(pal: Palette): number;
  /** Bandes de la paroi d'une cuve (deux couleurs). */
  cuve(pal: Palette): [number, number];
}

const bank: BankSample = { h: 0, gp: 0, gq: 0 };
const ripple = { h: 0, dq: 0 };

/** Tranches d'un intervalle [q0, q1] du bloc droit, avec `steps` subdivisions. */
export function straightRows(b: Block, q0: number, q1: number, steps: number, yOf: (q: number) => number, half?: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = q0 + ((q1 - q0) * i) / steps;
    const y = yOf(q);
    const hw = half ?? blockHalfWidth(b, q);
    rows.push({ left: world(b, CELL / 2 + hw, q, y), right: world(b, CELL / 2 - hw, q, y) });
  }
  return rows;
}

/** Point (rayon `r`, angle `a` depuis l'entrée) d'un virage ; la hauteur suit le relevé éventuel. */
export function arcPoint(b: Block, r: number, a: number, y: number): V3 {
  const { cp } = curveCenter(b.kind);
  const side = turnsLeft(b.kind) ? -1 : 1;
  const p = cp + side * r * Math.cos(a);
  const q = r * Math.sin(a);
  if (b.banked) {
    bankAt(b, p, q, bank);
    y += bank.h;
  }
  return world(b, p, q, y);
}

/** Tranches d'un virage ; `lissage` multiplie leur nombre (retouche 38b, palier 2 : rebords et route plus ronds là où l'œil les voit). */
export function curveRows(b: Block, half = b.w0 / 2, lift = 0, lissage = 1): Row[] {
  const { r: R } = curveCenter(b.kind);
  const steps = Math.round(((curveSize(b.kind) === 1 ? 10 : curveSize(b.kind) === 2 ? 24 : 40) + (b.banked ? 8 : 0)) * lissage);
  const rows: Row[] = [];
  const left = turnsLeft(b.kind);
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    const at = (r: number) => arcPoint(b, r, a, b.y0 + lift);
    rows.push(left ? { left: at(R - half), right: at(R + half) } : { left: at(R + half), right: at(R - half) });
  }
  return rows;
}

/** Point à la fraction `t` de la largeur de la tranche (0 : bord gauche, 1 : bord droit), relevé de `up`. */
export function across(r: Row, t: number, up: number): V3 {
  return [r.left[0] + (r.right[0] - r.left[0]) * t, r.left[1] + (r.right[1] - r.left[1]) * t + up, r.left[2] + (r.right[2] - r.left[2]) * t];
}

export const rowWidth = (r: Row) => Math.hypot(r.left[0] - r.right[0], r.left[2] - r.right[2]) || 1;

/** Point du bloc : `lat` mètres à gauche de l'axe, `t` ∈ [0, 1] le long du bloc, à `lift` au-dessus de la route. */
export function onBlock(b: Block, lat: number, t: number, lift: number): V3 {
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    return arcPoint(b, turnsLeft(b.kind) ? R - lat : R + lat, t * (Math.PI / 2), b.y0 + lift);
  }
  const q = t * CELL;
  return world(b, CELL / 2 + lat, q, blockHeight(b, q) + lift);
}

function roadHeight(b: Block, q: number): number {
  if (!b.bumpy) return blockHeight(b, q);
  rippleAt(q, ripple);
  return blockHeight(b, q) + ripple.h;
}

const PILLAR_MIN = 12;
const SLAB = 1.3;

interface Options {
  open?: boolean;
  bare?: boolean;
  fence?: [number, number];
  band?: boolean;
  pillars?: boolean;
}

/** Longueur parcourue le long de chaque bord (bandes alignées d'un bloc à l'autre). */
interface Parcours {
  left: number;
  right: number;
}

function addRoad(c: CalquesRoute, pal: Palette, style: StyleRoute, rows: Row[], color: number, floorY: number, skirt: boolean, paved: boolean, skirtColor: number, o: Options, run: Parcours) {
  const g = c.route;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    g.quad(a.left, a.right, b.right, b.left, color);
    if (paved) style.rives(g, a, b, color, pal);
    if (skirt) {
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        const lo = (v: V3) => (o.pillars ? v[1] - SLAB : floorY);
        g.quad(p, q, [q[0], lo(q), q[2]], [p[0], lo(p), p[2]], skirtColor);
      }
      if (o.pillars) g.quad([a.left[0], a.left[1] - SLAB, a.left[2]], [a.right[0], a.right[1] - SLAB, a.right[2]], [b.right[0], b.right[1] - SLAB, b.right[2]], [b.left[0], b.left[1] - SLAB, b.left[2]], shade(skirtColor, 0.7));
    }
    if (o.bare) continue;
    // Retouche 38b : les rebords dans leur propre calque si le compositeur en donne un (ils projettent l'ombre de contact, la route non).
    const r = c.rebords ?? g;
    for (const side of ["left", "right"] as const) {
      const p = a[side];
      const q = b[side];
      const mx = (a.left[0] + a.right[0]) / 2;
      const mz = (a.left[2] + a.right[2]) / 2;
      const dx = p[0] - mx;
      const dz = p[2] - mz;
      const len = Math.hypot(dx, dz) || 1;
      const longueur = Math.hypot(q[0] - p[0], q[2] - p[2]);
      const t: TronconRebord = { a: p, b: q, dehors: [dx / len, dz / len], cote: side, s: run[side], longueur, couleurs: o.fence ?? [pal.wallA, pal.wallB], bande: !!o.band, hauteur: pal.wallHeight ?? WALL_HEIGHT };
      if (o.open) style.bordureVide(r, c.lumineux, t, pal, [mx, a.left[1], mz]);
      else style.rebord(r, t, pal, c.lumineux);
      run[side] += longueur;
    }
  }
}

function shoulderColor(pal: Palette, kind: NonNullable<Block["shoulder"]>, i: number): number {
  if (kind === "grass" && pal.scenery === "trees") return [0x6f9a3a, 0x668f34][i % 2]!;
  return SURFACE_COLORS[kind][i % 2]!;
}

const SURFACE_MARKS: Record<string, number> = { dirt: 0x5e4328, ice: 0xffffff, grass: 0x2f7a26, gravel: 0x6b5d4a, sand: 0xb8985a, snow: 0xc9d8e8, kerb: 0xffffff };

function addShoulderMarks(g: Builder, b: Block, rows: Row[], hw: number) {
  const color = SURFACE_MARKS[b.shoulder!]!;
  for (let k = 0; k < 14; k++) {
    const row = rows[Math.min(rows.length - 1, Math.floor((((k * 7 + b.index * 3) % 14) / 14) * rows.length))]!;
    const width = rowWidth(row);
    const side = k % 2 === 0 ? 0 : 1;
    const off = hw + 0.6 + (((k * 13 + b.index * 5) % 10) / 10) * (SHOULDER_EDGE - hw - 1.2);
    const t = side === 0 ? 0.5 - off / width : 0.5 + off / width;
    const p = across(row, t, 0.04);
    const s = b.shoulder === "snow" ? 0.9 : 0.35;
    g.tri([p[0] - s, p[1], p[2]], [p[0] + s, p[1], p[2]], [p[0], p[1] + (b.shoulder === "grass" ? 0.5 : 0.12), p[2] + s * 0.4], color);
  }
}

function addBandEnd(g: Builder, pal: Palette, b: Block, end: 0 | 1, reach: number) {
  for (const side of [1, -1]) {
    let p0: V3;
    let p1: V3;
    let y: number;
    if (isCurve(b.kind) && end === 1) {
      const c = curveCenter(b.kind);
      y = b.y0;
      p0 = world(b, c.cp, c.r + side * reach, y);
      p1 = world(b, c.cp, c.r + side * SHOULDER_EDGE, y);
    } else {
      const q = end === 0 ? 0 : CELL;
      y = blockHeight(b, q);
      p0 = world(b, CELL / 2 + side * reach, q, y);
      p1 = world(b, CELL / 2 + side * SHOULDER_EDGE, q, y);
    }
    g.quad(p0, p1, [p1[0], y + WALL_HEIGHT, p1[2]], [p0[0], y + WALL_HEIGHT, p0[2]], pal.fence[0]);
  }
}

function neighborReach(n: Block | undefined, end: 0 | 1): number {
  if (!n || n.open) return Infinity;
  return blockReachAt(n, end);
}

const CUVE_ARC_SEGMENTS = 6;
const CUVE_WALL_SEGMENTS = 4;
const CUVE_BAND = 4;

function cuveProfile(W: number, aLeft: number, aRight: number): [number, number][] {
  const side = (a: number, sign: 1 | -1): [number, number][] => {
    const R = cuveRadius(W, a);
    const top = cuveTop(W, a);
    const f = W - R;
    const pts: [number, number][] = [];
    for (let i = CUVE_WALL_SEGMENTS; i >= 0; i--) pts.push([sign * W, R + ((top - R) * i) / CUVE_WALL_SEGMENTS]);
    for (let i = CUVE_ARC_SEGMENTS - 1; i >= 0; i--) {
      const phi = (Math.PI / 2) * (i / CUVE_ARC_SEGMENTS);
      pts.push([sign * (f + R * Math.sin(phi)), R - R * Math.cos(phi)]);
    }
    return pts;
  };
  return [...side(aLeft, 1), ...side(aRight, -1).reverse()];
}

function addCuve(g: Builder, pal: Palette, style: StyleRoute, b: Block, color: number, floorY: number): void {
  const W = b.w0 / 2;
  const curve = isCurve(b.kind);
  const left = curve && turnsLeft(b.kind);
  const { r: Rc } = curveCenter(b.kind);
  const [wa, wb] = style.cuve(pal);
  const rows = curve ? (curveSize(b.kind) === 1 ? 14 : curveSize(b.kind) === 2 ? 30 : 48) : 24;
  const sections: { pts: V3[]; band: number }[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    let amp: (bit: number) => number;
    let at: (lam: number, y: number) => V3;
    let along: number;
    if (curve) {
      const a = (Math.PI / 2) * t;
      amp = (bit) => cuveAmplitude(b, bit, curveCenter(b.kind).cp + (left ? -1 : 1) * Rc * Math.cos(a), Rc * Math.sin(a));
      at = (lam, y) => arcPoint(b, left ? Rc - lam : Rc + lam, a, b.y0 + y);
      along = Rc * a;
    } else {
      const q = CELL * t;
      amp = (bit) => cuveAmplitude(b, bit, CELL / 2, q);
      at = (lam, y) => world(b, CELL / 2 + lam, q, b.y0 + y);
      along = q;
    }
    sections.push({ pts: cuveProfile(W, amp(CUVE_LEFT), amp(CUVE_RIGHT)).map(([lam, y]) => at(lam, y)), band: Math.floor((along + b.index * 7) / CUVE_BAND) });
  }
  for (let i = 0; i < rows; i++) {
    const A = sections[i]!;
    const B = sections[i + 1]!;
    const n = A.pts.length;
    const mid = (n >> 1) - 1;
    for (let k = 0; k + 1 < n; k++) {
      const c = k === mid ? color : (k + A.band) % 2 === 0 ? wa : wb;
      g.quad(A.pts[k]!, A.pts[k + 1]!, B.pts[k + 1]!, B.pts[k]!, c);
    }
    for (const k of [0, n - 1]) {
      const a = A.pts[k]!;
      const bb = B.pts[k]!;
      const inner = A.pts[k === 0 ? n - 1 : 0]!;
      const dx = a[0] - inner[0];
      const dz = a[2] - inner[2];
      const len = Math.hypot(dx, dz) || 1;
      const ox = (dx / len) * 0.6;
      const oz = (dz / len) * 0.6;
      g.quad(a, bb, [bb[0] + ox, bb[1], bb[2] + oz], [a[0] + ox, a[1], a[2] + oz], A.band % 2 === 0 ? wa : wb);
      const sx = (ox / 0.6) * 0.15;
      const sz = (oz / 0.6) * 0.15;
      g.quad([a[0] + sx, a[1], a[2] + sz], [bb[0] + sx, bb[1], bb[2] + sz], [bb[0] + sx, floorY, bb[2] + sz], [a[0] + sx, floorY, a[2] + sz], style.jupe(pal));
    }
  }
}

function addJumpMarks(g: Builder, b: Block) {
  const WARN = [0xffc21a, 0x16181f] as const;
  const y = (q: number) => blockHeight(b, q) + 0.05;
  for (const qc of [2.6, 5.6, 8.6]) {
    for (const s of [-1, 1]) g.quad(world(b, CELL / 2, qc + 1.4, y(qc + 1.4)), world(b, CELL / 2, qc + 0.5, y(qc + 0.5)), world(b, CELL / 2 + s * 4, qc - 0.9, y(qc - 0.9)), world(b, CELL / 2 + s * 4, qc, y(qc)), 0xf4f1e6);
  }
  const cols = Math.round(blockWidth(b, JUMP_LIP));
  const q0 = JUMP_LIP - 1.4;
  for (let i = 0; i < cols; i++) {
    const pa = CELL / 2 - cols / 2 + i;
    g.quad(world(b, pa, q0, y(q0) + 0.01), world(b, pa + 1, q0, y(q0) + 0.01), world(b, pa + 1, JUMP_LIP, y(JUMP_LIP) + 0.01), world(b, pa, JUMP_LIP, y(JUMP_LIP) + 0.01), WARN[i % 2]!);
    const top = b.y0 + JUMP_RISE;
    g.quad(world(b, pa, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP + 0.01, b.y0), world(b, pa, JUMP_LIP + 0.01, b.y0), WARN[(i + 1) % 2]!);
  }
}

function addKickMarks(g: Builder, b: Block) {
  const WARN = [0xffc21a, 0x16181f] as const;
  const y = (q: number) => blockHeight(b, q) + 0.05;
  for (const qc of [KICK_START + 2.2, KICK_START + 5.4, KICK_START + 8.6]) {
    for (const s of [-1, 1]) g.quad(world(b, CELL / 2, qc + 1.4, y(qc + 1.4)), world(b, CELL / 2, qc + 0.5, y(qc + 0.5)), world(b, CELL / 2 + s * 4, qc - 0.9, y(qc - 0.9)), world(b, CELL / 2 + s * 4, qc, y(qc)), 0xf4f1e6);
  }
  const cols = Math.round(blockWidth(b, CELL));
  const q0 = CELL - 1.4;
  for (let i = 0; i < cols; i++) {
    const pa = CELL / 2 - cols / 2 + i;
    g.quad(world(b, pa, q0, y(q0) + 0.01), world(b, pa + 1, q0, y(q0) + 0.01), world(b, pa + 1, CELL, y(CELL) + 0.01), world(b, pa, CELL, y(CELL) + 0.01), WARN[i % 2]!);
    g.quad(world(b, pa, CELL, y(CELL) - 0.05), world(b, pa + 1, CELL, y(CELL) - 0.05), world(b, pa + 1, CELL + 0.01, y(CELL) - 1.2), world(b, pa, CELL + 0.01, y(CELL) - 1.2), WARN[(i + 1) % 2]!);
  }
}

function addLandingMarks(g: Builder, b: Block) {
  const y = (q: number) => blockHeight(b, q) + 0.05;
  const cols = Math.round(blockWidth(b, 0));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const pa = CELL / 2 - cols / 2 + i;
      const qa = j * 1.2;
      g.quad(world(b, pa, qa, y(qa)), world(b, pa + 1, qa, y(qa)), world(b, pa + 1, qa + 1.2, y(qa + 1.2)), world(b, pa, qa + 1.2, y(qa + 1.2)), (i + j) % 2 === 0 ? 0x2fd37b : 0xf4f1e6);
    }
  }
  for (const qc of [6, 10, 14]) {
    for (const s of [-1, 1]) g.quad(world(b, CELL / 2, qc + 1.2, y(qc + 1.2)), world(b, CELL / 2, qc + 0.4, y(qc + 0.4)), world(b, CELL / 2 + s * 3.2, qc - 0.8, y(qc - 0.8)), world(b, CELL / 2 + s * 3.2, qc, y(qc)), 0x2fd37b);
  }
}

function addEndFace(g: Builder, row: Row, floorY: number, color: number, pillars: boolean) {
  const lo = (v: V3) => (pillars ? v[1] - SLAB : floorY);
  g.quad(row.left, row.right, [row.right[0], lo(row.right), row.right[2]], [row.left[0], lo(row.left), row.left[2]], color);
}

function addPillar(g: Builder, pal: Palette, b: Block, floorY: number, skirt: number) {
  const mid = onBlock(b, 0, 0.5, 0);
  const half = blockHalfWidth(b, CELL / 2);
  const color = shade(skirt, 1.15);
  const top = mid[1] - SLAB;
  const fwd = onBlock(b, 0, 0.56, 0);
  const back = onBlock(b, 0, 0.44, 0);
  const dx = fwd[0] - back[0];
  const dz = fwd[2] - back[2];
  const len = Math.hypot(dx, dz) || 1;
  g.box(mid[0] - 1.1, floorY, mid[2] - 1.1, mid[0] + 1.1, top - 1.4, mid[2] + 1.1, color);
  const ax = Math.abs(dx / len) > 0.7 ? 1.6 : half * 0.66;
  const az = Math.abs(dx / len) > 0.7 ? half * 0.66 : 1.6;
  g.box(mid[0] - ax, top - 1.4, mid[2] - az, mid[0] + ax, top, mid[2] + az, shade(color, 0.85));
  void pal;
}

function addSurfaceMarks(g: Builder, b: Block) {
  if (b.surface === "road") return;
  const color = SURFACE_MARKS[b.surface]!;
  const lift = 0.05;
  if (b.surface === "dirt") {
    for (const lat of [-2.6, 2.6]) {
      for (let k = 0; k < 6; k++) {
        const t0 = (k + 0.1) / 6;
        const t1 = (k + 0.8) / 6;
        g.quad(onBlock(b, lat - 0.3, t0, lift), onBlock(b, lat + 0.3, t0, lift), onBlock(b, lat + 0.3, t1, lift), onBlock(b, lat - 0.3, t1, lift), color);
      }
    }
  } else if (b.surface === "ice") {
    for (let k = 0; k < 5; k++) {
      const t0 = (k + 0.2) / 5;
      const t1 = t0 + 0.06;
      const lat = (k % 2 === 0 ? -1 : 1) * (2.5 + (k % 3));
      g.quad(onBlock(b, lat, t0, lift), onBlock(b, lat + 0.4, t0, lift), onBlock(b, lat + 1.8, t1, lift), onBlock(b, lat + 1.4, t1, lift), color);
    }
  } else {
    for (let k = 0; k < 9; k++) {
      const lat = (((k * 5 + b.index * 3) % 11) - 5) * 1.1;
      const t = (k + 0.5) / 9;
      g.tri(onBlock(b, lat - 0.35, t, lift), onBlock(b, lat + 0.35, t, lift), onBlock(b, lat, t + 0.01, 0.65), color);
    }
  }
}

/** Les calques que la route remplit : la route (éclairée, reçoit les ombres) et un calque sans éclairage (vibreurs, néons). */
export interface CalquesRoute {
  route: Builder;
  lumineux: Builder;
  /**
   * Retouche 38b : les rebords et bordures du vide dans un calque à eux (il projette les ombres de contact sur la piste ; la surface de la route,
   * plate, n'a pas besoin d'être redessinée dans la carte d'ombres). Absent : dans `route`, comme au lot 38.
   */
  rebords?: Builder;
}

/** Options de la route (retouche 38b). */
export interface OptionsRoute {
  /** Multiplie le nombre de tranches des virages (1 = celui du jeu). */
  lissage?: number;
}

/** Ce que la route dit au compositeur, bloc par bloc : où sont les bords (pour l'ombre de contact, le décor). */
export interface RouteConstruite {
  floorY: number;
  /** Par bloc : vrai si le bloc a des rebords (ni bas-côté, ni vide, ni cuve, ni vide de saut). */
  rebords: boolean[];
}

/** La route d'un circuit, avec les rebords, vibreurs et marquages du style. */
export function construireRoute(track: Track, pal: Palette, style: StyleRoute, c: CalquesRoute, floorY: number, opts: OptionsRoute = {}): RouteConstruite {
  const g = c.route;
  const lissage = opts.lissage ?? 1;
  const run: Parcours = { left: 0, right: 0 };
  const rebords: boolean[] = [];
  for (const b of track.blocks) {
    const color = style.couleurRoute(b, pal);
    const pillars = Math.min(b.y0, b.y0 + b.rise) - floorY > PILLAR_MIN;
    const base: Options = { open: b.open, pillars };
    const skirt = style.jupe(pal);
    const prev = track.blocks[b.index - 1];
    const next = track.blocks[b.index + 1];
    let rows: Row[] = [];
    rebords.push(!b.open && !b.shoulder && !b.cuve && b.kind !== "gap");
    if (b.cuve) {
      addCuve(g, pal, style, b, color, floorY);
    } else if (b.kind === "gap") {
      // le vide d'un saut
    } else if (isCurve(b.kind)) {
      if (b.shoulder) {
        const band = curveRows(b, SHOULDER_EDGE, 0, lissage);
        addRoad(c, pal, style, band, shoulderColor(pal, b.shoulder, b.index), floorY, true, false, skirt, { pillars, fence: pal.fence, band: true }, run);
        addShoulderMarks(g, b, band, b.w0 / 2);
        rows = curveRows(b, b.w0 / 2, 0.03, lissage);
        addRoad(c, pal, style, rows, color, floorY, false, b.surface === "road", skirt, { bare: true }, run);
      } else {
        rows = curveRows(b, b.w0 / 2, 0, lissage);
        addRoad(c, pal, style, rows, color, floorY, true, b.surface === "road", skirt, base, run);
      }
      if (b.surface === "road") style.vibreurs(c.lumineux, rows, pal);
    } else if (b.kind === "jump") {
      const swell = b.w0 !== b.w1 ? 8 : 1;
      addRoad(c, pal, style, straightRows(b, 0, JUMP_LIP, swell, (q) => blockHeight(b, q)), shade(color, 1.18), floorY, true, false, shade(skirt, 1.9), base, run);
      addJumpMarks(g, b);
      rows = straightRows(b, JUMP_LIP, CELL, swell, () => b.y0);
      addRoad(c, pal, style, rows, color, floorY, true, b.surface === "road", skirt, base, run);
    } else if (b.kind === "kick") {
      rows = straightRows(b, 0, CELL, 16, (q) => blockHeight(b, q));
      addRoad(c, pal, style, rows.slice(0, 9), color, floorY, true, b.surface === "road", skirt, base, run);
      addRoad(c, pal, style, rows.slice(8), shade(color, 1.18), floorY, true, false, shade(skirt, 1.5), base, run);
      addKickMarks(g, b);
    } else if (b.shoulder) {
      const steps = b.bumpy ? 48 : b.kind === "bump" || b.w0 !== b.w1 ? 16 : 1;
      const band = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q), SHOULDER_EDGE);
      addRoad(c, pal, style, band, shoulderColor(pal, b.shoulder, b.index), floorY, true, false, skirt, { pillars, fence: pal.fence, band: true }, run);
      addShoulderMarks(g, b, band, b.w0 / 2);
      rows = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q) + 0.03);
      addRoad(c, pal, style, rows, color, floorY, false, b.surface === "road", skirt, { bare: true }, run);
    } else {
      const steps = b.bumpy ? 48 : b.kind === "bump" || b.w0 !== b.w1 ? 16 : 1;
      rows = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q));
      addRoad(c, pal, style, rows, color, floorY, true, b.surface === "road", skirt, base, run);
    }
    if (b.shoulder) {
      const ein = neighborReach(prev, 1);
      const eout = neighborReach(next, 0);
      if (ein < SHOULDER_EDGE) addBandEnd(g, pal, b, 0, ein);
      if (eout < SHOULDER_EDGE) addBandEnd(g, pal, b, 1, eout);
    }
    if (rows.length > 0 && next?.kind === "gap") addEndFace(g, rows[rows.length - 1]!, floorY, shade(skirt, 1.25), pillars);
    if (rows.length > 0 && prev?.kind === "gap") {
      addEndFace(g, rows[0]!, floorY, shade(skirt, 1.25), pillars);
      addLandingMarks(g, b);
    }
    if (pillars && b.kind !== "gap") addPillar(g, pal, b, floorY, skirt);
    const effect = b.kind === "boost" || b.kind === "turbo" || b.kind === "cut";
    if (b.surface === "road" && !effect && !b.bumpy && b.kind !== "jump" && b.kind !== "bump" && b.kind !== "kick" && b.kind !== "gap") style.tirets(g, b, pal);
    addSurfaceMarks(g, b);
  }
  // Bouts fermés : un mur en travers de la route au départ et derrière l'arrivée.
  const first = track.blocks[0]!;
  const last = track.blocks[track.blocks.length - 1]!;
  for (const [b, q] of [[first, 0], [last, CELL]] as const) {
    const y = blockHeight(b, q);
    const hw = blockHalfWidth(b, q);
    const l = world(b, CELL / 2 + hw, q, y);
    const r = world(b, CELL / 2 - hw, q, y);
    g.quad(l, r, [r[0], y + WALL_HEIGHT, r[2]], [l[0], y + WALL_HEIGHT, l[2]], pal.wallA);
  }
  return { floorY, rebords };
}

// --- Le style d'origine (celui du jeu) : point de départ de chaque direction --------------------------------------------------------

/** Bandes d'environ 4 m (lot 21), comptées sur le tronçon. */
function bandesDe4m(g: Builder, t: TronconRebord, couleurs: [number, number], haut: number, chapeau: number) {
  const pieces = Math.max(1, Math.round(t.longueur / 4));
  const ox = t.dehors[0] * chapeau;
  const oz = t.dehors[1] * chapeau;
  for (let k = 0; k < pieces; k++) {
    const at = (u: number, up: number): V3 => [t.a[0] + (t.b[0] - t.a[0]) * u, t.a[1] + (t.b[1] - t.a[1]) * u + up, t.a[2] + (t.b[2] - t.a[2]) * u];
    const n = Math.floor((t.s + (k * t.longueur) / pieces) / 4);
    const couleur = couleurs[n % 2]!;
    const u0 = k / pieces;
    const u1 = (k + 1) / pieces;
    g.quad(at(u0, 0), at(u1, 0), at(u1, haut), at(u0, haut), couleur);
    const c0 = at(u0, haut);
    const c1 = at(u1, haut);
    g.quad(c0, c1, [c1[0] + ox, c1[1], c1[2] + oz], [c0[0] + ox, c0[1], c0[2] + oz], couleur);
  }
}

export const STYLE_ORIGINE: StyleRoute = {
  rebord(g, t) {
    bandesDe4m(g, t, t.couleurs, t.hauteur, 0.6);
  },
  bordureVide(g, lum, t, pal, milieu) {
    const neon = pal.neon;
    const target = neon ? lum : g;
    const p = t.a;
    const q = t.b;
    const len = Math.hypot(milieu[0] - p[0], milieu[2] - p[2]) || 1;
    const ix = ((milieu[0] - p[0]) / len) * 0.5;
    const iz = ((milieu[2] - p[2]) / len) * 0.5;
    const pieces = Math.max(1, Math.round(t.longueur / 4));
    for (let k = 0; k < pieces; k++) {
      const at = (u: number, inward: number): V3 => [p[0] + (q[0] - p[0]) * u + ix * inward, p[1] + (q[1] - p[1]) * u + 0.06, p[2] + (q[2] - p[2]) * u + iz * inward];
      const n = Math.floor((t.s + (k * t.longueur) / pieces) / 4);
      const color = neon ? neon[t.cote === "left" ? 0 : 1] : n % 2 === 0 ? pal.wallA : pal.wallB;
      target.quad(at(k / pieces, 0), at(k / pieces, neon ? 0.5 : 1), at((k + 1) / pieces, neon ? 0.5 : 1), at((k + 1) / pieces, 0), color);
      if (neon && k % 2 === 0) {
        const m = at((k + 0.5) / pieces, 0.25);
        target.halo(m[0], m[1] + 0.25, m[2], color, 3.4);
      }
    }
  },
  vibreurs(g, rows) {
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i]!;
      const b = rows[i + 1]!;
      const fa = KERB_WIDTH / rowWidth(a);
      const fb = KERB_WIDTH / rowWidth(b);
      const color = i % 2 === 0 ? 0xff2a3c : 0xffffff;
      g.quad(across(a, 0, 0.07), across(a, fa, 0.07), across(b, fb, 0.07), across(b, 0, 0.07), color);
      g.quad(across(a, 1 - fa, 0.07), across(a, 1, 0.07), across(b, 1, 0.07), across(b, 1 - fb, 0.07), color);
    }
  },
  rives(g, a, b, color, pal) {
    const worn = shade(color, 0.9);
    const wa = rowWidth(a);
    const wb = rowWidth(b);
    for (const c of [-2.6, 2.6]) {
      const w = 0.9;
      g.quad(across(a, 0.5 + (c - w) / wa, 0.02), across(a, 0.5 + (c + w) / wa, 0.02), across(b, 0.5 + (c + w) / wb, 0.02), across(b, 0.5 + (c - w) / wb, 0.02), worn);
    }
    for (const [d0, d1] of [[0.45, 0.75], [-0.75, -0.45]] as const) {
      const fa = (d: number) => (d >= 0 ? d / wa : 1 + d / wa);
      const fb = (d: number) => (d >= 0 ? d / wb : 1 + d / wb);
      g.quad(across(a, fa(d0), 0.03), across(a, fa(d1), 0.03), across(b, fb(d1), 0.03), across(b, fb(d0), 0.03), shade(pal.dash, 0.92));
    }
  },
  tirets(g, b, pal) {
    tiretsCentre(g, b, pal.dash, 0.25, 4);
  },
  couleurRoute(b, pal) {
    return b.surface === "road" ? pal.road[b.index % 2]! : SURFACE_COLORS[b.surface][b.index % 2]!;
  },
  jupe(pal) {
    return pal.skirt;
  },
  cuve(pal) {
    return [pal.wallA, pal.wallB];
  },
};

/** Tirets au centre d'un bloc : demi-largeur `w`, longueur `long` (m) tous les 8 m sur une droite, ~6 m dans un virage. */
export function tiretsCentre(g: Builder, b: Block, couleur: number, w: number, long: number) {
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    const at = (r: number, a: number) => arcPoint(b, r, a, b.y0 + 0.04);
    const n = isWide(b.kind) ? 12 : 4;
    const part = Math.min(0.85, 0.45 * (long / 4));
    for (let k = 0; k < n; k++) {
      const a0 = ((k + 0.2) / n) * (Math.PI / 2);
      const a1 = ((k + 0.2 + part) / n) * (Math.PI / 2);
      g.quad(at(R - w, a0), at(R + w, a0), at(R + w, a1), at(R - w, a1), couleur);
    }
    return;
  }
  for (let k = 0; k < 4; k++) {
    const q0 = k * 8 + 2;
    const q1 = q0 + long;
    const y0 = blockHeight(b, q0) + 0.04;
    const y1 = blockHeight(b, q1) + 0.04;
    g.quad(world(b, CELL / 2 - w, q0, y0), world(b, CELL / 2 + w, q0, y0), world(b, CELL / 2 + w, q1, y1), world(b, CELL / 2 - w, q1, y1), couleur);
  }
}
