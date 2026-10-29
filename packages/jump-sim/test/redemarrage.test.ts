import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  AttemptRecorder,
  DEFAULT_JUMP_PARAMS,
  INPUT_ATTEMPT_MASK,
  INPUT_JUMP,
  INPUT_RESPAWN,
  INPUT_RIGHT,
  JUMP_REPLAY_FORMAT,
  JumpReplayError,
  RESPAWN_TICKS,
  RESTART_VERSION,
  BRIDGE_VERSION,
  MODULES,
  V11_ONLY_VARIANTS,
  buildModule,
  checkLife,
  dailyLevel,
  dailyProblems,
  fallbackFor,
  gustyVariants,
  jumpThemeOfSim,
  decodeReplay,
  encodeReplay,
  initialAttempt,
  isResume,
  lifeReplay,
  lifeStartProblem,
  parseLevel,
  replayAttempt,
  replayFingerprint,
  sectionPhases,
  stepAttempt,
  attemptReplay,
  type AttemptState,
  type Level,
} from "../src/index";

// Lot 27 — **un nouvel essai à zéro avant le premier point de passage, et la reprise volontaire** (niveaux en version 11). Une mort avant le premier point ne fait plus reprendre au départ
// avec un chrono qui continue (lot 15, versions 4 à 10, qu'on teste ici telles quelles) : l'essai recommence à zéro, chrono et horloge des dangers à leur phase de départ. Après le premier
// point, rien ne change. Le quatrième bit d'une commande (`INPUT_RESPAWN`) reprend tout de suite au dernier point franchi, chrono qui continue : ce n'est pas une mort.

const P = DEFAULT_JUMP_PARAMS;

/** Un sol, un départ à gauche, un point de passage au milieu, une fosse (on y meurt) entre le point et l'arrivée, et une scie à horloge. */
const ASCII = `
##############################
#............................#
#............................#
#............................#
#............................#
#S.........C.................F
##########################...#

version VERSION
section a 1-9 phase 30
section b 10-28 phase 7
scie s1 o 120 aller-retour 4,2 8,2
scie s2 o 90 boucle 14,4 20,4 20,2
`;

/** Une fosse entre le départ et le point de passage : on y tombe tout droit, avant d'avoir franchi le moindre point. */
const PIT_ASCII = `
##############################
#............................#
#............................#
#............................#
#............................#
#S.........C................F#
####....###################..#

version VERSION
section a 1-28 phase 11
scie s1 o 120 aller-retour 12,2 16,2
`;

const levelOf = (version: number): Level => parseLevel(ASCII.replace("VERSION", String(version)));
const run = (s: AttemptState, inputs: readonly number[], lv: Level): AttemptState => inputs.reduce((a, b) => stepAttempt(a, b, lv, P), s);
const times = (n: number, bits: number): number[] => new Array<number>(n).fill(bits);

/** Avance jusqu'à ce que `until` soit vrai (au plus `max` pas), avec la commande `bits`. */
function runUntil(s: AttemptState, bits: number, lv: Level, until: (s: AttemptState) => boolean, max = 4000): AttemptState {
  let t = 0;
  while (!until(s) && t++ < max) s = stepAttempt(s, bits, lv, P);
  expect(until(s)).toBe(true);
  return s;
}

/** Un état vivant avant le premier point : la mort forgée dans la scie du départ. */
const deadBeforeCheckpoint = (lv: Level, time: number): AttemptState => ({ ...initialAttempt(lv), status: ATTEMPT_DEAD, time, deathTicks: 0, deathCause: 2 });

