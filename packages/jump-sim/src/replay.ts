import { CodecError, fromBase64Url, pushVarint, readVarint, toBase64Url } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  checkpointAttempt,
  initialAttempt,
  respawnAttempt,
  stepAttempt,
  type AttemptState,
} from "./attempt";
import { JUMP_SIM_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, TICK_RATE } from "./constants";
import { idiv } from "./idiv";
import type { Level } from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_MASK } from "./player";

// Rediffusions (lot 3). Un **essai** (du départ à l'arrivée, à une mort sans point de passage, ou à « recommencer ») est entièrement décrit
// par les commandes du joueur, 3 bits par pas, rangées en séries `{ count, bits }`. Les reprises aux points de passage ne sont pas
// enregistrées : la simulation les refait d'elle-même. Une **vie** (un tronçon d'essai entre deux réapparitions) est une rediffusion du même
// format dont le départ est un point de passage : son en-tête porte l'état d'où elle repart (point, chrono, sections en marche), de quoi la
// rejouer seule, exactement comme elle a été vécue.
//
// **Le rejeu est la seule source de vérité** : `replayAttempt` rejoue avec la même simulation et rend ce qu'elle a recalculé (arrivée, temps,
// morts, vies). Un temps affiché ou annoncé ne compte jamais.
//
// Octets (puis base64url, `@cdj/core`) :
//   FORMAT · version de la sim (varint) · longueur de l'identifiant du niveau · identifiant (ASCII)
//   drapeaux : bit 0 = saut tenu au départ, bit 1 = départ sur un point de passage, bit 2 = départ lancé (lot 4 : au départ `S`, au sol,
//              à pleine vitesse vers la droite ; l'entrée « élan » des morceaux)
//              bit 3 = reprise **au départ** (lot 15, v4 : après une mort sans point de passage, chrono qui continue)
//   [point de passage] : indice du point (varint) · chrono au départ (varint) · nombre de sections (varint) · par section : début + 1 (varint, 0 = à l'arrêt)
//   [reprise au départ] : chrono au départ (varint)
//   séries : varint(count × 8 + bits), count ≥ 1
// Une série de moins de 16 pas tient dans un octet ; un essai de 25 s tient dans quelques centaines d'octets.
//
// L'essai commence au **premier pas commandé** (v3 : le monde attend le joueur, les pas d'attente au départ ne changent que l'état du bouton
// de saut, gardé dans le drapeau du départ ; v4, lot 15 : au premier pas, à heure fixe). Le chrono de l'essai vaut donc toujours le nombre de
// pas rejoués, morts et reprises comprises.
//
// **Version** (lot 15) : une rediffusion porte la version de la simulation **de son niveau** (`Level.simVersion`) : 3 sur un niveau d'essai, un
// morceau ou un jour figé en v3, 4 sur un niveau du jour g10. Elle ne se rejoue que sur un niveau de cette version : les rediffusions v3 se
// vérifient toujours à l'identique (mêmes octets, mêmes états), une rediffusion d'une version inconnue est refusée (`version`).

/** Version du format d'octets (distincte de `JUMP_SIM_VERSION` : un format peut porter plusieurs versions de la sim). */
export const JUMP_REPLAY_FORMAT = 1;

/** Plus longue rediffusion acceptée : 10 minutes de jeu. Au-delà, l'enregistrement abandonne l'essai, le décodage refuse le texte. */
export const MAX_ATTEMPT_TICKS = TICK_RATE * 600;

/** Identifiant d'un niveau : le nom du scénario (`essai`), un morceau (`module:cheminee:1`, lot 4), la date plus tard (`jour-2026-10-14-g1`). */
export const LEVEL_ID_PATTERN = /^[a-z0-9_:-]{1,40}$/;

const MAX_SECTIONS = 256;
const MAX_CHECKPOINTS = 4096;
const FLAG_HELD = 1;
const FLAG_CHECKPOINT = 2;
const FLAG_ELAN = 4;
const FLAG_RESPAWN = 8;

