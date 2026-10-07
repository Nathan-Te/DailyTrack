import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAR_PARAMS as P,
  FLAT_WORLD,
  NO_INPUT,
  SURFACES,
  THEMES,
  THEME_NAMES,
  TICK_RATE,
  carSpeed,
  createAutopilot,
  createCar,
  createRace,
  createSurface,
  createSurfacesTrack,
  forwardSpeed,
  makeInput,
  parseToken,
  parseTrack,
  runPilot,
  stepCar,
  stepRace,
  trackWorld,
  type SurfaceKind,
  type World,
} from "../src/index";

// Tests chiffrés du lot 8 : revêtements, blocs à effet, virages relevés. Les seuils sont recopiés dans le README du lot.

/** Un sol plat infini d'un seul revêtement : pour comparer les revêtements à conditions égales. */
const flatOf = (kind: SurfaceKind): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = kind;
  },
});
const KINDS: SurfaceKind[] = ["road", "dirt", "ice", "grass"];

describe("notation des blocs", () => {
  it("lit les revêtements, le relevé, les effets et les repères", () => {
    expect(parseToken("S")).toEqual({ kind: "straight", surface: "road", banked: false });
    expect(parseToken("S/g")).toEqual({ kind: "straight", surface: "ice", banked: false });
    expect(parseToken("S/t@cp")).toEqual({ kind: "straight", surface: "dirt", banked: false, mark: "checkpoint" });
    expect(parseToken("L2/b")).toEqual({ kind: "wideL", surface: "road", banked: true });
    expect(parseToken("R/hb")).toEqual({ kind: "curveR", surface: "grass", banked: true });
    expect(parseToken("T").kind).toBe("turbo");
    expect(parseToken("C").kind).toBe("cut");
  });

  it("refuse ce qui n'a pas de sens", () => {
    expect(() => parseToken("S/b")).toThrow(/virage/); // un relevé n'existe qu'en virage
    expect(() => parseToken("S/tg")).toThrow(/Deux revêtements/);
    expect(() => parseToken("S/x")).toThrow(/Modificateur/);
    expect(() => parseToken("Z")).toThrow(/inconnu/);
  });

  it("le circuit des surfaces enchaîne tout : chaque revêtement, un turbo, un moteur coupé, relevés serré et large", () => {
    const t = createSurfacesTrack();
    const surfaces = new Set(t.blocks.map((b) => b.surface));
    expect([...surfaces].sort()).toEqual(["dirt", "grass", "ice", "road"]);
    const kinds = new Set(t.blocks.map((b) => b.kind));
    expect(kinds.has("turbo") && kinds.has("cut") && kinds.has("boost")).toBe(true);
    const banked = t.blocks.filter((b) => b.banked);
    expect(banked.some((b) => b.kind === "wideL" || b.kind === "wideR")).toBe(true); // grand rayon
    expect(banked.some((b) => b.kind === "curveL" || b.kind === "curveR")).toBe(true); // petit rayon
    // Et le pilote le finit.
    const run = runPilot(t, { grip: 1 });
    expect(run.valid).toBe(true);
  });
});

