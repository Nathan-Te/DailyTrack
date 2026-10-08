import { describe, expect, it } from "vitest";
import {
  CELL,
  CUVE_LEFT,
  CUVE_LIP,
  CUVE_RATIO,
  CUVE_RIGHT,
  DEFAULT_CAR_PARAMS as P,
  TICK_RATE,
  WALL_HEIGHT,
  FLAT_WORLD,
  createAutopilot,
  createCar,
  createCuvesTrack,
  createRace,
  createShellHit,
  createTestTrack,
  dailyCircuit,
  daysFromCivil,
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  isCurve,
  THEMES,
  type ThemeName,
  cuveAmplitude,
  cuveHeight,
  cuveRadius,
  cuveTop,
  decodeReplay,
  encodeReplay,
  makeInput,
  parseToken,
  Rng,
  parseTrack,
  replayRace,
  runPilot,
  stepCar,
  stepRace,
  trackWorld,
  type CarInput,
  type CarState,
  type Track,
} from "../src/index";

// Cuves (lot 18) : parois qui montent jusqu'à la verticale, contact par la normale de la surface.

/** Demi-largeur d'un bloc `S/n` : 10 m ; le rayon de la cuve et la hauteur de la paroi qui en découlent. */
const W = 10;
const R = CUVE_RATIO * W;
const STRAIGHT = "S/n@start S S ML ML ML ML ML ML S S@finish";

/** Place une voiture sur un bloc de cuve : `lat` (m, positif à gauche de l'axe), `y` au-dessus du fond, `q` m après l'entrée du bloc. */
function carOn(track: Track, block: number, lat: number, y: number, q: number, speed: number): CarState {
  const b = track.blocks[block]!;
  const car = createCar(b.cx * CELL + CELL / 2 + lat, b.cz * CELL + q, 0, b.y0 + y);
  car.vz = speed;
  return car;
}

const GAS = makeInput(0, 1, 0);

describe("notation des cuves", () => {
  it("V, ML, MR : trois droites avec leur paroi", () => {
    expect(parseToken("V")).toEqual({ kind: "straight", surface: "road", banked: false, cuve: CUVE_LEFT | CUVE_RIGHT });
    expect(parseToken("ML")).toMatchObject({ kind: "straight", cuve: CUVE_LEFT });
    expect(parseToken("MR")).toMatchObject({ kind: "straight", cuve: CUVE_RIGHT });
    expect(parseToken("V/n")).toMatchObject({ cuve: 3, width: { w0: 20, w1: 20 } });
    expect(parseToken("V/t")).toMatchObject({ surface: "dirt" });
  });

  it("/c sur un virage : la paroi est du côté extérieur", () => {
    expect(parseToken("L2/c")).toMatchObject({ kind: "wideL", cuve: CUVE_RIGHT });
    expect(parseToken("R2/c")).toMatchObject({ kind: "wideR", cuve: CUVE_LEFT });
    expect(parseToken("L3/c")).toMatchObject({ kind: "grandL", cuve: CUVE_RIGHT });
    expect(parseToken("R/c")).toMatchObject({ kind: "curveR", cuve: CUVE_LEFT });
  });

  it("refuse ce qui n'a pas de sens", () => {
    expect(() => parseToken("S/c")).toThrow(/virage/);
    expect(() => parseToken("L2/bc")).toThrow(/relevé/);
    expect(() => parseToken("V/o")).toThrow(/parois/);
    expect(() => parseToken("V@cp")).toThrow(/repère/);
    expect(() => parseToken("V/n>l")).toThrow(/transition/);
    expect(() => parseTrack("x", "V@start S S@finish")).toThrow();
    expect(() => parseTrack("x", "S@start S V@finish")).toThrow(/repère|arrivée/);
  });

  it("une paroi continue celle du voisin (pas de rampe à ce bord)", () => {
    const t = parseTrack("x", "S/n@start S V V V V S S@finish");
    const [, , a, b, c, d] = t.blocks;
    expect([a!.cuveIn, a!.cuveOut]).toEqual([0, 3]);
    expect([b!.cuveIn, b!.cuveOut]).toEqual([3, 3]);
    expect([c!.cuveIn, c!.cuveOut]).toEqual([3, 3]);
    expect([d!.cuveIn, d!.cuveOut]).toEqual([3, 0]);
    // Un mur à gauche derrière une cuve des deux côtés : seul le côté gauche se prolonge.
    const m = parseTrack("x", "S/n@start V ML S S@finish").blocks;
    expect([m[1]!.cuveOut, m[2]!.cuveIn]).toEqual([CUVE_LEFT, CUVE_LEFT]);
    // Largeur différente : rampe.
    const w = parseTrack("x", "S/e@start V/e V/e S/e>n V/n V/n S S@finish").blocks;
    expect(w[2]!.cuveOut).toBe(0);
    expect(w[4]!.cuveIn).toBe(0);
  });
});

