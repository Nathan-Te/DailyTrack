import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  GIGUE_DRAWS,
  HOLD_VARIATION,
  HUMAIN_MIN,
  INPUT_JUMP,
  INPUT_RIGHT,
  JUMP_MIN_HOLD,
  MIN_HOLD_VERSION,
  MODULES,
  PRESS_MIN,
  RELEASE_MIN,
  fromRuns,
  decodeReplay,
  moduleSolutions,
  initialAttempt,
  parseLevel,
  pressProblems,
  shortestPress,
  stepAttempt,
  type AttemptState,
  type Level,
} from "../src/index";
import { play } from "../tools/beam";
import { EXTRA_TICKS, appuis, holdVaried, humanized, jittered, jitteredInstants } from "../tools/exigence";

// Lot 30 — la règle de tolérance sur la durée des appuis : ±4 pas au-dessus du maintien minimal, en plus de la gigue ±3 sur les instants.

const presses = (inputs: readonly number[]) => appuis(inputs).map((a) => a.to - a.from);

describe("variation de la durée d'un appui (lot 30)", () => {
  const solution = [
    ...new Array<number>(20).fill(INPUT_RIGHT),
    ...new Array<number>(12).fill(INPUT_RIGHT | INPUT_JUMP),
    ...new Array<number>(30).fill(INPUT_RIGHT),
    ...new Array<number>(40).fill(INPUT_RIGHT | INPUT_JUMP),
    ...new Array<number>(30).fill(INPUT_RIGHT),
  ];

  it("la tolérance vaut ±4 pas", () => {
    expect(HOLD_VARIATION).toBe(4);
  });

  it("chaque appui varie d'au plus 4 pas, au moins un pas, le reste de la suite est inchangé", () => {
    const seen = new Set<number>();
    const rng = new Rng(7);
    for (let i = 0; i < 400; i++) {
      const v = holdVaried(solution, rng);
      expect(v.length).toBe(solution.length);
      const [a, b] = presses(v) as [number, number];
      expect(Math.abs(a - 12)).toBeLessThanOrEqual(HOLD_VARIATION);
      expect(Math.abs(b - 40)).toBeLessThanOrEqual(HOLD_VARIATION);
      // Le bouton de saut seul change : les directions sont celles de la solution.
      expect(v.map((x) => x & INPUT_RIGHT)).toEqual(solution.map((x) => x & INPUT_RIGHT));
      seen.add(a);
    }
    // Les neuf durées de 8 à 16 sortent toutes.
    expect([...seen].sort((x, y) => x - y)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("un appui de 1 pas ne disparaît pas ; un appui ne rejoint pas le suivant (relâchement d'au moins RELEASE_MIN pas)", () => {
    const tight = [INPUT_RIGHT, ...new Array<number>(2).fill(INPUT_JUMP), ...new Array<number>(RELEASE_MIN).fill(INPUT_RIGHT), ...new Array<number>(5).fill(INPUT_JUMP), INPUT_RIGHT, INPUT_RIGHT];
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const v = holdVaried(tight, rng);
      const list = appuis(v);
      expect(list.length).toBe(2);
      for (const a of list) expect(a.to - a.from).toBeGreaterThanOrEqual(1);
      expect(list[1]!.from - list[0]!.to).toBeGreaterThanOrEqual(RELEASE_MIN);
    }
  });

  it("l'appui qui va jusqu'à la fin des commandes n'est pas touché, et le tirage est déterministe", () => {
    const open = [INPUT_RIGHT, ...new Array<number>(9).fill(INPUT_JUMP)];
    const rng = new Rng(11);
    for (let i = 0; i < 50; i++) expect(holdVaried(open, rng)).toEqual(open);
    expect(jittered(solution, 3, new Rng(5))).toEqual(jittered(solution, 3, new Rng(5)));
  });

  it("la gigue rendue humaine ne rallonge plus les appuis courts (la physique le fait), mais garde le relâchement minimal", () => {
    const short = [INPUT_RIGHT, INPUT_JUMP, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_JUMP, INPUT_JUMP, INPUT_RIGHT];
    const h = humanized(short);
    expect(presses(h)[0]).toBe(1);
    const gap = appuis(h);
    expect(gap[1]!.from - gap[0]!.to).toBeGreaterThanOrEqual(RELEASE_MIN);
    // La règle d'avant (5 pas) reste demandable pour comparer.
    expect(presses(humanized(short, 5))[0]).toBe(5);
  });
});

describe("la règle des appuis humains (lot 30)", () => {
  it("un appui de moins de 10 pas est refusé, 10 pas passent", () => {
    expect(PRESS_MIN).toBe(JUMP_MIN_HOLD);
    const press = (n: number) => [INPUT_RIGHT, ...new Array<number>(n).fill(INPUT_JUMP), INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT];
    expect(pressProblems(press(9))).toMatch(/appui de saut de 9 pas \(au moins 10\)/);
    expect(pressProblems(press(5))).not.toBeNull();
    expect(pressProblems(press(10))).toBeNull();
    expect(pressProblems(press(24))).toBeNull();
    expect(shortestPress(press(10))).toBe(10);
  });

  it("chaque solution gardée du catalogue tient la règle : appuis d'au moins 10 pas, relâchements d'au moins 3", () => {
    let n = 0;
    for (const def of MODULES)
      def.variants.forEach((_, v) => {
        const s = moduleSolutions(def.id, v);
        for (const entry of ["arret", "elan"] as const) {
          const sol = s?.[entry];
          if (!sol) continue;
          n++;
          const inputs = fromRuns(decodeReplay(sol.code).runs);
          expect(pressProblems(inputs), `${def.id} v${v} ${entry}`).toBeNull();
          const shortest = shortestPress(inputs);
          if (shortest > 0) expect(shortest, `${def.id} v${v} ${entry}`).toBeGreaterThanOrEqual(PRESS_MIN);
        }
      });
    expect(n).toBeGreaterThan(500);
  });
});

// ——— Un saut qui exige une durée d'appui au pas près ———
//
// Un trou de 5 tuiles, puis un îlot de 2 tuiles surélevé de 2 tuiles (l'arrivée) sous des pics de plafond, le bas de la grille ouvert : on saute au bord du trou, le saut dure `hold` pas. Plus l'appui
// est long, plus le saut est haut et long : trop court, on tombe dans le trou ; trop long, on se plante dans les pics. Seules **quatre durées d'appui consécutives** (13 à 16 pas, 33 ms) réussissent. La
// règle (gigue ±3 sur les instants + durée variée de ±4 pas, seuil `HUMAIN_MIN`) le refuse ; le même îlot sans pics (toute durée d'au moins 13 pas passe) est accepté.
function islandLevel(spikes: boolean): Level {
  const g = 5;
  const w = 2;
  const H = 2;
  const W = 8 + g + w + 6;
  const R = 16;
  const floor = R - 3;
  const rows: string[][] = Array.from({ length: R }, () => Array<string>(W).fill("."));
  for (let c = 0; c < 8; c++) {
    rows[floor]![c] = "#";
    rows[floor + 1]![c] = "#";
  }
  for (let c = 8 + g; c < 8 + g + w; c++) for (let r = floor - H; r < R; r++) rows[r]![c] = "#";
  rows[floor - 1]![1] = "S";
  rows[floor - H - 1]![8 + g + w - 1] = "F";
  if (spikes) for (let c = 8 + g; c < 8 + g + w; c++) rows[floor - H - 2]![c] = "v";
  return parseLevel(rows.map((r) => r.join("")).join("\n") + `\n\nversion ${MIN_HOLD_VERSION}`);
}

/** La suite : droite tenue jusqu'à un tiers de tuile du bord du trou, puis saut tenu `hold` pas, droite toujours tenue. */
function jumpInputs(level: Level, hold: number): number[] {
  let s: AttemptState = initialAttempt(level);
  const inputs: number[] = [];
  for (let t = 0; t < 400 && s.player.x + 1536 < 8 * 4096; t++) {
    s = stepAttempt(s, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
    inputs.push(INPUT_RIGHT);
  }
  for (let t = 0; t < hold; t++) inputs.push(INPUT_RIGHT | INPUT_JUMP);
  for (let t = 0; t < 80; t++) inputs.push(INPUT_RIGHT);
  return inputs;
}

const reaches = (level: Level, inputs: readonly number[]) => play(level, initialAttempt(level), inputs, EXTRA_TICKS).finished;
const windowOf = (level: Level) => {
  const ok: number[] = [];
  for (let hold = JUMP_MIN_HOLD; hold <= 40; hold++) if (reaches(level, jumpInputs(level, hold))) ok.push(hold);
  return ok;
};
/** Taux de réussite (‰) de la suite sous la gigue ±3 et la variation de durée ±4 (la mesure de `measureMargins`, sans le raccord). */
function rate(level: Level, inputs: readonly number[]): number {
  const rng = new Rng(2026);
  let ok = 0;
  for (let d = 0; d < GIGUE_DRAWS; d++) if (reaches(level, jittered(inputs, 3, rng))) ok++;
  return Math.round((ok * 1000) / GIGUE_DRAWS);
}

describe("tolérance sur la durée d'un appui (lot 30)", () => {
  const narrow = islandLevel(true);
  const wide = islandLevel(false);

  it("le saut ne réussit que pour quatre durées d'appui consécutives (13 à 16 pas) ; sans les pics, pour toute durée d'au moins 13", () => {
    expect(windowOf(narrow)).toEqual([13, 14, 15, 16]);
    const ok = windowOf(wide);
    expect(ok[0]).toBe(13);
    expect(ok.length).toBe(40 - 13 + 1);
  });

  it("un saut qui exige une durée d'appui au pas près est refusé : moins d'une fois sur deux sous la gigue ±3 et la variation de ±4 pas", () => {
    for (const hold of [14, 15]) {
      const r = rate(narrow, jumpInputs(narrow, hold));
      expect(r, `appui nominal de ${hold} pas`).toBeLessThan(HUMAIN_MIN);
    }
  });

  it("sans la variation de durée (la gigue d'avant le lot), la même suite passerait : c'est la règle du lot 30 qui la refuse", () => {
    const rng = new Rng(2026);
    let ok = 0;
    for (let d = 0; d < GIGUE_DRAWS; d++) if (reaches(narrow, jitteredInstants(jumpInputs(narrow, 15), 3, rng))) ok++;
    expect(Math.round((ok * 1000) / GIGUE_DRAWS)).toBeGreaterThanOrEqual(HUMAIN_MIN);
  });

  it("un saut réussi pour toute durée d'au moins 13 pas est accepté quand l'appui nominal est à l'intérieur de la fenêtre large", () => {
    expect(rate(wide, jumpInputs(wide, 20))).toBeGreaterThanOrEqual(HUMAIN_MIN);
  });
});
