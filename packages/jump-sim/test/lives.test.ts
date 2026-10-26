import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  JUMP_SIM_VERSION,
  RESPAWN_TICKS,
  checkLife,
  dailyLevel,
  decodeReplay,
  demoAttempts,
  lifeReplay,
  lifeStartProblem,
  replayAttempt,
  sectionAt,
  UNITS_PER_TILE,
  type JumpReplay,
  type Level,
  type ReplayLife,
} from "../src/index";

// Lot P3 de la plateforme : la validation d'une vie envoyée (`checkLife`, `lifeStartProblem`, `sectionAt`). Toute vie vraiment vécue est
// acceptée et rejouée à l'identique ; un en-tête qu'aucune partie ne peut produire est refusé ; la fin vient du rejeu, jamais de l'envoi.

const ESSAI = decodeReplay(ESSAI_SOLUTION_CODE);

/** Toutes les vies d'essais fictifs d'un niveau (morts, reprises, arrivées, abandons), avec ce que le rejeu de l'essai entier en dit. */
function livesOf(level: Level, solution: JumpReplay, seed: number, attempts: number): { replay: JumpReplay; life: ReplayLife }[] {
  const out: { replay: JumpReplay; life: ReplayLife }[] = [];
  for (const a of demoAttempts(level, solution, seed, { attempts, maxLives: 8 })) {
    for (const life of replayAttempt(level, a.replay).lives) out.push({ replay: lifeReplay(a.replay, life), life });
  }
  return out;
}

// Lot 20 : le 30/10/2026 (g15, un néon à 4 plateformes) : parmi les essais fictifs, des vies reprennent au départ comme sur un point de passage (le 20/10 n en avait plus).
const DAILY = dailyLevel(daysFromCivil(2026, 10, 30));
/** Lot 15 : le même jour en version 3 (g9, une horloge par section) : les règles d'en-tête d'avant valent toujours pour lui. */
const DAILY_V3 = dailyLevel(daysFromCivil(2026, 10, 30), null, 3);

describe("checkLife : les vies vécues sont acceptées, rejouées à l'identique", () => {
  for (const [name, level, solution, id] of [
    ["essai", ESSAI_LEVEL, ESSAI, "essai"],
    ["niveau du 30/10/2026", DAILY.level, DAILY.replay, DAILY.id],
    ["niveau du 30/10/2026 en v3 (g9)", DAILY_V3.level, DAILY_V3.replay, DAILY_V3.id],
  ] as const) {
    it(name, () => {
      const lives = livesOf(level, solution, 2026, 24);
      const ends = new Set(lives.map((l) => l.life.end));
      expect(ends.has("mort")).toBe(true);
      expect(lives.some((l) => l.life.start.checkpoint >= 0)).toBe(true);
      for (const { replay, life } of lives) {
        const r = checkLife(level, replay, id);
        expect(r.ok, r.ok ? "" : r.reason).toBe(true);
        if (!r.ok) continue;
        expect(r.life.end).toBe(life.end);
        expect(r.life.ticks).toBe(life.ticks);
        expect(r.life.death).toEqual(life.death);
        expect(r.life.startTime).toBe(life.start.time);
        if (life.death) expect(r.life.section).toBe(sectionAt(level, life.death.x));
      }
    });
  }
});

describe("lifeStartProblem : un en-tête qu'aucune partie ne produit est refusé (niveau v3)", () => {
  const lives = livesOf(DAILY_V3.level, DAILY_V3.replay, 7, 30).filter((l) => l.life.start.checkpoint >= 1);
  const sample = lives[0]!;
  const start = sample.life.start;
  const level = DAILY_V3.level;
  const cp = level.checkpoints[start.checkpoint]!;
  const before = level.sections.map((s, i) => ({ s, i })).filter(({ s }) => s.c1 < cp.col && s.c1 >= level.start.col);

  it("le vrai en-tête passe", () => {
    expect(before.length).toBeGreaterThan(0);
    expect(lifeStartProblem(level, start)).toBeNull();
  });

  it("départ : chrono à zéro, aucune section, jamais lancé", () => {
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 })).toBeNull();
    expect(lifeStartProblem(level, { checkpoint: -1, held: 1, time: 0, sections: [], elan: 0 })).toBeNull();
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 12, sections: [], elan: 0 })).toMatch(/zéro/);
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 0, sections: [], elan: 1 })).toMatch(/lancée/);
  });

  it("point de passage absent, nombre de sections faux", () => {
    expect(lifeStartProblem(level, { ...start, checkpoint: level.checkpoints.length })).toMatch(/absent/);
    expect(lifeStartProblem(level, { ...start, sections: start.sections.slice(1) })).toMatch(/Nombre de sections/);
  });

  it("une section du point ou d'après en marche ; une section d'avant à l'arrêt ; le désordre ; un chrono trop court", () => {
    const after = level.sections.findIndex((s) => s.c1 >= cp.col);
    const on = [...start.sections];
    on[after] = 1;
    expect(lifeStartProblem(level, { ...start, sections: on })).toMatch(/d'après est en marche/);
    const off = [...start.sections];
    off[before[0]!.i] = -1;
    expect(lifeStartProblem(level, { ...start, sections: off })).toMatch(/pas été traversée/);
    if (before.length >= 2) {
      const swapped = [...start.sections];
      swapped[before[0]!.i] = start.sections[before[1]!.i]! + 1;
      expect(lifeStartProblem(level, { ...start, sections: swapped })).toMatch(/désordre/);
    }
    const last = Math.max(...before.map(({ i }) => start.sections[i]!));
    expect(lifeStartProblem(level, { ...start, time: last + RESPAWN_TICKS })).toMatch(/trop court/);
    expect(lifeStartProblem(level, { ...start, time: last - 1 })).toMatch(/hors du chrono/);
  });

  it("checkLife refuse un en-tête incohérent avant de rejouer", () => {
    const forged: JumpReplay = { ...sample.replay, start: { ...start, sections: start.sections.map(() => -1) } };
    const r = checkLife(level, forged, DAILY_V3.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("start");
  });
});

