import type { Resultat } from "./partie";
import { seuilsDuJour } from "./seuils";
import type { Contenu } from "./generateur";
import { VARIANTE, type Medaille, type Seuils } from "./variante";

// Les médailles : quatre seuils par jour, **figés avec le niveau** (`seuils.ts`, `jours.ts`). Bronze : fin du 1er thème ; argent : fin du 2e ; or : fin du 3e ; Diamant : fin de la boucle des cinq thèmes — chacun à 60 % de ce
// que fait le robot (`robot.ts`, `seuils.ts`).
export type { Medaille, Seuils };

export const seuilsDe = (contenu: Contenu): Seuils => seuilsDuJour(contenu);

/** La médaille d'un score (les colonnes de classement, dans l'ordre de la fiche). */
export const medailleDe = (score: readonly number[], s: Seuils): Medaille | null => VARIANTE.medaille(score, s);

/** La médaille d'un résultat rejoué. */
export const medailleDeResultat = (r: Pick<Resultat, "score" | "ticks">, s: Seuils): Medaille | null => VARIANTE.medaille(VARIANTE.score(r), s);
