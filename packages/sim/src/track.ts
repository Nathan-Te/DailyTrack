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

export type BlockKind = "straight" | "curveL" | "curveR" | "wideL" | "wideR" | "up" | "down" | "bump" | "jump" | "boost" | "turbo" | "cut";

/**
 * Revêtement d'un bloc (attribut du bloc, pas un bloc) : `road` est la référence. Le comportement de chaque revêtement
 * est dans `SURFACES` (world.ts). Ajouter un revêtement = `SIM_VERSION` +1.
 */
export type SurfaceKind = "road" | "dirt" | "ice" | "grass";
/** Lettre de chaque revêtement dans la notation texte (`S/t` : droite sur terre). */
export const SURFACE_LETTERS: Record<string, SurfaceKind> = { t: "dirt", g: "ice", h: "grass" };
export type Mark = "start" | "checkpoint" | "finish";
export type Dir = 0 | 1 | 2 | 3;

export interface Block {
  index: number;
  /** Cellule d'entrée du bloc (un virage large occupe aussi des cellules voisines : voir `blockCells`). */
  cx: number;
  cz: number;
  /** Cap d'entrée : 0 = +z, 1 = +x, 2 = −z, 3 = −x (quart de tour vers la gauche à chaque pas). */
  dir: Dir;
  kind: BlockKind;
  /** Hauteur de la route à l'entrée du bloc. */
  y0: number;
  mark?: Mark;
  /** Revêtement du bloc. */
  surface: SurfaceKind;
  /** Virage relevé : la route s'incline vers l'extérieur (voir `bankAt`). */
  banked: boolean;
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
  L2: "wideL",
  R2: "wideR",
  U: "up",
  D: "down",
  B: "bump",
  J: "jump",
  P: "boost",
  T: "turbo",
  C: "cut",
};
const MARKS: Record<string, Mark> = { start: "start", cp: "checkpoint", finish: "finish" };

const DIR_X = [0, 1, 0, -1] as const;
const DIR_Z = [1, 0, -1, 0] as const;
const DIR_YAW = [0, HALF_PI, PI, -HALF_PI] as const;

export const isCurve = (k: BlockKind) => k === "curveL" || k === "curveR" || k === "wideL" || k === "wideR";
export const isWide = (k: BlockKind) => k === "wideL" || k === "wideR";
export const turnsLeft = (k: BlockKind) => k === "curveL" || k === "wideL";

/** Rayon de l'axe d'un virage large (2 × 2 cellules). */
export const WIDE_RADIUS = CELL + CELL / 2;

/**
 * Géométrie d'un virage dans le repère du bloc : arc de rayon `r` centré en (`cp`, q = 0).
 * Virage serré : rayon CELL/2, centré sur un coin de la cellule. Virage large : rayon 1,5 CELL, il déborde
 * sur la colonne voisine (à gauche ou à droite) et sur la rangée suivante.
 */
export function curveCenter(k: BlockKind): { cp: number; r: number } {
  switch (k) {
    case "curveL":
      return { cp: CELL, r: CELL / 2 };
    case "curveR":
      return { cp: 0, r: CELL / 2 };
    case "wideL":
      return { cp: CELL / 2 + WIDE_RADIUS, r: WIDE_RADIUS };
    default:
      return { cp: CELL / 2 - WIDE_RADIUS, r: WIDE_RADIUS };
  }
}

/** Cellules occupées par un bloc posé en (cx, cz) avec le cap `dir`, et la cellule (et le cap) du bloc suivant. */
export function blockCells(cx: number, cz: number, dir: Dir, kind: BlockKind): { cells: [number, number][]; next: { cx: number; cz: number; dir: Dir } } {
  const left = ((dir + 1) & 3) as Dir;
  // (i, j) : décalage canonique en cellules, i vers la gauche, j vers l'avant.
  const at = (i: number, j: number): [number, number] => [cx + i * DIR_X[left] + j * DIR_X[dir], cz + i * DIR_Z[left] + j * DIR_Z[dir]];
  let cells: [number, number][];
  let exit: [number, number];
  let nextDir: Dir = dir;
  if (kind === "wideL" || kind === "wideR") {
    const s = kind === "wideL" ? 1 : -1;
    cells = [at(0, 0), at(s, 0), at(0, 1), at(s, 1)];
    exit = at(2 * s, 1);
    nextDir = (kind === "wideL" ? left : (dir + 3) & 3) as Dir;
  } else if (kind === "curveL") {
    cells = [at(0, 0)];
    exit = at(1, 0);
    nextDir = left;
  } else if (kind === "curveR") {
    cells = [at(0, 0)];
    exit = at(-1, 0);
    nextDir = ((dir + 3) & 3) as Dir;
  } else {
    cells = [at(0, 0)];
    exit = at(0, 1);
  }
  return { cells, next: { cx: exit[0], cz: exit[1], dir: nextDir } };
}

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

export interface ParsedToken {
  kind: BlockKind;
  surface: SurfaceKind;
  banked: boolean;
  mark?: Mark;
}

/**
 * Un bloc de la notation texte : `LETTRE[/modificateurs][@repère]`. Modificateurs : `t` terre, `g` glace, `h` herbe
 * (un seul revêtement), `b` virage relevé (virages seulement). Exemples : `S/g`, `L2/b`, `R/tb`, `S/h@cp`.
 */
