import { HALF_PI, PI, cos, sin } from "./math";

// Un circuit est une suite de blocs posés sur une grille de cellules CELL × CELL. Chaque bloc est décrit
// dans un repère « canonique » (p, q) : q = avance le long du bloc (0 = entrée, CELL = sortie),
// p = côté gauche (CELL/2 = axe de la route). Le bloc est ensuite tourné selon son cap.
// Aucune trigonométrie sur les cellules : les rotations sont des quarts de tour, donc exactes.

export const CELL = 32; // mètres
/** Largeur de la route étroite (la largeur d'origine) ; la route des anciens circuits écrits à la main. */
export const ROAD_WIDTH = 14;
export const HALF_ROAD = ROAD_WIDTH / 2;
/**
 * Les trois largeurs de route (lot 12), en mètres, dans une cellule de 32 m. Attribut de bloc (`S/n`, `S/e>l`…) :
 * `e` étroite, `n` normale, `l` large. Un bloc sans largeur garde celle du bloc précédent (14 m au départ).
 */
export const ROAD_WIDTHS = { e: 14, n: 20, l: 26 } as const;
export type WidthLetter = keyof typeof ROAD_WIDTHS;
/** La plus large des routes : toujours dans la cellule (26 < 32), et la limite d'un virage serré (rayon intérieur 3 m). */
export const MAX_ROAD_WIDTH = ROAD_WIDTHS.l;
export const WALL_HEIGHT = 1.4; // les rebords arrêtent la voiture sous cette hauteur
export const SLOPE_RISE = 4; // dénivelé d'un bloc de pente
export const BUMP_HEIGHT = 1;
export const BUMP_HALF_LENGTH = 8;
export const JUMP_RISE = 3; // hauteur du tremplin
export const JUMP_LIP = 12; // position du bord du tremplin (le sol retombe d'un coup après)
/** Un niveau de relief, en mètres : montées et descentes se comptent en niveaux (lot 17). */
export const LEVEL = SLOPE_RISE;
/** Rampe de saut (bloc K) : plate jusqu'à cette abscisse, puis monte de `LEVEL` sur le reste de la cellule (pente 0,25, comme le tremplin J). */
export const KICK_START = 16;
/**
 * Cuves (lot 18) : un côté de la route se relève en quart de cercle (rayon `CUVE_RATIO` × demi-largeur) puis en paroi verticale
 * (`CUVE_LIP` m de plus), la route gardant sa largeur. La paroi monte en rampe depuis l'entrée et la sortie d'une cuve (`CUVE_RAMP` m
 * sur une droite, `CUVE_RAMP_ARC` de l'arc dans un virage), sauf si le bloc voisin la prolonge.
 */
export const CUVE_LEFT = 1;
export const CUVE_RIGHT = 2;
export const CUVE_RATIO = 0.65;
export const CUVE_LIP = 8;
export const CUVE_RAMP = 16;
/** Dans un virage, la rampe est une fraction de l'arc (la paroi monte sur ce tiers de chaque bout) : elle s'allonge avec la taille du virage. */
export const CUVE_RAMP_ARC = 0.3;
export const BOOST_HALF_WIDTH = 3.5;
export const BOOST_HALF_LENGTH = 4;
/** Profondeur sous la route la plus basse à partir de laquelle la voiture est perdue (m). */
export const FALL_DEPTH = 4;
/** Hauteur « sans sol » : le vide. */
export const NO_GROUND = -1e9;

