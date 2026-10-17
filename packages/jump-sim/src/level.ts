import { UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";

// Un niveau est une grille ASCII, une ligne de texte par rangée de tuiles, la rangée 0 en haut, suivie (après une ligne vide) d'un
// **bloc annexe** facultatif qui déclare les sections et les scies mobiles. `parseLevel` ne fait que lire le texte ; les règles de jeu
// sont dans `player.ts` (le personnage) et `attempt.ts` (dangers, essais, chrono, arrivée).
//
// Légende de la grille (lot 2) :
//   `#` bloc plein · `.` vide · `S` départ · `F` arrivée (ces deux-là sont des tuiles vides repérées)
//   `^` `v` `<` `>` pics, pointe vers le haut / le bas / la gauche / la droite (tuile traversable, boîte mortelle réduite)
//   `o` petite scie fixe (rayon ≈ ½ tuile) · `O` grande scie fixe (rayon ≈ 1,5 tuile), centrées sur leur tuile (traversable)
//   `x` bloc friable (plein, cède `crumbleDelay` pas après le premier contact) · `*` ressort (plein, lance vers le haut qui s'y pose)
//   `[` tapis roulant vers la gauche · `]` tapis roulant vers la droite · `~` glace (lot 11) : blocs pleins dont seule la **face du dessus**
//       agit (le tapis fait avancer, la glace fait glisser) ; leurs murs et leur dessous sont ceux d'un bloc ordinaire
//   `b` `d` **blocs clignotants** (lot 12, thème nuit) : blocs pleins qui apparaissent et disparaissent en rythme. Le cycle est déclaré dans
//       le bloc annexe (`clignote`, ci-dessous) ; `b` est solide pendant la fenêtre déclarée, `d` (le second groupe) **en opposition de
//       phase** : solide pendant le reste du cycle. Un bloc qui devrait devenir solide pendant que le personnage le chevauche **reste
//       traversable jusqu'à ce que le personnage en sorte** : on ne meurt jamais écrasé ni coincé
//   `A` `B` **blocs alternés** (lot 12, thème néon) : deux jeux de blocs pleins dont **exactement un est solide à la fois**. **Chaque saut qui
//       part** (sol, coyote, saut mural, saut gardé dans le tampon qui part vraiment — pas un ressort, pas un simple appui) inverse les deux
//       jeux. Au départ de l'essai, **A est solide** ; **franchir un point de passage** remet A solide, et la mort ramène l'état du point de
//       reprise (donc A). Même règle de sortie que les clignotants
//   `C` point de passage (tuile vide repérée, posée sur un sol sûr ; un seul par colonne) : le centre du personnage qui **franchit sa colonne**
//       vers la droite, vivant, à n'importe quelle hauteur, l'active (lot 4) ; à la mort, on reprend sur lui, au sol, chrono qui continue
//
// Bloc annexe (une déclaration par ligne, `//` commente la ligne) :
//   section <nom> <col0>-<col1>
//       plage de colonnes (bornes comprises), sans chevauchement ; un élément mobile appartient à la section de son premier point et
//       son cycle démarre la première fois que le personnage y entre.
//   scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>…
//       rayon : `o`, `O` ou un nombre de tuiles (`0.75`) ; cycle : durée d'un tour complet, en pas (120 = 1 s) ; points de passage : centres
//       de tuiles. `boucle` revient du dernier point au premier ; `aller-retour` repart en sens inverse.
//   clignote <section> <cycle> <solide> <décalage>
//       (lot 12) le cycle des blocs clignotants `b` et `d` de la section : `cycle` pas en tout, `solide` pas où `b` est solide (1 à cycle − 1),
//       `décalage` : position dans le cycle au pas 0 (0 à cycle − 1). Au pas de phase `p` (pas écoulés depuis que le personnage est entré dans
//       la section ; 0 avant), `q = (p + décalage) mod cycle` : `b` est solide si `q < solide`, `d` si `q ≥ solide`. Un bloc `b` ou `d` doit
//       être dans une section qui déclare son cycle.
//   vent <col0>-<col1> <rang0>-<rang1> <haut|gauche|droite> <force> [rafale <cycle> <actif> <décalage>]
//       (lot 13, thème forêt) une **zone de vent** : un rectangle de tuiles (bornes comprises), **traversable** (ce n'est pas un bloc), qui
//       pousse le personnage tant que **le centre** de sa boîte y est, au sol comme en l'air. `haut` : une accélération verticale qui compense
//       la gravité et au-delà, jusqu'à une vitesse de montée `windRise` (on plane, on se fait porter) ; `gauche` / `droite` : une accélération
//       horizontale jusqu'à une vitesse de dérive `windDrift`, qui s'ajoute à la commande (comme un tapis). `force` : en pourcentage des
//       réglages (`WIND_MIN_FORCE` à `WIND_MAX_FORCE`, 100 = les réglages tels quels). En sortant de la zone, la vitesse acquise est gardée et la
//       physique ordinaire reprend. Sans `rafale`, la zone souffle toujours ; avec, elle souffle `actif` pas sur `cycle`, décalée de
//       `décalage` : au pas de phase `p` de la section de sa première colonne (pas écoulés depuis que le personnage y est entré ; 0 avant),
//       `q = (p + décalage) mod cycle`, elle souffle si `q < actif`. La mort et la reprise remettent l'horloge à zéro (comme les scies). Deux
//       zones ne se chevauchent pas ; une zone en rafale doit être dans une section.

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
/** Bloc friable `x` : plein tant qu'il n'est pas tombé. */
export const TILE_CRUMBLE = 2;
/** Ressort `*` : plein ; s'y poser lance vers le haut. */
export const TILE_SPRING = 3;
/** Pics : la pointe vers le haut `^`, le bas `v`, la gauche `<`, la droite `>`. */
export const TILE_SPIKE_UP = 4;
export const TILE_SPIKE_DOWN = 5;
export const TILE_SPIKE_LEFT = 6;
export const TILE_SPIKE_RIGHT = 7;
/** Lot 11 : tapis roulant vers la gauche `[`, vers la droite `]`, glace `~` (blocs pleins à face du dessus particulière). */
export const TILE_BELT_LEFT = 8;
export const TILE_BELT_RIGHT = 9;
export const TILE_ICE = 10;
/**
 * Lot 12 : blocs clignotants (`b`, `d`) et alternés (`A`, `B`). Le code d'une tuile de `Level.tiles` et de `AttemptState.tiles` est son **état
 * actuel** : plein (`…_ON`) ou absent (`…_OFF`, traversable) ; à quel groupe elle appartient se lit dans `Level.blinks` / `Level.alts`.
 */
export const TILE_BLINK_ON = 11;
export const TILE_BLINK_OFF = 12;
export const TILE_ALT_ON = 13;
export const TILE_ALT_OFF = 14;
export type Tile = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** Vrai pour une tuile qui arrête le personnage : bloc plein, bloc friable (pas encore tombé), ressort, tapis, glace, bloc clignotant ou alterné présent. */
export function isSolidTile(t: number): boolean {
  return (t >= TILE_SOLID && t <= TILE_SPRING) || (t >= TILE_BELT_LEFT && t <= TILE_ICE) || t === TILE_BLINK_ON || t === TILE_ALT_ON;
}

/** Vrai pour un bloc clignotant ou alterné (présent ou absent). */
export function isDynamicTile(t: number): boolean {
  return t >= TILE_BLINK_ON && t <= TILE_ALT_OFF;
}

/** Vrai pour un tapis roulant (l'un ou l'autre sens). */
export function isBeltTile(t: number): boolean {
  return t === TILE_BELT_LEFT || t === TILE_BELT_RIGHT;
}

/** Vrai pour un pic (n'importe quelle orientation). */
export function isSpikeTile(t: number): boolean {
  return t >= TILE_SPIKE_UP && t <= TILE_SPIKE_RIGHT;
}

/**
 * Taille maximale d'un niveau, en tuiles. Bornes choisies pour que tous les calculs entiers restent exacts : coordonnées sur 32 bits
 * (`tileOf`), distances au carré des scies et interpolations des trajets sous `Number.MAX_SAFE_INTEGER` (test « bornes »).
 */
export const MAX_LEVEL_WIDTH = 2048;
export const MAX_LEVEL_HEIGHT = 512;
/** Au plus ce nombre de points de passage par scie mobile, et ce cycle (10 minutes). */
export const MAX_SAW_POINTS = 32;
export const MAX_SAW_CYCLE = 72_000;
/** Rayon maximal d'une scie : 4 tuiles. */
export const MAX_SAW_RADIUS = 4 * UNITS_PER_TILE;
/** Lot 12 : cycle d'un bloc clignotant, en pas : de 2 à 1 200 (10 s). */
export const MIN_BLINK_CYCLE = 2;
export const MAX_BLINK_CYCLE = 1200;
/** Lot 13 : force d'une zone de vent, en % des réglages (`windAccel`, `windRise`, `windDrift`), et cycle d'une rafale (de 2 pas à 10 s). */
export const WIND_MIN_FORCE = 25;
export const WIND_MAX_FORCE = 200;
export const MIN_GUST_CYCLE = 2;
export const MAX_GUST_CYCLE = 1200;

/**
 * Rayon **mortel** des scies fixes, en unités. Un peu moins que le dessin : le disque plein a ce rayon, les dents le dépassent
 * (`o` : 7/16 de tuile, dents jusqu'à ½ ; `O` : 11/8, dents jusqu'à 1,5). Toucher une dent ne tue pas, toucher le disque tue.
 */
export const SAW_SMALL_RADIUS = 1792;
export const SAW_BIG_RADIUS = 5632;

/** Une tuile, par colonne (de gauche à droite) et rangée (de haut en bas). */
export interface Cell {
  col: number;
  row: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Section {
  name: string;
  /** Colonnes couvertes, bornes comprises. */
  c0: number;
  c1: number;
}

export type SawMode = "fixe" | "aller-retour" | "boucle";

export interface Saw {
  /** Identifiant (`o3`, `O7` pour une scie fixe : sa lettre et son rang dans la grille). */
  id: string;
  /** Rayon mortel, unités. */
  radius: number;
  mode: SawMode;
  /** Points de passage déclarés (centres, unités). */
  points: readonly Point[];
  /** Durée d'un cycle, en pas (0 pour une scie fixe). */
  cycle: number;
  /** Section qui la met en marche (indice dans `Level.sections`), −1 pour une scie fixe. */
  section: number;
  /** Trajet fermé parcouru en un cycle : `nodes[0] … nodes[n−1]` puis retour à `nodes[0]` ; `times[k]` = pas où l'on passe au nœud k. */
  nodes: readonly Point[];
  times: readonly number[];
}

/** Lot 12 : le cycle des blocs clignotants d'une section (`clignote`, voir l'en-tête). */
export interface BlinkCycle {
  cycle: number;
  solid: number;
  shift: number;
}

/** Lot 12 : un bloc clignotant. `group` : 0 pour `b`, 1 pour `d` (en opposition de phase) ; `section` : indice dans `Level.sections`. */
export interface BlinkBlock {
  col: number;
  row: number;
  group: number;
  section: number;
}

/** Lot 12 : un bloc alterné. `set` : 0 pour `A` (solide au départ), 1 pour `B`. */
export interface AltBlock {
  col: number;
  row: number;
  set: number;
}

/** Lot 13 : sens d'une zone de vent. */
export const WIND_UP = 1;
export const WIND_LEFT = 2;
export const WIND_RIGHT = 3;
export const WIND_DIR_NAMES = ["", "haut", "gauche", "droite"] as const;

/** Lot 13 : une rafale (`rafale <cycle> <actif> <décalage>`, voir l'en-tête). */
export interface Gust {
  cycle: number;
  active: number;
  shift: number;
}

/** Lot 13 : une zone de vent (traversable). Colonnes et rangées bornes comprises ; `section` : celle de sa première colonne (−1 : aucune). */
export interface WindZone {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  /** `WIND_UP`, `WIND_LEFT` ou `WIND_RIGHT`. */
  dir: number;
  /** En % des réglages. */
  force: number;
  /** null : souffle toujours. */
  gust: Gust | null;
  section: number;
}

export interface Level {
  width: number;
  height: number;
  /** Rangée par rangée, la rangée 0 en haut : `tiles[row * width + col]`, codes `TILE_*` (l'état initial des blocs friables). */
  tiles: readonly number[];
  start: Cell;
  finish: Cell;
  sections: readonly Section[];
  /** Scies fixes (dans l'ordre de lecture de la grille) puis mobiles (dans l'ordre du bloc annexe). */
  saws: readonly Saw[];
  /** Blocs friables, dans l'ordre de lecture ; `crumbleIndex[row * width + col]` = leur rang, −1 ailleurs. */
  crumbles: readonly Cell[];
  crumbleIndex: readonly number[];
  /** Points de passage `C` (lot 2b), de gauche à droite (ordre du parcours), un par colonne au plus (lot 4). */
  checkpoints: readonly Cell[];
  /** Lot 12 : blocs clignotants (ordre de lecture) et le cycle déclaré de chaque section (`null` : aucun) ; vides sans ces blocs. */
  blinks: readonly BlinkBlock[];
  blinkCycles: readonly (BlinkCycle | null)[];
  /** Lot 12 : blocs alternés (ordre de lecture). */
  alts: readonly AltBlock[];
  /** Lot 13 : zones de vent (ordre du bloc annexe) ; vide sans vent. */
  winds: readonly WindZone[];
}

export class LevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelError";
  }
}

