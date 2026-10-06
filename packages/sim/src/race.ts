import { TICK_RATE } from "./constants";
import { AXIS_MAX, DEFAULT_CAR_PARAMS, NO_INPUT, copyCar, createCar, forwardSpeed, stepCar, type CarInput, type CarParams, type CarState } from "./car";
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
  /** État de la voiture au passage de chaque point de contrôle : la reprise repart avec cette vitesse et ce cap. */
  checkpoints: CarState[];
  /** Réglages de la voiture (par défaut : ceux du classement ; le panneau `?tune` en passe d'autres). */
  params: Readonly<CarParams>;
}

export function createRace(track: Track, params: Readonly<CarParams> = DEFAULT_CAR_PARAMS): RaceState {
  const s = track.spawn;
  return {
    car: createCar(s.x, s.z, s.yaw, s.y),
    track,
    world: trackWorld(track),
    nextGate: 0,
    splits: [],
    finishMs: -1,
    respawns: 0,
    checkpoints: [],
    params,
  };
}

const FINISH_BRAKE: CarInput = { steer: 0, throttle: 0, brake: AXIS_MAX, respawn: 0 };

/**
 * Reprise : au dernier point de contrôle franchi, avec la vitesse et le cap du passage (comme si on venait de
 * le franchir) ; sans point de contrôle franchi, au départ, à l'arrêt.
 */
function respawn(race: RaceState): void {
  const car = race.car;
  const tick = car.tick;
  const saved = race.checkpoints[race.checkpoints.length - 1];
  if (saved) {
    copyCar(saved, car);
    car.boost = 0;
    car.drift = 0;
  } else {
    const s = race.track.spawn;
    copyCar(createCar(s.x, s.z, s.yaw, s.y), car);
  }
  car.tick = tick + 1; // le chrono continue de tourner
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
    // La voiture s'arrête après la ligne (frein tant qu'elle avance, puis plus rien : elle ne recule pas).
    stepCar(car, forwardSpeed(car) > 0.5 ? FINISH_BRAKE : NO_INPUT, race.world, race.params);
    return;
  }
  if (input.respawn) {
    respawn(race);
    return;
  }

  const px = car.x;
  const pz = car.z;
  stepCar(car, input, race.world, race.params);

  const gate = race.track.gates[race.nextGate];
  if (gate) {
    const t = crossingTime(race, gate, px, pz);
    if (t >= 0) {
      race.nextGate += 1;
      if (gate.kind === "finish") race.finishMs = t;
      else {
        race.splits.push(t);
        const snapshot = createCar();
        copyCar(car, snapshot);
        race.checkpoints.push(snapshot);
      }
    }
  }
  if (car.y < race.world.voidY) respawn(race);
}

/** Durée écoulée, en ms (pour l'affichage du chrono en cours de course). */
export function raceElapsedMs(race: RaceState): number {
  return race.finishMs >= 0 ? race.finishMs : Math.round((race.car.tick * 1000) / TICK_RATE);
}

