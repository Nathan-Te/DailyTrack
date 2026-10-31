import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
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
const step = (s: PlayerState, input: number, lv: Level, minHold: number, p: Readonly<JumpParams> = P) => stepPlayerJump(s, input, lv, p, null, null, 0, minHold);

/** La trajectoire (x, y, vx, vy, sol) d'un saut dont l'appui dure `press` pas, puis `after` pas relâchés. */
function arc(lv: Level, start: PlayerState, press: number, minHold: number, total = 170, dir = 0): number[][] {
  let s = start;
  const out: number[][] = [];
  for (let t = 0; t < total; t++) {
    s = step(s, (t < press ? INPUT_JUMP : 0) | dir, lv, minHold);
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

  it("tout appui de 1 à 10 pas donne exactement la même trajectoire, au bit près", () => {
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

  it("stepAttempt : v13, tout appui de 1 à 10 pas est le même saut ; v12 : le saut dépend de l'appui", () => {
    const v13 = parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`);
    const v12 = parseLevel(`${text}\n\nversion 12`);
    const ref = run(v13, HOLD);
    for (let press = 1; press <= HOLD; press++) expect(run(v13, press), `appui de ${press}`).toEqual(ref);
    expect(run(v12, 1)).not.toEqual(run(v12, HOLD));
    // Même saut qu'un appui de 10 pas d'avant la version 13.
    expect(run(v13, 1)).toEqual(run(v12, HOLD));
    expect(run(v13, 20)).toEqual(run(v12, 20));
  });

  it("le réglage `jumpMinHold` remplace celui du niveau et rend la partie « tuned »", () => {
    const v13 = parseLevel(`${text}\n\nversion ${MIN_HOLD_VERSION}`);
    const v12 = parseLevel(`${text}\n\nversion 12`);
    const sans: JumpParams = { ...DEFAULT_JUMP_PARAMS, jumpMinHold: 0 };
    const avec: JumpParams = { ...DEFAULT_JUMP_PARAMS, jumpMinHold: 20 };
    expect(run(v13, 1, sans)).toEqual(run(v12, 1));
    expect(run(v12, 1, { ...DEFAULT_JUMP_PARAMS, jumpMinHold: HOLD })).toEqual(run(v13, 1));
    expect(run(v13, 1, avec)).toEqual(run(v13, 20, avec));
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams(sans)).toBe(false);
    expect(isDefaultJumpParams(avec)).toBe(false);
  });
});
