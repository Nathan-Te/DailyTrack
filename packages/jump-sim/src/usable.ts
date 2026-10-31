import { moduleDef, moduleSolutions, restUsable, variantExigence } from "./modules";
import { bridgePieceProblems } from "./pontsPieces";

/**
 * Lot 30 : cette variante du catalogue est-elle **utilisable** par le générateur ? Une solution jouable à chaque entrée (note de 1 à 5, donc ni refusée ni « au pas près »), les règles du catalogue
 * qui se lisent sur les solutions (`restUsable` : durée d'un morceau, respirations) et, pour un morceau à pont, la poursuite franche (`bridgePieceProblems` : la solution suit le pont avec 0,4 s
 * d'avance). `legacy` : le catalogue d'avant le maintien minimal (les règles d'alors, sans ces vérifications : ses références ne changent pas).
 * Les règles de grille seule (champignons, stalactites) ne sont pas ici : elles se lisent par morceau posé (`dailyProblems`) et ne changent pas avec les solutions.
 */
export function variantUsable(id: string, variant: number, legacy = false): boolean {
  const sol = moduleSolutions(id, variant, legacy);
  if (!sol?.arret || !sol.elan || variantExigence(sol) < 1) return false;
  if (legacy) return true;
  const def = moduleDef(id);
  if (!restUsable(def, variant, sol)) return false;
  return !def.tags.includes("pont") || bridgePieceProblems(id, variant).length === 0;
}
