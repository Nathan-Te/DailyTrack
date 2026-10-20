import type { CodeErreur, StatutErreur } from "./codesErreur";

/**
 * Erreur de l'API : code HTTP, code lisible par le jeu, message en français (voir `reply` dans api.ts). `details` : champs ajoutés au corps de la
 * réponse. Lot I1 : le code est un code de la liste unique (`codesErreur.ts`) et le statut est **celui de la liste** — `C` est déduit du code,
 * et un autre statut ne compile pas (un 400 avec `not_found` fait échouer `tsc`). Liste et sens : docs/plateforme/codes-erreur.md.
 */
export class HttpError<C extends CodeErreur = CodeErreur> extends Error {
  constructor(
    readonly status: StatutErreur<C>,
    readonly code: C,
    message: string,
    readonly headers: Record<string, string> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
