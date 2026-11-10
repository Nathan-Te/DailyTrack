import { QUART, TOUR } from "./constantes";
import { SINUS_QUART } from "./tableSinus";

// Le sinus et le cosinus ENTIERS : un angle en 1/65 536 de tour, un résultat à l'échelle 65 536 (−65 536 à 65 536). Table d'un quart de période (257 entrées) et interpolation linéaire entière.

/** Division entière vers zéro (les quotients de la simulation tiennent bien en deçà de 2^40 : le quotient flottant est exact avant la troncature). */
export const idiv = (a: number, b: number): number => Math.trunc(a / b) + 0; // + 0 : pas de zéro négatif

const quart = (x: number): number => {
  const i = x >> 6;
  if (i >= 256) return SINUS_QUART[256]!; // l'angle d'un quart de tour exactement : pas d'entrée suivante
  const a = SINUS_QUART[i]!;
  return a + idiv((SINUS_QUART[i + 1]! - a) * (x & 63), 64);
};

/** Le sinus d'un angle (n'importe quel entier : il est ramené à un tour). */
export function sinus(angle: number): number {
  const a = ((angle % TOUR) + TOUR) % TOUR;
  const r = a & (QUART - 1);
  switch (a >> 14) {
    case 0:
      return quart(r);
    case 1:
      return quart(QUART - r);
    case 2:
      return 0 - quart(r);
    default:
      return 0 - quart(QUART - r);
  }
}
export const cosinus = (angle: number): number => sinus(angle + QUART);
