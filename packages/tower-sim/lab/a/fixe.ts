// Moteur A — virgule fixe sur ENTIERS (Q16 : 65 536 = 1,0), comme `jump-sim` compte en entiers. Tout est un entier JS (un double) ; jamais de flottant dans l'état.
// Garde-fou : aucun produit ne doit dépasser 2^53. Les grandeurs ont des bornes (positions < 2^24 = 256 m, vitesses < 2^23 = 128 m/s) : un produit de deux
// grandeurs Q16 tient donc dans 2^47. `CHECK` active la vérification à chaque produit (essais seulement).

export const SHIFT = 16;
export const ONE = 1 << SHIFT;
export const HALF = ONE >> 1;
const LIMIT = 9007199254740992; // 2^53

/** Vérification des bornes (tests, mesure de marge) : activée par `setCheck(true)`, éteinte en production. */
let CHECK = false;
export function setCheck(on: boolean): void {
  CHECK = on;
}
/** Plus grand produit rencontré depuis `resetMaxProduct()` (en valeur absolue) : la marge sous 2^53 se lit ici. */
let maxProduct = 0;
export function resetMaxProduct(): void {
  maxProduct = 0;
}
export function getMaxProduct(): number {
  return maxProduct;
}

function guard(p: number): void {
  const a = p < 0 ? -p : p;
  if (a > maxProduct) maxProduct = a;
  if (a >= LIMIT) throw new Error(`produit hors des entiers sûrs : ${p}`);
}

/** Division entière qui tronque vers zéro, sans jamais rendre -0. Sûre pour |a| < 2^53 (le quotient arrondi ne peut pas franchir un entier). */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b) + 0;
}

/** Produit Q16 : (a × b) / 2^16, tronqué vers zéro. L'intermédiaire a × b est exact (< 2^53) ; ÷ 2^16 est exact en flottant. */
export function mul(a: number, b: number): number {
  const p = a * b;
  if (CHECK) guard(p);
  return Math.trunc(p / ONE) + 0;
}

/** (a × b) / c, tronqué vers zéro (division finale entière). */
export function mulDiv(a: number, b: number, c: number): number {
  const p = a * b;
  if (CHECK) guard(p);
  return idiv(p, c);
}

/** Quotient Q16 : (a × 2^16) / b. */
export function div(a: number, b: number): number {
  const p = a * ONE;
  if (CHECK) guard(p);
  return idiv(p, b);
}

export function abs(a: number): number {
  return a < 0 ? -a : a;
}

/** Racine carrée entière (plus grand r tel que r² ≤ n), par Newton sur des entiers ; n < 2^53. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(n / 2) + 1;
  let y = Math.floor((x + Math.floor(n / x)) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
