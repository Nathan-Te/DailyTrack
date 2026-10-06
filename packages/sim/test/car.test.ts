import { describe, expect, it } from "vitest";
import { CAR, NO_INPUT, TICK_RATE, carSpeed, createCar, makeInput, stepCar, type CarInput, type CarState } from "../src/index";

function run(car: CarState, input: CarInput, seconds: number): CarState {
  const n = Math.round(seconds * TICK_RATE);
  for (let i = 0; i < n; i++) stepCar(car, input);
  return car;
}

const GAS = makeInput(0, 1, 0);
const BRAKE = makeInput(0, 0, 1);

describe("voiture", () => {
  it("quantifie les commandes en entiers", () => {
    expect(makeInput(1, 1, 0)).toEqual({ steer: 64, throttle: 64, brake: 0 });
    expect(makeInput(-5, 2, -1)).toEqual({ steer: -64, throttle: 64, brake: 0 });
    expect(Number.isInteger(makeInput(0.3333, 0.777, 0.1).steer)).toBe(true);
  });

  it("reste immobile sans commande", () => {
    const car = run(createCar(), NO_INPUT, 2);
    expect(car.x).toBe(0);
    expect(car.z).toBe(0);
  });

  it("accélère vers l'avant (+z) et plafonne sous la vitesse max", () => {
    const car = run(createCar(), GAS, 3);
    expect(car.z).toBeGreaterThan(20);
    expect(Math.abs(car.x)).toBeLessThan(1e-9);
    const v3 = carSpeed(car);
    run(car, GAS, 30);
    expect(carSpeed(car)).toBeGreaterThan(v3);
    expect(carSpeed(car)).toBeLessThanOrEqual(CAR.maxSpeed);
    expect(carSpeed(car)).toBeGreaterThan(CAR.maxSpeed * 0.97);
  });

  it("0 → 100 km/h en moins de 3,5 s (agréable, arcade)", () => {
    const car = createCar();
    let ticks = 0;
    while (carSpeed(car) < 100 / 3.6 && ticks < 10 * TICK_RATE) {
      stepCar(car, GAS);
      ticks++;
    }
    expect(ticks / TICK_RATE).toBeLessThan(3.5);
    expect(ticks / TICK_RATE).toBeGreaterThan(1.5);
  });

  it("freine jusqu'à l'arrêt puis recule, plafonné", () => {
    const car = run(createCar(), GAS, 3);
    run(car, BRAKE, 1.2);
    expect(carSpeed(car)).toBeLessThan(CAR.maxSpeed);
    run(car, BRAKE, 6);
    expect(car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw)).toBeCloseTo(-CAR.reverseMax, 6);
  });

  it("ralentit et s'arrête quand on lâche tout", () => {
    const car = run(createCar(), GAS, 3);
    run(car, NO_INPUT, 20);
    expect(carSpeed(car)).toBe(0);
  });

  it("tourne à droite quand steer > 0 (x négatif quand on regarde vers +z)", () => {
    const car = run(createCar(), makeInput(1, 1, 0), 1);
    expect(car.yaw).toBeLessThan(0);
    expect(car.x).toBeLessThan(0);
    const left = run(createCar(), makeInput(-1, 1, 0), 1);
    expect(left.yaw).toBeGreaterThan(0);
    expect(left.x).toBeGreaterThan(0);
  });

  it("ne pivote pas à l'arrêt", () => {
    const car = run(createCar(), makeInput(1, 0, 0), 2);
    expect(car.yaw).toBe(0);
  });

  it("le braquage est lissé, pas instantané", () => {
    const car = createCar();
    stepCar(car, makeInput(1, 1, 0));
    expect(car.steer).toBeGreaterThan(0);
    expect(car.steer).toBeLessThan(0.2);
  });

  it("est symétrique gauche/droite", () => {
    const r = run(createCar(), makeInput(1, 1, 0), 4);
    const l = run(createCar(), makeInput(-1, 1, 0), 4);
    expect(l.x).toBeCloseTo(-r.x, 9);
    expect(l.z).toBeCloseTo(r.z, 9);
  });

  it("garde le cap dans [-π, π] sur un long virage", () => {
    const car = run(createCar(), makeInput(1, 1, 0), 60);
    expect(Math.abs(car.yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

/** Scénario fixe ; sa signature exacte ne doit jamais changer sans raison (voir ci-dessous). */
function scriptedRun(): CarState {
  const car = createCar(3, -7, 0.5);
  const script: [CarInput, number][] = [
    [makeInput(0, 1, 0), 240],
    [makeInput(1, 1, 0), 180],
    [makeInput(-0.4, 0.8, 0), 300],
    [makeInput(0, 0, 1), 150],
    [makeInput(-1, 0, 1), 200],
    [makeInput(0.2, 1, 0), 500],
    [NO_INPUT, 100],
  ];
  for (const [input, ticks] of script) for (let i = 0; i < ticks; i++) stepCar(car, input);
  return car;
}

describe("déterminisme", () => {
  it("deux exécutions donnent exactement le même état", () => {
    expect(scriptedRun()).toEqual(scriptedRun());
  });

  it("l'état final correspond à la valeur de référence (exact, bit à bit)", () => {
    // Valeur de référence : si ce test casse, la physique a changé → toutes les rediffusions
    // enregistrées sont invalides. À ne mettre à jour qu'en connaissance de cause.
    const c = scriptedRun();
    expect({ x: c.x, z: c.z, yaw: c.yaw, vx: c.vx, vz: c.vz, steer: c.steer, tick: c.tick }).toMatchInlineSnapshot(`
      {
        "steer": 0,
        "tick": 1670,
        "vx": 33.548352925443965,
        "vz": 4.090447464068155,
        "x": 61.15080086622217,
        "yaw": 1.4494554117469587,
        "z": 82.717072701484,
      }
    `);
  });
});
