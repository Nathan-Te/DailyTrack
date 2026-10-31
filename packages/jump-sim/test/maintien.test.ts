import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  JUMP_MICRO_MAX,
  JUMP_MIN_HOLD,
  JUMP_SIM_VERSION,
  MIN_HOLD_VERSION,
  initialAttempt,
  isDefaultJumpParams,
  parseLevel,
  stepAttempt,
  stepPlayerJump,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { J, P, R, T, expand, floatAt, level, room, standAt } from "./helpers";

// Lot 30 — le maintien minimal du saut : un saut relâché avant `JUMP_MIN_HOLD` pas continue comme s'il était tenu jusque-là.

const HOLD = JUMP_MIN_HOLD;
const step = (s: PlayerState, input: number, lv: Level, minHold: number, p: Readonly<JumpParams> = P, micro = 0) => stepPlayerJump(s, input, lv, p, null, null, 0, minHold, micro);

/** La trajectoire (x, y, vx, vy, sol) d'un saut dont l'appui dure `press` pas, puis `after` pas relâchés. */
function arc(lv: Level, start: PlayerState, press: number, minHold: number, total = 170, dir = 0, micro = 0): number[][] {
  let s = start;
  const out: number[][] = [];
  for (let t = 0; t < total; t++) {
    s = step(s, (t < press ? INPUT_JUMP : 0) | dir, lv, minHold, P, micro);
    out.push([s.x, s.y, s.vx, s.vy, s.ground]);
  }
  return out;
}

