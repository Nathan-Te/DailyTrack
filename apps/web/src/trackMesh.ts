import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Float32BufferAttribute as F32,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
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
  cellKey,
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
  /** Haut du ciel (le bas est `sky`), disque du soleil ou de la lune (null : aucun), montagnes lointaines et leur sommet. */
  zenith: number;
  disc: number | null;
  mountain: number;
  mountainTop: number;
  /** Décor au bord de la piste : cactus et rochers, sapins, lampadaires, arbres, pylônes lumineux. */
  scenery: "desert" | "pine" | "lamps" | "trees" | "pylons";
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
    zenith: 0x6ea6d8, disc: 0xfff2c9, mountain: 0xc7794a, mountainTop: 0xe9a06a, scenery: "desert",
  },
  neige: {
    label: PALETTE_LABELS.neige,
    sky: 0xcfe3f2, fogNear: 80, fogFar: 300,
    ambient: [0xeaf4ff, 1.0], sun: [0xffffff, 2.0],
    floorA: "#f4f8fb", floorB: "#e1ebf3",
    road: [0x6f7a8c, 0x646f82], dash: 0xffffff, skirt: 0x8a97ab,
    wallA: 0x2f6fd0, wallB: 0xffffff,
    boost: 0xffc414, boostMark: 0xe08a00, checkpoint: 0x1fb6a6, finish: 0xffffff, finishDark: 0x16181f,
    zenith: 0x7fb4e3, disc: 0xffffff, mountain: 0x9fb4cc, mountainTop: 0xffffff, scenery: "pine",
  },
  nuit: {
    label: PALETTE_LABELS.nuit,
    sky: 0x0b1030, fogNear: 60, fogFar: 260,
    ambient: [0x8fa0ff, 0.75], sun: [0xaab8ff, 1.1],
    floorA: "#1a1f3d", floorB: "#141935",
    road: [0x434863, 0x3a3f58], dash: 0xe9e6ff, skirt: 0x1b1d2e,
    wallA: 0xff5a36, wallB: 0xffe9c4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x39c0ff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x02030f, disc: 0xdfe8ff, mountain: 0x1a2145, mountainTop: 0x2b3566, scenery: "lamps",
  },
  campagne: {
    label: PALETTE_LABELS.campagne,
    sky: 0x9fd4ff, fogNear: 100, fogFar: 340,
    ambient: [0xf2fff0, 0.95], sun: [0xfff6dd, 2.1],
    floorA: "#6fbf4f", floorB: "#63b044",
    road: [0x80838c, 0x777a83], dash: 0xf4f1e6, skirt: 0x5a6b3c,
    wallA: 0xd9402a, wallB: 0xf6f6f0,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x4a90d9, disc: 0xfffbe0, mountain: 0x5f9a63, mountainTop: 0x7db681, scenery: "trees",
  },
  neon: {
    label: PALETTE_LABELS.neon,
    sky: 0x120024, fogNear: 70, fogFar: 280,
    ambient: [0xd8b0ff, 0.85], sun: [0xff9af0, 1.3],
    floorA: "#2a0a4a", floorB: "#210840",
    road: [0x2d2250, 0x261c45], dash: 0x00f0ff, skirt: 0x14092b,
    wallA: 0xff2bd6, wallB: 0x00f0ff,
    boost: 0xfff200, boostMark: 0xff7a00, checkpoint: 0x00ff9c, finish: 0xffffff, finishDark: 0x16181f,
    zenith: 0x06000f, disc: 0xff4fd8, mountain: 0x2a0b55, mountainTop: 0x7a2bff, scenery: "pylons",
  },
};

