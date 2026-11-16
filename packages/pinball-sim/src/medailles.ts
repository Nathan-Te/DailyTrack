import type { Resultat } from "./partie";
import { seuilsDuJour } from "./seuils";
import type { Contenu } from "./generateur";
import { VARIANTE, type Medaille, type Seuils } from "./variante";

// Les médailles : quatre seuils par jour, **figés avec la table** (`seuils.ts`, `jours.ts`). Ils viennent du robot (lot PB4).
export type { Medaille, Seuils };

export const seuilsDe = (contenu: Contenu): Seuils => seuilsDuJour(contenu);

/** La médaille d'un score (les colonnes de classement, dans l'ordre de la fiche). */
export const medailleDe = (score: readonly number[], s: Seuils): Medaille | null => VARIANTE.medaille(score, s);

/** La médaille d'un résultat rejoué. */
export const medailleDeResultat = (r: Pick<Resultat, "score" | "ticks">, s: Seuils): Medaille | null => VARIANTE.medaille(VARIANTE.score(r), s);
