import {
  TICK_RATE,
  createRace,
  isCurve,
  ReplayRecorder,
  makeInput,
  stepRace,
  trackCenterline,
  type CarInput,
  type RaceState,
  type Track,
} from "../../src/index";

/**
 * Pilote de test : suit la ligne médiane (poursuite de point), ralentit avant les virages.
 * Sert à prouver qu'un circuit se termine ; le vrai pilote de validation arrive au lot 4.
 */
export function createAutopilot(track: Track, opts: { curveSpeed?: number; look?: number } = {}) {
  const line = trackCenterline(track);
  const n = line.x.length;
  const curveSpeed = opts.curveSpeed ?? 24;
  const look = opts.look ?? 0.4;
  let idx = 0;

  return function drive(race: RaceState): CarInput {
    const car = race.car;
    // Plus proche point de la ligne, en avançant seulement.
    let best = idx;
    let bestD = Infinity;
    for (let i = idx; i < Math.min(n, idx + 12); i++) {
      const d = (line.x[i]! - car.x) ** 2 + (line.z[i]! - car.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    idx = best;
    const speed = Math.hypot(car.vx, car.vz);

    // Point visé : à une distance d'anticipation le long de la ligne.
    const ahead = 6 + look * speed;
    let j = idx;
    let acc = 0;
    while (j < n - 1 && acc < ahead) {
      acc += Math.hypot(line.x[j + 1]! - line.x[j]!, line.z[j + 1]! - line.z[j]!);
      j++;
    }
    const tx = line.x[j]! - car.x;
    const tz = line.z[j]! - car.z;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const leftDot = tx * fz - tz * fx;
    const fwdDot = tx * fx + tz * fz;
    const err = Math.atan2(leftDot, fwdDot); // > 0 : la cible est à gauche
    const steer = Math.max(-1, Math.min(1, -err * 2.2));

    // Vitesse : plein gaz, sauf dans un virage et juste avant (un ou deux blocs plus loin).
    const cur = line.block[idx]!;
    const inCurve = isCurve(track.blocks[cur]!.kind);
    const curveSoon = [1, 2].some((k) => track.blocks[cur + k] && isCurve(track.blocks[cur + k]!.kind));
    const brake = inCurve ? speed > curveSpeed + 1 : curveSoon && speed > curveSpeed + 10;
    const throttle = !brake && (!inCurve || speed < curveSpeed);
    return makeInput(steer, throttle ? 1 : 0, brake ? 1 : 0);
  };
}

export interface AutoRun {
  race: RaceState;
  ticks: number;
  maxY: number;
  minY: number;
  airTicks: number;
  maxSpeed: number;
}

/** Fait rouler le pilote jusqu'à l'arrivée (ou `maxSeconds`). */
export function runAutopilot(track: Track, maxSeconds = 120, opts?: Parameters<typeof createAutopilot>[1]): AutoRun {
  const race = createRace(track);
  const drive = createAutopilot(track, opts);
  let ticks = 0;
  let maxY = -Infinity;
  let minY = Infinity;
  let airTicks = 0;
  let maxSpeed = 0;
  while (race.finishMs < 0 && ticks < maxSeconds * TICK_RATE) {
    stepRace(race, drive(race));
    ticks++;
    maxY = Math.max(maxY, race.car.y);
    minY = Math.min(minY, race.car.y);
    if (!race.car.grounded) airTicks++;
    maxSpeed = Math.max(maxSpeed, Math.hypot(race.car.vx, race.car.vz));
  }
  return { race, ticks, maxY, minY, airTicks, maxSpeed };
}

/** Comme `runAutopilot`, en enregistrant les commandes appliquées (pour fabriquer des rediffusions de test). */
export function recordAutopilot(track: Track, maxSeconds = 120, opts?: Parameters<typeof createAutopilot>[1]) {
  const race = createRace(track);
  const drive = createAutopilot(track, opts);
  const recorder = new ReplayRecorder();
  let ticks = 0;
  while (race.finishMs < 0 && ticks < maxSeconds * TICK_RATE) {
    const input = drive(race);
    recorder.record(input);
    stepRace(race, input);
    ticks++;
  }
  return { race, replay: recorder.toReplay(track.id) };
}
