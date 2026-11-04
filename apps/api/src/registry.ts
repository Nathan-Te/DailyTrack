import type { GameDefinition } from "./games";
import { JEUX_DU_REGISTRE } from "./registre.generated";

// Le registre des jeux de la plateforme (lot P0). Lot K4e : **il vient des fiches** (`config/jeux/<id>.json`) — `npm run fiches` écrit `registre.generated.ts` (un import par fiche : le module du jeu est
// `apps/api/src/<code>.ts` et exporte `<CODE>_GAME`). Ajouter un jeu = écrire sa fiche et son module ; ce fichier ne change pas. L'ordre de la liste est celui du schéma (l'ordre des fiches) ; les routes
// sont essayées du préfixe le plus long au plus court (DailyTrack, au préfixe `/api`, passe en dernier).
export const GAMES: readonly GameDefinition<never>[] = JEUX_DU_REGISTRE.map((j) => j.jeu);

/**
 * Les jeux d'un serveur selon son environnement (lot K4e). **Un jeu témoin (`temoin: true` de sa fiche) n'est jamais dans le registre d'un serveur de production** : ses routes répondent 404, il n'a
 * aucune table (la fiche l'impose), il n'est ni dans le portail ni dans la journée. Local, recette et tests le voient.
 */
export function jeuxPourEnvironnement(environnement: "production" | "recette" | "local"): readonly GameDefinition<never>[] {
  return retenirPourEnvironnement(JEUX_DU_REGISTRE, environnement).map((j) => j.jeu);
}
/** La règle seule (pure, testée avec de faux jeux) : un témoin n'est retenu que hors production. */
export function retenirPourEnvironnement<T extends { temoin: boolean }>(jeux: readonly T[], environnement: "production" | "recette" | "local"): T[] {
  return jeux.filter((j) => !(j.temoin && environnement === "production"));
}
/** Les codes des jeux témoins (absents de la production). */
export const CODES_TEMOINS: readonly string[] = JEUX_DU_REGISTRE.filter((j) => j.temoin).map((j) => j.code);