describe("géométrie d'une cuve", () => {
  const track = parseTrack("g", STRAIGHT);
  const world = trackWorld(track);
  const hit = createShellHit();
  const block = 5;

  /** Point de la surface au côté gauche, à l'angle `a` du quart de cercle (0 = fond, π/2 = vertical), au milieu du bloc 5 (pleine amplitude). */
  const onSurface = (lat: number, y: number) => {
    const b = track.blocks[block]!;
    world.shell!(b.cx * CELL + CELL / 2 + lat, b.cz * CELL + CELL / 2, b.y0 + y, hit);
    return hit;
  };

  it("fond plat, quart de cercle, paroi verticale : distance nulle sur la surface", () => {
    const f = W - R;
    expect(onSurface(0, 0).d).toBeCloseTo(0, 9);
    expect(onSurface(f, 0).d).toBeCloseTo(0, 9);
    // Un point du quart de cercle à 45° : (f + R sin 45°, R − R cos 45°).
    const k = Math.sqrt(0.5);
    const h45 = onSurface(f + R * k, R - R * k);
    expect(h45.d).toBeCloseTo(0, 9);
    expect(h45.nx * h45.nx + h45.ny * h45.ny + h45.nz * h45.nz).toBeCloseTo(1, 9);
    expect(h45.ny).toBeCloseTo(k, 6); // la normale est à 45° de la verticale
    // La paroi verticale : normale horizontale vers l'axe.
    const wall = onSurface(W, R + 1);
    expect(wall.d).toBeCloseTo(0, 9);
    expect(wall.ny).toBeCloseTo(0, 9);
    expect(Math.hypot(wall.nx, wall.nz)).toBeCloseTo(1, 9);
    // Dans la matière : négatif. Dans l'air : positif.
    expect(onSurface(W + 0.5, R + 1).d).toBeLessThan(0);
    expect(onSurface(0, 2).d).toBeCloseTo(2, 9);
  });

  it("la surface est continue du fond à la paroi (pas de marche)", () => {
    let prev = onSurface(0, 0).ny;
    for (let lat = 0; lat <= W - 0.01; lat += 0.05) {
      // y sur la surface au côté gauche
      const f = W - R;
      const y = lat <= f ? 0 : R - Math.sqrt(R * R - (lat - f) * (lat - f));
      const h = onSurface(lat, y);
      expect(Math.abs(h.d)).toBeLessThan(1e-6);
      expect(Math.abs(h.ny - prev)).toBeLessThan(0.2); // la normale tourne sans saut
      prev = h.ny;
    }
  });

  it("la paroi monte en rampe depuis l'entrée d'une cuve et se prolonge dans la suivante", () => {
    const b = track.blocks[3]!; // premier ML
    const amp = (q: number) => cuveAmplitude(b, CUVE_LEFT, CELL / 2, q);
    expect(amp(0)).toBe(0);
    expect(amp(8)).toBeGreaterThan(0.1);
    expect(amp(8)).toBeLessThan(0.9);
    expect(amp(CELL)).toBe(1); // le bloc suivant prolonge la paroi
    // Côté sans cuve : un simple rebord.
    expect(cuveAmplitude(b, CUVE_RIGHT, CELL / 2, 16)).toBe(0);
    expect(cuveTop(W, 0)).toBe(WALL_HEIGHT);
    expect(cuveTop(W, 1)).toBeCloseTo(R + CUVE_LIP, 9);
    expect(cuveRadius(W, 1)).toBeCloseTo(R, 9);
  });

  it("un virage en cuve : la distance se mesure au centre du virage, la normale reste dans le plan rayon-vertical", () => {
    const t = parseTrack("c", "S/n@start S L2/c S S S@finish");
    const w = trackWorld(t);
    const b = t.blocks[2]!;
    const h = createShellHit();
    // Un point de l'arc à mi-parcours, sur l'axe, au sol : fond plat.
    w.shell!(b.cx * CELL + 38, b.cz * CELL + 30, b.y0, h);
    expect(h.straight).toBe(false);
    expect(Math.abs(h.qx * h.nx + h.qz * h.nz)).toBeLessThan(1e-9); // la normale est perpendiculaire à l'avance
    expect(Math.hypot(h.qx, h.qz)).toBeCloseTo(1, 9);
  });

  it("l'échantillon de sol (effets) donne une hauteur croissante vers la paroi, jamais NaN sur la route", () => {
    const b = track.blocks[block]!;
    let last = -1;
    for (let lat = 0; lat <= W; lat += 0.5) {
      const hgt = cuveHeight(b, CELL / 2 + lat, CELL / 2);
      expect(Number.isFinite(hgt)).toBe(true);
      expect(hgt).toBeGreaterThanOrEqual(last - 1e-9);
      last = hgt;
    }
    expect(Number.isNaN(cuveHeight(b, CELL / 2 + W + 1, CELL / 2))).toBe(true);
  });
});

