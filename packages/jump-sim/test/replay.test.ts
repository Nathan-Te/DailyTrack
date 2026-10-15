import { Rng, fromBase64Url, pushVarint, toBase64Url } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  AttemptRecorder,
  DANGERS_LEVEL,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  INPUT_JUMP,
  INPUT_RIGHT,
  JUMP_REPLAY_FORMAT,
  JUMP_SIM_VERSION,
  JumpReplayError,
  MAX_ATTEMPT_TICKS,
  RESPAWN_TICKS,
  ReplayRunner,
  attemptReplay,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  fromRuns,
  sprintTop,
  initialAttempt,
  lifeReplay,
  replayAttempt,
  replayFingerprint,
  replayStartState,
  START_AT_SPAWN,
  runsTicks,
  stepAttempt,
  toRuns,
  type AttemptState,
  type JumpReplay,
  type Level,
  type RecordedAttempt,
} from "../src/index";

// Lot 3 : rediffusions. Le rejeu est la seule source de vérité : ce qu'il recalcule doit être exactement ce qui a été vécu en jeu.

const SOLUTION = decodeReplay(ESSAI_SOLUTION_CODE);

/** Ce qui a été vécu pendant un essai, noté au fil du jeu (pas par le rejeu). */
interface Lived {
  finished: boolean;
  time: number;
  deaths: { cause: number; x: number; y: number; time: number }[];
  final: AttemptState;
}

/**
 * Une « session » jouée par un pilote : la simulation pas à pas, l'enregistreur, des « recommencer » au hasard. Rend chaque essai enregistré
 * avec ce qui a été vécu.
 */
function playSession(level: Level, ticks: number, pilot: (s: AttemptState, t: number) => number, restartEvery = 0, seed = 1): { essai: RecordedAttempt; lived: Lived }[] {
  const rng = new Rng(seed);
  const rec = new AttemptRecorder("essai");
  const out: { essai: RecordedAttempt; lived: Lived }[] = [];
  let s = initialAttempt(level);
  let lived: Lived["deaths"] = [];
  for (let t = 0; t < ticks; t++) {
    if (restartEvery > 0 && rng.int(restartEvery) === 0) {
      const ab = rec.abandon();
      if (ab) out.push({ essai: ab, lived: { finished: false, time: s.time, deaths: lived, final: s } });
      s = initialAttempt(level);
      lived = [];
      continue;
    }
    const before = s;
    const bits = pilot(s, t);
    s = stepAttempt(before, bits, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD && before.status !== ATTEMPT_DEAD) lived.push({ cause: s.deathCause, x: s.deathX, y: s.deathY, time: s.time });
    const done = rec.step(before, bits, s);
    if (done) {
      out.push({ essai: done, lived: { finished: s.status === ATTEMPT_FINISHED, time: s.time, deaths: lived, final: s } });
      lived = [];
    }
    if (s.status === ATTEMPT_FINISHED) {
      s = initialAttempt(level);
      lived = [];
    }
  }
  return out;
}

/** Pilote au hasard : des commandes tenues quelques pas. */
function randomPilot(seed: number) {
  const rng = new Rng(seed);
  let bits = 0;
  let left = 0;
  return () => {
    if (left-- <= 0) {
      bits = rng.int(8);
      left = 2 + rng.int(40);
    }
    return bits;
  };
}

