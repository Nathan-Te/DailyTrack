// Lot T9 — les couleurs de l'habillage et des décors, **sans rien importer** : les modules à la demande (décors, habits, effets du taquet) n'importent pas `palette.ts` (cela l'ôterait du premier chargement pour en faire un
// morceau à part : +69 o mesurés pour l'accueil). `ENCRE` est le trait d'encre de la charte (`dj-encre`) : `test/decors.test.ts` vérifie qu'il est égal au jeton.
export const ENCRE = "#2A1E16";

/** Un mélange de deux couleurs `#RRGGBB` (la teinte givrée d'une pièce glissante, l'ombre d'une géante). Pur : `k` = 0 la première, 1 la seconde. */
export function melanger(a: string, b: string, k: number): string {
  const c = (h: string, i: number): number => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const x = (i: number): string => Math.round(c(a, i) + (c(b, i) - c(a, i)) * k).toString(16).padStart(2, "0");
  return `#${x(0)}${x(1)}${x(2)}`.toUpperCase();
}
