import { describe, expect, it } from "vitest";
import {
  CELL,
  HALF_ROAD,
  NO_GROUND,
  SLOPE_RISE,
  TEST_TRACK_SPEC,
  blockHeight,
  createSurface,
  createPilotageTrack,
  createTestTrack,
  createWallHit,
  parseTrack,
  trackCenterline,
  trackWorld,
} from "../src/index";

describe("parseTrack", () => {
  const track = createTestTrack();

  it("lit le circuit d'essai : 37 blocs, 3 points de contrôle + l'arrivée", () => {
    expect(track.blocks).toHaveLength(37);
    expect(track.cells.size).toBe(37);
    expect(track.gates.map((g) => g.kind)).toEqual(["checkpoint", "checkpoint", "checkpoint", "finish"]);
    expect(track.blocks[0]!.mark).toBe("start");
  });

  it("place le départ au milieu de la route du premier bloc, cap +z", () => {
    expect(track.spawn).toEqual({ x: CELL / 2, y: 0, z: 8, yaw: 0 });
  });

  it("enchaîne les hauteurs (montée de 4 m puis descente)", () => {
    const heights = track.blocks.map((b) => b.y0);
    expect(Math.max(...heights)).toBe(SLOPE_RISE);
    expect(heights[0]).toBe(0);
    expect(heights[track.blocks.length - 1]).toBe(0);
    expect(track.voidY).toBeLessThan(0);
  });

  it("refuse un circuit qui se recoupe", () => {
    expect(() => parseTrack("x", "S@start L L L L S@finish")).toThrow(/retombe/);
  });

  it("refuse un départ ou une arrivée manquants, ou un bloc inconnu", () => {
    expect(() => parseTrack("x", "S S@finish")).toThrow(/@start/);
    expect(() => parseTrack("x", "S@start S")).toThrow(/@finish/);
    expect(() => parseTrack("x", "S@start Z S@finish")).toThrow(/inconnu/);
    expect(() => parseTrack("x", "S@start L@cp S@finish")).toThrow(/bloc S/);
  });

  it("a une ligne médiane continue, sans trou, qui reste sur la route", () => {
    const line = trackCenterline(track);
    const world = trackWorld(track);
    const surf = createSurface();
    const hit = createWallHit();
    for (let i = 0; i < line.x.length; i++) {
      if (i > 0) {
        const gap = Math.hypot(line.x[i]! - line.x[i - 1]!, line.z[i]! - line.z[i - 1]!);
        expect(gap).toBeLessThan(CELL / 2 + 1e-9); // ≤ demi-bloc
      }
      world.sample(line.x[i]!, line.z[i]!, surf);
      expect(surf.height).toBeCloseTo(line.y[i]!, 9);
      // Hors bouts de piste (le départ et l'arrivée sont fermés par un rebord).
      if (i > 0 && i < line.x.length - 1) expect(world.collide(line.x[i]!, line.z[i]!, line.y[i]!, 1, hit)).toBe(false);
    }
    // Les blocs se raccordent : le point d'arrivée d'un bloc est le point de départ du suivant.
    for (let i = 1; i < track.blocks.length; i++) {
      const prevEnd = line.block.lastIndexOf(i - 1);
      const start = line.block.indexOf(i);
      expect(Math.hypot(line.x[prevEnd]! - line.x[start]!, line.z[prevEnd]! - line.z[start]!)).toBeLessThan(1e-9);
    }
  });

  it("lit le circuit de pilotage, avec ses deux virages larges (2 × 2 cellules)", () => {
    const pilotage = createPilotageTrack();
    const wide = pilotage.blocks.filter((b) => b.kind === "wideL" || b.kind === "wideR");
    expect(wide).toHaveLength(2);
    expect(pilotage.cells.size).toBe(pilotage.blocks.length + 3 * wide.length);
    for (const b of wide) expect([...pilotage.cells.values()].filter((c) => c === b)).toHaveLength(4);
  });

  it("virage large : on ressort tourné d'un quart de tour, deux colonnes de côté et une rangée plus loin", () => {
    for (const [letter, dir, exit] of [["L2", 1, [2, 2]], ["R2", 3, [-2, 2]]] as const) {
      const t = parseTrack("x", `S@start ${letter} S@finish`);
      const after = t.blocks[2]!;
      expect(after.dir).toBe(dir);
      expect([after.cx, after.cz]).toEqual(exit);
      // La ligne médiane est continue et reste sur la route, rebords compris.
      const line = trackCenterline(t);
      const world = trackWorld(t);
      const surf = createSurface();
      const hit = createWallHit();
      // (Le dernier point, au bord extérieur de l'arrivée, est déjà hors du circuit.)
      for (let i = 1; i < line.x.length - 1; i++) {
        expect(Math.hypot(line.x[i]! - line.x[i - 1]!, line.z[i]! - line.z[i - 1]!)).toBeLessThanOrEqual(CELL / 2);
        world.sample(line.x[i]!, line.z[i]!, surf);
        expect(surf.height).toBe(0);
        expect(world.collide(line.x[i]!, line.z[i]!, 0, 1, hit)).toBe(false);
      }
      // Hors de l'anneau de route du virage : le vide.
      world.sample(CELL / 2 + (letter === "L2" ? 1 : -1) * 24, CELL + 4, surf);
      expect(surf.height).toBe(NO_GROUND);
    }
  });

  it("garde la spec du circuit d'essai en un seul endroit", () => {
    expect(TEST_TRACK_SPEC.split(" ")).toHaveLength(37);
  });
});

