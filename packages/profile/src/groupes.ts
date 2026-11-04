import { call, type ApiResult, type FetchLike } from "./client";

// Lot C1, partie C de la plateforme — les groupes côté client : les types des réponses (lues avec prudence : une réponse mal formée ne casse rien), l'adresse de la page d'un groupe et le client des routes
// `/api/groupes…` (contrat : `apps/api/CLAUDE.md`, « Groupes (lot C1) »). Pur : réseau injecté. L'identifiant secret voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse ; un membre se désigne par sa
// référence publique, un groupe par son nom ou son identifiant public (pas un secret). Le lien d'invitation (`?invitation=<jeton>`) quitte l'adresse dès l'ouverture de la page.

export const GROUPE_MEMBRES_MAX = 30;
export const GROUPE_NOM_MIN = 3;
export const GROUPE_NOM_MAX = 24;
export const GROUPE_DESCRIPTION_MAX = 140;

export interface MembreGroupe {
  ref: string;
  pseudo: string;
  avatar?: string;
  chef: boolean;
  depuis: string;
}
export interface FicheGroupe {
  id: string;
  nom: string;
  description: string;
  avatar?: string;
  membres: MembreGroupe[];
  max: number;
}
/** Mon groupe : la fiche, plus le lien d'invitation (tout membre peut le montrer), mon rôle et, pour le chef, dans combien de millisecondes il peut renommer. */
export interface MonGroupe extends FicheGroupe {
  invitation: string;
  chef: boolean;
  arrivee: string;
  renommerDans?: number;
}
export interface RangGroupe {
  vue: string;
  sens: "temps" | "hauteur";
  rang: number | null;
  score: number | null;
  classes: number;
  sur: number;
}
/** La page publique d'un groupe : sa fiche et son rang du jour dans chaque vue (`null` : « Moins de 3 classés »). */
export interface PageGroupe extends FicheGroupe {
  date: string | null;
  ouvert: boolean;
  classement: RangGroupe[];
  min: number;
}
export interface LigneGroupe {
  id: string;
  nom: string;
  avatar?: string;
  rang?: number;
  score?: number;
  classes: number;
}
export interface ClassementGroupes {
  date: string;
  ouvert: boolean;
  vue: string;
  sens: "temps" | "hauteur";
  vues: string[];
  /** Lot A3 : parmi `vues`, celles des jeux d'arcade (après le séparateur « Arcade »). Absent : aucune. */
  arcade?: string[];
  min: number;
  groupes: (LigneGroupe & { rang: number; score: number })[];
  moins: LigneGroupe[];
}
export interface Invitation {
  id: string;
  nom: string;
  description: string;
  avatar?: string;
  membres: number;
  max: number;
  plein: boolean;
}

const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const entier = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const FORMAT_EMPREINTE = /^[0-9a-f]{16}$/;
const avatarDe = (v: unknown): { avatar?: string } => (typeof v === "string" && FORMAT_EMPREINTE.test(v) ? { avatar: v } : {});

