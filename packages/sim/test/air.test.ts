import { describe, expect, it } from "vitest";
import {
  CELL,
  DEFAULT_CAR_PARAMS as P,
  FLAT_WORLD,
  NO_INPUT,
  PILOT_GRIPS,
  TICK_RATE,
  blockHeight,
  blockPoint,
  carSpeed,
  createAirTrack,
  createAutopilot,
  createCar,
  createRace,
  makeInput,
  needsFreeze,
  parseTrack,
  runPilot,
  stepCar,
  stepRace,
  trackWorld,
  type CarState,
  type Track,
} from "../src/index";

// Atterrissages et contrôle en l'air (lot 19). Les seuils sont recopiés dans docs/lots/lot-19-air.md.

const GAS = makeInput(0, 1, 0);
const BRAKE = makeInput(0, 0, 1);

interface Landing {
  /** Vitesse horizontale juste avant le contact et dans la seconde qui suit le contact. */
  before: number;
  after: number;
  /** Montée maximale de la caisse après le premier contact (m), et vitesse verticale maximale. */
  rise: number;
  maxVy: number;
  /** Nombre de pas passés de nouveau en l'air dans la seconde qui suit le premier contact. */
  hops: number;
}

/** Lâche une voiture en vol au-dessus du sol plat, à `speed` m/s, de la hauteur `h`, avec l'inclinaison donnée. */
function dropFlat(h: number, tilt: { pitch?: number; roll?: number; yawRate?: number } = {}, speed = 35): Landing {
  const car = createCar(0, 0, 0, h);
  car.vz = speed;
  car.air = 100;
  car.grounded = 0;
  car.pitch = tilt.pitch ?? 0;
  car.roll = tilt.roll ?? 0;
  car.yawRate = tilt.yawRate ?? 0;
  return land(car, (c) => stepCar(c, NO_INPUT, FLAT_WORLD));
}

function land(car: CarState, step: (c: CarState) => void): Landing {
  let before = 0;
  const out: Landing = { before: 0, after: 0, rise: 0, maxVy: 0, hops: 0 };
  let y0 = 0;
  let touched = -1;
  for (let i = 0; i < 8 * TICK_RATE && (touched < 0 || i < touched + TICK_RATE); i++) {
    if (!car.grounded) before = Math.hypot(car.vx, car.vz);
    step(car);
    if (car.grounded && touched < 0) {
      touched = i;
      y0 = car.y;
      out.before = before;
      out.after = Math.hypot(car.vx, car.vz);
    }
    if (touched >= 0 && i > touched) {
      out.rise = Math.max(out.rise, car.y - y0);
      out.maxVy = Math.max(out.maxVy, car.vy);
      if (!car.grounded) out.hops++;
    }
  }
  return out;
}

