import { ALT_KEPT_VERSION, RESTART_VERSION, SINGLE_CLOCK_VERSION, UNITS_PER_TILE } from "./constants";
import { boxHits, sweep, tileOf, type Grid } from "./collide";
import { idiv } from "./idiv";
import {
  MUSHROOM_BOOST_PERCENT,
  MUSHROOM_DOWN,
  MUSHROOM_DOWN_SPEED,
  MUSHROOM_LEFT,
  MUSHROOM_RIGHT,
  MUSHROOM_RISE_SPEED,
  MUSHROOM_SIDE_SPEED,
  MUSHROOM_UP,
  MUSHROOM_UP_SPEED,
  TILE_ALT_OFF,
  TILE_ALT_ON,
  TILE_BRIDGE_ON,
  TILE_BLINK_OFF,
  TILE_BLINK_ON,
  TILE_EMPTY,
  TILE_SPIKE_DOWN,
  TILE_SPIKE_LEFT,
  TILE_SPIKE_RIGHT,
  TILE_SPIKE_UP,
  TILE_SPRING,
  blinkIsSolid,
  bridgeLastLit,
  bridgeTileLit,
  isSolidTile,
  isSpikeTile,
  mushroomPad,
  PRESS_HEIGHT_TILES,
  laserBarBox,
  laserBox,
  laserOn,
  platformPos,
  pressBox,
  sawCenter,
  stalactiteBox,
  stalactiteOffset,
  windBlows,
  windZoneAt,
  type Bridge,
  type Level,
  type Point,
} from "./level";
import { COUNTER_CAP, INPUT_ATTEMPT_MASK, INPUT_JUMP, INPUT_LEFT, INPUT_MASK, INPUT_RESPAWN, INPUT_RIGHT, MAX_SPEED, PLAYER_HEIGHT, PLAYER_WIDTH, initialPlayer, stepPlayerJump, type JumpFlags, type JumpParams, type PlayerState, type WindPush } from "./player";

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
// **Plateformes mobiles (lot 20, niveaux de version 5 et morceaux seuls)** : une plateforme (`Level.platforms`) est à sens unique et suit l'horloge de sa
// section (`sectionClock`, comme une scie). `AttemptState.ride` (présent seulement dans un niveau qui en a) dit laquelle porte le personnage (−1 : aucune).
// Au début d'un pas, un personnage porté reçoit le déplacement de sa plateforme (balayé contre la grille : un mur l'arrête, jamais d'écrasement) ; le saut
// qui part (sol ou coyote) lui laisse la vitesse horizontale de la plateforme (`stepPlayerJump`, `platformVx`). Après le déplacement, il se **pose** sur la
// plus haute plateforme dont il était au-dessus au pas précédent (pied sous le dessus, recouvrement horizontal) : on la traverse donc par-dessous et par les
// côtés. Sans plateforme, ces lignes ne calculent rien.
//
// **Presses (lot 22, niveaux de version 6 et morceaux seuls)** : une presse (`Level.presses`) suit l'horloge de sa section (`sectionClock`, comme une scie) ;
// elle n'est ni solide ni portante : toute sa boîte tue au contact (`deathAt`, `DEATH_PRESS`), à la fin du pas, après l'arrivée (qui l'emporte). Rien dans
// `AttemptState` : sans presse, ces lignes ne calculent rien.
//
// **Champignons (lot 23, niveaux de version 7 et morceaux seuls)** : un champignon (`Level.mushrooms`) n'est ni solide ni un danger et n'a ni horloge ni état. Au pas où la boîte
// du personnage **commence** à chevaucher son chapeau (`mushroomPad` : elle le chevauche à la fin du pas et ne le chevauchait pas au début), `mushroomBounce` lui donne une
// impulsion entière dans la direction du chapeau, renforcée (×1,3) si le saut est **tenu** à ce pas ; la vitesse parallèle à la surface du champignon est conservée. Sans
// champignon, ces lignes ne calculent rien.
//
// **Stalactites (lot 24, niveaux de version 8 et morceaux seuls)** : une stalactite (`Level.stalactites`) est accrochée à un plafond plein. Son état (`AttemptState.stalactites`, un
// entier par stalactite, absent sans stalactite) : 0 intacte, `age` > 0 déclenchée depuis `age` pas (elle tremble pendant `STALACTITE_SHAKE_TICKS`, puis tombe selon `stalactiteOffset`),
// −1 brisée. Elle se déclenche à la fin du pas où le centre du personnage est dans sa zone (colonnes, à hauteur de son corps ou plus bas) ; elle se brise au premier pas où son corps
// chevauche un bloc plein ou sort de la grille ; elle tue (`DEATH_STALACTITE`) tant qu'elle est déclenchée et pas brisée. Hors horloge ; la reprise la remet intacte (`initialAttempt`).
//
// **Ponts à interrupteur (lot 26, niveaux de version 10 et morceaux seuls)** : un pont (`Level.bridges`) est une suite de tuiles vides reliée à un interrupteur (un plein). Son état
// (`AttemptState.bridges`, un entier par pont, absent sans pont) : 0 éteint, `age` > 0 allumé depuis `age` pas. Le pas où le personnage **se pose** sur l'interrupteur (il y est au sol à la
// fin du pas et n'y était pas au début) l'allume (âge 1) ou le rallume (âge 1 de nouveau) ; la tuile de rang `k` est pleine pour l'âge 1 à `délai + k × BRIDGE_STEP` (`bridgeTileLit`),
// puis le pont est éteint (âge 0). Les tuiles pleines sont dans `tiles` (`TILE_BRIDGE_ON`, `settleBridges`, avec la même règle de sortie que les blocs clignotants : une tuile qui
// devrait s'allumer pendant que la boîte du personnage la chevauche reste traversable jusqu'à ce qu'elle n'y soit plus). Hors horloge ; la reprise remet tout éteint (`initialAttempt`).
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
/** Lot 22 : écrasé par une presse (toute la presse tue au contact). */
export const DEATH_PRESS = 4;
/** Lot 24 : touché par une stalactite qui tremble ou qui tombe. */
export const DEATH_STALACTITE = 5;
/** Lot 25 : touché par un rayon laser allumé (laser fixe allumé, ou barre coulissante). */
export const DEATH_LASER = 6;
/** Noms des causes de mort, pour l'affichage (indice = code). */
export const DEATH_NAMES = ["aucune", "pic", "scie", "chute", "presse", "stalactite", "laser"] as const;