export function parseToken(token: string, index = 0): ParsedToken {
  const [body = "", markName] = token.split("@");
  const [letter = "", mods = ""] = body.split("/");
  const kind = BLOCK_LETTERS[letter];
  if (!kind) throw new Error(`Bloc inconnu « ${token} » (position ${index})`);
  let mark: Mark | undefined;
  if (markName !== undefined) {
    mark = MARKS[markName];
    if (!mark) throw new Error(`Repère inconnu « ${token} » (position ${index})`);
  }
  let surface: SurfaceKind = "road";
  let banked = false;
  for (const m of mods) {
    if (m === "b") banked = true;
    else if (SURFACE_LETTERS[m]) {
      if (surface !== "road") throw new Error(`Deux revêtements sur « ${token} » (position ${index})`);
      surface = SURFACE_LETTERS[m]!;
    } else throw new Error(`Modificateur inconnu « ${m} » dans « ${token} » (position ${index})`);
  }
  if (banked && !isCurve(kind)) throw new Error(`Seul un virage peut être relevé (${token})`);
  return { kind, surface, banked, ...(mark ? { mark } : {}) };
}

// --- Virages relevés --------------------------------------------------------------------------

/** Pente du relevé, de l'axe vers l'extérieur : virage serré (rayon 16 m) et virage large (rayon 48 m). */
export const BANK_SLOPE_TIGHT = 0.3;
export const BANK_SLOPE_WIDE = 0.22;
/** Le relevé monte progressivement sur cette distance (m) depuis l'entrée et la sortie du virage. */
export const BANK_RAMP = 8;

export interface BankSample {
  /** Hauteur ajoutée par le relevé. */
  h: number;
  /** Gradient dans le repère canonique (p, q). */
  gp: number;
  gq: number;
}

/**
 * Relevé d'un virage au point canonique (p, q) : la route monte vers l'extérieur de `pente × (r − rayon de l'axe)`,
 * en rampe à l'entrée et à la sortie (la hauteur redevient celle de la route plate aux bords du bloc).
 */
export function bankAt(b: Block, p: number, q: number, out: BankSample): void {
  out.h = 0;
  out.gp = 0;
  out.gq = 0;
  if (!b.banked) return;
  const { cp, r: R } = curveCenter(b.kind);
  const dp = p - cp;
  const r = Math.sqrt(dp * dp + q * q);
  if (r < 1e-6 || q < 0) return;
  const slope = isWide(b.kind) ? BANK_SLOPE_WIDE : BANK_SLOPE_TIGHT;
  const adp = dp < 0 ? -dp : dp;
  const m = q < adp ? q : adp;
  let f = 1;
  let dfp = 0;
  let dfq = 0;
  if (m < BANK_RAMP) {
    f = m / BANK_RAMP;
    if (q < adp) dfq = 1 / BANK_RAMP;
    else dfp = (dp < 0 ? -1 : 1) / BANK_RAMP;
  }
  const off = r - R;
  out.h = slope * f * off;
  out.gp = slope * ((f * dp) / r + off * dfp);
  out.gq = slope * ((f * q) / r + off * dfq);
}

/**
 * Construit un circuit à partir d'un texte : des blocs séparés par des espaces, posés l'un après l'autre
 * à partir de la cellule (0, 0), cap +z.
 *
 * Blocs : S droit · L virage à gauche · R virage à droite · L2 / R2 virage large (2 × 2 cellules) · U montée · D descente · B bosse ·
 * J tremplin · P plaque d'accélération · T super turbo · C moteur coupé (jusqu'au prochain point de contrôle). Modificateurs
 * (`S/g`, `L2/b`…) : `t` terre, `g` glace, `h` herbe, `b` virage relevé. Repères : `@start` (premier bloc), `@cp` (point de contrôle,
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
    const { kind, surface, banked, mark } = parseToken(token, index);
    if (mark && kind !== "straight") throw new Error(`Un repère n'est permis que sur un bloc S (${token})`);
    if (mark === "start" && index !== 0) throw new Error("Le départ doit être le premier bloc");
    if (mark === "finish" && index !== tokens.length - 1) throw new Error("L'arrivée doit être le dernier bloc");

    const block: Block = { index, cx, cz, dir, kind, y0: y, surface, banked, ...(mark ? { mark } : {}) };
    const placed = blockCells(cx, cz, dir, kind);
    for (const [x, z] of placed.cells) {
      const key = cellKey(x, z);
      if (cells.has(key)) throw new Error(`Le bloc ${index} (« ${token} ») retombe sur la cellule (${x}, ${z})`);
      cells.set(key, block);
    }
    blocks.push(block);

    y += exitDelta(kind);
    ({ cx, cz, dir } = placed.next);
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
  for (const b of track.blocks) {
    if (isCurve(b.kind)) {
      const { cp, r } = curveCenter(b.kind);
      const side = turnsLeft(b.kind) ? -1 : 1;
      const steps = isWide(b.kind) ? 3 * CURVE_STEPS : CURVE_STEPS;
      for (let i = 0; i <= steps; i++) {
        const a = (HALF_PI * i) / steps; // 0 → π/2
        push(b, cp + side * r * cos(a), r * sin(a));
      }
    } else {
      const steps = b.kind === "bump" || b.kind === "jump" ? 8 : 2;
      for (let i = 0; i <= steps; i++) push(b, CELL / 2, (CELL * i) / steps);
    }
  }
  return out;
}
