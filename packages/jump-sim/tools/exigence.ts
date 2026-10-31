import { Rng, mixSeed } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_RUNNING,
  DEFAULT_JUMP_PARAMS,
  GIGUE_DRAWS,
  INPUT_JUMP,
  INPUT_RIGHT,
  HOLD_VARIATION,
  PLAYER_WIDTH,
  RELEASE_MIN,
  RACCORD_POSITIONS,
  RACCORD_TAIL,
  UNITS_PER_TILE,
  centerCol,
  isCleanRun,
  moduleSpan,
  moduleStart,
  stepAttempt,
  textHash,
  toRuns,
  type AttemptState,
  type BuiltModule,
  type ModuleEntry,
} from "../src/index";
import { play } from "./beam";

// Mesure de l'**exigence** d'une solution (lots 4 et 6), hors de la simulation. Deux marges :
//   - la **gigue** : chaque changement de commande de la solution est décalé au hasard de −k à +k pas (k = 1, 2, 3), indépendamment, sur
//     `GIGUE_DRAWS` tirages à graine fixe ; l'ordre des commandes est gardé (une commande ne disparaît pas : au moins un pas chacune) — un
//     joueur appuie sur les mêmes boutons, un peu tôt ou un peu tard. Une fois la suite épuisée, la dernière commande est tenue 2 s de plus.
//     Réussite = arriver sans mourir (au sol ou non, à pleine vitesse ou non) ;
//   - le **raccord** (entrée en élan, lot 6) : la même solution rejouée depuis chaque position d'entrée possible (`RACCORD_POSITIONS` : de
//     combien le centre a dépassé le bord du palier d'entrée au pas où il le franchit, de 0 à un pas de course), parce que dans le niveau du
//     jour l'entrée tombe n'importe où dans ce pas. Réussite = la sortie canonique (course propre) **et** l'arrivée, sans mourir.
// La note (`exigenceOf`, src/modules.ts) en découle.

/** Pas ajoutés après la solution (la dernière commande tenue) quand on la rejoue décalée. */
export const EXTRA_TICKS = 240;

/** L'état d'entrée d'un morceau : au départ, à l'arrêt ou lancé. */
export const entryState = moduleStart;

/** Le but du solveur (lot 6) : la sortie canonique — le centre passe le bord droit du palier de sortie, vivant, en course propre. */
export function canonicalExit(m: BuiltModule): (s: AttemptState) => boolean {
  return (s) => s.status === ATTEMPT_RUNNING && centerCol(s.player) >= m.exitCol && isCleanRun(s.player);
}

/**
 * Branche perdue : elle a passé le bord du palier de sortie hors de la course propre (la première fois compte), ou son centre repasse à
 * gauche du palier d'entrée (une solution ne doit rien devoir à ce qu'il y a avant : le bord du niveau seul, le morceau précédent assemblé).
 */
export function lostExit(m: BuiltModule): (s: AttemptState) => boolean {
  return (s) => {
    const col = centerCol(s.player);
    return (col >= m.exitCol && !isCleanRun(s.player)) || col < m.palierIn.col0;
  };
}

/** En élan : pas de course (droite tenue) du départ jusqu'au bord du palier d'entrée, et l'état à ce pas (d'où part la recherche). */
export function elanEntry(m: BuiltModule): { ticks: number; state: AttemptState } {
  let s = moduleStart(m, "elan");
  for (let t = 1; t <= 64; t++) {
    s = stepAttempt(s, INPUT_RIGHT, m.level, DEFAULT_JUMP_PARAMS);
    if (centerCol(s.player) >= m.lead) return { ticks: t, state: s };
  }
  throw new Error(`${m.levelId} : le bord du palier d'entrée n'est pas atteint en courant`);
}

/**
 * Le cœur d'une solution (`cur`, depuis le départ du morceau) : joué jusqu'à la sortie canonique, puis droite tenue jusqu'à l'arrivée.
 * Rend le cœur (coupé à la sortie) et la rediffusion complète, ou null si elle ne remplit pas la règle (`moduleSpan`).
 */
export function fromCore(m: BuiltModule, entry: ModuleEntry, cur: readonly number[]): { core: number[]; full: number[] } | null {
  const goal = canonicalExit(m);
  let s = moduleStart(m, entry);
  let exit = -1;
  for (let t = 0; t < cur.length; t++) {
    s = stepAttempt(s, cur[t]!, m.level, DEFAULT_JUMP_PARAMS);
    if (goal(s)) {
      exit = t + 1;
      break;
    }
    if (s.status === ATTEMPT_DEAD || s.status === ATTEMPT_FINISHED || centerCol(s.player) >= m.exitCol || centerCol(s.player) < m.palierIn.col0) return null;
  }
  if (exit < 0) return null;
  const core = cur.slice(0, exit);
  const full = [...core];
  for (let n = 0; n < 64 && s.status !== ATTEMPT_FINISHED; n++) {
    s = stepAttempt(s, INPUT_RIGHT, m.level, DEFAULT_JUMP_PARAMS);
    full.push(INPUT_RIGHT);
    if (s.status === ATTEMPT_DEAD) return null;
  }
  return typeof moduleSpan(m, entry, full) === "string" ? null : { core, full };
}

