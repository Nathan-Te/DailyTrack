import { DT } from "./constants";
import { PI, TWO_PI, clamp, cos, sin } from "./math";
import { FLAT_WORLD, createSurface, createWallHit, type World } from "./world";

/** Valeur maximale (en valeur absolue) d'un axe de commande entier. */
export const AXIS_MAX = 64;

/**
 * Commandes d'un pas de simulation, en entiers : c'est ce qu'on enregistre pour une rediffusion.
 * `steer` ∈ [-64, 64] (positif = à droite), `throttle` et `brake` ∈ [0, 64],
 * `respawn` ∈ {0, 1} (recommencer au dernier point de contrôle ; géré par la course, pas par la voiture).
 */
export interface CarInput {
  steer: number;
  throttle: number;
  brake: number;
  respawn: number;
}

/** Quantifie des axes flottants (steer ∈ [-1, 1], throttle/brake ∈ [0, 1]) en commandes entières. */
export function makeInput(steer: number, throttle: number, brake: number, respawn = false): CarInput {
  return {
    steer: Math.round(clamp(steer, -1, 1) * AXIS_MAX),
    throttle: Math.round(clamp(throttle, 0, 1) * AXIS_MAX),
    brake: Math.round(clamp(brake, 0, 1) * AXIS_MAX),
    respawn: respawn ? 1 : 0,
  };
}

export const NO_INPUT: CarInput = { steer: 0, throttle: 0, brake: 0, respawn: 0 };

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
  radius: 1, // rayon du disque de collision avec les rebords
  wallBounce: 0.15, // rebond contre un rebord
  wallFriction: 0.998, // vitesse conservée à chaque pas de contact avec un rebord
  gravity: 20, // m/s² (arcade : un peu plus que la vraie pour des sauts nerveux)
  slopeGravity: 10, // m/s² par unité de pente : la voiture ralentit en montée, accélère en descente
  groundEps: 0.02, // m : sous ce seuil, on reste collé au sol
  stepUp: 0.6, // m : une marche plus haute est un mur
  boostTicks: 108, // 0,9 s d'accélération après une plaque
  boostAccel: 30, // m/s²
  boostMaxSpeed: 58, // m/s
  overspeedDrag: 14, // m/s² : retour à la vitesse max une fois la plaque épuisée
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
  /** Hauteur et vitesse verticale. */
  y: number;
  vy: number;
  /** 1 si les roues touchent le sol, 0 en vol. */
  grounded: number;
  /** Pas restants d'accélération de plaque. */
  boost: number;
}

export function createCar(x = 0, z = 0, yaw = 0, y = 0): CarState {
  return { x, z, yaw, vx: 0, vz: 0, steer: 0, tick: 0, y, vy: 0, grounded: 1, boost: 0 };
}

export function copyCar(from: CarState, to: CarState): void {
  to.x = from.x;
  to.z = from.z;
  to.yaw = from.yaw;
  to.vx = from.vx;
  to.vz = from.vz;
  to.steer = from.steer;
  to.tick = from.tick;
  to.y = from.y;
  to.vy = from.vy;
  to.grounded = from.grounded;
  to.boost = from.boost;
}

/** Vitesse de la voiture, en m/s. */
export function carSpeed(car: CarState): number {
  return Math.sqrt(car.vx * car.vx + car.vz * car.vz);
}

const surface = createSurface();
const wall = createWallHit();

/** Avance la voiture d'un pas fixe (`DT`) dans `world`. Modifie `car` en place. */
export function stepCar(car: CarState, input: CarInput, world: World = FLAT_WORLD): void {
  // Braquage lissé vers la consigne (clavier : tout ou rien, la voiture ne pivote pas d'un coup).
  const target = clamp(input.steer, -AXIS_MAX, AXIS_MAX) / AXIS_MAX;
  const growing = target * car.steer >= 0 && Math.abs(target) > Math.abs(car.steer);
  const steerStep = (growing ? CAR.steerIn : CAR.steerOut) * DT;
  car.steer += clamp(target - car.steer, -steerStep, steerStep);

  const prevX = car.x;
  const prevZ = car.z;

  if (car.grounded) {
    world.sample(car.x, car.z, surface);
    if (surface.boost) car.boost = CAR.boostTicks;
    const maxSpeed = car.boost > 0 ? CAR.boostMaxSpeed : CAR.maxSpeed;

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
      else vF += CAR.accel * throttle * clamp(1 - vF / maxSpeed, 0, 1) * DT;
    }
    if (brake > 0) {
      if (vF > 0) vF = Math.max(0, vF - CAR.brake * brake * DT);
      else vF = Math.max(-CAR.reverseMax, vF - CAR.reverseAccel * brake * DT);
    }
    if (throttle === 0 && brake === 0) {
      const drag = CAR.coast * DT;
      vF = vF > drag ? vF - drag : vF < -drag ? vF + drag : 0;
    }

    // Pente : on ralentit en montant, on accélère en descendant.
    vF -= CAR.slopeGravity * (surface.gx * fx + surface.gz * fz) * DT;

    // Plaque d'accélération, puis retour progressif à la vitesse max.
    if (car.boost > 0) {
      vF += CAR.boostAccel * DT;
      car.boost -= 1;
    }
    if (vF > maxSpeed) vF = Math.max(maxSpeed, vF - CAR.overspeedDrag * DT);

    // Adhérence : le glissement latéral s'estompe.
    vL -= vL * Math.min(1, CAR.grip * DT);

    car.vx = fx * vF + lx * vL;
    car.vz = fz * vF + lz * vL;
  }

  car.x += car.vx * DT;
  car.z += car.vz * DT;

  // Rebords : la voiture glisse le long du rebord au lieu de le traverser.
  if (world.collide(car.x, car.z, car.y, CAR.radius, wall)) {
    car.x += wall.nx * wall.depth;
    car.z += wall.nz * wall.depth;
    const vn = car.vx * wall.nx + car.vz * wall.nz;
    if (vn < 0) {
      car.vx -= (1 + CAR.wallBounce) * vn * wall.nx;
      car.vz -= (1 + CAR.wallBounce) * vn * wall.nz;
    }
    car.vx *= CAR.wallFriction;
    car.vz *= CAR.wallFriction;
  }

  // Vertical : on suit le sol tant qu'une trajectoire balistique ne s'en écarte pas, sinon c'est un vol.
  world.sample(car.x, car.z, surface);
  const ground = surface.height;
  const half = 0.5 * CAR.gravity * DT * DT;
  if (car.grounded) {
    if (ground - car.y > CAR.stepUp) {
      // Une marche trop haute (l'arrière d'un tremplin) : c'est un mur.
      car.x = prevX;
      car.z = prevZ;
      car.vx = 0;
      car.vz = 0;
    } else {
      const free = car.y + car.vy * DT - half;
      if (free > ground + CAR.groundEps) {
        car.y = free;
        car.vy -= CAR.gravity * DT;
        car.grounded = 0;
      } else {
        // Collé au sol : la vitesse verticale suit la pente (jamais une différence de hauteur divisée par DT,
        // qui exploserait au moindre à-coup).
        car.vy = surface.gx * car.vx + surface.gz * car.vz;
        car.y = ground;
      }
    }
  } else {
    const next = car.y + car.vy * DT - half;
    car.vy -= CAR.gravity * DT;
    if (next <= ground) {
      // Atterrissage : on repart en suivant la pente du sol, sans rebond.
      car.y = ground;
      car.vy = surface.gx * car.vx + surface.gz * car.vz;
      car.grounded = 1;
    } else {
      car.y = next;
    }
  }

  car.tick += 1;
}