const GRID_CODES: Record<string, number> = {
  "#": TILE_SOLID,
  ".": TILE_EMPTY,
  S: TILE_EMPTY,
  F: TILE_EMPTY,
  C: TILE_EMPTY,
  o: TILE_EMPTY,
  O: TILE_EMPTY,
  x: TILE_CRUMBLE,
  "*": TILE_SPRING,
  "[": TILE_BELT_LEFT,
  "]": TILE_BELT_RIGHT,
  "~": TILE_ICE,
  b: TILE_BLINK_ON,
  d: TILE_BLINK_ON,
  A: TILE_ALT_ON,
  B: TILE_ALT_OFF,
  "^": TILE_SPIKE_UP,
  v: TILE_SPIKE_DOWN,
  "<": TILE_SPIKE_LEFT,
  ">": TILE_SPIKE_RIGHT,
};

const half = idiv(UNITS_PER_TILE, 2);
const centerOf = (col: number, row: number): Point => ({ x: col * UNITS_PER_TILE + half, y: row * UNITS_PER_TILE + half });

/** Nombre de tuiles écrit en décimal (`1.5`, `0.4375`) → unités, arrondi au plus proche, sans flottant. */
function tilesToUnits(text: string, where: string): number {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text);
  if (!m) throw new LevelError(`${where} : « ${text} » n'est pas un nombre de tuiles`);
  const frac = m[2] ?? "";
  let den = 1;
  for (let i = 0; i < frac.length; i++) den *= 10;
  const num = Number(m[1]) * den + (frac ? Number(frac) : 0);
  return idiv(num * UNITS_PER_TILE * 2 + den, den * 2);
}

