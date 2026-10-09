import { HALF_PI, PI, atanRatio, cos, sin } from "./math";

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
/**
 * Bas-côtés (lot 21) : sur un bloc qui en a, la bande de revêtement du thème (herbe, terre et gravier, neige poudreuse) va du bord de
 * la route jusqu'à `SHOULDER_EDGE` m de l'axe (1 m avant le bord de la cellule), où un rebord ordinaire arrête la voiture. Sa largeur
 * dépend donc de la route : 8 m de chaque côté sur 14 m, 5 m sur 20 m, 2 m sur 26 m.
 */
export const SHOULDER_EDGE = CELL / 2 - 1;
/** Vibreurs (lot 21) : bandes de cette largeur (m) au bord intérieur et extérieur de la route dans un virage sur route ; même adhérence que la route. */
export const KERB_WIDTH = 1.5;
/**
 * Route bosselée (lot 21, modificateur `u`) : une « tôle ondulée » en travers de la route, des bosses de `RIPPLE_HEIGHT` m tous les
 * `RIPPLE_LENGTH` m, qui s'effacent sur la première et la dernière période du bloc (aucune marche avec le voisin).
 */
export const RIPPLE_HEIGHT = 0.15;
export const RIPPLE_LENGTH = 6;

export type BlockKind = "straight" | "curveL" | "curveR" | "wideL" | "wideR" | "grandL" | "grandR" | "up" | "down" | "bump" | "jump" | "kick" | "gap" | "boost" | "turbo" | "cut";

/**
 * Revêtement d'un bloc (attribut du bloc, pas un bloc) : `road` est la référence. Le comportement de chaque revêtement
 * est dans `SURFACES` (world.ts). Ajouter un revêtement = `SIM_VERSION` +1.
 */
export type SurfaceKind = "road" | "dirt" | "ice" | "grass" | "sand" | "gravel" | "snow" | "kerb";
/** Revêtements d'un bloc (attribut `S/t`…) ; `gravel` et `snow` ne sont que des bas-côtés, `kerb` le vibreur d'un virage. Le sable (lot 22) est les deux. */
export type BlockSurface = "road" | "dirt" | "ice" | "grass" | "sand";
/** Revêtement d'un bas-côté (lot 21) : herbe, terre et gravier, neige poudreuse ; sable (lot 22). */
export type ShoulderKind = "grass" | "gravel" | "snow" | "sand";
/**
 * Bord de la route (lot 21), attribut chaîné comme la largeur (`~h`, `~t`, `~p`, `~v`, `~r`) : un bas-côté (`ShoulderKind`), le vide
 * (`void` : sans rebords, comme le modificateur `o`) ou les rebords (`wall`, le défaut).
 */
export type EdgeKind = ShoulderKind | "void" | "wall";
/** Lettre de chaque bord dans la notation (`S/~h` : bas-côtés d'herbe à partir de ce bloc). */
export const EDGE_LETTERS: Record<string, EdgeKind> = { h: "grass", t: "gravel", p: "snow", s: "sand", v: "void", r: "wall" };
/** Lettre de chaque revêtement dans la notation texte (`S/t` : droite sur terre). */
export const SURFACE_LETTERS: Record<string, BlockSurface> = { t: "dirt", g: "ice", h: "grass", s: "sand" };
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
  /** Sans rebords (modificateur `o`, ou bord `~v`) : la voiture peut quitter la route par le côté et tomber. */
  open: boolean;
  /** Bas-côtés (lot 21) : bande de ce revêtement de chaque côté de la route, jusqu'à `SHOULDER_EDGE` ; `null` = rebords ou vide. */
  shoulder: ShoulderKind | null;
  /** Route bosselée (lot 21, modificateur `u`) : tôle ondulée en travers (voir `rippleAt`). */
  bumpy: boolean;
  mark?: Mark;
  /** Revêtement du bloc. */
  surface: BlockSurface;
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
  /** Lot 25 : hauteur la plus basse de la route dans chaque cellule occupée (voir `voidYAt`). */
  floors: Map<number, number>;
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

// --- Route bosselée (lot 21) -----------------------------------------------------------------

