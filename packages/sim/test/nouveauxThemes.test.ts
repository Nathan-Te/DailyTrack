import { describe, expect, it } from "vitest";
import {
  FIGURES,
  FLAT_WORLD,
  NO_GROUND,
  SIGNATURE_FIGURE,
  SURFACES,
  THEMES,
  THEME_NAMES,
  TICK_RATE,
  Rng,
  bestPilotRun,
  composeFigures,
  carSpeed,
  choiceMoments,
  createCar,
  createRace,
  createSurface,
  dailyCircuit,
  daysFromCivil,
  figureByName,
  isCurve,
  isWide,
  makeInput,
  maxTightOf,
  parseToken,
  parseTrack,
  stepCar,
  stepRace,
  themeForDay,
  trackJumps,
  trackWorld,
  type DailyCircuit,
  type SurfaceKind,
  type ThemeName,
  type World,
} from "../src/index";

// Tests chiffrés du lot 22 : le sable, la rotation sur huit thèmes, Canyon, Col alpin et Ville. Seuils recopiés dans docs/lots/lot-22-nouveaux-themes.md.

const JOUR = daysFromCivil(2026, 10, 6);
const GAS = makeInput(0, 1, 0);
const flatOf = (kind: SurfaceKind): World => ({
  ...FLAT_WORLD,
  sample(x, z, out) {
    FLAT_WORLD.sample(x, z, out);
    out.kind = kind;
  },
});

/** Circuits d'un thème imposé (une date par circuit) : générés une fois, partagés par les tests. */
const cache = new Map<string, DailyCircuit>();
const circuitOf = (name: ThemeName, k: number): DailyCircuit => {
  const key = `${name}${k}`;
  let c = cache.get(key);
  if (!c) cache.set(key, (c = dailyCircuit(JOUR + 300 + k, 0, name)));
  return c;
};
const sample = (name: ThemeName, n = 8) => Array.from({ length: n }, (_, k) => circuitOf(name, k));
const isTight = (kind: Parameters<typeof isCurve>[0]) => isCurve(kind) && !isWide(kind);

describe("sable (revêtement de bloc et bas-côté)", () => {
  it("notation : `S/s` (bloc), `~s` (bord)", () => {
    expect(parseToken("S/s").surface).toBe("sand");
    expect(parseToken("L2/sb").surface).toBe("sand");
    expect(parseToken("S/~s").edge).toBe("sand");
    expect(() => parseToken("S/st")).toThrow(/Deux revêtements/);
    const t = parseTrack("sable", "S@start S/~s S L2 S/~r S/s S@finish");
    expect(t.blocks.map((b) => b.shoulder)).toEqual([null, "sand", "sand", "sand", null, null, null]);
    expect(t.blocks[5]!.surface).toBe("sand");
  });

  it("lent mais stable : plus lent que la route et le gravier, plus rapide que l'herbe et la neige, avec plus d'adhérence que l'herbe", () => {
    const top = (kind: SurfaceKind) => {
      const car = createCar();
      for (let i = 0; i < 30 * TICK_RATE; i++) stepCar(car, GAS, flatOf(kind));
      return carSpeed(car);
    };
    const v = { road: top("road"), gravel: top("gravel"), sand: top("sand"), grass: top("grass"), snow: top("snow") };
    expect(v.sand).toBeLessThan(v.gravel);
    expect(v.sand).toBeGreaterThan(v.grass);
    expect(v.sand).toBeGreaterThan(v.snow);
    expect(v.sand).toBeGreaterThan(28); // on en repart toujours
    expect(v.sand).toBeLessThan(40);
    expect(SURFACES.sand.grip).toBeGreaterThan(SURFACES.grass.grip);
    expect(SURFACES.sand.grip).toBeGreaterThan(SURFACES.gravel.grip);
    expect(SURFACES.sand.rolling).toBeGreaterThan(SURFACES.gravel.rolling);
    console.info(`[sable] pointes à plat : ${JSON.stringify(v)}`);
    expect(SURFACES.sand.rolling).toBeLessThan(SURFACES.grass.rolling);
  });

  it("braquages au hasard (graine fixe) sur du sable en bas-côté et en revêtement : la voiture ne tombe jamais", () => {
    for (const spec of [
      "S/e@start S/~s S S L2 S S T S S S S S S R S S S L3 S S S/~r S@finish",
      "S/e@start S/s S/s L2/s S/s S T S S S S S S R S/s S S L3/s S S S S@finish",
    ]) {
      const track = parseTrack("sable-hasard", spec);
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
          expect(s.height, `graine ${seed} pas ${i}`).not.toBe(NO_GROUND);
          expect(race.car.y).toBeGreaterThan(track.voidY);
        }
        expect(race.respawns).toBe(0);
      }
    }
  });
});

