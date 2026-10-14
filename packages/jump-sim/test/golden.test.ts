import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  ESSAI_ASCII,
  ESSAI_LEVEL,
  JUMP_SIM_VERSION,
  SANDBOX_ASCII,
  SANDBOX_LEVEL,
  SANDBOX_MARKS,
  initialAttempt,
  initialPlayer,
  stepAttempt,
  stepPlayer,
  type AttemptState,
  type JumpParams,
  type PlayerState,
} from "../src/index";
import { J, L, R, T, climbChimney, climbWall, compress, expand, standAt } from "./helpers";

// Référence du personnage (lot 1) : quelques suites de commandes jouées sur le bac à sable, leur état final et une empreinte de toute
// la trajectoire, figés dans `fixtures/golden.json`. Tout changement de résultat (physique, réglage par défaut, bac à sable) fait
// échouer ce test : comprendre pourquoi, incrémenter `JUMP_SIM_VERSION`, puis régénérer :
//   UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden.test.ts
// Les suites de la cheminée et du mur sont produites par les pilotes de `helpers.ts` à la régénération, puis rejouées telles quelles.
// Lot 2 : la solution du niveau d'essai (`fixtures/essai-solution.json`) rejouée par `stepAttempt` : temps, état final et empreinte
// de chaque pas (personnage, chrono, statut, blocs friables, sections). Les suites du lot 1 n'ont pas bougé (mêmes empreintes) ; seuls
// les deux nouveaux réglages (`crumbleDelay`, `springSpeed`) sont venus s'ajouter à `params`.

const FILE = join(import.meta.dirname, "fixtures/golden.json");
const FLOOR = SANDBOX_MARKS.floorRow;

interface Script {
  /** Colonne où le personnage commence, posé au sol (rangée du sol du bac à sable) ; `null` = le départ `S`. */
  col: number | null;
  inputs: [number, number][];
}

interface GoldenRun {
  col: number | null;
  inputs: [number, number][];
  ticks: number;
  /** Empreinte FNV-1a de tous les champs de tous les états de la trajectoire. */
  trace: string;
  final: PlayerState;
}

/** L'essai final, sans la grille (remplacée par son empreinte). */
type FinalAttempt = Omit<AttemptState, "tiles"> & { tiles: string };

interface GoldenEssai {
  /** Empreinte du texte du niveau d'essai. */
  level: string;
  ticks: number;
  /** Chrono à l'arrivée, en pas : le temps de l'auteur. */
  time: number;
  trace: string;
  final: FinalAttempt;
}

interface Golden {
  jumpSimVersion: number;
  params: JumpParams;
  /** Empreinte du texte du bac à sable : le modifier change le résultat d'un essai. */
  sandbox: string;
  runs: Record<string, GoldenRun>;
  essai: GoldenEssai;
}

function hashNumbers(values: readonly number[]): string {
  let h = 2166136261;
  for (const v of values) h = fnv(h, v);
  return h.toString(16).padStart(8, "0");
}

/** Rejoue la solution de l'essai. */
function playEssai(): GoldenEssai {
  const solution = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/essai-solution.json"), "utf8")) as { inputs: [number, number][] };
  const inputs = expand(solution.inputs);
  let s = initialAttempt(ESSAI_LEVEL);
  let h = 2166136261;
  for (const input of inputs) {
    s = stepAttempt(s, input, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
    for (const v of Object.values(s.player)) h = fnv(h, v);
    for (const v of [s.status, s.time, s.deathCause, s.springCell, s.springTime, ...s.crumbles, ...s.sections]) h = fnv(h, v);
  }
  const final: FinalAttempt = { ...s, tiles: hashNumbers(s.tiles) };
  return { level: textHash(ESSAI_ASCII), ticks: inputs.length, time: s.time, trace: h.toString(16).padStart(8, "0"), final };
}

function fnv(h: number, v: number): number {
  return Math.imul(h ^ (v | 0), 16777619) >>> 0;
}

function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = fnv(h, text.charCodeAt(i));
  return h.toString(16).padStart(8, "0");
}

function startOf(col: number | null): PlayerState {
  return col === null ? initialPlayer(SANDBOX_LEVEL) : standAt(SANDBOX_LEVEL, col, FLOOR);
}

function play(script: Script): GoldenRun {
  let s = startOf(script.col);
  let h = 2166136261;
  const inputs = expand(script.inputs);
  for (const input of inputs) {
    s = stepPlayer(s, input, SANDBOX_LEVEL, DEFAULT_JUMP_PARAMS);
    for (const v of Object.values(s)) h = fnv(h, v);
  }
  return { col: script.col, inputs: script.inputs, ticks: inputs.length, trace: h.toString(16).padStart(8, "0"), final: s };
}

