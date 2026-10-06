/** Identifiant de joueur : 128 bits aléatoires tirés par le navigateur, en hexadécimal. */
export const PLAYER_ID = /^[0-9a-f]{32}$/;

export const NAME_MAX = 20;

/**
 * Pseudo nettoyé (espaces normalisés, Unicode NFC), ou `null` s'il est refusé : 1 à 20 caractères, lettres,
 * chiffres, espace, point, tiret, tiret bas, apostrophe ; doit commencer par une lettre ou un chiffre.
 * Le jeu l'affiche toujours via `textContent`, jamais en HTML.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  const length = [...name].length;
  if (length < 1 || length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u.test(name)) return null;
  return name;
}
