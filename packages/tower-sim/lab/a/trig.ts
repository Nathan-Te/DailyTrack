// Moteur A — trigonométrie PAR TABLE. Un angle est un entier : 2^20 « brads » par tour (≈ 6 µrad). sin/cos viennent d'un quart de sinus en 1024
// intervalles (trigTable.ts, généré une fois) et d'une interpolation linéaire entière ; erreur < 1 LSB de Q16. Aucune transcendante.
import { idiv } from "./fixe";
import { SIN_QUART } from "./trigTable";

export const TURN = 1 << 20;
export const QUARTER = TURN >> 2;
/** Brads par intervalle de la table (2^18 / 1024). */
const STEP = QUARTER >> 10;
export const BRAD_PER_RAD_NUM = 166886; // 2^20 / 2π ≈ 166 886,05
/** Radians par brad, pour l'AFFICHAGE seulement (jamais dans l'état) : 2π / 2^20. */
export const RAD_PER_BRAD = 5.9952043329758453e-6;

/** Ramène un angle dans [0, TURN). */
export function wrap(a: number): number {
  const r = a % TURN;
  return (r < 0 ? r + TURN : r) + 0;
}

/** Sinus Q16 d'un angle déjà dans [0, QUARTER], par interpolation de la table. */
function sinQuart(a: number): number {
  const i = Math.floor(a / STEP);
  const f = a - i * STEP;
  const s0 = SIN_QUART[i]!;
  if (f === 0) return s0;
  const s1 = SIN_QUART[i + 1]!;
  return s0 + idiv((s1 - s0) * f, STEP);
}

export function sin(angle: number): number {
  const a = wrap(angle);
  if (a <= QUARTER) return sinQuart(a);
  if (a <= 2 * QUARTER) return sinQuart(2 * QUARTER - a);
  if (a <= 3 * QUARTER) return -sinQuart(a - 2 * QUARTER) + 0; // + 0 : jamais -0
  return -sinQuart(TURN - a) + 0;
}

export function cos(angle: number): number {
  return sin(angle + QUARTER);
}
