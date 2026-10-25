import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  BASCULE_LOT_48,
  FIGURES,
  THEMES,
  TURF_FIGURES,
  composeSpec,
  dailyCircuit,
  formatDay,
  themeForDay,
  AXLE_FRONT,
  AXLE_REAR,
  DEFAULT_CAR_PARAMS as P,
  FLAT_WORLD,
  SIM_VERSION,
  SURFACES,
  TICK_RATE,
  bestPilotRun,
  carSpeed,
  createAutopilot,
  createCar,
  createHerbeTrack,
  createRace,
  makeInput,
  parseTrack,
  steerLimit,
  stepCar,
  stepRace,
  type CarState,
  type SurfaceKind,
  type World,
} from "../src/index";

// Tests chiffrés du lot 48 : l'herbe de course (`turf`, notation `S/z`). Les seuils sont recopiés dans docs/lots/lot-48-herbe.md :
// s'ils changent, c'est que la sensation sur l'herbe de course a changé.

const flatOf = (kind: SurfaceKind): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = kind;
  },
});

/** Sol d'herbe de course au-delà de `z0` (route avant) : le passage d'un revêtement à l'autre. */
const splitWorld = (before: SurfaceKind, after: SurfaceKind, z0: number): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = z < z0 ? before : after;
  },
});

/** Dérive : vitesse latérale ÷ vitesse (positive vers la gauche du nez). */
const slideOf = (c: CarState) => {
  const v = carSpeed(c);
  return v < 1 ? 0 : (c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw)) / v;
};
const deg = (slope: number) => (Math.asin(Math.min(1, Math.abs(slope))) * 180) / Math.PI;

/** Voiture lancée à `speed` m/s vers +z, posée et à plein gaz pendant 0,5 s. */
function launched(world: World, speed: number): CarState {
  const car = createCar();
  car.vz = speed;
  for (let i = 0; i < 60; i++) stepCar(car, makeInput(0, 1, 0), world);
  return car;
}

/** Tourne de 90° avec ce braquage (fraction du volant, à gauche) à plein gaz, puis redresse 0,5 s : durée et vitesse de sortie. */
function quarterTurn(kind: SurfaceKind, steer: number) {
  const world = flatOf(kind);
  const car = launched(world, 44);
  const yaw0 = car.yaw;
  let ticks = 0;
  let maxSlide = 0;
  while (Math.abs(car.yaw - yaw0) < Math.PI / 2 && ticks < 8 * TICK_RATE) {
    stepCar(car, makeInput(-steer, 1, 0), world);
    maxSlide = Math.max(maxSlide, Math.abs(slideOf(car)));
    ticks++;
  }
  for (let i = 0; i < 60; i++) stepCar(car, makeInput(0, 1, 0), world);
  return { seconds: ticks / TICK_RATE, exit: carSpeed(car), maxSlide };
}

/** Le pilote d'auteur (meilleure de ses adhérences) sur ce circuit : temps en secondes. */
function pilotSeconds(spec: string): number {
  const run = bestPilotRun(parseTrack("essai", spec), { cut: false });
  expect(run).not.toBeNull();
  return run!.finishMs / 1000;
}
/** Le même circuit, ses virages sur ce revêtement (`z` herbe de course, `h` l'herbe d'avant). */
const lead = "S/n@start S S S S S S";
const tail = "S S S S S S@finish";
const onTurns = (turns: string, mod: string) => `${lead} ${turns.split(" ").map((t) => (mod ? `${t}/${mod}` : t)).join(" ")} ${tail}`;

