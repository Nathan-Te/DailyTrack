import { SINGLE_CLOCK_VERSION, UNITS_PER_TILE } from "./constants";
import { tileOf, type Grid } from "./collide";
import { idiv } from "./idiv";
import {
  TILE_ALT_OFF,
  TILE_ALT_ON,
  TILE_BLINK_OFF,
  TILE_BLINK_ON,
  TILE_EMPTY,
  TILE_SPIKE_DOWN,
  TILE_SPIKE_LEFT,
  TILE_SPIKE_RIGHT,
  TILE_SPIKE_UP,
  TILE_SPRING,
  blinkIsSolid,
  isSolidTile,
  isSpikeTile,
  sawCenter,
  windBlows,
  windZoneAt,
  type Level,
  type Point,
} from "./level";
import { COUNTER_CAP, INPUT_JUMP, INPUT_LEFT, INPUT_MASK, INPUT_RIGHT, MAX_SPEED, PLAYER_HEIGHT, PLAYER_WIDTH, initialPlayer, stepPlayerJump, type JumpFlags, type JumpParams, type PlayerState, type WindPush } from "./player";

// Un essai (lot 2) : le personnage plus tout l'état dynamique du niveau (scies, sections en marche, blocs friables, ressort), un chrono
// en pas, la mort et l'arrivée. `stepAttempt` est pur et avance d'un pas ; tout l'état est entier. Règles :
//   - **le monde attend le joueur** : tant qu'aucune commande n'est donnée (une direction, ou un saut appuyé), rien ne bouge et le chrono
//     reste à 0 ; le premier pas commandé est le pas 1 du chrono ;
//   - le chrono compte les pas jusqu'au contact de l'arrivée `F` (compris), puis se fige ;
//   - **mort** au contact d'un pic (boîte réduite), du disque d'une scie, ou en sortant par le bas de la grille ; cause et position restent
//     lisibles dans l'état pendant `RESPAWN_TICKS` pas (commandes ignorées), puis l'essai repart de l'**état initial exact** ;
//   - **points de passage** (lot 2b, `C`) : le franchir (lot 4 : le centre du personnage, vivant à la fin du pas, passe sa colonne vers la
//     droite, à n'importe quelle hauteur) le retient ; une mort après en avoir touché un ne
//     termine pas l'essai : **le chrono continue** (pendant l'attente aussi) et l'on reprend sur ce point, sans attendre de commande, avec
//     les blocs friables reposés, le ressort au repos, et les sections du point et d'après remises à l'arrêt (elles repartent à leur
//     entrée, comme la première fois) ; les sections d'avant gardent leur cycle. Sans point touché, la mort termine l'essai (ci-dessus) ;
//   - **arrivée et mort au même pas : l'arrivée l'emporte** (vérifiée d'abord) ;
//   - à la réapparition, **pas de saut automatique** : un saut tenu depuis l'essai précédent ne compte qu'après avoir été relâché ;
//     une direction tenue compte tout de suite.
// « Recommencer » n'est pas une commande : la session repart simplement de `initialAttempt` (ce n'est pas une mort).
//
// **Blocs clignotants et alternés (lot 12)** : leur état actuel est dans `tiles` (codes `TILE_BLINK_*` / `TILE_ALT_*`), recalculé **à la fin de
// chaque pas** (`settleDynamic`) pour le pas suivant : un clignotant suit le cycle de sa section (phase = pas écoulés depuis l'entrée du
// personnage dans la section, comme les scies), un alterné suit la parité `alt` (0 : `A` solide ; chaque saut qui part l'inverse ; franchir
// un point de passage la remet à 0). **Règle de sortie** : un bloc qui devrait devenir solide pendant que la boîte du personnage le chevauche
// reste absent jusqu'au premier pas où elle n'y est plus — on ne meurt jamais écrasé ni coincé. `alt` n'existe que dans un niveau qui a des
// blocs alternés (les empreintes des autres niveaux ne changent pas).
//
// **Courants d'air (lot 13)** : une zone de vent (`Level.winds`) pousse le personnage tant que le centre de sa boîte y est, **au début du pas**
// (`windPush`) ; une zone en rafale suit l'horloge de sa section (pas écoulés depuis l'entrée du personnage, comme les scies : la mort et la
// reprise la remettent à zéro). Rien de plus dans l'état : la phase se lit dans `sections`, la vitesse acquise dans `player`.
//
// **Horloge unique (lot 15, niveaux en version 4 : `Level.simVersion`)** : tout ce qui tourne (scies, clignotants, rafales) vaut `f(t + phase)`,
// `t` le chrono, `phase` celle de sa section (`Section.phase`, choisie par le générateur) ; plus rien ne s'active à l'approche ni ne revient à
// zéro (`sections` reste vide). Le chrono part au premier pas, **que le joueur bouge ou non** (le jeu le lance à la fin du « Prêt… ») ; une
// mort sans point de passage fait **reprendre au départ, chrono qui continue** (`respawnAttempt`), comme une reprise sur un point : l'essai ne
// finit qu'à l'arrivée ou par « recommencer ». Friables reposés et blocs alternés remis à A à chaque reprise, comme en v3 (ce ne sont pas des
// horloges). Les niveaux en version 3 gardent exactement les règles ci-dessus (une horloge par section, monde qui attend).
//
// Ordre d'un pas en course : minuteries des blocs friables (ceux qui arrivent à 0 tombent) → personnage (`stepPlayer`, sur la grille de
// l'essai) → ressort → contacts avec les blocs friables → chrono et sections → arrivée → morts (bas, pics, scies) → points de passage ;
// puis l'état des blocs clignotants et alternés pour le pas suivant (lot 12).