describe("réception sans rebond", () => {
  it("chutes de 4 à 12 m, à plat : la caisse ne remonte pas de plus de 5 cm, aucun décollage parasite, ≥ 97 % de la vitesse gardée", () => {
    for (const h of [4, 6, 8, 10, 12]) {
      const r = dropFlat(h);
      expect(r.rise, `${h} m`).toBeLessThanOrEqual(0.05);
      expect(r.hops, `${h} m`).toBe(0);
      expect(r.after / r.before, `${h} m`).toBeGreaterThanOrEqual(0.97);
    }
  });

  it("sur le nez ou de travers : jamais de rebond ni de décollage, quelle que soit l'inclinaison (de −0,6 à +0,6)", () => {
    for (const h of [4, 8, 12]) {
      for (const [pitch, roll] of [[-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.6], [-0.5, 0.4], [0.45, -0.45]] as const) {
        const r = dropFlat(h, { pitch, roll });
        expect(r.hops, `${h} m, tangage ${pitch}, roulis ${roll}`).toBeLessThanOrEqual(2);
        expect(r.maxVy, `${h} m, tangage ${pitch}, roulis ${roll}`).toBeLessThan(2.5);
      }
    }
  });

  it("réception de travers à 30° (roulis 0,58) : perte mesurée et bornée (de 15 à 40 %), plus grande que de 15° et que bien alignée", () => {
    const aligned = dropFlat(8);
    const half = dropFlat(8, { roll: 0.35 });
    const crooked = dropFlat(8, { roll: 0.58 });
    const ratio = (r: Landing) => r.after / r.before;
    expect(ratio(crooked)).toBeLessThan(0.85);
    expect(ratio(crooked)).toBeGreaterThan(0.6);
    expect(ratio(half)).toBeGreaterThan(ratio(crooked));
    expect(ratio(aligned)).toBeGreaterThan(ratio(half));
    // La perte est bornée même au pire (caisse sur le côté).
    expect(ratio(dropFlat(8, { roll: 1.5, pitch: 1.5 }))).toBeGreaterThanOrEqual(0.38);
  });

  it("sur une pente (descente D2) et une bascule : la vitesse tangentielle est gardée, pas de rebond", () => {
    const track = parseTrack("p", "S@start S S D2 D2 S S S@finish");
    const down = track.blocks[3]!;
    const race = createRace(track);
    const pt = { x: 0, z: 0 };
    blockPoint(down, CELL / 2, 14, pt);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = blockHeight(down, 14) + 6;
    car.vz = 30;
    car.air = 100;
    car.grounded = 0;
    const r = land(car, () => stepRace(race, NO_INPUT));
    expect(r.hops).toBeLessThanOrEqual(2);
    expect(r.after / r.before).toBeGreaterThanOrEqual(0.95);
  });

  it("dans un virage relevé : réception sans rebond", () => {
    const track = parseTrack("b", "S@start S S L2/b S S S S@finish");
    const turn = track.blocks.find((b) => b.banked)!;
    const race = createRace(track);
    const pt = { x: 0, z: 0 };
    blockPoint(turn, CELL / 2, CELL / 2, pt);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = blockHeight(turn, CELL / 2) + 5;
    car.vz = 25;
    car.air = 100;
    car.grounded = 0;
    const r = land(car, () => stepRace(race, NO_INPUT));
    expect(r.hops).toBeLessThanOrEqual(1);
    expect(r.maxVy).toBeLessThan(3);
  });

  it("dans une cuve : tomber au fond d'une cuve droite ne fait pas rebondir", () => {
    const track = parseTrack("c", "S/n@start S S V V V V S S S@finish");
    const bowl = track.blocks[4]!;
    const race = createRace(track);
    const pt = { x: 0, z: 0 };
    blockPoint(bowl, CELL / 2, CELL / 2, pt);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = blockHeight(bowl, CELL / 2) + 6;
    car.vz = 30;
    car.air = 100;
    car.grounded = 0;
    const r = land(car, () => stepRace(race, NO_INPUT));
    expect(r.hops).toBeLessThanOrEqual(1);
    expect(r.rise).toBeLessThan(0.3);
    expect(r.after / r.before).toBeGreaterThanOrEqual(0.9);
  });

  it("les sauts du générateur et ceux du scénario `air` : aucun décollage parasite après une réception", () => {
    const tracks: Track[] = [
      parseTrack("saut", "S@start S S S S S K G D S S S S S S S@finish"),
      parseTrack("long", "S@start S S S S S K G G D S S S S S S S S@finish"),
      parseTrack("haut", "S@start S S S S S K GU S S S S S S S S S@finish"),
    ];
    for (const track of tracks) {
      const race = createRace(track);
      const k = track.blocks.findIndex((b) => b.kind === "kick");
      race.car.x = track.blocks[k]!.cx * CELL + CELL / 2;
      race.car.z = track.blocks[k]!.cz * CELL + 0.5;
      race.car.y = track.blocks[k]!.y0;
      race.car.vz = 62;
      const hops = hopsAfterLandings(race, (r) => makeInput(0, 1, needsFreeze(r.car) ? 1 : 0), 15 * TICK_RATE);
      expect(hops, track.id).toBe(0);
    }
  });
});

/** Suit la course et compte les pas où la voiture redécolle pour de bon (vol de plus de 0,1 s) dans la demi-seconde qui suit une réception ; un tassement de quelques centièmes de seconde n'est pas un rebond. */
function hopsAfterLandings(race: ReturnType<typeof createRace>, drive: (r: ReturnType<typeof createRace>) => ReturnType<typeof makeInput>, ticks: number): number {
  let hops = 0;
  let sinceLanding = Infinity;
  let wasAir = 0;
  for (let i = 0; i < ticks && race.finishMs < 0; i++) {
    stepRace(race, drive(race));
    const c = race.car;
    if (c.grounded && wasAir >= 12) sinceLanding = 0;
    wasAir = c.grounded ? 0 : c.air;
    if (sinceLanding < TICK_RATE / 2) {
      if (c.air >= 24) hops++;
      sinceLanding++;
    }
    if (race.respawns > 0) break;
  }
  return hops;
}

