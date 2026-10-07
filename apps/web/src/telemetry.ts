import {
  AXLE_FRONT,
  AXLE_REAR,
  COLLIDER_OFFSET,
  COLLIDER_RADIUS,
  HALF_TRACK,
  carSpeed,
  createSurface,
  createWallHit,
  forwardSpeed,
  type CarState,
  type SurfaceKind,
  type World,
} from "@cdj/sim";

// Télémétrie du rendu : tout ce que les effets, les sons et les roues ont besoin de savoir de la voiture, **lu** dans son
// état et dans le monde, jamais écrit : aucune fonction d'ici ne modifie la voiture, et `world.sample` / `world.collide`
// sont des lectures pures. Le résultat d'une course ne peut pas en dépendre (tests golden inchangés).

export interface WheelTelemetry {
  /** Position du monde (x, z) et hauteur du sol sous la roue (`NO_GROUND` : vide). */
  x: number;
  z: number;
  ground: number;
  surface: SurfaceKind;
}

export interface Telemetry {
  speed: number;
  /** Vitesse le long du cap (négative en marche arrière). */
  forward: number;
  /** Dérive : vitesse latérale ÷ vitesse (≈ tangente de l'angle de dérive, signée : positive vers la gauche). */
  slide: number;
  grounded: boolean;
  /** Avant gauche, avant droit, arrière gauche, arrière droit. */
  wheels: WheelTelemetry[];
  /** Contact avec un rebord : point de contact et normale (vers l'intérieur de la route), ou `null`. */
  wall: { x: number; z: number; nx: number; nz: number } | null;
  /** Revêtement sous la voiture. */
  surface: SurfaceKind;
}

const WHEEL_F = [AXLE_FRONT, AXLE_FRONT, -AXLE_REAR, -AXLE_REAR] as const;
const WHEEL_L = [HALF_TRACK, -HALF_TRACK, HALF_TRACK, -HALF_TRACK] as const;

export function createTelemetry(): Telemetry {
  return {
    speed: 0,
    forward: 0,
    slide: 0,
    grounded: true,
    wheels: [0, 1, 2, 3].map(() => ({ x: 0, z: 0, ground: 0, surface: "road" as SurfaceKind })),
    wall: null,
    surface: "road",
  };
}

/** Dérive (vitesse latérale ÷ vitesse) d'un état de voiture : pure. */
export function slideOf(car: Pick<CarState, "vx" | "vz" | "yaw">): number {
  const v = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
  if (v < 0.5) return 0;
  return (car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw)) / v;
}

const sample = createSurface();
const hit = createWallHit();

/** Remplit `out` pour la voiture `car` dans `world` (lecture seule). */
export function readTelemetry(car: CarState, world: World, out: Telemetry): Telemetry {
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const lx = fz;
  const lz = -fx;
  out.speed = carSpeed(car);
  out.forward = forwardSpeed(car);
  out.slide = slideOf(car);
  out.grounded = car.grounded === 1;
  for (let i = 0; i < 4; i++) {
    const w = out.wheels[i]!;
    w.x = car.x + WHEEL_F[i]! * fx + WHEEL_L[i]! * lx;
    w.z = car.z + WHEEL_F[i]! * fz + WHEEL_L[i]! * lz;
    world.sample(w.x, w.z, sample);
    w.ground = sample.height;
    w.surface = sample.kind;
  }
  world.sample(car.x, car.z, sample);
  out.surface = sample.kind;
  // Contact avec un rebord : les deux disques de la caisse, comme la simulation, un peu agrandis (on voit le frôlement).
  out.wall = null;
  for (const off of [COLLIDER_OFFSET, -COLLIDER_OFFSET]) {
    const cx = car.x + off * fx;
    const cz = car.z + off * fz;
    if (world.collide(cx, cz, car.y, COLLIDER_RADIUS + 0.12, hit)) {
      out.wall = { x: cx - hit.nx * (COLLIDER_RADIUS + 0.1), z: cz - hit.nz * (COLLIDER_RADIUS + 0.1), nx: hit.nx, nz: hit.nz };
      break;
    }
  }
  return out;
}