export const ATTEMPT_READY = 0;
export const ATTEMPT_RUNNING = 1;
export const ATTEMPT_DEAD = 2;
export const ATTEMPT_FINISHED = 3;

export const DEATH_NONE = 0;
export const DEATH_SPIKE = 1;
export const DEATH_SAW = 2;
export const DEATH_FALL = 3;
/** Noms des causes de mort, pour l'affichage (indice = code). */
export const DEATH_NAMES = ["aucune", "pic", "scie", "chute"] as const;

/** Pas entre la mort et le nouvel essai : 18 pas = 0,15 s (au plus 0,2 s, seed § 2). Les commandes y sont ignorées. */
export const RESPAWN_TICKS = 18;

/** État d'un bloc friable : intact (jamais touché) ; un nombre > 0 = pas restants avant sa chute ; tombé. */
export const CRUMBLE_INTACT = 0;
export const CRUMBLE_GONE = -1;

/**
 * Boîte mortelle d'un pic, plus petite que la tuile et entièrement **dans** le triangle dessiné : la moitié de la largeur de la base
 * (retrait de ¼ de tuile de chaque côté), sur la moitié de la tuile côté base. Longer un pic (le frôler par le côté, passer juste au-dessus
 * de sa pointe) est sûr ; quand on meurt, on touchait le triangle.
 */
export const SPIKE_INSET = 1024;
export const SPIKE_DEPTH = 2048;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Boîte mortelle du pic de code `tile` posé en (col, row), en unités. */
export function spikeBox(tile: number, col: number, row: number): Box {
  const T = UNITS_PER_TILE;
  const x = col * T;
  const y = row * T;
  const across = T - 2 * SPIKE_INSET;
  switch (tile) {
    case TILE_SPIKE_UP:
      return { x: x + SPIKE_INSET, y: y + T - SPIKE_DEPTH, w: across, h: SPIKE_DEPTH };
    case TILE_SPIKE_DOWN:
      return { x: x + SPIKE_INSET, y, w: across, h: SPIKE_DEPTH };
    case TILE_SPIKE_LEFT:
      return { x: x + T - SPIKE_DEPTH, y: y + SPIKE_INSET, w: SPIKE_DEPTH, h: across };
    case TILE_SPIKE_RIGHT:
      return { x, y: y + SPIKE_INSET, w: SPIKE_DEPTH, h: across };
    default:
      throw new RangeError(`spikeBox : la tuile ${tile} n'est pas un pic`);
  }
}

/** Deux boîtes [x, x + w) × [y, y + h) se chevauchent-elles ? (Se toucher par un bord ne compte pas.) */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Distance au carré (entière) entre le centre d'un cercle et le point le plus proche de la boîte [x, x + w] × [y, y + h]. Reste sous
 * `Number.MAX_SAFE_INTEGER` pour tout niveau permis (test « bornes ») : les carrés sont exacts.
 */
