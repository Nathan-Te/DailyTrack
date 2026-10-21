import { Rng } from "@cdj/core";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, ATTEMPT_RUNNING, checkpointAttempt, stepAttempt, type AttemptState } from "./attempt";
import { tileOf } from "./collide";
import { idiv } from "./idiv";
import type { Level } from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_MASK, PLAYER_WIDTH } from "./player";
import { AttemptRecorder, fromRuns, replayStartState, type JumpReplay, type RecordedAttempt } from "./replay";

// Essais fictifs (lot 3) : des **perturbations à graine fixe** d'une solution, jouées par la vraie simulation et enregistrées comme des
// essais de joueur. Ils servent au carnage de démonstration (`?carnage=demo`) et aux tests de déterminisme (morts et reprises). Rien n'y
// est supposé : chaque essai est rejoué pas à pas ; une mort, une reprise sur un point de passage, une arrivée sont ce que la simulation
// a calculé. Mêmes graines, mêmes essais, partout.
//
// Un essai fictif suit la solution, mais par moments remplace ses commandes par d'autres pendant 4 à 40 pas (une « faute »). Après une
// reprise sur un point de passage, il reprend la solution au pas qui le fait aller le plus loin depuis ce point (cherché une fois pour toutes
// parmi les pas voisins de celui où la solution avait touché le point), avec une nouvelle faute possible. Un essai qui n'avance plus pendant
// 4 s, ou qui a déjà perdu `maxLives` vies, est abandonné (« recommencer »).

export interface DemoOptions {
  /** Nombre d'essais. */
  attempts: number;
  /** Vies au plus par essai (au-delà : abandon à la reprise). */
  maxLives?: number;
}

/** Pas sans progrès (colonne la plus à droite atteinte) avant d'abandonner un essai. */
const STALL_TICKS = 480;

const centerCol = (s: AttemptState) => tileOf(s.player.x + idiv(PLAYER_WIDTH, 2));

interface Plan {
  inputs: number[];
  /** Pour chaque point de passage : pas de la solution d'où repartir après une reprise (−1 : jamais touché). */
  resume: number[];
}

/** Prépare la solution : pas où chaque point est touché, et meilleur pas de reprise depuis ce point. */
function planOf(level: Level, solution: JumpReplay): Plan {
  const inputs = fromRuns(solution.runs);
  const marks: AttemptState[] = [];
  const at: number[] = level.checkpoints.map(() => -1);
  let s = replayStartState(level, solution.start);
  for (let t = 0; t < inputs.length; t++) {
    s = stepAttempt(s, inputs[t]!, level, DEFAULT_JUMP_PARAMS);
    if (s.checkpoint >= 0 && at[s.checkpoint] === -1) {
      at[s.checkpoint] = t + 1;
      marks[s.checkpoint] = s;
    }
  }
  const resume = at.map((mark, c) => {
    if (mark < 0) return -1;
    const back = checkpointAttempt(level, marks[c]!);
    let best = mark;
    let bestCol = -1;
    for (let o = mark - 120 < 0 ? 0 : mark - 120; o <= mark + 30 && o < inputs.length; o += 2) {
      let r = back;
      let far = centerCol(r);
      for (let k = 0; k < 360 && o + k < inputs.length; k++) {
        r = stepAttempt(r, inputs[o + k]!, level, DEFAULT_JUMP_PARAMS);
        if (r.status !== ATTEMPT_RUNNING) break;
        const col = centerCol(r);
        if (col > far) far = col;
      }
      if (r.status === ATTEMPT_FINISHED) far += 10_000;
      if (far > bestCol) {
        bestCol = far;
        best = o;
      }
    }
    return best;
  });
  return { inputs, resume };
}

/** Essais fictifs tirés d'une solution (rediffusion d'essai partant du départ). Déterministe pour une graine donnée. */
export function demoAttempts(level: Level, solution: JumpReplay, seed: number, options: DemoOptions): RecordedAttempt[] {
  const rng = new Rng(seed);
  const plan = planOf(level, solution);
  const maxLives = options.maxLives ?? 6;
  const start = replayStartState(level, solution.start);
  const out: RecordedAttempt[] = [];
  const fault = (from: number, span: number): [number, number, number] => {
    const at = from + rng.int(span);
    return [at, at + 4 + rng.int(37), rng.int(INPUT_MASK + 1)];
  };
  for (let n = 0; n < options.attempts; n++) {
    // Une faute sur deux tombe dans le premier tiers : beaucoup de vies courtes au départ, de moins en moins loin (comme un vrai joueur).
    const cuts: [number, number, number][] = [fault(0, rng.chance(50) ? idiv(plan.inputs.length, 3) : plan.inputs.length)];
    const recorder = new AttemptRecorder(solution.levelId, solution.simVersion);
    let s = start;
    let cursor = 0;
    let lives = 1;
    let far = centerCol(s);
    let since = 0;
    let done: RecordedAttempt | null = null;
    for (;;) {
      let bits = plan.inputs[cursor] ?? 0;
      for (const [a, b, c] of cuts) if (cursor >= a && cursor < b) bits = c;
      const before = s;
      s = stepAttempt(before, bits, level, DEFAULT_JUMP_PARAMS);
      done = recorder.step(before, bits, s);
      if (done) break;
      cursor++;
      const col = centerCol(s);
      if (col > far) {
        far = col;
        since = 0;
      } else if (++since > STALL_TICKS) {
        done = recorder.abandon();
        break;
      }
      if (s.status === ATTEMPT_RUNNING && before.status === ATTEMPT_DEAD) {
        if (++lives > maxLives) {
          done = recorder.abandon();
          break;
        }
        cursor = plan.resume[s.checkpoint] ?? 0;
        if (cursor < 0) cursor = 0;
        since = 0;
        far = centerCol(s);
        if (rng.chance(70)) cuts.push(fault(cursor, 360));
      }
    }
    if (done) out.push(done);
  }
  return out;
}
