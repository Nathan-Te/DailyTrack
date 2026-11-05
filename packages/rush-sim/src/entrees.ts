import { BIT_COUP, BIT_ESQUIVE, DECALAGE_VISEE, MASQUE_DIRECTION, MASQUE_VISEE, NB_DIRECTIONS_ENTREE } from "./constantes";

// Les entrées d'un tick (lot BR0b : deux octets) : en bas, la direction du déplacement (0 = aucune, 1 à 32 = la direction 0 à 31 de la croix, tous les 11,25°), le coup (bit 6) et l'esquive (bit 7) ; en haut, la visée
// (0 = aucune, 1 à 32 = la direction 0 à 31 où le chevalier regarde). **Ce sont des états tenus** : l'esquive se déclenche sur le front montant ; le coup aussi, et **tenu il enchaîne** les trois coups en boucle.
// La simulation compare au tick d'avant. La rediffusion est la suite des changements de cette entrée.

export interface Changement {
  tick: number;
  /** L'octet d'entrée à partir de ce tick. */
  e: number;
}

export const entree = (direction: number, coup = false, esquive = false, visee = -1): number => {
  const d = direction < 0 ? 0 : (direction % NB_DIRECTIONS_ENTREE) + 1;
  const v = visee < 0 ? 0 : (visee % NB_DIRECTIONS_ENTREE) + 1;
  return d | (coup ? BIT_COUP : 0) | (esquive ? BIT_ESQUIVE : 0) | (v << DECALAGE_VISEE);
};
/** La visée (0 à 31), ou −1 sans visée. */
export const viseeDe = (e: number): number => {
  const v = (e >> DECALAGE_VISEE) & MASQUE_VISEE;
  return v === 0 || v > NB_DIRECTIONS_ENTREE ? -1 : v - 1;
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
