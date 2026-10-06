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
  HALF_ROAD,
  JUMP_LIP,
  JUMP_RISE,
  WALL_HEIGHT,
  blockHeight,
  blockPoint,
  isCurve,
  type Block,
  type Track,
} from "@cdj/sim";

type V3 = [number, number, number];

/** Palette d'un jour : le thème « désert » pour l'instant (une palette par jour viendra au lot 4). */
export const DESERT = {
  sky: 0xf2b27a,
  floorA: "#d9a35f",
  floorB: "#c78f4c",
  road: [0x9a9da8, 0x8a8d98],
  dash: 0xf4f1e6,
  skirt: 0x5b4a3a,
  wallA: 0xe8283a,
  wallB: 0xf4f4f4,
  boost: 0xffd22e,
  boostMark: 0xe39b00,
  checkpoint: 0x2e7dff,
  finish: 0xf4f4f4,
  finishDark: 0x16181f,
} as const;

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

function curveRows(b: Block, steps = 10): Row[] {
  const R = CELL / 2;
  const rows: Row[] = [];
  const left = b.kind === "curveL";
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    const at = (r: number): V3 => {
      const p = left ? CELL - r * Math.cos(a) : r * Math.cos(a);
      return world(b, p, r * Math.sin(a), b.y0);
    };
    // Dans le repère canonique p augmente vers la gauche : le bord intérieur d'un virage à gauche est à gauche.
    rows.push(left ? { left: at(R - HALF_ROAD), right: at(R + HALF_ROAD) } : { left: at(R + HALF_ROAD), right: at(R - HALF_ROAD) });
  }
  return rows;
}

let stripe = 0;

function addRoad(g: Builder, rows: Row[], color: number, floorY: number, skirt: boolean) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    g.quad(a.left, a.right, b.right, b.left, color);
    // Jupe : la route repose sur un « remblai » jusqu'au sol, pour qu'on lise qu'au-delà du bord c'est le vide.
    if (skirt) {
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        g.quad(p, q, [q[0], floorY, q[2]], [p[0], floorY, p[2]], DESERT.skirt);
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
        const wallColor = stripe++ % 2 === 0 ? DESERT.wallA : DESERT.wallB;
        g.quad(at(t0, 0), at(t1, 0), at(t1, WALL_HEIGHT), at(t0, WALL_HEIGHT), wallColor);
        const c0 = at(t0, WALL_HEIGHT);
        const c1 = at(t1, WALL_HEIGHT);
        g.quad(c0, c1, [c1[0] + ox, c1[1], c1[2] + oz], [c0[0] + ox, c0[1], c0[2] + oz], wallColor);
      }
    }
  }
}

/** Tirets blancs au centre de la route : ils donnent l'échelle et la sensation de vitesse. */
function addDashes(g: Builder, b: Block) {
  const w = 0.25;
  if (isCurve(b.kind)) {
    const R = CELL / 2;
    const left = b.kind === "curveL";
    const at = (r: number, a: number): V3 => {
      const p = left ? CELL - r * Math.cos(a) : r * Math.cos(a);
      return world(b, p, r * Math.sin(a), b.y0 + 0.04);
    };
    for (let k = 0; k < 4; k++) {
      const a0 = ((k + 0.2) / 4) * (Math.PI / 2);
      const a1 = ((k + 0.65) / 4) * (Math.PI / 2);
      g.quad(at(R - w, a0), at(R + w, a0), at(R + w, a1), at(R - w, a1), DESERT.dash);
    }
    return;
  }
  for (let k = 0; k < 4; k++) {
    const q0 = k * 8 + 2;
    const q1 = q0 + 4;
    const y0 = blockHeight(b, q0) + 0.04;
    const y1 = blockHeight(b, q1) + 0.04;
    g.quad(world(b, CELL / 2 - w, q0, y0), world(b, CELL / 2 + w, q0, y0), world(b, CELL / 2 + w, q1, y1), world(b, CELL / 2 - w, q1, y1), DESERT.dash);
  }
}