export type BlockKind = "straight" | "curveL" | "curveR" | "wideL" | "wideR" | "grandL" | "grandR" | "up" | "down" | "bump" | "jump" | "kick" | "gap" | "boost" | "turbo" | "cut";

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
  /** Dénivelé du bloc, de son entrée à sa sortie (m) : `LEVEL` × niveaux pour une montée ou une descente (lot 17), celui du vide pour un `gap`. */
  rise: number;
  /** Sans rebords (modificateur `o`) : la voiture peut quitter la route par le côté et tomber. */
  open: boolean;
  mark?: Mark;
  /** Revêtement du bloc. */
  surface: SurfaceKind;
  /** Virage relevé : la route s'incline vers l'extérieur (voir `bankAt`). */
  banked: boolean;
  /** Largeur de la route (m) à l'entrée et à la sortie du bloc ; différentes seulement sur un bloc de transition. */
  w0: number;
  w1: number;
  /** Cuve (lot 18) : côtés où la paroi monte jusqu'à la verticale, en bits (`CUVE_LEFT` | `CUVE_RIGHT`) ; 0 = pas de cuve. */
  cuve: number;
  /** Côtés dont la paroi continue celle du bloc précédent / se prolonge dans le suivant (pas de rampe de ce côté-là). */
  cuveIn: number;
  cuveOut: number;
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
  /** Demi-largeur de la route à la porte (m). */
  halfWidth: number;
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
  L3: "grandL",
  R3: "grandR",
  U: "up",
  D: "down",
  B: "bump",
  J: "jump",
  K: "kick",
  G: "gap",
  P: "boost",
  T: "turbo",
  C: "cut",
};
/**
 * Blocs de relief plus marqués (lot 17), `lettre → (type, dénivelé en m)` : `U2` / `U3` montent de 2 / 3 niveaux (8 / 12 m) sur
 * une cellule, `D2` / `D3` descendent d'autant. `GU` / `GD` / `GD2` sont un vide (`G`) dont l'autre bord est 1 niveau plus haut,
 * 1 niveau plus bas, 2 niveaux plus bas : le « saut avec changement de niveau ».
 */
export const RISE_LETTERS: Record<string, { kind: BlockKind; rise: number }> = {
  U2: { kind: "up", rise: 2 * SLOPE_RISE },
  U3: { kind: "up", rise: 3 * SLOPE_RISE },
  D2: { kind: "down", rise: -2 * SLOPE_RISE },
  D3: { kind: "down", rise: -3 * SLOPE_RISE },
  GU: { kind: "gap", rise: SLOPE_RISE },
  GD: { kind: "gap", rise: -SLOPE_RISE },
  GD2: { kind: "gap", rise: -2 * SLOPE_RISE },
};
/** Blocs de cuve (lot 18), `lettre → côtés` : `V` cuve droite (demi-tube, parois des deux côtés), `ML` / `MR` mur latéral à gauche / à droite. Un virage prend `/c` (son mur extérieur). */
export const CUVE_LETTERS: Record<string, number> = { V: CUVE_LEFT | CUVE_RIGHT, ML: CUVE_LEFT, MR: CUVE_RIGHT };
const MARKS: Record<string, Mark> = { start: "start", cp: "checkpoint", finish: "finish" };

const DIR_X = [0, 1, 0, -1] as const;
const DIR_Z = [1, 0, -1, 0] as const;
const DIR_YAW = [0, HALF_PI, PI, -HALF_PI] as const;

export const isCurve = (k: BlockKind) => k === "curveL" || k === "curveR" || k === "wideL" || k === "wideR" || k === "grandL" || k === "grandR";
/** Virage large ou ample (2 ou 3 cellules de côté) : tout ce qui n'est pas le virage serré d'une cellule. */
export const isWide = (k: BlockKind) => k === "wideL" || k === "wideR" || k === "grandL" || k === "grandR";
export const turnsLeft = (k: BlockKind) => k === "curveL" || k === "wideL" || k === "grandL";
/** Côté d'un virage, en cellules : 1 serré, 2 large (L2 / R2), 3 ample (L3 / R3). */
export const curveSize = (k: BlockKind): 1 | 2 | 3 => (k === "curveL" || k === "curveR" ? 1 : k === "wideL" || k === "wideR" ? 2 : 3);

/** Rayon de l'axe d'un virage large (2 × 2 cellules). */
export const WIDE_RADIUS = CELL + CELL / 2;

/**
 * Géométrie d'un virage dans le repère du bloc : arc de rayon `r` centré en (`cp`, q = 0).
 * Virage serré : rayon CELL/2, centré sur un coin de la cellule. Virage large : rayon 1,5 CELL, il déborde
 * sur la colonne voisine (à gauche ou à droite) et sur la rangée suivante. Virage ample : rayon 2,5 CELL, 3 × 3 cellules.
 */
export function curveCenter(k: BlockKind): { cp: number; r: number } {
  const r = CELL * (curveSize(k) - 0.5);
  return { cp: turnsLeft(k) ? CELL / 2 + r : CELL / 2 - r, r };
}

/**
 * Cellules occupées par un bloc posé en (cx, cz) avec le cap `dir`, et la cellule (et le cap) du bloc suivant.
 * Un virage de côté n occupe n × n cellules, sauf la cellule du coin intérieur d'un virage ample, que la route
 * (rayon 67 à 93 m du coin) n'atteint jamais.
 */
