/** Erreur de l'API : code HTTP, code lisible par le jeu, message en français (voir `reply` dans api.ts). `details` : champs ajoutés au corps de la réponse. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