function lireMembre(v: unknown): MembreGroupe | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o.ref !== "string" || typeof o.pseudo !== "string") return null;
  return { ref: o.ref, pseudo: o.pseudo, ...avatarDe(o.avatar), chef: o.chef === true, depuis: texte(o.depuis) };
}
export function lireFicheGroupe(v: unknown): FicheGroupe | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o.id !== "string" || typeof o.nom !== "string") return null;
  return { id: o.id, nom: o.nom, description: texte(o.description), ...avatarDe(o.avatar), membres: (Array.isArray(o.membres) ? o.membres : []).map(lireMembre).filter((m): m is MembreGroupe => m !== null), max: entier(o.max) ?? GROUPE_MEMBRES_MAX };
}
export function lireMonGroupe(corps: unknown): MonGroupe | null | undefined {
  const o = corps as { groupe?: unknown } | null;
  if (!o || !("groupe" in o)) return undefined;
  if (o.groupe === null) return null;
  const f = lireFicheGroupe(o.groupe);
  const g = o.groupe as Record<string, unknown>;
  if (!f || typeof g.invitation !== "string") return undefined;
  const dans = entier(g.renommerDans);
  return { ...f, invitation: g.invitation, chef: g.chef === true, arrivee: texte(g.arrivee), ...(dans !== null ? { renommerDans: dans } : {}) };
}
export function lirePageGroupe(corps: unknown): PageGroupe | null {
  const f = lireFicheGroupe(corps);
  const o = corps as Record<string, unknown>;
  if (!f) return null;
  const classement = (Array.isArray(o.classement) ? o.classement : []).flatMap((x): RangGroupe[] => {
    const r = x as Record<string, unknown> | null;
    if (!r || typeof r.vue !== "string") return [];
    return [{ vue: r.vue, sens: r.sens === "hauteur" ? "hauteur" : "temps", rang: entier(r.rang), score: entier(r.score), classes: entier(r.classes) ?? 0, sur: entier(r.sur) ?? 0 }];
  });
  return { ...f, date: typeof o.date === "string" ? o.date : null, ouvert: o.ouvert === true, classement, min: entier(o.min) ?? 3 };
}
export function lireClassementGroupes(corps: unknown): ClassementGroupes | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || typeof o.vue !== "string" || !Array.isArray(o.groupes)) return null;
  const ligne = (x: unknown): LigneGroupe | null => {
    const r = x as Record<string, unknown> | null;
    if (!r || typeof r.id !== "string" || typeof r.nom !== "string") return null;
    return { id: r.id, nom: r.nom, ...avatarDe(r.avatar), ...(entier(r.rang) !== null ? { rang: entier(r.rang)! } : {}), ...(entier(r.score) !== null ? { score: entier(r.score)! } : {}), classes: entier(r.classes) ?? 0 };
  };
  const groupes = o.groupes.map(ligne).filter((l): l is LigneGroupe & { rang: number; score: number } => l !== null && l.rang !== undefined && l.score !== undefined);
  const moins = (Array.isArray(o.moins) ? o.moins : []).map(ligne).filter((l): l is LigneGroupe => l !== null);
  return { date: texte(o.date), ouvert: o.ouvert === true, vue: o.vue, sens: o.sens === "hauteur" ? "hauteur" : "temps", vues: (Array.isArray(o.vues) ? o.vues : []).filter((x): x is string => typeof x === "string"), ...(Array.isArray(o.arcade) ? { arcade: o.arcade.filter((x): x is string => typeof x === "string") } : {}), min: entier(o.min) ?? 3, groupes, moins };
}
export function lireInvitationGroupe(corps: unknown): Invitation | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || typeof o.id !== "string" || typeof o.nom !== "string") return null;
  return { id: o.id, nom: o.nom, description: texte(o.description), ...avatarDe(o.avatar), membres: entier(o.membres) ?? 0, max: entier(o.max) ?? GROUPE_MEMBRES_MAX, plein: o.plein === true };
}

