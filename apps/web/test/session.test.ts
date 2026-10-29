import { describe, expect, it } from "vitest";
import {
  NO_INPUT,
  ReplayPlayer,
  SIM_VERSION,
  TICK_RATE,
  createTestTrack,
  decodeReplay,
  encodeReplay,
  makeInput,
  replayRace,
} from "@cdj/sim";
import goldenRaw from "../../../packages/sim/test/fixtures/essai-autopilot.json?raw";
import { RunSession, loadGhost } from "../src/session";
import type { BestRun } from "../src/records";

const track = createTestTrack();
const golden = JSON.parse(goldenRaw) as { code: string; finishMs: number; splits: number[]; simVersion: number };
const goldenReplay = decodeReplay(golden.code);

/** Joue la rediffusion de référence « comme un joueur » : une commande par pas, via la session. */
function playGolden(session: RunSession) {
  const player = new ReplayPlayer(goldenReplay);
  while (!player.done) session.step({ ...player.next() });
}

describe("RunSession : enregistrement", () => {
  it("enregistre exactement les commandes appliquées : la rediffusion redonne la même course", () => {
    const session = new RunSession(track, null);
    playGolden(session);
    expect(session.race.finishMs).toBe(golden.finishMs);
    // La rediffusion enregistrée est identique, octet pour octet, à celle qui a été jouée.
    expect(encodeReplay(session.toReplay())).toBe(golden.code);
    const replayed = replayRace(track, session.toReplay());
    expect(replayed.finishMs).toBe(session.race.finishMs);
    expect(replayed.splits).toEqual(session.race.splits);
  });

  it("n'enregistre plus rien après l'arrivée (la voiture freine seule)", () => {
    const session = new RunSession(track, null);
    playGolden(session);
    const before = session.toReplay();
    for (let i = 0; i < 3 * TICK_RATE; i++) session.step(makeInput(1, 1, 0));
    expect(session.toReplay()).toEqual(before);
  });

  it("enregistre aussi les reprises au point de contrôle", () => {
    const session = new RunSession(track, null);
    for (let i = 0; i < 300; i++) session.step(makeInput(0, 1, 0));
    session.step(makeInput(0, 1, 0, true));
    for (let i = 0; i < 200; i++) session.step(makeInput(0, 1, 0));
    const r = replayRace(track, session.toReplay());
    expect(r.respawns).toBe(1);
    expect(r.finalCar.x).toBe(session.race.car.x);
    expect(r.finalCar.z).toBe(session.race.car.z);
  });
});

describe("fantôme", () => {
  const best: BestRun = { ms: golden.finishMs, splits: golden.splits, replay: golden.code, simVersion: SIM_VERSION };

  it("rejoue le meilleur temps en même temps que la course, jusqu'à la même arrivée", () => {
    const session = new RunSession(track, best);
    expect(session.ghost).not.toBeNull();
    // Le joueur ne fait rien : le fantôme, lui, roule et finit au temps du meilleur.
    for (let i = 0; i < Math.ceil((golden.finishMs / 1000) * TICK_RATE) + 5; i++) session.step(NO_INPUT);
    expect(session.race.car.z).toBeLessThan(track.spawn.z + 5);
    expect(session.ghost!.race.finishMs).toBe(golden.finishMs);
    expect(session.ghost!.race.splits).toEqual(golden.splits);
  });

  it("garde une copie du pas précédent pour l'interpolation", () => {
    const session = new RunSession(track, best);
    for (let i = 0; i < 100; i++) session.step(NO_INPUT);
    const g = session.ghost!;
    expect(g.previous.z).toBeLessThan(g.race.car.z);
    expect(g.previous.tick).toBe(g.race.car.tick - 1);
  });

  it("n'y a pas de fantôme sans rediffusion, avec une autre version, ou si elle est illisible", () => {
    expect(loadGhost(track, null)).toBeNull();
    expect(loadGhost(track, { ms: 1, splits: [] })).toBeNull(); // record d'avant le lot 3
    expect(loadGhost(track, { ...best, simVersion: SIM_VERSION + 1 })).toBeNull();
    expect(loadGhost(track, { ...best, replay: "n'importe quoi !" })).toBeNull();
    expect(loadGhost(track, { ...best, replay: golden.code.slice(0, 40) })).toBeNull();
    expect(() => new RunSession(track, { ...best, replay: "@@@" })).not.toThrow();
  });
});
