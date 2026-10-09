import { describe, expect, it } from "vitest";
import {
  CELL,
  DEFAULT_CAR_PARAMS as P,
  bestPilotRun,
  createAutopilot,
  createCar,
  createRace,
  dailyCircuit,
  daysFromCivil,
  makeInput,
  parseTrack,
  sin,
  cos,
  stepCar,
  stepRace,
  trackWorld,
  type CarParams,
} from "../src/index";

// Cuves rapides (retouche 18b) : monter sur la paroi puis redescendre fait sortir plus vite ; le gain d'un passage est borné.

/** Cuve droite de `n` blocs `V` entre deux droites. */
const bowl = (n: number) => parseTrack("x", `S/n@start S S ${"V ".repeat(n)}S S S S@finish`);

/**
 * Une voiture lancée à `v0` (m/s), pleins gaz, qui suit en poursuite un écart latéral `lat(q)` (m, positif à gauche) jusqu'à la fin de la
 * cuve ; renvoie sa vitesse horizontale en sortie et la plus haute atteinte.
 */
function pass(n: number, v0: number, lat: (q: number) => number, params: Readonly<CarParams> = P) {
  const track = bowl(n);
  const world = trackWorld(track);
  const b = track.blocks[2]!;
  const cx = b.cx * CELL + CELL / 2;
  const car = createCar(cx, b.cz * CELL, 0, b.y0);
  car.vz = v0;
  const z0 = car.z;
  let vmax = 0;
  let hmax = 0;
  for (let t = 0; car.z < z0 + (n + 1) * CELL && t < 20 * 120; t++) {
    const lead = 6 + 0.3 * Math.hypot(car.vx, car.vz);
    const tx = cx + lat(car.z - z0 + lead) - car.x;
    const fx = sin(car.yaw);
    const fz = cos(car.yaw);
    const fwd = tx * fx + lead * fz;
    const left = tx * fz - lead * fx;
    const curvature = (2 * left) / (fwd * fwd + left * left);
    stepCar(car, makeInput(Math.max(-1, Math.min(1, (-curvature * 3.2) / 0.5)), 1, 0), world, params);
    vmax = Math.max(vmax, Math.hypot(car.vx, car.vz));
    hmax = Math.max(hmax, car.y - b.y0);
  }
  return { exit: Math.hypot(car.vx, car.vz), vmax, hmax };
}

/** Écart latéral en « pompe » : monte sur la paroi et redescend, une période de `lam` mètres, amplitude `A` (crête à 2A). */
const pump = (A: number, lam: number) => (q: number) => (q > 5 && q < 5 + lam ? A * (1 - cos((2 * Math.PI * (q - 5)) / lam)) : 0);

describe("cuve droite : monter puis redescendre sort plus vite", () => {
  it("la vitesse de sortie par la paroi dépasse celle du fond d'au moins 8 %", () => {
    for (const v0 of [30, 36]) {
      const floor = pass(4, v0, () => 0);
      const wall = pass(4, v0, pump(6, 102.4));
      expect(wall.hmax, `v0 ${v0}`).toBeGreaterThan(4); // elle est vraiment montée
      expect(wall.exit / floor.exit, `v0 ${v0}`).toBeGreaterThan(1.08);
    }
  });

  it("l'asymétrie fait le gain : sans poussée, sans pointe de paroi et à pesanteur symétrique, la paroi n'est plus un raccourci", () => {
    const flat: CarParams = { ...P, shellClimb: 1, shellDescent: 1, shellTop: 1, shellPush: 0 };
    const floor = pass(4, 36, () => 0, flat);
    const wall = pass(4, 36, pump(6, 102.4), flat);
    expect(wall.exit / floor.exit).toBeLessThan(1.04);
  });
});

