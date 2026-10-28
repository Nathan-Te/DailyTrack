import { describe, expect, it } from "vitest";
import {
  ALT_HOP_PRESS,
  ALT_KEPT_VERSION,
  ATTEMPT_DEAD,
  ATTEMPT_RUNNING,
  AttemptRecorder,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RESPAWN,
  INPUT_RIGHT,
  JumpReplayError,
  PRESS_MIN,
  RESPAWN_TICKS,
  RESTART_VERSION,
  TILE_ALT_OFF,
  TILE_ALT_ON,
  checkLife,
  checkpointAttempt,
  dailyLevel,
  dailyProblems,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  hopToA,
  initialAttempt,
  jumpThemeForDay,
  lifeReplay,
  lifeStartProblem,
  parseLevel,
  replayAttempt,
  replayFingerprint,
  replayStartState,
  stepAttempt,
  type AttemptState,
  type JumpReplay,
  type Level,
} from "../src/index";
import { daysFromCivil } from "@cdj/core";

// Lot 28 — **les blocs alternés gardent leur état à la reprise** (niveaux en version 12). Dans un niveau à blocs alternés, une reprise sur un point de passage (après une mort ou par la reprise
// volontaire) garde la parité (A ou B) du jeu ; seul un nouvel essai à zéro (départ, mort avant le premier point) la remet à A ; franchir un point de passage la remet toujours à A. Les versions
// d'avant (v3 à v11) gardent la reprise qui remet A, au bit près.

const P = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const J = INPUT_JUMP;

/** Un sol, des blocs alternés au départ, un point de passage au milieu, un pic plus loin (on y meurt), l'arrivée. */
const rows = [
  "##############################",
  "#............................#",
  "#............................#",
  "#............................#",
  "#............................#",
  "#...AA....BB.......AA........#",
  "#S......C.............>.....F#",
  "##############################",
];
const level = (version: number): Level => parseLevel(rows.join("\n") + `\n\nversion ${version}\n`);
const step = (s: AttemptState, bits: number, lv: Level) => stepAttempt(s, bits, lv, P);
const play = (s: AttemptState, bits: number, n: number, lv: Level): AttemptState => {
  for (let i = 0; i < n; i++) s = step(s, bits, lv);
  return s;
};
const code = (lv: Level, s: AttemptState, col: number, row: number) => s.tiles[row * lv.width + col];

/** Court jusqu'au point de passage, saute `jumps` fois sur place (chaque saut inverse les jeux), puis court vers le pic et meurt. Rend l'état mort. */
function dieAfter(lv: Level, jumps: number): AttemptState {
  let s = initialAttempt(lv);
  for (let k = 0; k < 400 && s.checkpoint < 0; k++) s = step(s, R, lv);
  expect(s.checkpoint).toBe(0);
  expect(s.alt).toBe(0); // franchir le point remet A
  for (let i = 0; i < jumps; i++) {
    s = play(s, 0, 40, lv); // se poser, relâcher
    while (s.player.ground !== 1) s = step(s, 0, lv);
    s = play(s, J, 6, lv);
  }
  expect(s.alt).toBe(jumps % 2);
  let died = false;
  for (let k = 0; k < 800 && !died; k++) {
    s = step(s, R, lv);
    died = s.status === ATTEMPT_DEAD;
  }
  expect(died).toBe(true);
  return s;
}

