// Les deux couleurs de la charte que le dessin des blocs lit (l'encre et le papier), **sans rien importer** : le module de description ne dépend ni de l'interface du socle ni d'un moteur de rendu.
// Les tests de Tower vérifient qu'elles sont égales aux jetons `dj-encre` et `dj-papier` de `@cdj/ui` (`apps/tower/test/decors.test.ts`).
export const ENCRE = "#2A1E16";
export const PAPIER = "#FFF6E0";

/** Un mélange de deux couleurs `#RRGGBB` (la teinte givrée d'une pièce glissante, l'ombre d'une géante). Pur : `k` = 0 la première, 1 la seconde. */
export function melanger(a: string, b: string, k: number): string {
  const c = (h: string, i: number): number => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const x = (i: number): string => Math.round(c(a, i) + (c(b, i) - c(a, i)) * k).toString(16).padStart(2, "0");
  return `#${x(0)}${x(1)}${x(2)}`.toUpperCase();
}