export function blockCells(cx: number, cz: number, dir: Dir, kind: BlockKind): { cells: [number, number][]; next: { cx: number; cz: number; dir: Dir } } {
  const left = ((dir + 1) & 3) as Dir;
  // (i, j) : décalage canonique en cellules, i vers la gauche, j vers l'avant.
  const at = (i: number, j: number): [number, number] => [cx + i * DIR_X[left] + j * DIR_X[dir], cz + i * DIR_Z[left] + j * DIR_Z[dir]];
  if (!isCurve(kind)) return { cells: [at(0, 0)], next: (([x, z]) => ({ cx: x, cz: z, dir }))(at(0, 1)) };
  const n = curveSize(kind);
  const s = turnsLeft(kind) ? 1 : -1;
  const cells: [number, number][] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (n === 3 && i === 2 && j === 0) continue;
      cells.push(at(i * s, j));
    }
  }
  const exit = at(n * s, n - 1);
  return { cells, next: { cx: exit[0], cz: exit[1], dir: (turnsLeft(kind) ? left : (dir + 3) & 3) as Dir } };
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
    case "down":
    case "gap": // pas de sol : la droite qui relie les deux bords sert à la caméra et aux vues d'ensemble
      return b.y0 + (b.rise * qq) / CELL;
    case "bump": {
      const t = (qq - CELL / 2) / BUMP_HALF_LENGTH;
      if (t <= -1 || t >= 1) return b.y0;
      const u = 1 - t * t;
      return b.y0 + BUMP_HEIGHT * u * u;
    }
    case "jump":
      return qq < JUMP_LIP ? b.y0 + (JUMP_RISE * qq) / JUMP_LIP : b.y0;
    case "kick":
      return qq > KICK_START ? b.y0 + (b.rise * (qq - KICK_START)) / (CELL - KICK_START) : b.y0;
    default:
      return b.y0;
  }
}

/** Pente de la route (dh/dq) au point d'avance q du bloc. */
export function blockSlope(b: Block, q: number): number {
  const qq = q < 0 ? 0 : q > CELL ? CELL : q;
  switch (b.kind) {
    case "up":
    case "down":
    case "gap":
      return b.rise / CELL;
    case "bump": {
      const t = (qq - CELL / 2) / BUMP_HALF_LENGTH;
      if (t <= -1 || t >= 1) return 0;
      return (-4 * BUMP_HEIGHT * (1 - t * t) * t) / BUMP_HALF_LENGTH;
    }
    case "jump":
      return qq < JUMP_LIP ? JUMP_RISE / JUMP_LIP : 0;
    case "kick":
      return qq > KICK_START ? b.rise / (CELL - KICK_START) : 0;
    default:
      return 0;
  }
}

/**
 * Dénivelé d'un bloc, de son entrée à sa sortie : celui qu'on lui a écrit (`rise`, pour `U2`, `GD`…), sinon celui de son type
 * (une montée ou une rampe de saut : un niveau ; une descente : un niveau en moins ; tout le reste : plat).
 */
export function exitDelta(kind: BlockKind, rise?: number): number {
  if (rise !== undefined) return rise;
  return kind === "up" || kind === "kick" ? SLOPE_RISE : kind === "down" ? -SLOPE_RISE : 0;
}

// --- Largeurs ---------------------------------------------------------------------------------

/** Fonction de lissage d'une transition de largeur (pente nulle aux deux bouts : pas de marche, pas d'angle vif). */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Largeur de la route (m) au point d'avance q du bloc : constante, sauf sur un bloc de transition (entre `w0` et `w1`). */
export function blockWidth(b: Block, q: number): number {
  if (b.w0 === b.w1) return b.w0;
  const t = (q < 0 ? 0 : q > CELL ? CELL : q) / CELL;
  return b.w0 + (b.w1 - b.w0) * smooth(t);
}

/** Demi-largeur de la route au point d'avance q du bloc. */
export const blockHalfWidth = (b: Block, q: number): number => blockWidth(b, q) / 2;

/** Demi-largeur d'une plaque (accélération, super turbo) : la moitié de la demi-largeur de la route au milieu du bloc (3,5 m sur 14 m). */
export const blockPadHalfWidth = (b: Block): number => blockHalfWidth(b, CELL / 2) / 2;

/** Pente des rebords d'un bloc de transition : d(demi-largeur)/dq (0 si la largeur est constante). */
export function blockHalfWidthSlope(b: Block, q: number): number {
  if (b.w0 === b.w1 || q <= 0 || q >= CELL) return 0;
  const t = q / CELL;
  return ((b.w1 - b.w0) * 6 * t * (1 - t)) / (2 * CELL);
}

