import { describe, expect, it } from "vitest";
import {
  CELL,
  FALL_TICKS,
  HALF_PI,
  LEVEL,
  NO_GROUND,
  Rng,
  atanRatio,
  bankAt,
  blockPoint,
  createRace,
  createSurface,
  curveCenter,
  exitDelta,
  makeInput,
  parseToken,
  parseTrack,
  runPilot,
  stepRace,
  trackCenterline,
  trackWorld,
  voidYAt,
  type BankSample,
} from "../src/index";

// Lot 25 : virages en pente (`L2/d`, `L3/d` : les lacets du Col alpin descendent aussi) et chute décidée près de la voiture.

const world = (spec: string) => trackWorld(parseTrack("pente", spec));
const surf = createSurface();

/** Hauteur de la route au point (p, q) du bloc `i`, en passant par `world.sample` (comme la voiture). */
function heightAt(spec: string, i: number, p: number, q: number): number {
  const t = parseTrack("pente", spec);
  const pt = { x: 0, z: 0 };
  blockPoint(t.blocks[i]!, p, q, pt);
  trackWorld(t).sample(pt.x, pt.z, surf);
  return surf.height;
}

describe("atanRatio (premier quadrant, sans Math.atan2)", () => {
  it("donne l'angle à 1e-9 près sur tout le quart de cercle", () => {
    for (let i = 0; i <= 200; i++) {
      const a = (HALF_PI * i) / 200;
      // cos et sin exacts du moteur JS, seulement pour fabriquer le point de test
      expect(Math.abs(atanRatio(Math.sin(a), Math.cos(a)) - a)).toBeLessThan(1e-9);
    }
    expect(atanRatio(0, 5)).toBe(0);
    expect(atanRatio(5, 0)).toBeCloseTo(HALF_PI, 12);
    expect(atanRatio(0, 0)).toBe(0);
  });
});

describe("virage en pente : notation", () => {
  it("`/d` sur un virage large ou ample : un niveau de moins à la sortie", () => {
    expect(parseToken("L2/d").rise).toBe(-LEVEL);
    expect(parseToken("R3/d").rise).toBe(-LEVEL);
    expect(parseToken("L2/bd").banked).toBe(true);
    expect(exitDelta(parseToken("L2/d").kind, parseToken("L2/d").rise)).toBe(-LEVEL);
    expect(exitDelta(parseToken("L2").kind, parseToken("L2").rise)).toBe(0);
    const t = parseTrack("p", "S@start L2/d S R3/d S S@finish");
    expect(t.blocks.map((b) => b.y0)).toEqual([0, 0, -4, -4, -8, -8]);
  });

  it("refusé sur un virage serré, une droite ou un virage en cuve", () => {
    expect(() => parseToken("L/d")).toThrow();
    expect(() => parseToken("S/d")).toThrow();
    expect(() => parseToken("L2/cd")).toThrow();
  });
});

describe("virage en pente : la route", () => {
  const SPEC = "S@start S L2/d S R3/d S S@finish";
  const t = parseTrack("pente", SPEC);

  it("part de la hauteur d'entrée et finit à celle de sortie, sans marche, sur toute la largeur", () => {
    for (const i of [2, 4]) {
      const b = t.blocks[i]!;
      const { cp, r } = curveCenter(b.kind);
      for (const off of [-6, 0, 6]) {
        const side = b.kind === "wideL" || b.kind === "grandL" ? -1 : 1;
        const R = r + off;
        // entrée (angle 0) et sortie (angle π/2)
        expect(heightAt(SPEC, i, cp + side * R, 0.001), `bloc ${i} entrée ${off}`).toBeCloseTo(b.y0, 2);
        expect(heightAt(SPEC, i, cp + side * 0.001, R), `bloc ${i} sortie ${off}`).toBeCloseTo(b.y0 + b.rise, 2);
      }
    }
  });

  it("descend régulièrement le long de l'axe (pente constante = dénivelé ÷ longueur de l'arc)", () => {
    const line = trackCenterline(t);
    const pts = line.y.map((y, k) => ({ y, b: line.block[k]! })).filter((p) => p.b === 2);
    for (let k = 1; k < pts.length; k++) expect(pts[k]!.y).toBeLessThan(pts[k - 1]!.y + 1e-9);
    expect(pts[0]!.y).toBeCloseTo(0, 6);
    expect(pts[pts.length - 1]!.y).toBeCloseTo(-4, 6);
  });

  it("le gradient de `bankAt` est la dérivée de la hauteur (différences finies), relevé compris", () => {
    for (const spec of ["S@start L2/d S S@finish", "S@start R3/bd S S@finish", "S@start L2/bd S S@finish"]) {
      const b = parseTrack("p", spec).blocks[1]!;
      const { cp, r } = curveCenter(b.kind);
      const side = b.kind === "wideL" || b.kind === "grandL" ? -1 : 1;
      const s: BankSample = { h: 0, gp: 0, gq: 0 };
      const s1: BankSample = { h: 0, gp: 0, gq: 0 };
      const rng = new Rng(25);
      for (let k = 0; k < 40; k++) {
        const a = 0.05 + 1.45 * (rng.int(10000) / 10000);
        const R = r - 6 + 12 * (rng.int(10000) / 10000);
        const p = cp + side * R * Math.cos(a);
        const q = R * Math.sin(a);
        bankAt(b, p, q, s);
        const e = 1e-4;
        bankAt(b, p + e, q, s1);
        const dp = (s1.h - s.h) / e;
        bankAt(b, p, q + e, s1);
        const dq = (s1.h - s.h) / e;
        expect(Math.abs(dp - s.gp), `${spec} gp`).toBeLessThan(1e-3);
        expect(Math.abs(dq - s.gq), `${spec} gq`).toBeLessThan(1e-3);
      }
    }
  });

  it("un virage sans `/d` est inchangé : même hauteur, même gradient qu'avant (plat ou relevé)", () => {
    const flat = parseTrack("p", "S@start L2 S S@finish").blocks[1]!;
    const s: BankSample = { h: 1, gp: 1, gq: 1 };
    bankAt(flat, 10, 20, s);
    expect([s.h, s.gp, s.gq]).toEqual([0, 0, 0]);
    const w = world("S@start L2 S S@finish");
    const pt = { x: 0, z: 0 };
    blockPoint(parseTrack("p", "S@start L2 S S@finish").blocks[1]!, 30, 30, pt);
    w.sample(pt.x, pt.z, surf);
    expect(surf.height).toBe(0);
  });
});

