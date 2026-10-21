import { RESPAWN_TICKS } from "./attempt";
import { SINGLE_CLOCK_VERSION } from "./constants";
import { tileOf } from "./collide";
import { idiv } from "./idiv";
import type { Level } from "./level";
import { PLAYER_WIDTH } from "./player";
import { JumpReplayError, replayAttempt, type JumpReplay, type LifeEnd, type ReplayStart } from "./replay";

// Lot P3 de la plateforme : **la validation d'une vie envoyée par un joueur** (aide pure, la même pour le serveur et pour le jeu). Une vie est
// une rediffusion partie du départ ou d'un point de passage (lot 3) : son en-tête porte l'état du niveau à cet instant (point, chrono, début de
// chaque section en marche). Le serveur ne croit ni cet en-tête ni la fin annoncée : il vérifie que l'en-tête est **atteignable** dans ce
// niveau, puis **rejoue** la vie ; seule la fin rejouée compte (mort, arrivée ou abandon), avec la position et la cause calculées par la
// simulation.
//
// En-tête atteignable (`lifeStartProblem`) :
//   - départ `S` : chrono 0, aucune section, jamais lancé (l'élan n'existe que pour un morceau joué seul) ;
//   - point de passage : il existe ; une section par section du niveau ; les sections du point et d'après sont à l'arrêt (la reprise les remet
//     à zéro) ; celles d'avant que le personnage a dû traverser pour atteindre le point (entre le départ et le point) sont en marche, mises en
//     marche dans l'ordre du parcours (de gauche à droite) ; le chrono laisse au moins la mort et l'attente de la reprise après la dernière.
// Lot 15, niveau en version 4 (une seule horloge) : aucune section dans l'en-tête ; départ `S` : chrono 0 (la première vie), ou une reprise au
// départ après une mort sans point de passage (chrono d'au moins la mort et l'attente) ; point de passage : il existe, et le même chrono minimal.
// Une vie s'arrête à sa fin : rien après sa mort (pas d'attente ni de vie suivante dans la même rediffusion).
// Aucune version ne change : cette aide ne fait que lire `replayAttempt` et l'en-tête.

/** Ce que le rejeu d'une vie a donné. */
export interface LifeCheck {
  /** Fin rejouée : `mort`, `arrivée` ou `abandon` (la vie s'arrête avant l'un ou l'autre). */
  end: LifeEnd;
  /** Pas rejoués. */
  ticks: number;
  /** Chrono de l'essai au départ de la vie (pas). */
  startTime: number;
  /** La mort rejouée (cause `DEATH_*`, centre du personnage en unités), `null` sans mort. */
  death: { cause: number; x: number; y: number } | null;
  /** Section où la vie finit (`sectionAt` de sa mort, ou de sa dernière position). */
  section: number;
}

/**
 * La section d'une position (unités) : celle qui contient sa colonne, sinon la dernière qui commence avant elle (un palier appartient à la
 * section qui le précède), sinon la première. 0 dans un niveau sans section.
 */
export function sectionAt(level: Level, x: number): number {
  const col = tileOf(x);
  let found = -1;
  for (let i = 0; i < level.sections.length; i++) {
    const s = level.sections[i]!;
    if (col >= s.c0 && col <= s.c1) return i;
    if (s.c0 <= col && (found < 0 || s.c0 > level.sections[found]!.c0)) found = i;
  }
  return found < 0 ? 0 : found;
}

/** Ce qui ne va pas dans l'en-tête d'une vie pour ce niveau, ou `null` s'il est atteignable. */
export function lifeStartProblem(level: Level, start: ReplayStart): string | null {
  if (start.elan) return "Une vie ne part jamais lancée";
  if (level.simVersion >= SINGLE_CLOCK_VERSION) {
    if (start.sections.length !== 0) return "Un niveau à une seule horloge n'a pas de sections dans l'en-tête";
    if (start.checkpoint >= 0 && !level.checkpoints[start.checkpoint]) return `Point de passage ${start.checkpoint} absent de ce niveau`;
    if ((start.checkpoint >= 0 || start.time !== 0) && start.time < RESPAWN_TICKS + 1) return "Chrono trop court pour une reprise";
    return null;
  }
  if (start.checkpoint < 0) {
    if (start.time !== 0 || start.sections.length !== 0) return "Une vie partie du départ commence à zéro, sections à l'arrêt";
    return null;
  }
  const cp = level.checkpoints[start.checkpoint];
  if (!cp) return `Point de passage ${start.checkpoint} absent de ce niveau`;
  if (start.sections.length !== level.sections.length) return "Nombre de sections différent de celui du niveau";
  const from = level.start.col;
  // Les sections traversées pour aller du départ au point, rangées de gauche à droite : en marche, dans l'ordre du parcours.
  const crossed: { c0: number; at: number }[] = [];
  for (let i = 0; i < level.sections.length; i++) {
    const s = level.sections[i]!;
    const at = start.sections[i]!;
    if (!Number.isInteger(at) || at < -1 || at > start.time) return "Section mise en marche hors du chrono";
    if (s.c1 >= cp.col) {
      if (at !== -1) return "Une section du point de passage ou d'après est en marche à la reprise";
      continue;
    }
    if (s.c1 >= from) {
      if (at < 1) return "Une section entre le départ et le point de passage n'a pas été traversée";
      crossed.push({ c0: s.c0, at });
    } else if (at === 0) return "Section mise en marche avant le premier pas";
  }
  crossed.sort((a, b) => a.c0 - b.c0);
  let last = 0;
  for (const c of crossed) {
    if (c.at < last) return "Sections mises en marche dans le désordre";
    last = c.at;
  }
  if (start.time < last + RESPAWN_TICKS + 1) return "Chrono trop court pour une reprise sur ce point";
  return null;
}

/**
 * Vérifie et rejoue une vie : en-tête atteignable, ce niveau (`levelId`), cette version, une seule vie qui s'arrête à sa fin. Rend sa fin
 * rejouée, ou la raison du refus (`JumpReplayError` de `replayAttempt` comprise : `version`, `level`, `length`, `format`).
 */
export function checkLife(level: Level, replay: JumpReplay, levelId: string): { ok: true; life: LifeCheck } | { ok: false; reason: string; code: string } {
  const problem = lifeStartProblem(level, replay.start);
  if (problem) return { ok: false, reason: problem, code: "start" };
  let result;
  try {
    result = replayAttempt(level, replay, levelId);
  } catch (e) {
    if (e instanceof JumpReplayError) return { ok: false, reason: e.message, code: e.code };
    throw e;
  }
  const life = result.lives[0];
  if (!life || result.lives.length !== 1 || life.ticks !== result.ticks) return { ok: false, reason: "Une vie s'arrête à sa fin (une seule vie, rien après)", code: "format" };
  const x = life.death ? life.death.x : result.final.player.x + idiv(PLAYER_WIDTH, 2);
  return { ok: true, life: { end: life.end, ticks: life.ticks, startTime: replay.start.time, death: life.death, section: sectionAt(level, x) } };
}