describe("revêtements : grip, freinage, vitesse en virage", () => {
  it("la table est ordonnée : route > terre > herbe > glace en adhérence, et seule l'herbe freine vraiment", () => {
    expect(SURFACES.road).toEqual({ grip: 1, traction: 1, rolling: 0, slick: 0 });
    expect(SURFACES.dirt.grip).toBeLessThan(SURFACES.road.grip);
    expect(SURFACES.grass.grip).toBeLessThan(SURFACES.dirt.grip);
    expect(SURFACES.ice.grip).toBeLessThan(SURFACES.grass.grip);
    expect(SURFACES.grass.rolling).toBeGreaterThan(SURFACES.dirt.rolling);
  });

  /** Distance d'arrêt (m) d'un freinage à fond depuis 30 m/s, tout droit. */
  const stopDistance = (kind: SurfaceKind) => {
    const car = createCar();
    car.vz = 30;
    let t = 0;
    while (forwardSpeed(car) > 0.1 && t < 20 * TICK_RATE) {
      stepCar(car, makeInput(0, 0, 1), flatOf(kind));
      t++;
    }
    return car.z;
  };

  it("distance de freinage : glace > herbe > terre > route (de 30 m/s)", () => {
    const d = Object.fromEntries(KINDS.map((k) => [k, stopDistance(k)])) as Record<SurfaceKind, number>;
    expect(d.ice).toBeGreaterThan(d.grass);
    expect(d.grass).toBeGreaterThan(d.dirt);
    expect(d.dirt).toBeGreaterThan(d.road);
    expect(d.ice).toBeGreaterThan(d.road * 2); // la glace : plus du double
    expect(d.dirt).toBeGreaterThan(d.road * 1.05);
  });

  /** Accélération latérale tenue (m/s²) à braquage plein, accélérateur appuyé, vers 20 m/s : la limite du virage (en roue libre la glace en tient plus : lot 16). */
  const lateralLimit = (kind: SurfaceKind) => {
    const car = createCar();
    car.vz = 20;
    for (let i = 0; i < 3 * TICK_RATE; i++) stepCar(car, makeInput(1, 1, 0), flatOf(kind));
    return carSpeed(car) * Math.abs(car.yawRate);
  };

  it("vitesse de passage d'un même virage (rayon 16 m) : route > terre > glace", () => {
    const radius = 16;
    const v = (kind: SurfaceKind) => Math.sqrt(lateralLimit(kind) * radius);
    expect(v("road")).toBeGreaterThan(v("dirt"));
    expect(v("dirt")).toBeGreaterThan(v("ice"));
    expect(v("road")).toBeGreaterThan(22);
    expect(v("ice") / v("road")).toBeLessThan(0.65);
    expect(v("dirt") / v("road")).toBeGreaterThan(0.7);
  });

  it("l'herbe ralentit nettement : roue libre, elle perd au moins deux fois et demie plus que la route", () => {
    const loss = (kind: SurfaceKind) => {
      const car = createCar();
      car.vz = 30;
      for (let i = 0; i < TICK_RATE; i++) stepCar(car, NO_INPUT, flatOf(kind));
      return 30 - carSpeed(car);
    };
    expect(loss("grass")).toBeGreaterThan(loss("road") * 2.5);
  });

  it("la glace mord moins à l'accélération : 0 → 20 m/s plus long que sur route", () => {
    const time = (kind: SurfaceKind) => {
      const car = createCar();
      let t = 0;
      while (carSpeed(car) < 20 && t < 30 * TICK_RATE) {
        stepCar(car, makeInput(0, 1, 0), flatOf(kind));
        t++;
      }
      return t / TICK_RATE;
    };
    expect(time("ice")).toBeGreaterThan(time("dirt"));
    expect(time("dirt")).toBeGreaterThan(time("road"));
  });
});