describe("lot 28 — la reprise garde l'état des alternés (version 12)", () => {
  const v12 = level(ALT_KEPT_VERSION);
  const v11 = level(RESTART_VERSION);

  it("un nombre impair de sauts, la mort : la reprise reste en B (les blocs aussi) ; un nombre pair : A", () => {
    const dead = dieAfter(v12, 1);
    expect(dead.alt).toBe(1);
    const back = play(dead, 0, RESPAWN_TICKS, v12);
    expect(back.status).toBe(ATTEMPT_RUNNING);
    expect(back.checkpoint).toBe(0);
    expect(back.alt).toBe(1);
    // Les blocs sont ceux de B : B plein, A absent.
    expect(code(v12, back, 4, 5)).toBe(TILE_ALT_OFF);
    expect(code(v12, back, 10, 5)).toBe(TILE_ALT_ON);

    const even = play(dieAfter(v12, 2), 0, RESPAWN_TICKS, v12);
    expect(even.alt).toBe(0);
    expect(code(v12, even, 4, 5)).toBe(TILE_ALT_ON);
  });

  it("v11 : la même séquence remet A à la reprise (la règle du lot 15, inchangée)", () => {
    const back = play(dieAfter(v11, 1), 0, RESPAWN_TICKS, v11);
    expect(back.alt).toBe(0);
    expect(code(v11, back, 4, 5)).toBe(TILE_ALT_ON);
  });

  it("la reprise volontaire (quatrième bit) garde aussi l'état ; elle ne change rien sans saut", () => {
    let s = initialAttempt(v12);
    for (let k = 0; k < 400 && s.checkpoint < 0; k++) s = step(s, R, v12);
    s = play(s, 0, 30, v12);
    while (s.player.ground !== 1) s = step(s, 0, v12);
    s = play(s, J, 6, v12);
    expect(s.alt).toBe(1);
    s = play(s, R, 30, v12);
    const back = step(s, INPUT_RESPAWN, v12);
    expect(back.checkpoint).toBe(0);
    expect(back.alt).toBe(1);
    expect(back.status).toBe(ATTEMPT_RUNNING);
    // Sans le saut : A avant, A après.
    let t = initialAttempt(v12);
    for (let k = 0; k < 400 && t.checkpoint < 0; k++) t = step(t, R, v12);
    t = play(t, R, 30, v12);
    expect(step(t, INPUT_RESPAWN, v12).alt).toBe(0);
  });

  it("un nouvel essai à zéro remet A : la mort avant le premier point de passage", () => {
    // Un saut au départ (B), puis la mort sur le pic avant d'avoir franchi le point.
    const noPoint = parseLevel(rows.map((r) => r.replace("C", ".")).join("\n") + `\n\nversion ${ALT_KEPT_VERSION}\n`);
    let s = initialAttempt(noPoint);
    s = step(s, J | R, noPoint);
    expect(s.alt).toBe(1);
    let died = false;
    for (let k = 0; k < 800 && !died; k++) {
      s = step(s, R, noPoint);
      died = s.status === ATTEMPT_DEAD;
    }
    expect(died).toBe(true);
    const fresh = play(s, 0, RESPAWN_TICKS, noPoint);
    expect(fresh).toEqual(initialAttempt(noPoint)); // l'état de départ exact, A plein
    expect(fresh.alt).toBe(0);
  });

  it("franchir un point de passage remet toujours A (la règle du lot 12 reste)", () => {
    let s = initialAttempt(v12);
    s = step(s, J | R, v12);
    expect(s.alt).toBe(1);
    for (let k = 0; k < 400 && s.checkpoint < 0; k++) s = step(s, R, v12);
    expect(s.alt).toBe(0);
  });

  it("un niveau sans bloc alterné n'a pas d'état de plus (v12 = v11 sur 1 500 pas)", () => {
    const plain = (version: number) => parseLevel(rows.map((r) => r.replace(/[AB]/g, ".")).join("\n") + `\n\nversion ${version}\n`);
    const a = plain(ALT_KEPT_VERSION);
    const b = plain(RESTART_VERSION);
    let x = initialAttempt(a);
    let y = initialAttempt(b);
    for (let k = 0; k < 1500; k++) {
      const bits = k % 97 < 40 ? R : k % 53 < 6 ? J | R : 0;
      x = step(x, bits, a);
      y = step(y, bits, b);
      expect(x).toEqual(y);
    }
    expect(x.alt).toBeUndefined();
  });
});