/** Couleurs de la route selon le revêtement (deux tons en alternance, comme la route) : lisibles d'un coup d'œil. */
export const SURFACE_COLORS: Record<Exclude<SurfaceKind, "road">, [number, number]> = {
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
  /** Muet : les formes ne sont pas construites (mais l'appelant a tiré ses nombres au hasard comme d'habitude). */
  mute = false;

  tri(a: V3, b: V3, c: V3, color: number) {
    if (this.mute) return;
    this.c.set(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: number) {
    if (this.mute) return;
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Boîte alignée sur les axes. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) {
    if (this.mute) return;
    const p = (x: number, y: number, z: number): V3 => [x, y, z];
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), color);
    this.quad(p(x0, y0, z1), p(x0, y1, z1), p(x1, y1, z1), p(x1, y0, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1), color);
    this.quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), color);
    this.quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), color);
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x1, y0, z1), p(x1, y0, z0), color);
  }

  /**
   * Tronc de cône à `sides` facettes (pointe si `r1` ≈ 0), posé en (cx, y0, cz). Si `top` diffère de `color`, le tiers
   * supérieur prend la couleur `top` (neige sur un sapin, sommet clair d'une montagne, dessus d'un feuillage).
   */
  prism(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, sides: number, color: number, top = color, twist = 0) {
    if (this.mute) return;
    const ring = (r: number, y: number, k: number): V3 => {
      const a = twist + (k / sides) * Math.PI * 2;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    };
    const split = top === color ? 1 : 0.58;
    const rm = r0 + (r1 - r0) * split;
    const ym = y0 + h * split;
    for (let k = 0; k < sides; k++) {
      const a0 = ring(r0, y0, k);
      const a1 = ring(r0, y0, k + 1);
      const m0 = ring(rm, ym, k);
      const m1 = ring(rm, ym, k + 1);
      this.quad(a0, a1, m1, m0, color);
      if (split < 1) {
        const t0 = ring(r1, y0 + h, k);
        const t1 = ring(r1, y0 + h, k + 1);
        this.quad(m0, m1, t1, t0, top);
      }
      if (r1 > 0.001) {
        const e0 = ring(r1, y0 + h, k);
        const e1 = ring(r1, y0 + h, k + 1);
        this.tri([cx, y0 + h, cz], e0, e1, top);
      }
    }
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Éclaircit (`f` > 1) ou assombrit (`f` < 1) une couleur 0xRRGGBB. */
function shade(hex: number, f: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

/** Mélange deux couleurs : `t` = 0 → a, 1 → b. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Petit générateur à graine (mulberry32) : le décor est le même pour tout le monde, et ne touche jamais à `sim`. */
function seeded(text: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** Point à la fraction `t` de la largeur de la tranche (0 : bord gauche, 1 : bord droit), relevé de `up`. */
function across(r: Row, t: number, up: number): V3 {
  return [r.left[0] + (r.right[0] - r.left[0]) * t, r.left[1] + (r.right[1] - r.left[1]) * t + up, r.left[2] + (r.right[2] - r.left[2]) * t];
}

const ROAD_W = HALF_ROAD * 2;

function addRoad(g: Builder, pal: Palette, rows: Row[], color: number, floorY: number, skirt: boolean, paved = false, skirtColor = pal.skirt) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    g.quad(a.left, a.right, b.right, b.left, color);
    if (paved) {
      // Bitume : deux sillons plus sombres (usure des roues) et deux lignes de rive blanches.
      const worn = shade(color, 0.9);
      for (const c of [0.5 - 2.6 / ROAD_W, 0.5 + 2.6 / ROAD_W]) {
        const w = 0.9 / ROAD_W;
        g.quad(across(a, c - w, 0.02), across(a, c + w, 0.02), across(b, c + w, 0.02), across(b, c - w, 0.02), worn);
      }
      for (const [t0, t1] of [[0.45 / ROAD_W, 0.75 / ROAD_W], [1 - 0.75 / ROAD_W, 1 - 0.45 / ROAD_W]] as const) {
        g.quad(across(a, t0, 0.03), across(a, t1, 0.03), across(b, t1, 0.03), across(b, t0, 0.03), shade(pal.dash, 0.92));
      }
    }
    // Jupe : la route repose sur un « remblai » jusqu'au sol, pour qu'on lise qu'au-delà du bord c'est le vide.
    if (skirt) {
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        g.quad(p, q, [q[0], floorY, q[2]], [p[0], floorY, p[2]], skirtColor);
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

/** Marques d'un tremplin : chevrons, bande d'alerte au bord, face de chute rayée. */
function addJumpMarks(g: Builder, b: Block) {
  const WARN = [0xffc21a, 0x16181f] as const;
  const y = (q: number) => blockHeight(b, q) + 0.05;
  for (const qc of [2.6, 5.6, 8.6]) {
    for (const s of [-1, 1]) {
      // Un chevron « ^ » vers l'avant : deux bras épais.
      const p0 = CELL / 2;
      const p1 = CELL / 2 + s * 4;
      g.quad(world(b, p0, qc + 1.4, y(qc + 1.4)), world(b, p0, qc + 0.5, y(qc + 0.5)), world(b, p1, qc - 0.9, y(qc - 0.9)), world(b, p1, qc, y(qc)), 0xf4f1e6);
    }
  }
  const cols = 14;
  const q0 = JUMP_LIP - 1.4;
  for (let i = 0; i < cols; i++) {
    const pa = CELL / 2 - HALF_ROAD + i;
    g.quad(world(b, pa, q0, y(q0) + 0.01), world(b, pa + 1, q0, y(q0) + 0.01), world(b, pa + 1, JUMP_LIP, y(JUMP_LIP) + 0.01), world(b, pa, JUMP_LIP, y(JUMP_LIP) + 0.01), WARN[i % 2]!);
    const top = b.y0 + JUMP_RISE;
    g.quad(world(b, pa, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP + 0.01, b.y0), world(b, pa, JUMP_LIP + 0.01, b.y0), WARN[(i + 1) % 2]!);
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

// --- Décor (lot 9b) : tout est construit une fois, fusionné en un ou deux maillages ; rien ne touche à `sim` -------------

/** Une boîte alignée sur les axes, donnée par ses deux coins dans le repère (p, q) du bloc. */
function blockBox(g: Builder, b: Block, p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, color: number) {
  const a = world(b, p0, q0, y0);
  const c = world(b, p1, q1, y1);
  g.box(Math.min(a[0], c[0]), y0, Math.min(a[2], c[2]), Math.max(a[0], c[0]), y1, Math.max(a[2], c[2]), color);
}

const CROWD = [0xff4b4b, 0xffd22e, 0x4bd0ff, 0xf4f4f4, 0x6bff8a, 0xff8a3d, 0xc084fc] as const;

/** Tribune au départ : trois gradins en escalier, de la foule en petites boîtes de couleur, un toit léger. */
function addGrandstand(g: Builder, pal: Palette, b: Block, rnd: () => number) {
  const side = turnsLeft(b.kind) ? 1 : -1; // du côté opposé à un éventuel virage : à gauche par défaut (p grand)
  const base = side > 0 ? CELL / 2 + HALF_ROAD + 3.5 : CELL / 2 - HALF_ROAD - 3.5;
  const dir = side > 0 ? 1 : -1;
  const y0 = b.y0;
  const q0 = 5;
  const q1 = 27;
  for (let tier = 0; tier < 3; tier++) {
    const p0 = base + dir * tier * 2.2;
    const p1 = p0 + dir * 2.2;
    blockBox(g, b, Math.min(p0, p1), Math.max(p0, p1), q0, q1, y0 - 0.5, y0 + 0.9 + tier * 1.0, shade(pal.skirt, 1.1 + tier * 0.08));
    const top = y0 + 0.9 + tier * 1.0;
    const mid = (p0 + p1) / 2;
    for (let q = q0 + 0.6; q < q1 - 0.4; q += 0.9) {
      for (const o of [-0.5, 0.5]) {
        if (rnd() < 0.12) continue; // places vides
        const c = CROWD[Math.floor(rnd() * CROWD.length)]!;
        const pp = mid + o * 0.6;
        blockBox(g, b, pp - 0.22, pp + 0.22, q, q + 0.4, top, top + 0.55 + rnd() * 0.15, c);
      }
    }
  }
  // Toit : une dalle sur quatre poteaux.
  const pBack = base + dir * 6.6;
  const roof = y0 + 6.2;
  for (const q of [q0 + 0.4, q1 - 0.8]) blockBox(g, b, Math.min(pBack, pBack - dir * 0.4), Math.max(pBack, pBack - dir * 0.4), q, q + 0.4, y0, roof, 0x3a3f4d);
  blockBox(g, b, Math.min(base, pBack + dir * 0.6), Math.max(base, pBack + dir * 0.6), q0, q1, roof, roof + 0.4, pal.wallA);
}

type Style = Palette["scenery"];

/** Un élément de décor posé au sol en (x, y, z). `glow` : parties lumineuses (matériau sans éclairage). */
function addProp(g: Builder, glow: Builder, style: Style, pal: Palette, x: number, y: number, z: number, rnd: () => number) {
  const k = rnd();
  const jitter = 0.9 + rnd() * 0.2;
  if (style === "desert") {
    if (k < 0.45) {
      const h = (3 + rnd() * 3) * jitter;
      const green = mix(0x3d7a3a, 0x5aa04a, rnd());
      g.prism(x, y, z, 0.42, 0.34, h, 6, green, shade(green, 1.15));
      for (const s of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const ah = 0.9 + rnd() * 1.2;
        const ay = y + h * (0.35 + rnd() * 0.25);
        g.box(x + s * 0.35, ay, z - 0.17, x + s * 1.05, ay + 0.34, z + 0.17, green);
        g.box(x + s * 0.85, ay, z - 0.17, x + s * 1.2, ay + ah, z + 0.17, green);
      }
    } else if (k < 0.85) {
      const r = (0.9 + rnd() * 1.6) * jitter;
      const rock = mix(0xa86a44, 0xd09a6a, rnd());
      g.prism(x, y, z, r, r * 0.55, r * 0.9, 5, rock, shade(rock, 1.2), rnd() * 3);
    } else {
      const r = 0.8 + rnd() * 0.5;
      g.prism(x, y, z, r, 0.1, 0.7, 6, mix(0x9a8a45, 0xb8a050, rnd()));
    }
  } else if (style === "pine") {
    const h = (5 + rnd() * 4.5) * jitter;
    const green = mix(0x1f5a3c, 0x2f7a50, rnd());
    g.box(x - 0.22, y, z - 0.22, x + 0.22, y + h * 0.22, z + 0.22, 0x5b3d26);
    for (let t = 0; t < 3; t++) {
      const f = t / 3;
      const r = (2.1 - f * 1.0) * jitter;
      g.prism(x, y + h * (0.16 + f * 0.27), z, r, 0.05, h * 0.42, 7, green, 0xf6fbff); // neige sur le sommet
    }
    if (k > 0.8) {
      const r = 0.7 + rnd() * 0.8;
      g.prism(x + 3, y, z + 1, r, r * 0.5, r * 0.8, 5, 0x8a96a8, 0xffffff);
    }
  } else if (style === "lamps") {
    if (k < 0.5) {
      const h = (4.5 + rnd() * 1.5) * jitter;
      g.box(x - 0.1, y, z - 0.1, x + 0.1, y + h, z + 0.1, 0x20243a);
      g.box(x - 0.1, y + h - 0.1, z - 0.1, x + 0.9, y + h + 0.05, z + 0.1, 0x20243a);
      glow.box(x + 0.5, y + h - 0.2, z - 0.25, x + 0.95, y + h - 0.08, z + 0.25, 0xffe9a8);
      glow.prism(x + 0.72, y, z, 0.01, 0.01, 0.01, 3, 0xffe9a8);
    } else {
      const h = (4 + rnd() * 3.5) * jitter;
      const green = mix(0x16303a, 0x20424a, rnd());
      g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.25, z + 0.2, 0x2a2018);
      for (let t = 0; t < 3; t++) g.prism(x, y + h * (0.18 + t * 0.26), z, (1.8 - t * 0.5) * jitter, 0.05, h * 0.4, 6, green, shade(green, 1.4));
    }
  } else if (style === "trees") {
    if (k < 0.7) {
      const h = (3.6 + rnd() * 2.4) * jitter;
      const leaf = mix(0x2f8f3a, 0x5cbb4a, rnd());
      g.box(x - 0.25, y, z - 0.25, x + 0.25, y + h * 0.5, z + 0.25, 0x6a4528);
      g.prism(x, y + h * 0.35, z, 2.0 * jitter, 1.2, h * 0.45, 7, leaf, shade(leaf, 1.2), rnd());
      g.prism(x, y + h * 0.7, z, 1.4 * jitter, 0.05, h * 0.38, 7, shade(leaf, 1.08), shade(leaf, 1.3), rnd());
    } else if (k < 0.88) {
      const r = (0.9 + rnd() * 0.7) * jitter;
      g.prism(x, y, z, r, r * 0.8, r * 0.9, 8, 0xd8b45a, 0xe9cc7c); // botte de foin
    } else {
      const r = 0.7 + rnd() * 0.6;
      g.prism(x, y, z, r, r * 0.4, r * 0.8, 6, mix(0x3f9a3a, 0x6fc45a, rnd()));
    }
  } else {
    // pylônes lumineux : un mât sombre, un tube lumineux, des cubes qui flottent
    const h = (5 + rnd() * 6) * jitter;
    const c = k < 0.5 ? 0x00f0ff : k < 0.8 ? 0xff2bd6 : 0xfff200;
    g.box(x - 0.18, y, z - 0.18, x + 0.18, y + h, z + 0.18, 0x1a0b36);
    glow.box(x - 0.08, y + h * 0.15, z - 0.2, x + 0.08, y + h, z + 0.2, c);
    glow.box(x - 0.2, y + h * 0.15, z - 0.08, x + 0.2, y + h, z + 0.08, c);
    if (rnd() < 0.4) glow.box(x + 1.4, y + h * 0.5, z, x + 2.2, y + h * 0.5 + 0.8, z + 0.8, c);
  }
}

/** Décor au bord de la piste : dans les cellules vides à moins de 2 cellules d'un bloc, selon le style de la palette. */
function addScenery(g: Builder, glow: Builder, pal: Palette, track: Track, floorY: number, rnd: () => number, keep?: (cx: number, cz: number) => boolean) {
  const wanted = new Set<number>();
  const span = 2;
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (!track.cells.has(key)) wanted.add(key);
      }
    }
  }
  // La cellule est retrouvée par sa clé : on parcourt les blocs voisins pour garder (cx, cz).
  const cells: [number, number][] = [];
  const seen = new Set<number>();
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (wanted.has(key) && !seen.has(key)) {
          seen.add(key);
          cells.push([b.cx + dx, b.cz + dz]);
        }
      }
    }
  }
  let count = 0;
  for (const [cx, cz] of cells) {
    g.mute = glow.mute = keep ? !keep(cx, cz) : false; // hors du cadre : mêmes tirages au sort, aucune forme
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n && count < 650; i++, count++) {
      addProp(g, glow, pal.scenery, pal, cx * CELL + 3 + rnd() * (CELL - 6), floorY, cz * CELL + 3 + rnd() * (CELL - 6), rnd);
    }
  }
  g.mute = glow.mute = false;
}