describe("maintien minimal du saut (lot 30)", () => {
  const lv = room(40, 12);
  const start = standAt(lv, 4, 11);

  it("la constante vaut 10 pas (83 ms) et la version 13", () => {
    expect(HOLD).toBe(10);
    expect(MIN_HOLD_VERSION).toBe(13);
    expect(JUMP_SIM_VERSION).toBeGreaterThanOrEqual(13);
  });

  it("tout appui de 1 à 10 pas donne exactement la même trajectoire, au bit près (sans micro-saut)", () => {
    const ref = arc(lv, start, HOLD, HOLD);
    for (let press = 1; press <= HOLD; press++) expect(arc(lv, start, press, HOLD), `appui de ${press} pas`).toEqual(ref);
  });

  it("le petit saut est celui qu'un appui de 10 pas donnait avant (hauteur et courbe inchangées)", () => {
    const sans = arc(lv, start, HOLD, 0);
    expect(arc(lv, start, 1, HOLD)).toEqual(sans);
    expect(arc(lv, start, 5, HOLD)).toEqual(sans);
  });

  it("au-delà de 10 pas, la courbe est celle d'avant (la coupe agit au pas du relâchement)", () => {
    for (const press of [11, 12, 15, 20, 30, 60]) expect(arc(lv, start, press, HOLD), `appui de ${press} pas`).toEqual(arc(lv, start, press, 0));
  });

  it("chaque pas d'appui de plus, après 10, monte plus haut ; le petit saut est plus haut qu'un appui de 5 pas d'avant", () => {
    const apex = (press: number, minHold: number) => Math.min(...arc(lv, start, press, minHold).map((p) => p[1]!));
    expect(apex(1, HOLD)).toBe(apex(HOLD, HOLD));
    expect(apex(1, HOLD)).toBeLessThan(apex(5, 0));
    expect(apex(1, 0)).toBeGreaterThan(apex(5, 0));
    for (let press = HOLD; press < 24; press++) expect(apex(press + 1, HOLD), `appui de ${press + 1} pas`).toBeLessThan(apex(press, HOLD));
  });

  it("micro-saut : un appui de JUMP_MICRO_MAX pas ou moins coupe le saut comme avant (0,98 tuile à 1 pas), du 5ᵉ au 10ᵉ pas c'est le petit saut", () => {
    expect(JUMP_MICRO_MAX).toBe(4);
    for (let press = 1; press <= JUMP_MICRO_MAX; press++) expect(arc(lv, start, press, HOLD, 170, 0, JUMP_MICRO_MAX), `appui de ${press} pas`).toEqual(arc(lv, start, press, 0));
    const small = arc(lv, start, HOLD, HOLD, 170, 0, JUMP_MICRO_MAX);
    for (let press = JUMP_MICRO_MAX + 1; press <= HOLD; press++) expect(arc(lv, start, press, HOLD, 170, 0, JUMP_MICRO_MAX), `appui de ${press} pas`).toEqual(small);
    for (const press of [11, 14, 20, 40]) expect(arc(lv, start, press, HOLD, 170, 0, JUMP_MICRO_MAX), `appui de ${press} pas`).toEqual(arc(lv, start, press, 0));
    const apex = (rows: number[][]) => Math.min(...rows.map((r) => r[1]!));
    expect(apex(arc(lv, start, 1, HOLD, 170, 0, JUMP_MICRO_MAX))).toBeGreaterThan(apex(small));
  });

  it("micro-saut : un appui bref pendant la chute (tampon), relâché avant que le saut parte, reste un micro-saut ; un appui franc relâché de même est le petit saut", () => {
    // Tampon : on appuie en l'air juste avant de toucher le sol, le saut part à l'atterrissage.
    const jumpAfterFall = (press: number) => {
      let s: PlayerState = { ...standAt(lv, 4, 11), ground: 0, air: 255, y: standAt(lv, 4, 11).y - 1600, vy: 300 };
      const ys: number[] = [];
      for (let t = 0; t < 140; t++) {
        s = step(s, t < press ? INPUT_JUMP : 0, lv, HOLD, P, JUMP_MICRO_MAX);
        ys.push(s.y);
      }
      return ys;
    };
    const apex = (ys: number[]) => Math.min(...ys);
    expect(apex(jumpAfterFall(2))).toBeGreaterThan(apex(jumpAfterFall(8)));
    expect(apex(jumpAfterFall(6))).toBe(apex(jumpAfterFall(9)));
  });

  it("une version sans maintien (0) ne change rien : mêmes états, sans le champ jumpAge", () => {
    let a = start;
    let b = start;
    for (let t = 0; t < 120; t++) {
      const input = t < 3 ? J : t === 40 ? J : R;
      a = step(a, input, lv, 0);
      b = stepPlayerJump(b, input, lv, P, null);
      expect(a).toEqual(b);
      expect("jumpAge" in a).toBe(false);
    }
  });

  it("le saut mural et le saut de coyote sont aussi tenus jusqu'à 10 pas", () => {
    const wall = level(["#.......", "#.......", "#.......", "#.......", "#.......", "#.......", "#.......", "#S.....F", "########"]);
    // Contre le mur gauche, en l'air, en glissant : un saut mural court (1 pas) vaut le saut mural de 10 pas.
    const hang = (n: number, hold: number) => {
      let s = floatAt(wall, T + 100, 3 * T, 0, 120);
      s = { ...s, wallSide: -1, wallAir: 0, x: T };
      const out: number[][] = [];
      for (let t = 0; t < 130; t++) {
        s = step(s, t < n ? J : 0, wall, hold);
        out.push([s.x, s.y, s.vx, s.vy]);
      }
      return out;
    };
    expect(hang(1, HOLD)).toEqual(hang(HOLD, HOLD));
    // Coyote : quitter le sol puis appuyer court.
    const coyote = (n: number) => {
      let s = standAt(lv, 4, 11);
      s = { ...s, ground: 0, air: 3, y: s.y - 1 };
      const out: number[][] = [];
      for (let t = 0; t < 110; t++) {
        s = step(s, t < n ? J : 0, lv, HOLD);
        out.push([s.x, s.y, s.vy]);
      }
      return out;
    };
    expect(coyote(2)).toEqual(coyote(HOLD));
  });

  it("un appui bref puis un nouvel appui tenu au pas 10 : pas de coupe tant que le bouton est tenu", () => {
    const seq = expand([[J, 3], [0, 2], [J, 15], [0, 100]]);
    let s = start;
    let cutAt = -1;
    for (let t = 0; t < seq.length; t++) {
      const before = s.vy;
      s = step(s, seq[t]!, lv, HOLD);
      if (cutAt < 0 && s.vy === -DEFAULT_JUMP_PARAMS.jumpCut && before < -DEFAULT_JUMP_PARAMS.jumpCut) cutAt = t;
    }
    // Relâché au pas 20 (3 + 2 + 15) : la coupe vient là, pas au pas 10.
    expect(cutAt).toBe(20);
  });

  it("jumpAge : présent seulement pendant la montée d'un saut avec maintien", () => {
    let s = standAt(lv, 4, 11);
    s = step(s, J, lv, HOLD);
    expect(s.jumpAge).toBe(0);
    s = step(s, 0, lv, HOLD);
    expect(s.jumpAge).toBe(1);
    for (let t = 0; t < 300 && s.ground === 0; t++) s = step(s, 0, lv, HOLD);
    expect(s.ground).toBe(1);
    expect("jumpAge" in s).toBe(false);
  });
});