/** Pilote qui suit la solution de l'essai, avec des écarts : de quoi passer des points de passage, y mourir et y reprendre. */
function sloppyPilot(seed: number, noiseEvery = 900) {
  const rng = new Rng(seed);
  const plan = fromRuns(SOLUTION.runs);
  const marks: number[] = [];
  {
    let s = initialAttempt(ESSAI_LEVEL);
    plan.forEach((b, t) => {
      s = stepAttempt(s, b, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
      if (s.checkpoint >= 0 && marks[s.checkpoint] === undefined) marks[s.checkpoint] = t + 1;
    });
  }
  let cursor = 0;
  let noise = 0;
  let noiseBits = 0;
  let prev: AttemptState | null = null;
  return (s: AttemptState) => {
    if (s.status === ATTEMPT_READY && prev && prev.status !== ATTEMPT_READY) cursor = 0;
    if (s.status === ATTEMPT_RUNNING && prev?.status === ATTEMPT_DEAD) cursor = marks[s.checkpoint] ?? 0;
    prev = s;
    if (noise > 0) {
      noise--;
      cursor++;
      return noiseBits;
    }
    if (rng.int(noiseEvery) === 0) {
      noise = 3 + rng.int(40);
      noiseBits = rng.int(8);
    }
    return plan[cursor++] ?? rng.int(8);
  };
}

describe("format de la rediffusion", () => {
  it("aller-retour codage → décodage, d'un essai et d'une vie partie d'un point de passage", () => {
    const essai = attemptReplay("essai", [2, 2, 2, 6, 6, 0, 0, 0, 1, 5, 4, 4, 7, 3], 1);
    const back = decodeReplay(encodeReplay(essai));
    expect(back).toEqual(essai);
    const life: JumpReplay = { simVersion: JUMP_SIM_VERSION, levelId: "jour-2026-10-14-g1", start: { checkpoint: 3, held: 0, time: 1234, sections: [5, 400, -1, -1], elan: 0 }, runs: [{ count: 300, bits: 2 }, { count: 1, bits: 6 }, { count: 70000, bits: 0 }] };
    expect(decodeReplay(encodeReplay(life))).toEqual(life);
    expect(SOLUTION.levelId).toBe("essai");
    expect(encodeReplay(SOLUTION)).toBe(ESSAI_SOLUTION_CODE);
  });

  it("départ lancé (lot 4, entrée « course » des morceaux, « élan » avant le lot 8c) : codé dans les drapeaux, rejoué à pleine vitesse depuis le départ", () => {
    const elan = attemptReplay("module:plaine:0", [2, 2, 6, 6, 2], 0, 1);
    expect(elan.start.elan).toBe(1);
    expect(decodeReplay(encodeReplay(elan))).toEqual(elan);
    expect(encodeReplay(elan)).not.toBe(encodeReplay(attemptReplay("module:plaine:0", [2, 2, 6, 6, 2])));
    const s = replayStartState(ESSAI_LEVEL, elan.start);
    expect(s.player.vx).toBe(DEFAULT_JUMP_PARAMS.runSpeed);
    expect(s.player.ground).toBe(1);
    expect(replayStartState(ESSAI_LEVEL, START_AT_SPAWN).player.vx).toBe(0);
    expect(() => encodeReplay({ ...elan, start: { ...elan.start, checkpoint: 0 } })).toThrow(JumpReplayError);
    // Lancé, on va plus loin dans le même nombre de pas.
    const run = (start: typeof elan) => replayAttempt(ESSAI_LEVEL, { ...start, levelId: "essai", runs: [{ count: 40, bits: 2 }] }).final.player.x;
    expect(run(elan)).toBeGreaterThan(run(attemptReplay("essai", [])));
  });

  it("lot 8c : départ lancé en élan plein (bit 3 des drapeaux) : à `sprintSpeed`, compteur au maximum ; jamais avec le départ à la course", () => {
    const plein = attemptReplay("module:plaine:0", [2, 2, 6, 6, 2], 0, 2);
    expect(plein.start.elan).toBe(2);
    expect(decodeReplay(encodeReplay(plein))).toEqual(plein);
    const codes = new Set([0, 1, 2].map((e) => encodeReplay(attemptReplay("module:plaine:0", [2, 2], 0, e))));
    expect(codes.size).toBe(3);
    const s = replayStartState(ESSAI_LEVEL, plein.start);
    expect(s.player.vx).toBe(sprintTop(DEFAULT_JUMP_PARAMS));
    expect(s.player.sprint).toBe(DEFAULT_JUMP_PARAMS.sprintDelay);
    expect(replayStartState(ESSAI_LEVEL, { ...plein.start, elan: 1 }).player.sprint).toBe(0);
    expect(() => attemptReplay("essai", [], 0, 3)).toThrow(JumpReplayError);
    expect(() => encodeReplay({ ...plein, start: { ...plein.start, checkpoint: 0 } })).toThrow(JumpReplayError);
    // Les deux drapeaux ensemble sont refusés à la lecture.
    const bytes = fromBase64Url(encodeReplay(plein));
    const flagAt = 3 + bytes[2]!;
    bytes[flagAt] = bytes[flagAt]! | 4;
    expect(() => decodeReplay(toBase64Url(bytes))).toThrow(JumpReplayError);
  });

  it("une série de moins de 16 pas tient dans un octet ; l'en-tête d'un essai fait 4 octets plus l'identifiant", () => {
    const one = encodeReplay(attemptReplay("essai", [2]));
    const bytes = Math.floor((one.length * 6) / 8);
    expect(bytes).toBe(1 + 1 + 1 + 5 + 1 + 1);
    expect(encodeReplay(attemptReplay("essai", new Array(15).fill(2))).length).toBe(one.length);
  });

  it("toRuns / fromRuns sont inverses ; runsTicks compte les pas", () => {
    const inputs = [0, 0, 2, 2, 2, 6, 2, 2, 0];
    expect(fromRuns(toRuns(inputs))).toEqual(inputs);
    expect(runsTicks(toRuns(inputs))).toBe(inputs.length);
  });

  it("refuse une rediffusion mal formée, avec une erreur claire", () => {
    const bad = (code: string) => {
      try {
        decodeReplay(code);
      } catch (e) {
        expect(e).toBeInstanceOf(JumpReplayError);
        return (e as JumpReplayError).code;
      }
      return "accepté";
    };
    expect(bad("")).toBe("format");
    expect(bad("@@@@")).toBe("format");
    expect(bad(toBase64Url([9, 2, 5]))).toBe("format"); // format inconnu
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 5, 101, 115]))).toBe("format"); // tronquée
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 2, 65, 66, 0, 16]))).toBe("format"); // identifiant en majuscules
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 0, 2]))).toBe("format"); // série vide (count 0)
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 16, 16]))).toBe("format"); // drapeau inconnu (lot 8c : 8 = départ en élan plein)
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 12, 16]))).toBe("format"); // lancé à la course et en élan plein
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 10, 0, 0, 0, 16]))).toBe("format"); // élan plein sur un point de passage
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 6, 0, 0, 0, 16]))).toBe("format"); // départ lancé sur un point de passage
    expect(bad(toBase64Url([JUMP_REPLAY_FORMAT, 2, 1, 101, 0, 0xff, 0xff, 0xff, 0xff, 0x7f]))).toBe("format"); // entier trop long
    expect(() => encodeReplay({ ...attemptReplay("essai", [2]), runs: [{ count: 1, bits: 8 }] })).toThrow(JumpReplayError);
    expect(() => encodeReplay(attemptReplay("Essai !", [2]))).toThrow(/Identifiant/);
  });

  it("refuse une rediffusion trop longue (MAX_ATTEMPT_TICKS), au codage comme au décodage et au rejeu", () => {
    const long: JumpReplay = { ...attemptReplay("essai", []), runs: [{ count: MAX_ATTEMPT_TICKS, bits: 0 }, { count: 1, bits: 2 }] };
    expect(() => encodeReplay(long)).toThrow(/trop longue/);
    // Fabriquée à la main (le codeur refuse de l'écrire) : en-tête, puis MAX_ATTEMPT_TICKS pas, puis un de plus.
    const bytes = [JUMP_REPLAY_FORMAT, JUMP_SIM_VERSION, 5, ..."essai".split("").map((c) => c.charCodeAt(0)), 0];
    pushVarint(bytes, MAX_ATTEMPT_TICKS * 8);
    expect(runsTicks(decodeReplay(toBase64Url(bytes)).runs)).toBe(MAX_ATTEMPT_TICKS);
    pushVarint(bytes, 1 * 8 + 2);
    try {
      decodeReplay(toBase64Url(bytes));
      expect.unreachable();
    } catch (e) {
      expect((e as JumpReplayError).code).toBe("length");
    }
    try {
      replayAttempt(ESSAI_LEVEL, long);
      expect.unreachable();
    } catch (e) {
      expect((e as JumpReplayError).code).toBe("length");
    }
  });

  it("une rediffusion d'une autre version se lit (en-tête) mais ne se rejoue pas : code « version », à ignorer", () => {
    const other = decodeReplay(encodeReplay({ ...SOLUTION, simVersion: JUMP_SIM_VERSION + 1 }));
    expect(other.simVersion).toBe(JUMP_SIM_VERSION + 1);
    for (const play of [() => replayAttempt(ESSAI_LEVEL, other), () => new ReplayRunner(ESSAI_LEVEL, other), () => replayFingerprint(ESSAI_LEVEL, other)]) {
      try {
        play();
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(JumpReplayError);
        expect((e as JumpReplayError).code).toBe("version");
      }
    }
  });

  it("refuse un autre niveau (si on le précise), un point de passage absent, des pas après la fin de l'essai", () => {
    expect(() => replayAttempt(ESSAI_LEVEL, SOLUTION, "dangers")).toThrow(/autre niveau/);
    const ghostCp: JumpReplay = { ...SOLUTION, start: { checkpoint: 9, held: 0, time: 10, sections: [-1, -1, -1, -1], elan: 0 } };
    expect(() => replayAttempt(ESSAI_LEVEL, ghostCp)).toThrow(/Point de passage 9/);
    const extra: JumpReplay = { ...SOLUTION, runs: [...SOLUTION.runs, { count: 1, bits: 2 }] };
    expect(() => replayAttempt(ESSAI_LEVEL, extra)).toThrow(/après la fin/);
    // Mort au début sans point de passage : l'essai s'arrête là.
    const dies = attemptReplay("essai", new Array(200).fill(INPUT_RIGHT));
    expect(() => replayAttempt(ESSAI_LEVEL, dies)).toThrow(/après la fin/);
  });
});

