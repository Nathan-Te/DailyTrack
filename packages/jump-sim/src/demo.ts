import { Rng } from "@cdj/core";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, ATTEMPT_RUNNING, checkpointAttempt, stepAttempt, type AttemptState } from "./attempt";
import { hopToA } from "./alternes";
import { tileOf } from "./collide";
import { idiv } from "./idiv";
import { cycleMod, sectionPeriod, type Level } from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_MASK, PLAYER_WIDTH } from "./player";
import { PALIER_LENGTH, SINGLE_CLOCK_VERSION } from "./constants";
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
// Lot 16 (v4) : une faute ne fait jamais sauter sur le palier d'un point de passage (le joueur fictif ne prend pas la voie lente).
// Lot 15 : dans un niveau à une seule horloge (v4), rien ne revient à zéro à la mort : après une reprise (au départ ou sur un point), le joueur
// fictif **attend**, comme un vrai joueur qui regarde les scies, que l'horloge retrouve la phase où la solution passait (`alignWait`), puis la
// reprend. Les niveaux v3 ne changent pas (mêmes essais, mêmes références).

/**
 * Lot 21 : la reprise d'un joueur fictif après une mort, fournie par l'appelant (`repriseParPhase`, `demoPhases.ts` : elle a besoin du catalogue des morceaux,
 * que ce fichier — lu par le jeu au premier chargement — n'importe pas). Rend l'attente sur le point de passage (pas, sans commande), les commandes du morceau
 * qui commence là (jouées après l'attente) et le pas de la preuve où continuer ensuite, ou `null` : la reprise d'avant (rejouer la preuve).
 */
export interface DemoReprise {
  resume(level: Level, state: Readonly<AttemptState>): { wait: number; inputs: readonly number[]; cursor: number } | null;
}

export interface DemoOptions {
  /** Nombre d'essais. */
  attempts: number;
  /** Vies au plus par essai (au-delà : abandon à la reprise). */
  maxLives?: number;
  /**
   * Lot 21 : les joueurs fictifs qui **reprennent bien**. Sans cette option : exactement les essais d'avant (les références `replay-golden*.json`). Avec elle (une
   * `DemoReprise`, ex. `repriseParPhase(niveau)`) : (1) une faute déjà jouée n'est pas rejouée à la vie suivante (elle recommençait à la même place jusqu'à
   * l'abandon) ; (2) après une mort sur un point de passage, le joueur attend sur le palier la phase de l'horloge voulue puis joue la solution **du morceau qui
   * commence là**, valable depuis l'arrêt, au lieu de rejouer la preuve (qui l'a franchi en courant) — voir `demoPhases.ts`.
   */
  reprise?: DemoReprise | undefined;
}

/** Pas sans progrès (colonne la plus à droite atteinte) avant d'abandonner un essai. */
const STALL_TICKS = 480;

const centerCol = (s: AttemptState) => tileOf(s.player.x + idiv(PLAYER_WIDTH, 2));

/** Lot 15 : attente la plus longue visée pour remettre plusieurs sections en phase à la fois (au-delà, seulement les premières). */
const ALIGN_MAX = 2400;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Lot 15 (v4) : pas à attendre, après une reprise en `s`, pour que le chrono retrouve (modulo les périodes des sections qui restent à
 * traverser, de proche en proche tant que leur plus petit commun multiple reste sous `ALIGN_MAX`) la phase de la solution au pas `cursor`.
 */
function alignWait(level: Level, s: Readonly<AttemptState>, cursor: number): number {
  const col = s.checkpoint < 0 ? level.start.col : level.checkpoints[s.checkpoint]!.col;
  let l = 1;
  for (let i = 0; i < level.sections.length; i++) {
    if (level.sections[i]!.c1 < col) continue;
    const p = sectionPeriod(level, i);
    if (p === 0) continue;
    const next = idiv(l * p, gcd(l, p));
    if (next > ALIGN_MAX && l > 1) break;
    l = next;
  }
  return cycleMod(cursor - s.time, l);
}

/** Lot 16 : le centre est-il sur le palier d'un point de passage (ses `PALIER_LENGTH` colonnes) ? */
function isCalm(level: Level, col: number): boolean {
  return level.checkpoints.some((c) => col >= c.col && col < c.col + PALIER_LENGTH);
}

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
  const calm = level.simVersion >= SINGLE_CLOCK_VERSION;
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
    let wait = 0;
    // Lot 21 : les commandes d'un morceau repris depuis l'arrêt (jouées après l'attente, avant de reprendre la preuve à `cursor`).
    let pending: readonly number[] = [];
    let played = 0;
    // Lot 28 (v12) : repartant en B d'un point de passage, le joueur fictif saute d'abord une fois sur place (les alternés repassent en A) avant d'attendre et de jouer.
    let prefix: readonly number[] = [];
    let prefixPlayed = 0;
    let done: RecordedAttempt | null = null;
    for (;;) {
      const inPrefix = prefixPlayed < prefix.length;
      const inPending = !inPrefix && wait === 0 && played < pending.length;
      let bits = inPrefix ? prefix[prefixPlayed]! : wait > 0 ? 0 : inPending ? pending[played]! : (plan.inputs[cursor] ?? 0);
      if (!inPrefix && wait === 0 && !inPending) {
        for (const [a, b, c] of cuts) {
          if (cursor < a || cursor >= b) continue;
          // Lot 16 (v4) : une faute ne fait jamais sauter sur le palier d'un point de passage : de là part la voie lente d'une portion dure
          // (un saut pose sur le toit de sa cage), et un joueur fictif ne la prend pas.
          bits = calm && isCalm(level, centerCol(s)) ? c & ~INPUT_JUMP : c;
        }
      }
      const before = s;
      s = stepAttempt(before, bits, level, DEFAULT_JUMP_PARAMS);
      done = recorder.step(before, bits, s);
      if (done) break;
      if (inPrefix) {
        prefixPlayed++;
        continue;
      }
      if (wait > 0) {
        wait--;
        continue;
      }
      if (inPending) played++;
      else cursor++;
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
        // Lot 21 : une faute déjà jouée (commencée avant la mort) est passée ; la rejouer à chaque vie tuait le joueur à la même place jusqu'à l'abandon.
        if (options.reprise) for (let i = cuts.length - 1; i >= 0; i--) if (cuts[i]![0] < cursor) cuts.splice(i, 1);
        pending = [];
        played = 0;
        const hop = hopToA(level, s);
        prefix = hop ? hop.inputs : [];
        prefixPlayed = 0;
        const from = hop ? hop.after : s;
        const again = options.reprise && calm ? options.reprise.resume(level, from) : null;
        if (again) {
          pending = again.inputs;
          cursor = again.cursor;
          wait = again.wait;
        } else {
          cursor = plan.resume[s.checkpoint] ?? 0;
          if (cursor < 0) cursor = 0;
          if (level.simVersion >= SINGLE_CLOCK_VERSION) wait = alignWait(level, from, cursor);
        }
        since = 0;
        far = centerCol(s);
        if (rng.chance(70)) cuts.push(fault(cursor, 360));
      }
    }
    if (done) out.push(done);
  }
  return out;
}
