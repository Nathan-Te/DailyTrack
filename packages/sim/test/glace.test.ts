import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAR_PARAMS as P,
  FLAT_WORLD,
  TICK_RATE,
  carSpeed,
  PILOT_GRIPS,
  createAutopilot,
  createCar,
  createGlaceTrack,
  createRace,
  runPilot,
  stepRace,
  createSurface,
  trackWorld,
  forwardSpeed,
  makeInput,
  stepCar,
  type CarInput,
  type CarState,
  type SurfaceKind,
  type World,
} from "../src/index";

// Tests chiffrés du lot 16 : la glace refaite. Les seuils sont recopiés dans docs/lots/lot-16-glace.md.

const flatOf = (kind: SurfaceKind): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = kind;
  },
});

/** Voiture lancée à `speed` m/s vers +z. */
function launched(speed: number): CarState {
  const car = createCar();
  car.vz = speed;
  for (let i = 0; i < 30; i++) stepCar(car, makeInput(0, 0, 0), FLAT_WORLD); // se pose
  car.vx = 0;
  car.vz = speed;
  return car;
}

function run(kind: SurfaceKind, car: CarState, seconds: number, input: (t: number, c: CarState) => CarInput): void {
  const w = flatOf(kind);
  for (let i = 0; i < seconds * TICK_RATE; i++) stepCar(car, input(i / TICK_RATE, car), w);
}

/** Rayon (m) d'un virage tenu : vitesse ÷ vitesse de lacet, volant à fond, après stabilisation. */
function turnRadius(kind: SurfaceKind, throttle: number): number {
  const car = launched(30);
  run(kind, car, 2, () => makeInput(1, throttle, 0));
  return carSpeed(car) / Math.abs(car.yawRate);
}

describe("glace : ligne droite", () => {
  it("lancée à 30 m/s plein gaz, la glace va plus loin et plus vite que la route sur 20 s", () => {
    const road = launched(30);
    const ice = launched(30);
    run("road", road, 20, () => makeInput(0, 1, 0));
    run("ice", ice, 20, () => makeInput(0, 1, 0));
    console.log("droite lancée 30 m/s, 20 s : route", carSpeed(road).toFixed(1), road.z.toFixed(0), "glace", carSpeed(ice).toFixed(1), ice.z.toFixed(0));
    expect(carSpeed(ice)).toBeGreaterThan(carSpeed(road));
    expect(ice.z).toBeGreaterThan(road.z);
  });

  it("à l'arrêt, la glace accélère plus mollement que la route (patinage)", () => {
    const road = createCar();
    const ice = createCar();
    run("road", road, 2, () => makeInput(0, 1, 0));
    run("ice", ice, 2, () => makeInput(0, 1, 0));
    console.log("2 s depuis l'arrêt : route", carSpeed(road).toFixed(1), "glace", carSpeed(ice).toFixed(1));
    expect(carSpeed(ice)).toBeLessThan(0.6 * carSpeed(road));
  });

  it("en roue libre, la glace perd beaucoup moins de vitesse que la route", () => {
    const road = launched(40);
    const ice = launched(40);
    run("road", road, 3, () => makeInput(0, 0, 0));
    run("ice", ice, 3, () => makeInput(0, 0, 0));
    console.log("roue libre 3 s depuis 40 m/s : route", carSpeed(road).toFixed(1), "glace", carSpeed(ice).toFixed(1));
    expect(carSpeed(ice)).toBeGreaterThan(carSpeed(road) + 4);
  });
});

describe("glace : virage", () => {
  it("accélérateur appuyé, le rayon est au moins le double de celui en roue libre", () => {
    const pressed = turnRadius("ice", 1);
    const coast = turnRadius("ice", 0);
    console.log("rayon glace gaz", pressed.toFixed(1), "roue libre", coast.toFixed(1), "route gaz", turnRadius("road", 1).toFixed(1));
    expect(pressed).toBeGreaterThanOrEqual(2 * coast);
  });
});

