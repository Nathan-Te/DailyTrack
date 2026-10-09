import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAR_PARAMS,
  NO_INPUT,
  SURFACES,
  CELL,
  TICK_RATE,
  blockPoint,
  cellKey,
  carSpeed,
  createAutopilot,
  createCar,
  createPilotageTrack,
  createRace,
  createSurface,
  forwardSpeed,
  makeInput,
  needsFreeze,
  parseTrack,
  stepCar,
  stepRace,
  surfaceAt,
  trackWorld,
  wrapAngle,
  type CarState,
  type RaceState,
} from "../src/index";

// Tests de comportement chiffrés de la conduite (lot 7). Les seuils sont recopiés dans docs/lots/lot-7-conduite.md :
// s'ils changent, c'est que la sensation de conduite a changé.

const GAS = makeInput(0, 1, 0);
const P = DEFAULT_CAR_PARAMS;
const STRAIGHT = parseTrack("ligne", "S@start S S S S S S S S@finish");

/** Dérive (degrés) : angle entre le cap et la vitesse, positif quand la vitesse part à gauche du nez. */
function slideDeg(car: CarState): number {
  const v = carSpeed(car);
  if (v < 0.5) return 0;
  const lateral = car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw);
  return (Math.asin(lateral / v) * 180) / Math.PI;
}

function steps(race: RaceState, input = GAS, seconds = 1) {
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) stepRace(race, input);
}

describe("accélération et freinage", () => {
  it("0 → 100 km/h entre 1,4 et 2,2 s, vitesse de pointe 48 m/s (173 km/h, réglage de Nathan, retouche 7b)", () => {
    const car = createCar();
    let ticks = 0;
    while (carSpeed(car) < 100 / 3.6) {
      stepCar(car, GAS);
      ticks++;
    }
    expect(ticks / TICK_RATE).toBeGreaterThan(1.4);
    expect(ticks / TICK_RATE).toBeLessThan(2.2);
    for (let i = 0; i < 20 * TICK_RATE; i++) stepCar(car, GAS);
    expect(carSpeed(car)).toBeLessThanOrEqual(P.maxSpeed);
    expect(carSpeed(car)).toBeGreaterThan(P.maxSpeed * 0.99);
  });

  it("la poussée s'aplatit en approchant la pointe", () => {
    const car = createCar();
    const gain = () => {
      const v = carSpeed(car);
      for (let i = 0; i < TICK_RATE; i++) stepCar(car, GAS);
      return carSpeed(car) - v;
    };
    const first = gain();
    gain();
    const third = gain();
    expect(first).toBeGreaterThan(15);
    expect(third).toBeLessThan(first / 2.5);
  });

  it("freine fort : de la vitesse de pointe à l'arrêt en moins de 32 m, puis recule", () => {
    const car = createCar();
    car.vz = P.maxSpeed;
    let ticks = 0;
    while (forwardSpeed(car) > 0) {
      stepCar(car, makeInput(0, 0, 1));
      ticks++;
    }
    expect(car.z).toBeLessThan(32);
    expect(ticks / TICK_RATE).toBeLessThan(1.4);
    for (let i = 0; i < 4 * TICK_RATE; i++) stepCar(car, makeInput(0, 0, 1));
    expect(forwardSpeed(car)).toBeCloseTo(-P.reverseMax, 6);
  });
});