describe("la voiture sur une paroi", () => {
  const track = parseTrack("w", STRAIGHT);
  const world = trackWorld(track);
  const full = 5; // un ML au milieu de la série (blocs 3 à 8) : pleine amplitude

  /** Inclinaison de la surface sous la voiture, en degrés (0 = à plat, 90 = paroi verticale). */
  const tiltDeg = (car: CarState) => (Math.acos(Math.min(1, Math.max(-1, car.ny))) * 180) / Math.PI;

  it("tient à 80° ou plus sur toute la longueur du mur, à bonne vitesse", () => {
    const car = carOn(track, full, W - 0.05, R + 1, 0, 42);
    let minTilt = 90;
    let minY = 99;
    const end = track.blocks[8]!.cz * CELL + CELL; // fin du dernier ML
    let ticks = 0;
    while (car.z < end - 20 && ticks++ < 10 * TICK_RATE) {
      stepCar(car, GAS, world);
      minTilt = Math.min(minTilt, tiltDeg(car));
      minY = Math.min(minY, car.y);
    }
    expect(car.z).toBeGreaterThan(end - 25);
    expect(car.grounded).toBe(1);
    expect(minTilt).toBeGreaterThanOrEqual(80);
    expect(minY).toBeGreaterThan(R); // elle ne glisse pas vers le fond
  });

  it("tient aussi à 85° et plus (la paroi verticale commence à R)", () => {
    const car = carOn(track, full, W - 0.05, R + 3, 0, 40);
    for (let i = 0; i < 2 * TICK_RATE; i++) stepCar(car, GAS, world);
    expect(tiltDeg(car)).toBeGreaterThanOrEqual(85);
    expect(car.y).toBeGreaterThan(R + 1.5);
  });

  it("trop lente, elle décroche, glisse vers le fond sans traverser la paroi et quitte la paroi en moins de 2 s", () => {
    for (const speed of [8, 15, 22]) {
      const car = carOn(track, full, W - 0.05, R + 1, 0, speed);
      let leftWall = -1;
      let lateralMax = 0;
      let minY = 99;
      for (let i = 0; i < 5 * TICK_RATE; i++) {
        stepCar(car, makeInput(0, 0, 0), world);
        lateralMax = Math.max(lateralMax, Math.abs(car.x - (track.blocks[full]!.cx * CELL + CELL / 2)));
        minY = Math.min(minY, car.y);
        // « Quitter la paroi » : l'inclinaison repasse sous 45° (elle est alors dans le quart de cercle bas, ou sur le fond).
        if (leftWall < 0 && tiltDeg(car) < 45) leftWall = i;
      }
      expect(leftWall, `à ${speed} m/s`).toBeGreaterThanOrEqual(0);
      expect(leftWall / TICK_RATE, `à ${speed} m/s`).toBeLessThan(2);
      expect(lateralMax).toBeLessThanOrEqual(W + 1e-6); // jamais au-delà de la paroi
      expect(minY).toBeGreaterThan(-1e-6); // ni sous le fond
      expect(car.y).toBeLessThan(R); // et elle n'est pas remontée
    }
  });

  it("elle ne reste pas bloquée : après le décrochage, elle repart", () => {
    const car = carOn(track, full, W - 0.05, R + 1, 0, 15);
    for (let i = 0; i < 2 * TICK_RATE; i++) stepCar(car, GAS, world);
    const z0 = car.z;
    for (let i = 0; i < 2 * TICK_RATE; i++) stepCar(car, GAS, world);
    expect(car.z - z0).toBeGreaterThan(20);
    expect(car.y).toBeLessThan(0.2);
  });

  it("aucune traversée, même à 88 m/s, en braquant à fond contre l'une puis l'autre paroi", () => {
    const bowl = parseTrack("v", "S/n@start S V V V V V V V V S S@finish");
    const w = trackWorld(bowl);
    const x0 = bowl.blocks[4]!.cx * CELL + CELL / 2;
    const top = cuveTop(W, 1);
    for (const steer of [-1, 1]) {
      for (const speed of [30, 60, 88]) {
        const car = carOn(bowl, 4, 0, 0, 0, speed);
        let minD = 99;
        let climbed = 0;
        const hit = createShellHit();
        for (let i = 0; i < 4 * TICK_RATE && car.z < 8 * CELL + 60; i++) {
          stepCar(car, makeInput(i < 120 ? steer : 0, 1, 0), w);
          if (w.shell!(car.x, car.z, car.y, hit)) minD = Math.min(minD, hit.d);
          climbed = Math.max(climbed, car.y);
          // Sous le bord de la paroi, jamais de l'autre côté ; et là où la cuve est pleine (blocs 5 à 7), même au-dessus : elle retient sans limite de hauteur.
          if (car.y < top - 0.5 || (car.z > 5 * CELL + 16 && car.z < 7 * CELL)) expect(Math.abs(car.x - x0)).toBeLessThanOrEqual(W + 0.05);
        }
        expect(minD, `${speed} m/s, braquage ${steer}`).toBeGreaterThan(-0.05);
        expect(climbed).toBeGreaterThan(1);
      }
    }
  });

  it("sans cuve, rien ne change : le monde n'a pas de `shell`, et même état au bit près qu'un monde sans `shell`", () => {
    // Le circuit d'essai n'a pas de cuve : son monde ne répond pas à `shell`, la voiture suit le modèle d'avant.
    const t = createTestTrack();
    const withShell = trackWorld(t);
    expect(withShell.shell).toBeUndefined();
    const without = { ...withShell, shell: undefined };
    const a = createRace(t);
    const b = createRace(t);
    b.world = without;
    const drive = createAutopilot(t);
    for (let i = 0; i < 40 * TICK_RATE && a.finishMs < 0; i++) {
      const input = drive(a);
      stepRace(a, input);
      stepRace(b, input);
    }
    expect(a.finishMs).toBeGreaterThan(0);
    expect(b.car).toEqual(a.car);
    expect(b.finishMs).toBe(a.finishMs);
  });

  it("dans un circuit qui a une cuve, `shell` ne répond que dans ses blocs", () => {
    const t = parseTrack("m", "S/n@start S V S S@finish");
    const w = trackWorld(t);
    expect(w.shell).toBeDefined();
    const hit = createShellHit();
    expect(w.shell!(16, 16, 0, hit)).toBe(false); // le bloc 0 : le départ
    expect(w.shell!(16, 48, 0, hit)).toBe(false); // le bloc 1
    expect(w.shell!(16, 80, 0, hit)).toBe(true); // le bloc 2 : la cuve
    expect(w.shell!(16, 112, 0, hit)).toBe(false);
  });

  it("un monde sans `shell` (sol plat) reste intact", () => {
    const car = createCar();
    for (let i = 0; i < 60; i++) stepCar(car, GAS, FLAT_WORLD);
    expect(car.ny).toBe(1);
    expect(car.z).toBeGreaterThan(0);
  });
});

