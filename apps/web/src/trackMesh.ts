import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
} from "three";
import {
  BOOST_HALF_LENGTH,
  BOOST_HALF_WIDTH,
  CELL,
  CUT_HALF_LENGTH,
  HALF_ROAD,
  JUMP_LIP,
  JUMP_RISE,
  WALL_HEIGHT,
  bankAt,
  blockHeight,
  blockPoint,
  curveCenter,
  isCurve,
  isWide,
  turnsLeft,
  type BankSample,
  type Block,
  type PaletteName,
  type SurfaceKind,
  type Track,
} from "@cdj/sim";
import { PALETTE_LABELS } from "./labels";

type V3 = [number, number, number];

/** Couleurs et éclairage d'un thème. Une palette différente par jour : `paletteForDay` (sim) choisit laquelle. */
export interface Palette {
  label: string;
  sky: number;
  fogNear: number;
  fogFar: number;
  ambient: [color: number, intensity: number];
  sun: [color: number, intensity: number];
  floorA: string;
  floorB: string;
  road: [number, number];
  dash: number;
  skirt: number;
  wallA: number;
  wallB: number;
  boost: number;
  boostMark: number;
  checkpoint: number;
  finish: number;
  finishDark: number;
}

export const PALETTE_DEFS: Record<PaletteName, Palette> = {
  desert: {
    label: PALETTE_LABELS.desert,
    sky: 0xf2b27a, fogNear: 90, fogFar: 320,
    ambient: [0xfff0e0, 0.9], sun: [0xffffff, 2.2],
    floorA: "#d9a35f", floorB: "#c78f4c",
    road: [0x9a9da8, 0x8a8d98], dash: 0xf4f1e6, skirt: 0x5b4a3a,
    wallA: 0xe8283a, wallB: 0xf4f4f4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
  },
  neige: {
    label: PALETTE_LABELS.neige,
    sky: 0xcfe3f2, fogNear: 80, fogFar: 300,
    ambient: [0xeaf4ff, 1.0], sun: [0xffffff, 2.0],
    floorA: "#f4f8fb", floorB: "#e1ebf3",
    road: [0x6f7a8c, 0x646f82], dash: 0xffffff, skirt: 0x8a97ab,
    wallA: 0x2f6fd0, wallB: 0xffffff,
    boost: 0xffc414, boostMark: 0xe08a00, checkpoint: 0x1fb6a6, finish: 0xffffff, finishDark: 0x16181f,
  },
  nuit: {
    label: PALETTE_LABELS.nuit,
    sky: 0x0b1030, fogNear: 60, fogFar: 260,
    ambient: [0x8fa0ff, 0.75], sun: [0xaab8ff, 1.1],
    floorA: "#1a1f3d", floorB: "#141935",
    road: [0x434863, 0x3a3f58], dash: 0xe9e6ff, skirt: 0x1b1d2e,
    wallA: 0xff5a36, wallB: 0xffe9c4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x39c0ff, finish: 0xf4f4f4, finishDark: 0x16181f,
  },
  campagne: {
    label: PALETTE_LABELS.campagne,
    sky: 0x9fd4ff, fogNear: 100, fogFar: 340,
    ambient: [0xf2fff0, 0.95], sun: [0xfff6dd, 2.1],
    floorA: "#6fbf4f", floorB: "#63b044",
    road: [0x80838c, 0x777a83], dash: 0xf4f1e6, skirt: 0x5a6b3c,
    wallA: 0xd9402a, wallB: 0xf6f6f0,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
  },
  neon: {
    label: PALETTE_LABELS.neon,
    sky: 0x120024, fogNear: 70, fogFar: 280,
    ambient: [0xd8b0ff, 0.85], sun: [0xff9af0, 1.3],
    floorA: "#2a0a4a", floorB: "#210840",
    road: [0x2d2250, 0x261c45], dash: 0x00f0ff, skirt: 0x14092b,
    wallA: 0xff2bd6, wallB: 0x00f0ff,
    boost: 0xfff200, boostMark: 0xff7a00, checkpoint: 0x00ff9c, finish: 0xffffff, finishDark: 0x16181f,
  },
};

/** Couleurs de la route selon le revêtement (deux tons en alternance, comme la route) : lisibles d'un coup d'œil. */
const SURFACE_COLORS: Record<Exclude<SurfaceKind, "road">, [number, number]> = {
  dirt: [0x8f6b43, 0x82603b],
  ice: [0xc4e9f7, 0xb2dff1],
  grass: [0x58a340, 0x4e9638],
};
/** Motifs légers par revêtement (traces, éclats, brins) : une teinte plus sombre ou plus claire. */
const SURFACE_MARKS: Record<Exclude<SurfaceKind, "road">, number> = { dirt: 0x5e4328, ice: 0xffffff, grass: 0x2f7a26 };
/** Blocs à effet : couleurs propres, indépendantes de la palette (la lisibilité d'abord). */
const TURBO_COLOR = { base: 0xff3b30, mark: 0xffe14d };
const CUT_COLOR = { base: 0x2b1b45, mark: 0xffd22e };