describe("direction et adhérence", () => {
  it("braquage à fond tenu : virage serré à basse vitesse, limite d'adhérence ~40 m/s² à haute vitesse, sans tête-à-queue", () => {
    for (const speed of [20, 30, 42, 48]) {
      const car = createCar();
      car.vz = speed;
      for (let i = 0; i < 3 * TICK_RATE; i++) stepCar(car, makeInput(1, carSpeed(car) < speed ? 1 : 0, 0));
      const v = carSpeed(car);
      const lateral = v * Math.abs(car.yawRate);
      expect(lateral, `${speed} m/s`).toBeGreaterThan(36);
      expect(lateral, `${speed} m/s`).toBeLessThan(46);
      expect(Math.abs(slideDeg(car)), `${speed} m/s`).toBeLessThan(8); // en grip : la voiture pivote, ne glisse pas
    }
  });

  it("réponse immédiate : le cap a déjà tourné de 5° après 0,25 s à 30 m/s", () => {
    const car = createCar();
    car.vz = 30;
    for (let i = 0; i < 0.25 * TICK_RATE; i++) stepCar(car, makeInput(-1, 1, 0));
    expect((car.yaw * 180) / Math.PI).toBeGreaterThan(5);
  });

  it("ne pivote pas à l'arrêt, et le braquage diminue avec la vitesse", () => {
    const car = createCar();
    for (let i = 0; i < TICK_RATE; i++) stepCar(car, makeInput(1, 0, 0));
    expect(car.yaw).toBe(0);
    const radius = (speed: number) => {
      const c = createCar();
      c.vz = speed;
      for (let i = 0; i < TICK_RATE; i++) stepCar(c, makeInput(1, carSpeed(c) < speed ? 1 : 0, 0));
      return carSpeed(c) / Math.abs(c.yawRate);
    };
    expect(radius(10)).toBeLessThan(8);
    expect(radius(40)).toBeGreaterThan(25);
  });

  it("grande courbe (virage large) prise à la limite en grip (~35 m/s² latéraux) : vitesse conservée à ≥ 92 %", () => {
    const track = parseTrack("courbe", "S@start S S S S L2 S S S@finish");
    const race = createRace(track);
    const drive = createAutopilot(track, { grip: 1 });
    const wide = track.blocks[5]!;
    let entry = -1;
    let exit = -1;
    let maxSlide = 0;
    for (let i = 0; i < 20 * TICK_RATE && race.finishMs < 0; i++) {
      stepRace(race, drive(race));
      const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
      if (b === wide) {
        if (entry < 0) entry = carSpeed(race.car);
        maxSlide = Math.max(maxSlide, Math.abs(slideDeg(race.car)));
      } else if (entry >= 0 && exit < 0) exit = carSpeed(race.car);
    }
    expect(entry).toBeGreaterThan(36);
    expect(exit / entry).toBeGreaterThanOrEqual(0.92);
    expect(maxSlide).toBeLessThan(8);
    expect(race.respawns).toBe(0);
  });
});

describe("dérapage", () => {
  /** Virage à droite à 36 m/s ; `brakeTicks` de frein braqué au début, puis gaz et braquage tenu, puis relâché. */
  function driftRun(brakeTicks: number) {
    const car = createCar();
    car.vz = 36;
    const slides: number[] = [];
    for (let i = 0; i < 30; i++) stepCar(car, makeInput(1, 1, 0));
    for (let i = 0; i < brakeTicks; i++) stepCar(car, makeInput(1, 0, 1));
    for (let i = 0; i < 1.2 * TICK_RATE; i++) {
      stepCar(car, makeInput(1, 1, 0));
      slides.push(slideDeg(car));
    }
    const held = car.drift;
    for (let i = 0; i < 0.5 * TICK_RATE; i++) stepCar(car, makeInput(0, 1, 0));
    return { car, slides, held };
  }

  it("un coup de frein en virage rapide fait décrocher l'arrière ; la glisse se tient à la direction, sans tête-à-queue", () => {
    const { slides, held } = driftRun(18);
    const late = slides.slice(TICK_RATE / 4);
    expect(Math.min(...late)).toBeGreaterThan(14); // ~20° de dérive tenus
    expect(Math.max(...slides)).toBeLessThan(35);
    expect(held).toBeGreaterThan(0.5);
  });

  it("sans coup de frein, le même virage reste en grip", () => {
    const { slides } = driftRun(0);
    expect(Math.max(...slides.map(Math.abs))).toBeLessThan(8);
  });

  it("sortie propre en relâchant : dérive < 2° et dérapage éteint 0,5 s plus tard", () => {
    const { car } = driftRun(18);
    expect(Math.abs(slideDeg(car))).toBeLessThan(2);
    expect(car.drift).toBe(0);
    expect(Math.abs(car.yawRate)).toBeLessThan(0.2);
  });

  it("en épingle, le meilleur dérapage fait demi-tour plus vite que la meilleure trajectoire en grip, à toutes les vitesses d'approche", () => {
    const uTurn = (speed: number, policy: (t: number, car: CarState) => ReturnType<typeof makeInput>) => {
      const car = createCar();
      car.vz = speed;
      let t = 0;
      while (!(car.vz < 0 && Math.abs(car.vx) < 0.05 * -car.vz) && t < 10 * TICK_RATE) stepCar(car, policy(t++, car));
      return t / TICK_RATE;
    };
    for (const speed of [38, 44, 48]) {
      // Chaque camp a droit à ses meilleurs essais : durée du frein braqué pour le dérapage, vitesse de freinage pour le grip.
      let drift = Infinity;
      for (const brakeTicks of [18, 30, 40, 55]) {
        drift = Math.min(drift, uTurn(speed, (t) => (t < brakeTicks ? makeInput(1, 0, 1) : makeInput(1, 1, 0))));
      }
      let grip = Infinity;
      for (const v of [12, 14, 16, 18, 20, 22, 24, 26, 28]) {
        grip = Math.min(grip, uTurn(speed, (_, car) => (carSpeed(car) > v && car.vz > 0 && Math.abs(car.vx) < 1 ? makeInput(0, 0, 1) : makeInput(1, carSpeed(car) < v ? 1 : 0, 0))));
      }
      expect(drift, `${speed} m/s`).toBeLessThan(grip);
    }
  });
});

