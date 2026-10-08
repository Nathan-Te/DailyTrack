import { describe, expect, it } from "vitest";
import { createCar } from "@cdj/sim";
import { DEFAULT_AUDIO, GEAR_SPEEDS, SURFACE_SOUNDS, engineSound, landingQuality, landingSound, nextVolume, noteFreq, parseAudioSettings, skidLevel, toggleMute, volumeIcon, windGain } from "../src/audioLogic";
import { TRAVEL_DOWN, TRAVEL_UP, clampTravel } from "../src/carMesh";
import { QualityGovernor } from "../src/fx";
import { slideOf } from "../src/telemetry";

describe("moteur simulé", () => {
  it("le régime monte dans un rapport et retombe au changement", () => {
    const before = engineSound(GEAR_SPEEDS[2]! - 0.1, 1);
    const after = engineSound(GEAR_SPEEDS[2]! + 0.1, 1);
    expect(after.gear).toBe(before.gear + 1);
    expect(after.rpm).toBeLessThan(before.rpm - 0.4);
    expect(engineSound(26, 1).freq).toBeGreaterThan(engineSound(22, 1).freq);
  });
  it("sans gaz : plus bas et plus discret", () => {
    const on = engineSound(20, 1);
    const off = engineSound(20, 0);
    expect(off.rpm).toBeLessThan(on.rpm);
    expect(off.gain).toBeLessThan(on.gain);
  });
  it("reste dans ses bornes, même hors normes", () => {
    for (const v of [-5, 0, 48, 200]) for (const t of [-1, 0, 2]) {
      const e = engineSound(v, t);
      expect(e.rpm).toBeGreaterThanOrEqual(0);
      expect(e.rpm).toBeLessThanOrEqual(1);
      expect(e.gain).toBeLessThan(0.25);
    }
  });
});

describe("crissement, vent, revêtements", () => {
  it("crisse en dérivant, pas en ligne droite ni en l'air", () => {
    expect(skidLevel(0, 30, false, true)).toBe(0);
    expect(skidLevel(0.4, 30, false, true)).toBeGreaterThan(0.5);
    expect(skidLevel(0.4, 30, false, false)).toBe(0);
    expect(skidLevel(0.4, 2, false, true)).toBe(0);
    expect(skidLevel(0, 30, true, true)).toBeGreaterThan(0);
  });
  it("le vent n'est audible qu'à haute vitesse", () => {
    expect(windGain(10)).toBeLessThan(0.01);
    expect(windGain(48)).toBeGreaterThan(0.05);
  });
  it("chaque revêtement a une voix différente", () => {
    const freqs = Object.values(SURFACE_SOUNDS).map((s) => s.rollFreq);
    expect(new Set(freqs).size).toBe(freqs.length);
  });
  it("noteFreq : la = 440 Hz, octave = ×2", () => {
    expect(noteFreq(0)).toBeCloseTo(440, 6);
    expect(noteFreq(12)).toBeCloseTo(880, 4);
  });
});

describe("volume et sourdine (touche M)", () => {
  it("réglages illisibles ou hors limites : valeurs sûres", () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings("pas du json")).toEqual(DEFAULT_AUDIO);
    expect(parseAudioSettings('{"volume":7}').volume).toBe(1);
    expect(parseAudioSettings('{"volume":-1,"last":0.3}').volume).toBe(0);
  });
  it("M coupe puis rétablit le dernier volume", () => {
    const muted = toggleMute({ volume: 0.25, last: 0.25 });
    expect(muted.volume).toBe(0);
    expect(toggleMute(muted).volume).toBe(0.25);
    expect(toggleMute({ volume: 0, last: 0 }).volume).toBe(DEFAULT_AUDIO.last);
  });
  it("le bouton fait le tour des crans", () => {
    let s = { volume: 0, last: 0.55 };
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = nextVolume(s);
      seen.push(s.volume);
    }
    expect(seen).toEqual([0.25, 0.55, 1, 0]);
    expect(volumeIcon(0)).toBe("🔇");
    expect(volumeIcon(1)).toBe("🔊");
  });
});

describe("rendu : suspension et dérive", () => {
  it("le débattement des roues est borné", () => {
    expect(clampTravel(-5)).toBe(-TRAVEL_UP);
    expect(clampTravel(5)).toBe(TRAVEL_DOWN);
    expect(clampTravel(0.05)).toBe(0.05);
  });
  it("dérive : nulle en ligne droite, signée sur le côté", () => {
    const straight = { ...createCar(), vx: 0, vz: 30, yaw: 0 };
    expect(slideOf(straight)).toBeCloseTo(0, 9);
    const sideways = { ...createCar(), vx: 6, vz: 30, yaw: 0 };
    expect(slideOf(sideways)).toBeGreaterThan(0.1);
    expect(slideOf({ ...sideways, vx: -6 })).toBeLessThan(-0.1);
    expect(slideOf({ ...createCar(), vx: 0.1, vz: 0, yaw: 0 })).toBe(0);
  });
});

describe("qualité automatique", () => {
  const run = (g: QualityGovernor, ms: number, seconds: number) => {
    let changes = 0;
    for (let t = 0; t < seconds * 1000; t += ms) if (g.observe(ms)) changes++;
    return changes;
  };
  it("baisse quand les images sont lentes, jusqu'au plancher", () => {
    const g = new QualityGovernor();
    run(g, 60, 20);
    expect(g.level).toBe(0);
  });
  it("remonte quand c'est fluide, mais pas tout de suite", () => {
    const g = new QualityGovernor();
    run(g, 60, 10);
    expect(g.level).toBe(0);
    run(g, 8, 3);
    expect(g.level).toBe(0); // pas de yo-yo
    run(g, 8, 30);
    expect(g.level).toBe(2);
  });
  it("ne bouge pas à 60 images/s ni quand elle est figée", () => {
    const g = new QualityGovernor();
    expect(run(g, 16.7, 30)).toBe(0);
    const locked = new QualityGovernor(26, 19, true);
    expect(run(locked, 80, 30)).toBe(0);
    expect(locked.level).toBe(2);
  });
  it("ignore un onglet resté en arrière-plan", () => {
    const g = new QualityGovernor();
    for (let i = 0; i < 50; i++) g.observe(2000);
    expect(g.level).toBe(2);
  });
});

describe("réception (lot 19)", () => {
  it("la qualité d'une réception est la part de vitesse gardée : 1 bien alignée, 0 au pire", () => {
    expect(landingQuality(40, 40)).toBe(1);
    expect(landingQuality(40, 39)).toBeCloseTo(1 - 0.025 / 0.6, 9);
    expect(landingQuality(40, 16)).toBe(0);
    expect(landingQuality(40, 8)).toBe(0);
    expect(landingQuality(0, 0)).toBe(1);
  });

  it("une mauvaise réception sonne plus fort, plus longtemps et plus craquant qu'une propre, à force de chute égale", () => {
    const clean = landingSound(0.6, 1);
    const rough = landingSound(0.6, 0);
    expect(rough.noiseGain).toBeGreaterThan(clean.noiseGain);
    expect(rough.thumpGain).toBeGreaterThan(clean.thumpGain);
    expect(rough.noiseDur).toBeGreaterThan(clean.noiseDur);
    expect(rough.noiseFreq).toBeGreaterThan(clean.noiseFreq);
    expect(landingSound(1, 1).thumpGain).toBeGreaterThan(landingSound(0.1, 1).thumpGain);
  });
});