export function boxDistance2(cx: number, cy: number, box: Box): number {
  const dx = cx - clamp(cx, box.x, box.x + box.w);
  const dy = cy - clamp(cy, box.y, box.y + box.h);
  return dx * dx + dy * dy;
}

/** Le disque de rayon `r` touche-t-il la boîte ? Strictement : une distance égale au rayon (contact limite) ne tue pas. */
export function circleHitsBox(cx: number, cy: number, r: number, box: Box): boolean {
  return boxDistance2(cx, cy, box) < r * r;
}

/** État d'un essai : uniquement des entiers (et des tableaux d'entiers). */
export interface AttemptState {
  /** `ATTEMPT_READY` (attend la première commande), `ATTEMPT_RUNNING`, `ATTEMPT_DEAD`, `ATTEMPT_FINISHED`. */
  status: number;
  /** Chrono de l'essai, en pas : 0 avant la première commande ; figé à la mort et à l'arrivée. */
  time: number;
  player: PlayerState;
  /** Grille de l'essai : `level.tiles` (même tableau) tant qu'aucun bloc friable n'est tombé, puis une copie où ils sont vides. */
  tiles: readonly number[];
  /** Un par bloc friable (`level.crumbles`) : `CRUMBLE_INTACT`, pas restants avant la chute, ou `CRUMBLE_GONE`. */
  crumbles: readonly number[];
  /** Une par section (`level.sections`) : pas du chrono où le personnage y est entré la première fois, −1 avant. Vide en v4 (lot 15). */
  sections: readonly number[];
  /** Cause de la mort (`DEATH_*`) et centre du personnage à cet instant (unités) ; 0 tant qu'il vit. */
  deathCause: number;
  deathX: number;
  deathY: number;
  /** Pas écoulés depuis la mort. */
  deathTicks: number;
  /** Dernier ressort déclenché (indice de tuile, −1 aucun) et pas du chrono où il l'a été (pour l'affichage). */
  springCell: number;
  springTime: number;
  /** Dernier point de passage franchi (indice dans `level.checkpoints`), −1 aucun. */
  checkpoint: number;
  /**
   * Lot 12, **seulement dans un niveau qui a des blocs alternés** (absent sinon : les empreintes des autres niveaux ne changent pas) : le jeu
   * solide, 0 pour `A`, 1 pour `B`. Part à 0, s'inverse à chaque saut qui part, revient à 0 en franchissant un point de passage.
   */
  alt?: number;
}

/** État au départ (et après chaque mort, et après « recommencer ») : rien n'a bougé. */
export function initialAttempt(level: Level): AttemptState {
  const base: AttemptState = {
    status: ATTEMPT_READY,
    time: 0,
    player: initialPlayer(level),
    tiles: level.tiles,
    crumbles: level.crumbles.map(() => CRUMBLE_INTACT),
    sections: level.simVersion >= SINGLE_CLOCK_VERSION ? [] : level.sections.map(() => -1),
    deathCause: DEATH_NONE,
    deathX: 0,
    deathY: 0,
    deathTicks: 0,
    springCell: -1,
    springTime: 0,
    checkpoint: -1,
  };
  return level.alts.length > 0 ? { ...base, alt: 0 } : base;
}

/**
 * Lot 15 (v4) : l'état **avant le départ**, au chrono `time` ≤ 0 (le « Prêt… » du jeu) : rien n'a bougé que les horloges, les blocs clignotants
 * à leur état de cet instant. Seulement pour l'affichage : la simulation part toujours de `initialAttempt` (chrono 0), qu'il rend pour 0.
 */
export function readyAttempt(level: Level, time: number): AttemptState {
  const s = initialAttempt(level);
  if (time === 0) return s;
  return { ...s, time, tiles: settleDynamic(level, s.tiles, s.sections, time, s.alt ?? 0, s.player) };
}

/** Lot 15 : le niveau a-t-il une seule horloge de course (version 4) ? */
export function singleClock(level: Pick<Level, "simVersion">): boolean {
  return level.simVersion >= SINGLE_CLOCK_VERSION;
}

/**
 * Lot 15 : la phase de la section `i` (pas de son horloge) au chrono `time`, `sections` étant les débuts de l'état (v3). **v4** : `time + phase`
 * de la section, à toute heure (négatif avant le départ : l'affichage du « Prêt… ») ; **v3** : pas écoulés depuis l'entrée du personnage, 0 avant.
 */