describe("lot 48 : une surface nouvelle, les anciens circuits n'en savent rien", () => {
  it("SIM_VERSION ne bouge pas : aucun ancien circuit n'a d'herbe de course, et l'herbe d'avant garde ses valeurs", () => {
    expect(SIM_VERSION).toBe(14);
    expect(SURFACES.grass).toEqual({ grip: 0.5, traction: 0.55, rolling: 7, slick: 0, turf: 0 });
    expect(SURFACES.turf.turf).toBe(1);
    for (const k of Object.keys(SURFACES) as SurfaceKind[]) if (k !== "turf") expect(SURFACES[k].turf).toBe(0);
    // Les clés turf* de la voiture sont les valeurs de la table (le pilote et le générateur lisent la table).
    expect([P.turfGrip, P.turfTraction, P.turfRolling]).toEqual([SURFACES.turf.grip, SURFACES.turf.traction, SURFACES.turf.rolling]);
    expect(parseTrack("z", "S@start S/z L2/z S@finish").blocks.map((b) => b.surface)).toEqual(["road", "turf", "turf", "road"]);
  });
});

describe("lot 48 : on garde son élan", () => {
  const top = (kind: SurfaceKind) => {
    const world = flatOf(kind);
    const car = createCar();
    let t100 = 0;
    for (let i = 0; i < 20 * TICK_RATE; i++) {
      stepCar(car, makeInput(0, 1, 0), world);
      if (!t100 && carSpeed(car) > 100 / 3.6) t100 = (i + 1) / TICK_RATE;
    }
    return { top: carSpeed(car), t100 };
  };

  it("pointe à 97–99 % de la route (≈ 46,9 m/s contre 48), l'herbe d'avant à 57 %", () => {
    const road = top("road").top;
    const turf = top("turf").top;
    expect(turf / road).toBeGreaterThan(0.97);
    expect(turf / road).toBeLessThan(0.99);
    expect(top("grass").top / road).toBeLessThan(0.6);
  });

  it("accélération un peu plus lente : 0 → 100 km/h 10 à 30 % plus long que sur la route", () => {
    const ratio = top("turf").t100 / top("road").t100;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.3);
  });

  it("une ligne droite d'herbe de 128 m prise à fond coûte moins de 0,1 s (l'herbe d'avant : plus d'une demi-seconde)", () => {
    const straight = (m: string) => pilotSeconds(`S/n@start S S S S S S ${Array(4).fill(m ? `S/${m}` : "S").join(" ")} S S S S S S@finish`);
    const road = straight("");
    expect(straight("z") - road).toBeLessThan(0.1);
    expect(straight("h") - road).toBeGreaterThan(0.5);
  });
});

describe("lot 48 : on glisse", () => {
  /** Volant amené de 0 à fond en 2 s à ~40 m/s : accélération latérale quand la dérive dépasse 3°, et glissements des essieux à cet instant. */
  const onset = (kind: SurfaceKind) => {
    const world = flatOf(kind);
    const car = launched(world, 36);
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      stepCar(car, makeInput((i + 1) / (2 * TICK_RATE), 1, 0), world);
      const slide = slideOf(car);
      if (Math.abs(slide) > Math.sin((3 * Math.PI) / 180)) {
        const u = car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw);
        const v = car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw);
        const delta = -car.steer * steerLimit(u, P);
        return { ay: Math.abs(car.yawRate * carSpeed(car)), front: Math.abs((v + AXLE_FRONT * car.yawRate - delta * u) / u), rear: Math.abs((v - AXLE_REAR * car.yawRate) / u) };
      }
    }
    return null;
  };

  it("seuil de glisse plus bas : la dérive passe 3° à moins de 85 % de l'accélération latérale de la route", () => {
    const road = onset("road")!;
    const turf = onset("turf")!;
    expect(turf.ay / road.ay).toBeLessThan(0.85);
    expect(turf.ay / road.ay).toBeGreaterThan(0.7);
  });

  it("l'arrière décroche le premier : au seuil, l'essieu arrière glisse plus que sur la route", () => {
    const road = onset("road")!;
    const turf = onset("turf")!;
    expect(turf.rear / turf.front).toBeGreaterThan(road.rear / road.front);
  });

  it("la glisse se tient à la direction : volant à fond 5 s, la dérive reste sous 21° (pas de tête-à-queue) et retombe sous 2° en 0,5 s volant lâché", () => {
    const world = flatOf("turf");
    const car = launched(world, 44);
    let maxSlide = 0;
    let drifting = 0;
    for (let i = 0; i < 5 * TICK_RATE; i++) {
      stepCar(car, makeInput(-1, 1, 0), world);
      maxSlide = Math.max(maxSlide, Math.abs(slideOf(car)));
      if (car.drift > 0) drifting++;
    }
    expect(deg(maxSlide)).toBeLessThan(21);
    expect(deg(maxSlide)).toBeGreaterThan(12); // elle glisse vraiment
    expect(drifting / TICK_RATE).toBeGreaterThan(4); // le dérapage s'est déclenché sans frein, et il tient
    for (let i = 0; i < 60; i++) stepCar(car, makeInput(0, 1, 0), world);
    expect(deg(slideOf(car))).toBeLessThan(2);
  });

  it("à volant doux, la voiture tient sa ligne sans dérapage", () => {
    const world = flatOf("turf");
    const car = launched(world, 44);
    for (let i = 0; i < 3 * TICK_RATE; i++) stepCar(car, makeInput(-0.3, 1, 0), world);
    expect(car.drift).toBe(0);
    expect(deg(slideOf(car))).toBeLessThan(5);
  });
});

