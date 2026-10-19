import { createIdentity, isValidName, normalizeName, randomPlayerId } from "@cdj/profile";
import { gameStorage } from "./storage";

// Identité légère : un identifiant aléatoire et un pseudo, gardés dans le navigateur. Pas de compte, pas d'e-mail.
// Changer de navigateur, c'est devenir un autre joueur (accepté au premier jalon, voir docs/seed.md § 6).
// Lot P0 (plateforme) : l'identité est celle du module de profil commun (`@cdj/profile`, mêmes clés `cdj:*`), branchée ici sur le point
// d'accès au stockage du jeu (`gameStorage`, préfixe d'aperçu compris).

/** L'identité de la plateforme dans ce navigateur. */
export const identity = createIdentity(gameStorage);

export { isValidName, normalizeName, randomPlayerId };

/** Identifiant du joueur (32 caractères hexadécimaux), créé au premier appel. C'est le secret du profil : le code de transfert n'est que lui. */
export const getPlayerId = (): string => identity.getPlayerId();
/** Adopte un autre identifiant (« Changer mon code » réussi, code chargé). */
export const setPlayerId = (id: string): void => identity.setPlayerId(id);
/** « Changer mon code » en cours (voir `@cdj/profile`). */
export const pendingNextId = (): string | null => identity.pendingNextId();
export const takeNextId = (): string => identity.takeNextId();
export const clearNextId = (): void => identity.clearNextId();
export const getName = (): string | null => identity.getName();
export const setName = (name: string): void => identity.setName(name);

function read(key: string): string | null {
  try {
    return gameStorage().getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    gameStorage().setItem(key, value);
  } catch {
    /* navigation privée, stockage bloqué */
  }
}

/** Dernier meilleur temps (ms) confirmé par le serveur pour ce circuit : évite de renvoyer ce qui est déjà classé. */
export function getSubmittedBest(trackId: string): number | null {
  const v = Number(read(`cdj:sub:${trackId}`));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function setSubmittedBest(trackId: string, ms: number): void {
  write(`cdj:sub:${trackId}`, String(ms));
}