describe("monde du circuit", () => {
  const track = createTestTrack();
  const world = trackWorld(track);
  const surf = createSurface();
  const hit = createWallHit();

  it("hors route ou hors circuit, c'est le vide", () => {
    world.sample(CELL / 2 + HALF_ROAD + 0.5, 10, surf);
    expect(surf.height).toBe(NO_GROUND);
    world.sample(-500, -500, surf);
    expect(surf.height).toBe(NO_GROUND);
  });

  it("repousse la voiture qui touche un rebord, côté gauche comme côté droit", () => {
    const edge = HALF_ROAD - 0.5; // le disque de rayon 1 mord de 0,5 m
    expect(world.collide(CELL / 2 + edge, 10, 0, 1, hit)).toBe(true);
    expect(hit.nx).toBeCloseTo(-1, 9);
    expect(hit.depth).toBeCloseTo(0.5, 9);
    expect(world.collide(CELL / 2 - edge, 10, 0, 1, hit)).toBe(true);
    expect(hit.nx).toBeCloseTo(1, 9);
  });

  it("ne bloque pas une voiture qui survole le rebord", () => {
    expect(world.collide(CELL / 2 + HALF_ROAD - 0.5, 10, 5, 1, hit)).toBe(false);
  });

  it("ferme le circuit derrière le départ", () => {
    expect(world.collide(CELL / 2, 0.4, 0, 1, hit)).toBe(true);
    expect(hit.nz).toBeCloseTo(1, 9);
  });

  it("a une pente dans le sens du cap sur un bloc de montée", () => {
    const up = track.blocks.find((b) => b.kind === "up")!;
    const x = up.cx * CELL + CELL / 2;
    const z = up.cz * CELL + CELL / 2;
    world.sample(x, z, surf);
    expect(surf.height).toBeCloseTo(up.y0 + SLOPE_RISE / 2, 9);
    expect(Math.hypot(surf.gx, surf.gz)).toBeCloseTo(SLOPE_RISE / CELL, 9);
  });

  it("a une hauteur continue de part et d'autre d'un bloc de pente", () => {
    const up = track.blocks.find((b) => b.kind === "up")!;
    expect(blockHeight(up, CELL)).toBeCloseTo(track.blocks[up.index + 1]!.y0, 12);
  });
});
