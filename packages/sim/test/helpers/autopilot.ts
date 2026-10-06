import {
  TICK_RATE,
  ReplayRecorder,
  createAutopilot,
  createRace,
  stepRace,
  type AutopilotOptions,
  type RaceState,
  type Track,
} from "../../src/index";

// Enveloppes de test autour du pilote de `src/autopilot.ts` : elles gardent trace de l'état de la course
// (temps en l'air, vitesse maximale) ou des commandes enregistrées.
export { createAutopilot };

export interface AutoRun {
  race: RaceState;
  ticks: number;
  airTicks: number;
  maxSpeed: number;
}

/** Fait rouler le pilote jusqu'à l'arrivée (ou `maxSeconds`). */
export function runAutopilot(track: Track, maxSeconds = 120, opts?: AutopilotOptions): AutoRun {
  const race = createRace(track);
  const drive = createAutopilot(track, opts);
  let ticks = 0;
  let airTicks = 0;
  let maxSpeed = 0;
  while (race.finishMs < 0 && ticks < maxSeconds * TICK_RATE) {
    stepRace(race, drive(race));
    ticks++;
    if (!race.car.grounded) airTicks++;
    maxSpeed = Math.max(maxSpeed, Math.sqrt(race.car.vx * race.car.vx + race.car.vz * race.car.vz));
  }
  return { race, ticks, airTicks, maxSpeed };
}

/** Comme `runAutopilot`, en enregistrant les commandes appliquées (pour fabriquer des rediffusions de test). */
export function recordAutopilot(track: Track, maxSeconds = 120, opts?: AutopilotOptions) {
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