describe("virage en pente : la voiture", () => {
  it("braquages au hasard (6 graines × 20 s) dans des lacets : jamais sous la route, jamais de chute", () => {
    const spec = "S@start S S D L2/d D D R2/d D2 D L3/d D D L2/bd S S S S S S S S@finish";
    const track = parseTrack("lacets", spec);
    const w = trackWorld(track);
    for (let seed = 1; seed <= 6; seed++) {
      const rng = new Rng(seed);
      const race = createRace(track);
      let steer = 0;
      for (let k = 0; k < 20 * 120 && race.finishMs < 0; k++) {
        if (k % (20 + rng.int(60)) === 0) steer = rng.int(3) - 1;
        stepRace(race, makeInput(steer * (0.3 + 0.7 * (rng.int(10000) / 10000)), rng.int(10) < 8 ? 1 : 0, rng.int(10) === 0 ? 1 : 0));
        const c = race.car;
        w.sample(c.x, c.z, surf);
        if (c.grounded && surf.height > NO_GROUND / 2) expect(c.y, `graine ${seed} pas ${k}`).toBeGreaterThan(surf.height - 0.5);
      }
      expect(race.respawns, `graine ${seed}`).toBe(0);
    }
  });

  it("le pilote descend les lacets plus vite qu'il ne les prend à plat (la pente pousse) et ne tombe pas", () => {
    const down = runPilot(parseTrack("d", "S@start S S D L2/d D D R2/d D D L2/d D R2/d S S@finish"));
    const flat = runPilot(parseTrack("f", "S@start S S D L2 D D R2 D D L2 D R2 S S@finish"));
    expect(down.valid).toBe(true);
    expect(flat.valid).toBe(true);
    expect(down.respawns).toBe(0);
    expect(down.finishMs).toBeLessThan(flat.finishMs);
  });
});

describe("chute décidée près de la voiture (lot 25)", () => {
  it("la limite de chute suit la route voisine : 4 m sous elle, la route la plus basse du circuit ne compte plus", () => {
    const t = parseTrack("col", "S@start S S/o S D3 D3 D3 D3 D3 D3 S S@finish");
    expect(t.voidY).toBe(-72 - 4);
    const pt = { x: 0, z: 0 };
    blockPoint(t.blocks[2]!, CELL / 2, CELL / 2, pt);
    expect(voidYAt(t, pt.x, pt.z)).toBe(-4);
    blockPoint(t.blocks[2]!, CELL / 2 + 30, CELL / 2, pt); // à côté de la route (cellule voisine, vide)
    expect(voidYAt(t, pt.x, pt.z)).toBe(-4);
    expect(voidYAt(t, 1e5, 1e5)).toBe(t.voidY); // loin de tout
  });

  it("une voiture qui quitte une section sans rebords en haut reprend vite (au lieu de tomber jusqu'au bas du circuit)", () => {
    const track = parseTrack("col", "S@start S/o S/o S/o D3 D3 D3 D3 D3 D3 S S@finish");
    const race = createRace(track);
    let left = -1;
    let low = 0;
    let k = 0;
    for (; k < 8 * 120 && race.respawns === 0; k++) {
      stepRace(race, makeInput(k > 90 ? 0.35 : 0, 1, 0));
      if (left < 0 && race.fallTicks > 0) left = k;
      if (race.respawns === 0) low = Math.min(low, race.car.y);
    }
    expect(race.respawns).toBe(1);
    expect(left).toBeGreaterThan(0);
    // De la décision de chute (4 m sous la route) à la reprise : FALL_TICKS, comme au lot 17 ; la voiture n'est jamais descendue à plus de
    // 20 m sous le départ (avant le lot 25, la décision attendait 76 m plus bas, soit 2,5 s de chute de plus).
    expect(k - left).toBeLessThanOrEqual(FALL_TICKS + 1);
    expect(low).toBeGreaterThan(-20);
  });
});