describe("virages en cuve et pilote", () => {
  const spec = (curve: string) => `S/n@start S S P S S S S S ${curve} S S S@finish`;

  it("le pilote finit un virage en cuve, sur la paroi ou sur le fond, de chaque taille et dans les deux sens", () => {
    for (const curve of ["L/c", "R/c", "L2/c", "R2/c", "L3/c", "R3/c"]) {
      const track = parseTrack("c", spec(curve));
      // Le virage serré sur la paroi n'est plus pris par le pilote (lot 18b : à 47 m/s il sort par-dessus la crête) ; le générateur n'en pose plus.
      for (const wall of curve.length === 3 ? [false] : [true, false]) {
        const run = runPilot(track, { grip: 1, wall });
        expect(run.valid, `${curve} paroi=${wall}`).toBe(true);
        expect(run.respawns).toBe(0);
      }
    }
  });

  it("sur la paroi, la voiture monte vraiment (inclinaison, hauteur) et garde de la vitesse", () => {
    const track = parseTrack("c", spec("L3/c"));
    const race = createRace(track);
    const drive = createAutopilot(track, { grip: 1, wall: true });
    let maxTilt = 0;
    let maxY = 0;
    let minV = 99;
    while (race.finishMs < 0 && race.car.tick < 40 * TICK_RATE) {
      stepRace(race, drive(race));
      maxTilt = Math.max(maxTilt, Math.sqrt(1 - race.car.ny * race.car.ny));
      maxY = Math.max(maxY, race.car.y);
      if (race.car.z > 190) minV = Math.min(minV, Math.hypot(race.car.vx, race.car.vz));
    }
    expect(race.finishMs).toBeGreaterThan(0);
    expect(maxTilt).toBeGreaterThan(0.9); // plus de 64°
    expect(maxY).toBeGreaterThan(2);
    // Sur le fond, le même virage serré se prend à ≈ 20 m/s ; sur la paroi, nettement plus vite.
    expect(minV).toBeGreaterThan(27);
  });

  it("la rediffusion d'une course sur la paroi redonne le même résultat (encodée puis décodée)", () => {
    const track = parseTrack("c", spec("L2/c"));
    const run = runPilot(track, { grip: 1, wall: true });
    expect(run.valid).toBe(true);
    const again = replayRace(track, decodeReplay(encodeReplay(run.replay)));
    expect(again.finishMs).toBe(run.finishMs);
    expect(again.respawns).toBe(0);
  });

  it("le scénario cuves : le pilote le finit avec chaque réglage, et la voiture monte sur le mur latéral", () => {
    const track = createCuvesTrack();
    expect(track.blocks.filter((b) => b.cuve).length).toBe(10);
    for (const grip of [1.08, 1, 0.9, 0.78]) {
      const run = runPilot(track, { grip, wall: false });
      expect(run.valid, `grip ${grip}`).toBe(true);
    }
    const run = runPilot(track, { grip: 1, wall: true });
    expect(run.valid).toBe(true);
  });
});

