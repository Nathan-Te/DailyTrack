import { Rng, mixSeed } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  GIGUE_DRAWS,
  INPUT_RIGHT,
  centerCol,
  decodeReplay,
  exigenceOf,
  fromRuns,
  initialAttempt,
  stepAttempt,
  textHash,
  type AttemptState,
  type DailyLevel,
  type SlowRoute,
} from "../src/index";
import { EXTRA_TICKS, jittered } from "./exigence";

// Lot 16 : mesures des voies lentes, hors de la simulation (tests et `measure:jump`).

/** L'état de la preuve au pas où la voie commence (le centre entre sur le palier d'entrée) et les commandes de la voie lente. */
export function slowStart(d: Pick<DailyLevel, "level">, r: SlowRoute): { start: AttemptState; inputs: number[] } {
  const all = fromRuns(decodeReplay(r.code).runs);
  let s = initialAttempt(d.level);
  for (let t = 0; t < r.fork; t++) s = stepAttempt(s, all[t]!, d.level, DEFAULT_JUMP_PARAMS);
  return { start: s, inputs: all.slice(r.fork) };
}

/** La voie est-elle réussie : sans mourir, jusqu'au-delà du palier de sortie (ou l'arrivée) ? */
export function slowReached(d: Pick<DailyLevel, "level">, r: SlowRoute, start: AttemptState, inputs: readonly number[]): boolean {
  let s = start;
  for (let t = 0; t < inputs.length + EXTRA_TICKS; t++) {
    s = stepAttempt(s, t < inputs.length ? inputs[t]! : INPUT_RIGHT, d.level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) return false;
    if (s.status === ATTEMPT_FINISHED || centerCol(s.player) > r.palierOut.col1) return true;
  }
  return false;
}

/**
 * La gigue de la voie lente (la mesure de la note des morceaux, lot 8c) : chaque changement de commande décalé de ±1, ±2, ±3 pas, rendu
 * humain, `GIGUE_DRAWS` tirages à graine fixe ; réussite = passer le palier de sortie sans mourir. Rend les taux (‰) et la note (1 à 5, 0 :
 * refusée).
 */
export function slowGigue(d: Pick<DailyLevel, "level" | "id">, r: SlowRoute, draws = GIGUE_DRAWS): { gigue: [number, number, number]; note: number } {
  const { start, inputs } = slowStart(d, r);
  const seed = Number.parseInt(textHash(`${d.id}:voie:${r.piece}`), 16);
  const gigue: number[] = [];
  for (let k = 1; k <= 3; k++) {
    const rng = new Rng(mixSeed(seed, k));
    let ok = 0;
    for (let n = 0; n < draws; n++) if (slowReached(d, r, start, jittered(inputs, k, rng))) ok++;
    gigue.push(Math.round((ok * 1000) / draws));
  }
  const g = gigue as [number, number, number];
  return { gigue: g, note: exigenceOf(g, null) };
}