/** Les suites jouées (régénérées par `UPDATE_GOLDEN`). */
function scripts(): Record<string, Script> {
  const [chimney] = SANDBOX_MARKS.chimneys[0];
  const [wall] = SANDBOX_MARKS.wall;
  const chim = climbChimney(SANDBOX_LEVEL, standAt(SANDBOX_LEVEL, chimney + 1, FLOOR), 1, SANDBOX_MARKS.chimneyTopRow * T, 600);
  const climb = climbWall(SANDBOX_LEVEL, standAt(SANDBOX_LEVEL, wall - 1, FLOOR), 1, 360);
  return {
    // Course, saut complet, saut court, demi-tour, montée sur l'escalier de plates-formes.
    "course-saut": {
      col: null,
      inputs: [[R, 50], [R | J, 45], [R, 25], [0, 15], [L, 20], [L | J, 3], [L, 40], [R, 10], [R | J, 60], [J, 10], [0, 40]],
    },
    // Les trous au niveau du sol, en courant et en sautant au jugé (certains sauts tombent dans la fosse et en ressortent).
    trous: {
      col: SANDBOX_MARKS.gaps[0][0] - 4,
      inputs: [[R, 20], [R | J, 30], [R, 10], [R | J, 30], [R, 8], [R | J, 40], [R, 12], [R | J, 45], [R, 6], [R | J, 50], [0, 30]],
    },
    cheminee: { col: chimney + 1, inputs: compress(chim.inputs) },
    "saut-mural": { col: wall - 1, inputs: compress(climb.inputs) },
  };
}

if (process.env.UPDATE_GOLDEN) {
  const runs: Record<string, GoldenRun> = {};
  for (const [name, script] of Object.entries(scripts())) runs[name] = play(script);
  const golden: Golden = { jumpSimVersion: JUMP_SIM_VERSION, params: { ...DEFAULT_JUMP_PARAMS }, sandbox: textHash(SANDBOX_ASCII), runs, essai: playEssai() };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

describe("référence du personnage (golden)", () => {
  it("est celle de cette version de la simulation, avec les réglages par défaut et le bac à sable actuels", () => {
    expect(golden.jumpSimVersion, "JUMP_SIM_VERSION a changé : régénérer la référence (UPDATE_GOLDEN=1)").toBe(JUMP_SIM_VERSION);
    expect(DEFAULT_JUMP_PARAMS, "réglages par défaut changés : JUMP_SIM_VERSION +1 puis UPDATE_GOLDEN=1").toEqual(golden.params);
    expect(textHash(SANDBOX_ASCII), "bac à sable modifié : JUMP_SIM_VERSION +1 puis UPDATE_GOLDEN=1").toBe(golden.sandbox);
  });

  for (const name of ["course-saut", "trous", "cheminee", "saut-mural"]) {
    it(`« ${name} » rejoue exactement la même trajectoire`, () => {
      const ref = golden.runs[name]!;
      expect(ref, `suite « ${name} » absente de la référence`).toBeDefined();
      const run = play({ col: ref.col, inputs: ref.inputs });
      expect(run.ticks).toBe(ref.ticks);
      expect(run.final).toEqual(ref.final);
      expect(run.trace).toBe(ref.trace);
    });
  }

  it("la solution du niveau d'essai rejoue exactement : même temps de l'auteur, même état final, même trajectoire", () => {
    const ref = golden.essai;
    expect(textHash(ESSAI_ASCII), "niveau d'essai modifié : JUMP_SIM_VERSION +1, SOLVE=1 puis UPDATE_GOLDEN=1").toBe(ref.level);
    const run = playEssai();
    expect(run.ticks).toBe(ref.ticks);
    expect(run.time).toBe(ref.time);
    expect(run.final).toEqual(ref.final);
    expect(run.trace).toBe(ref.trace);
  });

  it("les suites de la référence font ce qu'elles disent (la cheminée est montée, le mur est remonté)", () => {
    const chim = golden.runs.cheminee!.final;
    expect(chim.y + 3072).toBeLessThanOrEqual(SANDBOX_MARKS.chimneyTopRow * T);
    const climbed = golden.runs["saut-mural"]!;
    expect(climbed.ticks).toBe(360);
    const course = golden.runs["course-saut"]!.final;
    expect(course.x).toBeGreaterThan(startOf(null).x);
  });
});
