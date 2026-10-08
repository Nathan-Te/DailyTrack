import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAR_PARAMS,
  FAST_PEAK,
  NO_GROUND,
  TICK_RATE,
  carSpeed,
  createRace,
  createSurface,
  createVitesseTrack,
  makeInput,
  parseTrack,
  runPilot,
  stepRace,
  trackWorld,
  type RaceState,
} from "../src/index";

// Tests chiffrés de la vitesse (lot 15). Les seuils sont recopiés dans docs/lots/lot-15-vitesse.md.
// La pointe du plat (48 m/s) n'est plus un plafond dur : la gravité, les plaques et les super turbos vont plus haut,
// une traînée en cube du rapport vitesse ÷ pointe ramène progressivement vers elle.

const GAS = makeInput(0, 1, 0);
const P = DEFAULT_CAR_PARAMS;

function drive(race: RaceState, seconds: number, input = GAS): number {
  let peak = 0;
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) {
    stepRace(race, input);
    peak = Math.max(peak, carSpeed(race.car));
  }
  return peak;
}

describe("au-delà de la pointe", () => {
  it("sur le plat, la pointe reste 48 m/s à pleins gaz", () => {
    const race = createRace(parseTrack("plat", `S@start ${"S ".repeat(30)}S@finish`));
    const peak = drive(race, 14);
    expect(peak).toBeLessThanOrEqual(P.maxSpeed);
    expect(carSpeed(race.car)).toBeGreaterThan(P.maxSpeed * 0.99);
  });

  it("en descente, la vitesse dépasse la pointe du plat (et la pente la soutient)", () => {
    const race = createRace(parseTrack("descente", "S@start S D D D D D D D D D D D D S S@finish"));
    const peak = drive(race, 10);
    expect(peak).toBeGreaterThan(P.maxSpeed + 6);
    expect(peak).toBeLessThan(P.turboMaxSpeed);
  });

  it("après un super turbo, la vitesse dépasse la pointe puis y redescend progressivement", () => {
    const race = createRace(parseTrack("turbo", "S@start S T S S S S S S S S S S S S S S S S S S S S S S S S S S S S S@finish"));
    let peak = 0;
    let peakAt = 0;
    const speeds: number[] = [];
    for (let i = 0; i < 24 * TICK_RATE && race.finishMs < 0; i++) {
      stepRace(race, GAS);
      const v = carSpeed(race.car);
      if (v > peak) {
        peak = v;
        peakAt = i;
      }
      speeds.push(v);
    }
    expect(peak).toBeGreaterThan(P.maxSpeed * 1.5);
    expect(peak).toBeLessThanOrEqual(P.turboMaxSpeed + 0.5);
    const at = (s: number) => speeds[Math.min(speeds.length - 1, peakAt + Math.round(s * TICK_RATE))]!;
    // Retombée progressive : jamais une chute brutale (pas de plafond dur), toujours décroissante après le pic…
    for (let s = 0; s < 8; s++) expect(at(s + 1), `${s} s`).toBeLessThan(at(s));
    expect(at(0) - at(1)).toBeLessThan(12); // au plus ~12 m/s perdus la première seconde
    // … encore bien au-dessus de la pointe 3 s après le pic, de retour près d'elle au bout d'une douzaine de secondes.
    expect(at(3)).toBeGreaterThan(P.maxSpeed * 1.25);
    expect(at(12)).toBeLessThan(P.maxSpeed * 1.15);
  });

  it("la plaque pousse jusqu'à 66 m/s, des turbos enchaînés tiennent près de 88 m/s", () => {
    const plaque = createRace(parseTrack("p", "S@start S P S S S S S S S S S S@finish"));
    expect(drive(plaque, 6)).toBeGreaterThan(P.boostMaxSpeed - 3);
    const chaine = createRace(parseTrack("c", "S@start S T S S T S S S S S S S S S S S S S S S S S S S@finish"));
    expect(drive(chaine, 8)).toBeGreaterThan(P.turboMaxSpeed - 3);
  });
});