// --- Construction -----------------------------------------------------------------------------

export interface ParsedToken {
  kind: BlockKind;
  surface: SurfaceKind;
  banked: boolean;
  mark?: Mark;
  /** Largeur écrite sur le bloc (entrée, sortie), en mètres ; absente : le bloc garde la largeur du précédent. */
  width?: { w0: number; w1: number };
  /** Dénivelé écrit sur le bloc (`U2`, `D3`, `GD`…), en mètres ; absent : celui du type (voir `exitDelta`). */
  rise?: number;
  /** Sans rebords (modificateur `o`) ; absent = avec rebords. */
  open?: true;
  /** Cuve (lot 18) : côtés de la paroi (`V`, `ML`, `MR`, ou `/c` sur un virage) ; absent = pas de cuve. */
  cuve?: number;
}

/**
 * Un bloc de la notation texte : `LETTRE[/modificateurs][@repère]`. Modificateurs : `t` terre, `g` glace, `h` herbe
 * (un seul revêtement), `b` virage relevé (virages seulement), et la largeur de la route : `e` étroite (14 m),
 * `n` normale (20 m), `l` large (26 m), ou `a>b` pour un bloc de transition (`n>l` : de la normale à la large, en un bloc
 * droit). Exemples : `S/g`, `L2/b`, `R/tb`, `S/h@cp`, `S/n`, `S/e>l`, `L3/lb`.
 */
