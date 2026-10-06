import { TICK_RATE } from "./constants";
import { makeInput, type CarInput } from "./car";
import { clamp, cos, sin } from "./math";
import { createRace, stepRace, type RaceState } from "./race";
import { ReplayRecorder, type Replay } from "./replay";
import { isCurve, trackCenterline, type Track } from "./track";

// Pilote automatique : suit la ligne médiane du circuit (poursuite de point) et ralentit avant les virages.
// Il sert à valider un circuit généré (« est-il finissable ? ») et donne le temps de l'auteur. Il n'utilise que
// les opérations déterministes de la simulation : mêmes décisions dans tous les navigateurs et sur le serveur.

export interface AutopilotOptions {
  /** Vitesse (m/s) tenue dans les virages. */
  curveSpeed?: number;
  /** Anticipation du point visé : `6 + look × vitesse` mètres. */
  look?: number;
}

export function createAutopilot(track: Track, opts: AutopilotOptions = {}) {
  const line = trackCenterline(track);
  const n = line.x.length;
  const curveSpeed = opts.curveSpeed ?? 24;
  const look = opts.look ?? 0.4;
  let idx = 0;

  return function drive(race: RaceState): CarInput {
    const car = race.car;
    // Point le plus proche sur la ligne, en n'avançant que dans le sens du circuit.
    let best = idx;
    let bestD = Infinity;
    for (let i = idx; i < Math.min(n, idx + 12); i++) {
      const dx = line.x[i]! - car.x;
      const dz = line.z[i]! - car.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    idx = best;
    const speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);

    // Point visé : à une distance d'anticipation le long de la ligne.
    const ahead = 6 + look * speed;
    let j = idx;
    let acc = 0;
    while (j < n - 1 && acc < ahead) {
      const sx = line.x[j + 1]! - line.x[j]!;
      const sz = line.z[j + 1]! - line.z[j]!;
      acc += Math.sqrt(sx * sx + sz * sz);
      j++;
    }
    const tx = line.x[j]! - car.x;
    const tz = line.z[j]! - car.z;
    const dist = Math.sqrt(tx * tx + tz * tz);
    const fx = sin(car.yaw);
    const fz = cos(car.yaw);
    const leftDot = tx * fz - tz * fx; // > 0 : la cible est à gauche
    const fwdDot = tx * fx + tz * fz;
    let steer = 0;
    if (dist > 1e-6) {
      // sin(erreur d'angle) ≈ erreur d'angle : pas besoin d'arctangente. Cible derrière : braquage à fond.
      steer = fwdDot <= 0 ? (leftDot > 0 ? -1 : 1) : clamp((-leftDot / dist) * 2.2, -1, 1);
    }

    // Vitesse : plein gaz, sauf dans un virage et juste avant (un ou deux blocs plus loin).
    const cur = line.block[idx]!;
    const inCurve = isCurve(track.blocks[cur]!.kind);
    const curveSoon = [1, 2].some((k) => track.blocks[cur + k] && isCurve(track.blocks[cur + k]!.kind));
    const brake = inCurve ? speed > curveSpeed + 1 : curveSoon && speed > curveSpeed + 10;
    const throttle = !brake && (!inCurve || speed < curveSpeed);
    return makeInput(steer, throttle ? 1 : 0, brake ? 1 : 0);
  };
}

export interface PilotRun {
  /** Vrai si le pilote franchit l'arrivée sans tomber ni reprendre. */
  valid: boolean;
  finishMs: number;
  ticks: number;
  respawns: number;
  replay: Replay;
}

/** Fait rouler un pilote jusqu'à l'arrivée (ou `maxSeconds`, ou jusqu'à ce qu'il soit bloqué). */
export function runPilot(track: Track, opts: AutopilotOptions = {}, maxSeconds = 120): PilotRun {
  const race = createRace(track);
  const drive = createAutopilot(track, opts);
  const recorder = new ReplayRecorder();
  const maxTicks = maxSeconds * TICK_RATE;
  let ticks = 0;
  let stuck = 0;
  while (race.finishMs < 0 && ticks < maxTicks && race.respawns === 0) {
    const input = drive(race);
    recorder.record(input);
    stepRace(race, input);
    ticks++;
    // Bloqué : presque à l'arrêt pendant 3 s après le départ.
    const v2 = race.car.vx * race.car.vx + race.car.vz * race.car.vz;
    stuck = v2 < 0.25 && ticks > 2 * TICK_RATE ? stuck + 1 : 0;
    if (stuck > 3 * TICK_RATE) break;
  }
  return {
    valid: race.finishMs >= 0 && race.respawns === 0,
    finishMs: race.finishMs,
    ticks,
    respawns: race.respawns,
    replay: recorder.toReplay(track.id),
  };
}

/** Vitesses de virage essayées : le temps de l'auteur est celui de la meilleure course valide. */
export const PILOT_CURVE_SPEEDS = [30, 26, 22, 18] as const;

/** La meilleure course valide parmi plusieurs réglages du pilote, ou `null` si aucun ne finit le circuit. */
export function bestPilotRun(track: Track): PilotRun | null {
  let best: PilotRun | null = null;
  for (const curveSpeed of PILOT_CURVE_SPEEDS) {
    const run = runPilot(track, { curveSpeed });
    if (run.valid && (!best || run.finishMs < best.finishMs)) best = run;
  }
  return best;
}