class Builder {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  private readonly c = new Color();

  tri(a: V3, b: V3, c: V3, color: number) {
    this.c.set(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: number) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Boîte alignée sur les axes. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) {
    const p = (x: number, y: number, z: number): V3 => [x, y, z];
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), color);
    this.quad(p(x0, y0, z1), p(x0, y1, z1), p(x1, y1, z1), p(x1, y0, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1), color);
    this.quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), color);
    this.quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y0, z0), color);
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

const pt = { x: 0, z: 0 };

/** Point du monde au repère (p, q) du bloc, à la hauteur `y`. */
function world(b: Block, p: number, q: number, y: number): V3 {
  blockPoint(b, p, q, pt);
  return [pt.x, y, pt.z];
}

/** Une « tranche » de route : deux bords (gauche, droite) à une avance donnée. */
interface Row {
  left: V3;
  right: V3;
}

/** Tranches d'un intervalle [q0, q1] du bloc droit, avec `steps` subdivisions. `yOf` donne la hauteur. */
function straightRows(b: Block, q0: number, q1: number, steps: number, yOf: (q: number) => number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = q0 + ((q1 - q0) * i) / steps;
    const y = yOf(q);
    rows.push({ left: world(b, CELL / 2 + HALF_ROAD, q, y), right: world(b, CELL / 2 - HALF_ROAD, q, y) });
  }
  return rows;
}

const bank: BankSample = { h: 0, gp: 0, gq: 0 };

/** Point (rayon `r`, angle `a` depuis l'entrée) d'un virage, serré ou large ; la hauteur suit le relevé éventuel. */
function arcPoint(b: Block, r: number, a: number, y: number): V3 {
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

function curveRows(b: Block): Row[] {
  const { r: R } = curveCenter(b.kind);
  const steps = (isWide(b.kind) ? 24 : 10) + (b.banked ? 8 : 0);
  const rows: Row[] = [];
  const left = turnsLeft(b.kind);
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    const at = (r: number) => arcPoint(b, r, a, b.y0);
    // Dans le repère canonique p augmente vers la gauche : le bord intérieur d'un virage à gauche est à gauche.
    rows.push(left ? { left: at(R - HALF_ROAD), right: at(R + HALF_ROAD) } : { left: at(R + HALF_ROAD), right: at(R - HALF_ROAD) });
  }
  return rows;
}

// Bandes rouges et blanches, comptées par côté : partagé, le compteur donnerait une seule couleur à chaque rebord
// quand chaque tranche ne fait qu'une bande (virages).
const stripes = { left: 0, right: 0 };

function addRoad(g: Builder, pal: Palette, rows: Row[], color: number, floorY: number, skirt: boolean) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    g.quad(a.left, a.right, b.right, b.left, color);
    // Jupe : la route repose sur un « remblai » jusqu'au sol, pour qu'on lise qu'au-delà du bord c'est le vide.
    if (skirt) {
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        g.quad(p, q, [q[0], floorY, q[2]], [p[0], floorY, p[2]], pal.skirt);
      }
    }
    // Rebords : une face intérieure et un chapeau, en bandes rouges et blanches d'environ 4 m.
    for (const side of ["left", "right"] as const) {
      const p = a[side];
      const q = b[side];
      const mx = (a.left[0] + a.right[0]) / 2;
      const mz = (a.left[2] + a.right[2]) / 2;
      const dx = p[0] - mx;
      const dz = p[2] - mz;
      const len = Math.hypot(dx, dz) || 1;
      const ox = (dx / len) * 0.6; // le chapeau dépasse vers l'extérieur
      const oz = (dz / len) * 0.6;
      const pieces = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[2] - p[2]) / 4));
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces;
        const t1 = (k + 1) / pieces;
        const at = (t: number, up: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t + up, p[2] + (q[2] - p[2]) * t];
        const wallColor = stripes[side]++ % 2 === 0 ? pal.wallA : pal.wallB;
        g.quad(at(t0, 0), at(t1, 0), at(t1, WALL_HEIGHT), at(t0, WALL_HEIGHT), wallColor);
        const c0 = at(t0, WALL_HEIGHT);
        const c1 = at(t1, WALL_HEIGHT);
        g.quad(c0, c1, [c1[0] + ox, c1[1], c1[2] + oz], [c0[0] + ox, c0[1], c0[2] + oz], wallColor);
      }
    }
  }
}