export function parseToken(token: string, index = 0): ParsedToken {
  const [body = "", markName] = token.split("@");
  const [letter = "", mods = ""] = body.split("/");
  const shaped = RISE_LETTERS[letter];
  const cuveSides = CUVE_LETTERS[letter];
  const kind: BlockKind | undefined = shaped ? shaped.kind : cuveSides ? "straight" : BLOCK_LETTERS[letter];
  if (!kind) throw new Error(`Bloc inconnu « ${token} » (position ${index})`);
  let mark: Mark | undefined;
  if (markName !== undefined) {
    mark = MARKS[markName];
    if (!mark) throw new Error(`Repère inconnu « ${token} » (position ${index})`);
  }
  let surface: SurfaceKind = "road";
  let banked = false;
  let width: { w0: number; w1: number } | undefined;
  let open = false;
  let outerWall = false;
  for (const m of mods.match(/[enl]>[enl]|./g) ?? []) {
    if (m === "b") banked = true;
    else if (m === "o") open = true;
    else if (m === "c") outerWall = true;
    else if (SURFACE_LETTERS[m]) {
      if (surface !== "road") throw new Error(`Deux revêtements sur « ${token} » (position ${index})`);
      surface = SURFACE_LETTERS[m]!;
    } else if (m in ROAD_WIDTHS || (m.length === 3 && m[1] === ">")) {
      if (width) throw new Error(`Deux largeurs sur « ${token} » (position ${index})`);
      const w0 = ROAD_WIDTHS[m[0] as WidthLetter];
      const w1 = ROAD_WIDTHS[m[m.length - 1] as WidthLetter];
      if (w0 !== w1 && isCurve(kind)) throw new Error(`Un virage garde sa largeur : pas de transition sur « ${token} » (position ${index})`);
      width = { w0, w1 };
    } else throw new Error(`Modificateur inconnu « ${m} » dans « ${token} » (position ${index})`);
  }
  if (banked && !isCurve(kind)) throw new Error(`Seul un virage peut être relevé (${token})`);
  if (open && kind === "gap") throw new Error(`Un vide n'a pas de rebords à ouvrir (${token})`);
  if (outerWall && !isCurve(kind)) throw new Error(`Seul un virage prend un mur extérieur « /c » (${token}) : pour une droite, V, ML ou MR`);
  let cuve = cuveSides ?? 0;
  if (outerWall) cuve = turnsLeft(kind) ? CUVE_RIGHT : CUVE_LEFT; // le mur est du côté opposé au centre du virage
  if (cuve) {
    if (banked) throw new Error(`Une cuve n'est pas un virage relevé (${token})`);
    if (open) throw new Error(`Une cuve a ses parois : pas de « o » (${token})`);
    if (mark) throw new Error(`Pas de repère sur une cuve (${token})`);
    if (width && width.w0 !== width.w1) throw new Error(`Pas de transition de largeur sur une cuve (${token})`);
  }
  return { kind, surface, banked, ...(mark ? { mark } : {}), ...(width ? { width } : {}), ...(shaped ? { rise: shaped.rise } : {}), ...(open ? { open: true as const } : {}), ...(cuve ? { cuve } : {}) };
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
 * Blocs : S droit · L virage à gauche · R virage à droite · L2 / R2 virage large (2 × 2 cellules) · L3 / R3 virage ample (3 × 3) · U montée · D descente · B bosse ·
 * J tremplin · P plaque d'accélération · T super turbo · C moteur coupé (jusqu'au prochain point de contrôle). Modificateurs
 * (`S/g`, `L2/b`…) : `t` terre, `g` glace, `h` herbe, `b` virage relevé, `o` sans rebords. Relief (lot 17) : `U2` `U3` `D2` `D3`
 * (2 ou 3 niveaux sur une cellule), `K` rampe de saut, `G` vide (`GU` `GD` `GD2` : l'autre bord plus haut ou plus bas). Repères : `@start` (premier bloc), `@cp` (point de contrôle,
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
  let width: number = ROAD_WIDTH;

  tokens.forEach((token, index) => {
    const { kind, surface, banked, mark, width: written, rise, open, cuve } = parseToken(token, index);
    // Largeurs chaînées comme les hauteurs : un bloc sans largeur garde la sortie du précédent ; une largeur écrite doit
    // la prolonger exactement (seul le premier bloc la choisit), sinon la route aurait une marche.
    if (written && index > 0 && written.w0 !== width) {
      throw new Error(`Marche de largeur au bloc ${index} (« ${token} ») : la route précédente finit à ${width} m, celle-ci commence à ${written.w0} m`);
    }
    const w0 = written ? written.w0 : width;
    const w1 = written ? written.w1 : width;
    width = w1;
    if (mark && kind !== "straight") throw new Error(`Un repère n'est permis que sur un bloc S (${token})`);
    if (mark === "start" && index !== 0) throw new Error("Le départ doit être le premier bloc");
    if (mark === "finish" && index !== tokens.length - 1) throw new Error("L'arrivée doit être le dernier bloc");
    if (open && (mark === "start" || mark === "finish")) throw new Error(`Le départ et l'arrivée gardent leurs rebords (${token})`);

    const delta = exitDelta(kind, rise);
    const block: Block = { index, cx, cz, dir, kind, y0: y, rise: delta, open: open === true, surface, banked, w0, w1, cuve: cuve ?? 0, cuveIn: 0, cuveOut: 0, ...(mark ? { mark } : {}) };
    if (cuve && (index === 0 || index === tokens.length - 1)) throw new Error(`Le départ et l'arrivée gardent leurs rebords : pas de cuve (${token})`);
    const placed = blockCells(cx, cz, dir, kind);
    for (const [x, z] of placed.cells) {
      const key = cellKey(x, z);
      if (cells.has(key)) throw new Error(`Le bloc ${index} (« ${token} ») retombe sur la cellule (${x}, ${z})`);
      cells.set(key, block);
    }
    blocks.push(block);

    y += delta;
    ({ cx, cz, dir } = placed.next);
  });

  // Cuves : une paroi continue celle du voisin de même côté et de même largeur (aucune rampe à ce bord).
  for (const b of blocks) {
    if (!b.cuve) continue;
    const prev = blocks[b.index - 1];
    const next = blocks[b.index + 1];
    if (prev && prev.w1 === b.w0) b.cuveIn = b.cuve & prev.cuve;
    if (next && next.w0 === b.w1) b.cuveOut = b.cuve & next.cuve;
  }

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
      halfWidth: blockHalfWidth(b, CELL / 2),
    });
  }

  blockPoint(first, CELL / 2, 8, pt);
  const spawn: Spawn = { x: pt.x, y: first.y0, z: pt.z, yaw: DIR_YAW[first.dir] };

  let minY = 0;
  for (const b of blocks) minY = Math.min(minY, b.y0, b.y0 + b.rise);
  return { id, blocks, cells, gates, spawn, voidY: minY - FALL_DEPTH };
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
      const steps = CURVE_STEPS * (curveSize(b.kind) === 1 ? 1 : 3 * (curveSize(b.kind) - 1));
      for (let i = 0; i <= steps; i++) {
        const a = (HALF_PI * i) / steps; // 0 → π/2
        push(b, cp + side * r * cos(a), r * sin(a));
      }
    } else {
      const steps = b.kind === "bump" || b.kind === "jump" || b.kind === "kick" ? 8 : 2;
      for (let i = 0; i <= steps; i++) push(b, CELL / 2, (CELL * i) / steps);
    }
  }
  return out;
}