/** Une série : `count` pas consécutifs avec les mêmes 3 bits de commande. */
export interface InputRun {
  count: number;
  bits: number;
}

/** D'où part une rediffusion. */
export interface ReplayStart {
  /** −1 : le départ `S` (un essai, ou la première vie d'un essai) ; sinon l'indice du point de passage (vie suivante). */
  checkpoint: number;
  /** Bouton de saut tenu au départ (0 ou 1) : un saut tenu depuis l'essai précédent ne fait pas sauter. */
  held: number;
  /** Chrono de l'essai au départ, en pas (0 au départ `S`, sauf une reprise au départ en v4). */
  time: number;
  /** Début de chaque section, en pas du chrono (−1 à l'arrêt) ; vide au départ `S` (toutes à l'arrêt). */
  sections: readonly number[];
  /**
   * 1 : départ **lancé** (lot 4, entrée « élan » d'un morceau) : au départ `S`, au sol, à la vitesse de course (`runSpeed` des réglages par
   * défaut) vers la droite ; 0 : à l'arrêt. Jamais sur un point de passage.
   */
  elan: number;
}

export interface JumpReplay {
  simVersion: number;
  levelId: string;
  start: ReplayStart;
  runs: InputRun[];
}

export type ReplayErrorCode = "format" | "version" | "length" | "level";

/** Rediffusion refusée. `code` : `format` (illisible, mal formée), `version` (autre `JUMP_SIM_VERSION` : à ignorer), `length` (trop longue), `level` (autre niveau). */
export class JumpReplayError extends Error {
  constructor(
    readonly code: ReplayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JumpReplayError";
  }
}

/** Départ `S`, bouton relâché. */
export const START_AT_SPAWN: ReplayStart = Object.freeze({ checkpoint: -1, held: 0, time: 0, sections: Object.freeze([]) as readonly number[], elan: 0 });

/** Nombre de pas d'une suite de séries. */
export function runsTicks(runs: readonly InputRun[]): number {
  let n = 0;
  for (const r of runs) n += r.count;
  return n;
}

/** Commandes, une par pas → séries. */
export function toRuns(inputs: readonly number[]): InputRun[] {
  const runs: InputRun[] = [];
  for (const bits of inputs) {
    const last = runs[runs.length - 1];
    if (last && last.bits === bits) last.count++;
    else runs.push({ count: 1, bits });
  }
  return runs;
}

/** Séries → commandes, une par pas. */
export function fromRuns(runs: readonly InputRun[]): number[] {
  const out: number[] = [];
  for (const r of runs) for (let i = 0; i < r.count; i++) out.push(r.bits);
  return out;
}

/**
 * Une rediffusion d'essai (départ `S`, à l'arrêt ou lancé : `elan` = 1) d'un niveau de la version `simVersion` (lot 15 : celle du niveau ; 3
 * par défaut, celle des niveaux d'essai et des morceaux joués seuls).
 */
export function attemptReplay(levelId: string, inputs: readonly number[], held = 0, elan = 0, simVersion = SECTION_CLOCK_VERSION): JumpReplay {
  return { simVersion, levelId, start: { ...START_AT_SPAWN, held, elan: elan ? 1 : 0 }, runs: toRuns(inputs) };
}

// ——— Octets ———

function checkLevelId(id: string): void {
  if (!LEVEL_ID_PATTERN.test(id)) throw new JumpReplayError("format", `Identifiant de niveau invalide : « ${id} »`);
}

