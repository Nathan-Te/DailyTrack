import { NORME, QUART, TOUR } from "./constantes";

// Les outils entiers de la simulation : la division tronquée vers zéro, la racine carrée entière et la table des sinus. Tout entier ; aucun flottant ne sort de ce fichier. Les produits restent sous 2^53 (la
// mémoire d'un nombre JavaScript est exacte jusque-là) : une position vaut au plus 1,6 million d'unités, une vitesse 6,2 millions d'unités par seconde, un vecteur unitaire 16 384.

/** Le quotient tronqué vers zéro (les deux nombres sont entiers, `b` n'est jamais nul). */
export const div = (a: number, b: number): number => Math.trunc(a / b);

/** La racine carrée entière (le plus grand `r` tel que `r² ≤ n`), par la méthode de Newton ; `n` est un entier de 0 à 2^53. */
export function racine(n: number): number {
  if (n < 2) return n < 0 ? 0 : n;
  // une première valeur au-dessus de la racine : la puissance de deux dont le carré dépasse `n` (la longueur de `n` en bits, divisée par deux)
  let bits = 0;
  let m = n;
  while (m >= 65536) {
    m = Math.trunc(m / 65536);
    bits += 16;
  }
  bits += 32 - Math.clz32(m);
  let x = 1 << ((bits + 1) >> 1);
  for (;;) {
    const y = Math.trunc((x + Math.trunc(n / x)) / 2);
    if (y >= x) break;
    x = y;
  }
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

// --- les sinus : un quart de tour calculé une fois, en entiers (série de Taylor en point fixe 2^20), puis les symétries.
const ECHELLE = 1048576; // 2^20
const DEUX_PI = 6588397; // 2π × 2^20, arrondi
const QUART_SIN: number[] = (() => {
  const t: number[] = [];
  for (let a = 0; a <= QUART; a++) {
    const x = div(a * DEUX_PI, TOUR); // l'angle en radians × 2^20
    const x2 = div(x * x, ECHELLE);
    let terme = x;
    let somme = x;
    for (let k = 1; k <= 7; k++) {
      terme = -div(div(terme * x2, ECHELLE), (2 * k) * (2 * k + 1));
      somme += terme;
    }
    t.push(div(somme * NORME + div(ECHELLE, 2), ECHELLE)); // arrondi au plus proche, ramené à l'échelle de `NORME`
  }
  t[QUART] = NORME; // sin(π/2) = 1 exactement
  return t;
})();

/** Le sinus d'un angle en seizièmes de millier de tour (`TOUR` = 2π), à l'échelle de `NORME` : −16 384 à 16 384. L'angle est un entier, de signe quelconque. */
export function sinus(a: number): number {
  let r = a % TOUR;
  if (r < 0) r += TOUR;
  if (r <= QUART) return QUART_SIN[r]!;
  if (r <= 2 * QUART) return QUART_SIN[2 * QUART - r]!;
  if (r <= 3 * QUART) return -QUART_SIN[r - 2 * QUART]!;
  return -QUART_SIN[TOUR - r]!;
}
export const cosinus = (a: number): number => sinus(a + QUART);

/** Un vecteur unitaire (à l'échelle de `NORME`) de la direction `(dx, dy)` ; `longueur` est la longueur déjà calculée (non nulle). */
export const unitaire = (d: number, longueur: number): number => div(d * NORME, longueur);
