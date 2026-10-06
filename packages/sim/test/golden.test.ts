import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIM_VERSION, createTestTrack, decodeReplay, encodeReplay, replayRace } from "../src/index";
import { recordAutopilot } from "./helpers/autopilot";

// Rediffusion de référence : une course complète du pilote de test sur le circuit d'essai, avec le résultat
// exact (temps, intermédiaires, état final au bit près) calculé ici par Node. Le test navigateur
// (apps/web/e2e) rejoue le même texte dans Chromium, Firefox et WebKit et doit retrouver ces valeurs :
// c'est ce qui garantit que le serveur et tous les navigateurs voient la même course.
//
// Régénérer (physique volontairement changée, `SIM_VERSION` incrémenté) :
//   UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts
const FILE = join(import.meta.dirname, "fixtures/essai-autopilot.json");
const track = createTestTrack();

interface Golden {
  simVersion: number;
  trackId: string;
  code: string;
  finishMs: number;
  splits: number[];
  final: { x: number; y: number; z: number; yaw: number; vx: number; vy: number; vz: number };
}

function compute(code: string): Omit<Golden, "code" | "simVersion" | "trackId"> {
  const r = replayRace(track, decodeReplay(code));
  const c = r.finalCar;
  return { finishMs: r.finishMs, splits: r.splits, final: { x: c.x, y: c.y, z: c.z, yaw: c.yaw, vx: c.vx, vy: c.vy, vz: c.vz } };
}

if (process.env.UPDATE_GOLDEN) {
  const { replay } = recordAutopilot(track, 120, { curveSpeed: 26 });
  const code = encodeReplay(replay);
  const golden: Golden = { simVersion: SIM_VERSION, trackId: track.id, code, ...compute(code) };
  writeFileSync(FILE, JSON.stringify(golden, null, 2) + "\n");
}

describe("rediffusion de référence", () => {
  const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

  it("correspond à la version actuelle de la simulation", () => {
    expect(golden.simVersion).toBe(SIM_VERSION);
    expect(golden.trackId).toBe(track.id);
  });

  it("rejoue exactement le même temps, les mêmes intermédiaires et le même état final", () => {
    const now = compute(golden.code);
    expect(now.finishMs).toBe(golden.finishMs);
    expect(now.splits).toEqual(golden.splits);
    // Bit à bit (Object.is) : le moindre écart de dernier chiffre signale une physique qui a changé.
    for (const k of Object.keys(golden.final) as (keyof Golden["final"])[]) {
      expect(Object.is(now.final[k], golden.final[k]), k).toBe(true);
    }
  });

  it("est une vraie course : arrivée franchie, ~35 s", () => {
    expect(golden.finishMs).toBeGreaterThan(30_000);
    expect(golden.finishMs).toBeLessThan(40_000);
    expect(golden.splits).toHaveLength(3);
  });
});