/** Tirets blancs au centre de la route : ils donnent l'échelle et la sensation de vitesse. */
function addDashes(g: Builder, pal: Palette, b: Block) {
  const w = 0.25;
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    const at = (r: number, a: number) => arcPoint(b, r, a, b.y0 + 0.04);
    const n = isWide(b.kind) ? 12 : 4; // un tiret tous les ~6 m
    for (let k = 0; k < n; k++) {
      const a0 = ((k + 0.2) / n) * (Math.PI / 2);
      const a1 = ((k + 0.65) / n) * (Math.PI / 2);
      g.quad(at(R - w, a0), at(R + w, a0), at(R + w, a1), at(R - w, a1), pal.dash);
    }
    return;
  }
  for (let k = 0; k < 4; k++) {
    const q0 = k * 8 + 2;
    const q1 = q0 + 4;
    const y0 = blockHeight(b, q0) + 0.04;
    const y1 = blockHeight(b, q1) + 0.04;
    g.quad(world(b, CELL / 2 - w, q0, y0), world(b, CELL / 2 + w, q0, y0), world(b, CELL / 2 + w, q1, y1), world(b, CELL / 2 - w, q1, y1), pal.dash);
  }
}

function addBoostPad(g: Builder, pal: Palette, b: Block) {
  const y = b.y0 + 0.04;
  const p0 = CELL / 2 - BOOST_HALF_WIDTH;
  const p1 = CELL / 2 + BOOST_HALF_WIDTH;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), pal.boost);
  // Deux chevrons dans le sens de la marche.
  for (const dq of [-1.6, 1.4]) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, p1 - 0.6, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), pal.boostMark);
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + 0.6, qc - 0.9, h), pal.boostMark);
  }
}

/** Plaque de super turbo : rouge, trois chevrons jaunes (la plaque d'accélération normale en a deux, sur fond jaune). */
function addTurboPad(g: Builder, b: Block) {
  const y = b.y0 + 0.04;
  const p0 = CELL / 2 - BOOST_HALF_WIDTH;
  const p1 = CELL / 2 + BOOST_HALF_WIDTH;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), TURBO_COLOR.base);
  for (const dq of [-2.6, -0.1, 2.4]) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.4, h), world(b, p1 - 0.5, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), TURBO_COLOR.mark);
    g.tri(world(b, CELL / 2, qc + 1.4, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + 0.5, qc - 0.9, h), TURBO_COLOR.mark);
  }
}

/** Bande de moteur coupé : en travers de toute la route, damier sombre et jaune (un avertissement, pas un bonus). */
function addCutStrip(g: Builder, b: Block) {
  const y = b.y0 + 0.04;
  const q0 = CELL / 2 - CUT_HALF_LENGTH;
  const cols = 14;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const color = (i + j) % 2 === 0 ? CUT_COLOR.base : CUT_COLOR.mark;
      const pa = CELL / 2 - HALF_ROAD + i;
      const qa = q0 + 2 * j;
      g.quad(world(b, pa, qa, y), world(b, pa + 1, qa, y), world(b, pa + 1, qa + 2, y), world(b, pa, qa + 2, y), color);
    }
  }
}

/** Point du bloc : `lat` mètres à gauche de l'axe, `t` ∈ [0, 1] le long du bloc, à `lift` au-dessus de la route. */
function onBlock(b: Block, lat: number, t: number, lift: number): V3 {
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    return arcPoint(b, turnsLeft(b.kind) ? R - lat : R + lat, t * (Math.PI / 2), b.y0 + lift);
  }
  const q = t * CELL;
  return world(b, CELL / 2 + lat, q, blockHeight(b, q) + lift);
}