describe("lot 48 : rapide si on est propre, punitif si on surbraque", () => {
  it("virages amples bien négociés (pilote d'auteur) : moins de 0,25 s perdue par virage ample (l'herbe d'avant : plus d'une seconde)", () => {
    const road = pilotSeconds(onTurns("L3", ""));
    expect(pilotSeconds(onTurns("L3", "z")) - road).toBeLessThan(0.25);
    expect(pilotSeconds(onTurns("L3", "h")) - road).toBeGreaterThan(1);
    const roadS = pilotSeconds(onTurns("L3 S R3", ""));
    expect(pilotSeconds(onTurns("L3 S R3", "z")) - roadS).toBeLessThan(0.5);
  });

  it("virages larges et serrés : moins de 0,5 s perdue chacun", () => {
    for (const turn of ["L2", "L"]) expect(pilotSeconds(onTurns(turn, "z")) - pilotSeconds(onTurns(turn, ""))).toBeLessThan(0.5);
  });

  it("quart de tour à 44 m/s : volant dosé (1/3) presque gratuit, volant à fond 2 fois plus coûteux que sur la route", () => {
    const clean = quarterTurn("turf", 1 / 3);
    const over = quarterTurn("turf", 1);
    const roadOver = quarterTurn("road", 1);
    const lost = (r: { exit: number }) => 44 - r.exit;
    expect(lost(clean)).toBeLessThan(1);
    expect(lost(over)).toBeGreaterThan(3 * Math.max(1, lost(clean)));
    expect(lost(over)).toBeGreaterThan(2 * lost(roadOver));
    // Sur l'herbe, on tourne plus serré à fond (l'arrière décroche) : on peut s'en servir… et le payer.
    expect(over.seconds).toBeLessThan(roadOver.seconds);
  });

  it("un dérapage au frein bien tenu se paie peu : il coûte moins de 1,3 fois le même sur la route", () => {
    const drift = (kind: SurfaceKind) => {
      const world = flatOf(kind);
      const car = launched(world, 44);
      const yaw0 = car.yaw;
      const v0 = carSpeed(car);
      for (let i = 0; i < 12; i++) stepCar(car, makeInput(-1, 0, 1), world);
      for (let i = 0; Math.abs(car.yaw - yaw0) < Math.PI / 2 && i < 8 * TICK_RATE; i++) stepCar(car, makeInput(-0.6, 1, 0), world);
      for (let i = 0; i < 60; i++) stepCar(car, makeInput(0, 1, 0), world);
      return v0 - carSpeed(car);
    };
    expect(drift("turf")).toBeLessThan(1.3 * drift("road"));
  });
});