/** Lot 24 : état d'une stalactite intacte (jamais déclenchée) et brisée ; un nombre > 0 = pas écoulés depuis son déclenchement. */
export const STALACTITE_INTACT = 0;
export const STALACTITE_BROKEN = -1;

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
  /**
   * Lot 20, **seulement dans un niveau qui a des plateformes** (absent sinon : les empreintes des autres niveaux ne changent pas) : l'indice de la
   * plateforme qui porte le personnage (−1 : aucune). Gardé pendant la tolérance de coyote après avoir quitté son bord (le saut y garde son élan).
   */
  ride?: number;
  /**
   * Lot 24, **seulement dans un niveau qui a des stalactites** (absent sinon : les empreintes des autres niveaux ne changent pas) : une valeur par stalactite
   * (`Level.stalactites`) — `STALACTITE_INTACT` (0), les pas écoulés depuis son déclenchement (> 0, voir `stalactiteOffset`) ou `STALACTITE_BROKEN` (−1).
   */
  stalactites?: readonly number[];
  /**
   * Lot 26, **seulement dans un niveau qui a des ponts à interrupteur** (absent sinon : les empreintes des autres niveaux ne changent pas) : une valeur par pont (`Level.bridges`) —
   * 0 éteint, sinon les pas écoulés depuis son allumage (1 au pas où le personnage s'est posé sur l'interrupteur ; voir `bridgeTileLit`).
   */
  bridges?: readonly number[];
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
  return {
    ...base,
    ...(level.alts.length > 0 ? { alt: 0 } : {}),
    ...(level.platforms.length > 0 ? { ride: -1 } : {}),
    ...(level.stalactites.length > 0 ? { stalactites: level.stalactites.map(() => STALACTITE_INTACT) } : {}),
    ...(level.bridges.length > 0 ? { bridges: level.bridges.map(() => 0) } : {}),
  };
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
 * point et d'après à l'arrêt (celles d'avant gardent leur cycle) ; le chrono continue (`time` inchangé ici). Lot 28 (v12) : les blocs alternés gardent
 * la parité de `state.alt`.
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
  // Lot 28 (v12) : les alternés **gardent leur état** à la reprise (A ou B, celui qu'avait le jeu à la mort ou à la reprise volontaire) ; seul un nouvel essai à zéro les remet à A.
  if (level.simVersion >= ALT_KEPT_VERSION && level.alts.length > 0) back.alt = state.alt ?? 0;
  // Lot 12 : les clignotants des sections d'avant ont gardé leur cycle ; les alternés repartent de A (état du point de passage) — avant la v12.
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
  // Lot 25 (optimisation, mêmes états) : l'état voulu de chaque groupe de clignotants ne dépend que de sa section, et celui des blocs alternés que de la parité : on les lit
  // une fois par section (`mask`, un bit par groupe) et non une fois par bloc. Un tableau de tuiles dont on a vérifié qu'il est **déjà** celui que veulent `mask` et `alt` est
  // retenu (`settledFor`) : le revoir avec les mêmes `mask` et `alt` ne change plus rien, quelle que soit la position du personnage, et ne coûte qu'une comparaison.
  const cacheable = level.sections.length <= 14;
  let mask = 0;
  for (let i = 0; i < level.blinkCycles.length; i++) {
    const cycle = level.blinkCycles[i];
    if (!cycle) continue;
    const phase = sectionClock(level, sections, time, i);
    if (blinkIsSolid(cycle, 0, phase)) mask |= 1 << (2 * i);
    if (blinkIsSolid(cycle, 1, phase)) mask |= 1 << (2 * i + 1);
  }
  const key = mask * 2 + alt;
  if (cacheable && settledFor.get(tiles) === key) return tiles;
  let out = tiles;
  let blocked = false;
  const box = playerBox(player);
  for (const b of level.blinks) {
    const want = (mask >> (2 * b.section + b.group)) & 1;
    const k = b.row * level.width + b.col;
    if ((isSolidTile(out[k]!) ? 1 : 0) === want) continue;
    if (want === 1 && boxesOverlap(box, tileBox(b.col, b.row))) {
      blocked = true;
      continue;
    }
    if (out === tiles) out = [...tiles];
    (out as number[])[k] = want === 1 ? TILE_BLINK_ON : TILE_BLINK_OFF;
  }
  for (const a of level.alts) {
    const want = a.set === alt;
    const k = a.row * level.width + a.col;
    if (isSolidTile(out[k]!) === want) continue;
    if (want && boxesOverlap(box, tileBox(a.col, a.row))) {
      blocked = true;
      continue;
    }
    if (out === tiles) out = [...tiles];
    (out as number[])[k] = want ? TILE_ALT_ON : TILE_ALT_OFF;
  }
  if (cacheable && !blocked) settledFor.set(out, key);
  return out;
}