describe("suspension et réceptions", () => {
  it("la caisse suit la pente : tangage = pente de la montée, à l'arrêt comme en roulant", () => {
    const track = parseTrack("cote", "S@start U S S@finish");
    const race = createRace(track);
    const up = track.blocks[1]!;
    const pt = { x: 0, z: 0 };
    blockPoint(up, 16, 16, pt);
    race.car.z = pt.z;
    race.car.y = 2;
    steps(race, NO_INPUT, 1);
    expect(race.car.pitch).toBeCloseTo(4 / 32, 2);
    expect(Math.abs(race.car.roll)).toBeLessThan(1e-9);
  });

  it("roulis vers l'extérieur en virage, tangage au freinage", () => {
    const car = createCar();
    car.vz = 30;
    for (let i = 0; i < TICK_RATE; i++) stepCar(car, makeInput(1, 1, 0)); // à droite : la caisse penche à gauche
    expect(car.roll).toBeLessThan(-0.02);
    const b = createCar();
    b.vz = 30;
    for (let i = 0; i < 20; i++) stepCar(b, makeInput(0, 0, 1));
    expect(b.pitch).toBeLessThan(-0.01); // le nez plonge
  });

  /** Voiture lâchée en l'air au-dessus d'une ligne droite, à 35 m/s. */
  function drop(roll: number, pitch: number) {
    const race = createRace(STRAIGHT);
    const car = race.car;
    car.z = 40;
    car.y = 2.5;
    car.vz = 35;
    car.vy = -6;
    car.roll = roll;
    car.pitch = pitch;
    car.grounded = 0;
    car.air = 100;
    let bounced = false; // remonte en l'air après le contact
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      stepRace(race, NO_INPUT);
      if (!car.grounded && car.vy > 1) bounced = true;
    }
    return { race, bounced };
  }

  it("réception à plat : ≥ 95 % de la vitesse gardée", () => {
    const race = createRace(STRAIGHT);
    const car = race.car;
    car.z = 40;
    car.y = 2.5;
    car.vz = 35;
    car.grounded = 0;
    car.air = 100;
    let before = 0;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      if (!car.grounded) before = carSpeed(car);
      stepRace(race, NO_INPUT);
      if (car.grounded && before > 0) break;
    }
    expect(carSpeed(car) / before).toBeGreaterThanOrEqual(0.95);
  });

  it("réception sur le tremplin du circuit d'essai : à plat, rien de perdu", () => {
    const track = createPilotageTrack();
    const jump = track.blocks.find((b) => b.kind === "jump")!;
    const race = createRace(track);
    const pt = { x: 0, z: 0 };
    blockPoint(jump, 16, 1, pt);
    const car = race.car;
    car.x = pt.x;
    car.z = pt.z;
    car.y = jump.y0 + 0.25;
    car.yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][jump.dir]!;
    car.vx = Math.sin(car.yaw) * 36;
    car.vz = Math.cos(car.yaw) * 36;
    let takeoff = 0;
    let flight = 0;
    for (let i = 0; i < 3 * TICK_RATE; i++) {
      // Lot 19 : la caisse garde sa rotation en l'air ; le frein la fige (ce que fait un bon joueur).
      stepRace(race, needsFreeze(car) ? makeInput(0, 1, 1) : GAS);
      if (!car.grounded) {
        if (!flight) takeoff = carSpeed(car);
        flight++;
      } else if (flight) break;
    }
    expect(flight / TICK_RATE).toBeGreaterThan(0.6);
    expect(carSpeed(car) / takeoff).toBeGreaterThanOrEqual(0.95);
    expect(race.respawns).toBe(0);
  });

  it("réception de travers (30°) : la vitesse baisse de 15 à 40 %, sans rebond (lot 19)", () => {
    const flat = drop(0, 0);
    const crooked = drop(0.58, 0);
    const ratio = carSpeed(crooked.race.car) / carSpeed(flat.race.car);
    expect(ratio).toBeLessThan(0.85);
    expect(ratio).toBeGreaterThan(0.6);
    expect(crooked.bounced).toBe(false);
    expect(flat.bounced).toBe(false);
  });
});