describe("rejeu = ce qui a été vécu", () => {
  const sessions = [
    { name: "commandes au hasard, recommencer au hasard", level: ESSAI_LEVEL, runs: playSession(ESSAI_LEVEL, 60_000, randomPilot(7), 900, 3) },
    { name: "solution avec écarts (points de passage, reprises)", level: ESSAI_LEVEL, runs: playSession(ESSAI_LEVEL, 80_000, sloppyPilot(11), 5000, 5) },
    { name: "galerie des dangers, au hasard", level: DANGERS_LEVEL, runs: playSession(DANGERS_LEVEL, 40_000, randomPilot(23), 700, 9) },
  ];

  it("les sessions jouées contiennent des morts, des reprises sur un point de passage, des arrivées et des abandons", () => {
    const all = sessions.flatMap((s) => s.runs);
    expect(all.length).toBeGreaterThan(50);
    expect(all.some((r) => r.essai.end === "abandon")).toBe(true);
    expect(all.some((r) => r.essai.end === "mort")).toBe(true);
    expect(all.some((r) => r.essai.end === "arrivée")).toBe(true);
    expect(all.some((r) => r.lived.deaths.length >= 2 && r.lived.final.checkpoint >= 0)).toBe(true);
  });

  for (const { name, level, runs } of sessions) {
    it(`${name} : essai par essai, le rejeu retrouve arrivée, temps, morts et état final`, () => {
      for (const { essai, lived } of runs) {
        const code = encodeReplay(essai.replay);
        const result = replayAttempt(level, decodeReplay(code));
        expect(result.finished).toBe(lived.finished);
        expect(result.time).toBe(lived.time);
        expect(result.deaths.map((d) => ({ cause: d.cause, x: d.x, y: d.y, time: d.time }))).toEqual(lived.deaths);
        expect({ ...result.final, tiles: null }).toEqual({ ...lived.final, tiles: null });
        expect(result.final.tiles).toEqual(lived.final.tiles);
        expect(result.ticks).toBe(runsTicks(essai.replay.runs));
        // Le chrono d'un essai vaut le nombre de pas rejoués (l'essai commence au premier pas commandé), sauf mort sans point de passage.
        if (essai.end !== "mort") expect(result.time).toBe(result.ticks);
        if (lived.finished) expect(essai.end).toBe("arrivée");
      }
    });
  }

  it("découpage en vies : chaque vie, rejouée seule, refait exactement ce qu'elle a fait dans l'essai", () => {
    let checked = 0;
    let fromCheckpoint = 0;
    for (const { level, runs } of sessions) {
      for (const { essai } of runs) {
        const result = replayAttempt(level, essai.replay);
        // Les vies couvrent l'essai : leurs pas plus les attentes de réapparition qui ont abouti à une reprise.
        const respawns = result.lives.filter((l) => l.start.checkpoint >= 0).length;
        // Abandon pendant l'attente d'une réapparition : les pas morts depuis la mort (`deathTicks`, le pas de la mort est dans la vie).
        // (Lot 8c : `+ 1` avant, jamais exercé par les sessions d'avant l'élan ; le pas de la mort est déjà compté dans sa vie.)
        const waits = result.deaths.length > 0 && essai.end === "abandon" && result.final.status === ATTEMPT_DEAD ? result.final.deathTicks : 0;
        expect(result.lives.reduce((n, l) => n + l.ticks, 0) + respawns * RESPAWN_TICKS + waits).toBe(result.ticks);
        expect(result.deaths.length).toBe(result.lives.filter((l) => l.end === "mort").length);
        for (const life of result.lives) {
          const alone = replayAttempt(level, decodeReplay(encodeReplay(lifeReplay(essai.replay, life))));
          expect(alone.ticks).toBe(life.ticks);
          expect(alone.lives).toHaveLength(1);
          expect(alone.lives[0]!.end).toBe(life.end);
          expect(alone.finished).toBe(life.end === "arrivée");
          if (life.death) expect(alone.deaths.map((d) => ({ cause: d.cause, x: d.x, y: d.y }))).toEqual([life.death]);
          // État à la fin de la vie : le même que dans l'essai (chrono compris).
          const inEssai = new ReplayRunner(level, essai.replay);
          while (inEssai.tick < life.startTick + life.ticks) inEssai.step();
          expect({ ...alone.final, tiles: null }).toEqual({ ...inEssai.state, tiles: null });
          checked++;
          if (life.start.checkpoint >= 0) fromCheckpoint++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(fromCheckpoint).toBeGreaterThan(10);
  });

  it("la première vie part du départ, les suivantes d'un point de passage, au pas de la reprise", () => {
    const withCp = sessions[1]!.runs.map((r) => replayAttempt(ESSAI_LEVEL, r.essai.replay)).find((r) => r.lives.length >= 3)!;
    expect(withCp).toBeDefined();
    expect(withCp.lives[0]!.start.checkpoint).toBe(-1);
    expect(withCp.lives[0]!.startTick).toBe(0);
    for (let i = 1; i < withCp.lives.length; i++) {
      const prev = withCp.lives[i - 1]!;
      const life = withCp.lives[i]!;
      expect(prev.end).toBe("mort");
      expect(life.start.checkpoint).toBeGreaterThanOrEqual(0);
      expect(life.startTick).toBe(prev.startTick + prev.ticks + RESPAWN_TICKS);
      expect(life.start.time).toBe(life.startTick);
      expect(replayStartState(ESSAI_LEVEL, life.start).status).toBe(ATTEMPT_RUNNING);
    }
  });
});

describe("enregistreur", () => {
  it("l'essai commence au premier pas commandé : les pas d'attente ne sont pas enregistrés, le saut tenu va dans l'en-tête", () => {
    const rec = new AttemptRecorder("essai");
    let s = initialAttempt(ESSAI_LEVEL);
    const play = (bits: number) => {
      const before = s;
      s = stepAttempt(before, bits, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
      return rec.step(before, bits, s);
    };
    for (let i = 0; i < 50; i++) expect(play(0)).toBeNull();
    expect(rec.recording).toBe(false);
    // Saut tenu depuis le départ : pas une commande (held passe à 1 au premier pas, puis reste) ; puis une direction démarre l'essai.
    // Comme après une mort sans point de passage, saut tenu : le bouton est noté tenu, il ne fait pas sauter et ne démarre rien.
    s = { ...s, player: { ...s.player, held: 1 } };
    play(INPUT_JUMP);
    play(INPUT_JUMP);
    expect(rec.recording).toBe(false);
    for (let i = 0; i < 20; i++) play(INPUT_RIGHT | INPUT_JUMP);
    expect(rec.recording).toBe(true);
    const ab = rec.abandon()!;
    expect(ab.end).toBe("abandon");
    expect(ab.replay.start.held).toBe(1);
    expect(runsTicks(ab.replay.runs)).toBe(20);
    const result = replayAttempt(ESSAI_LEVEL, ab.replay);
    expect(result.final.player).toEqual(s.player);
    expect(result.time).toBe(20);
    expect(rec.abandon()).toBeNull();
  });

  it("un essai de plus de MAX_ATTEMPT_TICKS est abandonné sans être rendu ; l'essai suivant s'enregistre", () => {
    const rec = new AttemptRecorder("essai");
    let s = initialAttempt(ESSAI_LEVEL);
    // Au départ, gauche contre le mur : l'essai court sans jamais finir.
    for (let t = 0; t < MAX_ATTEMPT_TICKS + 5; t++) {
      const before = s;
      s = stepAttempt(before, 1, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
      expect(rec.step(before, 1, s)).toBeNull();
    }
    expect(rec.recording).toBe(false);
    expect(rec.abandon()).toBeNull();
    s = initialAttempt(ESSAI_LEVEL);
    const before = s;
    s = stepAttempt(before, 2, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
    rec.step(before, 2, s);
    expect(rec.recording).toBe(true);
  });

  it("une rediffusion d'essai est petite : la solution de l'essai (18,5 s, lot 8c) tient en moins de 200 octets", () => {
    const bytes = Math.floor((ESSAI_SOLUTION_CODE.length * 6) / 8);
    expect(bytes).toBeLessThan(200);
    expect(replayAttempt(ESSAI_LEVEL, SOLUTION).time).toBe(2218);
  });
});

describe("essais fictifs (démo)", () => {
  it("sont déterministes, se rejouent, et contiennent morts, reprises et arrivées", () => {
    const a = demoAttempts(ESSAI_LEVEL, SOLUTION, 42, { attempts: 24 });
    const b = demoAttempts(ESSAI_LEVEL, SOLUTION, 42, { attempts: 24 });
    expect(a.map((r) => encodeReplay(r.replay))).toEqual(b.map((r) => encodeReplay(r.replay)));
    const results = a.map((r) => replayAttempt(ESSAI_LEVEL, r.replay));
    const lives = results.flatMap((r) => r.lives);
    expect(lives.length).toBeGreaterThan(30);
    expect(lives.some((l) => l.start.checkpoint >= 0)).toBe(true);
    expect(lives.filter((l) => l.end === "mort").length).toBeGreaterThan(20);
    expect(a.every((r) => r.replay.start.checkpoint === -1)).toBe(true);
    // Une autre graine, d'autres essais.
    const c = demoAttempts(ESSAI_LEVEL, SOLUTION, 43, { attempts: 24 });
    expect(c.map((r) => encodeReplay(r.replay))).not.toEqual(a.map((r) => encodeReplay(r.replay)));
  });
});

describe("rejeu pas à pas", () => {
  it("ReplayRunner suit exactement replayAttempt et s'arrête à la fin", () => {
    const r = new ReplayRunner(ESSAI_LEVEL, SOLUTION);
    while (r.step());
    expect(r.done).toBe(true);
    expect(r.state.status).toBe(ATTEMPT_FINISHED);
    expect(r.tick).toBe(2218);
    expect(r.step()).toBe(false);
    const fp = replayFingerprint(ESSAI_LEVEL, SOLUTION);
    expect(fp).toMatchObject({ finished: true, ticks: 2218, time: 2218, deaths: 0 });
    expect(fp.hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