describe("super turbo et moteur coupé", () => {
  const peak = (spec: string, from: number) => {
    const race = createRace(parseTrack("x", spec));
    race.car.vz = 30;
    let top = 0;
    let boosted = 0;
    for (let i = 0; i < 8 * TICK_RATE; i++) {
      stepRace(race, makeInput(0, 1, 0));
      top = Math.max(top, carSpeed(race.car));
      if (race.car.z > from && (race.car.turbo > 0 || race.car.boost > 0)) boosted++;
    }
    return { top, boosted };
  };

  it("le super turbo pousse plus fort et plus longtemps que la plaque : plus haut, plus de pas boostés", () => {
    const pad = peak("S@start S P S S S S S S S S S S S@finish", 0);
    const turbo = peak("S@start S T S S S S S S S S S S S@finish", 0);
    expect(turbo.top).toBeGreaterThan(pad.top + 5);
    expect(turbo.top).toBeLessThanOrEqual(P.turboMaxSpeed + 0.5);
    expect(turbo.boosted).toBeGreaterThan(pad.boosted * 1.4);
    expect(P.turboTicks).toBeGreaterThan(P.boostTicks);
    expect(P.turboAccel).toBeGreaterThan(P.boostAccel);
  });

  it("le moteur coupé : l'accélérateur n'agit plus, et s'arrête exactement au point de contrôle suivant", () => {
    const track = parseTrack("x", "S@start S S C S S@cp S S S S S S S S S S@finish");
    const race = createRace(track);
    race.car.vz = 25;
    let cutAt = -1;
    let releasedAt = -1;
    const speeds: number[] = [];
    for (let i = 0; i < 12 * TICK_RATE && releasedAt < 0; i++) {
      const splits = race.splits.length;
      stepRace(race, makeInput(0, 1, 0)); // plein gaz tout le temps
      if (cutAt < 0 && race.car.cut) cutAt = i;
      if (cutAt >= 0) speeds.push(carSpeed(race.car));
      if (cutAt >= 0 && race.splits.length > splits) {
        releasedAt = i;
        expect(race.car.cut).toBe(0); // le pas même qui franchit le point de contrôle rend le moteur
      } else if (cutAt >= 0) {
        expect(race.car.cut, `pas ${i}`).toBe(1); // coupé jusque-là, sans exception
      }
    }
    expect(cutAt).toBeGreaterThan(0);
    expect(releasedAt).toBeGreaterThan(cutAt + TICK_RATE / 2); // quelques dizaines de mètres sans moteur
    // Sans moteur, on ne gagne pas de vitesse : elle décroît à chaque pas.
    for (let i = 1; i < speeds.length - 1; i++) expect(speeds[i]!).toBeLessThanOrEqual(speeds[i - 1]! + 1e-9);
    // Une fois rendu, le plein gaz reprend.
    const before = carSpeed(race.car);
    for (let i = 0; i < TICK_RATE; i++) stepRace(race, makeInput(0, 1, 0));
    expect(carSpeed(race.car)).toBeGreaterThan(before + 3);
  });

  it("le moteur coupé laisse le frein agir, et une reprise rend le moteur", () => {
    const race = createRace(parseTrack("x", "S@start S S C S S@cp S S S S S@finish"));
    race.car.vz = 25;
    while (!race.car.cut) stepRace(race, makeInput(0, 1, 0));
    const before = carSpeed(race.car);
    for (let i = 0; i < 10; i++) stepRace(race, makeInput(0, 0, 1)); // le frein agit toujours
    expect(carSpeed(race.car)).toBeLessThan(before - 2);
    stepRace(race, makeInput(0, 1, 0, true)); // reprise (ici au départ : aucun point de contrôle franchi)
    expect(race.car.cut).toBe(0);
  });

  it("à l'arrivée, une plaque ne relance plus la voiture à l'arrêt", () => {
    const race = createRace(parseTrack("x", "S@start S S S P S@finish"));
    race.car.vz = 30;
    while (race.finishMs < 0) stepRace(race, makeInput(0, 1, 0));
    for (let i = 0; i < 12 * TICK_RATE; i++) stepRace(race, NO_INPUT);
    expect(carSpeed(race.car)).toBeLessThan(0.05);
  });
});

