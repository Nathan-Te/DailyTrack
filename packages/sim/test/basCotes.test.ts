import { describe, expect, it } from "vitest";
import {
  CELL,
  FLAT_WORLD,
  KERB_WIDTH,
  NO_GROUND,
  RIPPLE_HEIGHT,
  SHOULDER_EDGE,
  SURFACES,
  TICK_RATE,
  Rng,
  carSpeed,
  choiceMoments,
  createBasCotesTrack,
  createCar,
  createRace,
  createSurface,
  makeInput,
  parseToken,
  parseTrack,
  rippleAt,
  runPilot,
  stepCar,
  stepRace,
  trackWorld,
  type CarState,
  type SurfaceKind,
  type World,
} from "../src/index";

// Tests chiffrés du lot 21 : bas-côtés, vibreurs, route bosselée. Les seuils sont recopiés dans docs/lots/lot-21-identite.md.

const GAS = makeInput(0, 1, 0);
const flatOf = (kind: SurfaceKind): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = kind;
  },
});

describe("notation des bords (chaînée comme la largeur)", () => {
  it("lit le bord et la route bosselée", () => {
    expect(parseToken("S/~h").edge).toBe("grass");
    expect(parseToken("S/n~t").edge).toBe("gravel");
    expect(parseToken("L2/~p").edge).toBe("snow");
    expect(parseToken("S/~v").edge).toBe("void");
    expect(parseToken("S/t~r@cp")).toEqual({ kind: "straight", surface: "dirt", banked: false, mark: "checkpoint", edge: "wall" });
    expect(parseToken("S/u").bumpy).toBe(true);
    expect(parseToken("S/tu").surface).toBe("dirt");
    expect(() => parseToken("S/~x")).toThrow(/Bord inconnu/);
    expect(() => parseToken("S/~h~t")).toThrow(/Deux bords/);
    expect(() => parseToken("L2/u")).toThrow(/bosselée/);
  });

  it("un bord vaut pour les blocs suivants jusqu'au prochain ; les blocs qui ne peuvent pas en porter gardent leurs rebords sans casser la chaîne", () => {
    const t = parseTrack("chaine", "S@start S/~h S L2 U S L2/b V V S K GD S S/~t S S/o S/~r S S@finish");
    const edge = t.blocks.map((b) => (b.open ? "vide" : (b.shoulder ?? "rebords")));
    expect(edge).toEqual([
      "rebords", // départ
      "grass", "grass", "grass",
      "rebords", // montée
      "grass",
      "rebords", // virage relevé
      "rebords", "rebords", // cuve
      "grass",
      "rebords", "rebords", // rampe, vide
      "grass", // réception (permis par la notation ; le générateur ne le fait pas)
      "gravel", "gravel",
      "vide", // `o` : ce bloc seul
      "rebords", "rebords", "rebords",
    ]);
    expect(() => parseTrack("x", "S/~h@start S S@finish")).toThrow(/départ et l'arrivée/);
  });

  it("la porte d'un point de contrôle couvre la bande : on peut le passer en coupant", () => {
    const t = parseTrack("porte", "S@start S/~h S@cp S/~r S@finish");
    expect(t.gates[0]!.halfWidth).toBe(SHOULDER_EDGE);
    expect(t.gates[1]!.halfWidth).toBe(7);
    const race = createRace(t);
    race.car.x = 16 + 11; // sur le bas-côté gauche
    race.car.z = 40;
    race.car.vz = 30;
    for (let i = 0; i < 2 * TICK_RATE; i++) stepRace(race, GAS);
    expect(race.splits.length).toBe(1);
  });
});

describe("le revêtement dépend de la position en travers", () => {
  const s = createSurface();
  it("route, bas-côté jusqu'à 15 m de l'axe, puis rien ; largeur de la bande selon la route (8 / 5 / 2 m)", () => {
    for (const [w, band] of [["e", 8], ["n", 5], ["l", 2]] as const) {
      const world = trackWorld(parseTrack("b", `S/${w}@start S/~h S S/~r S@finish`));
      const hw = { e: 7, n: 10, l: 13 }[w];
      expect(SHOULDER_EDGE - hw).toBe(band);
      world.sample(16 + hw - 0.1, 48, s);
      expect(s.kind).toBe("road");
      world.sample(16 + hw + 0.1, 48, s);
      expect(s.kind).toBe("grass");
      world.sample(16 - SHOULDER_EDGE + 0.1, 48, s);
      expect(s.kind).toBe("grass");
      world.sample(16 + SHOULDER_EDGE + 0.1, 48, s);
      expect(s.height).toBe(NO_GROUND);
      // Sans bas-côté, le bord de la route est le bout du sol (comme avant).
      world.sample(16 + hw + 0.1, 8, s);
      expect(s.height).toBe(NO_GROUND);
    }
  });

  it("vibreurs : une bande de 1,5 m aux deux bords d'un virage sur route, avec exactement l'adhérence de la route ; aucun sur la terre", () => {
    expect(SURFACES.kerb).toEqual(SURFACES.road);
    const world = trackWorld(parseTrack("v", "S@start L2 S L2/t S@finish"));
    // L2 posé en (0, 1), cap +z, centre du virage en p = 16 + 48 = 64, q = 0 : à 45° le rayon r est sur la bissectrice.
    const at = (r: number) => {
      const k = r / Math.SQRT2;
      world.sample(64 - k, 32 + k, s);
      return s.kind;
    };
    expect(at(48)).toBe("road");
    expect(at(48 - 7 + KERB_WIDTH / 2)).toBe("kerb");
    expect(at(48 + 7 - KERB_WIDTH / 2)).toBe("kerb");
    expect(at(48 - 7 + KERB_WIDTH + 0.2)).toBe("road");
  });
});

describe("sortir sur un bas-côté ralentit, dans un ordre documenté, sans faire tomber", () => {
  /** Vitesse après 2 s à plein gaz, partie à 45 m/s, sur un revêtement donné. */
  const after = (kind: SurfaceKind, seconds = 2) => {
    const car = createCar();
    car.vz = 45;
    for (let i = 0; i < seconds * TICK_RATE; i++) stepCar(car, GAS, flatOf(kind));
    return carSpeed(car);
  };
  const top = (kind: SurfaceKind) => {
    const car = createCar();
    for (let i = 0; i < 30 * TICK_RATE; i++) stepCar(car, GAS, flatOf(kind));
    return carSpeed(car);
  };

  it("terre et gravier, puis herbe, puis neige poudreuse : chaque bas-côté ralentit nettement, la neige le plus", () => {
    const v = { road: after("road"), gravel: after("gravel"), grass: after("grass"), snow: after("snow") };
    expect(v.road).toBeGreaterThan(47);
    expect(v.gravel).toBeLessThan(42);
    expect(v.grass).toBeLessThan(v.gravel - 3);
    expect(v.snow).toBeLessThan(v.grass - 1.5);
    // Pointe sur chacun (à plat) : 38, 27, 20 m/s environ ; on en repart toujours (aucun bas-côté ne fait caler).
    expect(top("gravel")).toBeGreaterThan(35);
    expect(top("grass")).toBeGreaterThan(25);
    expect(top("snow")).toBeGreaterThan(18);
    expect(top("snow")).toBeLessThan(top("grass"));
    expect(top("grass")).toBeLessThan(top("gravel"));
  });

  it("braquages au hasard (graine fixe) sur des bas-côtés : la voiture ne tombe jamais et ne passe pas le rebord du bout de la bande", () => {
    for (const sh of ["~h", "~t", "~p"]) {
      const track = parseTrack("hasard", `S/e@start S/${sh} S S L2 S S T S S S S S S R S S S L3 S S S/~r S@finish`);
      const world = trackWorld(track);
      const s = createSurface();
      for (let seed = 1; seed <= 6; seed++) {
        const rng = new Rng(seed * 7919);
        const race = createRace(track);
        let steer = 0;
        for (let i = 0; i < 25 * TICK_RATE && race.finishMs < 0; i++) {
          if (i % (10 + rng.int(60)) === 0) steer = rng.int(5) / 2 - 1;
          stepRace(race, makeInput(steer, rng.int(4) > 0 ? 1 : 0, rng.int(10) === 0 ? 1 : 0));
          world.sample(race.car.x, race.car.z, s);
          expect(s.height, `${sh} graine ${seed} pas ${i}`).not.toBe(NO_GROUND);
          expect(race.car.y).toBeGreaterThan(track.voidY);
        }
        expect(race.respawns).toBe(0);
      }
    }
  });
});

describe("faces de bout : une bande qui s'arrête contre un bloc à rebords", () => {
  const run = (lat: number, v: number, seconds = 3) => {
    const t = parseTrack("face", "S/e@start S S/~h S S S/~r S S S@finish");
    const race = createRace(t);
    const c = race.car;
    c.x = 16 + lat;
    c.z = 2 * CELL + 4;
    c.vz = v;
    let lateral = 0;
    let px = c.x;
    for (let i = 0; i < seconds * TICK_RATE; i++) {
      stepRace(race, GAS);
      lateral = Math.max(lateral, Math.abs(c.x - px));
      px = c.x;
    }
    return { car: c as CarState, lateral };
  };
  it("sur la bande, la voiture bute contre la face (elle ne passe pas, n'est jamais téléportée de côté)", () => {
    for (const lat of [11, 9, 7.6]) {
      const { car, lateral } = run(lat, 45, 4);
      expect(car.z, `écart ${lat}`).toBeLessThan(5 * CELL);
      expect(lateral).toBeLessThan(0.05);
      expect(car.x).toBeCloseTo(16 + lat, 6);
    }
  });
  it("sur la route, elle entre dans le bloc suivant comme avant", () => {
    const { car } = run(3, 45, 3);
    expect(car.z).toBeGreaterThan(6 * CELL);
  });
});

describe("couper un virage par le bas-côté : plus rapide ou plus lent selon le virage", () => {
  it("une épingle serrée abordée vite (après un super turbo) se coupe avec profit ; un virage large coupé coûte du temps", () => {
    const fast = parseTrack("coupe", "S/e@start S T S S S S S S/~h L S/~r S S S@finish");
    const a0 = runPilot(fast, { grip: 1 });
    const a1 = runPilot(fast, { grip: 1, cut: 1 });
    expect(a0.valid && a1.valid).toBe(true);
    expect(a1.finishMs).toBeLessThan(a0.finishMs - 500);
    const wide = parseTrack("coupe", "S/e@start S S S/~h L2 S/~r S S S@finish");
    const b0 = runPilot(wide, { grip: 1 });
    const b1 = runPilot(wide, { grip: 1, cut: 2 });
    expect(b0.valid && b1.valid).toBe(true);
    expect(b1.finishMs).toBeGreaterThan(b0.finishMs + 300);
  });
});

describe("route bosselée", () => {
  it("la tôle ondulée est polynomiale, nulle et plate aux bouts du bloc, haute de 0,15 m", () => {
    const r = { h: 0, dq: 0 };
    rippleAt(0, r);
    expect(r).toEqual({ h: 0, dq: 0 });
    rippleAt(CELL, r);
    expect(r).toEqual({ h: 0, dq: 0 });
    let peak = 0;
    for (let q = 0; q <= CELL; q += 0.05) {
      rippleAt(q, r);
      peak = Math.max(peak, r.h);
    }
    expect(peak).toBeCloseTo(RIPPLE_HEIGHT, 2);
  });

  it("freinage plus long (+10 % au moins) et voiture moins vive en travers ; la pointe à peine touchée", () => {
    const measure = (mod: string) => {
      const t = parseTrack("b", `S/e@start S ${Array(8).fill("S" + mod).join(" ")} S S@finish`);
      const r1 = createRace(t);
      r1.car.z = 70;
      r1.car.vz = 45;
      while (carSpeed(r1.car) > 15) stepRace(r1, makeInput(0, 0, 1));
      const r2 = createRace(t);
      r2.car.z = 70;
      r2.car.vz = 40;
      for (let k = 0; k < 72; k++) stepRace(r2, makeInput(-0.6, 1, 0));
      const r3 = createRace(t);
      r3.car.z = 70;
      r3.car.vz = 47;
      for (let k = 0; k < 120; k++) stepRace(r3, GAS);
      return { brake: r1.car.z - 70, side: r2.car.x - 16, speed: carSpeed(r3.car) };
    };
    const flat = measure("");
    const bumpy = measure("/u");
    expect(bumpy.brake).toBeGreaterThan(flat.brake * 1.1);
    expect(bumpy.side).toBeLessThan(flat.side * 0.8);
    expect(bumpy.speed).toBeGreaterThan(flat.speed - 1);
  });

  it("le pilote finit un circuit bosselé", () => {
    const run = runPilot(parseTrack("b", "S/e@start S/u S/u L2 S/u S/u R S/u S/u S/u S@finish"), { grip: 1 });
    expect(run.valid).toBe(true);
  });
});

describe("au bit près sans bas-côté", () => {
  it("une même course, avant d'atteindre les bas-côtés, donne le même état qu'un circuit sans bas-côtés", () => {
    const a = createRace(parseTrack("x", "S@start S L2 S S S/~h S S S/~r S@finish"));
    const b = createRace(parseTrack("x", "S@start S L2 S S S S S S S@finish"));
    for (let i = 0; i < 4 * TICK_RATE; i++) {
      const input = makeInput(i % 90 < 40 ? -0.7 : 0.4, 1, i % 200 > 180 ? 1 : 0);
      stepRace(a, input);
      stepRace(b, input);
      if (a.car.z > 4 * CELL - 4) break;
      for (const k of Object.keys(a.car) as (keyof CarState)[]) expect(Object.is(a.car[k], b.car[k]), `${k} au pas ${i}`).toBe(true);
    }
  });
});

describe("moments de choix", () => {
  it("compte freinages, roue libre, cuves, virages coupables et sauts figés", () => {
    const t = parseTrack("choix", "S@start S/~h L2 S S/~r V V S S S L2 S S/g S/g R2/g S/g S S@finish");
    const run = runPilot(t, { grip: 1 });
    const c = choiceMoments(t, run);
    expect(c.cuves).toBe(1);
    expect(c.cuttable).toBe(1);
    expect(c.brakes).toBeGreaterThan(0);
    expect(c.coasts).toBeGreaterThan(0); // la glace : roue libre pour tourner
    expect(c.total).toBe(c.brakes + c.coasts + c.cuves + c.cuttable + c.freezes);
  });
});

describe("scénario bas-cotes", () => {
  it("un virage par bas-côté (herbe, terre et gravier, neige, vide), des vibreurs, une portion bosselée ; le pilote le finit", () => {
    const t = createBasCotesTrack();
    const curves = t.blocks.filter((b) => b.kind === "wideL" || b.kind === "wideR" || b.kind === "curveL");
    expect(new Set(curves.map((b) => b.shoulder ?? (b.open ? "void" : "wall")))).toEqual(new Set(["grass", "gravel", "snow", "void"]));
    expect(t.blocks.some((b) => b.bumpy)).toBe(true);
    const run = runPilot(t, { grip: 1 });
    expect(run.valid).toBe(true);
  });
});