describe("lot 48 : les passages route ↔ herbe se sentent, sans à-coup", () => {
  /** Pire variation d'une pas à l'autre de la vitesse d'avance (m/s²) et de la vitesse de lacet (rad/s²) en franchissant z0 à ce braquage. */
  const crossing = (before: SurfaceKind, after: SurfaceKind, steer: number) => {
    const world = splitWorld(before, after, 60);
    const car = createCar();
    car.vz = 46;
    let maxAx = 0;
    let maxYawAcc = 0;
    let prevV = carSpeed(car);
    let prevR = car.yawRate;
    for (let i = 0; i < 4 * TICK_RATE; i++) {
      stepCar(car, makeInput(i > 30 ? -steer : 0, 1, 0), world);
      if (i > 60) {
        maxAx = Math.max(maxAx, Math.abs(carSpeed(car) - prevV) * TICK_RATE);
        maxYawAcc = Math.max(maxYawAcc, Math.abs(car.yawRate - prevR) * TICK_RATE);
      }
      prevV = carSpeed(car);
      prevR = car.yawRate;
    }
    return { maxAx, maxYawAcc };
  };

  it("en ligne droite à 46 m/s : ni freinage brutal ni coup de volant (moins de 3 m/s², aucun lacet)", () => {
    for (const [a, b] of [["road", "turf"], ["turf", "road"]] as const) {
      const c = crossing(a, b, 0);
      expect(c.maxAx).toBeLessThan(3);
      expect(c.maxYawAcc).toBeLessThan(1e-6);
    }
  });

  it("en virage, le lacet varie au passage moins de 1,5 fois ce qu'il varie dans le même virage sur l'herbe seule", () => {
    const uniform = crossing("turf", "turf", 0.6).maxYawAcc;
    for (const [a, b] of [["road", "turf"], ["turf", "road"]] as const) expect(crossing(a, b, 0.6).maxYawAcc).toBeLessThan(1.5 * uniform);
  });
});

describe("lot 48 : aucun blocage", () => {
  it("à l'arrêt, volant à fond et plein gaz : la voiture repart (plus de 10 m/s en 3 s), de même en marche arrière", () => {
    const world = flatOf("turf");
    const car = createCar();
    for (let i = 0; i < 3 * TICK_RATE; i++) stepCar(car, makeInput(1, 1, 0), world);
    expect(carSpeed(car)).toBeGreaterThan(10);
    const back = createCar();
    for (let i = 0; i < 2 * TICK_RATE; i++) stepCar(back, makeInput(0, 0, 1), world);
    expect(carSpeed(back)).toBeGreaterThan(5);
  });

  it("le pilote finit le scénario herbe (`?scenario=herbe`), et à toutes ses adhérences", () => {
    const track = createHerbeTrack();
    const best = bestPilotRun(track, { cut: false });
    expect(best).not.toBeNull();
    expect(best!.finishMs / 1000).toBeGreaterThan(30);
    expect(best!.finishMs / 1000).toBeLessThan(45);
    for (const grip of [1, 0.9, 0.78]) {
      const race = createRace(track);
      const drive = createAutopilot(track, { grip });
      for (let i = 0; i < 90 * TICK_RATE && race.finishMs < 0; i++) stepRace(race, drive(race));
      expect(race.finishMs).toBeGreaterThan(0);
      expect(race.respawns).toBe(0);
    }
  });

  it("des commandes au hasard sur l'herbe de course : jamais plus d'une seconde presque à l'arrêt quand on accélère sans freiner", () => {
    const world = flatOf("turf");
    const car = createCar();
    let seed = 7;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    let input = makeInput(0, 1, 0);
    let stuck = 0;
    let worst = 0;
    let drifting = 0;
    for (let i = 0; i < 60 * TICK_RATE; i++) {
      if (i % 30 === 0) input = makeInput(rnd() * 2 - 1, rnd() < 0.8 ? 1 : 0, rnd() < 0.15 ? 1 : 0);
      stepCar(car, input, world);
      if (car.drift > 0) drifting++;
      stuck = input.throttle > 0 && input.brake === 0 && carSpeed(car) < 2 ? stuck + 1 : 0;
      worst = Math.max(worst, stuck);
    }
    expect(worst / TICK_RATE).toBeLessThan(1);
    expect(drifting).toBeGreaterThan(0);
  });

  it("le bas-côté d'herbe reste ce qu'il est : il punit la sortie (sous 30 m/s après 10 s, contre ≈ 47 sur l'herbe de course)", () => {
    const at = (kind: SurfaceKind) => {
      const world = flatOf(kind);
      const car = launched(world, 46);
      for (let i = 0; i < 10 * TICK_RATE; i++) stepCar(car, makeInput(0, 1, 0), world);
      return carSpeed(car);
    };
    expect(at("grass")).toBeLessThan(30);
    expect(at("turf")).toBeGreaterThan(46);
  });
});