export function sectionClock(level: Level, sections: readonly number[], time: number, i: number): number {
  if (level.simVersion >= SINGLE_CLOCK_VERSION) return time + level.sections[i]!.phase;
  const start = sections[i]!;
  return start < 0 ? 0 : time - start;
}

/**
 * Lot 15 (v4) : reprise **au départ** après une mort sans point de passage : le personnage posé sur `S`, à l'arrêt ; friables reposés,
 * blocs alternés à A ; le chrono continue (`time` inchangé ici). Les horloges ne bougent pas : elles ne dépendent que du chrono.
 */
export function respawnAttempt(level: Level, state: Readonly<AttemptState>): AttemptState {
  const back: AttemptState = { ...initialAttempt(level), status: ATTEMPT_RUNNING, time: state.time };
  return { ...back, tiles: settleDynamic(level, back.tiles, back.sections, back.time, back.alt ?? 0, back.player) };
}

/**
 * Reprise au point de passage `state.checkpoint` (lot 2b) : le personnage posé sur ce point, à l'arrêt ; friables reposés ; sections du
 * point et d'après à l'arrêt (celles d'avant gardent leur cycle) ; le chrono continue (`time` inchangé ici).
 */
export function checkpointAttempt(level: Level, state: Readonly<AttemptState>): AttemptState {
  const cell = level.checkpoints[state.checkpoint]!;
  // v4 (lot 15) : `sections` est vide, rien n'est remis à l'arrêt.
  const sections = state.sections.map((start, i) => (level.sections[i]!.c1 >= cell.col ? -1 : start));
  const back: AttemptState = {
    ...initialAttempt(level),
    status: ATTEMPT_RUNNING,
    time: state.time,
    player: initialPlayer({ ...level, start: cell }),
    sections,
    checkpoint: state.checkpoint,
  };
  // Lot 12 : les clignotants des sections d'avant ont gardé leur cycle ; les alternés repartent de A (état du point de passage).
  return { ...back, tiles: settleDynamic(level, back.tiles, back.sections, back.time, back.alt ?? 0, back.player) };
}

/** Rectangle d'une tuile, en unités. */
const tileBox = (col: number, row: number): Box => ({ x: col * UNITS_PER_TILE, y: row * UNITS_PER_TILE, w: UNITS_PER_TILE, h: UNITS_PER_TILE });

/**
 * Lot 12 : l'état des blocs clignotants et alternés pour le pas qui suit un état de temps `time`, de sections `sections`, de parité `alt`, où
 * le personnage est en `player`. Un bloc qui doit être **absent** l'est tout de suite ; un bloc qui doit être **plein** le devient **sauf
 * si la boîte du personnage le chevauche** : il reste alors traversable jusqu'au premier état où elle n'y est plus (se toucher par un bord
 * ne compte pas). Rend `tiles` lui-même si rien ne change (sinon une copie : les tableaux d'un état ne sont jamais modifiés).
 */
export function settleDynamic(level: Level, tiles: readonly number[], sections: readonly number[], time: number, alt: number, player: Readonly<PlayerState>): readonly number[] {
  if (level.blinks.length === 0 && level.alts.length === 0) return tiles;
  let out = tiles;
  const box = playerBox(player);
  const apply = (col: number, row: number, want: boolean, on: number, off: number) => {
    const k = row * level.width + col;
    if (isSolidTile(out[k]!) === want) return;
    if (want && boxesOverlap(box, tileBox(col, row))) return;
    if (out === tiles) out = [...tiles];
    (out as number[])[k] = want ? on : off;
  };
  for (const b of level.blinks) {
    apply(b.col, b.row, blinkIsSolid(level.blinkCycles[b.section]!, b.group, sectionClock(level, sections, time, b.section)), TILE_BLINK_ON, TILE_BLINK_OFF);
  }
  for (const a of level.alts) apply(a.col, a.row, a.set === alt, TILE_ALT_ON, TILE_ALT_OFF);
  return out;
}

/**
 * Lot 12 : phase de chaque section dans cet état (pas écoulés depuis que le personnage y est entré, 0 avant), dans l'ordre de
 * `level.sections` : la même lecture que `sawPhase`, pour le rendu, le métronome et le solveur.
 */
