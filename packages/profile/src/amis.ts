import { call, type ApiResult, type FetchLike } from "./client";

// Lot F2 de la plateforme — « Les amis » côté client. Le client des routes `/api/amis/…` (contrat : `docs/plateforme/lots/lot-F2-amis.md`), le jeton d'invitation (rangé le temps de
// la visite dans le stockage de l'onglet, retiré de l'adresse aussitôt, comme la clé d'aperçu de `jeux.ts`) et le filtre « Tous / Amis » des classements dans l'adresse.
// Pur : réseau, stockage et adresse sont **injectés** (test `purete.test.ts` : ni `document`, ni `location`, ni stockage direct). Aucun DOM, aucune logique de jeu.
// **L'identifiant secret voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse** ; un ami se désigne par sa **référence publique** (`ref`, 12 hexadécimaux), jamais par un identifiant.
// Un échec est une valeur (`ApiResult`, jamais une exception) : `code` est celui du serveur (`friends_full`…, traduit par `erreur.<code>` du catalogue de `@cdj/ui`), ou `network` / `timeout`
// quand le serveur est injoignable (`estHorsLigne`).

/** Le nombre d'amis au plus (réponse `max` du serveur ; la valeur d'avant la première réponse). */
export const MAX_AMIS = 100;
/** Les lettres qu'il faut pour chercher un pseudo (le serveur rend une liste vide en dessous). */
export const SUGGESTION_MIN = 3;

export type OrigineAmi = "ajout" | "invitation";
/** Un ami, tel que le serveur le rend. `reciproque` : il t'a aussi parmi ses amis. */
export interface Ami {
  ref: string;
  pseudo: string;
  /** Lot C1 : l'empreinte de son image (voir `adresseAvatar`), absente : ses initiales. */
  avatar?: string;
  reciproque: boolean;
  origine: OrigineAmi;
}
export interface ListeAmis {
  amis: Ami[];
  total: number;
  max: number;
  /** Un lien d'invitation est-il actif ? (Le jeton lui-même n'est rendu qu'à sa création.) */
  invitation: { active: boolean };
  /** Lot C1, partie C : le nombre de membres de mon groupe, présent seulement si j'en ai un (le sélecteur « Mon groupe »). */
  groupe?: number;
}
export interface Suggestion {
  ref: string;
  pseudo: string;
}
/** Une ligne de la feuille d'un joueur : un jeu, ta valeur du jour (millisecondes pour un `temps`, millimètres pour une `hauteur`), sa médaille (code de la donnée : `auteur`, `or`…). */
export interface FicheJeu {
  jeu: string;
  site: string;
  nom: string;
  unite: "temps" | "hauteur";
  valeur: number | null;
  medaille: string | null;
  rang: number | null;
}
/** La feuille d'un joueur (planche C de la maquette) : **rien d'autre** que son pseudo, son rang général du jour et ses résultats du jour. */
export interface FicheJoueur {
  ref: string;
  pseudo: string;
  avatar?: string;
  ami: boolean;
  reciproque: boolean;
  /** Rang général du jour parmi `classes` joueurs classés ; `null` s'il n'a rien fini. */
  rang: number | null;
  classes: number | null;
  jeux: FicheJeu[];
}

// --- Lecture prudente des réponses (une réponse mal formée ne casse rien) ---------------------------------------------------------------------------------------------------------------

const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const entier = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** La référence publique d'un joueur : 12 hexadécimaux (empreinte à sens unique de son secret). */
export const REF_RE = /^[0-9a-f]{12}$/;
export const refValide = (ref: unknown): ref is string => typeof ref === "string" && REF_RE.test(ref);