/** Dégradé du ciel : de l'horizon (couleur du brouillard) au zénith. Fond d'écran de la scène : une seule passe, bien moins chère qu'un dôme. */
function skyGradient(pal: Palette): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(pal.zenith));
  grad.addColorStop(0.5, hex(mix(pal.zenith, pal.sky, 0.78)));
  grad.addColorStop(0.62, hex(pal.sky)); // l'horizon, un peu sous le milieu de l'écran
  grad.addColorStop(1, hex(pal.sky));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Ciel : disque de soleil / lune et étoiles pour les nuits (le dégradé est le fond de la scène). */
function buildSky(pal: Palette, rnd: () => number): Group {
  const group = new Group();
  if (pal.disc !== null) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = new Color(pal.disc);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.18, `rgba(${rgb},0.95)`);
    grad.addColorStop(0.2, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    if (pal.scenery === "pylons") {
      // soleil rétro : bandes horizontales qui s'élargissent vers le bas
      ctx.globalCompositeOperation = "destination-out";
      for (let k = 0; k < 6; k++) ctx.fillRect(0, 66 + k * 9, size, 1 + k * 1.3);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const sprite = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, blending: AdditiveBlending }));
    const night = pal.scenery === "lamps" || pal.scenery === "pylons";
    const scale = night ? 70 : 110;
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(-90, night ? 170 : 150, 380); // bas sur l'horizon, dans une direction fixe du monde
    sprite.renderOrder = -2;
    sprite.userData.heavy = true;
    sprite.lookAt(0, 0, 0);
    group.add(sprite);
  }
  if (pal.scenery === "lamps" || pal.scenery === "pylons") {
    const stars: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2;
      const e = 0.12 + rnd() * 0.85;
      const r = 400;
      stars.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new F32(stars, 3));
    const points = new Points(g, new PointsMaterial({ color: pal.scenery === "pylons" ? 0xffd9fb : 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    points.renderOrder = -2;
    points.userData.heavy = true;
    group.add(points);
  }
  return group;
}

/** Montagnes lointaines : un anneau de pics à bords nets, teintés vers la couleur de l'horizon (pas de brouillard dessus). */
function buildMountains(pal: Palette, rnd: () => number): Mesh {
  const g = new Builder();
  const horizon = pal.sky;
  const body = mix(pal.mountain, horizon, 0.38);
  const tip = mix(pal.mountainTop, horizon, 0.3);
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.12;
    const r = 300 + rnd() * 70;
    const h = 38 + rnd() * 70;
    const w = 55 + rnd() * 60;
    g.prism(Math.cos(a) * r, -10, Math.sin(a) * r, w, 0.5, h, 5 + Math.floor(rnd() * 2), shade(body, 0.85 + rnd() * 0.25), tip, rnd() * 3);
    // un second pic, plus petit, devant
    if (rnd() < 0.6) g.prism(Math.cos(a + 0.09) * (r - 28), -10, Math.sin(a + 0.09) * (r - 28), w * 0.6, 0.5, h * 0.55, 5, shade(body, 0.95 + rnd() * 0.2), tip, rnd() * 3);
  }
  const mesh = new Mesh(g.geometry(), new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }));
  mesh.renderOrder = -1;
  mesh.userData.heavy = true;
  return mesh;
}