/** Les tableaux de tuiles déjà vérifiés conformes à un `mask` de clignotants et à une parité (`settleDynamic`) : clé = `mask * 2 + alt`. */
const settledFor = new WeakMap<readonly number[], number>();

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

/** Lot 20 : le coin haut-gauche de la plateforme `index` (unités) au chrono `time` d'un état de sections `sections` (la même lecture d'horloge que les scies). */
export function platformAt(level: Level, sections: readonly number[], time: number, index: number): Point {
  const p = level.platforms[index]!;
  return platformPos(p, sectionClock(level, sections, time, p.section));
}

/** Lot 20 : les coins haut-gauche de toutes les plateformes dans cet état (unités), dans l'ordre de `level.platforms` (rendu, tests, solveur). */
export function platformPositions(level: Level, state: Readonly<AttemptState>): Point[] {
  return level.platforms.map((_, i) => platformAt(level, state.sections, state.time, i));
}

/**
 * Lot 23 : le rebond d'un champignon d'orientation `dir` sur le personnage `p`, `boost` si le saut est tenu au contact. Pure, entière. **Au sol** (`MUSHROOM_UP`) la vitesse
 * verticale devient −`MUSHROOM_UP_SPEED`, **au plafond** (`MUSHROOM_DOWN`) +`MUSHROOM_DOWN_SPEED` ; la vitesse horizontale, parallèle à la surface, est conservée. **Au mur**
 * (`MUSHROOM_RIGHT` : mur à gauche, `MUSHROOM_LEFT` : mur à droite) la vitesse horizontale devient ±`MUSHROOM_SIDE_SPEED` (à l'opposé du mur) ; la vitesse verticale, parallèle
 * au mur, est conservée si elle monte déjà au moins autant que la légère montée (−`MUSHROOM_RISE_SPEED`), sinon elle devient cette montée. Renforcé : chaque valeur ×
 * `MUSHROOM_BOOST_PERCENT` / 100 (`idiv`). Le personnage quitte le sol et le mur (plus de coyote ni de saut mural gardé), le saut ne se coupe pas (`jumping` à 0), le tampon est vidé.
 */
export function mushroomBounce(p: Readonly<PlayerState>, dir: number, boost: boolean): PlayerState {
  const k = (v: number): number => (boost ? idiv(v * MUSHROOM_BOOST_PERCENT, 100) : v);
  const left = { ground: 0, air: COUNTER_CAP, jumping: 0, buffer: 0, wallSide: 0, wallAir: COUNTER_CAP, slide: 0 };
  switch (dir) {
    case MUSHROOM_UP:
      return { ...p, ...left, vy: -k(MUSHROOM_UP_SPEED) };
    case MUSHROOM_DOWN:
      return { ...p, ...left, vy: k(MUSHROOM_DOWN_SPEED) };
    case MUSHROOM_RIGHT:
    case MUSHROOM_LEFT: {
      // La vitesse horizontale vient du champignon : l'élan d'un tapis (`carry`) n'a plus de sens.
      const { carry: _belt, ...rest } = p;
      const rise = -k(MUSHROOM_RISE_SPEED);
      return { ...rest, ...left, vx: (dir === MUSHROOM_RIGHT ? 1 : -1) * k(MUSHROOM_SIDE_SPEED), vy: p.vy < rise ? p.vy : rise };
    }
    default:
      throw new RangeError(`mushroomBounce : l'orientation ${dir} n'existe pas`);
  }
}

