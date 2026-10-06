import { DT } from "./constants";
import { PI, TWO_PI, clamp, cos, sin } from "./math";

/** Valeur maximale (en valeur absolue) d'un axe de commande entier. */
export const AXIS_MAX = 64;

/**
 * Commandes d'un pas de simulation, en entiers : c'est ce qu'on enregistre pour une rediffusion.
 * `steer` ∈ [-64, 64] (positif = à droite), `throttle` et `brake` ∈ [0, 64].
 */
export interface CarInput {
  steer: number;
  throttle: number;
  brake: number;
}

/** Quantifie des axes flottants (steer ∈ [-1, 1], throttle/brake ∈ [0, 1]) en commandes entières. */
export function makeInput(steer: number, throttle: number, brake: number): CarInput {
  return {
    steer: Math.round(clamp(steer, -1, 1) * AXIS_MAX),
    throttle: Math.round(clamp(throttle, 0, 1) * AXIS_MAX),
    brake: Math.round(clamp(brake, 0, 1) * AXIS_MAX),
  };
}

export const NO_INPUT: CarInput = { steer: 0, throttle: 0, brake: 0 };

/** Réglages de la voiture (mètres, secondes). */
export const CAR = {
  maxSpeed: 42, // m/s (≈ 150 km/h)
  accel: 24, // m/s² à vitesse nulle, décroît vers maxSpeed
  brake: 48, // m/s²
  reverseAccel: 14,
  reverseMax: 12,
  coast: 4, // décélération quand on lâche tout
  turnRate: 2.3, // rad/s à basse vitesse
  turnRateAtMax: 1.15, // rad/s à vitesse max
  turnMinSpeed: 4, // sous cette vitesse, la rotation est réduite proportionnellement
  grip: 9, // 1/s : vitesse à laquelle le glissement latéral disparaît
  steerIn: 7, // 1/s : le volant va vers la consigne
  steerOut: 10, // 1/s : le volant revient au centre
} as const;

export interface CarState {
  x: number;
  z: number;
  /** Cap en radians, 0 = vers +z, positif = vers la gauche (sens trigonométrique vu de dessus). */
  yaw: number;
  vx: number;
  vz: number;
  /** Braquage lissé ∈ [-1, 1], positif = à droite. */
  steer: number;
  tick: number;
}

export function createCar(x = 0, z = 0, yaw = 0): CarState {
  return { x, z, yaw, vx: 0, vz: 0, steer: 0, tick: 0 };
}

export function copyCar(from: CarState, to: CarState): void {
  to.x = from.x;
  to.z = from.z;
  to.yaw = from.yaw;
  to.vx = from.vx;
  to.vz = from.vz;
  to.steer = from.steer;
  to.tick = from.tick;
}

/** Vitesse de la voiture, en m/s. */
export function carSpeed(car: CarState): number {
  return Math.sqrt(car.vx * car.vx + car.vz * car.vz);
}

/** Avance la voiture d'un pas fixe (`DT`). Modifie `car` en place. */
export function stepCar(car: CarState, input: CarInput): void {
  // Braquage lissé vers la consigne (clavier : tout ou rien, la voiture ne pivote pas d'un coup).
  const target = clamp(input.steer, -AXIS_MAX, AXIS_MAX) / AXIS_MAX;
  const growing = target * car.steer >= 0 && Math.abs(target) > Math.abs(car.steer);
  const steerStep = (growing ? CAR.steerIn : CAR.steerOut) * DT;
  car.steer += clamp(target - car.steer, -steerStep, steerStep);

  // Vitesse le long du cap actuel, pour savoir si l'on avance ou recule.
  let fx = sin(car.yaw);
  let fz = cos(car.yaw);
  let vF = car.vx * fx + car.vz * fz;

  // Rotation : moins vive à haute vitesse, nulle à l'arrêt, inversée en marche arrière.
  const ratio = clamp(Math.abs(vF) / CAR.maxSpeed, 0, 1);
  const lowSpeed = clamp(Math.abs(vF) / CAR.turnMinSpeed, 0, 1);
  const rate = CAR.turnRate + (CAR.turnRateAtMax - CAR.turnRate) * ratio;
  const direction = vF < 0 ? -1 : 1;
  let yaw = car.yaw - car.steer * rate * lowSpeed * direction * DT;
  if (yaw > PI) yaw -= TWO_PI;
  else if (yaw < -PI) yaw += TWO_PI;
  car.yaw = yaw;

  // Repère de la voiture après rotation : la vitesse du monde y est décomposée en avant/latéral.
  fx = sin(yaw);
  fz = cos(yaw);
  const lx = fz; // gauche = (cos ψ, −sin ψ)
  const lz = -fx;
  vF = car.vx * fx + car.vz * fz;
  let vL = car.vx * lx + car.vz * lz;

  const throttle = clamp(input.throttle, 0, AXIS_MAX) / AXIS_MAX;
  const brake = clamp(input.brake, 0, AXIS_MAX) / AXIS_MAX;

  if (throttle > 0) {
    if (vF < 0) vF = Math.min(0, vF + CAR.brake * throttle * DT);
    else vF += CAR.accel * throttle * clamp(1 - vF / CAR.maxSpeed, 0, 1) * DT;
  }
  if (brake > 0) {
    if (vF > 0) vF = Math.max(0, vF - CAR.brake * brake * DT);
    else vF = Math.max(-CAR.reverseMax, vF - CAR.reverseAccel * brake * DT);
  }
  if (throttle === 0 && brake === 0) {
    const drag = CAR.coast * DT;
    vF = vF > drag ? vF - drag : vF < -drag ? vF + drag : 0;
  }

  // Adhérence : le glissement latéral s'estompe.
  vL -= vL * Math.min(1, CAR.grip * DT);

  car.vx = fx * vF + lx * vL;
  car.vz = fz * vF + lz * vL;
  car.x += car.vx * DT;
  car.z += car.vz * DT;
  car.tick += 1;
}