export interface TrackScene {
  scene: Scene;
  followGround(x: number, z: number): void;
  /** Libère géométries, matériaux et textures (scènes jetables, comme celles des miniatures). */
  dispose(): void;
  /** Décor allégé (qualité basse) : montagnes, soleil, étoiles et décor de bord de piste masqués ; ciel et route restent. */
  setLite(on: boolean): void;
}

/** Libère tout ce que la scène tient côté carte graphique (géométries, matériaux, textures, fond). */
export function disposeScene(scene: Scene) {
  const texture = (t: unknown) => (t as { dispose?: () => void } | null)?.dispose?.();
  scene.traverse((o) => {
    const m = o as Mesh;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
      texture((mat as MeshStandardMaterial).map);
      mat.dispose();
    }
  });
  texture(scene.background);
}

export interface TrackSceneOptions {
  /**
   * Vue aérienne (miniatures, lot 13) : ni ciel, ni montagnes, ni brouillard ; la route, le décor de bord de piste et le sol
   * suffisent. Le reste de la scène (et son tirage au sort) est le même que dans le jeu.
   */
  aerial?: boolean;
  /**
   * Avec `aerial` : seule la portion [from, to] des blocs est vue. Le décor n'est construit qu'autour d'elle (il est tiré au sort
   * en entier, donc il est le même que dans le jeu) : une miniature coûte une fraction d'une scène complète.
   */
  near?: { from: number; to: number };
}