/** Trajet fermé d'une scie mobile et pas de passage à chaque nœud (temps proportionnels aux longueurs, en distance de Manhattan). */
function sawPath(points: readonly Point[], mode: SawMode, cycle: number): { nodes: Point[]; times: number[] } {
  const nodes = mode === "aller-retour" ? [...points, ...points.slice(1, -1).reverse()] : [...points];
  const lengths: number[] = [];
  let total = 0;
  for (let k = 0; k < nodes.length; k++) {
    const a = nodes[k]!;
    const b = nodes[(k + 1) % nodes.length]!;
    const len = (a.x > b.x ? a.x - b.x : b.x - a.x) + (a.y > b.y ? a.y - b.y : b.y - a.y);
    lengths.push(len);
    total += len;
  }
  const times = [0];
  let cum = 0;
  for (let k = 0; k < nodes.length; k++) {
    cum += lengths[k]!;
    times.push(total === 0 ? cycle : idiv(cycle * cum, total));
  }
  return { nodes, times };
}

/**
 * Lit un niveau : la grille, puis le bloc annexe. Refuse tout ce qui est mal formé (lignes de longueurs différentes, caractère inconnu,
 * pas exactement un `S` et un `F`, niveau trop grand, déclaration inconnue, section qui chevauche, scie hors section…).
 */
