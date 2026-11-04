import type { Contenu } from "./generateur";

// Les MÉDAILLES attendent le lot B3 (le bot Diamant, ses seuils). En attendant (lot B1), un jour n'a pas de médaille : les seuils sont à zéro et `medailleDe` ne rend rien. Le serveur dit la même chose
// (`apps/api/src/blocks.ts` : `seuils` rend `null`). Le Diamant sera la partie d'un bot : pour chaque pièce, il essaiera toutes les positions en regardant la pièce suivante.
export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}
export const seuilsDe = (_contenu: Contenu): Seuils => ({ author: 0, gold: 0, silver: 0, bronze: 0 });
export const medailleDe = (_score: readonly number[], _s: Seuils): Medaille | null => null;