describe("rotation héritée du décollage", () => {
  const JUMP = parseTrack("saut", "S@start S S S S S K G D S S S S S S S@finish");

  function flight(entry: number, freeze: boolean) {
    const race = createRace(JUMP);
    const k = JUMP.blocks[6]!;
    race.car.x = k.cx * CELL + CELL / 2;
    race.car.z = k.cz * CELL + 0.5;
    race.car.y = k.y0;
    race.car.vz = entry;
    let takeoff: { pitch: number; pitchRate: number } | null = null;
    let pitchMin = Infinity;
    let pitchMax = -Infinity;
    let airTicks = 0;
    let wasGrounded = 1;
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      stepRace(race, makeInput(0, 1, freeze && needsFreeze(race.car) ? 1 : 0));
      const c = race.car;
      if (wasGrounded && !c.grounded && takeoff === null) takeoff = { pitch: c.pitch, pitchRate: c.pitchRate };
      if (!c.grounded && takeoff !== null) {
        airTicks++;
        pitchMin = Math.min(pitchMin, c.pitch);
        pitchMax = Math.max(pitchMax, c.pitch);
      }
      if (c.grounded && !wasGrounded && takeoff !== null) break;
      wasGrounded = c.grounded;
    }
    return { takeoff, pitchMin, pitchMax, airTicks, car: race.car };
  }

  it("à haute vitesse, la caisse part avec une vitesse de rotation et continue de tourner en l'air (le nez pique)", () => {
    const f = flight(55, false);
    expect(f.takeoff).not.toBeNull();
    expect(Math.abs(f.takeoff!.pitchRate)).toBeGreaterThan(0.2);
    expect(f.airTicks / TICK_RATE).toBeGreaterThan(1);
    // Aucun retour à l'horizontale : le tangage change de plus de 0,3 pente au long du vol.
    expect(f.pitchMax - f.pitchMin).toBeGreaterThan(0.3);
    expect(f.car.pitch).toBeLessThan(f.takeoff!.pitch - 0.2);
  });

  it("le frein fige : la caisse finit le vol à l'inclinaison du décollage, et la vitesse linéaire est la même qu'au frein relâché", () => {
    const free = flight(55, false);
    const frozen = flight(55, true);
    expect(frozen.pitchMax - frozen.pitchMin).toBeLessThan(0.15);
    expect(Math.abs(frozen.car.pitch - free.takeoff!.pitch)).toBeLessThan(0.3);
  });

  it("un dos d'âne pris à haute vitesse fait décoller la voiture, qui tourne en l'air", () => {
    const track = parseTrack("dos", "S@start S S S S S S U2 D2 S S S S S S@finish");
    const race = createRace(track);
    const up = track.blocks[7]!;
    race.car.x = up.cx * CELL + CELL / 2;
    race.car.z = up.cz * CELL + 4;
    race.car.y = blockHeight(up, 4);
    race.car.vz = 52;
    let air = 0;
    let rate = 0;
    for (let i = 0; i < 4 * TICK_RATE; i++) {
      stepRace(race, GAS);
      if (!race.car.grounded) {
        air++;
        rate = Math.max(rate, Math.abs(race.car.pitchRate));
      }
    }
    expect(air).toBeGreaterThan(TICK_RATE / 4);
    expect(rate).toBeGreaterThan(0.1);
  });
});

