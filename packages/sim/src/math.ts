// Maths déterministes : uniquement +, -, *, / et Math.round/abs/min/max, dont le résultat est
// exact (IEEE 754) dans tous les moteurs JS. Pas de Math.sin/cos/exp/pow, qui peuvent différer
// d'un navigateur à l'autre (voir docs/seed.md § 7).

export const PI = 3.141592653589793;
export const TWO_PI = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Ramène un angle dans [-π, π]. */
export function wrapAngle(a: number): number {
  return a - TWO_PI * Math.round(a / TWO_PI);
}

/** Sinus par série de Taylor sur [-π/2, π/2] après réduction ; erreur < 1e-14. */
export function sin(x: number): number {
  let a = wrapAngle(x);
  if (a > HALF_PI) a = PI - a;
  else if (a < -HALF_PI) a = -PI - a;
  const a2 = a * a;
  // a − a³/3! + a⁵/5! − … + a¹⁹/19! (Horner)
  let r = 1 / 121645100408832000; // 1/19!
  r = 1 / 355687428096000 - a2 * r; // 1/17!
  r = 1 / 1307674368000 - a2 * r; // 1/15!
  r = 1 / 6227020800 - a2 * r; // 1/13!
  r = 1 / 39916800 - a2 * r; // 1/11!
  r = 1 / 362880 - a2 * r; // 1/9!
  r = 1 / 5040 - a2 * r; // 1/7!
  r = 1 / 120 - a2 * r; // 1/5!
  r = 1 / 6 - a2 * r; // 1/3!
  r = 1 - a2 * r;
  return a * r;
}

export function cos(x: number): number {
  return sin(x + HALF_PI);
}