/** Les appuis de saut d'une suite de commandes : début et fin (exclue) de chaque série du bit de saut (lot 30). */
export function appuis(inputs: readonly number[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let from = -1;
  inputs.forEach((bits, t) => {
    const on = (bits & INPUT_JUMP) !== 0;
    if (on && from < 0) from = t;
    if (!on && from >= 0) {
      out.push({ from, to: t });
      from = -1;
    }
  });
  if (from >= 0) out.push({ from, to: inputs.length });
  return out;
}

/** Fins de séries (pas où la commande change), sans la fin de la suite. */
function boundaries(inputs: readonly number[]): { runs: number[]; ends: number[] } {
  const runs = toRuns(inputs);
  const ends: number[] = [];
  let at = 0;
  for (let i = 0; i < runs.length - 1; i++) {
    at += runs[i]!.count;
    ends.push(at);
  }
  return { runs: runs.map((r) => r.bits), ends };
}

/** Reconstruit les commandes à partir des commandes de chaque série et de leurs fins (croissantes), la dernière série jusqu'à `total`. */
function rebuild(bits: readonly number[], ends: readonly number[], total: number): number[] {
  const out: number[] = [];
  let from = 0;
  for (let i = 0; i < bits.length; i++) {
    const to = i < ends.length ? ends[i]! : total;
    for (let t = from; t < to; t++) out.push(bits[i]!);
    from = to;
  }
  return out;
}

/**
 * Lot 11 : ce qu'un doigt peut réellement faire. Un relâchement de moins de `RELEASE_MIN` pas entre deux appuis retarde le second appui (qui garde sa
 * fin). **Lot 30 : plus de prolongation des appuis courts** — le maintien minimal du saut (`JUMP_MIN_HOLD`, dans la simulation) fait de tout appui de 1 à 10 pas le même
 * petit saut : la gigue n'a plus besoin d'allonger un appui d'un pas, la physique le fait. `pressMin` (0 par défaut) permet de retrouver la règle d'avant (5) pour comparer.
 */
export function humanized(inputs: readonly number[], pressMin = 0): number[] {
  const out = [...inputs];
  const n = out.length;
  const jump = (t: number) => (out[t]! & INPUT_JUMP) !== 0;
  let release = -1;
  let t = 0;
  while (t < n) {
    if (!jump(t)) {
      t++;
      continue;
    }
    if (release >= 0 && t - release < RELEASE_MIN) {
      const end = Math.min(n, release + RELEASE_MIN);
      for (let u = t; u < end; u++) out[u] = out[u]! & ~INPUT_JUMP;
      t = end;
      continue;
    }
    let e = t;
    while (e < n && jump(e)) e++;
    if (e - t < pressMin) {
      for (; e < Math.min(n, t + pressMin); e++) out[e] = out[e]! | INPUT_JUMP;
      while (e < n && jump(e)) e++;
    }
    release = e;
    t = e;
  }
  return out;
}

/**
 * Lot 30 : la **durée de chaque appui de saut varie** de −`HOLD_VARIATION` à +`HOLD_VARIATION` pas (4), tirée au hasard pour chaque appui : le doigt ne tient pas le bouton au pas
 * près. Un appui raccourci garde au moins un pas (sous le maintien minimal, il vaut de toute façon le petit saut : la variation ne compte qu'**au-dessus du minimum**) ; un appui allongé
 * s'arrête avant le prochain appui moins `RELEASE_MIN` pas. L'appui qui va jusqu'à la fin des commandes n'est pas touché (il se prolonge dans le jeu).
 */
export function holdVaried(inputs: readonly number[], rng: Rng, spread = HOLD_VARIATION): number[] {
  const out = [...inputs];
  const n = out.length;
  const starts: number[] = [];
  for (let t = 0; t < n; t++) if ((out[t]! & INPUT_JUMP) !== 0 && (t === 0 || (out[t - 1]! & INPUT_JUMP) === 0)) starts.push(t);
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i]!;
    let b = a;
    while (b < n && (out[b]! & INPUT_JUMP) !== 0) b++;
    if (b >= n) continue;
    const d = rng.int(2 * spread + 1) - spread;
    if (d === 0) continue;
    const limit = i + 1 < starts.length ? starts[i + 1]! - RELEASE_MIN : n;
    const end = Math.max(a + 1, Math.min(b + d, limit));
    if (end < b) for (let t = end; t < b; t++) out[t] = out[t]! & ~INPUT_JUMP;
    else for (let t = b; t < end; t++) out[t] = out[t]! | INPUT_JUMP;
  }
  return out;
}

