import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAR_PARAMS as CAR,
  CELL,
  NO_INPUT,
  TICK_RATE,
  blockHeight,
  blockPoint,
  createRace,
  createTestTrack,
  makeInput,
  stepRace,
  type RaceState,
} from "../src/index";
import { createAutopilot, runAutopilot } from "./helpers/autopilot";

const track = createTestTrack();
const GAS = makeInput(0, 1, 0);

function runFor(race: RaceState, input = GAS, seconds = 1) {
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) stepRace(race, input);
}

describe("course complète (pilote automatique)", () => {
  const run = runAutopilot(track, 120, { grip: 0.9 });

  it("finit le circuit d'essai dans une durée plausible, sans chute ni retour", () => {
    expect(run.race.finishMs).toBeGreaterThan(28_000);
    expect(run.race.finishMs).toBeLessThan(60_000);
    expect(run.race.respawns).toBe(0);
    expect(run.race.nextGate).toBe(track.gates.length);
  });

  it("enregistre trois temps intermédiaires croissants avant l'arrivée", () => {
    const { splits, finishMs } = run.race;
    expect(splits).toHaveLength(3);
    expect([...splits].sort((a, b) => a - b)).toEqual(splits);
    expect(finishMs).toBeGreaterThan(splits[2]!);
  });

  it("décolle sur le tremplin et les bosses, et profite des plaques d'accélération", () => {
    expect(run.airTicks).toBeGreaterThan(TICK_RATE); // plus d'une seconde en l'air au total
    expect(run.maxSpeed).toBeGreaterThan(CAR.maxSpeed + 5);
  });

  it("est déterministe, et le temps de référence ne change pas sans raison", () => {
    const again = runAutopilot(track, 120, { grip: 0.9 });
    expect(again.race.finishMs).toBe(run.race.finishMs);
    expect(again.race.car).toEqual(run.race.car);
    // Référence : si ce test casse, la physique ou le circuit d'essai ont changé.
    expect({ finishMs: run.race.finishMs, splits: run.race.splits }).toMatchInlineSnapshot(`
      {
        "finishMs": 32883,
        "splits": [
          8654,
          21778,
          29292,
        ],
      }
    `);
  });
});

describe("rebords et vide", () => {
  it("la voiture braquée à fond reste sur la route", () => {
    const race = createRace(track);
    runFor(race, makeInput(1, 1, 0), 6);
    expect(Math.abs(race.car.y)).toBeLessThan(0.2);
    expect(race.respawns).toBe(0);
    expect(Math.abs(race.car.x - CELL / 2)).toBeLessThanOrEqual(7 + 1e-9);
  });

  it("on ne sort pas du circuit en marche arrière depuis le départ", () => {
    const race = createRace(track);
    runFor(race, makeInput(0, 0, 1), 8);
    expect(race.car.z).toBeGreaterThanOrEqual(0);
    expect(race.respawns).toBe(0);
  });

  it("une chute sous le circuit ramène au départ, chrono qui continue", () => {
    const race = createRace(track);
    runFor(race, GAS, 1);
    race.car.y = race.world.voidY - 1;
    const tick = race.car.tick;
    stepRace(race, NO_INPUT);
    expect(race.respawns).toBe(1);
    expect(race.car.x).toBe(track.spawn.x);
    expect(race.car.z).toBe(track.spawn.z);
    expect(race.car.tick).toBe(tick + 2); // pas normal + pas de reprise : le temps ne s'arrête pas
  });
});

describe("reprise au point de contrôle", () => {
  it("le bouton de reprise ramène au dernier point de contrôle franchi, avec la vitesse et le cap du passage", () => {
    const race = createRace(track);
    expect(runAutopilotUntilSplit(race, 1)).toBe(true);
    const passage = { ...race.checkpoints[0]! };
    const gate = track.gates[0]!;
    const along = (passage.x - gate.x) * gate.fx + (passage.z - gate.z) * gate.fz;
    expect(along).toBeGreaterThanOrEqual(0); // pris juste après la porte
    expect(along).toBeLessThan(1);
    runFor(race, makeInput(1, 0, 1), 1.5); // on s'égare
    const tick = race.car.tick;
    stepRace(race, makeInput(0, 1, 0, true));
    expect(race.respawns).toBe(1);
    expect([race.car.x, race.car.z, race.car.yaw, race.car.vx, race.car.vz]).toEqual([passage.x, passage.z, passage.yaw, passage.vx, passage.vz]);
    expect(Math.hypot(race.car.vx, race.car.vz)).toBeGreaterThan(20);
    expect(race.car.tick).toBe(tick + 1); // le chrono continue
    expect(race.splits).toHaveLength(1); // le temps intermédiaire déjà pris reste acquis
  });

  it("sans point de contrôle franchi, la reprise ramène au départ", () => {
    const race = createRace(track);
    runFor(race, GAS, 2);
    stepRace(race, makeInput(0, 0, 0, true));
    expect([race.car.x, race.car.z]).toEqual([track.spawn.x, track.spawn.z]);
    expect(Math.hypot(race.car.vx, race.car.vz)).toBe(0); // départ arrêté
  });

  it("une porte franchie dans le désordre ne compte pas", () => {
    const race = createRace(track);
    const finish = track.gates[track.gates.length - 1]!;
    race.car.x = finish.x;
    race.car.z = finish.z - 2;
    race.car.y = finish.y;
    race.car.yaw = finish.yaw;
    race.car.vx = finish.fx * 30;
    race.car.vz = finish.fz * 30;
    runFor(race, GAS, 0.5);
    expect(race.finishMs).toBe(-1);
    expect(race.nextGate).toBe(0);
  });
});