describe("lot 27 — mort avant le premier point de passage", () => {
  const lv = levelOf(RESTART_VERSION);

  it("v11 : après l'attente, l'essai recommence à zéro — chrono à 0, état de départ exact, horloge des dangers à leur phase de départ", () => {
    const dead = deadBeforeCheckpoint(lv, 200);
    const waiting = run(dead, times(RESPAWN_TICKS - 1, 0), lv);
    // Pendant l'attente le décor continue de tourner (c'est ce qui masque le changement de position des dangers).
    expect(waiting.status).toBe(ATTEMPT_DEAD);
    expect(waiting.time).toBe(200 + RESPAWN_TICKS - 1);
    const back = stepAttempt(waiting, 0, lv, P);
    expect(back).toEqual(initialAttempt(lv));
    expect(back.time).toBe(0);
    expect(sectionPhases(lv, back)).toEqual([30, 7]);
    // Immédiat, sans décompte : le pas suivant est le pas 1 de l'essai neuf.
    const first = stepAttempt(back, 0, lv, P);
    expect([first.status, first.time]).toEqual([ATTEMPT_RUNNING, 1]);
  });

  it("un saut tenu à l'instant de la reprise ne fait pas sauter tout seul", () => {
    const dead = deadBeforeCheckpoint(lv, 50);
    const back = run(dead, times(RESPAWN_TICKS, INPUT_JUMP), lv);
    expect(back.status).toBe(ATTEMPT_READY);
    expect(back.player.held).toBe(1);
  });

  it("v4 à v10 : la même mort reprend au départ, chrono qui continue (inchangé)", () => {
    for (const version of [4, BRIDGE_VERSION]) {
      const old = levelOf(version);
      const back = run(deadBeforeCheckpoint(old, 200), times(RESPAWN_TICKS, 0), old);
      expect(back.status).toBe(ATTEMPT_RUNNING);
      expect(back.time).toBe(200 + RESPAWN_TICKS);
      expect(sectionPhases(old, back)).toEqual([200 + RESPAWN_TICKS + 30, 200 + RESPAWN_TICKS + 7]);
    }
  });

  it("après le premier point : la mort reprend sur le point, le chrono continue (v11 comme avant)", () => {
    let s = runUntil(initialAttempt(lv), INPUT_RIGHT, lv, (x) => x.checkpoint >= 0);
    const at = s.time;
    s = { ...s, status: ATTEMPT_DEAD, deathTicks: 0, deathCause: 2 };
    const back = run(s, times(RESPAWN_TICKS, 0), lv);
    expect(back.status).toBe(ATTEMPT_RUNNING);
    expect(back.checkpoint).toBe(0);
    expect(back.time).toBe(at + RESPAWN_TICKS);
  });

  it("l'essai qui finit par cette mort est clos (rediffusion « mort »), le suivant commence à zéro et s'enregistre à part", () => {
    const pit = parseLevel(PIT_ASCII.replace("VERSION", String(RESTART_VERSION)));
    const rec = new AttemptRecorder("essai", RESTART_VERSION);
    let s = initialAttempt(pit);
    const closed: NonNullable<ReturnType<AttemptRecorder["step"]>>[] = [];
    const feed = (bits: number, n: number): void => {
      for (let i = 0; i < n; i++) {
        const before = s;
        s = stepAttempt(before, bits, pit, P);
        const done = rec.step(before, bits, s);
        if (done) closed.push(done);
      }
    };
    while (s.status !== ATTEMPT_DEAD) feed(INPUT_RIGHT, 1);
    expect(s.checkpoint).toBe(-1);
    expect(closed).toHaveLength(1);
    expect(closed[0]!.end).toBe("mort");
    const first = replayAttempt(pit, closed[0]!.replay, "essai");
    expect(first.finished).toBe(false);
    expect(first.deaths).toHaveLength(1);
    expect(first.lives.map((l) => l.end)).toEqual(["mort"]);
    // L'attente, puis le retour à zéro ; l'essai suivant démarre au premier pas, chrono 1.
    feed(0, RESPAWN_TICKS);
    expect(s.status).toBe(ATTEMPT_READY);
    expect(s.time).toBe(0);
    expect(rec.recording).toBe(false);
    feed(INPUT_RIGHT, 10);
    expect(rec.recording).toBe(true);
    expect(rec.ticks).toBe(10);
    expect(s.time).toBe(10);
    expect(closed).toHaveLength(1);
  });

  it("la rediffusion d'un essai v11 ne souffre aucun pas après la mort sans point (comme en v3)", () => {
    const pit = parseLevel(PIT_ASCII.replace("VERSION", String(RESTART_VERSION)));
    const inputs = times(400, INPUT_RIGHT);
    expect(() => replayAttempt(pit, attemptReplay("essai", inputs, 0, 0, RESTART_VERSION), "essai")).toThrow(/Pas après la fin/);
  });
});