/** Rediffusion → texte base64url. */
export function encodeReplay(replay: JumpReplay): string {
  checkLevelId(replay.levelId);
  const s = replay.start;
  const bytes: number[] = [JUMP_REPLAY_FORMAT];
  pushVarint(bytes, replay.simVersion);
  bytes.push(replay.levelId.length);
  for (let i = 0; i < replay.levelId.length; i++) bytes.push(replay.levelId.charCodeAt(i));
  const atCheckpoint = s.checkpoint >= 0;
  const respawn = !atCheckpoint && s.time > 0;
  if ((atCheckpoint || respawn) && s.elan) throw new JumpReplayError("format", "Départ lancé sur un point de passage");
  bytes.push((s.held ? FLAG_HELD : 0) | (atCheckpoint ? FLAG_CHECKPOINT : 0) | (s.elan ? FLAG_ELAN : 0) | (respawn ? FLAG_RESPAWN : 0));
  if (atCheckpoint) {
    pushVarint(bytes, s.checkpoint);
    pushVarint(bytes, s.time);
    pushVarint(bytes, s.sections.length);
    for (const v of s.sections) pushVarint(bytes, v + 1);
  }
  if (respawn) pushVarint(bytes, s.time);
  let total = 0;
  for (const r of replay.runs) {
    if (!Number.isInteger(r.count) || r.count < 1) throw new JumpReplayError("format", "Série vide");
    if (!Number.isInteger(r.bits) || r.bits < 0 || r.bits > INPUT_MASK) throw new JumpReplayError("format", `Commande invalide : ${r.bits}`);
    total += r.count;
    if (total > MAX_ATTEMPT_TICKS) throw new JumpReplayError("length", `Rediffusion trop longue (plus de ${MAX_ATTEMPT_TICKS} pas)`);
    pushVarint(bytes, r.count * 8 + r.bits);
  }
  return toBase64Url(bytes);
}

/** Texte base64url → rediffusion. Refuse tout ce qui est mal formé ou trop long (le texte peut venir du stockage ou du réseau). */
export function decodeReplay(code: string): JumpReplay {
  if (typeof code !== "string" || code.length === 0) throw new JumpReplayError("format", "Rediffusion vide");
  let bytes: number[];
  try {
    bytes = fromBase64Url(code);
  } catch (e) {
    if (e instanceof CodecError) throw new JumpReplayError("format", `Rediffusion illisible (${e.message})`);
    throw e;
  }
  let pos = 0;
  const byte = (): number => {
    const b = bytes[pos++];
    if (b === undefined) throw new JumpReplayError("format", "Rediffusion tronquée");
    return b;
  };
  const varint = (what: string): number => {
    try {
      return readVarint(byte);
    } catch (e) {
      if (e instanceof CodecError) throw new JumpReplayError("format", `${what} : entier trop long`);
      throw e;
    }
  };
  const format = byte();
  if (format !== JUMP_REPLAY_FORMAT) throw new JumpReplayError("format", `Format de rediffusion inconnu (${format})`);
  const simVersion = varint("Version");
  const idLen = byte();
  let levelId = "";
  for (let i = 0; i < idLen; i++) levelId += String.fromCharCode(byte());
  checkLevelId(levelId);
  const flags = byte();
  if (flags & ~(FLAG_HELD | FLAG_CHECKPOINT | FLAG_ELAN | FLAG_RESPAWN)) throw new JumpReplayError("format", "Drapeaux de départ inconnus");
  if (flags & (FLAG_CHECKPOINT | FLAG_RESPAWN) && flags & FLAG_ELAN) throw new JumpReplayError("format", "Départ lancé sur un point de passage");
  if (flags & FLAG_CHECKPOINT && flags & FLAG_RESPAWN) throw new JumpReplayError("format", "Départ à la fois sur un point et au départ");
  const start: ReplayStart = { checkpoint: -1, held: flags & FLAG_HELD ? 1 : 0, time: 0, sections: [], elan: flags & FLAG_ELAN ? 1 : 0 };
  if (flags & FLAG_CHECKPOINT) {
    const checkpoint = varint("Point de passage");
    const time = varint("Chrono");
    const n = varint("Sections");
    if (checkpoint >= MAX_CHECKPOINTS) throw new JumpReplayError("format", "Point de passage hors limites");
    if (time > MAX_ATTEMPT_TICKS) throw new JumpReplayError("length", "Chrono de départ trop long");
    if (n > MAX_SECTIONS) throw new JumpReplayError("format", "Trop de sections");
    const sections: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = varint("Section") - 1;
      if (v > time) throw new JumpReplayError("format", "Section mise en marche après le départ");
      sections.push(v);
    }
    start.checkpoint = checkpoint;
    start.time = time;
    start.sections = sections;
  }
  if (flags & FLAG_RESPAWN) {
    const time = varint("Chrono");
    if (time < 1) throw new JumpReplayError("format", "Reprise au départ sans chrono");
    if (time > MAX_ATTEMPT_TICKS) throw new JumpReplayError("length", "Chrono de départ trop long");
    start.time = time;
  }
  const runs: InputRun[] = [];
  let total = 0;
  while (pos < bytes.length) {
    const v = varint("Série");
    const bits = v % 8;
    const count = idiv(v - bits, 8);
    if (count < 1) throw new JumpReplayError("format", "Série vide");
    total += count;
    if (total > MAX_ATTEMPT_TICKS) throw new JumpReplayError("length", `Rediffusion trop longue (plus de ${MAX_ATTEMPT_TICKS} pas)`);
    runs.push({ count, bits });
  }
  return { simVersion, levelId, start, runs };
}

