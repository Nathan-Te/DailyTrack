import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DANGERS_LEVEL,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  JUMP_SIM_VERSION,
  attemptReplay,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  lifeReplay,
  replayAttempt,
  replayFingerprint,
  type AttemptState,
  type Level,
} from "../src/index";
import { expand } from "./helpers";

// Référence des rediffusions (lot 3), figée dans `fixtures/replay-golden.json` :
//   - la rediffusion de la solution de l'essai : **ses octets** (le texte base64url) et le résultat de son rejeu ;
//   - des rediffusions avec morts et reprises (essais fictifs à graine fixe, `demoAttempts`, et quelques vies seules parties d'un point de
//     passage), chacune avec l'empreinte de tous les états de son rejeu. Le test de navigateur `apps/jump/e2e/replay.spec.ts` rejoue les
//     mêmes textes dans Chromium, Firefox et WebKit et doit trouver les mêmes empreintes.
// Tout changement (format, simulation, essais fictifs) fait échouer ce test : comprendre pourquoi, puis
//   UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/replay-golden.test.ts
// (et `JUMP_SIM_VERSION` +1 si c'est la simulation qui a changé, comme pour les autres références).

const FILE = join(import.meta.dirname, "fixtures/replay-golden.json");

interface Fingerprinted {
  name: string;
  level: "essai" | "dangers";
  code: string;
  hash: string;
  finished: boolean;
  ticks: number;
  time: number;
  deaths: number;
}

interface ReplayGolden {
  jumpSimVersion: number;
  solution: {
    code: string;
    bytes: number;
    finished: boolean;
    ticks: number;
    time: number;
    deaths: number;
    lives: number;
    final: Omit<AttemptState, "tiles">;
  };
  replays: Fingerprinted[];
}

const LEVELS: Record<Fingerprinted["level"], Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL };

function solutionReplay() {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/essai-solution.json"), "utf8")) as { inputs: [number, number][] };
  return attemptReplay("essai", expand(fixture.inputs));
}

function dangersSolution() {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/dangers-solution.json"), "utf8")) as { inputs: [number, number][] };
  return attemptReplay("dangers", expand(fixture.inputs));
}

/** Les rediffusions de la référence, recalculées (déterministes). */
function replays(): Omit<Fingerprinted, "hash" | "finished" | "ticks" | "time" | "deaths">[] {
  const out: Omit<Fingerprinted, "hash" | "finished" | "ticks" | "time" | "deaths">[] = [{ name: "solution de l'essai", level: "essai", code: encodeReplay(solutionReplay()) }];
  const essais = demoAttempts(ESSAI_LEVEL, solutionReplay(), 42, { attempts: 10 });
  essais.forEach((r, i) => out.push({ name: `essai fictif ${i} (${r.end})`, level: "essai", code: encodeReplay(r.replay) }));
  // Des vies seules, parties d'un point de passage (en-tête avec chrono et sections).
  let lives = 0;
  for (const r of essais) {
    for (const life of replayAttempt(ESSAI_LEVEL, r.replay).lives) {
      if (life.start.checkpoint < 0 || lives >= 4) continue;
      out.push({ name: `vie ${lives} (point ${life.start.checkpoint}, ${life.end})`, level: "essai", code: encodeReplay(lifeReplay(r.replay, life)) });
      lives++;
    }
  }
  demoAttempts(DANGERS_LEVEL, dangersSolution(), 7, { attempts: 4 }).forEach((r, i) => out.push({ name: `galerie ${i} (${r.end})`, level: "dangers", code: encodeReplay(r.replay) }));
  return out;
}

function fingerprinted(): Fingerprinted[] {
  return replays().map((r) => ({ ...r, ...replayFingerprint(LEVELS[r.level], decodeReplay(r.code)) }));
}

if (process.env.UPDATE_GOLDEN) {
  const replay = solutionReplay();
  const code = encodeReplay(replay);
  const result = replayAttempt(ESSAI_LEVEL, replay);
  const { tiles: _tiles, ...final } = result.final;
  const golden: ReplayGolden = {
    jumpSimVersion: JUMP_SIM_VERSION,
    solution: { code, bytes: Math.floor((code.length * 6) / 8), finished: result.finished, ticks: result.ticks, time: result.time, deaths: result.deaths.length, lives: result.lives.length, final },
    replays: fingerprinted(),
  };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

const golden = JSON.parse(readFileSync(FILE, "utf8")) as ReplayGolden;

describe("référence des rediffusions (golden)", () => {
  it("est celle de cette version de la simulation", () => {
    expect(golden.jumpSimVersion, "JUMP_SIM_VERSION a changé : UPDATE_GOLDEN=1").toBe(JUMP_SIM_VERSION);
  });

  it("la solution de l'essai a ses octets figés, et c'est le texte que le jeu embarque (ESSAI_SOLUTION_CODE)", () => {
    expect(encodeReplay(solutionReplay())).toBe(golden.solution.code);
    expect(ESSAI_SOLUTION_CODE, "après SOLVE=1 : recopier le texte de la référence dans src/solutions.ts").toBe(golden.solution.code);
  });

  it("son rejeu a ses résultats figés : arrivée, temps de l'auteur, aucune mort, une vie, état final", () => {
    const result = replayAttempt(ESSAI_LEVEL, decodeReplay(golden.solution.code), "essai");
    const { tiles: _tiles, ...final } = result.final;
    expect({ finished: result.finished, ticks: result.ticks, time: result.time, deaths: result.deaths.length, lives: result.lives.length }).toEqual({
      finished: golden.solution.finished,
      ticks: golden.solution.ticks,
      time: golden.solution.time,
      deaths: golden.solution.deaths,
      lives: golden.solution.lives,
    });
    expect(final).toEqual(golden.solution.final);
  });

  it("les rediffusions avec morts et reprises sont les mêmes (essais fictifs déterministes) et rejouent les mêmes états (empreintes)", () => {
    const now = fingerprinted();
    expect(now.map((r) => r.code)).toEqual(golden.replays.map((r) => r.code));
    expect(now).toEqual(golden.replays);
    // La référence couvre bien des morts, des reprises sur un point de passage et des vies seules.
    expect(golden.replays.length).toBeGreaterThanOrEqual(12);
    expect(golden.replays.some((r) => r.deaths >= 2)).toBe(true);
    expect(golden.replays.some((r) => r.name.startsWith("vie "))).toBe(true);
    expect(golden.replays.some((r) => r.finished && r.deaths > 0)).toBe(true);
  });
});