describe("lot 27 — la reprise volontaire (quatrième bit de la commande)", () => {
  const lv = levelOf(RESTART_VERSION);

  it("INPUT_RESPAWN = 8, et un niveau v11 accepte quatre bits (les anciens niveaux refusent le bit en trop)", () => {
    expect(INPUT_RESPAWN).toBe(8);
    expect(INPUT_ATTEMPT_MASK).toBe(15);
    expect(() => stepAttempt(initialAttempt(lv), 16, lv, P)).toThrow(RangeError);
    const old = levelOf(BRIDGE_VERSION);
    expect(() => stepAttempt(initialAttempt(old), INPUT_RESPAWN, old, P)).toThrow(RangeError);
  });

  it("sans point franchi la commande est sans effet : le pas se joue comme sans le bit", () => {
    const s = run(initialAttempt(lv), times(5, INPUT_RIGHT), lv);
    expect(stepAttempt(s, INPUT_RIGHT | INPUT_RESPAWN, lv, P)).toEqual(stepAttempt(s, INPUT_RIGHT, lv, P));
  });

  it("avec un point franchi : reprise tout de suite sur le point, chrono qui continue (ce pas compris), vivant, pas une mort", () => {
    const s = runUntil(initialAttempt(lv), INPUT_RIGHT, lv, (x) => x.checkpoint >= 0);
    const far = run(s, times(40, INPUT_RIGHT), lv);
    const back = stepAttempt(far, INPUT_RESPAWN, lv, P);
    expect(back.status).toBe(ATTEMPT_RUNNING);
    expect(back.checkpoint).toBe(0);
    expect(back.time).toBe(far.time + 1);
    expect(back.deathTicks).toBe(0);
    expect(back.player.x).toBeLessThan(far.player.x);
    // Le même état qu'après une mort sur ce point, au chrono près.
    const afterDeath = run({ ...far, status: ATTEMPT_DEAD, deathTicks: 0, deathCause: 2 }, times(RESPAWN_TICKS, 0), lv);
    expect({ ...back, time: 0 }).toEqual({ ...afterDeath, time: 0 });
  });

  it("un saut tenu à l'instant de la reprise ne fait pas sauter", () => {
    const s = runUntil(initialAttempt(lv), INPUT_RIGHT, lv, (x) => x.checkpoint >= 0);
    expect(stepAttempt(s, INPUT_RESPAWN | INPUT_JUMP, lv, P).player.held).toBe(1);
  });

  it("morte, l'attente de la reprise n'est pas raccourcie par la commande", () => {
    const s = runUntil(initialAttempt(lv), INPUT_RIGHT, lv, (x) => x.checkpoint >= 0);
    const dead: AttemptState = { ...s, status: ATTEMPT_DEAD, deathTicks: 0, deathCause: 2 };
    expect(stepAttempt(dead, INPUT_RESPAWN, lv, P).status).toBe(ATTEMPT_DEAD);
  });

  it("enregistrée dans la rediffusion, rejouée au bit près, et ce n'est pas une mort", () => {
    const rec = new AttemptRecorder("essai", RESTART_VERSION);
    let s = initialAttempt(lv);
    const feed = (bits: number, n: number): void => {
      for (let i = 0; i < n; i++) {
        const before = s;
        s = stepAttempt(before, bits, lv, P);
        rec.step(before, bits, s);
      }
    };
    while (s.checkpoint < 0) feed(INPUT_RIGHT, 1);
    feed(INPUT_RIGHT, 30);
    const far = s.player.x;
    feed(INPUT_RESPAWN | INPUT_RIGHT, 1);
    expect(s.player.x).toBeLessThan(far);
    feed(INPUT_RIGHT, 20);
    const replay = rec.peek()!;
    expect(replay.simVersion).toBe(RESTART_VERSION);
    const code = encodeReplay(replay);
    const back = decodeReplay(code);
    expect(back).toEqual(replay);
    expect(back.runs.some((r) => r.bits & INPUT_RESPAWN)).toBe(true);
    const result = replayAttempt(lv, back, "essai");
    expect(result.final).toEqual(s);
    expect(result.deaths).toHaveLength(0);
    expect(replayFingerprint(lv, back).deaths).toBe(0);
  });

  it("le format : v11 code une série en count × 16 + bits, les versions d'avant gardent count × 8 + bits (octets identiques)", () => {
    expect(JUMP_REPLAY_FORMAT).toBe(1);
    const runs = [{ count: 3, bits: INPUT_RIGHT }, { count: 1, bits: INPUT_RESPAWN | INPUT_RIGHT }, { count: 40, bits: 0 }];
    const v11 = decodeReplay(encodeReplay({ ...attemptReplay("essai", [], 0, 0, RESTART_VERSION), runs }));
    expect(v11.runs).toEqual(runs);
    // Une version d'avant ne connaît pas le bit.
    expect(() => encodeReplay({ ...attemptReplay("essai", [], 0, 0, BRIDGE_VERSION), runs })).toThrow(JumpReplayError);
    const old = { ...attemptReplay("essai", [], 0, 0, BRIDGE_VERSION), runs: [{ count: 3, bits: INPUT_RIGHT }, { count: 40, bits: 0 }] };
    expect(decodeReplay(encodeReplay(old))).toEqual(old);
  });

  it("isResume : vrai seulement pour un personnage vivant avec un point franchi, en v11", () => {
    const s = runUntil(initialAttempt(lv), INPUT_RIGHT, lv, (x) => x.checkpoint >= 0);
    expect(isResume(lv, s, INPUT_RESPAWN)).toBe(true);
    expect(isResume(lv, s, INPUT_RIGHT)).toBe(false);
    expect(isResume(lv, initialAttempt(lv), INPUT_RESPAWN)).toBe(false);
    expect(isResume(levelOf(BRIDGE_VERSION), s, INPUT_RESPAWN)).toBe(false);
  });

  it("une reprise clôt la vie en cours (sans mort) et en ouvre une sur le point ; chaque vie se rejoue seule", () => {
    const rec = new AttemptRecorder("essai", RESTART_VERSION);
    let s = initialAttempt(lv);
    const feed = (bits: number, n: number): void => {
      for (let i = 0; i < n; i++) {
        const before = s;
        s = stepAttempt(before, bits, lv, P);
        rec.step(before, bits, s);
      }
    };
    while (s.checkpoint < 0) feed(INPUT_RIGHT, 1);
    feed(INPUT_RIGHT, 30);
    feed(INPUT_RESPAWN, 1);
    feed(INPUT_RIGHT, 25);
    const replay = rec.peek()!;
    const result = replayAttempt(lv, replay, "essai");
    expect(result.lives.map((l) => l.end)).toEqual(["abandon", "abandon"]);
    expect(result.deaths).toHaveLength(0);
    expect(result.lives[1]!.start.checkpoint).toBe(0);
    expect(result.lives[1]!.start.time).toBe(result.lives[0]!.start.time + result.lives[0]!.ticks + 1);
    // La vie après la reprise, rejouée seule, finit au même état.
    const second = lifeReplay(replay, result.lives[1]!);
    expect(lifeStartProblem(lv, second.start)).toBeNull();
    const alone = replayAttempt(lv, second, "essai");
    expect(alone.final).toEqual(result.final);
    expect(result.lives[0]!.runs.every((r) => !(r.bits & INPUT_RESPAWN))).toBe(true);
  });
});