describe("rebords", () => {
  /** Voiture à 40 m/s, cap tourné de `deg` degrés vers le rebord droit, à 2,5 m de lui ; roue libre 0,7 s. */
  function graze(deg: number, wall = true) {
    const race = createRace(STRAIGHT);
    const car = race.car;
    const a = (-deg * Math.PI) / 180;
    car.x = wall ? 16 - 7 + 2.5 : 16;
    car.z = 40;
    car.yaw = wall ? a : 0;
    car.vx = wall ? 40 * Math.sin(a) : 0;
    car.vz = wall ? 40 * Math.cos(a) : 40;
    steps(race, NO_INPUT, 0.7);
    return race.car;
  }

  it("contact rasant (8°) : la voiture longe le rebord et garde ≥ 85 % de sa vitesse", () => {
    const touched = graze(8);
    const free = graze(0, false);
    expect(carSpeed(touched) / carSpeed(free)).toBeGreaterThanOrEqual(0.85);
    expect(Math.abs(touched.yaw)).toBeLessThan(0.05); // remise dans l'axe du rebord
  });

  it("plus l'angle est franc, plus la perte est grande", () => {
    const v = [4, 8, 15, 30].map((d) => carSpeed(graze(d)));
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeLessThan(v[i - 1]!);
    expect(v[3]! / carSpeed(graze(0, false))).toBeLessThan(0.8);
  });

  it("choc de face : grosse perte et rebond ; on en sort (demi-tour, 10 m/s dans le bon sens) en moins de 2 s", () => {
    const race = createRace(STRAIGHT);
    const car = race.car;
    car.z = 14;
    car.yaw = Math.PI; // face au mur du départ
    car.vz = -30;
    let hit = -1;
    let out = -1;
    let rebound = 0;
    for (let t = 0; t < 4 * TICK_RATE && out < 0; t++) {
      // Le joueur : marche arrière braquée 0,5 s, puis gaz en contre-braquant.
      const input = hit < 0 ? GAS : t - hit < 0.5 * TICK_RATE ? makeInput(1, 0, 1) : makeInput(-1, 1, 0);
      stepRace(race, input);
      if (hit < 0 && car.vz > 0) hit = t;
      if (hit >= 0 && t === hit + 3) rebound = car.vz;
      if (hit >= 0 && Math.abs(wrapAngle(car.yaw)) < 0.5 && forwardSpeed(car) > 10) out = t;
    }
    expect(rebound).toBeGreaterThan(3); // rebond
    expect(rebound).toBeLessThan(15); // grosse perte (30 m/s à l'impact)
    expect(out).toBeGreaterThan(0);
    expect((out - hit) / TICK_RATE).toBeLessThan(2);
    expect(race.respawns).toBe(0);
  });

  it("jamais coincé : plein gaz braqué contre un rebord, la voiture finit toujours par repartir", () => {
    const race = createRace(STRAIGHT);
    const car = race.car;
    car.x = 9.5;
    car.yaw = -Math.PI / 2; // face au rebord droit, collée (le disque avant est repoussé hors du rebord)
    steps(race, makeInput(1, 1, 0), 1); // plein gaz contre le rebord : on n'avance pas, on ne traverse pas
    expect(car.x).toBeGreaterThan(9 + 1);
    steps(race, makeInput(1, 0, 1), 0.6); // marche arrière braquée : le nez revient vers la route
    steps(race, makeInput(-1, 1, 0), 1.5);
    expect(carSpeed(car)).toBeGreaterThan(8);
    expect(car.x).toBeGreaterThan(9);
    expect(car.x).toBeLessThan(23);
  });
});

describe("plaque d'accélération", () => {
  it("dépasse la vitesse de pointe, puis y revient progressivement", () => {
    const track = parseTrack("plaque", "S@start S S S S P S S S S S S S S S S S S@finish");
    const race = createRace(track);
    let peak = 0;
    let peakAt = 0;
    for (let i = 0; i < 12 * TICK_RATE && race.finishMs < 0; i++) {
      stepRace(race, GAS);
      const v = carSpeed(race.car);
      if (v > peak) {
        peak = v;
        peakAt = i;
      }
    }
    expect(peak).toBeGreaterThan(P.maxSpeed + 8);
    expect(peak).toBeLessThanOrEqual(P.boostMaxSpeed + 0.5);
    // Retour : 1 s après le pic on est encore très au-dessus de la pointe, puis la traînée ramène progressivement vers elle
    // (plus de plafond dur : lot 15).
    const after = createRace(track);
    for (let i = 0; i <= peakAt + TICK_RATE; i++) stepRace(after, GAS);
    expect(carSpeed(after.car)).toBeGreaterThan(P.maxSpeed + 8);
    for (let i = 0; i < 11 * TICK_RATE; i++) stepRace(after, GAS);
    expect(carSpeed(after.car)).toBeLessThan(P.maxSpeed * 1.1);
  });
});

describe("revêtement (accroche du lot 8)", () => {
  it("chaque roue lit son revêtement ; la route est la référence neutre", () => {
    const sample = createSurface();
    trackWorld(STRAIGHT).sample(16, 40, sample);
    expect(sample.kind).toBe("road");
    expect(surfaceAt(sample)).toEqual({ grip: 1, traction: 1, rolling: 0, slick: 0 });
    expect(Object.keys(SURFACES)).toEqual(["road", "dirt", "ice", "grass", "sand", "gravel", "snow", "kerb"]);
  });
});