function runAutopilotUntilSplit(race: RaceState, count: number): boolean {
  const drive = createAutopilot(race.track, { grip: 0.9 });
  for (let i = 0; i < 60 * TICK_RATE && race.splits.length < count; i++) stepRace(race, drive(race));
  return race.splits.length >= count;
}

describe("tremplin, pente et arrivée", () => {
  it("lance la voiture en l'air sur le tremplin, puis elle se pose plus loin", () => {
    const jump = track.blocks.find((b) => b.kind === "jump")!;
    const race = createRace(track);
    const pt = { x: 0, z: 0 };
    blockPoint(jump, CELL / 2, 2, pt);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = jump.y0 + 0.5; // sol à q = 2 : y0 + 0.5
    car.yaw = -Math.PI / 2; // le bloc du tremplin a le cap 3 (−x)
    car.vx = -35;
    car.vz = 0;
    let air = 0;
    let started = false;
    for (let i = 0; i < 4 * TICK_RATE; i++) {
      stepRace(race, GAS);
      if (!car.grounded) {
        air++;
        started = true;
      } else if (started) break;
    }
    expect(started).toBe(true);
    expect(air / TICK_RATE).toBeGreaterThan(0.4);
    expect(air / TICK_RATE).toBeLessThan(1.6);
    expect(car.grounded).toBe(1);
    expect(race.respawns).toBe(0);
    // Atterrit après le bord du tremplin (q = 12), dans ce bloc ou les suivants.
    expect(jump.cx * CELL + CELL - car.x).toBeGreaterThan(12);
  });

  it("ralentit en montée par rapport à du plat", () => {
    const up = track.blocks.find((b) => b.kind === "up")!;
    const pt = { x: 0, z: 0 };
    blockPoint(up, CELL / 2, 2, pt);
    const race = createRace(track);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = blockHeight(up, 2);
    car.yaw = headingYaw(up.dir);
    car.vx = Math.sin(car.yaw) * 25;
    car.vz = Math.cos(car.yaw) * 25;
    for (let i = 0; i < 20; i++) stepRace(race, NO_INPUT);
    const vUp = Math.hypot(car.vx, car.vz);
    const flat = createRace(track);
    flat.car.yaw = 0;
    flat.car.vz = 25;
    for (let i = 0; i < 20; i++) stepRace(flat, NO_INPUT);
    expect(vUp).toBeLessThan(Math.hypot(flat.car.vx, flat.car.vz));
  });

  it("ne s'envole pas quand le sol remonte un peu sous la voiture (pas de vitesse verticale parasite)", () => {
    const up = track.blocks.find((b) => b.kind === "up")!;
    const pt = { x: 0, z: 0 };
    blockPoint(up, CELL / 2, 4, pt);
    const race = createRace(track);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = blockHeight(up, 4) - 0.5; // 50 cm sous le sol
    car.yaw = headingYaw(up.dir);
    car.vx = Math.sin(car.yaw) * 28;
    car.vz = Math.cos(car.yaw) * 28;
    for (let i = 0; i < TICK_RATE; i++) stepRace(race, GAS);
    expect(car.vy).toBeLessThan(10); // pente 12,5 % × ~30 m/s ≈ 4 m/s
    expect(car.y - blockHeight(up, CELL)).toBeLessThan(2);
  });

  it("l'arrivée fige le temps et la voiture s'arrête", () => {
    const run = runAutopilot(track, 120, { grip: 0.9 });
    const t = run.race.finishMs;
    for (let i = 0; i < 10 * TICK_RATE; i++) stepRace(run.race, GAS);
    expect(run.race.finishMs).toBe(t);
    expect(Math.hypot(run.race.car.vx, run.race.car.vz)).toBeLessThan(0.5);
    expect(run.race.respawns).toBe(0);
  });
});

function headingYaw(dir: number): number {
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir]!;
}
