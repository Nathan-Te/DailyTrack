import { blockEvents } from "./blocks";
import { windEvents } from "./wind";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  CRUMBLE_GONE,
  CRUMBLE_INTACT,
  DEATH_FALL,
  DEATH_LASER,
  DEATH_PRESS,
  DEATH_STALACTITE,
  DEATH_SAW,
  DEATH_SPIKE,
  INPUT_LEFT,
  INPUT_RIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TICK_RATE,
  TILE_BELT_LEFT,
  TILE_BELT_RIGHT,
  TILE_ICE,
  UNITS_PER_TILE,
  groundTile,
  isResume,
  mushroomHit,
  mushroomPad,
  stalactiteFloorRow,
  type AttemptState,
  type JumpMedal,
  type JumpParams,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";

// Événements de jeu (lot 8), **logique pure** : on compare deux états successifs d'un essai (avant et après un pas) et l'on en déduit ce qui
// vient d'arriver. Le son (`audio.ts`), les particules (`feel.ts`, `fx.ts`) et les vibrations ne s'abonnent qu'à cette liste : ils ne lisent
// jamais la simulation directement, et rien ici ne l'influence (on ne fait que lire deux états).
//
// Positions en tuiles, **y vers le bas** comme la simulation (le centre du personnage, sauf mention contraire).
//
// Comment chaque événement se lit dans l'état (sans rejouer la simulation) :
//   - saut / saut mural : un appui (front montant de `held`) ou un tampon actif, et `buffer` remis à 0 par le saut (`stepPlayer` : seul un
//     saut le remet à 0 avant la fin du tampon) ; sinon une vitesse de montée nouvelle (vy plus négative qu'au pas d'avant : la gravité ne
//     fait que l'augmenter). Pas un ressort (il remet aussi `buffer` à 0). Au sol ou dans le coyote : `saut` ; sinon `sautMural`.
//   - atterrissage : `ground` passe de 0 à 1 ; intensité = vitesse de chute du pas d'avant ÷ chute maximale (0 à 1).
//   - pas : au sol avant et après, un pas chaque fois que le centre franchit un multiple de `STRIDE_TILES` (la cadence suit la distance).
//   - glisse : `slide` passe de 0 à ±1 (début) ou revient à 0 (fin, aussi à la mort et à l'arrivée).
//   - mort, réapparition, point de passage, arrivée : transitions de `status` et de `checkpoint`.
//   - ressort : `springTime` / `springCell` changent ; friable : minuterie lancée (craque), bloc tombé (tombe).
//   - champignon (lot 23) : `mushroomHit` de la simulation (la boîte du personnage commence à chevaucher le chapeau d'un champignon : exactement la condition du rebond) ;
//     `boost` : le saut était tenu à ce pas (`held` = 1), donc le rebond est renforcé. Aucune secousse de caméra (règle du lot 14).
//   - stalactite (lot 24) : `stalactiteTremble` quand l'état d'une stalactite passe de 0 (intacte) à un âge (elle est déclenchée), `stalactiteCasse` quand il passe d'un âge à −1 (elle se brise) ;
//     lus sur deux états successifs (`AttemptState.stalactites`), sans état de plus. Aucune secousse de caméra (règle du lot 14), aucun n'est gardé pour les autres vies du carnage.
//   - pont (lot 26) : `pontAllume` quand l'âge d'un pont (`AttemptState.bridges`) passe à 1 (le personnage vient de se poser sur son interrupteur : allumage, ou rallumage), lu sur deux états
//     successifs ; position : le haut de l'interrupteur. Aucune secousse de caméra (règle du lot 14), jamais gardé pour les autres vies du carnage.
//   - blocs (lot 12) : voir `blocks.ts` — `blocApparait` / `blocDisparait` (un par section et par sens, comparaison des grilles), `blocVacille` (le
//     groupe plein d'une section passe sous 0,25 s avant de s'éteindre), `bascule` (la parité des alternés change, ou remise à A au point de
//     passage), `metronome` (un des quatre temps du cycle de la section courante). Aucun n'est gardé pour les autres vies du carnage.
//   - dérapage (lot 8b) : au sol avant et après, la commande vient de passer à l'opposé du mouvement (demi-tour) alors que la vitesse est
//     d'au moins `SKID_SPEED` × la course. Seul événement qui lit les commandes (celle du pas et celle d'avant, `EventInputs`) : sans
//     elles (héros du carnage), pas de dérapage. Lot 11 : sur la glace il porte `ice` (la poussière devient du givre, le frottement un crissement).
//   - tapis et glace (lot 11) : la tuile sous les pieds (`groundTile` de la simulation, lue des deux côtés d'un pas, au sol seulement) passe
//     d'autre chose à un tapis (`tapisDebut`, `side` = sens du tapis : −1 gauche, 1 droite) ou à la glace (`glaceDebut`), et inversement
//     (`tapisFin`, `glaceFin`) ; la mort et l'arrivée ferment aussi l'état (comme `glisseFin`), le décollage aussi. Un changement de sens de
//     tapis est une fin puis un début. `glaceFrein` : sur la glace avant et après, la vitesse au sol d'au moins `ICE_BRAKE_SPEED` × la course
//     baisse (frein, lâcher, demi-tour : on le lit dans l'état, pas dans les commandes), un par `ICE_STRIDE_TILES` parcourues : il porte le
//     givre et le crissement. Aucun de ces événements n'est gardé pour les autres vies du carnage (`CarnageFilter` : mort et arrivée seulement).
//   - vent (lot 13) : voir `wind.ts` — `ventDebut` / `ventFin` (le centre du personnage entre dans une zone qui souffle, ou la zone où il est se
//     met à souffler, et l'inverse ; la mort et l'arrivée ferment l'état), `rafale` (une rafale de la section courante part, position : le
//     centre de la zone). Jamais gardés pour les autres vies du carnage.