export interface Ripple {
  /** Hauteur ajoutée (m) et sa pente le long du bloc (dh/dq). */
  h: number;
  dq: number;
}

/**
 * Tôle ondulée d'un bloc bosselé au point d'avance q : bosses `RIPPLE_HEIGHT` × 16 t²(1 − t)² (t = fraction de période), pente nulle en
 * creux, effacées en lissage cubique sur la première et la dernière période (hauteur et pente nulles aux bouts du bloc). Polynômes
 * seulement : déterministe partout.
 */
export function rippleAt(q: number, out: Ripple): void {
  out.h = 0;
  out.dq = 0;
  if (q <= 0 || q >= CELL) return;
  const k = Math.floor(q / RIPPLE_LENGTH);
  const t = q / RIPPLE_LENGTH - k;
  const u = t * (1 - t);
  const bump = 16 * u * u;
  const dbump = (32 * u * (1 - 2 * t)) / RIPPLE_LENGTH;
  // Enveloppe : 0 → 1 sur la première période, 1 → 0 sur la dernière.
  let env = 1;
  let denv = 0;
  if (q < RIPPLE_LENGTH) {
    const e = q / RIPPLE_LENGTH;
    env = e * e * (3 - 2 * e);
    denv = (6 * e * (1 - e)) / RIPPLE_LENGTH;
  } else if (q > CELL - RIPPLE_LENGTH) {
    const e = (CELL - q) / RIPPLE_LENGTH;
    env = e * e * (3 - 2 * e);
    denv = (-6 * e * (1 - e)) / RIPPLE_LENGTH;
  }
  out.h = RIPPLE_HEIGHT * env * bump;
  out.dq = RIPPLE_HEIGHT * (denv * bump + env * dbump);
}

// --- Bas-côtés (lot 21) -----------------------------------------------------------------------

/**
 * Étendue latérale (m, depuis l'axe) de ce qui porte la voiture à un bout du bloc (`end` = 0 entrée, 1 sortie) : `SHOULDER_EDGE` avec des
 * bas-côtés, sinon la demi-largeur de la route. Sert aux faces de bout : un bas-côté qui s'arrête contre un bloc à rebords finit par un mur.
 */
export function blockReachAt(b: Block, end: 0 | 1): number {
  if (b.shoulder) return SHOULDER_EDGE;
  return (end === 0 ? b.w0 : b.w1) / 2;
}

// --- Construction -----------------------------------------------------------------------------

export interface ParsedToken {
  kind: BlockKind;
  surface: BlockSurface;
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
  /** Bord écrit sur le bloc (`~h`…, lot 21) : il vaut pour ce bloc et les suivants ; absent = celui du bloc précédent. */
  edge?: EdgeKind;
  /** Route bosselée (`u`). */
  bumpy?: true;
}

