import { call, type ApiResult, type FetchLike } from "./client";

// Lot C1, partie A de la plateforme — « Un bug ? Une idée ? » côté client : le client des routes `/api/retours/…` (contrat : `apps/api/CLAUDE.md`, « Retours (lot C1) »), la famille du navigateur et du système, et la
// forme du contexte joint à un message. Pur : réseau injecté (test `purete.test.ts` : ni `document`, ni `location`, ni stockage direct) ; les valeurs de l'écran et de la page sont **données** par l'appelant.
// **Ce module n'est volontairement PAS dans `index.ts`** : le dialogue est à la demande, les applications l'importent par son chemin (`@cdj/profile/src/retours`) depuis un module chargé à la demande.
// L'identifiant secret voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse. Un échec est une valeur (`ApiResult`), jamais une exception.

export const TYPES_RETOUR = ["bug", "suggestion", "autre"] as const;
export type TypeRetour = (typeof TYPES_RETOUR)[number];
export type StatutRetour = "nouveau" | "lu" | "en_cours" | "traite" | "refuse";
export const STATUTS_RETOUR: readonly StatutRetour[] = ["nouveau", "lu", "en_cours", "traite", "refuse"];
/** Caractères d'un message (le même que le serveur : `RETOUR_TEXTE_MAX`). */
export const RETOUR_TEXTE_MAX = 1000;

/** Ce que le dialogue montre avant l'envoi, et qui part avec le message (le serveur y ajoute la version et ignore tout le reste). */
export interface ContexteRetour {
  /** `portail`, `track`, `jump` ou `tower`. */
  jeu: string;
  /** Le chemin de la page, sans paramètres (`/jump/`). */
  page: string;
  /** Le jour affiché (AAAA-MM-JJ). */
  jour: string;
  navigateur: string;
  systeme: string;
  /** Taille de l'écran en pixels, `390x844`. */
  ecran: string;
  langue: "fr" | "en";
}

/** La famille du navigateur et du système d'après `navigator.userAgent` : jamais le détail (version, modèle d'appareil). */
export function famillesDe(userAgent: string, plateforme = ""): { navigateur: string; systeme: string } {
  const ua = userAgent;
  const navigateur = /Edg(?:e|A|iOS)?\//.test(ua) ? "edge" : /OPR\/|Opera/.test(ua) ? "opera" : /Firefox\/|FxiOS\//.test(ua) ? "firefox" : /Chrome\/|CriOS\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "autre";
  const systeme = /Android/.test(ua) ? "android" : /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(plateforme) && /Mobile/.test(ua)) ? "ios" : /Windows/.test(ua) ? "windows" : /Mac OS X|Macintosh/.test(ua) ? "macos" : /Linux|X11/.test(ua) ? "linux" : "autre";
  return { navigateur, systeme };
}

