import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  COUNTER_CAP,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  INPUT_MASK,
  MAX_SPEED,
  MODULES,
  MODULE_ENTRIES,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SANDBOX_LEVEL,
  SANDBOX_MARKS,
  SPRINT_TRIAL_PARAMS,
  boxHits,
  buildModule,
  decodeReplay,
  fromRuns,
  initialAttempt,
  isDefaultJumpParams,
  moduleStart,
  replayStartState,
  sprintTop,
  stepAttempt,
  stepPlayer,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { MODULE_SOLUTIONS } from "../src/catalog";
import { J, L, R, T, floatAt, hold, room, standAt } from "./helpers";

// Lot 8b : l'essai d'élan progressif (`sprintMode` = 1, panneau `?debug&tune` seulement). Éteint, rien ne change : mêmes états, au champ
// près (pas de champ `sprint`), donc mêmes empreintes de trajectoire que les golden. Allumé : l'élan démarre après `sprintDelay` pas au sol
// à pleine vitesse, se garde en l'air, se perd au lâcher, au mur et au demi-tour, et reste sous `MAX_SPEED`.

const ELAN: Readonly<JumpParams> = { ...DEFAULT_JUMP_PARAMS, ...SPRINT_TRIAL_PARAMS };
/** L'élan éteint, mais ses autres réglages présents (et extrêmes) : ils ne doivent rien changer. */
const OFF: Readonly<JumpParams> = { ...DEFAULT_JUMP_PARAMS, sprintMode: 0, sprintSpeed: 2000, sprintDelay: 0, sprintAccel: 40 };
const FLOOR = SANDBOX_MARKS.floorRow;
const RUN = DEFAULT_JUMP_PARAMS.runSpeed;
/** Une longue salle plate, pour courir sans rien heurter. */
const HALL = room(160, 8);
const HALL_ROW = 7;

/** Les états de toute une course, `inputs` un par pas. */
function trace(lv: Level, s: PlayerState, inputs: readonly number[], p: Readonly<JumpParams>): PlayerState[] {
  const out: PlayerState[] = [];
  for (const i of inputs) out.push((s = stepPlayer(s, i, lv, p)));
  return out;
}

const repeat = (input: number, n: number) => new Array<number>(n).fill(input);

describe("élan éteint (mode 0) : trajectoires identiques", () => {
  it("les réglages par défaut et l'élan éteint ne portent pas la partie `tuned` ; l'élan allumé, si", () => {
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams(OFF)).toBe(true);
    expect(isDefaultJumpParams(ELAN)).toBe(false);
    expect("sprintMode" in DEFAULT_JUMP_PARAMS).toBe(false);
  });

  it("fuzz : mêmes états au pas près (sans champ `sprint`) avec les défauts et avec l'élan éteint", () => {
    const rng = new Rng(20261015);
    let steps = 0;
    for (let run = 0; run < 30; run++) {
      const col = 3 + rng.int(150);
      let a = standAt(SANDBOX_LEVEL, col, FLOOR);
      if (boxHits(SANDBOX_LEVEL, a.x, a.y, PLAYER_WIDTH, PLAYER_HEIGHT)) a = standAt(SANDBOX_LEVEL, SANDBOX_MARKS.start, FLOOR);
      let b = a;
      let input = 0;
      let left = 0;
      for (let t = 0; t < 1500; t++) {
        if (left-- <= 0) {
          input = rng.int(INPUT_MASK + 1);
          left = rng.int(60);
        }
        a = stepPlayer(a, input, SANDBOX_LEVEL, DEFAULT_JUMP_PARAMS);
        b = stepPlayer(b, input, SANDBOX_LEVEL, OFF);
        if (t % 97 === 0 || "sprint" in a || "sprint" in b) {
          expect("sprint" in a || "sprint" in b, `essai ${run}, pas ${t}`).toBe(false);
        }
        expect(b, `essai ${run}, pas ${t}`).toEqual(a);
        steps++;
      }
    }
    expect(steps).toBe(45_000);
  });

  it("un échantillon des solutions stockées (morceaux, les deux entrées ; niveau d'essai) se rejoue à l'identique, élan éteint", () => {
    const play = (lv: Level, start: AttemptState, inputs: readonly number[], p: Readonly<JumpParams>) => {
      let s = start;
      const states: AttemptState[] = [];
      for (const i of inputs) states.push((s = stepAttempt(s, i, lv, p)));
      return states;
    };
    let checked = 0;
    for (const def of MODULES.filter((_, k) => k % 4 === 0)) {
      const m = buildModule(def.id, 0);
      for (const entry of MODULE_ENTRIES) {
        const sol = MODULE_SOLUTIONS.modules[def.id]!.variants[0]![entry]!;
        const inputs = fromRuns(decodeReplay(sol.code).runs);
        const a = play(m.level, moduleStart(m, entry), inputs, DEFAULT_JUMP_PARAMS);
        const b = play(m.level, moduleStart(m, entry), inputs, OFF);
        expect(b, `${def.id} ${entry}`).toEqual(a);
        checked++;
      }
    }
    const essai = decodeReplay(ESSAI_SOLUTION_CODE);
    const inputs = fromRuns(essai.runs);
    expect(play(ESSAI_LEVEL, replayStartState(ESSAI_LEVEL, essai.start), inputs, OFF)).toEqual(play(ESSAI_LEVEL, replayStartState(ESSAI_LEVEL, essai.start), inputs, DEFAULT_JUMP_PARAMS));
    expect(checked).toBeGreaterThanOrEqual(10);
  });
});

