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

describe("lot G1 : fantôme rejoué plus vite (le Diamant de Track)", () => {
  it("à la vitesse 1, un pas du fantôme par pas de la course ; à la vitesse v, il arrive au bout v fois plus tôt, sans toucher la course du joueur", () => {
    const best: BestRun = { ms: golden.finishMs, splits: golden.splits, replay: golden.code, simVersion: SIM_VERSION };
    const normal = new RunSession(track, best);
    const vitesse = golden.finishMs / Math.round(golden.finishMs * 0.92);
    const rapide = new RunSession(track, { ...best, vitesse });
    const seule = new RunSession(track, null);
    let pas = 0;
    let arriveeNormale = -1;
    let arriveeRapide = -1;
    while (pas < 120 * 60 && (arriveeNormale < 0 || arriveeRapide < 0)) {
      normal.step(NO_INPUT);
      rapide.step(NO_INPUT);
      seule.step(NO_INPUT);
      pas++;
      if (arriveeNormale < 0 && normal.ghost!.race.finishMs >= 0) arriveeNormale = pas;
      if (arriveeRapide < 0 && rapide.ghost!.race.finishMs >= 0) arriveeRapide = pas;
    }
    // le fantôme à la vitesse 1 finit au pas de sa course ; le rapide, à ≈ 0,92 de ce temps (à un pas près)
    expect(normal.ghost!.race.finishMs).toBe(golden.finishMs);
    expect(rapide.ghost!.race.finishMs).toBe(golden.finishMs); // sa course est la même : seule la lecture va plus vite
    const attendu = (golden.finishMs / 1000) * TICK_RATE / vitesse;
    expect(Math.abs(arriveeRapide - attendu)).toBeLessThanOrEqual(2);
    expect(arriveeRapide).toBeLessThan(arriveeNormale);
    // la voiture du joueur n'a rien vu : même état avec ou sans fantôme
    expect(rapide.race.car).toEqual(seule.race.car);
    expect(normal.race.car).toEqual(seule.race.car);
  });

  it("une vitesse illisible vaut 1", () => {
    const best: BestRun = { ms: golden.finishMs, splits: golden.splits, replay: golden.code, simVersion: SIM_VERSION };
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(loadGhost(track, { ...best, vitesse: v })!.vitesse).toBe(1);
  });
});
