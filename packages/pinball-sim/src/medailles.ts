import type { Resultat } from "./partie";
import { partieDuBot } from "./bot";
import type { Contenu } from "./generateur";
import { VARIANTE, type Medaille, type Seuils, type Variante } from "./variante";

// Les médailles : le Diamant est la partie du bot, l'or, l'argent et le bronze s'en déduisent selon la variante (`variante.ts` : pourcentages du Diamant, `pourcentage-diamant` de la fiche).
export type { Medaille, Seuils };
export const BAREME_PCT = VARIANTE.fiche.bareme;

export const seuilsDe = (contenu: Contenu, variante: Variante = VARIANTE): Seuils => variante.seuils(partieDuBot(contenu, variante));

/** La médaille d'un score (les colonnes de classement, dans l'ordre de la fiche). */
export const medailleDe = (score: readonly number[], s: Seuils, variante: Variante = VARIANTE): Medaille | null => variante.medaille(score, s);

/** La médaille d'un résultat rejoué. */
export const medailleDeResultat = (r: Pick<Resultat, "touches" | "dernier">, s: Seuils, variante: Variante = VARIANTE): Medaille | null => variante.medaille(variante.score(r), s);
