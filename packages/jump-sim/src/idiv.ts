/**
 * Division entière qui **tronque vers zéro** (−7 ÷ 2 = −3, comme `Math.trunc` mais exacte sur les entiers) et ne renvoie **jamais `-0`**.
 * Toute division de la simulation passe par ici : un `-0` n'est pas `Object.is` à `0`, il se glisserait dans les états comparés au bit près.
 * Calcul en entiers uniquement (`a % b` est exact), sans passer par un quotient flottant.
 */
export function idiv(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw new RangeError(`idiv attend des entiers sûrs (${a}, ${b})`);
  if (b === 0) throw new RangeError("idiv : division par zéro");
  return (a - (a % b)) / b + 0; // « + 0 » : −0 + 0 vaut +0
}