/** Motif léger d'un revêtement : traces de roues (terre), éclats (glace), brins (herbe). Pas de texture. */
function addSurfaceMarks(g: Builder, b: Block) {
  if (b.surface === "road") return;
  const color = SURFACE_MARKS[b.surface];
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

function addGate(g: Builder, pal: Palette, b: Block, finish: boolean) {
  const y = b.y0;
  const post = HALF_ROAD + 0.9;
  const q = CELL / 2;
  const h = 6;
  const color = finish ? pal.finish : pal.checkpoint;
  for (const side of [-1, 1]) {
    blockPoint(b, CELL / 2 + side * post, q, pt);
    g.box(pt.x - 0.4, y, pt.z - 0.4, pt.x + 0.4, y + h, pt.z + 0.4, color);
  }
  // Poutre : on la dessine dans le repère du monde, selon l'orientation du bloc.
  const a = world(b, CELL / 2 - post, q, y + h);
  const c = world(b, CELL / 2 + post, q, y + h);
  g.box(Math.min(a[0], c[0]) - 0.4, y + h - 0.8, Math.min(a[2], c[2]) - 0.4, Math.max(a[0], c[0]) + 0.4, y + h, Math.max(a[2], c[2]) + 0.4, color);
  if (finish) {
    // Damier au sol, sur toute la largeur.
    const cols = 14;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const col = (i + j) % 2 === 0 ? pal.finish : pal.finishDark;
        const p0 = CELL / 2 - HALF_ROAD + i;
        const q0 = q - 1 + j;
        g.quad(world(b, p0, q0, y + 0.04), world(b, p0 + 1, q0, y + 0.04), world(b, p0 + 1, q0 + 1, y + 0.04), world(b, p0, q0 + 1, y + 0.04), col);
      }
    }
  } else {
    const p0 = CELL / 2 - HALF_ROAD;
    const p1 = CELL / 2 + HALF_ROAD;
    g.quad(world(b, p0, q - 0.4, y + 0.04), world(b, p1, q - 0.4, y + 0.04), world(b, p1, q + 0.4, y + 0.04), world(b, p0, q + 0.4, y + 0.04), pal.checkpoint);
  }
}

function checkerTexture(a: string, b: string, repeat: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface TrackScene {
  scene: Scene;
  followGround(x: number, z: number): void;
}

/** Construit la scène d'un circuit : route, rebords, plaques, portes, et un sol à damier tout en bas. */
export function buildTrackScene(track: Track, paletteName: PaletteName = "desert"): TrackScene {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY;
  const g = new Builder();

  for (const b of track.blocks) {
    const color = b.surface === "road" ? pal.road[b.index % 2]! : SURFACE_COLORS[b.surface][b.index % 2]!;
    if (isCurve(b.kind)) {
      addRoad(g, pal, curveRows(b), color, floorY, true);
    } else if (b.kind === "jump") {
      // Rampe jusqu'au bord, face verticale, puis route plate.
      addRoad(g, pal, straightRows(b, 0, JUMP_LIP, 1, (q) => blockHeight(b, q)), color, floorY, true);
      const lipL = world(b, CELL / 2 + HALF_ROAD, JUMP_LIP, b.y0 + JUMP_RISE);
      const lipR = world(b, CELL / 2 - HALF_ROAD, JUMP_LIP, b.y0 + JUMP_RISE);
      g.quad(lipL, lipR, [lipR[0], b.y0, lipR[2]], [lipL[0], b.y0, lipL[2]], pal.skirt);
      addRoad(g, pal, straightRows(b, JUMP_LIP, CELL, 1, () => b.y0), color, floorY, true);
    } else {
      const steps = b.kind === "bump" ? 16 : 1;
      addRoad(g, pal, straightRows(b, 0, CELL, steps, (q) => blockHeight(b, q)), color, floorY, true);
    }
    const effect = b.kind === "boost" || b.kind === "turbo" || b.kind === "cut";
    if (b.surface === "road" && !effect && b.kind !== "jump" && b.kind !== "bump") addDashes(g, pal, b);
    addSurfaceMarks(g, b);
    if (b.kind === "boost") addBoostPad(g, pal, b);
    if (b.kind === "turbo") addTurboPad(g, b);
    if (b.kind === "cut") addCutStrip(g, b);
    if (b.mark === "checkpoint") addGate(g, pal, b, false);
    if (b.mark === "finish") addGate(g, pal, b, true);
  }

  // Bouts fermés : un mur en travers de la route au départ et derrière l'arrivée.
  const first = track.blocks[0]!;
  const last = track.blocks[track.blocks.length - 1]!;
  for (const [b, q] of [[first, 0], [last, CELL]] as const) {
    const y = blockHeight(b, q);
    const l = world(b, CELL / 2 + HALF_ROAD, q, y);
    const r = world(b, CELL / 2 - HALF_ROAD, q, y);
    g.quad(l, r, [r[0], y + WALL_HEIGHT, r[2]], [l[0], y + WALL_HEIGHT, l[2]], pal.wallA);
  }

  const sky = new Color(pal.sky);
  const scene = new Scene();
  scene.background = sky;
  scene.fog = new Fog(sky, pal.fogNear, pal.fogFar);
  scene.add(new AmbientLight(pal.ambient[0], pal.ambient[1]));
  const sun = new DirectionalLight(pal.sun[0], pal.sun[1]);
  sun.position.set(40, 80, -30);
  scene.add(sun);

  scene.add(new Mesh(g.geometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide })));

  const size = 1200;
  const tile = 8;
  const floor = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ map: checkerTexture(pal.floorA, pal.floorB, size / (2 * tile)), flatShading: true }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  scene.add(floor);

  return {
    scene,
    followGround(x, z) {
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
  };
}