export function parseLevel(text: string): Level {
  const all = text.replace(/\r/g, "").split("\n");
  while (all.length > 0 && all[0]!.trim() === "") all.shift();
  while (all.length > 0 && all[all.length - 1]!.trim() === "") all.pop();
  if (all.length === 0) throw new LevelError("Niveau vide");
  let end = all.findIndex((l) => l.trim() === "");
  if (end < 0) end = all.length;
  const lines = all.slice(0, end);
  const annex = all.slice(end);

  const width = lines[0]!.length;
  const height = lines.length;
  if (width > MAX_LEVEL_WIDTH || height > MAX_LEVEL_HEIGHT) throw new LevelError(`Niveau trop grand (${width} × ${height}, au plus ${MAX_LEVEL_WIDTH} × ${MAX_LEVEL_HEIGHT})`);
  const tiles: number[] = [];
  const starts: Cell[] = [];
  const finishes: Cell[] = [];
  const saws: Saw[] = [];
  const crumbles: Cell[] = [];
  const crumbleIndex: number[] = [];
  const checkpoints: Cell[] = [];
  const blinkCells: { col: number; row: number; group: number }[] = [];
  const alts: AltBlock[] = [];
  for (let row = 0; row < height; row++) {
    const line = lines[row]!;
    if (line.length !== width) throw new LevelError(`Ligne ${row + 1} : ${line.length} colonnes au lieu de ${width}`);
    for (let col = 0; col < width; col++) {
      const c = line[col]!;
      const code = GRID_CODES[c];
      if (code === undefined) throw new LevelError(`Ligne ${row + 1}, colonne ${col + 1} : caractère « ${c} » inconnu`);
      tiles.push(code);
      crumbleIndex.push(code === TILE_CRUMBLE ? crumbles.length : -1);
      if (code === TILE_CRUMBLE) crumbles.push({ col, row });
      if (c === "S") starts.push({ col, row });
      if (c === "F") finishes.push({ col, row });
      if (c === "C") checkpoints.push({ col, row });
      if (c === "b" || c === "d") blinkCells.push({ col, row, group: c === "b" ? 0 : 1 });
      if (c === "A" || c === "B") alts.push({ col, row, set: c === "A" ? 0 : 1 });
      if (c === "o" || c === "O") {
        const p = centerOf(col, row);
        saws.push({ id: `${c}${saws.length}`, radius: c === "o" ? SAW_SMALL_RADIUS : SAW_BIG_RADIUS, mode: "fixe", points: [p], cycle: 0, section: -1, nodes: [p], times: [0, 0] });
      }
    }
  }
  checkpoints.sort((a, b) => a.col - b.col || a.row - b.row);
  // Un point se prend en franchissant sa colonne (lot 4) : deux points dans la même colonne seraient pris ensemble.
  for (let i = 1; i < checkpoints.length; i++) {
    if (checkpoints[i]!.col === checkpoints[i - 1]!.col) throw new LevelError(`Deux points de passage « C » dans la colonne ${checkpoints[i]!.col + 1} (un seul par colonne)`);
  }
  if (starts.length !== 1) throw new LevelError(`Il faut exactement un départ « S » (${starts.length} trouvés)`);
  if (finishes.length !== 1) throw new LevelError(`Il faut exactement une arrivée « F » (${finishes.length} trouvées)`);

  // ——— Bloc annexe ———
  const sections: Section[] = [];
  const pending: { line: number; words: string[] }[] = [];
  const blinkLines: { line: number; words: string[] }[] = [];
  const windLines: { line: number; words: string[] }[] = [];
  for (let i = 0; i < annex.length; i++) {
    const raw = annex[i]!.trim();
    if (raw === "" || raw.startsWith("//")) continue;
    const words = raw.split(/\s+/);
    const where = `Annexe, ligne ${end + i + 1}`;
    if (words[0] === "section") {
      const m = words.length === 3 ? /^(\d+)-(\d+)$/.exec(words[2]!) : null;
      if (!m) throw new LevelError(`${where} : « section <nom> <col0>-<col1> » attendu`);
      const c0 = Number(m[1]);
      const c1 = Number(m[2]);
      if (c0 > c1 || c1 >= width) throw new LevelError(`${where} : colonnes ${c0}-${c1} hors de la grille (0-${width - 1})`);
      if (sections.some((s) => s.name === words[1])) throw new LevelError(`${where} : section « ${words[1]} » déjà déclarée`);
      const clash = sections.find((s) => c0 <= s.c1 && s.c0 <= c1);
      if (clash) throw new LevelError(`${where} : chevauche la section « ${clash.name} »`);
      sections.push({ name: words[1]!, c0, c1 });
    } else if (words[0] === "scie") pending.push({ line: end + i + 1, words });
    else if (words[0] === "clignote") blinkLines.push({ line: end + i + 1, words });
    else if (words[0] === "vent") windLines.push({ line: end + i + 1, words });
    else throw new LevelError(`${where} : déclaration « ${words[0]} » inconnue (section, scie, clignote, vent)`);
  }
  // ——— Lot 12 : les cycles des blocs clignotants, par section ———
  const blinkCycles: (BlinkCycle | null)[] = sections.map(() => null);
  for (const { line, words } of blinkLines) {
    const where = `Annexe, ligne ${line}`;
    const section = words.length === 5 ? sections.findIndex((s) => s.name === words[1]) : -1;
    if (words.length !== 5) throw new LevelError(`${where} : « clignote <section> <cycle> <solide> <décalage> » attendu`);
    if (section < 0) throw new LevelError(`${where} : section « ${words[1]} » inconnue`);
    if (blinkCycles[section] !== null) throw new LevelError(`${where} : cycle de la section « ${words[1]} » déjà déclaré`);
    if (!words.slice(2).every((w) => /^\d+$/.test(w))) throw new LevelError(`${where} : cycle, solide et décalage sont des nombres de pas`);
    const [cycle, solid, shift] = words.slice(2).map(Number) as [number, number, number];
    if (cycle < MIN_BLINK_CYCLE || cycle > MAX_BLINK_CYCLE) throw new LevelError(`${where} : cycle de ${cycle} pas hors de ${MIN_BLINK_CYCLE}–${MAX_BLINK_CYCLE}`);
    if (solid < 1 || solid >= cycle) throw new LevelError(`${where} : « solide » vaut de 1 à cycle − 1 (${cycle - 1})`);
    if (shift >= cycle) throw new LevelError(`${where} : « décalage » vaut de 0 à cycle − 1 (${cycle - 1})`);
    blinkCycles[section] = { cycle, solid, shift };
  }
  const blinks: BlinkBlock[] = blinkCells.map((b) => {
    const section = sections.findIndex((s) => b.col >= s.c0 && b.col <= s.c1);
    if (section < 0) throw new LevelError(`Bloc clignotant (colonne ${b.col}, rangée ${b.row}) dans aucune section`);
    const cycle = blinkCycles[section];
    if (!cycle) throw new LevelError(`Bloc clignotant (colonne ${b.col}, rangée ${b.row}) : la section « ${sections[section]!.name} » ne déclare pas de « clignote »`);
    // L'état initial : celui du pas de phase 0.
    tiles[b.row * width + b.col] = blinkIsSolid(cycle, b.group, 0) ? TILE_BLINK_ON : TILE_BLINK_OFF;
    return { ...b, section };
  });
  for (const { line, words } of pending) {
    const where = `Annexe, ligne ${line}`;
    if (words.length < 7) throw new LevelError(`${where} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);
    const [, id, r, cycleText, mode] = words as [string, string, string, string, string];
    if (saws.some((s) => s.id === id)) throw new LevelError(`${where} : scie « ${id} » déjà déclarée`);
    const radius = r === "o" ? SAW_SMALL_RADIUS : r === "O" ? SAW_BIG_RADIUS : tilesToUnits(r, where);
    if (radius <= 0 || radius > MAX_SAW_RADIUS) throw new LevelError(`${where} : rayon hors bornes (au plus 4 tuiles)`);
    if (!/^\d+$/.test(cycleText) || Number(cycleText) < 1 || Number(cycleText) > MAX_SAW_CYCLE) throw new LevelError(`${where} : cycle en pas attendu (1 à ${MAX_SAW_CYCLE})`);
    if (mode !== "aller-retour" && mode !== "boucle") throw new LevelError(`${where} : mode « ${mode} » inconnu (aller-retour, boucle)`);
    const cells: Cell[] = words.slice(5).map((w) => {
      const m = /^(\d+),(\d+)$/.exec(w);
      if (!m) throw new LevelError(`${where} : point « ${w} » (col,rangée) attendu`);
      const cell = { col: Number(m[1]), row: Number(m[2]) };
      if (cell.col >= width || cell.row >= height) throw new LevelError(`${where} : point ${w} hors de la grille`);
      return cell;
    });
    if (cells.length > MAX_SAW_POINTS) throw new LevelError(`${where} : au plus ${MAX_SAW_POINTS} points`);
    const section = sections.findIndex((s) => cells[0]!.col >= s.c0 && cells[0]!.col <= s.c1);
    if (section < 0) throw new LevelError(`${where} : le premier point (colonne ${cells[0]!.col}) n'est dans aucune section`);
    const points = cells.map((c) => centerOf(c.col, c.row));
    const cycle = Number(cycleText);
    saws.push({ id, radius, mode, points, cycle, section, ...sawPath(points, mode, cycle) });
  }
  // ——— Lot 13 : les zones de vent ———
  const winds: WindZone[] = [];
  for (const { line, words } of windLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« vent <col0>-<col1> <rang0>-<rang1> <haut|gauche|droite> <force> [rafale <cycle> <actif> <décalage>] » attendu";
    if (words.length !== 5 && words.length !== 9) throw new LevelError(`${where} : ${usage}`);
    const cm = /^(\d+)-(\d+)$/.exec(words[1]!);
    const rm = /^(\d+)-(\d+)$/.exec(words[2]!);
    if (!cm || !rm) throw new LevelError(`${where} : ${usage}`);
    const [c0, c1, r0, r1] = [cm[1], cm[2], rm[1], rm[2]].map(Number) as [number, number, number, number];
    if (c0 > c1 || c1 >= width || r0 > r1 || r1 >= height) throw new LevelError(`${where} : zone ${c0}-${c1} × ${r0}-${r1} hors de la grille`);
    const dir = WIND_DIR_NAMES.indexOf(words[3] as (typeof WIND_DIR_NAMES)[number]);
    if (dir < 1) throw new LevelError(`${where} : sens « ${words[3]} » inconnu (haut, gauche, droite)`);
    if (!/^\d+$/.test(words[4]!) || Number(words[4]) < WIND_MIN_FORCE || Number(words[4]) > WIND_MAX_FORCE) throw new LevelError(`${where} : force en % de ${WIND_MIN_FORCE} à ${WIND_MAX_FORCE}`);
    const section = sections.findIndex((s) => c0 >= s.c0 && c0 <= s.c1);
    let gust: Gust | null = null;
    if (words.length === 9) {
      if (words[5] !== "rafale" || !words.slice(6).every((w) => /^\d+$/.test(w))) throw new LevelError(`${where} : ${usage}`);
      const [cycle, active, shift] = words.slice(6).map(Number) as [number, number, number];
      if (cycle < MIN_GUST_CYCLE || cycle > MAX_GUST_CYCLE) throw new LevelError(`${where} : rafale de ${cycle} pas hors de ${MIN_GUST_CYCLE}–${MAX_GUST_CYCLE}`);
      if (active < 1 || active >= cycle) throw new LevelError(`${where} : « actif » vaut de 1 à cycle − 1 (${cycle - 1})`);
      if (shift >= cycle) throw new LevelError(`${where} : « décalage » vaut de 0 à cycle − 1 (${cycle - 1})`);
      if (section < 0) throw new LevelError(`${where} : une zone en rafale doit être dans une section (colonne ${c0})`);
      gust = { cycle, active, shift };
    }
    const clash = winds.find((w) => c0 <= w.c1 && w.c0 <= c1 && r0 <= w.r1 && w.r0 <= r1);
    if (clash) throw new LevelError(`${where} : chevauche la zone de vent ${clash.c0}-${clash.c1} × ${clash.r0}-${clash.r1}`);
    winds.push({ c0, c1, r0, r1, dir, force: Number(words[4]), gust, section });
  }
  return { width, height, tiles, start: starts[0]!, finish: finishes[0]!, sections, saws, crumbles, crumbleIndex, checkpoints, blinks, blinkCycles, alts, winds };
}

/**
 * La tuile en (col, row), dans la grille `level.tiles`. Hors de la grille : plein à gauche, à droite et en haut (le monde est clos) ;
 * **vide sous la dernière rangée** (lot 2) : le personnage qui sort par le bas meurt (`attempt.ts`).
 */
export function tileAt(level: Pick<Level, "width" | "height" | "tiles">, col: number, row: number): number {
  if (row >= level.height) return TILE_EMPTY;
  if (col < 0 || row < 0 || col >= level.width) return TILE_SOLID;
  return level.tiles[row * level.width + col]!;
}

/** Coin haut-gauche d'une tuile, en unités entières (x vers la droite, y vers le bas, comme les rangées). */
export function cellOrigin(cell: Cell): { x: number; y: number } {
  return { x: cell.col * UNITS_PER_TILE, y: cell.row * UNITS_PER_TILE };
}

/**
 * Lot 12 : le groupe `group` (0 : `b`, 1 : `d`) d'un cycle de clignotement est-il solide à la phase `phase` (pas écoulés depuis l'entrée dans
 * la section, 0 avant) ? Pure, entière : `q = (phase + décalage) mod cycle` ; `b` est solide pour `q < solide`, `d` pour `q ≥ solide`.
 */
export function blinkIsSolid(c: BlinkCycle, group: number, phase: number): boolean {
  const q = (phase + c.shift) % c.cycle;
  return group === 0 ? q < c.solid : q >= c.solid;
}

/**
 * Centre d'une scie au pas `phase` de son cycle (pas écoulés depuis la mise en marche de sa section ; 0 avant). Fonction entière et pure :
 * interpolation linéaire par `idiv` entre deux nœuds du trajet ; revient exactement au départ à chaque cycle.
 */
export function sawCenter(saw: Saw, phase: number): Point {
  if (saw.cycle === 0 || phase <= 0) return saw.nodes[0]!;
  const t = phase % saw.cycle;
  const n = saw.nodes.length;
  let k = 0;
  while (k < n - 1 && t >= saw.times[k + 1]!) k++;
  const a = saw.nodes[k]!;
  const b = saw.nodes[(k + 1) % n]!;
  const t0 = saw.times[k]!;
  const span = saw.times[k + 1]! - t0;
  if (span <= 0) return a;
  return { x: a.x + idiv((b.x - a.x) * (t - t0), span), y: a.y + idiv((b.y - a.y) * (t - t0), span) };
}

/**
 * Lot 13 : la zone de vent souffle-t-elle à la phase `phase` de sa section (pas écoulés depuis l'entrée du personnage dans la section, 0 avant) ?
 * Pure, entière : toujours sans rafale ; avec, `q = (phase + décalage) mod cycle < actif`.
 */
export function windBlows(zone: Pick<WindZone, "gust">, phase: number): boolean {
  const g = zone.gust;
  if (!g) return true;
  return (phase + g.shift) % g.cycle < g.active;
}

/** Lot 13 : l'indice de la zone de vent qui contient la tuile (col, row), −1 aucune (les zones ne se chevauchent pas). */
export function windZoneAt(level: Pick<Level, "winds">, col: number, row: number): number {
  for (let i = 0; i < level.winds.length; i++) {
    const w = level.winds[i]!;
    if (col >= w.c0 && col <= w.c1 && row >= w.r0 && row <= w.r1) return i;
  }
  return -1;
}
