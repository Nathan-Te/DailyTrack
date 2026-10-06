import { HALF_PI, PI, cos, sin } from "./math";

// Un circuit est une suite de blocs posés sur une grille de cellules CELL × CELL. Chaque bloc est décrit
// dans un repère « canonique » (p, q) : q = avance le long du bloc (0 = entrée, CELL = sortie),
// p = côté gauche (CELL/2 = axe de la route). Le bloc est ensuite tourné selon son cap.
// Aucune trigonométrie sur les cellules : les rotations sont des quarts de tour, donc exactes.

export const CELL = 32; // mètres
export const ROAD_WIDTH = 14;
export const HALF_ROAD = ROAD_WIDTH / 2;
export const WALL_HEIGHT = 1.4; // les rebords arrêtent la voiture sous cette hauteur
export const SLOPE_RISE = 4; // dénivelé d'un bloc de pente
export const BUMP_HEIGHT = 1;
export const BUMP_HALF_LENGTH = 8;
export const JUMP_RISE = 3; // hauteur du tremplin
export const JUMP_LIP = 12; // position du bord du tremplin (le sol retombe d'un coup après)
export const BOOST_HALF_WIDTH = 3.5;
export const BOOST_HALF_LENGTH = 4;
/** Hauteur « sans sol » : le vide. */
export const NO_GROUND = -1e9;

export type BlockKind = "straight" | "curveL" | "curveR" | "up" | "down" | "bump" | "jump" | "boost";
export type Mark = "start" | "checkpoint" | "finish";
export type Dir = 0 | 1 | 2 | 3;

export interface Block {
  index: number;
  cx: number;
  cz: number;
  /** Cap d'entrée : 0 = +z, 1 = +x, 2 = −z, 3 = −x (quart de tour vers la gauche à chaque pas). */
  dir: Dir;
  kind: BlockKind;
  /** Hauteur de la route à l'entrée du bloc. */
  y0: number;
  mark?: Mark;
}

export interface Gate {
  kind: "checkpoint" | "finish";
  block: number;
  x: number;
  z: number;
  y: number;
  /** Direction de passage (vecteur unitaire). */
  fx: number;
  fz: number;
  yaw: number;
}

