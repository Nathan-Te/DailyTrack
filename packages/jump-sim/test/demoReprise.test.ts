import "./legacy";
import { mixSeed, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  DEFAULT_JUMP_PARAMS,
  BRIDGE_VERSION,
  LASER_VERSION,
  STALACTITE_VERSION,
  SINGLE_CLOCK_VERSION,
  checkLife,
  checkpointAttempt,
  dailyLevel,
  demoAttempts,
  initialAttempt,
  lifeReplay,
  replayAttempt,
  repriseParPhase,
  stepAttempt,
  type DailyLevel,
} from "../src/index";

// Lot 21 : les joueurs fictifs qui reprennent bien (`demoAttempts(…, { reprise: repriseParPhase(niveau) })`). Sans l'option, les essais sont exactement ceux d'avant (les
// références `replay-golden*.json` et `horloge.test.ts` le prouvent) ; avec elle, un joueur tué sur un point de passage attend sur le palier la phase de l'horloge voulue
// puis joue la solution du morceau qui commence là — morceaux à plateformes (v5) et portions dures (élan dans la zone) compris.

const day = (date: string) => parseDay(date)!;
/** v5 (g15) : deux jours à plateformes et à portions dures ; v4 (g14, la référence) : deux jours. */
const V5 = ["2026-10-28", "2026-10-29", "2026-10-30"].map((d) => dailyLevel(day(d), null, BRIDGE_VERSION));
/** v11 (g21, lot 27) : les mêmes jours, avec le niveau d'aujourd'hui. */
const V11 = ["2026-10-28", "2026-10-29", "2026-10-30"].map((d) => dailyLevel(day(d)));
const V4 = ["2026-11-03", "2026-11-09"].map((d) => dailyLevel(day(d), null, SINGLE_CLOCK_VERSION));

const arrivalShare = (levels: readonly DailyLevel[], reprise: boolean, attempts: number): number => {
  let arrived = 0;
  let total = 0;
  for (const d of levels) {
    const pool = demoAttempts(d.level, d.replay, mixSeed(d.day, 0x51), { attempts, maxLives: 8, ...(reprise ? { reprise: repriseParPhase(d) } : {}) });
    arrived += pool.filter((a) => a.end === "arrivée").length;
    total += pool.length;
  }
  return arrived / total;
};

describe("la part des essais fictifs qui arrivent", () => {
  it("v5 : bien plus d'essais arrivent avec la reprise par phase (avant : ≈ 33 %, après : ≈ 60 % sur les 15 jours de la démonstration)", () => {
    const before = arrivalShare(V5, false, 80);
    const after = arrivalShare(V5, true, 80);
    expect(after, `avant ${before.toFixed(2)}, après ${after.toFixed(2)}`).toBeGreaterThan(before + 0.12);
    expect(after).toBeGreaterThan(0.45);
  }, 120_000);

  it("v11 (g21, lot 27) : la reprise par phase améliore la part des essais qui arrivent (mesuré : ≈ 35 % → ≈ 45 % sur ces trois jours)", () => {
    const before = arrivalShare(V11, false, 80);
    const after = arrivalShare(V11, true, 80);
    expect(after, `avant ${before.toFixed(2)}, après ${after.toFixed(2)}`).toBeGreaterThan(before + 0.08);
    expect(after).toBeGreaterThan(0.4);
  }, 120_000);

  it("v4 : de même", () => {
    const before = arrivalShare(V4, false, 80);
    const after = arrivalShare(V4, true, 80);
    expect(after, `avant ${before.toFixed(2)}, après ${after.toFixed(2)}`).toBeGreaterThan(before + 0.1);
  }, 120_000);
});