describe("maintien minimal et niveaux (lot 30)", () => {
  const rows = ["#" + ".".repeat(30) + "#", "#" + ".".repeat(30) + "#", "#" + ".".repeat(30) + "#", "#" + ".".repeat(30) + "#", "#S" + ".".repeat(28) + "F#", "#".repeat(32)];
  const text = rows.join("\n");

  it("un niveau de la version 13 a le maintien, un niveau d'avant non", () => {
    expect(parseLevel(text).minHold).toBe(0);
    expect(parseLevel(`${text}\n\nversion 12`).minHold).toBe(0);
    expect(parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`).minHold).toBe(HOLD);
    expect(parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`).microMax).toBe(JUMP_MICRO_MAX);
    expect(parseLevel(`${text}\n\nversion 12`).microMax).toBe(0);
    expect(parseLevel(`${text}\n\nmaintien 10`).microMax).toBe(JUMP_MICRO_MAX);
    expect(parseLevel(`${text}\n\nmaintien 0`).microMax).toBe(0);
    expect(parseLevel(`${text}\n\nmaintien 10`).minHold).toBe(10);
    expect(parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}\nmaintien 0`).minHold).toBe(0);
    expect(() => parseLevel(`${text}\n\nmaintien 99`)).toThrow();
    expect(() => parseLevel(`${text}\n\nmaintien 5\nmaintien 6`)).toThrow();
  });

  const run = (lv: Level, press: number, p: Readonly<JumpParams> = DEFAULT_JUMP_PARAMS) => {
    let s: AttemptState = initialAttempt(lv);
    const ys: number[] = [];
    for (let t = 0; t < 140; t++) {
      s = stepAttempt(s, (t < press ? INPUT_JUMP : 0) | (t >= 2 ? INPUT_RIGHT : 0), lv, p);
      ys.push(s.player.y);
    }
    return ys;
  };

  it("stepAttempt : v13, tout appui de 5 à 10 pas est le même saut, 1 à 4 pas le micro-saut d'avant ; v12 : le saut dépend de l'appui", () => {
    const v13 = parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`);
    const v12 = parseLevel(`${text}\n\nversion 12`);
    const ref = run(v13, HOLD);
    for (let press = JUMP_MICRO_MAX + 1; press <= HOLD; press++) expect(run(v13, press), `appui de ${press}`).toEqual(ref);
    for (let press = 1; press <= JUMP_MICRO_MAX; press++) expect(run(v13, press), `micro-saut de ${press}`).toEqual(run(v12, press));
    expect(run(v12, 1)).not.toEqual(run(v12, HOLD));
    // Même saut qu'un appui de 10 pas d'avant la version 13.
    expect(run(v13, 6)).toEqual(run(v12, HOLD));
    expect(run(v13, 20)).toEqual(run(v12, 20));
  });

  it("le réglage `jumpMinHold` remplace celui du niveau et rend la partie « tuned »", () => {
    const v13 = parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`);
    const v12 = parseLevel(`${text}\n\nversion 12`);
    const sans: JumpParams = { ...DEFAULT_JUMP_PARAMS, jumpMinHold: 0 };
    const avec: JumpParams = { ...DEFAULT_JUMP_PARAMS, jumpMinHold: 20 };
    expect(run(v13, 3, sans)).toEqual(run(v12, 3));
    expect(run(v12, 6, { ...DEFAULT_JUMP_PARAMS, jumpMinHold: HOLD })).toEqual(run(v13, 6));
    // Sans micro-saut (réglage à 0), tout appui bref est le petit saut.
    expect(run(v13, 1, { ...DEFAULT_JUMP_PARAMS, jumpMicroMax: 0 })).toEqual(run(v13, HOLD));
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, jumpMicroMax: 0 })).toBe(false);
    expect(run(v13, 6, avec)).toEqual(run(v13, 20, avec));
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams(sans)).toBe(false);
    expect(isDefaultJumpParams(avec)).toBe(false);
  });
});