function lireAmi(v: unknown): Ami | null {
  const o = v as { ref?: unknown; pseudo?: unknown; reciproque?: unknown; origine?: unknown } | null;
  if (!o || !refValide(o.ref) || typeof o.pseudo !== "string") return null;
  return { ref: o.ref, pseudo: o.pseudo, ...(typeof (o as { avatar?: unknown }).avatar === "string" ? { avatar: (o as { avatar: string }).avatar } : {}), reciproque: o.reciproque === true, origine: o.origine === "invitation" ? "invitation" : "ajout" };
}
const lireTotal = (v: unknown, repli: number): number => {
  const n = entier(v);
  return n !== null && n >= 0 ? n : repli;
};
export function lireListeAmis(corps: unknown): ListeAmis | null {
  const o = corps as { amis?: unknown; total?: unknown; max?: unknown; invitation?: { active?: unknown } } | null;
  if (!o || !Array.isArray(o.amis)) return null;
  const amis = o.amis.map(lireAmi).filter((a): a is Ami => a !== null);
  const groupe = entier((corps as { groupe?: unknown }).groupe);
  return { amis, total: lireTotal(o.total, amis.length), max: lireTotal(o.max, MAX_AMIS), invitation: { active: o.invitation?.active === true }, ...(groupe !== null && groupe >= 0 ? { groupe } : {}) };
}
function lireAjout(corps: unknown): { ami: Ami; total: number } | null {
  const o = corps as { ami?: unknown; total?: unknown } | null;
  const ami = lireAmi(o?.ami);
  return ami ? { ami, total: lireTotal(o?.total, 0) } : null;
}
function lireFiche(corps: unknown): FicheJoueur | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || !refValide(o.ref) || typeof o.pseudo !== "string") return null;
  const jeux = (Array.isArray(o.jeux) ? o.jeux : []).flatMap((j): FicheJeu[] => {
    const x = j as Record<string, unknown> | null;
    if (!x || typeof x.jeu !== "string") return [];
    return [{ jeu: x.jeu, site: texte(x.site), nom: texte(x.nom) || x.jeu, unite: x.unite === "hauteur" ? "hauteur" : "temps", valeur: entier(x.valeur), medaille: typeof x.medaille === "string" ? x.medaille : null, rang: entier(x.rang) }];
  });
  return { ref: o.ref, pseudo: o.pseudo, ...(typeof o.avatar === "string" ? { avatar: o.avatar } : {}), ami: o.ami === true, reciproque: o.reciproque === true, rang: entier(o.rang), classes: entier(o.classes), jeux };
}

// --- Le client ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const refus = <T>(code: string, message: string): Promise<ApiResult<T>> => Promise.resolve({ ok: false, status: 0, code, message });
const illisible = <T>(): ApiResult<T> => ({ ok: false, status: 0, code: "network", message: "Réponse illisible du serveur" });
const avec = <T, U>(r: ApiResult<T>, f: (d: T) => U | null): ApiResult<U> => {
  if (!r.ok) return r;
  const v = f(r.data);
  return v === null ? illisible<U>() : { ok: true, data: v };
};

/** L'échec est-il « le serveur est injoignable » (réseau coupé, délai) plutôt qu'un refus du serveur ? */
export function estHorsLigne(r: { ok: boolean; code?: string; status?: number }): boolean {
  return !r.ok && (r.code === "network" || r.code === "timeout" || r.status === 0);
}

export interface OptionsClientAmis {
  /** L'adresse du serveur (`""` ou `"/"` pour la même origine, ou `?api=` : voir `apiFromAddress`). */
  base: string;
  /** L'identifiant secret du joueur (ou une fonction qui le lit à chaque appel) ; `null` : pas de profil. Il part en `X-Player-Id`, jamais dans l'adresse. */
  playerId: string | null | (() => string | null);
  fetch?: FetchLike;
}

export interface ClientAmis {
  /** `GET /api/amis` : tes amis (masqués écartés, triés par pseudo), le total, le plafond, l'état du lien. */
  lireAmis(): Promise<ApiResult<ListeAmis>>;
  /** `POST /api/amis` : par la référence d'une ligne de classement, ou par pseudo exact. Sens unique : l'autre n'est pas prévenu. */
  ajouterAmi(qui: { ref: string } | { pseudo: string }): Promise<ApiResult<{ ami: Ami; total: number }>>;
  /** `DELETE /api/amis/<ref>` (idempotent). */
  retirerAmi(ref: string): Promise<ApiResult<{ total: number }>>;
  /** `GET /api/amis/suggestions?q=` : cinq pseudos au plus ; moins de `SUGGESTION_MIN` lettres : liste vide, sans appel. */
  suggestionsAmis(q: string): Promise<ApiResult<{ suggestions: Suggestion[] }>>;
  /** `POST /api/amis/invitation` : crée **ou renouvelle** ton lien (l'ancien meurt). **Le jeton n'est rendu qu'ici** : à montrer tout de suite, il ne se relit jamais. */
  creerInvitation(): Promise<ApiResult<{ jeton: string }>>;
  /** `POST /api/amis/invitation/voir` : le pseudo de qui invite (« Nathan t'invite »). Marche sans profil. */
  voirInvitation(jeton: string): Promise<ApiResult<{ pseudo: string }>>;
  /** `POST /api/amis/invitation/accepter` : sans profil serveur, `pseudo` est obligatoire (le profil est créé avec, mêmes règles de pseudo : `name_taken` rend des `suggestions`). */
  accepterInvitation(jeton: string, pseudo?: string): Promise<ApiResult<{ ami: Ami; total: number }>>;
  /** `GET /api/amis/fiche/<ref>?date=` : la feuille d'un joueur (le jour de Paris `AAAA-MM-JJ`, aujourd'hui par défaut). */
  ficheJoueur(ref: string, date?: string): Promise<ApiResult<FicheJoueur>>;
}

