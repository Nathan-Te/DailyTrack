import { TICK_RATE } from "./constants";
import { AXIS_MAX, createCar, stepCar, type CarInput, type CarState } from "./car";
import { HALF_ROAD, type Gate, type Track } from "./track";
import { trackWorld, type World } from "./world";

export interface RaceState {
  car: CarState;
  track: Track;
  world: World;
  /** Indice de la prochaine porte à franchir (points de contrôle puis arrivée). */
  nextGate: number;
  /** Temps intermédiaires, en ms, un par point de contrôle franchi. */
  splits: number[];
  /** Temps final en ms, ou -1 tant que la course n'est pas finie. */
  finishMs: number;
  /** Nombre de retours au point de contrôle (volontaires ou chutes). */
  respawns: number;
}

export function createRace(track: Track): RaceState {
  const s = track.spawn;
  return {
    car: createCar(s.x, s.z, s.yaw, s.y),
    track,
    world: trackWorld(track),
    nextGate: 0,
    splits: [],
    finishMs: -1,
    respawns: 0,
  };
}

export function copyRace(from: RaceState, to: RaceState): void {
  // Utilisé pour l'interpolation à l'affichage : seul l'état de la voiture compte.
  to.car.x = from.car.x;
  to.car.y = from.car.y;
  to.car.z = from.car.z;
  to.car.yaw = from.car.yaw;
  to.car.vx = from.car.vx;
  to.car.vy = from.car.vy;
  to.car.vz = from.car.vz;
  to.car.steer = from.car.steer;
  to.car.tick = from.car.tick;
  to.car.grounded = from.car.grounded;
  to.car.boost = from.car.boost;
}

const FINISH_BRAKE: CarInput = { steer: 0, throttle: 0, brake: AXIS_MAX, respawn: 0 };

/** Dernier point de reprise : le dernier point de contrôle franchi, ou le départ. */
function respawn(race: RaceState): void {
  const car = race.car;
  const lastCheckpoint = race.splits.length - 1;
  const spot = lastCheckpoint >= 0 ? race.track.gates[lastCheckpoint]! : race.track.spawn;
  car.x = spot.x;
  car.y = spot.y;
  car.z = spot.z;
  car.yaw = spot.yaw;
  car.vx = 0;
  car.vy = 0;
  car.vz = 0;
  car.steer = 0;
  car.grounded = 1;
  car.boost = 0;
  car.tick += 1; // le chrono continue de tourner
  race.respawns += 1;
}

/** Temps (ms) auquel la voiture a franchi la porte pendant le pas qui vient de s'achever. */
function crossingTime(race: RaceState, gate: Gate, px: number, pz: number): number {
  const car = race.car;
  const s0 = (px - gate.x) * gate.fx + (pz - gate.z) * gate.fz;
  const s1 = (car.x - gate.x) * gate.fx + (car.z - gate.z) * gate.fz;
  if (!(s0 < 0 && s1 >= 0)) return -1;
  const lateral = (car.x - gate.x) * gate.fz - (car.z - gate.z) * gate.fx;
  if (lateral > HALF_ROAD + 2 || lateral < -(HALF_ROAD + 2)) return -1;
  const f = s0 / (s0 - s1); // fraction du pas écoulée au moment du passage
  return Math.round(((car.tick - 1 + f) * 1000) / TICK_RATE);
}

/**
 * Avance la course d'un pas. Le chrono, c'est le nombre de pas depuis le « partez » : le temps est calculé
 * au pas près, puis affiné par interpolation au passage de la ligne, en millisecondes entières.
 */
export function stepRace(race: RaceState, input: CarInput): void {
  const car = race.car;
  if (race.finishMs >= 0) {
    stepCar(car, FINISH_BRAKE, race.world); // la voiture s'arrête après la ligne
    return;
  }
  if (input.respawn) {
    respawn(race);
    return;
  }

  const px = car.x;
  const pz = car.z;
  stepCar(car, input, race.world);

  const gate = race.track.gates[race.nextGate];
  if (gate) {
    const t = crossingTime(race, gate, px, pz);
    if (t >= 0) {
      race.nextGate += 1;
      if (gate.kind === "finish") race.finishMs = t;
      else race.splits.push(t);
    }
  }
  if (car.y < race.world.voidY) respawn(race);
}

/** Durée écoulée, en ms (pour l'affichage du chrono en cours de course). */
export function raceElapsedMs(race: RaceState): number {
  return race.finishMs >= 0 ? race.finishMs : Math.round((race.car.tick * 1000) / TICK_RATE);
}