// ——— Rejeu ———

/** L'état d'où repart une rediffusion. */
export function replayStartState(level: Level, start: ReplayStart): AttemptState {
  if (start.checkpoint < 0 && start.time > 0) {
    // Lot 15 : une reprise au départ (v4 seulement : en v3 une mort sans point termine l'essai).
    if (level.simVersion < SINGLE_CLOCK_VERSION) throw new JumpReplayError("level", "Reprise au départ dans un niveau de version 3");
    if (start.elan || start.sections.length !== 0) throw new JumpReplayError("format", "Reprise au départ lancée ou avec des sections");
    const s = respawnAttempt(level, { ...initialAttempt(level), time: start.time });
    return start.held ? { ...s, player: { ...s.player, held: 1 } } : s;
  }
  if (start.checkpoint < 0) {
    const s = initialAttempt(level);
    if (!start.held && !start.elan) return s;
    return { ...s, player: { ...s.player, held: start.held ? 1 : 0, vx: start.elan ? DEFAULT_JUMP_PARAMS.runSpeed : 0 } };
  }
  if (start.elan) throw new JumpReplayError("format", "Départ lancé sur un point de passage");
  if (start.checkpoint >= level.checkpoints.length) throw new JumpReplayError("level", `Point de passage ${start.checkpoint} absent de ce niveau`);
  // v4 (lot 15) : aucune section dans l'état (une seule horloge).
  const sectionCount = level.simVersion >= SINGLE_CLOCK_VERSION ? 0 : level.sections.length;
  if (start.sections.length !== sectionCount) throw new JumpReplayError("level", "Nombre de sections différent de celui du niveau");
  const s = checkpointAttempt(level, { ...initialAttempt(level), checkpoint: start.checkpoint, time: start.time, sections: start.sections });
  return start.held ? { ...s, player: { ...s.player, held: 1 } } : s;
}

/** Le départ d'une vie, lu dans l'état de la réapparition. */
function startOf(s: Readonly<AttemptState>): ReplayStart {
  return { checkpoint: s.checkpoint, held: s.player.held, time: s.time, sections: [...s.sections], elan: 0 };
}

export type LifeEnd = "mort" | "arrivée" | "abandon";

export interface ReplayDeath {
  /** Pas de la rediffusion où la mort survient (1 = premier pas) et chrono à cet instant. */
  tick: number;
  time: number;
  /** Cause (`DEATH_*`) et centre du personnage, unités. */
  cause: number;
  x: number;
  y: number;
  /** Vie qui s'achève (indice dans `lives`). */
  life: number;
}

