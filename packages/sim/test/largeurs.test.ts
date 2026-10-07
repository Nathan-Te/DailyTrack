import { describe, expect, it } from "vitest";
import {
  CELL,
  LARGEURS_TRACK_SPEC,
  NO_GROUND,
  ROAD_WIDTHS,
  bestPilotRun,
  blockCells,
  blockHalfWidth,
  blockHalfWidthSlope,
  blockPadHalfWidth,
  blockWidth,
  createLargeursTrack,
  createRace,
  createSurface,
  createWallHit,
  decodeReplay,
  encodeReplay,
  isCurve,
  makeInput,
  parseToken,
  parseTrack,
  racingLine,
  replayRace,
  stepRace,
  trackCenterline,
  trackWorld,
} from "../src/index";
import { runAutopilot } from "./helpers/autopilot";

// Lot 12 : trois largeurs de route (14, 20, 26 m), blocs de transition, virage ample (3 × 3 cellules).

describe("notation des largeurs", () => {
  it("lit une largeur constante, une transition, et la combine à un revêtement ou un relevé", () => {
    expect(parseToken("S/n").width).toEqual({ w0: 20, w1: 20 });
    expect(parseToken("S/e>l").width).toEqual({ w0: 14, w1: 26 });
    expect(parseToken("S/n>et")).toMatchObject({ surface: "dirt", width: { w0: 20, w1: 14 } });
    expect(parseToken("L3/lb")).toMatchObject({ kind: "grandL", banked: true, width: { w0: 26, w1: 26 } });
    expect(parseToken("S/g").width).toBeUndefined();
  });

  it("refuse deux largeurs, une transition dans un virage, un modificateur inconnu", () => {
    expect(() => parseToken("S/nl")).toThrow(/Deux largeurs/);
    expect(() => parseToken("L2/e>l")).toThrow(/virage garde sa largeur/);
    expect(() => parseToken("S/x")).toThrow(/Modificateur inconnu/);
  });

  it("chaîne les largeurs : un bloc sans largeur garde celle du précédent, 14 m au départ", () => {
    const t = parseTrack("x", "S@start S S/e>l S S/l S@finish");
    expect(t.blocks.map((b) => [b.w0, b.w1])).toEqual([[14, 14], [14, 14], [14, 26], [26, 26], [26, 26], [26, 26]]);
  });

  it("refuse une marche de largeur : une largeur écrite doit prolonger la route précédente", () => {
    expect(() => parseTrack("x", "S@start S/l S@finish")).toThrow(/Marche de largeur au bloc 1/);
    expect(() => parseTrack("x", "S/n@start S/e>l S@finish")).toThrow(/Marche de largeur/);
    // Le premier bloc, lui, choisit sa largeur.
    expect(parseTrack("x", "S/l@start S@finish").blocks[0]!.w0).toBe(ROAD_WIDTHS.l);
  });
});