/**
 * Lot 23 : l'indice (dans `Level.mushrooms`) du premier champignon dont le chapeau vient d'être touché entre deux positions du personnage, −1 aucun : la boîte `after`
 * chevauche son chapeau (`mushroomPad`) et la boîte `before` ne le chevauchait pas. **C'est exactement la condition du rebond de `stepAttempt`** (le rebond ne change
 * pas la position, seulement la vitesse) : l'affichage et les événements savent ainsi qu'un rebond a eu lieu en comparant deux états successifs, sans état de plus.
 */
export function mushroomHit(level: Pick<Level, "mushrooms">, before: Readonly<PlayerState>, after: Readonly<PlayerState>): number {
  if (level.mushrooms.length === 0) return -1;
  const b = playerBox(before);
  const a = playerBox(after);
  for (let i = 0; i < level.mushrooms.length; i++) {
    const pad = mushroomPad(level.mushrooms[i]!);
    if (boxesOverlap(a, pad) && !boxesOverlap(b, pad)) return i;
  }
  return -1;
}

/** Lot 22 : le rectangle mortel de la presse `index` (unités) au chrono `time` d'un état de sections `sections` (la même lecture d'horloge que les scies). */
export function pressAt(level: Level, sections: readonly number[], time: number, index: number): Box {
  const p = level.presses[index]!;
  return pressBox(p, sectionClock(level, sections, time, p.section));
}

/** Lot 22 : les rectangles mortels de toutes les presses dans cet état (unités), dans l'ordre de `level.presses` (rendu, tests, solveur). */
export function pressBoxes(level: Level, state: Readonly<AttemptState>): Box[] {
  return level.presses.map((_, i) => pressAt(level, state.sections, state.time, i));
}

/** Lot 25 : le laser fixe `index` est-il allumé au chrono `time` d'un état de sections `sections` (la même lecture d'horloge que les scies) ? */
export function laserIsOn(level: Level, sections: readonly number[], time: number, index: number): boolean {
  const l = level.lasers[index]!;
  return laserOn(l, sectionClock(level, sections, time, l.section));
}

/** Lot 25 : la bande mortelle de la barre coulissante `index` (unités) au chrono `time`. */
export function laserBarAt(level: Level, sections: readonly number[], time: number, index: number): Box {
  const b = level.laserBars[index]!;
  return laserBarBox(b, sectionClock(level, sections, time, b.section));
}