describe("lot 27 — les vies (checkLife) en version 11", () => {
  const lv = levelOf(RESTART_VERSION);

  it("une vie partie du départ commence à zéro : plus de reprise au départ avec un chrono qui continue", () => {
    expect(lifeStartProblem(lv, { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 })).toBeNull();
    expect(lifeStartProblem(lv, { checkpoint: -1, held: 0, time: 300, sections: [], elan: 0 })).toMatch(/commence à zéro/);
    // v10 : la reprise au départ existe toujours.
    expect(lifeStartProblem(levelOf(BRIDGE_VERSION), { checkpoint: -1, held: 0, time: 300, sections: [], elan: 0 })).toBeNull();
  });

  it("un niveau v11 refuse, au rejeu, une reprise au départ", () => {
    const replay = { simVersion: RESTART_VERSION, levelId: "essai", start: { checkpoint: -1, held: 0, time: 300, sections: [], elan: 0 }, runs: [{ count: 5, bits: 0 }] };
    expect(() => replayAttempt(lv, replay, "essai")).toThrow(JumpReplayError);
  });

  it("la vie qui finit par une mort avant le premier point passe checkLife (mort, cause et position rejouées) ; une vie vivante sans fin est « abandon »", () => {
    const pit = parseLevel(PIT_ASCII.replace("VERSION", String(RESTART_VERSION)));
    const rec = new AttemptRecorder("essai", RESTART_VERSION);
    let s = initialAttempt(pit);
    let done = null as ReturnType<AttemptRecorder["step"]>;
    while (!done) {
      const before = s;
      s = stepAttempt(before, INPUT_RIGHT, pit, P);
      done = rec.step(before, INPUT_RIGHT, s);
    }
    const r = checkLife(pit, done.replay, "essai");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.life.end).toBe("mort");
      expect(r.life.startTime).toBe(0);
      expect(r.life.death?.cause).toBe(s.deathCause);
    }
    const alive = checkLife(pit, attemptReplay("essai", times(5, INPUT_RIGHT), 0, 0, RESTART_VERSION), "essai");
    expect(alive.ok && alive.life.end).toBe("abandon");
  });
});

