import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  PLAYER_WIDTH,
  TICK_RATE,
  UNITS_PER_TILE,
  stepAttempt,
  tileOf,
  type AttemptState,
  type Level,
} from "../src/index";

// Mesure de la **course à vide** (lot 6), hors de la simulation : sur une rediffusion (celle de l'auteur, ou la solution d'un morceau), le
// temps passé **au sol sans appui de saut** quand le centre du personnage est au-dessus d'une zone donnée (les paliers), et la **plus
// longue course au sol sans saut** du parcours (pas consécutifs au sol, bouton de saut relâché, vivant), en pas et en tuiles.

/** Une zone de colonnes (bornes comprises). */
export interface Zone {
  c0: number;
  c1: number;
}

export interface EmptyRun {
  /** Pas au sol sans appui de saut, centre au-dessus de chaque zone (dans l'ordre des zones). */
  zones: number[];
  /** Plus longue course au sol sans saut : durée (pas), longueur (unités, déplacement horizontal) et colonne où elle commence. */
  longestTicks: number;
  longestUnits: number;
  longestCol: number;
  /** Pas joués. */
  ticks: number;
}

/** Joue `inputs` depuis `start` sur `level` et mesure la course à vide (s'arrête à la mort, comme un rejeu sans point de passage). */
export function emptyRun(level: Level, start: AttemptState, inputs: readonly number[], zones: readonly Zone[]): EmptyRun {
  const out: EmptyRun = { zones: zones.map(() => 0), longestTicks: 0, longestUnits: 0, longestCol: -1, ticks: 0 };
  let s = start;
  let run = 0;
  let runX = 0;
  let runCol = -1;
  for (const bits of inputs) {
    const before = s;
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    out.ticks++;
    if (s.status === ATTEMPT_DEAD) break;
    const empty = s.player.ground === 1 && (bits & INPUT_JUMP) === 0;
    if (!empty) {
      run = 0;
      continue;
    }
    const col = tileOf(s.player.x + PLAYER_WIDTH / 2);
    for (let k = 0; k < zones.length; k++) if (col >= zones[k]!.c0 && col <= zones[k]!.c1) out.zones[k]!++;
    if (run === 0) {
      runX = before.player.x;
      runCol = tileOf(before.player.x + PLAYER_WIDTH / 2);
    }
    run++;
    if (run > out.longestTicks) {
      out.longestTicks = run;
      out.longestUnits = Math.abs(s.player.x - runX);
      out.longestCol = runCol;
    }
    if (s.status === ATTEMPT_FINISHED) break;
  }
  return out;
}

export const secs = (ticks: number) => (ticks / TICK_RATE).toFixed(2).replace(".", ",");
export const tiles = (units: number) => (units / UNITS_PER_TILE).toFixed(1).replace(".", ",");
