import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ReplayRunner,
  TRAJECTOIRE_PAS,
  TRAJECTOIRE_POINTS_MAX,
  TRAJECTOIRE_RESOLUTION,
  TrajectoireError,
  UNITS_PER_TILE,
  dailyLevel,
  decoderTrajectoire,
  echantillonnerTrajectoire,
  encoderTrajectoire,
  trajectoireDuree,
  trajectoirePose,
} from "../src/index";

// Lot G1 : le fantôme Diamant de Jump est une trajectoire (positions échantillonnées), jamais des entrées.

const NIVEAU = dailyLevel(daysFromCivil(2026, 10, 30));

describe("trajectoire du Diamant (lot G1)", () => {
  const pts = echantillonnerTrajectoire(NIVEAU.level, NIVEAU.replay);
  const texte = encoderTrajectoire(pts);
  const t = decoderTrajectoire(texte);

  it("échantillonne à 30 points par seconde, du départ à l'arrivée", () => {
    expect(TRAJECTOIRE_PAS).toBe(4);
    const pas = NIVEAU.authorTicks;
    expect(t.x.length).toBe(Math.ceil(pas / TRAJECTOIRE_PAS) + 1);
    expect(trajectoireDuree(t)).toBeGreaterThanOrEqual(pas);
    expect(trajectoireDuree(t)).toBeLessThan(pas + TRAJECTOIRE_PAS);
  });

  it("garde les positions du rejeu au 1/64 de tuile près", () => {
    const runner = new ReplayRunner(NIVEAU.level, NIVEAU.replay);
    const demi = 0.5 / TRAJECTOIRE_RESOLUTION + 1e-9;
    expect(Math.abs(t.x[0]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
    let n = 0;
    while (runner.step()) {
      if (runner.tick % TRAJECTOIRE_PAS === 0) {
        n++;
        expect(Math.abs(t.x[n]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
        expect(Math.abs(t.y[n]! - runner.state.player.y / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
      }
    }
    // Le dernier point est celui de l'arrivée.
    const fin = t.x.length - 1;
    expect(Math.abs(t.x[fin]! - runner.state.player.x / UNITS_PER_TILE)).toBeLessThanOrEqual(demi);
  });

  it("ne porte aucune entrée : le texte ne contient ni la rediffusion ni ses séries", () => {
    expect(texte).not.toContain(NIVEAU.code);
    expect(texte.length).toBeLessThan(NIVEAU.code.length * 12);
    // Le format n'a que des positions : un point par échantillon, rien d'autre (octets = 2 + varint + deltas).
    expect(Object.keys(t).sort()).toEqual(["pas", "x", "y"]);
  });

  it("a une taille bornée : quelques ko pour un niveau de 25 à 40 s", () => {
    expect(texte.length).toBeLessThan(8_000);
    expect(pts.length / 2).toBeLessThanOrEqual(TRAJECTOIRE_POINTS_MAX);
  });

  it("s'interpole entre deux échantillons et s'arrête au dernier", () => {
    const a = trajectoirePose(t, 0);
    expect(a).toEqual({ x: t.x[0], y: t.y[0], fini: false });
    const milieu = trajectoirePose(t, 2, 0); // deux pas = la moitié d'un intervalle de 4
    expect(milieu.x).toBeCloseTo((t.x[0]! + t.x[1]!) / 2, 12);
    expect(milieu.y).toBeCloseTo((t.y[0]! + t.y[1]!) / 2, 12);
    const quart = trajectoirePose(t, 1, 0);
    expect(quart.x).toBeCloseTo(t.x[0]! + (t.x[1]! - t.x[0]!) * 0.25, 12);
    const alpha = trajectoirePose(t, 1, 0.5);
    expect(alpha.x).toBeCloseTo(t.x[0]! + (t.x[1]! - t.x[0]!) * 0.375, 12);
    const fin = trajectoirePose(t, trajectoireDuree(t) + 50);
    expect(fin).toEqual({ x: t.x.at(-1), y: t.y.at(-1), fini: true });
    // Avant le départ (chrono négatif, décompte) : le premier point.
    expect(trajectoirePose(t, -30)).toEqual({ x: t.x[0], y: t.y[0], fini: false });
  });

  it("refuse un texte mal formé ou hors limites", () => {
    expect(() => decoderTrajectoire("")).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire("é")).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire(texte.slice(0, 10))).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire(`${texte}AA`)).toThrow(TrajectoireError);
    expect(() => decoderTrajectoire("AAAAAA")).toThrow(TrajectoireError); // format 0
    expect(() => encoderTrajectoire([])).toThrow(TrajectoireError);
  });

  it("encode et décode sans perte des positions négatives et d'un seul point", () => {
    const x = decoderTrajectoire(encoderTrajectoire([-64, 128, 0, -5]));
    expect(x.x).toEqual([-1, 0]);
    expect(x.y).toEqual([2, -5 / 64]);
  });
});