describe("rotation sur huit thèmes", () => {
  it("chaque thème apparaît, tiré de la date, sur 80 jours consécutifs", () => {
    expect(THEME_NAMES.length).toBe(8);
    const seen = new Map<string, number>();
    for (let d = 0; d < 80; d++) seen.set(themeForDay(JOUR + d).name, (seen.get(themeForDay(JOUR + d).name) ?? 0) + 1);
    for (const name of THEME_NAMES) expect(seen.get(name) ?? 0, name).toBeGreaterThan(3);
  });

  it("chaque thème a sa palette et sa signature, et la signature est une figure qui n'appartient qu'à lui si elle est nouvelle", () => {
    expect(new Set(THEME_NAMES.map((n) => THEMES[n].palette)).size).toBe(8);
    for (const name of THEME_NAMES) {
      const f = figureByName(SIGNATURE_FIGURE[THEMES[name].signature]);
      expect(f, name).not.toBeNull();
      if (f!.only) expect(f!.only, name).toContain(name);
    }
    for (const f of FIGURES) if (f.only) for (const n of f.only) expect(THEME_NAMES, f.name).toContain(n);
  });

  it("les figures propres à un thème ne sortent chez aucun autre", { timeout: 120_000 }, () => {
    const own = FIGURES.filter((f) => f.only);
    expect(own.length).toBeGreaterThanOrEqual(4);
    for (const name of THEME_NAMES) {
      for (const c of sample(name, 5)) {
        for (const p of c.figures) {
          const f = figureByName(p.name)!;
          if (f.only) expect(f.only, `${name} : ${p.name}`).toContain(name);
        }
      }
    }
  });
});

describe("Canyon", () => {
  const circuits = sample("canyon");

  it("sable en bas-côté, au moins un long saut au-dessus d'un ravin, une paroi, et la signature (paroi puis long saut) dans chaque circuit", () => {
    for (const c of circuits) {
      expect(c.fallback, c.spec).toBe(false);
      expect(c.track.blocks.some((b) => b.shoulder === "sand"), c.spec).toBe(true);
      expect(c.figures.map((f) => f.name), c.spec).toContain("paroi-long-saut");
      const longJump = trackJumps(c.track).some((j) => j.gapCells >= 2);
      expect(longJump, c.spec).toBe(true);
      expect(c.track.blocks.some((b) => b.cuve), c.spec).toBe(true);
      expect(c.theme).toBe("canyon");
    }
  });

  it("la paroi précède le long saut dans la figure signature, sans virage entre les deux", () => {
    for (const c of circuits) {
      const sig = c.figures.find((f) => f.name === "paroi-long-saut")!;
      const blocks = c.track.blocks.slice(sig.from, sig.to);
      const wall = blocks.findIndex((b) => b.cuve);
      const kick = blocks.findIndex((b) => b.kind === "kick");
      expect(wall, c.spec).toBeGreaterThanOrEqual(0);
      expect(kick, c.spec).toBeGreaterThan(wall);
      expect(blocks.slice(wall, kick).some((b) => isCurve(b.kind)), c.spec).toBe(false);
    }
  });

  it("le pilote franchit chaque saut dans sa fenêtre, sans chute ni reprise", () => {
    for (const c of circuits) {
      const run = bestPilotRun(c.track)!;
      expect(run.respawns, c.spec).toBe(0);
      expect(run.jumpsOk, c.spec).toBe(true);
    }
  });
});