/** Les instants de la solution décalés de −k à +k pas (au moins un pas par commande), rien d'autre : la gigue du lot 8c, avant d'être rendue humaine. */
function shiftedInstants(inputs: readonly number[], k: number, rng: Rng): number[] {
  const { runs, ends } = boundaries(inputs);
  const shifted: number[] = [];
  let prev = 0;
  for (const e of ends) {
    let v = e + rng.int(2 * k + 1) - k;
    if (v < prev + 1) v = prev + 1;
    shifted.push(v);
    prev = v;
  }
  const total = Math.max(inputs.length, prev + 1);
  return rebuild(runs, shifted, total);
}

/**
 * La solution, chaque changement de commande décalé de −k à +k pas (au moins un pas par commande), la durée de chaque appui de saut variée de ±`HOLD_VARIATION` pas (lot 30),
 * puis rendue humaine (`humanized`).
 */
export function jittered(inputs: readonly number[], k: number, rng: Rng): number[] {
  return humanized(holdVaried(shiftedInstants(inputs, k, rng), rng));
}

/** La gigue d'avant le lot 30 (les instants seuls, sans variation de la durée des appuis) : de quoi comparer les deux mesures. */
export function jitteredInstants(inputs: readonly number[], k: number, rng: Rng): number[] {
  return humanized(shiftedInstants(inputs, k, rng));
}

export interface Margins {
  gigue: [number, number, number];
  raccord: number | null;
}

/** Graine fixe d'un morceau, d'une variante et d'une entrée. */
export function seedOf(m: BuiltModule, entry: ModuleEntry): number {
  return Number.parseInt(textHash(`${m.levelId}:${entry}`), 16);
}

/** Les départs du test de raccord : le départ lancé, décalé pour que le centre franchisse le bord du palier à chaque position voulue. */
export function raccordStarts(m: BuiltModule): AttemptState[] {
  const e = elanEntry(m);
  const reached = e.state.player.x + PLAYER_WIDTH / 2 - m.lead * UNITS_PER_TILE;
  const start = moduleStart(m, "elan");
  return RACCORD_POSITIONS.map((d) => ({ ...start, player: { ...start.player, x: start.player.x + d - reached } }));
}

/**
 * Une entrée décalée réussit-elle ? La solution (puis droite tenue : selon la position d'entrée, la sortie et l'arrivée peuvent venir un pas
 * plus tard) passe le bord du palier d'entrée en course propre, sort en course propre, et arrive sans mourir — ce que demande le raccord.
 */
export function raccordOk(m: BuiltModule, start: AttemptState, inputs: readonly number[]): boolean {
  const goal = canonicalExit(m);
  let s = start;
  let entered = false;
  let exited = false;
  for (let t = 0; t < inputs.length + RACCORD_TAIL; t++) {
    s = stepAttempt(s, t < inputs.length ? inputs[t]! : INPUT_RIGHT, m.level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) return false;
    if (s.status === ATTEMPT_FINISHED) return exited;
    const col = centerCol(s.player);
    if (col < m.palierIn.col0) return false;
    if (!entered && col >= m.lead) {
      if (!isCleanRun(s.player)) return false;
      entered = true;
    }
    if (!exited && col >= m.exitCol) {
      if (!goal(s)) return false;
      exited = true;
    }
  }
  return false;
}

/** Réussites du test de raccord (sur `RACCORD_POSITIONS.length`) ; −1 dès qu'on ne peut plus dépasser `floor` (en comptant `base`). */
function raccordHits(m: BuiltModule, inputs: readonly number[], base = 0, floor = -1): number {
  const starts = raccordStarts(m);
  let ok = 0;
  for (let i = 0; i < starts.length; i++) {
    if (raccordOk(m, starts[i]!, inputs)) ok++;
    if (base + ok + (starts.length - i - 1) <= floor) return -1;
  }
  return ok;
}

/** Taux de réussite (‰) sous gigue ±1, ±2, ±3 et au raccord (entrée en élan). `inputs` : la rediffusion complète. */
export function measureMargins(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[]): Margins {
  const start = entryState(m, entry);
  const gigue: number[] = [];
  for (let k = 1; k <= 3; k++) {
    const rng = new Rng(mixSeed(seedOf(m, entry), k));
    let ok = 0;
    for (let d = 0; d < GIGUE_DRAWS; d++) if (play(m.level, start, jittered(inputs, k, rng), EXTRA_TICKS).finished) ok++;
    gigue.push(Math.round((ok * 1000) / GIGUE_DRAWS));
  }
  const raccord = entry === "elan" ? Math.round((raccordHits(m, inputs) * 1000) / RACCORD_POSITIONS.length) : null;
  return { gigue: gigue as [number, number, number], raccord };
}