/** Construit la scène d'un circuit : route, rebords, plaques, portes, et un sol à damier tout en bas. */
export function buildTrackScene(track: Track, paletteName: PaletteName = "desert", options: TrackSceneOptions = {}): TrackScene {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY;
  const g = new Builder();

  for (const b of track.blocks) {
    const color = b.surface === "road" ? pal.road[b.index % 2]! : SURFACE_COLORS[b.surface][b.index % 2]!;
    if (isCurve(b.kind)) {
      addRoad(g, pal, curveRows(b), color, floorY, true, b.surface === "road");
    } else if (b.kind === "jump") {
      // Rampe jusqu'au bord, face verticale, puis route plate.
      // Le tremplin se lit comme un tremplin : rampe plus claire, flancs clairs (pas un mur brun), chevrons blancs,
      // bande d'alerte jaune et noire au bord, face de chute rayée jaune et noire.
      addRoad(g, pal, straightRows(b, 0, JUMP_LIP, 1, (q) => blockHeight(b, q)), shade(color, 1.18), floorY, true, false, shade(pal.skirt, 1.9));
      addJumpMarks(g, b);
      addRoad(g, pal, straightRows(b, JUMP_LIP, CELL, 1, () => b.y0), color, floorY, true, b.surface === "road");
    } else {
      const steps = b.kind === "bump" ? 16 : 1;
      addRoad(g, pal, straightRows(b, 0, CELL, steps, (q) => blockHeight(b, q)), color, floorY, true, b.surface === "road");
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

  const rnd = seeded(`${track.id}:${paletteName}`);
  const first0 = track.blocks[0]!;
  const decorG = new Builder();
  const glowG = new Builder();
  const near = options.aerial ? options.near : undefined;
  const NEAR_CELLS = 4;
  const windowBlocks = near ? track.blocks.slice(near.from, near.to + 1) : [];
  const nearCell = (cx: number, cz: number) => windowBlocks.some((b) => Math.abs(b.cx - cx) <= NEAR_CELLS && Math.abs(b.cz - cz) <= NEAR_CELLS);
  decorG.mute = !!near && !nearCell(first0.cx, first0.cz);
  addGrandstand(decorG, pal, first0, rnd);
  decorG.mute = false;
  addScenery(decorG, glowG, pal, track, floorY, rnd, near ? nearCell : undefined);

  const sky = new Color(pal.sky);
  const scene = new Scene();
  if (!options.aerial) {
    scene.background = skyGradient(pal);
    scene.fog = new Fog(sky, pal.fogNear, pal.fogFar);
  }
  // Lumière : hémisphérique (ciel au-dessus, sol en dessous : les faces hautes sont plus claires que les flancs) + soleil.
  // Miniatures des thèmes de nuit : lues en petit, elles doivent rester lisibles (le jeu, lui, garde sa nuit).
  const lift = options.aerial && new Color(pal.floorA).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25 ? 2.2 : 1;
  scene.add(new HemisphereLight(mix(pal.ambient[0], pal.zenith, 0.35), new Color(pal.floorB).getHex(), pal.ambient[1] * 0.45 * lift));
  scene.add(new AmbientLight(pal.ambient[0], pal.ambient[1] * 0.12 * lift));
  const sun = new DirectionalLight(pal.sun[0], pal.sun[1] * 0.85 * (lift > 1 ? 1.4 : 1));
  sun.position.set(40, 80, -30);
  scene.add(sun);

  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  scene.add(new Mesh(g.geometry(), mat));
  const decorMesh = new Mesh(decorG.geometry(), mat);
  const glowMesh = new Mesh(glowG.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  decorMesh.userData.heavy = glowMesh.userData.heavy = true;
  scene.add(decorMesh, glowMesh);

  // Ciel et montagnes suivent la caméra (donc la voiture) : toujours à l'horizon.
  const backdrop = new Group();
  if (!options.aerial) backdrop.add(buildSky(pal, rnd), buildMountains(pal, rnd));
  scene.add(backdrop);

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
    dispose: () => disposeScene(scene),
    setLite(on) {
      scene.traverse((o) => {
        if (o.userData.heavy) o.visible = !on;
      });
    },
    followGround(x, z) {
      backdrop.position.set(x, floorY, z);
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
  };
}