export type DeathCauseName = "pic" | "scie" | "chute" | "presse" | "stalactite" | "laser";

/** D'où vient un événement : la partie (ou une lecture), le héros du carnage, une autre vie du carnage (filtrée). */
export type EventSource = "jeu" | "heros" | "vie";

interface Base {
  /** Pas de la session (ou du carnage) où il est survenu. */
  tick: number;
  source: EventSource;
  /** Centre, en tuiles (y vers le bas). */
  x: number;
  y: number;
}

export type GameEvent =
  | (Base & { kind: "saut" })
  /** `side` : côté du mur quitté (−1 gauche, 1 droite). */
  | (Base & { kind: "sautMural"; side: number })
  /** `intensity` ∈ [0, 1] : vitesse de chute ÷ chute maximale. */
  | (Base & { kind: "atterrissage"; intensity: number })
  /** `speed` : vitesse au sol (tuiles/s) ; `cadence` : pas par seconde à cette vitesse. */
  | (Base & { kind: "pas"; speed: number; cadence: number; full: boolean })
  | (Base & { kind: "glisseDebut"; side: number })
  | (Base & { kind: "glisseFin" })
  | (Base & { kind: "mort"; cause: DeathCauseName })
  | (Base & { kind: "reapparition"; checkpoint: boolean })
  | (Base & { kind: "pointDePassage"; index: number })
  | (Base & { kind: "arrivee" })
  /** Position : le haut de la tuile du ressort. */
  | (Base & { kind: "ressort" })
  /** Lot 24 : une stalactite est déclenchée (elle se met à trembler). `index` : dans `Level.stalactites`. Position : le milieu de son corps. */
  | (Base & { kind: "stalactiteTremble"; index: number })
  /** Lot 24 : une stalactite se brise sur un plein. `index` : dans `Level.stalactites`. Position : le point d'impact, au sol. */
  | (Base & { kind: "stalactiteCasse"; index: number })
  /** Lot 26 : un pont s'allume (ou se rallume) : le personnage vient de se poser sur son interrupteur. `index` : dans `Level.bridges`. Position : le haut de l'interrupteur. */
  | (Base & { kind: "pontAllume"; index: number })
  /**
   * Lot 23 : un champignon rebondit. `index` : dans `Level.mushrooms` ; `dir` : son orientation (`MUSHROOM_UP` …) ; `boost` : rebond renforcé (saut tenu au contact).
   * Position : le centre de son chapeau.
   */
  | (Base & { kind: "champignon"; index: number; dir: number; boost: boolean })
  /** Position : le centre du bloc friable. */
  | (Base & { kind: "friableCraque"; index: number })
  | (Base & { kind: "friableTombe"; index: number })
  /** Lot 8b : demi-tour au sol à vitesse. `side` : sens du mouvement avant le demi-tour (la poussière part devant) ; `speed` : tuiles/s. */
  | (Base & { kind: "derapage"; side: number; speed: number; ice: boolean })
  /** Lot 11 : le personnage se pose sur un tapis roulant / le quitte. `side` : sens du tapis (−1 gauche, 1 droite). Position : les pieds. */
  | (Base & { kind: "tapisDebut"; side: number })
  | (Base & { kind: "tapisFin"; side: number })
  /** Lot 11 : le personnage se pose sur la glace / la quitte. */
  | (Base & { kind: "glaceDebut" })
  | (Base & { kind: "glaceFin" })
  /** Lot 11 : freinage sur la glace. `side` : sens du mouvement, `speed` : tuiles/s. */
  | (Base & { kind: "glaceFrein"; side: number; speed: number })
  /** Lot 12 : blocs clignotants d'une section. `count` : nombre de blocs ; position : leur centre. `blocVacille` : ils vont s'éteindre (0,25 s avant). */
  | (Base & { kind: "blocVacille"; section: number; count: number })
  | (Base & { kind: "blocApparait"; section: number; count: number })
  | (Base & { kind: "blocDisparait"; section: number; count: number })
  /** Lot 12 : les blocs alternés s'inversent (un saut est parti) : `alt` = le jeu solide maintenant (0 : A, 1 : B) ; `reset` : remise à A par un point de passage (position : le fanion). */
  | (Base & { kind: "bascule"; alt: number; reset: boolean })
  /** Lot 12 : un temps du cycle de la section de nuit courante (4 par cycle ; `accent` sur les deux bascules). */
  | (Base & { kind: "metronome"; accent: boolean; beat: number })
  /** Lot 13 : le personnage est poussé par une zone de vent / ne l'est plus. `zone` : indice dans `Level.winds` ; `dir` : son sens. */
  | (Base & { kind: "ventDebut"; zone: number; dir: "haut" | "gauche" | "droite" })
  | (Base & { kind: "ventFin"; zone: number; dir: "haut" | "gauche" | "droite" })
  /** Lot 13 : une rafale de la section courante part (position : le centre de la zone). */
  | (Base & { kind: "rafale"; zone: number; dir: "haut" | "gauche" | "droite" })
  /** Médaille obtenue à l'arrivée sur le niveau du jour (le jeu la pousse : la simulation ne connaît pas les médailles). */
  | (Base & { kind: "medaille"; medal: JumpMedal });

