import { describe, expect, it } from "vitest";
import { DEFAULT_CAR_PARAMS, createRace, parseTrack, stepRace, makeInput, trackWorld, type World } from "@cdj/sim";
import { predictLanding } from "../src/landing";

// Ombre d'atterrissage (lot 17) : la trajectoire prolongée trouve la réception, ou rien si la voiture tombe.

const SPEC = "S@start S S S S S K G D S S S S S S S@finish";

function flyOver(speed: number) {
  const track = parseTrack("s", SPEC);
  const race = createRace(track);
  const k = track.blocks[6]!;
  race.car.x = k.cx * 32 + 16;
  race.car.z = k.cz * 32 + 0.5;
  race.car.y = k.y0;
  race.car.vz = speed;
  // roule jusqu'à ce que la voiture soit au-dessus du vide, en l'air
  for (let i = 0; i < 2000; i++) {
    stepRace(race, makeInput(0, 1, 0));
    const over = race.car.z > (k.cz + 1) * 32 + 4 && race.car.z < (k.cz + 2) * 32 - 6;
    if (!race.car.grounded && over) return { race, track };
  }
  throw new Error("jamais au-dessus du vide");
}

describe("point de réception prévu", () => {
  it("à bonne vitesse, la prévision tombe sur la réception, plus loin que la voiture, au niveau de la route", () => {
    const { race, track } = flyOver(48);
    const landing = predictLanding(race.world, race.car, DEFAULT_CAR_PARAMS);
    expect(landing).not.toBeNull();
    const k = track.blocks[6]!;
    const gapEnd = (k.cz + 2) * 32;
    expect(landing!.z).toBeGreaterThan(gapEnd - 1); // après le vide
    expect(landing!.z).toBeGreaterThan(race.car.z);
    expect(landing!.t).toBeGreaterThan(0);
    expect(landing!.t).toBeLessThan(1.5);
    const reality = createRace(track);
    expect(landing!.y).toBeLessThanOrEqual(4.1); // le sol de la réception (un niveau plus haut au plus)
    void reality;
  });

  it("la prévision colle à la réalité : la voiture retombe là où l'ombre l'annonçait (à quelques mètres)", () => {
    const { race } = flyOver(52);
    const landing = predictLanding(race.world, race.car, DEFAULT_CAR_PARAMS)!;
    let z = race.car.z;
    for (let i = 0; i < 600; i++) {
      stepRace(race, makeInput(0, 1, 0));
      z = race.car.z;
      if (race.car.grounded) break;
    }
    expect(Math.abs(z - landing.z)).toBeLessThan(6);
  });

  it("trop lente, la voiture ne retombe sur rien : pas d'ombre", () => {
    const track = parseTrack("s", SPEC);
    const world = trackWorld(track);
    const k = track.blocks[6]!;
    const car = { x: k.cx * 32 + 16, z: (k.cz + 1) * 32 + 6, y: 5, vx: 0, vy: 2, vz: 20 };
    expect(predictLanding(world, car, DEFAULT_CAR_PARAMS)).toBeNull();
  });

  it("sur un monde sans sol, pas de prévision", () => {
    const void_: World = { voidY: -50, sample: (_x, _z, out) => void (out.height = -1e9), collide: () => false };
    expect(predictLanding(void_, { x: 0, y: 3, z: 0, vx: 0, vy: 0, vz: 10 }, DEFAULT_CAR_PARAMS)).toBeNull();
  });
});
