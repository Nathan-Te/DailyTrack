import { NO_GROUND, createSurface, type CarParams, type CarState, type World } from "@cdj/sim";

// Ombre d'atterrissage (lot 17) : en l'air au-dessus d'un vide, l'ombre de la voiture n'a pas de sol sous elle. On prolonge donc
// sa trajectoire (balistique pure, lecture seule du monde : rien n'est écrit dans `sim`) jusqu'au premier sol rencontré, et
// l'ombre se pose là : si elle tombe sur la réception, on passe ; si elle n'a nulle part où se poser, c'est la chute.

export interface Landing {
  x: number;
  y: number;
  z: number;
  /** Temps avant la réception (s). */
  t: number;
}

const STEP = 1 / 30;
const HORIZON = 4;
const surf = createSurface();

/** Point de réception prévu d'une voiture en vol, ou `null` (elle tombe, ou n'a pas de sol à portée avant `HORIZON` secondes). */
export function predictLanding(world: World, car: Pick<CarState, "x" | "y" | "z" | "vx" | "vy" | "vz">, params: Pick<CarParams, "gravity">): Landing | null {
  let prevAbove = false;
  let px = car.x;
  let py = car.y;
  let pz = car.z;
  for (let t = STEP; t <= HORIZON; t += STEP) {
    const x = car.x + car.vx * t;
    const z = car.z + car.vz * t;
    const y = car.y + car.vy * t - 0.5 * params.gravity * t * t;
    world.sample(x, z, surf);
    const ground = surf.height;
    if (ground > NO_GROUND / 2) {
      if (y <= ground) {
        // Le sol est traversé entre le point précédent et celui-ci : interpolation sur la hauteur.
        const above = prevAbove ? py - groundAt(world, px, pz) : 0;
        const below = ground - y;
        const f = above + below > 0 ? above / (above + below) : 1;
        return { x: px + (x - px) * f, y: ground, z: pz + (z - pz) * f, t: t - STEP + STEP * f };
      }
      prevAbove = true;
    } else {
      prevAbove = false;
    }
    px = x;
    py = y;
    pz = z;
    if (y < world.voidY) return null;
  }
  return null;
}

function groundAt(world: World, x: number, z: number): number {
  world.sample(x, z, surf);
  return surf.height > NO_GROUND / 2 ? surf.height : -Infinity;
}
