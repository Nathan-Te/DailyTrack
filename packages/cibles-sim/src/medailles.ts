import { NB_CIBLES } from "./constantes";
import type { Resultat } from "./partie";
import { partieDuBot } from "./bot";
import type { Contenu } from "./generateur";

// Les médailles de Cibles : le Diamant est la partie du bot (plafonnée au nombre de cibles), l'or, l'argent et le bronze en sont 50, 30 et 15 % (comme Tower, `pourcentage-diamant` de la fiche).
export const BAREME_PCT = [50, 30, 15] as const;
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}
const idiv = (a: number, b: number): number => Math.trunc(a / b);

export function seuilsDe(contenu: Contenu): Seuils {
  const author = Math.min(partieDuBot(contenu).touches, NB_CIBLES);
  return { author, gold: idiv(author * BAREME_PCT[0], 100), silver: idiv(author * BAREME_PCT[1], 100), bronze: idiv(author * BAREME_PCT[2], 100) };
}

export type Medaille = "author" | "gold" | "silver" | "bronze";
export function medailleDe(r: Pick<Resultat, "touches">, s: Seuils): Medaille | null {
  for (const m of ["author", "gold", "silver", "bronze"] as const) if (r.touches >= s[m]) return m;
  return null;
}