export interface Spawn {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Track {
  id: string;
  blocks: Block[];
  cells: Map<number, Block>;
  gates: Gate[];
  spawn: Spawn;
  /** Au-dessous de cette hauteur, la voiture est perdue (retour au dernier point de contrôle). */
  voidY: number;
}

/** Lettre → type de bloc, dans la notation texte des circuits. */
export const BLOCK_LETTERS: Record<string, BlockKind> = {
  S: "straight",
  L: "curveL",
  R: "curveR",
  U: "up",
  D: "down",
  B: "bump",
  J: "jump",
  P: "boost",
};
const MARKS: Record<string, Mark> = { start: "start", cp: "checkpoint", finish: "finish" };

const DIR_X = [0, 1, 0, -1] as const;
const DIR_Z = [1, 0, -1, 0] as const;
const DIR_YAW = [0, HALF_PI, PI, -HALF_PI] as const;

export const isCurve = (k: BlockKind) => k === "curveL" || k === "curveR";

export function cellKey(cx: number, cz: number): number {
  return (cx + 1024) * 4096 + (cz + 1024);
}

// --- Repère du bloc ---------------------------------------------------------------------------

/** Coordonnée latérale canonique (p) d'un point (u, v) local à la cellule. */
export function canonP(dir: Dir, u: number, v: number): number {
  return dir === 0 ? u : dir === 1 ? CELL - v : dir === 2 ? CELL - u : v;
}

/** Coordonnée d'avance canonique (q) d'un point (u, v) local à la cellule. */
export function canonQ(dir: Dir, u: number, v: number): number {
  return dir === 0 ? v : dir === 1 ? u : dir === 2 ? CELL - v : CELL - u;
}

/** Point du monde correspondant à (p, q) dans le repère du bloc. */
export function blockPoint(b: Block, p: number, q: number, out: { x: number; z: number }): void {
  const d = b.dir;
  const u = d === 0 ? p : d === 1 ? q : d === 2 ? CELL - p : CELL - q;
  const v = d === 0 ? q : d === 1 ? CELL - p : d === 2 ? CELL - q : p;
  out.x = b.cx * CELL + u;
  out.z = b.cz * CELL + v;
}

/** Vecteur canonique (np, nq) → vecteur du monde (x, z). */
export function canonVecToWorld(dir: Dir, np: number, nq: number, out: { x: number; z: number }): void {
  if (dir === 0) {
    out.x = np;
    out.z = nq;
  } else if (dir === 1) {
    out.x = nq;
    out.z = -np;
  } else if (dir === 2) {
    out.x = -np;
    out.z = -nq;
  } else {
    out.x = -nq;
    out.z = np;
  }
}

export const dirX = (d: Dir): number => DIR_X[d];
export const dirZ = (d: Dir): number => DIR_Z[d];

// --- Hauteurs ---------------------------------------------------------------------------------

/** Hauteur de la route au point d'avance q du bloc. */
export function blockHeight(b: Block, q: number): number {
  const qq = q < 0 ? 0 : q > CELL ? CELL : q;
  switch (b.kind) {
    case "up":
      return b.y0 + (SLOPE_RISE * qq) / CELL;
    case "down":
      return b.y0 - (SLOPE_RISE * qq) / CELL;
    case "bump": {
      const t = (qq - CELL / 2) / BUMP_HALF_LENGTH;
      if (t <= -1 || t >= 1) return b.y0;
      const u = 1 - t * t;
      return b.y0 + BUMP_HEIGHT * u * u;
    }
    case "jump":
      return qq < JUMP_LIP ? b.y0 + (JUMP_RISE * qq) / JUMP_LIP : b.y0;
    default:
      return b.y0;
  }
}

/** Pente de la route (dh/dq) au point d'avance q du bloc. */
export function blockSlope(b: Block, q: number): number {
  const qq = q < 0 ? 0 : q > CELL ? CELL : q;
  switch (b.kind) {
    case "up":
      return SLOPE_RISE / CELL;
    case "down":
      return -SLOPE_RISE / CELL;
    case "bump": {
      const t = (qq - CELL / 2) / BUMP_HALF_LENGTH;
      if (t <= -1 || t >= 1) return 0;
      return (-4 * BUMP_HEIGHT * (1 - t * t) * t) / BUMP_HALF_LENGTH;
    }
    case "jump":
      return qq < JUMP_LIP ? JUMP_RISE / JUMP_LIP : 0;
    default:
      return 0;
  }
}

/** Dénivelé d'un bloc, de son entrée à sa sortie. */
export function exitDelta(kind: BlockKind): number {
  return kind === "up" ? SLOPE_RISE : kind === "down" ? -SLOPE_RISE : 0;
}

// --- Construction -----------------------------------------------------------------------------

/**
 * Construit un circuit à partir d'un texte : des blocs séparés par des espaces, posés l'un après l'autre
 * à partir de la cellule (0, 0), cap +z.
 *
 * Blocs : S droit · L virage à gauche · R virage à droite · U montée · D descente · B bosse ·
 * J tremplin · P plaque d'accélération. Repères : `@start` (premier bloc), `@cp` (point de contrôle,
 * sur un S), `@finish` (dernier bloc). Départ et arrivée sont sur des blocs S.
 */
export function parseTrack(id: string, spec: string): Track {
  const tokens = spec.trim().split(/\s+/);
  const blocks: Block[] = [];
  const cells = new Map<number, Block>();
  let cx = 0;
  let cz = 0;
  let dir: Dir = 0;
  let y = 0;

  tokens.forEach((token, index) => {
    const [letter = "", markName] = token.split("@");
    const kind = BLOCK_LETTERS[letter];
    if (!kind) throw new Error(`Bloc inconnu « ${token} » (position ${index})`);
    let mark: Mark | undefined;
    if (markName !== undefined) {
      mark = MARKS[markName];
      if (!mark) throw new Error(`Repère inconnu « ${token} » (position ${index})`);
    }
    if (mark && kind !== "straight") throw new Error(`Un repère n'est permis que sur un bloc S (${token})`);
    if (mark === "start" && index !== 0) throw new Error("Le départ doit être le premier bloc");
    if (mark === "finish" && index !== tokens.length - 1) throw new Error("L'arrivée doit être le dernier bloc");

    const block: Block = { index, cx, cz, dir, kind, y0: y, ...(mark ? { mark } : {}) };
    const key = cellKey(cx, cz);
    if (cells.has(key)) throw new Error(`Le bloc ${index} (« ${token} ») retombe sur la cellule (${cx}, ${cz})`);
    cells.set(key, block);
    blocks.push(block);

    y += exitDelta(kind);
    if (kind === "curveL") dir = ((dir + 1) & 3) as Dir;
    else if (kind === "curveR") dir = ((dir + 3) & 3) as Dir;
    cx += DIR_X[dir];
    cz += DIR_Z[dir];
  });

  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  if (first.mark !== "start") throw new Error("Le premier bloc doit porter @start");
  if (last.mark !== "finish") throw new Error("Le dernier bloc doit porter @finish");

  const pt = { x: 0, z: 0 };
  const gates: Gate[] = [];
  for (const b of blocks) {
    if (b.mark !== "checkpoint" && b.mark !== "finish") continue;
    blockPoint(b, CELL / 2, CELL / 2, pt);
    gates.push({
      kind: b.mark,
      block: b.index,
      x: pt.x,
      z: pt.z,
      y: blockHeight(b, CELL / 2),
      fx: DIR_X[b.dir],
      fz: DIR_Z[b.dir],
      yaw: DIR_YAW[b.dir],
    });
  }

  blockPoint(first, CELL / 2, 8, pt);
  const spawn: Spawn = { x: pt.x, y: first.y0, z: pt.z, yaw: DIR_YAW[first.dir] };

  let minY = 0;
  for (const b of blocks) minY = Math.min(minY, b.y0, b.y0 + exitDelta(b.kind));
  return { id, blocks, cells, gates, spawn, voidY: minY - 8 };
}

// --- Ligne médiane ----------------------------------------------------------------------------

export interface Centerline {
  x: number[];
  z: number[];
  y: number[];
  /** Indice du bloc auquel appartient chaque point. */
  block: number[];
}

const CURVE_STEPS = 8;

/** Ligne médiane de la route, du départ à l'arrivée (utilisée par les pilotes automatiques et l'affichage). */
export function trackCenterline(track: Track): Centerline {
  const out: Centerline = { x: [], z: [], y: [], block: [] };
  const pt = { x: 0, z: 0 };
  const push = (b: Block, p: number, q: number) => {
    blockPoint(b, p, q, pt);
    out.x.push(pt.x);
    out.z.push(pt.z);
    out.y.push(blockHeight(b, q));
    out.block.push(b.index);
  };
  const R = CELL / 2;
  for (const b of track.blocks) {
    if (b.kind === "curveL" || b.kind === "curveR") {
      // Arc de rayon CELL/2 centré sur un coin de la cellule.
      for (let i = 0; i <= CURVE_STEPS; i++) {
        const a = (HALF_PI * i) / CURVE_STEPS; // 0 → π/2
        if (b.kind === "curveL") push(b, CELL - R * cos(a), R * sin(a));
        else push(b, R * cos(a), R * sin(a));
      }
    } else {
      const steps = b.kind === "bump" || b.kind === "jump" ? 8 : 2;
      for (let i = 0; i <= steps; i++) push(b, R, (CELL * i) / steps);
    }
  }
  return out;
}
