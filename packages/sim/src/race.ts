import { TICK_RATE } from "./constants";
import { AXIS_MAX, DEFAULT_CAR_PARAMS, NO_INPUT, copyCar, createCar, forwardSpeed, stepCar, type CarInput, type CarParams, type CarState } from "./car";
import type { Gate, Track } from "./track";
import { trackWorld, type ShellHit, type World } from "./world";

/**
 * Chute (lot 17) : sous `track.voidY` la voiture est perdue ; elle continue de tomber, sans commande, pendant ce délai
 * (0,5 s, soit ≈ 1 s depuis qu'elle a quitté la route), puis reprend au dernier point de contrôle. Le chrono ne s'arrête pas.
 */
export const FALL_TICKS = TICK_RATE / 2;

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
  /** Pas écoulés depuis que la voiture a quitté le monde par le bas (0 = elle roule) ; la reprise a lieu à `FALL_TICKS`. */
  fallTicks: number;
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
    fallTicks: 0,
    checkpoints: [],
    params,
  };
}

/** Le même monde sans plaques, turbo ni moteur coupé (la voiture qui s'arrête après l'arrivée). */
function withoutEffects(world: World): World {
  return {
    voidY: world.voidY,
    sample(x, z, out) {
      world.sample(x, z, out);
      out.boost = false;
      out.turbo = false;
      out.cut = false;
    },
    collide: (x, z, y, radius, out) => world.collide(x, z, y, radius, out),
    ...(world.shell ? { shell: (x: number, z: number, y: number, out: ShellHit) => world.shell!(x, z, y, out) } : {}),
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
    car.turbo = 0;
    car.drift = 0;
  } else {
    const s = race.track.spawn;
    copyCar(createCar(s.x, s.z, s.yaw, s.y), car);
  }
  car.tick = tick + 1; // le chrono continue de tourner
  race.respawns += 1;
  race.fallTicks = 0;
}

/** Temps (ms) auquel la voiture a franchi la porte pendant le pas qui vient de s'achever. */
function crossingTime(race: RaceState, gate: Gate, px: number, pz: number): number {
  const car = race.car;
  const s0 = (px - gate.x) * gate.fx + (pz - gate.z) * gate.fz;
  const s1 = (car.x - gate.x) * gate.fx + (car.z - gate.z) * gate.fz;
  if (!(s0 < 0 && s1 >= 0)) return -1;
  const lateral = (car.x - gate.x) * gate.fz - (car.z - gate.z) * gate.fx;
  const reach = gate.halfWidth + 2;
  if (lateral > reach || lateral < -reach) return -1;
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
  if (race.fallTicks > 0) {
    // Perdue : elle tombe sans rien commander (rien ne la ramène avant le délai, sauf une reprise volontaire ci-dessus).
    stepCar(car, NO_INPUT, race.world, race.params);
    race.fallTicks += 1;
    if (race.fallTicks >= FALL_TICKS) respawn(race);
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
      car.cut = 0; // le point de contrôle rend le moteur (et la reprise repart donc moteur rendu)
      if (gate.kind === "finish") {
        race.finishMs = t;
        race.world = withoutEffects(race.world); // après la ligne, une plaque ne doit plus relancer la voiture à l'arrêt
        car.boost = 0;
        car.turbo = 0;
      }
      else {
        race.splits.push(t);
        const snapshot = createCar();
        copyCar(car, snapshot);
        race.checkpoints.push(snapshot);
      }
    }
  }
  if (car.y < race.world.voidY) race.fallTicks = 1;
}

/** Durée écoulée, en ms (pour l'affichage du chrono en cours de course). */
export function raceElapsedMs(race: RaceState): number {
  return race.finishMs >= 0 ? race.finishMs : Math.round((race.car.tick * 1000) / TICK_RATE);
}