describe("Col alpin", () => {
  const circuits = sample("col");

  it("une descente en lacets (signature), neige en bas-côté, grosses descentes, au moins une section au-dessus du vide", () => {
    let open = 0;
    let steep = 0;
    for (const c of circuits) {
      expect(c.fallback, c.spec).toBe(false);
      expect(c.figures.map((f) => f.name), c.spec).toContain("lacets");
      expect(c.track.blocks.some((b) => b.shoulder === "snow"), c.spec).toBe(true);
      if (c.track.blocks.some((b) => b.open)) open++;
      if (c.track.blocks.some((b) => b.kind === "down" && b.rise <= -8)) steep++;
      expect(c.track.blocks.some((b) => b.cuve), c.spec).toBe(false);
    }
    expect(open).toBeGreaterThanOrEqual(circuits.length / 2);
    expect(steep).toBeGreaterThanOrEqual(circuits.length / 3);
  });

  it("les lacets sont des virages larges (jamais serrés) qui descendent ou montent d'au moins quatre mètres entre le premier et le dernier", () => {
    for (const c of circuits) {
      const sig = c.figures.find((f) => f.name === "lacets")!;
      const blocks = c.track.blocks.slice(sig.from, sig.to);
      expect(blocks.filter((b) => isCurve(b.kind)).length, c.spec).toBeGreaterThanOrEqual(2);
      expect(blocks.some((b) => isTight(b.kind)), c.spec).toBe(false);
      const net = blocks.reduce((s, b) => s + b.rise, 0);
      expect(Math.abs(net), c.spec).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("Ville : des angles droits", () => {
  const circuits = sample("ville", 10);

  it("jusqu'à quatre virages serrés (exception documentée), jamais deux de suite, jamais sur la route large, route étroite ou normale seulement", () => {
    expect(maxTightOf(THEMES.ville)).toBe(4);
    for (const name of THEME_NAMES) if (name !== "ville") expect(maxTightOf(THEMES[name]), name).toBe(2);
    let most = 0;
    for (const c of circuits) {
      const tight = c.track.blocks.filter((b) => isTight(b.kind));
      most = Math.max(most, tight.length);
      expect(tight.length, c.spec).toBeLessThanOrEqual(4);
      for (const b of tight) {
        const next = c.track.blocks[b.index + 1];
        if (next) expect(isTight(next.kind), `${c.spec} @${b.index}`).toBe(false);
      }
      for (const b of c.track.blocks) expect(Math.max(b.w0, b.w1), c.spec).toBeLessThanOrEqual(20);
    }
    expect(most).toBeGreaterThanOrEqual(3); // la règle propre se voit
  });

  it("sur 80 dates (composition seule, sans pilote) : jamais plus de quatre virages serrés, jamais deux de suite, jamais sur la route large", () => {
    let most = 0;
    let composed = 0;
    for (let d = 0; d < 80; d++) {
      let c = null;
      for (let attempt = 0; attempt < 6 && !c; attempt++) c = composeFigures(JOUR + d, attempt, THEMES.ville);
      if (!c) continue;
      composed++;
      const track = parseTrack("ville", c.spec);
      const tight = track.blocks.filter((b) => isTight(b.kind));
      most = Math.max(most, tight.length);
      expect(tight.length, c.spec).toBeLessThanOrEqual(4);
      for (const b of tight) {
        expect(b.w0, c.spec).toBeLessThan(26);
        const next = track.blocks[b.index + 1];
        if (next) expect(isTight(next.kind), c.spec).toBe(false);
      }
    }
    expect(composed).toBeGreaterThan(70);
    expect(most).toBeLessThanOrEqual(4);
  });

  it("des murs sans bas-côté, et la chicane d'angles droits dans chaque circuit", () => {
    for (const c of circuits) {
      expect(c.track.blocks.some((b) => b.shoulder), c.spec).toBe(false);
      expect(c.figures.map((f) => f.name), c.spec).toContain("chicane-angles");
      expect(c.track.blocks.some((b) => b.cuve), c.spec).toBe(false);
    }
  });
});

describe("validation par le pilote (thèmes imposés)", () => {
  for (const name of ["canyon", "col", "ville"] as const) {
    it(`${name} : circuit validé, durée d'auteur entre 30 et 40 s, portion rapide, pilote sans chute`, () => {
      for (const c of sample(name)) {
        expect(c.fallback, c.spec).toBe(false);
        expect(c.authorMs, c.spec).toBeGreaterThanOrEqual(30_000);
        expect(c.authorMs, c.spec).toBeLessThanOrEqual(40_000);
        const run = bestPilotRun(c.track)!;
        expect(run.respawns, c.spec).toBe(0);
        expect(run.maxSpeed, c.spec).toBeGreaterThanOrEqual(62.4);
      }
    });

    it(`${name} : au moins 10 moments de choix par circuit en moyenne`, () => {
      const totals = sample(name).map((c) => choiceMoments(c.track, bestPilotRun(c.track)!).total);
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      expect(mean, name).toBeGreaterThanOrEqual(10);
    });
  }
});