/** Lot 25 : les bandes mortelles des rayons de ce niveau dans cet état (unités) : les lasers fixes allumés, puis toutes les barres (rendu, tests, solveur). */
export function laserBoxes(level: Level, state: Readonly<AttemptState>): Box[] {
  const out: Box[] = [];
  level.lasers.forEach((l, i) => {
    if (laserIsOn(level, state.sections, state.time, i)) out.push(laserBox(l));
  });
  level.laserBars.forEach((_, i) => out.push(laserBarAt(level, state.sections, state.time, i)));
  return out;
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

/** Le rectangle (unités) qui contient tout le disque d'une scie sur tout son trajet : les nœuds du trajet élargis de son rayon. Calculé une fois par scie. */
const sawReaches = new WeakMap<object, { x0: number; y0: number; x1: number; y1: number }>();
/** `sawReach` de toutes les scies d'un niveau, dans l'ordre de `level.saws` (un seul accès par pas dans `deathAt`). */
const levelReaches = new WeakMap<object, { x0: number; y0: number; x1: number; y1: number }[]>();
function sawReachesOf(level: Level): { x0: number; y0: number; x1: number; y1: number }[] {
  let r = levelReaches.get(level.saws);
  if (!r) {
    r = level.saws.map(sawReach);
    levelReaches.set(level.saws, r);
  }
  return r;
}

export function sawReach(saw: Level["saws"][number]): { x0: number; y0: number; x1: number; y1: number } {
  let r = sawReaches.get(saw);
  if (!r) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of saw.nodes) {
      if (n.x < x0) x0 = n.x;
      if (n.x > x1) x1 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.y > y1) y1 = n.y;
    }
    r = { x0: x0 - saw.radius, y0: y0 - saw.radius, x1: x1 + saw.radius, y1: y1 + saw.radius };
    sawReaches.set(saw, r);
  }
  return r;
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
  const reaches = level.saws.length > 0 ? sawReachesOf(level) : null;
  for (let i = 0; i < level.saws.length; i++) {
    const saw = level.saws[i]!;
    // Une scie dont tout le trajet (ses nœuds, élargis de son rayon) est loin de la boîte ne peut pas la toucher : le même verdict, sans calculer sa position.
    const reach = reaches![i]!;
    if (box.x >= reach.x1 || box.x + box.w <= reach.x0 || box.y >= reach.y1 || box.y + box.h <= reach.y0) continue;
    const at = sawCenter(saw, sawPhase(level, state, i));
    if (circleHitsBox(at.x, at.y, saw.radius, box)) return DEATH_SAW;
  }
  // Lot 22 : toute la presse tue au contact (se toucher par un bord ne compte pas, comme pour un pic).
  for (let i = 0; i < level.presses.length; i++) {
    // Hors de la course entière (sa boîte fixe, de la position haute à la basse), rien ne peut toucher la presse : on n'en calcule pas la position (le même verdict, bien moins cher).
    const p = level.presses[i]!;
    if (box.x >= (p.col + p.width) * UNITS_PER_TILE || box.x + box.w <= p.col * UNITS_PER_TILE) continue;
    if (box.y >= (p.row + p.travel + PRESS_HEIGHT_TILES) * UNITS_PER_TILE || box.y + box.h <= p.row * UNITS_PER_TILE) continue;
    if (boxesOverlap(box, pressAt(level, state.sections, state.time, i))) return DEATH_PRESS;
  }
  // Lot 24 : une stalactite qui tremble ou qui tombe tue au contact (intacte ou brisée, non).
  const hanging = state.stalactites;
  if (hanging) {
    for (let i = 0; i < hanging.length; i++) {
      const h = stalactiteHazard(level, i, hanging[i]!);
      if (h && boxesOverlap(box, h)) return DEATH_STALACTITE;
    }
  }
  // Lot 25 : un rayon allumé tue au contact (se toucher par un bord ne compte pas) ; un laser éteint se traverse.
  for (let i = 0; i < level.lasers.length; i++) {
    if (laserIsOn(level, state.sections, state.time, i) && boxesOverlap(box, laserBox(level.lasers[i]!))) return DEATH_LASER;
  }
  for (let i = 0; i < level.laserBars.length; i++) {
    const b = level.laserBars[i]!;
    // Hors de la bande balayée par la barre, rien ne peut la toucher : on n'en calcule pas la position (le même verdict, moins cher).
    if (b.axis === "h") {
      const x0 = b.a.col * UNITS_PER_TILE;
      if (box.x >= x0 + b.length * UNITS_PER_TILE || box.x + box.w <= x0) continue;
    } else {
      const y0 = b.a.row * UNITS_PER_TILE;
      if (box.y >= y0 + b.length * UNITS_PER_TILE || box.y + box.h <= y0) continue;
    }
    if (boxesOverlap(box, laserBarAt(level, state.sections, state.time, i))) return DEATH_LASER;
  }
  return DEATH_NONE;
}