describe("lot 28 — le saut sur place remet A depuis B", () => {
  it("hopToA : un appui d'au moins PRESS_MIN pas, retombé sur le palier, les blocs en A", () => {
    const lv = level(ALT_KEPT_VERSION);
    const back = play(dieAfter(lv, 1), 0, RESPAWN_TICKS, lv);
    expect(ALT_HOP_PRESS).toBeGreaterThanOrEqual(PRESS_MIN);
    const hop = hopToA(lv, back)!;
    expect(hop).not.toBeNull();
    expect(hop.after.alt).toBe(0);
    expect(hop.after.player.ground).toBe(1);
    expect(hop.after.player.x).toBe(back.player.x); // sur place
    expect(hop.inputs.slice(0, ALT_HOP_PRESS)).toEqual(new Array(ALT_HOP_PRESS).fill(J));
    expect(hopToA(lv, hop.after)).toBeNull(); // déjà en A
    expect(hopToA(level(RESTART_VERSION), back)).toBeNull(); // avant la v12 : jamais en B
  });
});

describe("lot 28 — l'état B dans l'en-tête d'une vie", () => {
  const lv = level(ALT_KEPT_VERSION);
  const id = "essai:alternes";

  /** Un essai complet : on saute (B), on franchit… non : on court au point, on saute, on meurt, on repart en B, on meurt encore. */
  function recorded(): { replay: JumpReplay; life: ReturnType<typeof replayAttempt>["lives"][number] } {
    const rec = new AttemptRecorder(id, ALT_KEPT_VERSION);
    let s = initialAttempt(lv);
    const feed = (bits: number) => {
      const before = s;
      s = step(s, bits, lv);
      const done = rec.step(before, bits, s);
      expect(done).toBeNull();
    };
    for (let k = 0; k < 400 && s.checkpoint < 0; k++) feed(R);
    for (let k = 0; k < 40; k++) feed(0);
    while (s.player.ground !== 1) feed(0);
    for (let k = 0; k < 6; k++) feed(J);
    for (let k = 0; k < 800 && s.status !== ATTEMPT_DEAD; k++) feed(R);
    expect(s.alt).toBe(1);
    for (let k = 0; k < RESPAWN_TICKS; k++) feed(0);
    expect(s.alt).toBe(1);
    for (let k = 0; k < 800 && s.status !== ATTEMPT_DEAD; k++) feed(R);
    for (let k = 0; k < RESPAWN_TICKS; k++) feed(0);
    const replay = rec.abandon()!.replay;
    const lives = replayAttempt(lv, replay, id).lives;
    return { replay, life: lives.find((l) => l.start.alt === 1)! };
  }

  it("la vie qui repart du point en B porte alt = 1 ; sa rediffusion rejoue la même mort", () => {
    const { replay, life } = recorded();
    expect(life.start.checkpoint).toBe(0);
    expect(life.start.alt).toBe(1);
    const alone = lifeReplay(replay, life);
    const code = encodeReplay(alone);
    const back = decodeReplay(code);
    expect(back.start.alt).toBe(1);
    const check = checkLife(lv, back, id);
    expect(check.ok).toBe(true);
    // L'empreinte des états dépend de l'état de départ : sans le drapeau B la même série ne donne pas les mêmes états.
    const asA = replayFingerprint(lv, { ...back, start: { ...back.start, alt: 0 } });
    expect(asA.hash).not.toBe(replayFingerprint(lv, back).hash);
    expect(replayStartState(lv, back.start).alt).toBe(1);
  });

  it("l'en-tête est refusé hors de son domaine : avant la v12, sur le départ, sans blocs alternés, ou ni 0 ni 1", () => {
    const start = { checkpoint: 0, held: 0, time: 400, sections: [], elan: 0, alt: 1 };
    expect(lifeStartProblem(lv, start)).toBeNull();
    expect(lifeStartProblem(level(RESTART_VERSION), start)).toMatch(/version 12/);
    expect(lifeStartProblem(lv, { ...start, checkpoint: -1, time: 0 })).toMatch(/départ/);
    const plain = parseLevel(rows.map((r) => r.replace(/[AB]/g, ".")).join("\n") + `\n\nversion ${ALT_KEPT_VERSION}\n`);
    expect(lifeStartProblem(plain, start)).toMatch(/pas de blocs alternés/);
    expect(lifeStartProblem(lv, { ...start, alt: 2 })).toMatch(/invalide/);
    // L'encodage refuse B hors d'un point ou avant la v12 ; le décodage refuse le drapeau d'une version qui ne le connaît pas.
    const base: JumpReplay = { simVersion: ALT_KEPT_VERSION, levelId: id, start, runs: [{ count: 5, bits: 0 }] };
    expect(() => encodeReplay({ ...base, start: { ...start, checkpoint: -1, time: 0 } })).toThrow(JumpReplayError);
    expect(() => encodeReplay({ ...base, simVersion: RESTART_VERSION })).toThrow(JumpReplayError);
  });

  it("les octets d'une rediffusion sans B sont ceux d'avant (aucun drapeau de plus)", () => {
    const base: JumpReplay = { simVersion: ALT_KEPT_VERSION, levelId: id, start: { checkpoint: 0, held: 0, time: 400, sections: [], elan: 0 }, runs: [{ count: 5, bits: 0 }] };
    const withZero = encodeReplay({ ...base, start: { ...base.start, alt: 0 } });
    expect(withZero).toBe(encodeReplay(base));
    expect(decodeReplay(withZero).start.alt).toBeUndefined();
  });
});

