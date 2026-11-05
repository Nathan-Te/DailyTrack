import { BIT_COUP, BIT_ESQUIVE, MASQUE_DIRECTION, NB_DIRECTIONS_ENTREE } from "./constantes";

// Les entrées d'un tick tiennent dans un octet : la direction (0 = aucune, 1 à 32 = la direction 0 à 31 de la croix, tous les 11,25°), le coup (bit 6) et l'esquive (bit 7). **Ce sont des états tenus** :
// le coup et l'esquive se déclenchent sur le front montant, la simulation les compare au tick d'avant. La rediffusion est la suite des changements de cet octet.

export interface Changement {
  tick: number;
  /** L'octet d'entrée à partir de ce tick. */
  e: number;
}

export const entree = (direction: number, coup = false, esquive = false): number => {
  const d = direction < 0 ? 0 : (direction % NB_DIRECTIONS_ENTREE) + 1;
  return d | (coup ? BIT_COUP : 0) | (esquive ? BIT_ESQUIVE : 0);
};
/** La direction de la croix (0 à 31), ou −1 sans direction. */
export const directionDe = (e: number): number => ((e & MASQUE_DIRECTION) === 0 || (e & MASQUE_DIRECTION) > NB_DIRECTIONS_ENTREE ? -1 : (e & MASQUE_DIRECTION) - 1);
export const coupDe = (e: number): boolean => (e & BIT_COUP) !== 0;
export const esquiveDe = (e: number): boolean => (e & BIT_ESQUIVE) !== 0;

/** L'octet d'entrée valable à `tick` dans une suite de changements triée (l'octet en vigueur : le dernier changement à `tick` ou avant). */
export function entreeAu(changements: readonly Changement[], tick: number, depuis = 0): number {
  let e = 0;
  for (let i = depuis; i < changements.length && changements[i]!.tick <= tick; i++) e = changements[i]!.e;
  return e;
}