describe("élan progressif (mode 1)", () => {
  it("valeurs de départ : 15 tuiles/s après 0,4 s à pleine vitesse, atteint en ≈ 0,57 s ; sous MAX_SPEED", () => {
    expect(SPRINT_TRIAL_PARAMS).toEqual({ sprintMode: 1, sprintSpeed: 512, sprintDelay: 48, sprintAccel: 2 });
    expect((512 * 120) / T).toBe(15);
    expect(SPRINT_TRIAL_PARAMS.sprintDelay / 120).toBe(0.4);
    expect(Math.ceil((512 - RUN) / 2) / 120).toBeCloseTo(0.575, 3);
    expect(sprintTop(ELAN)).toBe(512);
    expect(sprintTop({ ...ELAN, sprintSpeed: 100 })).toBe(RUN); // sous la course : aucun élan
    expect(sprintTop({ ...ELAN, sprintSpeed: 99_999 })).toBe(MAX_SPEED);
  });

  it("ne démarre qu'après `sprintDelay` pas au sol à pleine vitesse, puis monte jusqu'à `sprintSpeed`", () => {
    const states = trace(HALL, standAt(HALL, 2, HALL_ROW), repeat(R, 260), ELAN);
    const first = states.findIndex((s) => s.vx === RUN);
    const over = states.findIndex((s) => s.vx > RUN);
    expect(first).toBeGreaterThan(0);
    // Le pas où l'on atteint la course compte (on y est à pleine vitesse à la fin du pas) : `sprintDelay` pas à `runSpeed`, puis l'élan.
    expect(over - first).toBe(ELAN.sprintDelay);
    for (let t = first; t < over; t++) expect(states[t]!.vx).toBe(RUN);
    expect(states[over]!.vx).toBe(RUN + ELAN.sprintAccel!);
    const top = states.findIndex((s) => s.vx === 512);
    expect(top - over + 1).toBe(Math.ceil((512 - RUN) / ELAN.sprintAccel!));
    expect(states.slice(top).every((s) => s.vx === 512)).toBe(true);
    // Le même départ sans élan reste à la course.
    expect(trace(HALL, standAt(HALL, 2, HALL_ROW), repeat(R, 260), DEFAULT_JUMP_PARAMS).every((s) => s.vx <= RUN)).toBe(true);
    // À gauche, symétrique.
    const back = trace(HALL, standAt(HALL, 150, HALL_ROW), repeat(L, 260), ELAN);
    expect(back[back.length - 1]!.vx).toBe(-512);
  });

  it("un délai nul : l'élan part dès la pleine vitesse ; un délai plus long que la course : jamais", () => {
    const now = trace(HALL, standAt(HALL, 2, HALL_ROW), repeat(R, 200), { ...ELAN, sprintDelay: 0 });
    const first = now.findIndex((s) => s.vx === RUN);
    expect(now[first + 1]!.vx).toBe(RUN + 2);
    const never = trace(HALL, standAt(HALL, 2, HALL_ROW), repeat(R, 200), { ...ELAN, sprintDelay: 240 });
    expect(never.every((s) => s.vx <= RUN)).toBe(true);
  });

  /** En élan (vitesse maximale atteinte), au milieu de la salle. */
  const sprinting = () => {
    const s = hold(standAt(HALL, 2, HALL_ROW), R, 200, HALL, ELAN);
    expect(s.vx).toBe(512);
    expect(s.sprint).toBeGreaterThanOrEqual(ELAN.sprintDelay!);
    return s;
  };

  it("perdu au lâcher : la vitesse retombe à la course, et il faut de nouveau `sprintDelay` pas à pleine vitesse", () => {
    let s = sprinting();
    s = stepPlayer(s, 0, HALL, ELAN);
    expect(s.sprint).toBe(0);
    const again = trace(HALL, s, repeat(R, 140), ELAN);
    const first = again.findIndex((x) => x.vx === RUN);
    expect(first).toBeGreaterThan(0); // freinée par `groundDecel` jusqu'à la course
    expect(again.slice(0, first).every((x) => x.vx > RUN)).toBe(true);
    const over = again.findIndex((x, t) => t > first && x.vx > RUN);
    expect(over - first).toBe(ELAN.sprintDelay);
  });

  it("perdu au demi-tour", () => {
    let s = sprinting();
    s = stepPlayer(s, L, HALL, ELAN);
    expect(s.sprint).toBe(0);
    expect(s.vx).toBeLessThan(512);
    s = hold(s, L, 40, HALL, ELAN);
    expect(s.vx).toBe(-RUN); // de l'autre côté, la course seulement
  });

  it("perdu contre un mur (heurté au sol, glisse, saut mural)", () => {
    // Au sol : la salle se termine par un mur.
    let s = hold(standAt(HALL, 140, HALL_ROW), R, 200, HALL, ELAN);
    expect(s.vx).toBe(0);
    expect(s.sprint).toBe(0);
    // En glisse : lancé en élan, il saute contre le mur du bout de la salle.
    s = hold(standAt(HALL, 140, HALL_ROW), R, 145, HALL, ELAN);
    expect(s.vx).toBe(512);
    s = stepPlayer(s, R | J, HALL, ELAN);
    expect(s.ground).toBe(0);
    expect(s.sprint).toBeGreaterThan(0); // gardé au saut
    for (let t = 0; t < 120 && s.slide === 0; t++) s = stepPlayer(s, R | J, HALL, ELAN);
    expect(s.slide).toBe(1);
    expect(s.sprint).toBe(0);
    // Saut mural : il repart dans l'autre sens, sans élan.
    s = stepPlayer(stepPlayer(s, R, HALL, ELAN), R | J, HALL, ELAN);
    expect(s.vx).toBeLessThan(0);
    expect(s.sprint).toBe(0);
  });

  it("gardé en l'air : la vitesse acquise ne remonte pas et ne tombe pas d'un coup ; il continue à l'atterrissage", () => {
    let s = sprinting();
    const counter = s.sprint!;
    s = stepPlayer(s, R | J, HALL, ELAN);
    expect(s.ground).toBe(0);
    let air = 0;
    while (s.ground === 0 && air < 200) {
      s = stepPlayer(s, R | J, HALL, ELAN);
      if (s.ground === 0) {
        expect(s.vx).toBe(512);
        expect(s.sprint).toBe(counter + 1); // compté au pas du saut (au sol), pas en l'air
      }
      air++;
    }
    expect(s.ground).toBe(1);
    expect(stepPlayer(s, R, HALL, ELAN).vx).toBe(512);
    // Une vitesse entre la course et l'élan, en l'air, en élan : gardée telle quelle (le contrôle aérien ne la remonte pas).
    const mid: PlayerState = { ...floatAt(HALL, 40 * T, 3 * T, 450, -200), sprint: 200 };
    const next = stepPlayer(mid, R, HALL, ELAN);
    expect(next.vx).toBe(450);
    // Sans élan, la même vitesse en l'air est ramenée vers la course (comme avant).
    expect(stepPlayer({ ...mid, sprint: 0 }, R, HALL, ELAN).vx).toBe(450 - DEFAULT_JUMP_PARAMS.airDecel);
    // Lâcher en l'air : perdu, freinage aérien ordinaire.
    const off = stepPlayer(mid, 0, HALL, ELAN);
    expect(off.sprint).toBe(0);
    expect(off.vx).toBe(450 - DEFAULT_JUMP_PARAMS.airDecel);
  });

  it("toujours sous MAX_SPEED, même avec un élan demandé au-delà", () => {
    const p = { ...ELAN, sprintSpeed: 5000, sprintAccel: 400, sprintDelay: 0 };
    const states = trace(HALL, standAt(HALL, 2, HALL_ROW), repeat(R, 120), p);
    expect(Math.max(...states.map((s) => s.vx))).toBe(MAX_SPEED);
    expect(states.every((s) => Math.abs(s.vx) <= MAX_SPEED)).toBe(true);
  });

  it("fuzz d'intégrité, élan allumé (valeurs de départ et au hasard) : tout entier, sans −0, sous MAX_SPEED, hors des murs", () => {
    const rng = new Rng(8_2026);
    let total = 0;
    for (let run = 0; run < 50; run++) {
      const p: JumpParams =
        run % 2 === 0 ? { ...ELAN } : { ...ELAN, sprintSpeed: rng.int(2600), sprintDelay: rng.int(COUNTER_CAP + 20), sprintAccel: rng.chance(10) ? rng.int(3000) : rng.int(41) };
      const lv = run % 3 === 0 ? HALL : SANDBOX_LEVEL;
      let s = lv === HALL ? standAt(HALL, 2 + rng.int(150), HALL_ROW) : standAt(SANDBOX_LEVEL, SANDBOX_MARKS.start + rng.int(25), FLOOR);
      let input = 0;
      let left = 0;
      for (let t = 0; t < 1200; t++) {
        if (left-- <= 0) {
          input = rng.chance(2) ? R : rng.int(INPUT_MASK + 1);
          left = rng.int(120);
        }
        s = stepPlayer(s, input, lv, p);
        const where = `essai ${run}, pas ${t}`;
        for (const [k, v] of Object.entries(s)) if (!Number.isInteger(v) || Object.is(v, -0)) throw new Error(`${where} : ${k} = ${String(v)}`);
        if (Math.abs(s.vx) > MAX_SPEED || Math.abs(s.vy) > MAX_SPEED) throw new Error(`${where} : vitesse ${s.vx}, ${s.vy}`);
        if (boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : dans un mur`);
        if (s.sprint === undefined || s.sprint < 0 || s.sprint > COUNTER_CAP) throw new Error(`${where} : sprint = ${String(s.sprint)}`);
        total++;
      }
    }
    expect(total).toBe(60_000);
  });

  it("dans un essai (stepAttempt) : morts, reprises et ressorts gardent un état entier ; la reprise repart sans élan", () => {
    const solution = decodeReplay(ESSAI_SOLUTION_CODE);
    let s = replayStartState(ESSAI_LEVEL, solution.start);
    let max = 0;
    for (const bits of fromRuns(solution.runs)) {
      s = stepAttempt(s, bits, ESSAI_LEVEL, ELAN);
      for (const [k, v] of Object.entries(s.player)) expect(Number.isInteger(v) && !Object.is(v, -0), k).toBe(true);
      max = Math.max(max, Math.abs(s.player.vx));
    }
    expect(max).toBeLessThanOrEqual(MAX_SPEED);
    expect("sprint" in initialAttempt(ESSAI_LEVEL).player).toBe(false);
  });
});

