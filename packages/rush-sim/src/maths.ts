import { COS, DIRECTIONS, SIN } from "./trig";

// Les outils entiers de Rush. **`idiv` pour toute division** (jamais de `-0`) ; `isqrt` est la racine entière (`Math.sqrt` est correctement arrondie sur tous les moteurs ; le résultat est corrigé pour être exact).

export const idiv = (a: number, b: number): number => Math.trunc(a / b) + 0;

export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export const distance2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const distance = (ax: number, ay: number, bx: number, by: number): number => isqrt(distance2(ax, ay, bx, by));

/** Le vecteur (dx, dy) ramené à 1 024 de long ; (0, 0) pour un vecteur nul. */
export function unitaire(dx: number, dy: number): [number, number] {
  const l = isqrt(dx * dx + dy * dy);
  if (l === 0) return [0, 0];
  return [idiv(dx * 1024, l), idiv(dy * 1024, l)];
}

/** L'indice de direction (0 à 127) le plus proche de (dx, dy) ; 0 pour un vecteur nul. */
export function dirVers(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  let meilleur = 0;
  let max = -Infinity;
  for (let k = 0; k < DIRECTIONS; k++) {
    const p = dx * COS[k]! + dy * SIN[k]!;
    if (p > max) {
      max = p;
      meilleur = k;
    }
  }
  return meilleur;
}

export const modDir = (k: number): number => ((k % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