describe("cuves : rejeu et pureté", () => {
  it("une même suite de commandes donne le même état, deux fois", () => {
    const track = createCuvesTrack();
    const inputs: CarInput[] = [];
    const drive = createAutopilot(track, { grip: 1, wall: true });
    const r0 = createRace(track);
    for (let i = 0; i < 25 * TICK_RATE; i++) {
      const input = drive(r0);
      inputs.push(input);
      stepRace(r0, input);
    }
    const r1 = createRace(track);
    for (const input of inputs) stepRace(r1, input);
    expect(r1.car).toEqual(r0.car);
    expect(r1.splits).toEqual(r0.splits);
  });
});

describe("cuves : conduite au hasard", () => {
  it("des commandes tirées au hasard ne produisent jamais d'état invalide ni de traversée", () => {
    const track = parseTrack("f", "S/n@start S V V V ML MR L2/c S R3/c S L/c S V V S R/c S R2/c S S@finish");
    const world = trackWorld(track);
    const hit = createShellHit();
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed * 7919);
      const race = createRace(track);
      let steer = 0;
      let throttle = 1;
      let brake = 0;
      for (let i = 0; i < 60 * TICK_RATE && race.finishMs < 0; i++) {
        if (i % 24 === 0) {
          steer = (rng.int(5) - 2) / 2;
          throttle = rng.int(4) === 0 ? 0 : 1;
          brake = rng.int(8) === 0 ? 1 : 0;
        }
        stepRace(race, makeInput(steer, throttle, brake));
        const c = race.car;
        expect(Number.isFinite(c.x + c.y + c.z + c.vx + c.vy + c.vz + c.yaw + c.yawRate), `graine ${seed}, pas ${i}`).toBe(true);
        expect(Math.hypot(c.vx, c.vy, c.vz)).toBeLessThan(150);
        if (world.shell!(c.x, c.z, c.y, hit)) expect(hit.d, `graine ${seed}, pas ${i}`).toBeGreaterThan(-0.2);
        expect(c.nx * c.nx + c.ny * c.ny + c.nz * c.nz).toBeCloseTo(1, 6);
      }
    }
  }, 90_000);
});