describe("les essais restent de vraies parties", () => {
  it("déterministes ; chaque essai se rejoue tel qu'enregistré ; chaque vie est une vie que le serveur accepte", () => {
    const d = V5[1]!;
    const run = () => demoAttempts(d.level, d.replay, 7, { attempts: 24, maxLives: 8, reprise: repriseParPhase(d) });
    const a = run();
    expect(run().map((x) => x.end)).toEqual(a.map((x) => x.end));
    let lives = 0;
    for (const attempt of a) {
      const r = replayAttempt(d.level, attempt.replay, d.id);
      expect(r.finished, "un essai « arrivée » se rejoue jusqu'à l'arrivée").toBe(attempt.end === "arrivée");
      for (const life of r.lives) {
        expect(checkLife(d.level, lifeReplay(attempt.replay, life), d.id), "la vie est valide").toMatchObject({ ok: true });
        lives++;
      }
    }
    expect(a.some((x) => replayAttempt(d.level, x.replay, d.id).deaths.length > 0 && x.end === "arrivée"), "des joueurs meurent puis arrivent").toBe(true);
    expect(lives).toBeGreaterThan(a.length);
  }, 60_000);

  it("une faute déjà jouée n'est pas rejouée à la vie suivante : aucun essai ne meurt huit fois à la même place", () => {
    for (const d of V5) {
      const T = 4096;
      for (const a of demoAttempts(d.level, d.replay, mixSeed(d.day, 0x51), { attempts: 40, maxLives: 8, reprise: repriseParPhase(d) })) {
        const spots = replayAttempt(d.level, a.replay, d.id).deaths.map((x) => `${Math.floor(x.x / T)}:${Math.floor(x.y / T)}`);
        const worst = Math.max(0, ...spots.map((s) => spots.filter((o) => o === s).length));
        expect(worst, spots.join(" ")).toBeLessThan(6);
      }
    }
  }, 120_000);
});

describe("la reprise sur un point de passage", () => {
  const T0 = [0, 37, 1234, 4321];
  for (const d of [...V5, ...V4]) {
    it(`${d.id} (v${d.level.simVersion}) : à toute heure, chaque morceau repris depuis l'arrêt sort en course propre sans mourir (plateformes, portions dures)`, () => {
      const reprise = repriseParPhase(d);
      let asked = 0;
      let served = 0;
      for (let k = 1; k < d.pieces.length; k++) {
        for (const time of T0) {
          const state = checkpointAttempt(d.level, { ...initialAttempt(d.level), checkpoint: k - 1, time });
          asked++;
          const again = reprise.resume(d.level, state);
          if (!again) continue;
          served++;
          // Rejoué ici, indépendamment du joueur fictif : attendre, jouer, vivant ; et la preuve reprend au pas où elle sortait de ce morceau.
          let s = state;
          for (let i = 0; i < again.wait; i++) s = stepAttempt(s, 0, d.level, DEFAULT_JUMP_PARAMS);
          for (const bits of again.inputs) s = stepAttempt(s, bits, d.level, DEFAULT_JUMP_PARAMS);
          expect(s.status, `morceau ${k} (${d.pieces[k]!.id}) à t=${time}`).not.toBe(ATTEMPT_DEAD);
          expect(again.cursor).toBe(d.pieces[k]!.end);
        }
      }
      // Quelques morceaux n'ont pas de solution utilisable depuis l'arrêt : la reprise d'avant les prend (null). La grande majorité est servie.
      expect(served / asked, `${served}/${asked}`).toBeGreaterThan(0.85);
    }, 60_000);
  }

  it("ne sert que le niveau qu'elle connaît, jamais un niveau de version 3 ni le départ", () => {
    const d = V5[0]!;
    const reprise = repriseParPhase(d);
    const v3 = dailyLevel(day("2026-10-29"), null, 3);
    expect(reprise.resume(v3.level, { ...initialAttempt(v3.level), checkpoint: 0 })).toBeNull();
    expect(reprise.resume(d.level, { ...initialAttempt(d.level), checkpoint: -1 })).toBeNull();
    expect(d.level.simVersion).toBe(BRIDGE_VERSION);
  });
});