function addBoostPad(g: Builder, b: Block) {
  const y = b.y0 + 0.04;
  const p0 = CELL / 2 - BOOST_HALF_WIDTH;
  const p1 = CELL / 2 + BOOST_HALF_WIDTH;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), DESERT.boost);
  // Deux chevrons dans le sens de la marche.
  for (const dq of [-1.6, 1.4]) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, p1 - 0.6, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), DESERT.boostMark);
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + 0.6, qc - 0.9, h), DESERT.boostMark);
  }
}

function addGate(g: Builder, b: Block, finish: boolean) {
  const y = b.y0;
  const post = HALF_ROAD + 0.9;
  const q = CELL / 2;
  const h = 6;
  const color = finish ? DESERT.finish : DESERT.checkpoint;
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
        const col = (i + j) % 2 === 0 ? DESERT.finish : DESERT.finishDark;
        const p0 = CELL / 2 - HALF_ROAD + i;
        const q0 = q - 1 + j;
        g.quad(world(b, p0, q0, y + 0.04), world(b, p0 + 1, q0, y + 0.04), world(b, p0 + 1, q0 + 1, y + 0.04), world(b, p0, q0 + 1, y + 0.04), col);
      }
    }
  } else {
    const p0 = CELL / 2 - HALF_ROAD;
    const p1 = CELL / 2 + HALF_ROAD;
    g.quad(world(b, p0, q - 0.4, y + 0.04), world(b, p1, q - 0.4, y + 0.04), world(b, p1, q + 0.4, y + 0.04), world(b, p0, q + 0.4, y + 0.04), DESERT.checkpoint);
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
export function buildTrackScene(track: Track): TrackScene {
  const floorY = track.voidY;
  const g = new Builder();

  for (const b of track.blocks) {
    const color = DESERT.road[b.index % 2]!;
    if (isCurve(b.kind)) {
      addRoad(g, curveRows(b), color, floorY, true);
    } else if (b.kind === "jump") {
      // Rampe jusqu'au bord, face verticale, puis route plate.
      addRoad(g, straightRows(b, 0, JUMP_LIP, 1, (q) => blockHeight(b, q)), color, floorY, true);
      const lipL = world(b, CELL / 2 + HALF_ROAD, JUMP_LIP, b.y0 + JUMP_RISE);
      const lipR = world(b, CELL / 2 - HALF_ROAD, JUMP_LIP, b.y0 + JUMP_RISE);
      g.quad(lipL, lipR, [lipR[0], b.y0, lipR[2]], [lipL[0], b.y0, lipL[2]], DESERT.skirt);
      addRoad(g, straightRows(b, JUMP_LIP, CELL, 1, () => b.y0), color, floorY, true);
    } else {
      const steps = b.kind === "bump" ? 16 : 1;
      addRoad(g, straightRows(b, 0, CELL, steps, (q) => blockHeight(b, q)), color, floorY, true);
    }
    if (b.kind !== "boost" && b.kind !== "jump" && b.kind !== "bump") addDashes(g, b);
    if (b.kind === "boost") addBoostPad(g, b);
    if (b.mark === "checkpoint") addGate(g, b, false);
    if (b.mark === "finish") addGate(g, b, true);
  }

  // Bouts fermés : un mur en travers de la route au départ et derrière l'arrivée.
  const first = track.blocks[0]!;
  const last = track.blocks[track.blocks.length - 1]!;
  for (const [b, q] of [[first, 0], [last, CELL]] as const) {
    const y = blockHeight(b, q);
    const l = world(b, CELL / 2 + HALF_ROAD, q, y);
    const r = world(b, CELL / 2 - HALF_ROAD, q, y);
    g.quad(l, r, [r[0], y + WALL_HEIGHT, r[2]], [l[0], y + WALL_HEIGHT, l[2]], DESERT.wallA);
  }

  const sky = new Color(DESERT.sky);
  const scene = new Scene();
  scene.background = sky;
  scene.fog = new Fog(sky, 90, 320);
  scene.add(new AmbientLight(0xfff0e0, 0.9));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, -30);
  scene.add(sun);

  scene.add(new Mesh(g.geometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide })));

  const size = 1200;
  const tile = 8;
  const floor = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ map: checkerTexture(DESERT.floorA, DESERT.floorB, size / (2 * tile)), flatShading: true }),
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