export function sectionPhases(level: Level, state: Readonly<AttemptState>): number[] {
  return level.sections.map((_, i) => sectionClock(level, state.sections, state.time, i));
}

/** Pas écoulés dans le cycle de la scie `index` (0 tant que sa section n'est pas en marche, et pour une scie fixe). */
export function sawPhase(level: Level, state: Readonly<AttemptState>, index: number): number {
  const saw = level.saws[index]!;
  if (saw.section < 0) return 0;
  return sectionClock(level, state.sections, state.time, saw.section);
}

/** Centres de toutes les scies dans cet état (unités), dans l'ordre de `level.saws`. */
export function sawCenters(level: Level, state: Readonly<AttemptState>): Point[] {
  return level.saws.map((saw, i) => sawCenter(saw, sawPhase(level, state, i)));
}

/** Lot 13 : phase de la section de la zone de vent `index` dans cet état (0 avant l'entrée, et pour une zone hors section). */
export function windPhase(level: Level, state: Readonly<AttemptState>, index: number): number {
  const w = level.winds[index]!;
  if (w.section < 0) return 0;
  return sectionClock(level, state.sections, state.time, w.section);
}

/** Lot 13 : la zone de vent `index` souffle-t-elle dans cet état ? */
export function windActive(level: Level, state: Readonly<AttemptState>, index: number): boolean {
  return windBlows(level.winds[index]!, windPhase(level, state, index));
}

/** Lot 13 : la zone de vent où se trouve le centre du personnage dans cet état (qu'elle souffle ou non), −1 aucune. */
export function windZoneOf(level: Level, state: Readonly<AttemptState>): number {
  if (level.winds.length === 0) return -1;
  const p = state.player;
  return windZoneAt(level, tileOf(p.x + idiv(PLAYER_WIDTH, 2)), tileOf(p.y + idiv(PLAYER_HEIGHT, 2)));
}

/** Lot 13 : la poussée que subit le personnage au pas qui suit cet état (null : hors d'une zone, ou zone qui ne souffle pas). */
export function windPush(level: Level, state: Readonly<AttemptState>): WindPush | null {
  const i = windZoneOf(level, state);
  if (i < 0 || !windActive(level, state, i)) return null;
  const w = level.winds[i]!;
  return { dir: w.dir, force: w.force };
}

/** Boîte du personnage. */
export function playerBox(p: Readonly<PlayerState>): Box {
  return { x: p.x, y: p.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
}

/** Ce qui tue le personnage dans cet état (`DEATH_*`), arrivée non comprise. */
export function deathAt(level: Level, state: Readonly<AttemptState>): number {
  const p = state.player;
  if (p.y + PLAYER_HEIGHT > level.height * UNITS_PER_TILE) return DEATH_FALL;
  const box = playerBox(p);
  const c0 = tileOf(p.x);
  const c1 = tileOf(p.x + PLAYER_WIDTH - 1);
  const r0 = tileOf(p.y) < 0 ? 0 : tileOf(p.y);
  const r1 = tileOf(p.y + PLAYER_HEIGHT - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= level.width) continue;
      const t = level.tiles[r * level.width + c]!;
      if (isSpikeTile(t) && boxesOverlap(box, spikeBox(t, c, r))) return DEATH_SPIKE;
    }
  }
  for (let i = 0; i < level.saws.length; i++) {
    const saw = level.saws[i]!;
    const at = sawCenter(saw, sawPhase(level, state, i));
    if (circleHitsBox(at.x, at.y, saw.radius, box)) return DEATH_SAW;
  }
  return DEATH_NONE;
}

/** Le personnage touche-t-il la tuile d'arrivée ? */
export function reachesFinish(level: Level, p: Readonly<PlayerState>): boolean {
  const T = UNITS_PER_TILE;
  return boxesOverlap(playerBox(p), { x: level.finish.col * T, y: level.finish.row * T, w: T, h: T });
}

/** Grille que voient les collisions : celle du niveau, ou une vue sur la grille de l'essai (blocs friables tombés). */
function gridOf(level: Level, tiles: readonly number[]): Grid {
  return tiles === level.tiles ? level : { width: level.width, height: level.height, tiles };
}

/** Indice de tuile (rangée × largeur + colonne) dans la grille, −1 hors de la grille. */
function cellIndex(level: Level, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= level.width || row >= level.height) return -1;
  return row * level.width + col;
}