describe("virage en cuve : la paroi sort plus vite que le fond", () => {
  /** Vitesse du pilote en entrant dans le bloc qui suit le virage, sur le fond ou sur la paroi. */
  function exitSpeed(curve: string, wall: boolean): number {
    const track = parseTrack("c", `S/n@start S S P S S S S S ${curve} S S S S S S@finish`);
    const next = track.blocks[track.blocks.findIndex((b) => b.cuve) + 2]!;
    const race = createRace(track);
    const drive = createAutopilot(track, { grip: 1.08, wall });
    for (let t = 0; race.finishMs < 0 && race.respawns === 0 && t < 40 * 120; t++) {
      stepRace(race, drive(race));
      if (Math.floor(race.car.x / CELL) === next.cx && Math.floor(race.car.z / CELL) === next.cz) return Math.hypot(race.car.vx, race.car.vz);
    }
    throw new Error(`${curve} paroi=${wall} : le pilote n'est pas arrivé au bloc suivant`);
  }

  it("L2/c et L3/c : vitesse de sortie par la paroi ≥ fond + 8 %", () => {
    for (const curve of ["L2/c", "R2/c", "L3/c", "R3/c"]) expect(exitSpeed(curve, true) / exitSpeed(curve, false), curve).toBeGreaterThan(1.08);
  });
});

describe("pas d'exploitation : le gain est borné", () => {
  it("zigzaguer dans une longue cuve ne fait jamais dépasser ≈ 64 m/s à plat (la pointe de paroi est 55 m/s)", () => {
    const track = parseTrack("z", `S/n@start S S ${"V ".repeat(14)}S S S@finish`);
    const world = trackWorld(track);
    const b = track.blocks[2]!;
    let worst = 0;
    for (const v0 of [30, 40, 48]) {
      for (const period of [0.4, 0.8, 1.8, 3.5, 5]) {
        for (const amp of [0.5, 1]) {
          const car = createCar(b.cx * CELL + CELL / 2, b.cz * CELL, 0, b.y0);
          car.vz = v0;
          for (let i = 0; i < 12 * 120 && car.z < b.cz * CELL + 15 * CELL; i++) {
            const steer = (Math.floor((2 * i) / (120 * period)) % 2 === 0 ? 1 : -1) * amp;
            stepCar(car, makeInput(steer, 1, 0), world);
            expect(Number.isFinite(car.x + car.y + car.z)).toBe(true);
            worst = Math.max(worst, Math.hypot(car.vx, car.vz));
          }
        }
      }
    }
    expect(worst).toBeLessThan(64);
  });

  it("la pompe parfaite ne passe pas la borne `shellGainTop` de plus de 6 %", () => {
    let best = 0;
    for (const A of [5, 6, 7]) for (const lam of [96, 128, 160]) best = Math.max(best, pass(6, 30, pump(A, lam)).vmax);
    expect(best).toBeLessThan(P.shellGainTop * 1.06);
  });
});

describe("le pilote d'auteur choisit la paroi", () => {
  it("sur au moins la moitié des circuits Stade et Nuit à cuve des 40 premiers jours, la paroi est la ligne la plus rapide", () => {
    const first = daysFromCivil(2026, 10, 6);
    let withCuve = 0;
    let onWall = 0;
    // Stade et Nuit seulement : au Canyon (lot 22) la paroi précède un saut, le pilote d'auteur garde le fond pour s'aligner sur la rampe.
    for (let d = 0; d < 40; d++) {
      const c = dailyCircuit(first + d);
      if (c.theme !== "stade" && c.theme !== "nuit") continue;
      if (!c.track.blocks.some((b) => b.cuve)) continue;
      withCuve++;
      if (bestPilotRun(c.track)?.wall) onWall++;
    }
    expect(withCuve).toBeGreaterThan(8);
    // Au moins la moitié : le tirage est petit (10 circuits), et le relevé adouci (lot 24) a fait passer un circuit de la paroi au fond (6/10 → 5/10).
    expect(onWall / withCuve).toBeGreaterThanOrEqual(0.5);
  }, 240_000);
});
