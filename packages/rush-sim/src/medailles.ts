import { partieDuBot } from "./bot";
import type { Contenu } from "./generateur";
import type { Resultat } from "./partie";
import { VARIANTE, type Medaille, type Seuils } from "./variante";

// Les médailles : le Diamant est la partie du pilote (`bot.ts`), l'or, l'argent et le bronze s'en déduisent (`pourcentage-diamant` de la fiche). **Provisoire** : la méthode définitive des médailles est une décision de
// Nathan (README du lot BR0). Le jeu du prototype est « sans médaille » (`sansMedaille`) ; le serveur en a besoin pour le contrat.
export type { Medaille, Seuils };
export const BAREME_PCT = VARIANTE.fiche.bareme;

export const seuilsDe = (contenu: Contenu): Seuils => VARIANTE.seuils(partieDuBot(contenu));

/** La médaille d'un score (les colonnes de classement, dans l'ordre de la fiche). */
export const medailleDe = (score: readonly number[], s: Seuils): Medaille | null => VARIANTE.medaille(score, s);

/** La médaille d'un résultat rejoué. */
export const medailleDeResultat = (r: Pick<Resultat, "victoire" | "ticks">, s: Seuils): Medaille | null => VARIANTE.medaille(VARIANTE.score(r), s);