/**
 * Un pas d'essai (1/120 s). Pur : `state` n'est pas modifié ; un état inchangé est rendu tel quel (même objet). `input` = bits `INPUT_*`.
 */
export function stepAttempt(state: Readonly<AttemptState>, input: number, level: Level, params: Readonly<JumpParams>): AttemptState {
  if (!Number.isInteger(input) || input < 0 || input > INPUT_MASK) throw new RangeError(`Commande invalide : ${input}`);
  const jump = input & INPUT_JUMP ? 1 : 0;

  if (state.status === ATTEMPT_FINISHED) return state as AttemptState;
  const single = level.simVersion >= SINGLE_CLOCK_VERSION;
  if (state.status === ATTEMPT_DEAD) {
    const deathTicks = state.deathTicks + 1;
    // Avec un point de passage (et toujours en v4, lot 15), l'essai continue : le chrono tourne pendant l'attente.
    const time = state.checkpoint >= 0 || single ? state.time + 1 : state.time;
    if (deathTicks < RESPAWN_TICKS) return { ...state, deathTicks, time };
    if (state.checkpoint >= 0 || single) {
      const back = state.checkpoint >= 0 ? checkpointAttempt(level, { ...state, time }) : respawnAttempt(level, { ...state, time });
      if (jump) back.player = { ...back.player, held: 1 };
      return back;
    }
    // Nouvel essai : l'état initial exact. Le bouton de saut tenu à cet instant est noté comme tenu : il ne fera pas sauter tout seul.
    const fresh = initialAttempt(level);
    if (jump) fresh.player = { ...fresh.player, held: 1 };
    return fresh;
  }
  // v3 : le monde attend la première commande. v4 (lot 15) : le chrono part au premier pas, commandé ou non.
  if (state.status === ATTEMPT_READY && !single) {
    const dir = input & (INPUT_LEFT | INPUT_RIGHT);
    const command = dir === INPUT_LEFT || dir === INPUT_RIGHT || (jump === 1 && state.player.held === 0);
    if (!command) return state.player.held === jump ? (state as AttemptState) : { ...state, player: { ...state.player, held: jump } };
  }

  const T = UNITS_PER_TILE;
  // ——— Blocs friables : les minuteries avancent, ceux qui arrivent à 0 tombent ———
  let tiles = state.tiles;
  let crumbles = state.crumbles;
  for (let i = 0; i < crumbles.length; i++) {
    const v = crumbles[i]!;
    if (v <= 0) continue;
    if (crumbles === state.crumbles) crumbles = [...crumbles];
    (crumbles as number[])[i] = v > 1 ? v - 1 : CRUMBLE_GONE;
    if (v === 1) {
      if (tiles === state.tiles) tiles = [...tiles];
      const cell = level.crumbles[i]!;
      (tiles as number[])[cell.row * level.width + cell.col] = TILE_EMPTY;
    }
  }

  // ——— Personnage ———
  const flags: JumpFlags | null = level.alts.length > 0 ? { jumped: 0, wall: 0 } : null;
  let player = stepPlayerJump(state.player, input, gridOf(level, tiles), params, flags, level.winds.length > 0 ? windPush(level, state) : null);
  const landed = player.ground === 1;
  const c0 = tileOf(player.x);
  const c1 = tileOf(player.x + PLAYER_WIDTH - 1);

  // ——— Ressort : posé dessus (par le haut), lancé vers le haut ; ce saut ne se coupe pas (`jumping` reste à 0) ———
  let springCell = state.springCell;
  let springTime = state.springTime;
  if (landed && params.springSpeed > 0) {
    const below = tileOf(player.y + PLAYER_HEIGHT);
    const mid = tileOf(player.x + idiv(PLAYER_WIDTH, 2));
    let hit = -1;
    for (const c of [mid, c0, c1]) {
      const k = cellIndex(level, c, below);
      if (k >= 0 && tiles[k] === TILE_SPRING) {
        hit = k;
        break;
      }
    }
    if (hit >= 0) {
      const speed = params.springSpeed < MAX_SPEED ? params.springSpeed : MAX_SPEED;
      player = { ...player, vy: -speed, ground: 0, air: COUNTER_CAP, jumping: 0, buffer: 0 };
      springCell = hit;
      springTime = state.time + 1;
    }
  }

  // ——— Contacts avec les blocs friables : posé dessus, ou poussé contre lui en l'air (glisse murale) ———
  const touch = (c: number, r: number) => {
    const k = cellIndex(level, c, r);
    if (k < 0) return;
    const i = level.crumbleIndex[k]!;
    if (i < 0 || crumbles[i] !== CRUMBLE_INTACT) return;
    if (crumbles === state.crumbles) crumbles = [...crumbles];
    (crumbles as number[])[i] = params.crumbleDelay > 1 ? params.crumbleDelay : 1;
  };
  if (landed) {
    const below = tileOf(player.y + PLAYER_HEIGHT);
    for (let c = c0; c <= c1; c++) touch(c, below);
  } else {
    const dir = (input & INPUT_RIGHT ? 1 : 0) - (input & INPUT_LEFT ? 1 : 0);
    const r0 = tileOf(player.y);
    const r1 = tileOf(player.y + PLAYER_HEIGHT - 1);
    if (dir > 0 && (player.x + PLAYER_WIDTH) % T === 0) for (let r = r0; r <= r1; r++) touch(tileOf(player.x + PLAYER_WIDTH), r);
    if (dir < 0 && player.x % T === 0) for (let r = r0; r <= r1; r++) touch(tileOf(player.x) - 1, r);
  }

  // ——— Chrono et sections : une section se met en marche au premier pas où le centre du personnage y entre ———
  const time = state.time + 1;
  let sections = state.sections;
  const col = tileOf(player.x + idiv(PLAYER_WIDTH, 2));
  for (let i = 0; i < sections.length; i++) {
    const s = level.sections[i]!;
    if (sections[i]! >= 0 || col < s.c0 || col > s.c1) continue;
    if (sections === state.sections) sections = [...sections];
    (sections as number[])[i] = time;
  }

  // ——— Lot 12 : la parité des blocs alternés (chaque saut qui part l'inverse ; franchir un point de passage la remet à A) ———
  const before = tileOf(state.player.x + idiv(PLAYER_WIDTH, 2));
  let alt = state.alt ?? 0;
  if (level.alts.length > 0) {
    if (flags!.jumped === 1) alt = 1 - alt;
    if (col > before && level.checkpoints.some((c) => before < c.col && c.col <= col)) alt = 0;
  }
  // L'état des blocs clignotants et alternés pour le pas suivant (le personnage chevauche-t-il un bloc qui devient plein ? il reste absent).
  tiles = settleDynamic(level, tiles, sections, time, alt, player);

  const next: AttemptState = { ...state, status: ATTEMPT_RUNNING, time, player, tiles, crumbles, sections, springCell, springTime };
  if (level.alts.length > 0) next.alt = alt;
  // ——— L'arrivée d'abord : elle l'emporte sur une mort au même pas ———
  if (reachesFinish(level, player)) return { ...next, status: ATTEMPT_FINISHED };
  const cause = deathAt(level, next);
  if (cause !== DEATH_NONE) {
    return {
      ...next,
      status: ATTEMPT_DEAD,
      deathCause: cause,
      deathX: player.x + idiv(PLAYER_WIDTH, 2),
      deathY: player.y + idiv(PLAYER_HEIGHT, 2),
      deathTicks: 0,
    };
  }
  // ——— Point de passage (lot 4) : pris quand le centre du personnage, vivant à la fin du pas, **franchit sa colonne vers la droite**, à
  // n'importe quelle hauteur (le sauter par-dessus le prend aussi) ; jamais sur une mort (on a déjà rendu l'état de la mort ci-dessus) ———
  if (col > before) {
    let taken = next.checkpoint;
    // Rangés de gauche à droite, une colonne chacun : le plus à droite des points franchis pendant ce pas l'emporte.
    for (let i = 0; i < level.checkpoints.length; i++) {
      const c = level.checkpoints[i]!.col;
      if (before < c && c <= col) taken = i;
    }
    if (taken !== next.checkpoint) return { ...next, checkpoint: taken };
  }
  return next;
}

/** Joue une suite de commandes (une par pas) depuis l'état donné. */
export function runAttempt(state: Readonly<AttemptState>, inputs: readonly number[], level: Level, params: Readonly<JumpParams>): AttemptState {
  let s = state as AttemptState;
  for (const input of inputs) s = stepAttempt(s, input, level, params);
  return s;
}