describe("lot 27 — forêt : le vent souffle en continu (g21)", () => {
  const from = daysFromCivil(2026, 10, 27);
  const forestDays = Array.from({ length: 120 }, (_, k) => from + k).filter((d) => jumpThemeOfSim(d, RESTART_VERSION) === "foret"); // lot V1 : les niveaux v11, au thème de l'ancienne règle

  it("plus aucune rafale dans les nouveaux niveaux de forêt : ni zone en rafale, ni secours, aucune règle enfreinte ; du vent, pourtant", () => {
    expect(forestDays.length).toBeGreaterThan(20);
    let winds = 0;
    for (const d of forestDays) {
      const L = dailyLevel(d, null, RESTART_VERSION);
      expect(L.level.winds.filter((w) => w.gust !== null), L.date).toEqual([]);
      expect(L.fallback, L.date).toBe(false);
      expect(dailyProblems(L), L.date).toEqual([]);
      winds += L.level.winds.length;
    }
    expect(winds, "la forêt a toujours son vent").toBeGreaterThan(forestDays.length);
  }, 120_000);

  it("la référence v10 (g20) garde ses rafales, au bit près : au moins une forêt de ces jours en a encore", () => {
    const withGust = forestDays.filter((d) => dailyLevel(d, null, BRIDGE_VERSION).level.winds.some((w) => w.gust !== null));
    expect(withGust.length).toBeGreaterThan(0);
  }, 120_000);

  it("les variantes à rafales gardent leur place ; les variantes continues sont ajoutées au bout (jamais au milieu), `cycle=0`, sans rafale", () => {
    const gusty = gustyVariants();
    expect(Object.keys(gusty).sort()).toEqual(["champignon-rafale", "champignon-tourbillon", "vent-rafale", "vent-relais"]);
    for (const [id, list] of Object.entries(V11_ONLY_VARIANTS)) {
      const def = MODULES.find((d) => d.id === id)!;
      expect(def.variants.length, id).toBe(Math.max(...list) + 1);
      for (const v of list) {
        expect(gusty[id]?.includes(v) ?? false, `${id} v${v}`).toBe(false);
        expect(buildModule(id, v).level.winds.length, `${id} v${v} : du vent`).toBeGreaterThan(0);
        expect(buildModule(id, v).level.winds.some((w) => w.gust !== null), `${id} v${v}`).toBe(false);
      }
      // Les variantes d'avant sont toutes à rafales et n'ont pas bougé de place.
      for (let v = 0; v < Math.min(...list); v++) expect(gusty[id]?.includes(v), `${id} v${v}`).toBe(true);
    }
  });

  it("la suite de secours de la forêt n'a plus de rafale ; l'ancienne reste celle des références v4 à v10", () => {
    const gust = (list: readonly { id: string; variant: number }[]) => list.filter((p) => gustyVariants()[p.id]?.includes(p.variant)).map((p) => `${p.id}:${p.variant}`);
    expect(gust(fallbackFor("foret", RESTART_VERSION))).toEqual([]);
    expect(gust(fallbackFor("foret", BRIDGE_VERSION)).length).toBeGreaterThan(0);
  });
});