export interface ReplayLife {
  index: number;
  /** D'où elle part (départ ou point de passage, avec l'état du niveau à cet instant). */
  start: ReplayStart;
  /** Pas de la rediffusion déjà joués quand elle commence. */
  startTick: number;
  /** Ses commandes (la vie seule, sans l'attente qui suit une mort). */
  runs: InputRun[];
  ticks: number;
  end: LifeEnd;
  /** Sa mort (`end === "mort"`), sinon null. */
  death: { cause: number; x: number; y: number } | null;
}

/** Ce que la simulation recalcule d'une rediffusion. */
export interface AttemptResult {
  finished: boolean;
  /** Pas rejoués. */
  ticks: number;
  /** Chrono à la fin, en pas (le temps de l'essai s'il est arrivé). */
  time: number;
  deaths: ReplayDeath[];
  lives: ReplayLife[];
  final: AttemptState;
}

/** Vérifie la version et le niveau ; rend l'état de départ. */
function prepare(level: Level, replay: JumpReplay, levelId?: string): AttemptState {
  // Lot 15 : la version de la rediffusion est celle de son niveau (3 ou 4), jamais une version que ce code ne connaît pas.
  if (replay.simVersion !== level.simVersion || replay.simVersion > JUMP_SIM_VERSION) {
    throw new JumpReplayError("version", `Rediffusion d'une autre version de la simulation (${replay.simVersion}, niveau en v${level.simVersion})`);
  }
  if (levelId !== undefined && replay.levelId !== levelId) throw new JumpReplayError("level", `Rediffusion d'un autre niveau (« ${replay.levelId} »)`);
  if (runsTicks(replay.runs) > MAX_ATTEMPT_TICKS) throw new JumpReplayError("length", `Rediffusion trop longue (plus de ${MAX_ATTEMPT_TICKS} pas)`);
  return replayStartState(level, replay.start);
}

/** L'essai (ou la vie) est-il fini à cet état ? Arrivée, ou mort sans point de passage pour reprendre (v3 ; en v4 on reprend au départ). */
function ended(before: Readonly<AttemptState>, after: Readonly<AttemptState>, simVersion: number): boolean {
  if (after.status === ATTEMPT_FINISHED) return true;
  return simVersion < SINGLE_CLOCK_VERSION && after.status === ATTEMPT_DEAD && before.status !== ATTEMPT_DEAD && after.checkpoint < 0;
}

/**
 * Rejoue une rediffusion avec la simulation (réglages par défaut : une partie aux réglages modifiés n'est jamais enregistrée) et rend ce
 * qu'elle a recalculé : arrivée, temps, morts (cause, position), et le découpage en **vies**. Refus : autre version (`version`), autre
 * niveau si `levelId` est donné (`level`), trop longue (`length`), ou des pas après la fin de l'essai (`format`).
 */
export function replayAttempt(level: Level, replay: JumpReplay, levelId?: string): AttemptResult {
  let s = prepare(level, replay, levelId);
  const deaths: ReplayDeath[] = [];
  const lives: ReplayLife[] = [];
  let open: { start: ReplayStart; startTick: number; runs: InputRun[]; ticks: number } | null = { start: { ...replay.start, sections: [...replay.start.sections] }, startTick: 0, runs: [], ticks: 0 };
  let tick = 0;
  let over = false;
  for (const run of replay.runs) {
    for (let k = 0; k < run.count; k++) {
      if (over) throw new JumpReplayError("format", `Pas après la fin de l'essai (pas ${tick + 1})`);
      const before = s;
      s = stepAttempt(before, run.bits, level, DEFAULT_JUMP_PARAMS);
      tick++;
      if (open) {
        const last = open.runs[open.runs.length - 1];
        if (last && last.bits === run.bits) last.count++;
        else open.runs.push({ count: 1, bits: run.bits });
        open.ticks++;
      }
      if (s.status === ATTEMPT_DEAD && before.status !== ATTEMPT_DEAD) {
        const death = { cause: s.deathCause, x: s.deathX, y: s.deathY };
        deaths.push({ tick, time: s.time, ...death, life: lives.length });
        if (open) lives.push({ index: lives.length, ...open, end: "mort", death });
        open = null;
      } else if (s.status === ATTEMPT_RUNNING && before.status === ATTEMPT_DEAD) {
        open = { start: startOf(s), startTick: tick, runs: [], ticks: 0 };
      } else if (s.status === ATTEMPT_FINISHED && before.status !== ATTEMPT_FINISHED && open) {
        lives.push({ index: lives.length, ...open, end: "arrivée", death: null });
        open = null;
      }
      if (ended(before, s, level.simVersion)) over = true;
    }
  }
  if (open && open.ticks > 0) lives.push({ index: lives.length, ...open, end: "abandon", death: null });
  return { finished: s.status === ATTEMPT_FINISHED, ticks: tick, time: s.time, deaths, lives, final: s };
}