describe("lot 15 — lifeStartProblem d'un niveau à une seule horloge (v4)", () => {
  const level = DAILY.level;
  const lives = livesOf(level, DAILY.replay, 7, 30);

  it("des vies reprennent au départ, chrono qui continue (mort avant le premier point) : leur en-tête passe et elles se rejouent", () => {
    const again = lives.filter((l) => l.life.start.checkpoint < 0 && l.life.start.time > 0);
    expect(again.length).toBeGreaterThan(0);
    for (const l of again) {
      expect(lifeStartProblem(level, l.life.start)).toBeNull();
      expect(checkLife(level, l.replay, DAILY.id).ok).toBe(true);
    }
  });

  it("aucune section dans l'en-tête ; point absent ; chrono trop court pour une reprise ; jamais lancée", () => {
    const cp = lives.find((l) => l.life.start.checkpoint >= 0)!.life.start;
    expect(cp.sections).toEqual([]);
    expect(lifeStartProblem(level, cp)).toBeNull();
    expect(lifeStartProblem(level, { ...cp, sections: level.sections.map(() => -1) })).toMatch(/sections/);
    expect(lifeStartProblem(level, { ...cp, checkpoint: level.checkpoints.length })).toMatch(/absent/);
    expect(lifeStartProblem(level, { ...cp, time: RESPAWN_TICKS })).toMatch(/trop court/);
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 })).toBeNull();
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 5, sections: [], elan: 0 })).toMatch(/trop court/);
    expect(lifeStartProblem(level, { checkpoint: -1, held: 0, time: 0, sections: [], elan: 1 })).toMatch(/lancée/);
  });

  it("une reprise au départ n'existe pas dans un niveau v3", () => {
    const again = lives.find((l) => l.life.start.checkpoint < 0 && l.life.start.time > 0)!;
    const r = checkLife(DAILY_V3.level, { ...again.replay, simVersion: 3, levelId: DAILY_V3.id }, DAILY_V3.id);
    expect(r.ok).toBe(false);
  });
});

describe("checkLife : la fin vient du rejeu", () => {
  const level = DAILY.level;
  const lives = livesOf(level, DAILY.replay, 11, 30);

  it("une vie coupée avant sa mort finit en abandon, sans mort (une mort annoncée n'existe pas)", () => {
    const dying = lives.find((l) => l.life.end === "mort" && l.life.ticks > 30)!;
    const cut: JumpReplay = { ...dying.replay, runs: [] };
    let left = dying.life.ticks - 10;
    for (const r of dying.replay.runs) {
      if (left <= 0) break;
      const count = Math.min(r.count, left);
      cut.runs.push({ count, bits: r.bits });
      left -= count;
    }
    const r = checkLife(level, cut, DAILY.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.life.end, r.life.death]).toEqual(["abandon", null]);
  });

  it("rien après la fin : deux vies dans une rediffusion sont refusées", () => {
    const dying = lives.find((l) => l.life.end === "mort" && l.life.start.checkpoint >= 0)!;
    const twice: JumpReplay = { ...dying.replay, runs: [...dying.replay.runs, { count: 40, bits: 2 }] };
    const r = checkLife(level, twice, DAILY.id);
    expect(r.ok).toBe(false);
  });

  it("autre niveau, autre version : refusés", () => {
    const one = lives[0]!;
    const other = checkLife(level, one.replay, "jour-2026-10-21-g9");
    expect(other.ok).toBe(false);
    const version = checkLife(level, { ...one.replay, simVersion: JUMP_SIM_VERSION + 1 }, DAILY.id);
    expect(version.ok).toBe(false);
    if (!version.ok) expect(version.code).toBe("version");
  });
});

describe("sectionAt", () => {
  it("la section d'une colonne ; un palier appartient à la section d'avant ; avant la première : la première", () => {
    const level = DAILY.level;
    const T = UNITS_PER_TILE;
    level.sections.forEach((s, i) => {
      expect(sectionAt(level, s.c0 * T)).toBe(i);
      expect(sectionAt(level, s.c1 * T + T - 1)).toBe(i);
    });
    expect(sectionAt(level, 0)).toBe(0);
    const s0 = level.sections[0]!;
    const s1 = level.sections[1]!;
    if (s1.c0 > s0.c1 + 1) expect(sectionAt(level, (s0.c1 + 1) * T)).toBe(0);
    expect(sectionAt(ESSAI_LEVEL, 0)).toBe(0);
  });
});