/** Le personnage touche-t-il la tuile d'arrivée ? */
export function reachesFinish(level: Level, p: Readonly<PlayerState>): boolean {
  const T = UNITS_PER_TILE;
  // Le même test que `boxesOverlap(playerBox(p), tuile d'arrivée)`, sans allouer de boîtes (appelé à chaque pas de chaque rejeu).
  const fx = level.finish.col * T;
  const fy = level.finish.row * T;
  return p.x < fx + T && fx < p.x + PLAYER_WIDTH && p.y < fy + T && fy < p.y + PLAYER_HEIGHT;
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

/** Lot 24 : la boîte mortelle de la stalactite `index` dans l'état `age` (voir `AttemptState.stalactites`), ou null si elle est intacte ou brisée (elle ne tue pas). */
export function stalactiteHazard(level: Pick<Level, "stalactites">, index: number, age: number): Box | null {
  return age > 0 ? stalactiteBox(level.stalactites[index]!, stalactiteOffset(age)) : null;
}

/**
 * Lot 24 : les stalactites au pas suivant. **Avance** celles qui sont déclenchées (âge + 1) : brisées au premier pas où leur corps chevauche un bloc plein de `tiles` ou sort
 * de la grille par le bas ; puis **déclenche** les intactes dont la zone contient le centre du personnage (`col`, `row` : sa tuile), qui commencent à l'âge 1. Rend `current` lui-même
 * si rien ne change. `events` (facultatif) reçoit l'indice de la première stalactite déclenchée ou brisée à ce pas.
 */
function stepStalactites(level: Level, current: readonly number[], tiles: readonly number[], col: number, row: number, trigger: boolean, events: AttemptEvents | null): readonly number[] {
  let out = current;
  const set = (i: number, v: number) => {
    if (out === current) out = [...current];
    (out as number[])[i] = v;
  };
  for (let i = 0; i < level.stalactites.length; i++) {
    const age = current[i]!;
    if (age > 0) {
      const next = age + 1;
      const box = stalactiteBox(level.stalactites[i]!, stalactiteOffset(next));
      let broken = box.y >= level.height * UNITS_PER_TILE;
      if (!broken) {
        const c = tileOf(box.x);
        for (let r = tileOf(box.y); r <= tileOf(box.y + box.h - 1) && !broken; r++) if (r < level.height && isSolidTile(tiles[r * level.width + c]!)) broken = true;
      }
      set(i, broken ? STALACTITE_BROKEN : next);
      if (broken && events && events.shatter < 0) events.shatter = i;
    } else if (age === STALACTITE_INTACT && trigger) {
      const s = level.stalactites[i]!;
      if (col >= s.col - s.before && col <= s.col + s.after && row >= s.row) {
        set(i, 1);
        if (events && events.shake < 0) events.shake = i;
      }
    }
  }
  return out;
}

/** Lot 26 : le personnage `p` est-il posé sur l'interrupteur du pont `b` (au sol, la tuile sous ses pieds, par un bout au moins de sa largeur) ? */
export function standsOnSwitch(b: Pick<Bridge, "switchCol" | "switchRow">, p: Readonly<PlayerState>): boolean {
  return p.ground === 1 && tileOf(p.y + PLAYER_HEIGHT) === b.switchRow && tileOf(p.x) <= b.switchCol && b.switchCol <= tileOf(p.x + PLAYER_WIDTH - 1);
}

/**
 * Lot 26 : les ponts au pas suivant. **Avance** ceux qui sont allumés (âge + 1, éteints une fois la dernière tuile éteinte), puis **allume ou rallume** tout pont dont le personnage
 * vient de se poser sur l'interrupteur : `after` sur l'interrupteur, `before` pas (null : aucun allumage, pendant l'attente de la reprise). Rend `current` lui-même si rien ne change.
 * `events` (facultatif) reçoit l'indice du premier pont allumé à ce pas.
 */
function stepBridges(level: Level, current: readonly number[], before: Readonly<PlayerState>, after: Readonly<PlayerState> | null, events: AttemptEvents | null): readonly number[] {
  let out = current;
  for (let i = 0; i < level.bridges.length; i++) {
    const b = level.bridges[i]!;
    const age = current[i]!;
    let next = age > 0 ? (age >= bridgeLastLit(b) ? 0 : age + 1) : 0;
    if (after && standsOnSwitch(b, after) && !standsOnSwitch(b, before)) {
      next = 1;
      if (events && events.bridge < 0) events.bridge = i;
    }
    if (next !== age) {
      if (out === current) out = [...current];
      (out as number[])[i] = next;
    }
  }
  return out;
}

/**
 * Lot 26 : l'état des tuiles des ponts pour le pas qui suit, `bridges` étant l'état des ponts, `player` le personnage. Une tuile qui doit être **éteinte** l'est tout de suite (le
 * personnage qui marchait dessus tombe) ; une tuile qui doit être **pleine** le devient **sauf si la boîte du personnage la chevauche** : elle reste traversable jusqu'au premier état
 * où elle n'y est plus (se toucher par un bord ne compte pas), comme les blocs clignotants. Rend `tiles` lui-même si rien ne change (sinon une copie).
 */
export function settleBridges(level: Level, tiles: readonly number[], bridges: readonly number[], player: Readonly<PlayerState>): readonly number[] {
  let out = tiles;
  let box: Box | null = null;
  for (let i = 0; i < level.bridges.length; i++) {
    const b = level.bridges[i]!;
    const age = bridges[i]!;
    for (let k = 0; k < b.tiles.length; k++) {
      const cell = b.tiles[k]!;
      const at = cell.row * level.width + cell.col;
      const want = bridgeTileLit(b, age, k);
      if ((out[at] === TILE_BRIDGE_ON) === want) continue;
      if (want) {
        if (!box) box = playerBox(player);
        if (boxesOverlap(box, tileBox(cell.col, cell.row))) continue;
      }
      if (out === tiles) out = [...tiles];
      (out as number[])[at] = want ? TILE_BRIDGE_ON : TILE_EMPTY;
    }
  }
  return out;
}

/**
 * Lot 23 : ce qu'un pas a déclenché, rempli par `stepAttempt` si on le lui donne (outils, tests, affichage : jamais la simulation elle-même) — `mushroom` : l'indice dans
 * `Level.mushrooms` du champignon qui vient de rebondir (−1 : aucun), `boost` : 1 si le rebond est renforcé.
 */
export interface AttemptEvents {
  mushroom: number;
  boost: number;
  /** Lot 24 : l'indice dans `Level.stalactites` de la stalactite déclenchée à ce pas (−1 : aucune) et de celle qui s'est brisée (−1 : aucune). */
  shake: number;
  shatter: number;
  /** Lot 26 : l'indice dans `Level.bridges` du pont allumé (ou rallumé) à ce pas (−1 : aucun). */
  bridge: number;
}

/**
 * Un pas d'essai (1/120 s). Pur : `state` n'est pas modifié ; un état inchangé est rendu tel quel (même objet). `input` = bits `INPUT_*`.
 */
export function stepAttempt(state: Readonly<AttemptState>, input: number, level: Level, params: Readonly<JumpParams>, events: AttemptEvents | null = null): AttemptState {
  // Lot 27 (v11) : le quatrième bit, `INPUT_RESPAWN`, reprend tout de suite au dernier point de passage ; les trois autres sont la commande du personnage.
  const restart = level.simVersion >= RESTART_VERSION;
  if (!Number.isInteger(input) || input < 0 || input > (restart ? INPUT_ATTEMPT_MASK : INPUT_MASK)) throw new RangeError(`Commande invalide : ${input}`);
  const resume = (input & INPUT_RESPAWN) !== 0;
  input &= INPUT_MASK;
  const jump = input & INPUT_JUMP ? 1 : 0;

  if (events) {
    events.mushroom = -1;
    events.boost = 0;
    events.shake = -1;
    events.shatter = -1;
    events.bridge = -1;
  }
  if (state.status === ATTEMPT_FINISHED) return state as AttemptState;
  const single = level.simVersion >= SINGLE_CLOCK_VERSION;
  if (state.status === ATTEMPT_DEAD) {
    const deathTicks = state.deathTicks + 1;
    // Avec un point de passage (et toujours en v4, lot 15), l'essai continue : le chrono tourne pendant l'attente.
    const time = state.checkpoint >= 0 || single ? state.time + 1 : state.time;
    if (deathTicks < RESPAWN_TICKS) {
      // Lot 24 : une stalactite déclenchée continue de tomber pendant l'attente (affichage seulement : la reprise la remet intacte).
      if (level.stalactites.length === 0 && level.bridges.length === 0) return { ...state, deathTicks, time };
      const waiting: AttemptState = { ...state, deathTicks, time };
      if (level.stalactites.length > 0) waiting.stalactites = stepStalactites(level, state.stalactites!, state.tiles, 0, 0, false, events);
      // Lot 26 : un pont allumé continue de s'éteindre pendant l'attente (affichage seulement : la reprise le remet éteint).
      if (level.bridges.length > 0) {
        waiting.bridges = stepBridges(level, state.bridges!, state.player, null, events);
        waiting.tiles = settleBridges(level, state.tiles, waiting.bridges, state.player);
      }
      return waiting;
    }
    if (state.checkpoint >= 0 || (single && !restart)) {
      const back = state.checkpoint >= 0 ? checkpointAttempt(level, { ...state, time }) : respawnAttempt(level, { ...state, time });
      if (jump) back.player = { ...back.player, held: 1 };
      return back;
    }
    // Nouvel essai : l'état initial exact (v3 ; lot 27, v11 : une mort avant le premier point de passage recommence l'essai à zéro, chrono et horloge compris). Le bouton de saut tenu à cet instant est noté comme tenu : il ne fera pas sauter tout seul.
    const fresh = initialAttempt(level);
    if (jump) fresh.player = { ...fresh.player, held: 1 };
    return fresh;
  }
  // Lot 27 (v11) : la reprise volontaire — tout de suite, au dernier point de passage franchi ; le chrono continue (ce pas compris). Sans point franchi, la commande est sans effet.
  if (resume && state.checkpoint >= 0) {
    const back = checkpointAttempt(level, { ...state, time: state.time + 1 });
    if (jump) back.player = { ...back.player, held: 1 };
    return back;
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

  // ——— Lot 20 : plateformes mobiles — où elles étaient, où elles seront ; le personnage porté reçoit leur déplacement ———
  const hasPlatforms = level.platforms.length > 0;
  const platBefore = hasPlatforms ? level.platforms.map((_, i) => platformAt(level, state.sections, state.time, i)) : null;
  const platAfter = hasPlatforms ? level.platforms.map((_, i) => platformAt(level, state.sections, state.time + 1, i)) : null;
  const ride = hasPlatforms ? (state.ride ?? -1) : -1;
  let from = state.player;
  let platformVx = 0;
  if (ride >= 0) {
    const dx = platAfter![ride]!.x - platBefore![ride]!.x;
    const dy = platAfter![ride]!.y - platBefore![ride]!.y;
    platformVx = dx;
    if (state.player.ground === 1) {
      const grid = gridOf(level, tiles);
      const mx = sweep(grid, from.x, PLAYER_WIDTH, dx, from.y, PLAYER_HEIGHT, true);
      const my = sweep(grid, from.y, PLAYER_HEIGHT, dy, mx.pos, PLAYER_WIDTH, false);
      from = { ...from, x: mx.pos, y: my.pos };
    }
  }

  // ——— Personnage ———
  const flags: JumpFlags | null = level.alts.length > 0 ? { jumped: 0, wall: 0 } : null;
  let player = stepPlayerJump(from, input, gridOf(level, tiles), params, flags, level.winds.length > 0 ? windPush(level, state) : null, platformVx, params.jumpMinHold ?? level.minHold, params.jumpMicroMax ?? level.microMax);
  // Se poser sur une plateforme : la plus haute dont le personnage était au-dessus (son pied au plus au niveau de son dessus au pas précédent) et que
  // son pied atteint ou dépasse maintenant, en recouvrement horizontal ; sans y entrer dans un plein (alors on la traverse).
  let landedOn = -1;
  if (hasPlatforms) {
    const wasBottom = state.player.y + PLAYER_HEIGHT;
    const nowBottom = player.y + PLAYER_HEIGHT;
    let top = 0;
    for (let i = 0; i < level.platforms.length; i++) {
      const at = platAfter![i]!;
      const reach = level.platforms[i]!.width * UNITS_PER_TILE;
      if (player.x >= at.x + reach || at.x >= player.x + PLAYER_WIDTH) continue;
      if (wasBottom > platBefore![i]!.y || nowBottom < at.y) continue;
      if (landedOn >= 0 && at.y >= top) continue;
      landedOn = i;
      top = at.y;
    }
    if (landedOn >= 0) {
      const y = top - PLAYER_HEIGHT;
      if (boxHits(gridOf(level, tiles), player.x, y, PLAYER_WIDTH, PLAYER_HEIGHT)) landedOn = -1;
      else {
        const { carry: _belt, ...rest } = player;
        player = { ...rest, y, vy: 0, ground: 1, air: 0, wallSide: 0, wallAir: COUNTER_CAP, slide: 0, jumping: 0 };
      }
    }
  }
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
    // Les colonnes à tester, dans cet ordre : le milieu, puis la première et la dernière que couvre le personnage (sans allouer de tableau à chaque pas).
    for (let n = 0; n < 3 && hit < 0; n++) {
      const k = cellIndex(level, n === 0 ? mid : n === 1 ? c0 : c1, below);
      if (k >= 0 && tiles[k] === TILE_SPRING) hit = k;
    }
    if (hit >= 0) {
      const speed = params.springSpeed < MAX_SPEED ? params.springSpeed : MAX_SPEED;
      player = { ...player, vy: -speed, ground: 0, air: COUNTER_CAP, jumping: 0, buffer: 0 };
      springCell = hit;
      springTime = state.time + 1;
    }
  }

  // ——— Lot 23 : champignons — le premier dont le chapeau vient d'être touché rebondit ; un saut tenu à ce pas renforce le rebond ———
  if (level.mushrooms.length > 0) {
    const hit = mushroomHit(level, state.player, player);
    if (hit >= 0) {
      player = mushroomBounce(player, level.mushrooms[hit]!.dir, jump === 1);
      if (events) {
        events.mushroom = hit;
        events.boost = jump;
      }
    }
  }

  // (Optimisation du lot 25 : sans bloc friable ce passage ne fait rien ; on ne crée alors ni la fonction `touch` ni ses variables, à chaque pas de chaque rejeu.)
  if (level.crumbles.length > 0) {
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

  // (Optimisation du lot 25 : les mêmes champs que `{ ...state, … }`, dans le même ordre, écrits un à un — la copie par étalement de cet objet était le point chaud des rejeux.)
  const next: AttemptState = {
    status: ATTEMPT_RUNNING,
    time,
    player,
    tiles,
    crumbles,
    sections,
    deathCause: state.deathCause,
    deathX: state.deathX,
    deathY: state.deathY,
    deathTicks: state.deathTicks,
    springCell,
    springTime,
    checkpoint: state.checkpoint,
  };
  if (state.alt !== undefined) next.alt = state.alt;
  if (state.ride !== undefined) next.ride = state.ride;
  if (state.stalactites !== undefined) next.stalactites = state.stalactites;
  if (state.bridges !== undefined) next.bridges = state.bridges;
  if (level.alts.length > 0) next.alt = alt;
  // Lot 24 : les stalactites avancent, puis se déclenchent si le centre du personnage est dans leur zone (sa tuile : `col`, rangée du centre).
  if (level.stalactites.length > 0) next.stalactites = stepStalactites(level, state.stalactites!, tiles, col, tileOf(player.y + idiv(PLAYER_HEIGHT, 2)), true, events);
  // Lot 26 : les ponts avancent, puis s'allument (ou se rallument) si le personnage vient de se poser sur un interrupteur ; leurs tuiles pour le pas suivant.
  if (level.bridges.length > 0) {
    next.bridges = stepBridges(level, state.bridges!, state.player, player, events);
    next.tiles = settleBridges(level, tiles, next.bridges, player);
  }
  // Lot 20 : la plateforme qui porte le personnage (gardée pendant le coyote après avoir quitté son bord).
  if (hasPlatforms) next.ride = landedOn >= 0 ? landedOn : player.ground !== 1 && ride >= 0 && player.air <= params.coyote ? ride : -1;
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