describe("pas de traversée à la vitesse maximale", () => {
  const surface = createSurface();

  /** Roule à `speed` avec une consigne de direction donnée ; vérifie à chaque pas que la voiture est restée sur la route. */
  function ride(spec: string, speed: number, steer: (race: RaceState, tick: number) => number, seconds = 6): RaceState {
    const track = parseTrack("choc", spec);
    const world = trackWorld(track);
    const race = createRace(track);
    race.car.vz = speed;
    for (let i = 0; i < seconds * TICK_RATE && race.finishMs < 0 && race.respawns === 0; i++) {
      stepRace(race, makeInput(steer(race, i), 1, 0));
      world.sample(race.car.x, race.car.z, surface);
      expect(surface.height, `pas ${i} : hors de la route à (${race.car.x.toFixed(1)}, ${race.car.z.toFixed(1)})`).not.toBe(NO_GROUND);
      expect(race.car.y, `pas ${i}`).toBeGreaterThan(world.voidY);
    }
    expect(race.respawns).toBe(0);
    return race;
  }

  it("un rebord droit, de biais à 88 m/s (angles de 5° à 60°), ne se traverse pas", () => {
    for (const yaw of [0.09, 0.2, 0.5, 1.05]) {
      const track = parseTrack("rebord", "S@start S S S S S S S S S S S S S S@finish");
      const world = trackWorld(track);
      const race = createRace(track);
      race.car.yaw = yaw;
      race.car.vx = 88 * Math.sin(yaw);
      race.car.vz = 88 * Math.cos(yaw);
      for (let i = 0; i < 4 * TICK_RATE && race.finishMs < 0; i++) {
        stepRace(race, GAS);
        world.sample(race.car.x, race.car.z, surface);
        expect(surface.height, `angle ${yaw}, pas ${i}`).not.toBe(NO_GROUND);
      }
    }
  });

  it("de face dans le rebord extérieur d'un virage, à 88 m/s, la voiture reste sur la route", () => {
    for (const spec of ["S@start S S S L2 S S S S S@finish", "S@start S S S R S S S S S@finish", "S@start S S S L3/b S S S S S@finish"]) {
      ride(spec, 88, () => 0, 5);
    }
  });

  it("à 88 m/s, braquer à fond contre un rebord, d'un côté puis de l'autre, ne traverse rien", () => {
    ride("S@start S S S S S S S S S S S S S S@finish", 88, (_race, tick) => (Math.floor(tick / 40) % 2 === 0 ? 1 : -1), 6);
  });

  it("à 88 m/s, le rebord arrête la voiture même d'un virage serré et d'une transition de largeur", () => {
    ride("S/n@start S S/n>e S L S S S S@finish", 88, () => 0, 5);
  });

  it("lot 21 : à 88 m/s, ni le rebord au bout d'un bas-côté ni la face où la bande s'arrête ne se traversent", () => {
    ride("S@start S/~h S S S S S S S S S S S/~r S@finish", 88, (_race, tick) => (Math.floor(tick / 40) % 2 === 0 ? 1 : -1), 6);
    ride("S@start S S/~h S L2 S S S/~r S S S@finish", 88, () => 0, 5);
    ride("S/n@start S S/~t S R S/~r S S S S@finish", 88, () => 0, 5);
    // Lancée sur la bande, droit dans la face d'un bloc à rebords (et dans celle d'une cuve).
    for (const spec of ["S@start S/~h S S S/~r S S S@finish", "S@start S/~p S S V V S S S@finish"]) {
      const track = parseTrack("face", spec);
      const world = trackWorld(track);
      const race = createRace(track);
      race.car.x = 16 + 11;
      race.car.z = 32 + 4; // sur la bande (le départ garde ses rebords)
      race.car.vz = 88;
      let peak = 0;
      for (let i = 0; i < 3 * TICK_RATE; i++) {
        stepRace(race, GAS);
        world.sample(race.car.x, race.car.z, surface);
        expect(surface.height, `${spec} pas ${i}`).not.toBe(NO_GROUND);
        expect(race.car.z).toBeLessThan(4 * 32);
        peak = Math.max(peak, race.car.z);
      }
      expect(peak).toBeGreaterThan(4 * 32 - 4); // elle a bien atteint la face
    }
  });
});

describe("scénario vitesse", () => {
  it("le pilote le finit sans reprise, à plus de 80 m/s, avec plus du tiers du temps au-delà de la pointe", () => {
    const track = createVitesseTrack();
    const run = runPilot(track, { grip: 1 });
    expect(run.valid).toBe(true);
    expect(run.maxSpeed).toBeGreaterThan(80);
    expect(run.maxSpeed).toBeGreaterThan(FAST_PEAK);
    expect(run.fastTicks / run.ticks).toBeGreaterThan(0.33);
  });
});