describe("lot 48 : générateur v17, la Campagne sur l'herbe de course à partir du 04/11/2026", () => {
  const hasTurf = (spec: string) => spec.split(" ").some((t) => /\/[^@]*z/.test(t.replace(/~./g, "")));

  it("les figures d'herbe de course n'existent que pour la Campagne et à partir de la v17", () => {
    const turf = FIGURES.filter((f) => f.build({ L: "L", R: "R", wall: "ML", width: "n", variant: 0 })?.some((t) => t.includes("/z")));
    expect(turf.map((f) => f.name).sort()).toEqual([...TURF_FIGURES].sort());
    for (const f of turf) {
      expect(f.only).toEqual(["campagne"]);
      expect(f.since).toBe(17);
    }
  });

  it("20 circuits de Campagne d'après la bascule : tous ont de l'herbe de course, tous validés par le pilote dans la fenêtre 30–40 s", () => {
    let found = 0;
    let turfBlocks = 0;
    let blocks = 0;
    for (let d = BASCULE_LOT_48; found < 20; d++) {
      if (themeForDay(d).name !== "campagne") continue;
      const c = dailyCircuit(d);
      expect(c.fallback, formatDay(d)).toBe(false);
      expect(c.track.id).toBe(`jour-${formatDay(d)}-g17`);
      expect(hasTurf(c.spec), formatDay(d)).toBe(true);
      expect(c.authorMs).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
      expect(c.authorMs).toBeLessThanOrEqual(AUTHOR_MAX_MS);
      expect(c.figures.some((f) => (TURF_FIGURES as readonly string[]).includes(f.name))).toBe(true);
      turfBlocks += c.track.blocks.filter((b) => b.surface === "turf").length;
      blocks += c.track.blocks.length;
      found++;
    }
    // Mesuré au lot 48 : ≈ 14 % des blocs (README) ; l'herbe d'avant : 2,5 %.
    expect(turfBlocks / blocks).toBeGreaterThan(0.08);
    expect(turfBlocks / blocks).toBeLessThan(0.25);
  }, 120_000);

  it("les autres thèmes ne changent pas en v17 (à l'identifiant près), et la Campagne d'avant la bascule n'a pas d'herbe de course", () => {
    for (let d = BASCULE_LOT_48; d < BASCULE_LOT_48 + 16; d++) {
      for (const name of ["stade", "rallye", "nuit", "ville"] as const) expect(composeSpec(d, 0, THEMES[name], 0, 17)).toBe(composeSpec(d, 0, THEMES[name], 0, 16));
      expect(hasTurf(composeSpec(d, 0, THEMES.campagne, 0, 16) ?? "")).toBe(false);
    }
  });
});