export type GameEventKind = GameEvent["kind"];

/** Tous les noms d'événements (ordre de la documentation). */
export const EVENT_KINDS: readonly GameEventKind[] = [
  "saut",
  "sautMural",
  "atterrissage",
  "pas",
  "glisseDebut",
  "glisseFin",
  "mort",
  "reapparition",
  "pointDePassage",
  "arrivee",
  "ressort",
  "champignon",
  "stalactiteTremble",
  "stalactiteCasse",
  "pontAllume",
  "friableCraque",
  "friableTombe",
  "medaille",
  "derapage",
  "tapisDebut",
  "tapisFin",
  "glaceDebut",
  "glaceFin",
  "glaceFrein",
  "blocVacille",
  "blocApparait",
  "blocDisparait",
  "bascule",
  "metronome",
  "ventDebut",
  "ventFin",
  "rafale",
];

/** Distance au sol entre deux bruits de pas (tuiles) : à pleine course (11 tuiles/s), un peu plus de 7 pas par seconde. */
export const STRIDE_TILES = 1.5;
const STRIDE = STRIDE_TILES * UNITS_PER_TILE;
/** « Pleine vitesse » : au moins cette part de la vitesse de course (poussière de course, traînée). */
export const FULL_SPEED = 0.92;

/** Lot 11 : le freinage sur la glace compte à partir de cette part de la vitesse de course, et donne un événement par `ICE_STRIDE_TILES` parcourues. */
export const ICE_BRAKE_SPEED = 0.35;
export const ICE_STRIDE_TILES = 1;
const ICE_STRIDE = ICE_STRIDE_TILES * UNITS_PER_TILE;

/** Lot 8b : un demi-tour au sol dérape à partir de cette part de la vitesse de course. */
export const SKID_SPEED = 0.6;

/** Commandes du pas joué et du pas d'avant (bits `INPUT_*`) : seul le dérapage s'en sert. */
export interface EventInputs {
  bits: number;
  prevBits: number;
}

const dirOf = (bits: number) => (bits & INPUT_RIGHT ? 1 : 0) - (bits & INPUT_LEFT ? 1 : 0);

const T = UNITS_PER_TILE;
const CAUSES: Record<number, DeathCauseName> = { [DEATH_SPIKE]: "pic", [DEATH_SAW]: "scie", [DEATH_FALL]: "chute", [DEATH_PRESS]: "presse", [DEATH_STALACTITE]: "stalactite", [DEATH_LASER]: "laser" };