describe("transition de largeur", () => {
  const t = parseTrack("x", "S/e@start S/e>l S@finish");
  const b = t.blocks[1]!;

  it("passe de 14 à 26 m en douceur : rebords tangents aux deux bouts, élargissement monotone", () => {
    expect(blockWidth(b, 0)).toBe(14);
    expect(blockWidth(b, CELL)).toBe(26);
    expect(blockWidth(b, CELL / 2)).toBe(20);
    expect(blockHalfWidthSlope(b, 0)).toBe(0);
    expect(blockHalfWidthSlope(b, CELL)).toBe(0);
    let prev = 14;
    for (let q = 1; q <= CELL; q++) {
      const w = blockWidth(b, q);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
    // La pente la plus forte (au milieu) reste modeste : 6 m de chaque côté sur 32 m, lissés.
    expect(blockHalfWidthSlope(b, CELL / 2)).toBeCloseTo((1.5 * 6) / CELL, 9);
    expect(blockHalfWidthSlope(b, CELL / 2)).toBeLessThan(0.3);
  });

  it("la pente annoncée est bien la dérivée de la demi-largeur", () => {
    for (const q of [3, 9, 16, 22, 29]) {
      const h = 1e-4;
      const numeric = (blockHalfWidth(b, q + h) - blockHalfWidth(b, q - h)) / (2 * h);
      expect(blockHalfWidthSlope(b, q)).toBeCloseTo(numeric, 5);
    }
  });

  it("le sol s'arrête à la demi-largeur, de chaque côté, en tout point du bloc", () => {
    const world = trackWorld(t);
    const s = createSurface();
    for (const q of [1, 8, 16, 24, 31]) {
      const hw = blockHalfWidth(b, q);
      const z = b.cz * CELL + q;
      for (const side of [-1, 1]) {
        world.sample(CELL / 2 + side * (hw - 0.05), z, s);
        expect(s.height).not.toBe(NO_GROUND);
        world.sample(CELL / 2 + side * (hw + 0.05), z, s);
        expect(s.height).toBe(NO_GROUND);
      }
    }
  });

  it("repousse la voiture selon la normale du rebord incliné, du côté gauche comme du côté droit", () => {
    const world = trackWorld(t);
    const hit = createWallHit();
    const q = CELL / 2 + 2; // en plein élargissement
    const slope = blockHalfWidthSlope(b, q);
    const k = Math.sqrt(1 + slope * slope);
    for (const side of [-1, 1]) {
      const hw = blockHalfWidth(b, q);
      // Un disque de rayon 1 dont le centre est à 0,6 m (mesuré en travers) du rebord : il mord de 0,4 m.
      expect(world.collide(CELL / 2 + side * (hw - 0.6 * k), b.cz * CELL + q, 0, 1, hit)).toBe(true);
      expect(hit.depth).toBeCloseTo(0.4, 6);
      // Normale unitaire, tournée vers l'axe de la route et inclinée vers l'avant (le rebord s'écarte en avançant).
      expect(Math.hypot(hit.nx, hit.nz)).toBeCloseTo(1, 9);
      expect(hit.nx * side).toBeLessThan(0);
      expect(hit.nz).toBeGreaterThan(0);
      expect(hit.nz / -(hit.nx * side)).toBeCloseTo(slope, 6);
    }
    // Plus loin du rebord : aucun contact.
    expect(world.collide(CELL / 2, b.cz * CELL + q, 0, 1, hit)).toBe(false);
  });

  it("sur une route à largeur constante, le contact est identique à celui d'avant les transitions", () => {
    const flat = parseTrack("x", "S/n@start S S@finish");
    const world = trackWorld(flat);
    const hit = createWallHit();
    expect(world.collide(CELL / 2 + 10 - 0.5, 40, 0, 1, hit)).toBe(true);
    expect(hit.nx).toBeCloseTo(-1, 12);
    expect(hit.nz).toBe(0);
    expect(hit.depth).toBeCloseTo(0.5, 12);
  });
});

describe("largeurs et blocs voisins", () => {
  it("les plaques font la moitié de la largeur de la route : 3,5 m de demi-largeur sur 14 m (comme avant), 5 sur 20, 6,5 sur 26", () => {
    for (const [letter, half] of [["e", 3.5], ["n", 5], ["l", 6.5]] as const) {
      const t = parseTrack("x", `S/${letter}@start P S S@finish`);
      expect(blockPadHalfWidth(t.blocks[1]!)).toBe(half);
      const world = trackWorld(t);
      const s = createSurface();
      world.sample(CELL / 2 + half - 0.1, CELL + CELL / 2, s);
      expect(s.boost).toBe(true);
      world.sample(CELL / 2 + half + 0.1, CELL + CELL / 2, s);
      expect(s.boost).toBe(false);
    }
  });

  it("les points de contrôle et l'arrivée gardent la largeur de la route : porte plus large, passage hors axe accepté", () => {
    const t = parseTrack("x", "S/l@start S S@cp S S@finish");
    expect(t.gates.map((g) => g.halfWidth)).toEqual([13, 13]);
    // Une voiture qui franchit la porte à 14 m de l'axe (route de 26 m : à 1 m du rebord) compte ; à 16 m (hors de la route + 2 m), non.
    const race = createRace(t);
    const gate = t.gates[0]!;
    for (const [lateral, passes] of [[14, true], [16.5, false]] as const) {
      const r = createRace(t);
      r.car.x = gate.x + lateral;
      r.car.z = gate.z - 0.4;
      r.car.vx = 0;
      r.car.vz = 30;
      r.car.y = gate.y;
      stepRace(r, makeInput(0, 0, 0));
      stepRace(r, makeInput(0, 0, 0));
      expect(r.nextGate > 0, `latéral ${lateral}`).toBe(passes);
    }
    expect(race.nextGate).toBe(0);
  });
});

describe("virage ample (3 × 3 cellules)", () => {
  it("occupe huit cellules (le coin intérieur n'est jamais touché par la route) et ressort tourné d'un quart de tour, trois colonnes de côté et deux rangées plus loin", () => {
    for (const [letter, kind, dir, exit, mirror] of [["L3", "grandL", 1, [3, 2], 1], ["R3", "grandR", 3, [-3, 2], -1]] as const) {
      const t = parseTrack("x", `S@start ${letter} S@finish`);
      const b = t.blocks[1]!;
      expect(b.kind).toBe(kind);
      expect([...t.cells.values()].filter((c) => c === b)).toHaveLength(8);
      expect(t.cells.has((0 + mirror * 2 + 1024) * 4096 + (1 + 1024))).toBe(false); // le coin intérieur reste libre
      const after = t.blocks[2]!;
      expect(after.dir).toBe(dir);
      expect([after.cx, after.cz - 1]).toEqual([exit[0], exit[1]]);
    }
    expect(blockCells(0, 0, 0, "grandL").cells).toHaveLength(8);
  });

  it("garde la route dans ses cellules, à toute largeur : la ligne médiane et les deux bords de la route restent dans le bloc", () => {
    for (const letter of ["e", "n", "l"] as const) {
      for (const curve of ["L3", "R3", "L2", "R2", "L", "R"]) {
        const t = parseTrack("x", `S/${letter}@start ${curve} S@finish`);
        const world = trackWorld(t);
        const s = createSurface();
        const line = trackCenterline(t);
        const hw = ROAD_WIDTHS[letter] / 2;
        for (let i = 1; i < line.x.length - 1; i++) {
          // Le point de la ligne médiane et son voisin extérieur et intérieur (à hw − 0,2 m, dans la direction de la normale) sont sur la route.
          const tx = line.x[i + 1]! - line.x[i - 1]!;
          const tz = line.z[i + 1]! - line.z[i - 1]!;
          const len = Math.hypot(tx, tz);
          for (const side of [-1, 1]) {
            world.sample(line.x[i]! + (side * (hw - 0.2) * tz) / len, line.z[i]! - (side * (hw - 0.2) * tx) / len, s);
            expect(s.height, `${curve}/${letter} point ${i}`).not.toBe(NO_GROUND);
          }
        }
      }
    }
  });

  it("se raccorde au bloc suivant : le bord de sortie est le bord d'entrée du suivant, sans trou", () => {
    const t = parseTrack("x", "S/n@start L3 S R3 S@finish");
    const line = trackCenterline(t);
    for (let i = 1; i < t.blocks.length; i++) {
      const prevEnd = line.block.lastIndexOf(i - 1);
      const start = line.block.indexOf(i);
      expect(Math.hypot(line.x[prevEnd]! - line.x[start]!, line.z[prevEnd]! - line.z[start]!)).toBeLessThan(1e-9);
    }
    for (let i = 1; i < line.x.length; i++) expect(Math.hypot(line.x[i]! - line.x[i - 1]!, line.z[i]! - line.z[i - 1]!)).toBeLessThanOrEqual(CELL / 2 + 1e-9);
    expect(isCurve(t.blocks[1]!.kind)).toBe(true);
  });
});

describe("scénario largeurs", () => {
  const t = createLargeursTrack();

  it("montre les trois largeurs, des transitions, une courbe ample, un S large et un rétrécissement avant un virage serré", () => {
    expect(new Set(t.blocks.flatMap((b) => [b.w0, b.w1]))).toEqual(new Set([14, 20, 26]));
    expect(t.blocks.filter((b) => b.w0 !== b.w1).length).toBeGreaterThanOrEqual(4);
    expect(t.blocks.some((b) => b.kind === "grandL" || b.kind === "grandR")).toBe(true);
    const kinds = t.blocks.map((b) => b.kind);
    expect(kinds.some((k, i) => (k === "wideL" || k === "wideR") && (kinds[i + 1] === "wideL" || kinds[i + 1] === "wideR"))).toBe(true);
    const tight = t.blocks.find((b) => b.kind === "curveL" || b.kind === "curveR")!;
    expect(tight.w0).toBe(14);
    // Le resserrement 20 → 14 m précède le virage serré (à un bloc près).
    const before = t.blocks.slice(tight.index - 2, tight.index);
    expect(before.some((b) => b.w0 === 20 && b.w1 === 14)).toBe(true);
  });

  it("le pilote le finit sans reprise, et la rediffusion redonne exactement ce temps", () => {
    const run = bestPilotRun(t)!;
    expect(run).not.toBeNull();
    expect(run.respawns).toBe(0);
    const again = replayRace(t, decodeReplay(encodeReplay(run.replay)));
    expect(again.finishMs).toBe(run.finishMs);
    expect(LARGEURS_TRACK_SPEC.split(" ").length).toBe(t.blocks.length);
  });
});

describe("pilote et largeur de route", () => {
  /** Écart maximal de la trajectoire de course à la ligne médiane (distance au segment le plus proche, en m). */
  const maxOffset = (spec: string): number => {
    const t = parseTrack("x", spec);
    const line = racingLine(t, 35, 32, 48);
    const centre = trackCenterline(t);
    const toSegment = (px: number, pz: number, j: number) => {
      const ax = centre.x[j]!;
      const az = centre.z[j]!;
      const dx = centre.x[j + 1]! - ax;
      const dz = centre.z[j + 1]! - az;
      const f = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(px - (ax + f * dx), pz - (az + f * dz));
    };
    let best = 0;
    for (let i = 0; i < line.x.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j + 1 < centre.x.length; j++) nearest = Math.min(nearest, toSegment(line.x[i]!, line.z[i]!, j));
      best = Math.max(best, nearest);
    }
    return best;
  };

  it("prend une corde plus ouverte sur une route large : la trajectoire s'écarte davantage de l'axe", () => {
    const narrow = maxOffset("S/e@start S L2 S S@finish");
    const wide = maxOffset("S/l@start S L2 S S@finish");
    expect(wide).toBeGreaterThan(narrow + 3);
  });

  it("reste à l'intérieur de la route à toute largeur (la marge aux rebords est conservée)", () => {
    for (const w of ["e", "n", "l"] as const) {
      const hw = ROAD_WIDTHS[w] / 2;
      expect(maxOffset(`S/${w}@start S L2 S S@finish`)).toBeLessThanOrEqual(hw - 3.4);
    }
  });

  it("finit un circuit des trois largeurs sans toucher de rebord à plus de quelques chocs", () => {
    const run = runAutopilot(createLargeursTrack(), 120);
    expect(run.race.finishMs).toBeGreaterThan(0);
    expect(run.race.respawns).toBe(0);
  });
});