/**
 * Tirages du durcissement (graine fixe, distincte de celle de la mesure). Lot 8c : tous à ±3 pas, ce que juge la règle de jouabilité humaine
 * (`HUMAIN_MIN`, `exigenceOf`) ; avant, 16 à ±1, 16 à ±2 et 16 à ±3.
 */
const HARDEN_DRAWS = 48;

/**
 * Note du durcissement : réussites sous les tirages de gigue du durcissement (48), plus, en élan, les positions de raccord réussies (25) ;
 * −1 dès qu'on ne peut plus dépasser `floor`.
 */
export function hardenScore(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[], floor = -1): number {
  const start = entryState(m, entry);
  const raccords = entry === "elan" ? RACCORD_POSITIONS.length : 0;
  const total = HARDEN_DRAWS + raccords;
  let ok = 0;
  let done = 0;
  if (raccords > 0) {
    const r = raccordHits(m, inputs, 0, floor - HARDEN_DRAWS);
    if (r < 0) return -1;
    ok += r;
    done += raccords;
  }
  const rng = new Rng(mixSeed(seedOf(m, entry) ^ 0x5eed, 3));
  for (let d = 0; d < HARDEN_DRAWS; d++) {
    if (play(m.level, start, jittered(inputs, 3, rng), EXTRA_TICKS).finished) ok++;
    done++;
    if (ok + (total - done) <= floor) return -1;
  }
  return ok;
}

/**
 * **Durcissement** : la recherche rend la solution la plus rapide, souvent collée aux dangers (un saut au dernier pas possible, un petit
 * saut tout juste assez haut). Parmi les solutions **aussi rapides** (sortie au même pas ou plus tôt, toujours valables), on cherche par
 * petites retouches du cœur (`core` : jusqu'à la sortie) celle qui tolère le mieux la gigue et, en élan, toutes les positions d'entrée :
 * décaler un changement de commande (±1, ±2, ±4, ±8), décaler toute une commande (son début et sa fin ensemble), ou supprimer une commande
 * inutile. Une retouche est gardée si sa note (`hardenScore`) monte. Rend le cœur et la rediffusion complète.
 */
export function harden(
  m: BuiltModule,
  entry: ModuleEntry,
  core: readonly number[],
  maxPasses = 8,
  maxLength?: number,
): { core: number[]; full: number[] } {
  const score = (full: readonly number[], floor: number) => hardenScore(m, entry, full, floor);
  // Lot 8c, repli robuste : `maxLength` permet de prendre plus de temps (attendre avant un geste) ; sans lui, aussi rapide seulement.
  const limit = maxLength ?? core.length;
  const slower = limit > core.length;
  let current = fromCore(m, entry, core);
  if (!current) throw new Error(`${m.levelId} ${entry} : solution non valable avant durcissement`);
  let best = score(current.full, -1);
  const max = HARDEN_DRAWS + (entry === "elan" ? RACCORD_POSITIONS.length : 0);
  for (let pass = 0; pass < maxPasses && best < max; pass++) {
    let improved = false;
    for (let i = 0; best < max; i++) {
      const cur = current.core;
      const { runs, ends } = boundaries(cur);
      if (i > runs.length) break;
      const candidates: number[][] = [];
      const withEnds = (e: number[]) => {
        for (let j = 0; j < e.length; j++) if (e[j]! < (j > 0 ? e[j - 1]! + 1 : 1)) return;
        candidates.push(rebuild(runs, e, cur.length + 16));
      };
      for (const d of [1, -1, 2, -2, 4, -4, 8, -8]) {
        if (i < ends.length) withEnds(ends.map((e, j) => (j === i ? e + d : e)));
        if (i > 0 && i < ends.length) withEnds(ends.map((e, j) => (j === i || j === i - 1 ? e + d : e)));
        // Repli robuste : retarder (ou avancer) tout ce qui suit le geste i, d'un bloc — attendre un peu avant de repartir.
        if (slower && i < ends.length) withEnds(ends.map((e, j) => (j >= i ? e + d : e)));
      }
      // Supprimer la commande i (ses pas vont à la commande d'avant).
      if (i > 0 && i < runs.length) {
        const bits = runs.filter((_, j) => j !== i);
        const e = ends.filter((_, j) => j !== i - 1);
        candidates.push(rebuild(bits, e, cur.length + 16));
      }
      for (const c of candidates) {
        const v = fromCore(m, entry, c);
        if (!v || v.core.length > limit) continue;
        const sc = score(v.full, best);
        if (sc > best || (sc === best && toRuns(v.core).length < runs.length)) {
          current = v;
          best = sc;
          improved = true;
          break;
        }
      }
    }
    if (!improved) break;
  }
  return current;
}