export function causeName(cause: number): DeathCauseName {
  return CAUSES[cause] ?? "pic";
}

/** Sens du tapis qu'est une tuile (−1 gauche, 1 droite), 0 pour toute autre. */
const beltSide = (tile: number): number => (tile === TILE_BELT_LEFT ? -1 : tile === TILE_BELT_RIGHT ? 1 : 0);

const centerX = (p: Readonly<PlayerState>) => (p.x + PLAYER_WIDTH / 2) / T;
const centerY = (p: Readonly<PlayerState>) => (p.y + PLAYER_HEIGHT / 2) / T;
const feetY = (p: Readonly<PlayerState>) => (p.y + PLAYER_HEIGHT) / T;

/** Lot 24 : les stalactites déclenchées ou brisées entre deux états successifs (vide pour un niveau sans stalactite). */
function stalactiteEvents(level: Level, prev: Readonly<AttemptState>, cur: Readonly<AttemptState>, tick: number, source: EventSource): GameEvent[] {
  const out: GameEvent[] = [];
  if (level.stalactites.length === 0 || !prev.stalactites || !cur.stalactites) return out;
  for (let i = 0; i < level.stalactites.length; i++) {
    const was = prev.stalactites[i]!;
    const now = cur.stalactites[i]!;
    const s = level.stalactites[i]!;
    if (was === 0 && now > 0) out.push({ tick, source, kind: "stalactiteTremble", index: i, x: s.col + 0.5, y: s.row + 1 });
    else if (was > 0 && now === -1) out.push({ tick, source, kind: "stalactiteCasse", index: i, x: s.col + 0.5, y: Math.max(stalactiteFloorRow(level, s), s.row + 2) });
  }
  return out;
}

/** Lot 26 : les ponts allumés (ou rallumés) entre deux états successifs (vide pour un niveau sans pont) : l'âge passe à 1. */
function bridgeEvents(level: Level, prev: Readonly<AttemptState>, cur: Readonly<AttemptState>, tick: number, source: EventSource): GameEvent[] {
  const out: GameEvent[] = [];
  if (level.bridges.length === 0 || !cur.bridges) return out;
  for (let i = 0; i < level.bridges.length; i++) {
    if (cur.bridges[i] === 1 && prev.bridges?.[i] !== 1) {
      const b = level.bridges[i]!;
      out.push({ tick, source, kind: "pontAllume", index: i, x: b.switchCol + 0.5, y: b.switchRow });
    }
  }
  return out;
}

/** Un saut a-t-il eu lieu pendant ce pas ? (voir l'en-tête) */
export function jumpedBetween(prev: Readonly<PlayerState>, cur: Readonly<PlayerState>, params: Readonly<JumpParams>, spring: boolean): boolean {
  if (spring) return false;
  const pressed = cur.held === 1 && prev.held === 0;
  if (!pressed && prev.buffer === 0) return false;
  if (cur.buffer === 0 && (pressed ? params.jumpBuffer > 0 : prev.buffer > 1)) return true;
  return cur.vy < prev.vy && cur.vy < 0;
}

/**
 * Événements survenus entre deux états successifs d'un essai (`prev` → `cur`, un pas de `stepAttempt`). Pure : ne modifie rien.
 * `tick` et `source` sont recopiés dans chaque événement. Un « recommencer » n'est pas un pas : le jeu ne compare pas à travers lui.
 */
