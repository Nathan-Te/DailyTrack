import { Rng, mixSeed } from "@cdj/core";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  GIGUE_DRAWS,
  RACCORD_OFFSETS,
  START_AT_SPAWN,
  replayStartState,
  textHash,
  toRuns,
  type AttemptState,
  type BuiltModule,
  type ModuleEntry,
} from "../src/index";
import { play } from "./beam";

// Mesure de l'**exigence** d'une solution (lot 4), hors de la simulation. Deux marges :
//   - la **gigue** : chaque changement de commande de la solution est décalé au hasard de −k à +k pas (k = 1, 2, 3), indépendamment, sur
//     `GIGUE_DRAWS` tirages à graine fixe ; l'ordre des commandes est gardé (une commande ne disparaît pas : au moins un pas chacune) — un
//     joueur appuie sur les mêmes boutons, un peu tôt ou un peu tard. Une fois la suite épuisée, la dernière commande est tenue 2 s de plus.
//     Réussite = arriver sans mourir (au sol ou non, à pleine vitesse ou non) ;
//   - le **raccord** (entrée en élan) : la même solution rejouée depuis un départ décalé de quelques unités (`RACCORD_OFFSETS`), parce que
//     l'assemblage du lot 5 n'entrera jamais exactement au même sous-pixel.
// La note (`exigenceOf`, src/modules.ts) en découle.

/** Pas ajoutés après la solution (la dernière commande tenue) quand on la rejoue décalée. */
export const EXTRA_TICKS = 240;

/** L'état d'entrée d'un morceau : au départ, à l'arrêt ou lancé. */
export function entryState(m: BuiltModule, entry: ModuleEntry): AttemptState {
  return replayStartState(m.level, { ...START_AT_SPAWN, elan: entry === "elan" ? 1 : 0 });
}

/** Sortie en élan : arrivée au sol, à pleine vitesse vers la droite. */
export function elanExit(s: AttemptState): boolean {
  return s.status === ATTEMPT_FINISHED && s.player.ground === 1 && s.player.vx === DEFAULT_JUMP_PARAMS.runSpeed;
}

/** La solution est-elle valable : arrivée au dernier pas, sans mourir, en sortant en élan ? */
export function validSolution(m: BuiltModule, start: AttemptState, inputs: readonly number[]): boolean {
  const out = play(m.level, start, inputs);
  return out.finished && out.ticks === inputs.length && elanExit(out.final);
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

/** La solution, chaque changement de commande décalé de −k à +k pas (au moins un pas par commande). */
export function jittered(inputs: readonly number[], k: number, rng: Rng): number[] {
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

export interface Margins {
  gigue: [number, number, number];
  raccord: number | null;
}

/** Graine fixe d'un morceau, d'une variante et d'une entrée. */
export function seedOf(m: BuiltModule, entry: ModuleEntry): number {
  return Number.parseInt(textHash(`${m.levelId}:${entry}`), 16);
}

/** Taux de réussite (‰) sous gigue ±1, ±2, ±3 et au raccord (entrée en élan). */
export function measureMargins(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[]): Margins {
  const start = entryState(m, entry);
  const gigue: number[] = [];
  for (let k = 1; k <= 3; k++) {
    const rng = new Rng(mixSeed(seedOf(m, entry), k));
    let ok = 0;
    for (let d = 0; d < GIGUE_DRAWS; d++) if (play(m.level, start, jittered(inputs, k, rng), EXTRA_TICKS).finished) ok++;
    gigue.push(Math.round((ok * 1000) / GIGUE_DRAWS));
  }
  let raccord: number | null = null;
  if (entry === "elan") {
    let ok = 0;
    for (const dx of RACCORD_OFFSETS) {
      const shifted = { ...start, player: { ...start.player, x: start.player.x + dx } };
      if (play(m.level, shifted, inputs, EXTRA_TICKS).finished) ok++;
    }
    raccord = Math.round((ok * 1000) / RACCORD_OFFSETS.length);
  }
  return { gigue: gigue as [number, number, number], raccord };
}

/** Tirages du durcissement (graine fixe, distincte de celle de la mesure) : 16 à ±1, 16 à ±2, 16 à ±3. */
const HARDEN_DRAWS = 16;

/** Réussites (sur 48) de la solution sous les tirages du durcissement ; −1 dès qu'on ne peut plus dépasser `floor`. */
export function hardenScore(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[], floor = -1): number {
  const start = entryState(m, entry);
  const total = 3 * HARDEN_DRAWS;
  let ok = 0;
  let done = 0;
  for (let k = 1; k <= 3; k++) {
    const rng = new Rng(mixSeed(seedOf(m, entry) ^ 0x5eed, k));
    for (let d = 0; d < HARDEN_DRAWS; d++) {
      if (play(m.level, start, jittered(inputs, k, rng), EXTRA_TICKS).finished) ok++;
      done++;
      if (ok + (total - done) <= floor) return -1;
    }
  }
  return ok;
}

/**
 * **Durcissement** : la recherche rend la solution la plus rapide, souvent collée aux dangers (un saut au dernier pas possible, un petit
 * saut tout juste assez haut). Parmi les solutions **aussi rapides** (même nombre de pas ou moins, toujours valables, sortie en élan), on
 * cherche par petites retouches celle qui tolère le mieux la gigue : décaler un changement de commande (±1, ±2, ±4, ±8), décaler toute une
 * commande (son début et sa fin ensemble), ou supprimer une commande inutile. Une retouche est gardée si elle fait réussir plus de tirages
 * de gigue (48 tirages à graine fixe, différents de ceux de la mesure). La marge mesurée devient celle du morceau plutôt que celle d'un
 * hasard de la recherche ; le temps ne change pas.
 */
export function harden(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[], maxPasses = 8): number[] {
  const start = entryState(m, entry);
  const score = (cur: readonly number[], floor: number) => hardenScore(m, entry, cur, floor);
  const valid = (cur: readonly number[], limit: number): number[] | null => {
    const out = play(m.level, start, cur);
    if (!out.finished || out.ticks > limit || !elanExit(out.final)) return null;
    return cur.slice(0, out.ticks);
  };
  let current = [...inputs];
  const limit = current.length;
  let best = score(current, -1);
  const full = 3 * HARDEN_DRAWS;
  for (let pass = 0; pass < maxPasses && best < full; pass++) {
    let improved = false;
    for (let i = 0; best < full; i++) {
      const { runs, ends } = boundaries(current);
      if (i > runs.length) break;
      const candidates: number[][] = [];
      const withEnds = (e: number[]) => {
        for (let j = 0; j < e.length; j++) if (e[j]! < (j > 0 ? e[j - 1]! + 1 : 1)) return;
        candidates.push(rebuild(runs, e, current.length));
      };
      for (const d of [1, -1, 2, -2, 4, -4, 8, -8]) {
        if (i < ends.length) withEnds(ends.map((e, j) => (j === i ? e + d : e)));
        if (i > 0 && i < ends.length) withEnds(ends.map((e, j) => (j === i || j === i - 1 ? e + d : e)));
      }
      // Supprimer la commande i (ses pas vont à la commande d'avant).
      if (i > 0 && i < runs.length) {
        const bits = runs.filter((_, j) => j !== i);
        const e = ends.filter((_, j) => j !== i - 1);
        candidates.push(rebuild(bits, e, current.length));
      }
      for (const c of candidates) {
        const v = valid(c, limit);
        if (!v) continue;
        const sc = score(v, best);
        if (sc > best || (sc === best && toRuns(v).length < runs.length)) {
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
