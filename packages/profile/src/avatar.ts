import { call, type ApiResult, type FetchLike } from "./client";

// Lot C1, partie B de la plateforme — les avatars côté client : l'adresse d'une image (immuable : l'empreinte est dans l'adresse) et le client des routes `/api/avatar…` (contrat : `apps/api/CLAUDE.md`,
// « Avatars (lot C1) »). Pur : réseau injecté. L'identifiant secret voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse ; une image se désigne par son empreinte, un joueur par sa référence publique.

export const FORMAT_EMPREINTE = /^[0-9a-f]{16}$/;
export const AVATAR_OCTETS_MAX = 20 * 1024;
export const AVATAR_COTE = 128;

/** L'adresse de l'image d'une empreinte (`/api/avatars/<empreinte>`), ou `undefined` si ce n'en est pas une (on retombe sur les initiales). Une adresse de serveur `""` ou `"/"` : la même origine. */
export function adresseAvatar(base: string, empreinte: unknown): string | undefined {
  if (typeof empreinte !== "string" || !FORMAT_EMPREINTE.test(empreinte)) return undefined;
  const origine = base === "/" ? "" : base.replace(/\/+$/, "");
  return `${origine}/api/avatars/${empreinte}`;
}

export type RaisonImage = "taille" | "format" | "metadonnees" | "dimensions";

export interface ClientAvatar {
  /** Envoie l'image (WebP ou JPEG, en base64, déjà réencodée par le navigateur) ; un échec `invalid_image` porte la `raison` dans `message`. */
  envoyer(base64: string): Promise<ApiResult<{ avatar: string }>>;
  retirer(): Promise<ApiResult<{ avatar: null }>>;
  /** Signale l'image d'un joueur (sa référence publique) ou d'un groupe (son identifiant public). */
  signaler(cible: { ref: string } | { groupe: string }): Promise<ApiResult<{ ok: true }>>;
}

export function clientAvatar(o: { base: string; playerId: string | null | (() => string | null); fetch?: FetchLike }): ClientAvatar {
  const base = o.base === "/" ? "" : o.base.replace(/\/+$/, "");
  const id = (): string | null => (typeof o.playerId === "function" ? o.playerId() : o.playerId);
  const sansProfil = <T>(): Promise<ApiResult<T>> => Promise.resolve({ ok: false, code: "invalid_player", message: "Pas de profil", status: 400 });
  const appel = <T>(methode: string, chemin: string, corps?: unknown) => call<T>(base, methode, chemin, corps, undefined, { "X-Player-Id": id()! }, o.fetch);
  return {
    envoyer: (image) => (id() ? appel("POST", "/api/avatar", { image }) : sansProfil()),
    retirer: () => (id() ? appel("DELETE", "/api/avatar") : sansProfil()),
    signaler: (cible) => (id() ? appel("POST", "/api/avatar/signaler", cible) : sansProfil()),
  };
}