export function eventsBetween(
  prev: Readonly<AttemptState>,
  cur: Readonly<AttemptState>,
  level: Level,
  params: Readonly<JumpParams>,
  tick = 0,
  source: EventSource = "jeu",
  inputs?: Readonly<EventInputs>,
): GameEvent[] {
  const out: GameEvent[] = [];
  if (prev === cur) return out;
  const p = prev.player;
  const c = cur.player;
  const at = (s: Readonly<PlayerState>) => ({ tick, source, x: centerX(s), y: centerY(s) });

  // Lot 27 : la reprise volontaire au dernier point de passage (quatrième bit de la commande) : le personnage est reposé sur le point, comme après une mort — rien d'autre à comparer.
  if (inputs && isResume(level, prev, inputs.bits)) return [{ ...at(c), kind: "reapparition", checkpoint: true }];

  // Réapparition : depuis la mort, au départ (nouvel essai) ou sur un point de passage. Rien d'autre à comparer (le personnage a sauté).
  if (prev.status === ATTEMPT_DEAD) {
    if (cur.status !== ATTEMPT_DEAD) out.push({ ...at(c), kind: "reapparition", checkpoint: cur.status !== ATTEMPT_READY });
    // Lot 24 : la stalactite qui vient de tuer continue de tomber pendant l'attente de la reprise : elle se brise à l'écran.
    else out.push(...stalactiteEvents(level, prev, cur, tick, source));
    return out;
  }
  if (cur.status === ATTEMPT_READY || prev.status === ATTEMPT_FINISHED) return out; // le monde attend (ou la course est finie)

  const spring = cur.springCell >= 0 && (cur.springTime !== prev.springTime || cur.springCell !== prev.springCell);
  if (jumpedBetween(p, c, params, spring)) {
    const ground = p.ground === 1 || p.air <= params.coyote;
    if (ground) out.push({ ...at(c), kind: "saut", x: centerX(c), y: feetY(p) });
    else out.push({ ...at(c), kind: "sautMural", side: c.vx > 0 ? -1 : c.vx < 0 ? 1 : p.wallSide || 1 });
  }
  if (spring) {
    const col = cur.springCell % level.width;
    const row = (cur.springCell - col) / level.width;
    out.push({ tick, source, kind: "ressort", x: col + 0.5, y: row });
  }
  // Lot 23 : un champignon rebondit (rien pour un niveau sans champignon).
  const bounce = mushroomHit(level, p, c);
  if (bounce >= 0) {
    const m = level.mushrooms[bounce]!;
    const pad = mushroomPad(m);
    out.push({ tick, source, kind: "champignon", index: bounce, dir: m.dir, boost: c.held === 1, x: (pad.x + pad.w / 2) / T, y: (pad.y + pad.h / 2) / T });
  }
  out.push(...stalactiteEvents(level, prev, cur, tick, source));
  out.push(...bridgeEvents(level, prev, cur, tick, source));
  if (p.ground === 0 && c.ground === 1) {
    const fall = Math.max(0, p.vy);
    const intensity = Math.min(1, params.fallSpeed > 0 ? fall / params.fallSpeed : 0);
    out.push({ ...at(c), kind: "atterrissage", y: feetY(c), intensity });
  }
  if (p.ground === 1 && c.ground === 1 && c.vx !== 0) {
    const a = Math.floor((p.x + PLAYER_WIDTH / 2) / STRIDE);
    const b = Math.floor((c.x + PLAYER_WIDTH / 2) / STRIDE);
    if (a !== b) {
      const speed = (Math.abs(c.vx) * TICK_RATE) / T;
      out.push({ ...at(c), kind: "pas", y: feetY(c), speed, cadence: speed / STRIDE_TILES, full: Math.abs(c.vx) >= params.runSpeed * FULL_SPEED });
    }
  }
  const ends = cur.status === ATTEMPT_DEAD || cur.status === ATTEMPT_FINISHED;
  // Lot 11 : la surface sous les pieds, avant et après le pas (0 en l'air) ; la fin d'un essai ferme l'état.
  const under = (s: Readonly<PlayerState>): number => (s.ground === 1 ? groundTile(level, s.x, s.y) : 0);
  const before = under(p);
  const after = ends ? 0 : under(c);
  if (inputs && p.ground === 1 && c.ground === 1 && p.vx !== 0) {
    const moving = p.vx > 0 ? 1 : -1;
    const dir = dirOf(inputs.bits);
    if (dir === -moving && dirOf(inputs.prevBits) !== dir && Math.abs(p.vx) >= params.runSpeed * SKID_SPEED) {
      out.push({ ...at(c), kind: "derapage", y: feetY(c), side: moving, speed: (Math.abs(p.vx) * TICK_RATE) / T, ice: before === TILE_ICE && after === TILE_ICE });
    }
  }
  const beltBefore = beltSide(before);
  const beltAfter = beltSide(after);
  if (beltBefore !== beltAfter) {
    if (beltBefore !== 0) out.push({ ...at(c), kind: "tapisFin", y: feetY(p), side: beltBefore });
    if (beltAfter !== 0) out.push({ ...at(c), kind: "tapisDebut", y: feetY(c), side: beltAfter });
  }
  if ((before === TILE_ICE) !== (after === TILE_ICE)) out.push({ ...at(c), kind: before === TILE_ICE ? "glaceFin" : "glaceDebut", y: feetY(before === TILE_ICE ? p : c) });
  if (before === TILE_ICE && after === TILE_ICE && Math.abs(p.vx) >= params.runSpeed * ICE_BRAKE_SPEED && Math.abs(c.vx) < Math.abs(p.vx)) {
    const a = Math.floor((p.x + PLAYER_WIDTH / 2) / ICE_STRIDE);
    const b = Math.floor((c.x + PLAYER_WIDTH / 2) / ICE_STRIDE);
    if (a !== b) out.push({ ...at(c), kind: "glaceFrein", y: feetY(c), side: p.vx > 0 ? 1 : -1, speed: (Math.abs(p.vx) * TICK_RATE) / T });
  }
  if (p.slide === 0 && c.slide !== 0 && !ends) out.push({ ...at(c), kind: "glisseDebut", side: c.slide });
  else if (p.slide !== 0 && (c.slide === 0 || ends)) out.push({ ...at(c), kind: "glisseFin" });

  if (cur.crumbles !== prev.crumbles) {
    for (let i = 0; i < cur.crumbles.length; i++) {
      const a = prev.crumbles[i]!;
      const b = cur.crumbles[i]!;
      if (a === b) continue;
      const cell = level.crumbles[i]!;
      if (a === CRUMBLE_INTACT && b > 0) out.push({ tick, source, kind: "friableCraque", index: i, x: cell.col + 0.5, y: cell.row + 0.5 });
      else if (b === CRUMBLE_GONE && a !== CRUMBLE_GONE) out.push({ tick, source, kind: "friableTombe", index: i, x: cell.col + 0.5, y: cell.row + 0.5 });
    }
  }
  // Lot 12 : blocs clignotants et alternés (rien pour un niveau sans eux).
  if (level.blinks.length > 0 || level.alts.length > 0) out.push(...blockEvents(prev, cur, level, tick, source, at(c)));
  // Lot 13 : courants d'air (rien pour un niveau sans vent).
  if (level.winds.length > 0) out.push(...windEvents(prev, cur, level, tick, source, at(c)));
  if (cur.status === ATTEMPT_DEAD) {
    out.push({ tick, source, kind: "mort", cause: causeName(cur.deathCause), x: cur.deathX / T, y: cur.deathY / T });
  } else if (cur.status === ATTEMPT_FINISHED) {
    out.push({ ...at(c), kind: "arrivee" });
  } else if (cur.checkpoint !== prev.checkpoint && cur.checkpoint >= 0) {
    const cell = level.checkpoints[cur.checkpoint]!;
    out.push({ tick, source, kind: "pointDePassage", index: cur.checkpoint, x: cell.col + 0.5, y: cell.row + 1 });
  }
  return out;
}