describe("frein en l'air", () => {
  /** Voiture en vol, qui tourne sur ses trois axes, et la même au frein. */
  function spinning(brake: number) {
    const car = createCar(0, 0, 0, 200);
    car.vz = 40;
    car.vy = 3;
    car.grounded = 0;
    car.air = 100;
    car.pitchRate = 2;
    car.rollRate = -1.5;
    car.yawRate = 1.2;
    const trace: number[] = [];
    for (let i = 0; i < Math.round(0.3 * TICK_RATE); i++) {
      stepCar(car, makeInput(0, 0, brake), FLAT_WORLD);
      trace.push(car.x, car.y, car.z);
    }
    return { car, trace };
  }

  it("la vitesse angulaire tombe sous 5 % de l'initiale en moins de 0,3 s", () => {
    const { car } = spinning(1);
    expect(Math.abs(car.pitchRate)).toBeLessThan(0.05 * 2);
    expect(Math.abs(car.rollRate)).toBeLessThan(0.05 * 1.5);
    expect(Math.abs(car.yawRate)).toBeLessThan(0.05 * 1.2);
  });

  it("sans frein la rotation se poursuit (amortissement aérien faible)", () => {
    const { car } = spinning(0);
    expect(car.pitchRate).toBeGreaterThan(2 * 0.85);
    expect(car.rollRate).toBeLessThan(-1.5 * 0.85);
    expect(car.yawRate).toBeGreaterThan(1.2 * 0.85);
  });

  it("le frein en l'air ne ralentit pas : mêmes positions et mêmes vitesses linéaires qu'au frein relâché", () => {
    const a = spinning(1);
    const b = spinning(0);
    expect(a.trace).toEqual(b.trace);
    expect(a.car.vx).toBe(b.car.vx);
    expect(a.car.vy).toBe(b.car.vy);
    expect(a.car.vz).toBe(b.car.vz);
  });

  it("accélérateur et direction sont sans effet en l'air", () => {
    const run = (input: ReturnType<typeof makeInput>) => {
      const car = createCar(0, 0, 0, 200);
      car.vz = 40;
      car.grounded = 0;
      car.air = 100;
      car.pitchRate = 1;
      for (let i = 0; i < TICK_RATE / 2; i++) stepCar(car, input, FLAT_WORLD);
      return [car.x, car.y, car.z, car.vx, car.vz, car.pitch, car.roll, car.yaw];
    };
    expect(run(makeInput(1, 1, 0))).toEqual(run(NO_INPUT));
  });

  it("le frein fige la caisse sans la remettre à plat : la rotation s'arrête là où elle est", () => {
    const car = createCar(0, 0, 0, 200);
    car.vz = 40;
    car.grounded = 0;
    car.air = 100;
    car.pitch = 0.3;
    car.pitchRate = -1.5;
    for (let i = 0; i < TICK_RATE; i++) stepCar(car, BRAKE, FLAT_WORLD);
    expect(car.pitch).toBeGreaterThan(0.1);
    expect(car.pitch).toBeLessThan(0.3);
  });
});

describe("pilote et scénario `air`", () => {
  const track = createAirTrack();

  it("le pilote fige la caisse en l'air (frein) sur chaque saut du scénario et ne redécolle pas après une réception", () => {
    const race = createRace(track);
    const drive = createAutopilot(track, { grip: 1 });
    let froze = 0;
    const hops = hopsAfterLandings(
      race,
      (r) => {
        const input = drive(r);
        if (!r.car.grounded && input.brake) froze++;
        return input;
      },
      90 * TICK_RATE,
    );
    expect(race.finishMs).toBeGreaterThan(0);
    expect(race.respawns).toBe(0);
    expect(froze).toBeGreaterThan(TICK_RATE / 2);
    expect(hops).toBe(0);
  });

  it("le pilote finit le scénario avec chaque réglage d'adhérence, sur le fond comme sur la paroi, sans reprise ni chute", () => {
    for (const wall of [false, true]) {
      for (const grip of PILOT_GRIPS) {
        const run = runPilot(track, { grip, wall });
        expect(run.valid, `grip ${grip} paroi ${wall}`).toBe(true);
        expect(run.respawns).toBe(0);
        expect(run.jumpsOk).toBe(true);
      }
    }
  }, 60_000);

  it("le scénario compte trois sauts à rampe K, un tremplin J, un dos d'âne, une cuve latérale et un virage relevé", () => {
    expect(track.blocks.filter((b) => b.kind === "kick").length).toBe(3);
    expect(track.blocks.some((b) => b.kind === "jump")).toBe(true);
    expect(track.blocks.filter((b) => b.kind === "up" && b.rise > 4).length).toBeGreaterThan(0);
    expect(track.blocks.some((b) => b.cuve)).toBe(true);
    expect(track.blocks.some((b) => b.banked)).toBe(true);
  });

  it("réglages : les clés du lot 19 existent et leurs valeurs par défaut sont celles documentées", () => {
    expect(P.airDamping).toBe(0.4);
    expect(P.airFreeze).toBe(14);
    expect(P.landAbsorb).toBe(0.95);
    expect(P.landTolerance).toBe(0.3);
    expect(P.landLoss).toBe(0.7);
  });

  it("monde de piste et monde plat donnent la même réception pour une chute à plat (même vitesse gardée à 1 % près)", () => {
    const flat = parseTrack("f", "S@start S S S S S S S@finish");
    const world = trackWorld(flat);
    const a = createCar(16, 40, 0, 8);
    const b = createCar(16, 40, 0, 8);
    for (const c of [a, b]) {
      c.vz = 35;
      c.air = 100;
      c.grounded = 0;
    }
    const ra = land(a, (c) => stepCar(c, NO_INPUT, world));
    const rb = land(b, (c) => stepCar(c, NO_INPUT, FLAT_WORLD));
    expect(Math.abs(ra.after - rb.after) / rb.after).toBeLessThan(0.01);
    expect(carSpeed(a)).toBeGreaterThan(30);
  });
});