/** La page publique d'un groupe : `<racine>/groupe/<nom>` (le nom est encodé ; il porte des espaces et des accents). */
export function adresseGroupe(racine: string, nom: string): string {
  return `${racine.replace(/\/+$/, "")}/groupe/${encodeURIComponent(nom)}`;
}
/** Le lien d'invitation à partager : la page du groupe avec le jeton (jamais l'identifiant secret). */
export function adresseInvitationGroupe(origine: string, nom: string, jeton: string): string {
  return `${adresseGroupe(origine, nom)}?invitation=${encodeURIComponent(jeton)}`;
}
/** Le nom d'un groupe lu dans le chemin de la page (`/groupe/<nom>`), ou `null`. */
export function nomDansLeChemin(chemin: string): string | null {
  const m = /\/groupe\/([^/?#]+)\/?$/.exec(chemin);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}
/**
 * Le jeton d'invitation d'une adresse (`?invitation=`) et l'adresse sans lui : à remplacer tout de suite (`history.replaceState`) — une adresse finit dans les journaux et l'historique. `jeton` n'est rendu que
 * s'il a la forme d'un jeton (32 hexadécimaux).
 */
export function retirerInvitationDeLAdresse(href: string): { jeton: string | null; adresse: string } {
  let url: URL;
  try {
    url = new URL(href, "https://exemple.invalid");
  } catch {
    return { jeton: null, adresse: href };
  }
  const brut = url.searchParams.get("invitation");
  url.searchParams.delete("invitation");
  return { jeton: brut !== null && /^[0-9a-f]{32}$/.test(brut) ? brut : null, adresse: `${url.pathname}${url.search}${url.hash}` };
}

export interface ClientGroupes {
  moi(): Promise<ApiResult<MonGroupe | null>>;
  creer(o: { nom: string; description: string }): Promise<ApiResult<{ id: string; nom: string }>>;
  page(nom: string, date?: string): Promise<ApiResult<PageGroupe>>;
  classement(date: string | undefined, vue: string): Promise<ApiResult<ClassementGroupes>>;
  invitation(jeton: string): Promise<ApiResult<Invitation>>;
  rejoindre(jeton: string): Promise<ApiResult<{ id: string; nom: string; arrivee: string }>>;
  quitter(): Promise<ApiResult<{ quitte: true; dissous: boolean }>>;
  renouveler(): Promise<ApiResult<{ invitation: string }>>;
  retirer(ref: string): Promise<ApiResult<{ retire: true }>>;
  passerLeChef(ref: string): Promise<ApiResult<{ chef: true }>>;
  renommer(nom: string): Promise<ApiResult<{ nom: string }>>;
  decrire(description: string): Promise<ApiResult<{ description: string }>>;
  dissoudre(): Promise<ApiResult<{ dissous: true }>>;
  emblem(image: string): Promise<ApiResult<{ avatar: string }>>;
  retirerEmblem(): Promise<ApiResult<{ avatar: null }>>;
}

export function clientGroupes(o: { base: string; playerId: string | null | (() => string | null); fetch?: FetchLike }): ClientGroupes {
  const base = o.base === "/" ? "" : o.base.replace(/\/+$/, "");
  const id = (): string | null => (typeof o.playerId === "function" ? o.playerId() : o.playerId);
  const sansProfil = <T>(): Promise<ApiResult<T>> => Promise.resolve({ ok: false, code: "invalid_player", message: "Pas de profil", status: 400 });
  const entetes = (): Record<string, string> | undefined => (id() ? { "X-Player-Id": id()! } : undefined);
  const lire = async <T, U>(methode: string, chemin: string, corps: unknown, f: (d: unknown) => U | null | undefined, avecId = true): Promise<ApiResult<U>> => {
    if (avecId && !id()) return sansProfil<U>();
    const r = await call<T>(base, methode, chemin, corps, undefined, avecId ? entetes() : undefined, o.fetch);
    if (!r.ok) return r;
    const v = f(r.data);
    return v === null || v === undefined ? { ok: false, status: 0, code: "network", message: "Réponse illisible du serveur" } : { ok: true, data: v };
  };
  const brut = <T>(d: unknown): T => d as T;
  const ecriture = <T>(chemin: string, corps?: unknown) => lire<T, T>("POST", chemin, corps ?? {}, brut<T>);
  return {
    async moi() {
      if (!id()) return { ok: true, data: null };
      const r = await call<unknown>(base, "GET", "/api/groupes/moi", undefined, undefined, entetes(), o.fetch);
      if (!r.ok) return r;
      const g = lireMonGroupe(r.data);
      return g === undefined ? { ok: false, status: 0, code: "network", message: "Réponse illisible du serveur" } : { ok: true, data: g };
    },
    creer: ({ nom, description }) => ecriture("/api/groupes", { nom, description }),
    page: (nom, date) => lire("GET", `/api/groupes/nom/${encodeURIComponent(nom)}${date ? `?date=${encodeURIComponent(date)}` : ""}`, undefined, lirePageGroupe, false),
    classement: (date, vue) => lire("GET", `/api/groupes/classement?${date ? `date=${encodeURIComponent(date)}&` : ""}vue=${encodeURIComponent(vue)}`, undefined, lireClassementGroupes, false),
    invitation: (jeton) => lire("GET", `/api/groupes/invitation/${encodeURIComponent(jeton)}`, undefined, lireInvitationGroupe, false),
    rejoindre: (jeton) => ecriture("/api/groupes/rejoindre", { jeton }),
    quitter: () => ecriture("/api/groupes/quitter"),
    renouveler: () => ecriture("/api/groupes/renouveler"),
    retirer: (ref) => ecriture("/api/groupes/retirer", { ref }),
    passerLeChef: (ref) => ecriture("/api/groupes/chef", { ref }),
    renommer: (nom) => ecriture("/api/groupes/renommer", { nom }),
    decrire: (description) => ecriture("/api/groupes/decrire", { description }),
    dissoudre: () => ecriture("/api/groupes/dissoudre"),
    emblem: (image) => ecriture("/api/groupes/emblem", { image }),
    retirerEmblem: () => lire("DELETE", "/api/groupes/emblem", undefined, brut<{ avatar: null }>),
  };
}