// ——— Le carnage : seulement les morts et les arrivées des autres vies, avec un débit plafonné ———

/** Fenêtre du débit (pas : 100 ms). */
export const CARNAGE_WINDOW_TICKS = 12;
/** Au plus ce nombre d'événements d'autres vies par fenêtre (les suivants sont écartés). */
export const CARNAGE_EVENTS_PER_WINDOW = 6;

/** Filtre des événements des vies du carnage : seulement `mort` et `arrivee`, au plus `max` par fenêtre de `window` pas. */
export class CarnageFilter {
  private start = -Infinity;
  private count = 0;
  /** Écartés depuis le départ (mesure). */
  dropped = 0;

  constructor(
    readonly max = CARNAGE_EVENTS_PER_WINDOW,
    readonly window = CARNAGE_WINDOW_TICKS,
  ) {}

  /** Garde-t-on cet événement d'une autre vie ? */
  admit(e: GameEvent): boolean {
    if (e.kind !== "mort" && e.kind !== "arrivee") return false;
    if (e.tick >= this.start + this.window) {
      this.start = e.tick;
      this.count = 0;
    }
    if (this.count >= this.max) {
      this.dropped++;
      return false;
    }
    this.count++;
    return true;
  }

  reset(): void {
    this.start = -Infinity;
    this.count = 0;
    this.dropped = 0;
  }
}

/** Les derniers événements (`?debug` : `__jump.events`). */
export class EventLog {
  private readonly items: GameEvent[] = [];
  total = 0;
  constructor(readonly size = 200) {}
  push(e: GameEvent): void {
    this.items.push(e);
    this.total++;
    if (this.items.length > this.size) this.items.shift();
  }
  list(): GameEvent[] {
    return this.items.map((e) => ({ ...e }));
  }
  clear(): void {
    this.items.length = 0;
  }
}