/** Le client des routes `/api/amis/…`. Ne lève jamais. */
export function clientAmis(o: OptionsClientAmis): ClientAmis {
  const id = (): string | null => (typeof o.playerId === "function" ? o.playerId() : o.playerId);
  const base = o.base === "/" ? "" : o.base.replace(/\/+$/, "");
  // Sans profil local, ces appels n'ont pas de sens : le serveur répondrait `invalid_player`, on le dit sans réseau.
  const avecJoueur = <T>(f: (joueur: string) => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
    const joueur = id();
    return joueur ? f(joueur) : refus<T>("invalid_player", "Pas de profil");
  };
  const appel = <T>(methode: string, chemin: string, corps: unknown, joueur: string | null) => call<T>(base, methode, chemin, corps, undefined, joueur ? { "X-Player-Id": joueur } : undefined, o.fetch);
  const dejaRef = <T>(ref: string): Promise<ApiResult<T>> | null => (refValide(ref) ? null : refus<T>("invalid_friend", "Référence invalide"));
  return {
    lireAmis: () => avecJoueur(async (j) => avec(await appel<unknown>("GET", "/api/amis", undefined, j), lireListeAmis)),
    ajouterAmi: (qui) =>
      avecJoueur(async (j) => {
        if ("ref" in qui && !refValide(qui.ref)) return refus<{ ami: Ami; total: number }>("invalid_friend", "Référence invalide");
        return avec(await appel<unknown>("POST", "/api/amis", "ref" in qui ? { ref: qui.ref } : { pseudo: qui.pseudo }, j), lireAjout);
      }),
    retirerAmi: (ref) =>
      dejaRef<{ total: number }>(ref) ??
      avecJoueur(async (j) =>
        avec(await appel<unknown>("DELETE", `/api/amis/${encodeURIComponent(ref)}`, undefined, j), (d) => ({ total: lireTotal((d as { total?: unknown } | null)?.total, 0) })),
      ),
    suggestionsAmis: (q) => {
      const debut = q.trim();
      if ([...debut].length < SUGGESTION_MIN) return Promise.resolve({ ok: true, data: { suggestions: [] } });
      return avecJoueur(async (j) =>
        avec(await appel<unknown>("GET", `/api/amis/suggestions?q=${encodeURIComponent(debut)}`, undefined, j), (d) => {
          const l = (d as { suggestions?: unknown } | null)?.suggestions;
          if (!Array.isArray(l)) return null;
          return { suggestions: l.flatMap((s): Suggestion[] => (refValide((s as Suggestion | null)?.ref) && typeof (s as Suggestion).pseudo === "string" ? [{ ref: (s as Suggestion).ref, pseudo: (s as Suggestion).pseudo }] : [])) };
        }),
      );
    },
    creerInvitation: () =>
      avecJoueur(async (j) =>
        avec(await appel<unknown>("POST", "/api/amis/invitation", undefined, j), (d) => {
          const jeton = (d as { jeton?: unknown } | null)?.jeton;
          return typeof jeton === "string" && JETON_RE.test(jeton) ? { jeton } : null;
        }),
      ),
    voirInvitation: async (jeton) =>
      JETON_RE.test(jeton)
        ? avec(await appel<unknown>("POST", "/api/amis/invitation/voir", { jeton }, id()), (d) => (typeof (d as { pseudo?: unknown } | null)?.pseudo === "string" ? { pseudo: (d as { pseudo: string }).pseudo } : null))
        : refus<{ pseudo: string }>("invalid_invitation", "Invitation illisible"),
    accepterInvitation: (jeton, pseudo) =>
      JETON_RE.test(jeton)
        ? avecJoueur(async (j) => avec(await appel<unknown>("POST", "/api/amis/invitation/accepter", pseudo === undefined ? { jeton } : { jeton, pseudo }, j), lireAjout))
        : refus<{ ami: Ami; total: number }>("invalid_invitation", "Invitation illisible"),
    ficheJoueur: (ref, date) =>
      dejaRef<FicheJoueur>(ref) ?? avecJoueur(async (j) => avec(await appel<unknown>("GET", `/api/amis/fiche/${encodeURIComponent(ref)}${date ? `?date=${encodeURIComponent(date)}` : ""}`, undefined, j), lireFiche)),
  };
}

