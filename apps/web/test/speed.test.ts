import { describe, expect, it } from "vitest";
import { DEFAULT_CAR_PARAMS, createVitesseTrack, parseTrack } from "@cdj/sim";
import { buzzAmplitude, fastZones, flatRatio, overSpeed, postFractions, speedCamera, speedLevel, speedLinesOpacity } from "../src/speedFeel";

const P = DEFAULT_CAR_PARAMS;

describe("sensation de vitesse (lot 15)", () => {
  it("rien de plus avant la pointe du plat, tout au maximum à la vitesse du super turbo", () => {
    expect(overSpeed(0)).toBe(0);
    expect(overSpeed(P.maxSpeed)).toBe(0);
    expect(overSpeed(P.turboMaxSpeed)).toBe(1);
    expect(overSpeed(P.turboMaxSpeed + 30)).toBe(1);
    expect(flatRatio(P.maxSpeed)).toBe(1);
    expect(speedCamera(P.maxSpeed)).toEqual({ fov: 0, lower: 0, back: 0, lag: 0 });
    expect(buzzAmplitude(P.maxSpeed)).toBe(0);
  });

  it("la caméra s'ouvre, descend et traîne de plus en plus avec la vitesse", () => {
    const a = speedCamera(60);
    const b = speedCamera(80);
    expect(b.fov).toBeGreaterThan(a.fov);
    expect(b.lower).toBeGreaterThan(a.lower);
    expect(b.back).toBeGreaterThan(a.back);
    expect(b.lag).toBeGreaterThan(a.lag);
    // L'ouverture reste mesurée : au plus 10° de plus (pas de vertige).
    expect(speedCamera(200).fov).toBeLessThanOrEqual(10);
  });

  it("la vibration n'apparaît qu'à très haute vitesse et reste de quelques centimètres", () => {
    expect(buzzAmplitude(60)).toBe(0);
    expect(buzzAmplitude(P.turboMaxSpeed)).toBeCloseTo(0.05, 6);
    expect(buzzAmplitude(80)).toBeGreaterThan(0);
    expect(buzzAmplitude(200)).toBeLessThanOrEqual(0.05);
  });

  it("les lignes de vitesse montent avec la vitesse, plus encore au-delà de la pointe", () => {
    expect(speedLinesOpacity(20, false)).toBe(0);
    expect(speedLinesOpacity(P.maxSpeed, false)).toBeGreaterThan(0.2);
    expect(speedLinesOpacity(80, false)).toBeGreaterThan(speedLinesOpacity(P.maxSpeed, false) + 0.1);
    expect(speedLinesOpacity(300, true)).toBeLessThanOrEqual(0.61);
  });

  it("le compteur change de couleur au-delà de la pointe : 0 → 1 → 2 → 3", () => {
    expect(speedLevel(30)).toBe(0);
    expect(speedLevel(P.maxSpeed)).toBe(0);
    expect(speedLevel(P.maxSpeed + 4)).toBe(1);
    expect(speedLevel(65)).toBe(2);
    expect(speedLevel(P.turboMaxSpeed)).toBe(3);
  });

  it("repère les portions rapides du texte : turbo, plaque en haut d'une descente, longue descente", () => {
    const t = parseTrack("z", "S@start S T S S S S S S S P D D D S S D D D D S S S S S@finish");
    const zones = fastZones(t);
    const kinds = t.blocks.map((b) => b.kind);
    expect(zones[kinds.indexOf("turbo")]).toBe(true);
    expect(zones[kinds.indexOf("turbo") + 6]).toBe(true);
    expect(zones[kinds.indexOf("turbo") + 7]).toBe(false);
    expect(zones[kinds.indexOf("boost")]).toBe(true);
    expect(zones[kinds.indexOf("down", kinds.indexOf("boost")) + 3]).toBe(true);
    expect(zones[0]).toBe(false);
    expect(zones[zones.length - 1]).toBe(false);
    // Une descente de deux blocs seulement n'en est pas une.
    const short = fastZones(parseTrack("c", "S@start S D D S S S S@finish"));
    expect(short.every((z) => !z)).toBe(true);
  });

  it("le scénario vitesse a des portions rapides ; les poteaux sont deux fois plus serrés dans une portion rapide", () => {
    const zones = fastZones(createVitesseTrack());
    expect(zones.filter(Boolean).length).toBeGreaterThan(10);
    expect(zones.filter((z) => !z).length).toBeGreaterThan(5);
    expect(postFractions(true).length).toBe(2 * postFractions(false).length);
  });
});