describe("glace : frein", () => {
  it("de 30 m/s, la glace freine ≥ 2,5 fois plus long que la route et part en glisse en braquant", () => {
    const stop = (kind: SurfaceKind) => {
      const car = launched(30);
      const z0 = car.z;
      const w = flatOf(kind);
      for (let i = 0; i < 10 * TICK_RATE && forwardSpeed(car) > 0.5; i++) stepCar(car, makeInput(0, 0, 1), w);
      return car.z - z0;
    };
    console.log("freinage 30 m/s : route", stop("road").toFixed(1), "glace", stop("ice").toFixed(1));
    expect(stop("ice")).toBeGreaterThan(2.5 * stop("road"));
  });
});

describe("glace : roue libre, redirection", () => {
  it("en dérive, braquer dans le bon sens divise l'angle de dérive par deux en moins de 0,6 s, sans perdre 10 % de vitesse", () => {
    const car = launched(35);
    // Mise en dérive : accélérateur appuyé et volant à fond pendant 1,2 s.
    run("ice", car, 1.2, () => makeInput(1, 1, 0));
    const slip = (c: CarState) => {
      const f = forwardSpeed(c);
      const lat = c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw);
      return Math.abs(lat / Math.max(f, 1));
    };
    const start = slip(car);
    const v0 = carSpeed(car);
    // Roue libre, braquage dans le sens qui rattrape (vers la vitesse).
    const dir = Math.sign(car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw)) || 1;
    let half = -1;
    let vHalf = 0;
    const w = flatOf("ice");
    for (let i = 0; i < 0.6 * TICK_RATE; i++) {
      stepCar(car, makeInput(half < 0 ? -dir : 0, 0, 0), w);
      if (half < 0 && slip(car) <= start / 2) {
        half = (i + 1) / TICK_RATE;
        vHalf = carSpeed(car);
      }
    }
    console.log("dérive", start.toFixed(3), "→ ½ en", half.toFixed(2), "s ; vitesse", v0.toFixed(1), "→", vHalf.toFixed(1));
    expect(start).toBeGreaterThan(0.1);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.6);
    expect(vHalf).toBeGreaterThan(0.9 * v0);
  });
});

describe("scénario glace et pilote", () => {
  it("le pilote finit le scénario sans reprise (aux quatre niveaux d'adhérence), plus vite sur la glace qu'à l'arrivée sur route", () => {
    const t = createGlaceTrack();
    for (const grip of PILOT_GRIPS) {
      const r = runPilot(t, { grip });
      expect(r.valid).toBe(true);
      expect(r.respawns).toBe(0);
      expect(r.maxSpeed).toBeGreaterThan(P.maxSpeed); // la pointe de la glace dépasse celle du plat
    }
  });

  it("sur glace, le pilote lâche l'accélérateur pour tourner et le rend en ligne droite", () => {
    const t = createGlaceTrack();
    const race = createRace(t);
    const drive = createAutopilot(t, { grip: 1 });
    const world = trackWorld(t);
    const under = createSurface();
    let turnedOnIce = 0;
    let turnedWithGas = 0;
    let straightGas = 0;
    for (let i = 0; i < 40 * TICK_RATE && race.finishMs < 0; i++) {
      const input = drive(race);
      world.sample(race.car.x, race.car.z, under);
      const ice = under.kind === "ice";
      if (ice && Math.abs(input.steer) > 0.2 * 64) {
        turnedOnIce++;
        if (input.throttle > 0) turnedWithGas++;
      } else if (ice && input.steer === 0 && input.throttle > 0) straightGas++;
      stepRace(race, input);
    }
    expect(turnedOnIce).toBeGreaterThan(30);
    expect(turnedWithGas).toBe(0);
    expect(straightGas).toBeGreaterThan(100);
  });
});