/** La rediffusion d'une vie seule (même version, même niveau), rejouable par `replayAttempt` et `ReplayRunner`. */
export function lifeReplay(replay: JumpReplay, life: ReplayLife): JumpReplay {
  return { simVersion: replay.simVersion, levelId: replay.levelId, start: life.start, runs: life.runs.map((r) => ({ ...r })) };
}

/**
 * Rejeu pas à pas (fantôme, carnage, lecture) : même simulation que `replayAttempt`, un pas à la fois. Une fois la rediffusion épuisée,
 * l'état ne bouge plus (`done`).
 */
export class ReplayRunner {
  state: AttemptState;
  prev: AttemptState;
  /** Pas joués. */
  tick = 0;
  readonly total: number;
  private run = 0;
  private left: number;

  constructor(
    readonly level: Level,
    readonly replay: JumpReplay,
  ) {
    this.state = prepare(level, replay);
    this.prev = this.state;
    this.total = runsTicks(replay.runs);
    this.left = replay.runs[0]?.count ?? 0;
  }

  get done(): boolean {
    return this.tick >= this.total;
  }

  /** Commande du pas suivant (0 une fois épuisée). */
  private next(): number {
    const r = this.replay.runs[this.run];
    if (!r) return 0;
    this.left--;
    if (this.left === 0) {
      this.run++;
      this.left = this.replay.runs[this.run]?.count ?? 0;
    }
    return r.bits;
  }

  /** Un pas ; rend faux si la rediffusion est épuisée (rien n'a bougé). */
  step(): boolean {
    if (this.done) {
      this.prev = this.state;
      return false;
    }
    this.prev = this.state;
    this.state = stepAttempt(this.state, this.next(), this.level, DEFAULT_JUMP_PARAMS);
    this.tick++;
    return true;
  }
}

// ——— Enregistrement ———

/** Un essai que l'enregistreur vient de clore. */
export interface RecordedAttempt {
  replay: JumpReplay;
  /** Arrivée, mort sans point de passage, ou abandon (« recommencer », page quittée). */
  end: LifeEnd;
}

/**
 * Enregistre les essais d'une session, pas après pas : à appeler après chaque pas avec l'état d'avant, la commande et l'état d'après.
 * Un essai commence au premier pas commandé (l'état du bouton de saut à cet instant va dans l'en-tête), comprend les morts et les attentes
 * suivies d'une reprise sur un point de passage, et se clôt à l'arrivée, à une mort sans point de passage (la mort est le dernier pas) ou
 * par `abandon()`. Un essai qui dépasse `MAX_ATTEMPT_TICKS` est abandonné sans être rendu (rien n'est gardé de lui).
 */
export class AttemptRecorder {
  private inputs: InputRun[] = [];
  private count = 0;
  private held = 0;
  private active = false;
  private skipping = false;

  /** `simVersion` : celle du niveau enregistré (lot 15 ; 3 par défaut : niveaux d'essai et morceaux). */
  constructor(
    readonly levelId: string,
    readonly simVersion = SECTION_CLOCK_VERSION,
  ) {
    checkLevelId(levelId);
  }