/**
 * Un bloc de la notation texte : `LETTRE[/modificateurs][@repère]`. Modificateurs : `t` terre, `g` glace, `h` herbe, `s` sable
 * (un seul revêtement), `b` virage relevé (virages seulement), et la largeur de la route : `e` étroite (14 m),
 * `n` normale (20 m), `l` large (26 m), ou `a>b` pour un bloc de transition (`n>l` : de la normale à la large, en un bloc
 * droit), `d` virage large ou ample qui descend d'un niveau (lot 25). Exemples : `S/g`, `L2/b`, `R/tb`, `S/h@cp`, `S/n`, `S/e>l`, `L3/lb`, `L2/d`.
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
  let surface: BlockSurface = "road";
  let banked = false;
  let edge: EdgeKind | undefined;
  let bumpy = false;
  let width: { w0: number; w1: number } | undefined;
  let open = false;
  let outerWall = false;
  let sloped = false;
  for (const m of mods.match(/[enl]>[enl]|~.|./g) ?? []) {
    if (m[0] === "~") {
      const e = EDGE_LETTERS[m[1] ?? ""];
      if (!e) throw new Error(`Bord inconnu « ${m} » dans « ${token} » (position ${index}) : ~h herbe, ~t terre et gravier, ~p neige poudreuse, ~s sable, ~v vide, ~r rebords`);
      if (edge) throw new Error(`Deux bords sur « ${token} » (position ${index})`);
      edge = e;
    } else if (m === "u") bumpy = true;
    else if (m === "b") banked = true;
    else if (m === "o") open = true;
    else if (m === "c") outerWall = true;
    else if (m === "d") sloped = true;
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
  if (bumpy && !RIPPLE_KINDS.has(kind)) throw new Error(`Seule une droite (S, U, D, P, T, C) peut être bosselée (${token})`);
  if (open && kind === "gap") throw new Error(`Un vide n'a pas de rebords à ouvrir (${token})`);
  if (outerWall && !isCurve(kind)) throw new Error(`Seul un virage prend un mur extérieur « /c » (${token}) : pour une droite, V, ML ou MR`);
  // Virage en pente (lot 25) : un virage large ou ample qui descend d'un niveau sur son arc (les lacets du Col alpin).
  if (sloped && !isWide(kind)) throw new Error(`Seul un virage large ou ample peut descendre « /d » (${token})`);
  if (sloped && outerWall) throw new Error(`Un virage en cuve reste plat : pas de « /d » (${token})`);
  let cuve = cuveSides ?? 0;
  if (outerWall) cuve = turnsLeft(kind) ? CUVE_RIGHT : CUVE_LEFT; // le mur est du côté opposé au centre du virage
  if (cuve) {
    if (banked) throw new Error(`Une cuve n'est pas un virage relevé (${token})`);
    if (open) throw new Error(`Une cuve a ses parois : pas de « o » (${token})`);
    if (mark) throw new Error(`Pas de repère sur une cuve (${token})`);
    if (width && width.w0 !== width.w1) throw new Error(`Pas de transition de largeur sur une cuve (${token})`);
  }
  return {
    kind, surface, banked, ...(mark ? { mark } : {}), ...(width ? { width } : {}), ...(shaped ? { rise: shaped.rise } : sloped ? { rise: -SLOPE_RISE } : {}), ...(open ? { open: true as const } : {}), ...(cuve ? { cuve } : {}),
    ...(edge ? { edge } : {}), ...(bumpy ? { bumpy: true as const } : {}),
  };
}

/** Blocs qui peuvent être bosselés : les droites, pentes et blocs à effet (pas les virages, bosses, sauts ni cuves). */
const RIPPLE_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>(["straight", "up", "down", "boost", "turbo", "cut"]);

/**
 * Bord effectif d'un bloc dont la chaîne demande `edge` : un bloc qui ne peut pas porter de bas-côté garde ses rebords sans casser la
 * chaîne — départ et arrivée, cuve, virage relevé, vide, rampe de saut, tremplin, montée (on y calerait : la poussée ne vaut pas le
 * roulement d'un bas-côté plus la pente). Le vide (`void`) se pose sur les mêmes blocs que le modificateur `o`, sauf montée permise.
 */
function effectiveEdge(edge: EdgeKind, kind: BlockKind, cuve: number, banked: boolean, mark: Mark | undefined, rise: number): EdgeKind {
  if (edge === "wall") return edge;
  if (mark === "start" || mark === "finish" || cuve || kind === "gap" || kind === "kick" || kind === "jump") return "wall";
  if (edge === "void") return edge;
  if (banked || kind === "up" || (kind === "down" && rise < -2 * SLOPE_RISE)) return "wall";
  return edge;
}

// --- Virages relevés --------------------------------------------------------------------------

/** Pente du relevé, de l'axe vers l'extérieur : virage serré (rayon 16 m) et virage large (rayon 48 m). */
export const BANK_SLOPE_TIGHT = 0.3;
export const BANK_SLOPE_WIDE = 0.22;
/**
 * Le relevé monte progressivement depuis l'entrée et la sortie du virage, sur cette fraction de l'arc (comme `CUVE_RAMP_ARC` pour les
 * cuves) : la rampe s'allonge avec le virage. 0,5 = le relevé n'est complet qu'au milieu du virage.
 */
export const BANK_RAMP_ARC = 0.5;

export interface BankSample {
  /** Hauteur ajoutée par le relevé. */
  h: number;
  /** Gradient dans le repère canonique (p, q). */
  gp: number;
  gq: number;
}