describe("virages relevés", () => {
  it("la route monte vers l'extérieur du virage, repart à plat aux bords du bloc, et reste collée au rebord", () => {
    const flat = trackWorld(parseTrack("x", "S@start R S@finish"));
    const banked = trackWorld(parseTrack("x", "S@start R/b S@finish"));
    const a = createSurface();
    const b = createSurface();
    // Bloc 1 (virage à droite, rayon 16 m) : centre du virage en (0, 32). Points de la bissectrice à r = 9,5 / 16 / 22,5.
    const point = (r: number) => ({ x: r * Math.cos(Math.PI / 4), z: 32 + r * Math.sin(Math.PI / 4) });
    const heights = [9.5, 16, 22.5].map((r) => {
      const p = point(r);
      banked.sample(p.x, p.z, b);
      flat.sample(p.x, p.z, a);
      expect(a.height).toBe(0);
      expect(b.height).toBeGreaterThan(-5);
      return b.height;
    });
    expect(heights[1]).toBeCloseTo(0, 6); // l'axe n'est pas relevé
    expect(heights[0]).toBeLessThan(-1.5); // l'intérieur descend
    expect(heights[2]).toBeGreaterThan(1.5); // l'extérieur monte (≈ 0,3 × 6,5 m)
    // À l'entrée du virage, la hauteur est celle de la route plate : pas de marche.
    banked.sample(22, 32.05, b); // bord extérieur, tout au début du virage
    expect(Math.abs(b.height)).toBeLessThan(0.05);
  });

  it("on y passe plus vite : vitesse minimale dans un virage serré +12 %, dans un virage large +3 % (pilote, mêmes réglages)", () => {
    const minSpeed = (turn: string) => {
      const track = parseTrack("x", `S@start S S S S ${turn} S S S@finish`);
      const race = createRace(track);
      const drive = createAutopilot(track, { grip: 1 });
      let min = Infinity;
      while (race.finishMs < 0 && race.car.tick < 3000) {
        stepRace(race, drive(race));
        const b = track.blocks[5]!;
        const inside = race.car.x >= b.cx * 32 - 32 && race.car.x <= b.cx * 32 + 64 && race.car.z >= b.cz * 32 && race.car.z <= b.cz * 32 + 64;
        if (inside && race.car.z > b.cz * 32 + 1) min = Math.min(min, carSpeed(race.car));
      }
      expect(race.respawns, turn).toBe(0);
      return min;
    };
    expect(minSpeed("R/b") / minSpeed("R")).toBeGreaterThan(1.12);
    expect(minSpeed("R2/b") / minSpeed("R2")).toBeGreaterThan(1.03);
  });

  it("l'accélération latérale tenue est plus grande en virage relevé : la pesanteur pousse vers l'intérieur", () => {
    const lateral = (spec: string) => {
      const race = createRace(parseTrack("x", spec));
      const drive = createAutopilot(race.track, { grip: 1.08 });
      let maxLat = 0;
      let touched = 0;
      for (let i = 0; i < 20 * TICK_RATE && race.finishMs < 0; i++) {
        stepRace(race, drive(race));
        maxLat = Math.max(maxLat, carSpeed(race.car) * Math.abs(race.car.yawRate));
        if (race.respawns > 0) touched++;
      }
      return { maxLat, finished: race.finishMs >= 0 && touched === 0 };
    };
    const flat = lateral("S@start S S S S R2 S S S@finish");
    const banked = lateral("S@start S S S S R2/b S S S@finish");
    expect(flat.finished && banked.finished).toBe(true);
    expect(banked.maxLat).toBeGreaterThan(flat.maxLat);
  });

  it("le rebord extérieur d'un virage relevé arrête la voiture (on ne le survole pas)", () => {
    const race = createRace(parseTrack("x", "S@start S S S R/b S S S@finish"));
    race.car.vz = 40;
    let respawns = 0;
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      stepRace(race, makeInput(0, 1, 0)); // tout droit dans le virage : on tape le rebord extérieur
      respawns = race.respawns;
    }
    expect(respawns).toBe(0); // pas tombé dans le vide
    expect(race.car.y).toBeLessThan(5);
  });
});

describe("thèmes", () => {
  it("cinq thèmes, chacun avec sa palette, et un nom affichable", () => {
    expect([...THEME_NAMES].sort()).toEqual(["banquise", "campagne", "nuit", "rallye", "stade"]);
    for (const name of THEME_NAMES) expect(THEMES[name].label.length).toBeGreaterThan(2);
    expect(new Set(THEME_NAMES.map((n) => THEMES[n].palette)).size).toBe(5);
  });
});