describe("générateur : cuves", () => {
  const FIRST = daysFromCivil(2026, 10, 6);
  const circuits = (theme: ThemeName, n: number) => Array.from({ length: n }, (_, k) => dailyCircuit(FIRST + k, 0, theme));
  const kindsOf = (c: ReturnType<typeof dailyCircuit>) => {
    const cu = c.track.blocks.filter((b) => b.cuve);
    return { bowl: cu.some((b) => !isCurve(b.kind) && b.cuve === 3), wall: cu.some((b) => !isCurve(b.kind) && b.cuve !== 3), turn: cu.some((b) => isCurve(b.kind)) };
  };

  it("Stade et Nuit (cuveChance 100 %) : une cuve par circuit, durée d'auteur dans la fenêtre, aucun secours, les trois motifs", () => {
    expect(THEMES.stade.cuveChance).toBe(100);
    expect(THEMES.nuit.cuveChance).toBe(100);
    const seen = { bowl: 0, wall: 0, turn: 0 };
    for (const theme of ["stade", "nuit"] as const) {
      for (const c of circuits(theme, 16)) {
        expect(c.fallback).toBe(false);
        expect(c.authorMs).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
        expect(c.authorMs).toBeLessThanOrEqual(AUTHOR_MAX_MS);
        const cu = c.track.blocks.filter((b) => b.cuve);
        expect(cu.length, `${theme} ${c.date}`).toBeGreaterThan(0);
        // Jamais sur le départ ni l'arrivée, ni sur un revêtement, une largeur qui change, ou un relief : une cuve est plate, sur la route.
        for (const b of cu) {
          expect(b.index).toBeGreaterThan(0);
          expect(b.index).toBeLessThan(c.track.blocks.length - 1);
          expect(b.surface).toBe("road");
          expect(b.w0).toBe(b.w1);
          expect(b.rise).toBe(0);
          expect(b.open).toBe(false);
          expect(b.banked).toBe(false);
        }
        const k = kindsOf(c);
        seen.bowl += k.bowl ? 1 : 0;
        seen.wall += k.wall ? 1 : 0;
        seen.turn += k.turn ? 1 : 0;
      }
    }
    expect(seen.bowl).toBeGreaterThan(0);
    expect(seen.wall).toBeGreaterThan(0);
    expect(seen.turn).toBeGreaterThan(0);
  }, 120_000);

  it("Rallye et Campagne n'ont jamais de cuve ; Banquise en a parfois", () => {
    for (const theme of ["rallye", "campagne"] as const) for (const c of circuits(theme, 8)) expect(c.track.blocks.some((b) => b.cuve)).toBe(false);
    const banquise = circuits("banquise", 20).filter((c) => c.track.blocks.some((b) => b.cuve)).length;
    expect(banquise).toBeGreaterThan(0);
    expect(banquise).toBeLessThan(20);
  }, 120_000);

  it("le temps de l'auteur est celui de la meilleure ligne (fond ou paroi) : jamais plus lent que le pilote sur le fond", () => {
    for (const c of circuits("stade", 10)) {
      const floor = runPilot(c.track, { grip: 1, wall: false });
      if (floor.respawns === 0) expect(c.authorMs).toBeLessThanOrEqual(floor.finishMs);
    }
  }, 120_000);
});