  /** Un essai est-il en cours d'enregistrement ? */
  get recording(): boolean {
    return this.active;
  }

  /** Pas enregistrés dans l'essai en cours. */
  get ticks(): number {
    return this.count;
  }

  step(before: Readonly<AttemptState>, input: number, after: Readonly<AttemptState>): RecordedAttempt | null {
    if (this.skipping) {
      if (after.status !== ATTEMPT_READY) return null;
      this.skipping = false;
    }
    if (!this.active) {
      if (before.status !== ATTEMPT_READY || after.status === ATTEMPT_READY) return null;
      this.active = true;
      this.inputs = [];
      this.count = 0;
      this.held = before.player.held;
    }
    if (this.count >= MAX_ATTEMPT_TICKS) {
      this.active = false;
      this.skipping = true;
      this.inputs = [];
      this.count = 0;
      return null;
    }
    const last = this.inputs[this.inputs.length - 1];
    if (last && last.bits === input) last.count++;
    else this.inputs.push({ count: 1, bits: input });
    this.count++;
    if (after.status === ATTEMPT_FINISHED) return this.close("arrivée");
    if (ended(before, after, this.simVersion)) return this.close("mort");
    return null;
  }

  /** « Recommencer » (ou la page qu'on quitte) : clôt l'essai en cours, s'il a commencé. */
  abandon(): RecordedAttempt | null {
    this.skipping = false;
    if (!this.active || this.count === 0) {
      this.active = false;
      return null;
    }
    return this.close("abandon");
  }

  /** L'essai en cours tel qu'il est (sans le clore) : de quoi le garder si la page se ferme. */
  peek(): JumpReplay | null {
    if (!this.active || this.count === 0) return null;
    return this.replayOf();
  }

  private replayOf(): JumpReplay {
    return { simVersion: this.simVersion, levelId: this.levelId, start: { ...START_AT_SPAWN, held: this.held }, runs: this.inputs.map((r) => ({ ...r })) };
  }

  private close(end: LifeEnd): RecordedAttempt {
    const replay = this.replayOf();
    this.active = false;
    this.inputs = [];
    this.count = 0;
    return { replay, end };
  }
}

// ——— Empreinte (déterminisme entre moteurs) ———

function fnv(h: number, v: number): number {
  return Math.imul(h ^ (v | 0), 16777619) >>> 0;
}

/**
 * Empreinte FNV-1a de **tous les états** d'un rejeu (personnage, statut, chrono, mort, point de passage, friables, sections), plus le
 * résumé : Node et chaque navigateur doivent trouver la même, au bit près (`apps/jump/verify.html`).
 */
export function replayFingerprint(level: Level, replay: JumpReplay): { hash: string; finished: boolean; ticks: number; time: number; deaths: number } {
  const runner = new ReplayRunner(level, replay);
  let h = 2166136261;
  let deaths = 0;
  while (runner.step()) {
    const s = runner.state;
    const p = s.player;
    for (const v of [p.x, p.y, p.vx, p.vy, p.ground, p.air, p.wallSide, p.wallAir, p.slide, p.buffer, p.held, p.jumping, p.lock, p.lockDir]) h = fnv(h, v);
    for (const v of [s.status, s.time, s.deathCause, s.deathX, s.deathY, s.deathTicks, s.springCell, s.springTime, s.checkpoint]) h = fnv(h, v);
    for (const v of s.crumbles) h = fnv(h, v);
    for (const v of s.sections) h = fnv(h, v);
    if (s.status === ATTEMPT_DEAD && runner.prev.status !== ATTEMPT_DEAD) deaths++;
  }
  return { hash: h.toString(16).padStart(8, "0"), finished: runner.state.status === ATTEMPT_FINISHED, ticks: runner.tick, time: runner.state.time, deaths };
}