/**
 * Part du relevé (0 → 1) à la fraction `t` de l'arc (0 à l'entrée, 1 à la sortie) : un profil quintique (« smootherstep ») de chaque bout,
 * dont la pente **et** la courbure sont nulles aux deux extrémités — la route ne fait ni marche ni tremplin. Écrit dans `d` la dérivée
 * par rapport à `t`.
 */
export function bankFactor(t: number, d?: { v: number }): number {
  const w = t < 0.5 ? t : 1 - t;
  const x = w / BANK_RAMP_ARC;
  if (x >= 1) {
    if (d) d.v = 0;
    return 1;
  }
  if (d) d.v = ((30 * x * x * (x - 1) * (x - 1)) / BANK_RAMP_ARC) * (t < 0.5 ? 1 : -1);
  return x * x * x * (x * (6 * x - 15) + 10);
}

const bankD = { v: 0 };

/** Virage en pente (lot 25, `L2/d`) : un virage dont la hauteur change d'entrée en sortie. */
export const isSlopedCurve = (b: Pick<Block, "kind" | "rise">): boolean => b.rise !== 0 && isCurve(b.kind);
/** Un virage dont la hauteur n'est pas celle de son entrée partout : relevé ou en pente (`bankAt` donne la différence). */
export const curveRelief = (b: Pick<Block, "kind" | "rise" | "banked">): boolean => b.banked || isSlopedCurve(b);

/**
 * Relevé d'un virage au point canonique (p, q) : la route monte vers l'extérieur de `pente × part × (r − rayon de l'axe)`. La part
 * (`bankFactor`) ne dépend que de l'angle, par la fraction d'arc t = q / (q + |dp|) : le relevé naît et meurt en douceur, à l'entrée
 * comme à la sortie (la hauteur redevient celle de la route plate aux bords du bloc).
 * Virage en pente (lot 25) : s'y ajoute `dénivelé × angle ÷ (π/2)` (angle depuis l'entrée, `atanRatio`) : une hélice, de pente constante
 * le long de l'arc, qui part de la hauteur d'entrée et finit à celle de sortie.
 */
export function bankAt(b: Block, p: number, q: number, out: BankSample): void {
  out.h = 0;
  out.gp = 0;
  out.gq = 0;
  if (!b.banked && !isSlopedCurve(b)) return;
  const { cp, r: R } = curveCenter(b.kind);
  const dp = p - cp;
  const r = Math.sqrt(dp * dp + q * q);
  if (r < 1e-6 || q < 0) return;
  const adp = dp < 0 ? -dp : dp;
  if (b.rise !== 0) {
    // Angle depuis l'entrée a = atan2(q, |dp|) : da/dq = |dp| / r², da/dp = −q × signe(dp) / r².
    const k = b.rise / HALF_PI;
    out.h = k * atanRatio(q, adp);
    out.gp = (k * (dp < 0 ? q : -q)) / (r * r);
    out.gq = (k * adp) / (r * r);
  }
  if (!b.banked) return;
  const slope = isWide(b.kind) ? BANK_SLOPE_WIDE : BANK_SLOPE_TIGHT;
  const sum = q + adp;
  const f = bankFactor(q / sum, bankD);
  const off = r - R;
  // t = q / (q + |dp|) : dt/dq = |dp| / somme², dt/dp = −q / somme² × signe(dp)
  const dtq = adp / (sum * sum);
  const dtp = (dp < 0 ? 1 : -1) * (q / (sum * sum));
  out.h += slope * f * off;
  out.gp += slope * ((f * dp) / r + off * bankD.v * dtp);
  out.gq += slope * ((f * q) / r + off * bankD.v * dtq);
}