// --- Le lien d'invitation -------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Le stockage de l'onglet (injecté), où le jeton attend que le joueur accepte. Une donnée de la visite : elle disparaît avec l'onglet. */
export const INVITATION_KEY = "cdj:invitation";
/** La forme d'un jeton : de l'alphabet d'une adresse (base64url), de 8 à 128 caractères. */
export const JETON_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** Le lien à partager : `<origine>/amis/?invitation=<jeton>`. Le jeton est caché, ce n'est jamais l'identifiant secret. */
export function adresseInvitation(origine: string, jeton: string): string {
  return `${origine.replace(/\/+$/, "")}/amis/?invitation=${encodeURIComponent(jeton)}`;
}

export type StockageInvitation = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PageInvitation {
  /** L'adresse de la page (`location.href`). */
  href: string;
  /** Le stockage de l'onglet ; `null` ou refusé : le jeton est lu mais pas gardé (rien ne casse). */
  session: Pick<Storage, "setItem"> | null | undefined;
  /** Pose l'adresse sans le jeton (`history.replaceState(null, "", adresse)`) : une adresse finit dans les journaux et l'historique. */
  remplacer(adresse: string): void;
}

/**
 * Le lien d'invitation est ouvert : si l'adresse porte `?invitation=<jeton>`, le jeton est rangé dans le stockage de l'onglet (`cdj:invitation`) et **l'adresse sans lui** est posée ; il est rendu.
 * Un jeton illisible est retiré de l'adresse sans être gardé (`null`). Sans paramètre : `null`, rien ne change. Ne lève jamais.
 */
export function rangerInvitation(page: PageInvitation): string | null {
  let url: URL;
  try {
    url = new URL(page.href);
  } catch {
    return null;
  }
  if (!url.searchParams.has("invitation")) return null;
  const jeton = url.searchParams.get("invitation") ?? "";
  url.searchParams.delete("invitation");
  try {
    page.remplacer(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* adresse non modifiable : le jeton est tout de même rangé */
  }
  if (!JETON_RE.test(jeton)) return null;
  try {
    page.session?.setItem(INVITATION_KEY, jeton);
  } catch {
    /* stockage refusé : le jeton n'est pas gardé */
  }
  return jeton;
}

/** Le jeton rangé pour cette visite, ou `null` (jamais reçu, oublié, illisible, stockage refusé). */
export function invitationRangee(session: Pick<Storage, "getItem"> | null | undefined): string | null {
  try {
    const v = session?.getItem(INVITATION_KEY);
    return v && JETON_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Oublie le jeton (accepté, refusé pour de bon, `invalid_invitation`). */
export function oublierInvitation(session: Pick<Storage, "removeItem"> | null | undefined): void {
  try {
    session?.removeItem(INVITATION_KEY);
  } catch {
    /* tant pis */
  }
}

// --- Le filtre « Tous / Amis » dans l'adresse ---------------------------------------------------------------------------------------------------------------------------------------

export type FiltreAmis = "tous" | "amis" | "groupe";
/** Le paramètre d'adresse du filtre. */
export const PARAMETRE_FILTRE = "filtre";

/** Le filtre d'une adresse (`location.search`) : `?filtre=amis` → `amis`, `?filtre=groupe` (lot C1, partie C : mon groupe) → `groupe`, tout le reste → `tous`. */
export function lireFiltre(search: string): FiltreAmis {
  const f = new URLSearchParams(search).get(PARAMETRE_FILTRE);
  return f === "amis" || f === "groupe" ? f : "tous";
}

/** La même adresse (relative ou absolue) avec le filtre : `?filtre=amis` pour « amis », rien pour « tous » ; les autres paramètres (`?vue=`, `?date=`) et le fragment restent. */
export function adresseAvecFiltre(adresse: string, filtre: FiltreAmis): string {
  const diese = adresse.indexOf("#");
  const fragment = diese < 0 ? "" : adresse.slice(diese);
  const sansFragment = diese < 0 ? adresse : adresse.slice(0, diese);
  const point = sansFragment.indexOf("?");
  const chemin = point < 0 ? sansFragment : sansFragment.slice(0, point);
  const params = new URLSearchParams(point < 0 ? "" : sansFragment.slice(point + 1));
  if (filtre !== "tous") params.set(PARAMETRE_FILTRE, filtre);
  else params.delete(PARAMETRE_FILTRE);
  const reste = params.toString();
  return `${chemin}${reste ? `?${reste}` : ""}${fragment}`;
}