/** Le chemin d'une page sans paramètres ni fragment, tel que le serveur l'accepte (`/[A-Za-z0-9/_-]{0,58}`) ; `/` sinon. */
export function cheminDePage(chemin: string): string {
  const p = chemin.split(/[?#]/)[0] ?? "/";
  return /^\/[A-Za-z0-9/_-]{0,58}$/.test(p) ? p : "/";
}

/**
 * L'identifiant secret de ce navigateur d'après son stockage (`cdj:player`, 32 hexadécimaux), ou `null` : la même lecture que `readPlayerId` (`identity.ts`), recopiée ici pour que le module du dialogue,
 * chargé à la demande, n'importe rien du premier chargement d'un jeu (un module à la demande qui importe un module du premier chargement le fait éclater : mesuré, budgets.md). Un test les compare.
 */
export function joueurDuStockage(stockage: { getItem(cle: string): string | null } | null): string | null {
  try {
    const id = stockage?.getItem("cdj:player") ?? null;
    return id && /^[0-9a-f]{32}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export interface FilResume {
  id: number;
  type: TypeRetour;
  jeu: string;
  statut: StatutRetour;
  creeLe: string;
  majLe: string;
  nonLu: boolean;
  messages: number;
  apercu: string;
}
export interface MessageRetour {
  auteur: "joueur" | "admin";
  texte: string;
  creeLe: string;
}
export interface FilDetail {
  id: number;
  type: TypeRetour;
  jeu: string;
  statut: StatutRetour;
  creeLe: string;
  contexte: Record<string, unknown> | null;
  nonLu: boolean;
  peutRepondre: boolean;
  messages: MessageRetour[];
}
export interface ContexteServeur {
  version: string;
  jour: string;
  /** La référence publique du joueur (avec un identifiant), sinon absente. */
  reference?: string;
}

export interface OptionsClientRetours {
  base: string;
  /** L'identifiant secret du joueur, ou `null` sans profil (valeur ou fonction lue à chaque appel). */
  playerId: string | null | (() => string | null);
  fetch?: FetchLike;
}

const estType = (x: unknown): x is TypeRetour => typeof x === "string" && (TYPES_RETOUR as readonly string[]).includes(x);
const estStatut = (x: unknown): x is StatutRetour => typeof x === "string" && (STATUTS_RETOUR as readonly string[]).includes(x);
const chaine = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const objet = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);

export function lireFils(brut: unknown): { fils: FilResume[]; nonLus: number } | null {
  const o = objet(brut);
  if (!o || !Array.isArray(o.fils)) return null;
  const fils = o.fils.flatMap((f): FilResume[] => {
    const x = objet(f);
    if (!x || typeof x.id !== "number" || !estType(x.type) || !estStatut(x.statut)) return [];
    return [{ id: x.id, type: x.type, jeu: chaine(x.jeu), statut: x.statut, creeLe: chaine(x.creeLe), majLe: chaine(x.majLe), nonLu: x.nonLu === true, messages: typeof x.messages === "number" ? x.messages : 1, apercu: chaine(x.apercu) }];
  });
  return { fils, nonLus: typeof o.nonLus === "number" ? o.nonLus : fils.filter((f) => f.nonLu).length };
}

export function lireFil(brut: unknown): FilDetail | null {
  const o = objet(brut);
  if (!o || typeof o.id !== "number" || !estType(o.type) || !estStatut(o.statut) || !Array.isArray(o.messages)) return null;
  const messages = o.messages.flatMap((m): MessageRetour[] => {
    const x = objet(m);
    return x && typeof x.texte === "string" ? [{ auteur: x.auteur === "admin" ? "admin" : "joueur", texte: x.texte, creeLe: chaine(x.creeLe) }] : [];
  });
  return { id: o.id, type: o.type, jeu: chaine(o.jeu), statut: o.statut, creeLe: chaine(o.creeLe), contexte: objet(o.contexte), nonLu: o.nonLu === true, peutRepondre: o.peutRepondre !== false, messages };
}

export interface ClientRetours {
  /** La version en production et le jour (public, rien d'écrit). */
  lireContexte(): Promise<ApiResult<ContexteServeur>>;
  /** Envoie un nouveau message ; sans profil, l'envoi est anonyme (`reponsePossible: false`). */
  envoyer(o: { type: TypeRetour; texte: string; contexte: ContexteRetour }): Promise<ApiResult<{ id: number; reponsePossible: boolean }>>;
  lireFils(): Promise<ApiResult<{ fils: FilResume[]; nonLus: number }>>;
  lireFil(id: number): Promise<ApiResult<FilDetail>>;
  repondre(id: number, texte: string): Promise<ApiResult<{ ok: true }>>;
  marquerLu(id: number): Promise<ApiResult<{ ok: true }>>;
}

export function clientRetours(o: OptionsClientRetours): ClientRetours {
  const base = o.base === "/" ? "" : o.base.replace(/\/+$/, "");
  const id = (): string | null => (typeof o.playerId === "function" ? o.playerId() : o.playerId);
  const entetes = (): Record<string, string> | undefined => {
    const j = id();
    return j ? { "X-Player-Id": j } : undefined;
  };
  const appel = <T>(methode: string, chemin: string, corps?: unknown) => call<T>(base, methode, chemin, corps, undefined, entetes(), o.fetch);
  const sansProfil = <T>(): ApiResult<T> => ({ ok: false, code: "invalid_player", message: "Pas de profil", status: 400 });
  const lu = <T>(r: ApiResult<unknown>, f: (d: unknown) => T | null): ApiResult<T> => {
    if (!r.ok) return r;
    const v = f(r.data);
    return v === null ? { ok: false, code: "invalid_response", message: "Réponse illisible", status: 502 } : { ok: true, data: v };
  };
  return {
    lireContexte: async () => lu(await appel<unknown>("GET", "/api/retours/contexte"), (d) => (objet(d) && typeof objet(d)!.version === "string" ? { version: String(objet(d)!.version), jour: chaine(objet(d)!.jour), ...(typeof objet(d)!.reference === "string" ? { reference: String(objet(d)!.reference) } : {}) } : null)),
    envoyer: async (m) => lu(await appel<unknown>("POST", "/api/retours", { type: m.type, texte: m.texte, contexte: m.contexte }), (d) => (objet(d) && typeof objet(d)!.id === "number" ? { id: Number(objet(d)!.id), reponsePossible: objet(d)!.reponsePossible === true } : null)),
    lireFils: async () => (id() ? lu(await appel<unknown>("GET", "/api/retours"), lireFils) : sansProfil()),
    lireFil: async (n) => (id() ? lu(await appel<unknown>("GET", `/api/retours/${n}`), lireFil) : sansProfil()),
    repondre: async (n, texte) => (id() ? lu(await appel<unknown>("POST", `/api/retours/${n}/messages`, { texte }), () => ({ ok: true as const })) : sansProfil()),
    marquerLu: async (n) => (id() ? lu(await appel<unknown>("POST", `/api/retours/${n}/lu`), () => ({ ok: true as const })) : sansProfil()),
  };
}