describe("lot 28 — un jour de néon g22 : les vies des essais fictifs repartant en B sont valides", () => {
  // Le 19/12/2026 est un néon (référence v12) : des morts sur un point avec les alternés en B.
  const day = daysFromCivil(2026, 12, 19);
  const L = dailyLevel(day, null, ALT_KEPT_VERSION);

  it("c'est un néon sans problème, à la version 12", () => {
    expect(jumpThemeForDay(day)).toBe("neon");
    expect(L.level.simVersion).toBe(ALT_KEPT_VERSION);
    expect(L.id).toMatch(/-g22$/);
    expect(dailyProblems(L)).toEqual([]);
    expect(L.level.alts.length).toBeGreaterThan(0);
  });

  it("chaque vie vécue passe checkLife, celles qui repartent en B comprises ; les joueurs fictifs sautent d'abord sur place", () => {
    const essais = demoAttempts(L.level, L.replay, 15, { attempts: 24, maxLives: 8 });
    let inB = 0;
    let hops = 0;
    for (const r of essais) {
      const result = replayAttempt(L.level, r.replay, L.id);
      for (const life of result.lives) {
        if (life.start.alt === 1) inB++;
        const check = checkLife(L.level, lifeReplay(r.replay, life), L.id);
        expect(check.ok, `${life.start.checkpoint}`).toBe(true);
        // Le joueur fictif qui repart en B saute avant de faire autre chose.
        if (life.start.alt === 1 && life.ticks > ALT_HOP_PRESS + 5) {
          const runs = lifeReplay(r.replay, life).runs;
          if (runs[0]!.bits === J && runs[0]!.count === ALT_HOP_PRESS) hops++;
        }
      }
    }
    expect(inB).toBeGreaterThan(5);
    expect(hops).toBeGreaterThan(0);
  });

  it("jamais d'alterné hors du néon (la règle du générateur, sur une nuit et une forêt)", () => {
    const other = [daysFromCivil(2026, 10, 31), daysFromCivil(2026, 11, 9), daysFromCivil(2026, 11, 3)];
    for (const d of other) {
      const O = dailyLevel(d, null, ALT_KEPT_VERSION);
      expect(O.theme).not.toBe("neon");
      expect(O.level.alts.length).toBe(0);
      expect(dailyProblems(O)).toEqual([]);
      // Et la règle les refuse si un morceau en posait : le même niveau, avec un bloc alterné de plus.
      const bad = { ...O, level: { ...O.level, alts: [{ col: 3, row: 3, set: 0 }] } };
      expect(dailyProblems(bad as typeof O)).toContain(`des blocs alternés dans un niveau ${O.theme} (le néon seulement)`);
    }
    void checkpointAttempt;
  });
});