/**
 * Construit un circuit à partir d'un texte : des blocs séparés par des espaces, posés l'un après l'autre
 * à partir de la cellule (0, 0), cap +z.
 *
 * Blocs : S droit · L virage à gauche · R virage à droite · L2 / R2 virage large (2 × 2 cellules) · L3 / R3 virage ample (3 × 3) · U montée · D descente · B bosse ·
 * J tremplin · P plaque d'accélération · T super turbo · C moteur coupé (jusqu'au prochain point de contrôle). Modificateurs
 * (`S/g`, `L2/b`…) : `t` terre, `g` glace, `h` herbe, `b` virage relevé, `o` sans rebords, `u` route bosselée (lot 21). Bords (lot 21,
 * chaînés comme la largeur : valent pour ce bloc et les suivants) : `~h` bas-côtés d'herbe, `~t` de terre et gravier, `~p` de neige
 * poudreuse, `~v` le vide, `~r` retour aux rebords (`S/n~h`, `L2/~t`) ; un bloc qui ne peut pas en porter garde ses rebords. Relief (lot 17) : `U2` `U3` `D2` `D3`
 * (2 ou 3 niveaux sur une cellule), `L2/d` `L3/d` virage en pente qui descend d'un niveau (lot 25), `K` rampe de saut, `G` vide (`GU` `GD` `GD2` : l'autre bord plus haut ou plus bas). Repères : `@start` (premier bloc), `@cp` (point de contrôle,
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
  let edgeChain: EdgeKind = "wall";

  tokens.forEach((token, index) => {
    const { kind, surface, banked, mark, width: written, rise, open, cuve, edge: writtenEdge, bumpy } = parseToken(token, index);
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
    // Bord (lot 21) : chaîné comme la largeur ; `o` met ce bloc seul sans rebords (le vide), quelle que soit la chaîne.
    if (writtenEdge) edgeChain = writtenEdge;
    const isLast = index === tokens.length - 1;
    const edge = open ? "void" : effectiveEdge(edgeChain, kind, cuve ?? 0, banked, isLast ? (mark ?? "finish") : mark, delta);
    if (writtenEdge && writtenEdge !== "wall" && edge === "wall" && (mark === "start" || mark === "finish")) throw new Error(`Le départ et l'arrivée gardent leurs rebords (${token})`);
    const shoulder = edge === "grass" || edge === "gravel" || edge === "snow" || edge === "sand" ? edge : null;
    const block: Block = {
      index, cx, cz, dir, kind, y0: y, rise: delta, open: edge === "void", shoulder, bumpy: bumpy === true, surface, banked, w0, w1, cuve: cuve ?? 0, cuveIn: 0, cuveOut: 0,
      ...(mark ? { mark } : {}),
    };
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
      // Avec des bas-côtés, la porte couvre toute la bande : on peut passer le point de contrôle en coupant.
      halfWidth: b.shoulder ? SHOULDER_EDGE : blockHalfWidth(b, CELL / 2),
    });
  }

  blockPoint(first, CELL / 2, 8, pt);
  const spawn: Spawn = { x: pt.x, y: first.y0, z: pt.z, yaw: DIR_YAW[first.dir] };

  let minY = 0;
  for (const b of blocks) minY = Math.min(minY, b.y0, b.y0 + b.rise);
  const floors = new Map<number, number>();
  for (const [key, b] of cells) floors.set(key, Math.min(b.y0, b.y0 + b.rise));
  return { id, blocks, cells, gates, spawn, voidY: minY - FALL_DEPTH, floors };
}

/**
 * Hauteur sous laquelle la voiture est perdue à l'endroit (x, z) (lot 25) : `FALL_DEPTH` sous la route la plus basse des cellules voisines
 * (3 × 3 autour de la voiture), ou `track.voidY` loin de toute route. Avant le lot 25, c'était partout `track.voidY` (la route la plus basse du
 * circuit) : au Col alpin, 200 m plus bas que le départ, une voiture tombée en haut aurait chuté quatre secondes avant de reprendre.
 */
export function voidYAt(track: Track, x: number, z: number): number {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let floor = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const f = track.floors.get(cellKey(cx + dx, cz + dz));
      if (f !== undefined && f < floor) floor = f;
    }
  }
  return floor === Infinity ? track.voidY : floor - FALL_DEPTH;
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
  const slope: BankSample = { h: 0, gp: 0, gq: 0 };
  const push = (b: Block, p: number, q: number) => {
    blockPoint(b, p, q, pt);
    out.x.push(pt.x);
    out.z.push(pt.z);
    if (isSlopedCurve(b)) bankAt(b, p, q, slope); // sur l'axe, le relevé est nul : seule la pente compte
    out.y.push(blockHeight(b, q) + (isSlopedCurve(b) ? slope.h : 0));
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
