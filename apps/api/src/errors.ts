/** Erreur de l'API : code HTTP, code lisible par le jeu, message en français (voir `reply` dans api.ts). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}
