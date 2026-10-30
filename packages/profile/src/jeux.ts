import { call, type FetchLike } from "./client";

// Lot P de la plateforme — l'**interrupteur des jeux** côté client. Chaque jeu, à son ouverture, lit l'état des jeux (`GET /api/jeux`, public, cache de 30 s) et décide ce qu'il montre :
// le jeu (`on`), le jeu avec le bandeau « Aperçu » (`preview` et une clé d'aperçu sur cet appareil, ou un aperçu de PR), ou la page « Bientôt » (`off`, ou `preview` sans clé).
// **Sans réseau, ou si l'API ne répond pas** : la liste construite dans le site (`etatsParDefaut` de `@cdj/core/jeux`) où seuls les jeux **déjà publics** sont `on` ; un jeu en développement n'apparaît donc jamais par défaut.
// **La clé d'aperçu ne passe jamais dans une adresse d'API** : le lien d'aperçu (`/<jeu>/?apercu=<clé>`) la range dans le stockage local puis la retire aussitôt de l'adresse (`history.replaceState`) ;
// ensuite le jeu l'envoie dans l'en-tête `X-Preview-Key` (même raison que `?player=` retiré : une adresse finit dans les journaux). Pur : stockage, adresse, réseau injectés ; aucun DOM.

// Le module de profil n'importe aucun paquet (test `purete.test.ts`) : les quelques règles pures de `@cdj/core/jeux` dont le client a besoin sont recopiées ici, et le test `jeux.test.ts`
// de ce paquet vérifie qu'elles disent la même chose que celles du serveur.
export type EtatJeu = "off" | "preview" | "on";
/** Les jeux déjà publics à l'arrivée de l'interrupteur : la liste du site quand l'API ne répond pas (un jeu en développement n'y est jamais). Même liste que `JEUX_PUBLICS` de `@cdj/core/jeux`. */
export const JEUX_PUBLICS_PAR_DEFAUT: readonly string[] = ["track", "jump"];
export const etatDeJeu = (brut: unknown): EtatJeu => (brut === "on" || brut === "preview" ? brut : "off");
export const etatsParDefaut = (): Record<string, EtatJeu> => Object.fromEntries(JEUX_PUBLICS_PAR_DEFAUT.map((j) => [j, "on" as EtatJeu]));
/** L'état d'un jeu dans une liste : absent = `off`. */
export const etatDansListe = (etats: Readonly<Record<string, unknown>> | null | undefined, jeu: string): EtatJeu => (etats && Object.hasOwn(etats, jeu) ? etatDeJeu(etats[jeu]) : "off");
/** La liste d'états d'une réponse de `GET /api/jeux` (illisible : `null`). */
export function etatsDeReponse(brut: unknown): Record<string, EtatJeu> | null {
  const j = (brut as { jeux?: unknown } | null)?.jeux;
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  return Object.fromEntries(Object.entries(j as Record<string, unknown>).map(([k, v]) => [k, etatDeJeu(v)]));
}

/** La clé d'aperçu d'un jeu, gardée sur l'appareil de qui l'a reçue (un réglage de l'appareil, pas une donnée de joueur : jamais effacée au « Nouveau départ »). */
export const cleApercuKey = (jeu: string): string => `cdj:apercu:${jeu}`;
/** L'en-tête qui porte la clé d'aperçu vers l'API. */
export const ENTETE_APERCU = "X-Preview-Key";

export type StockageApercu = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** La clé d'aperçu gardée pour ce jeu, ou `null` (jamais reçue, ou stockage refusé). */
export function lireCleApercu(stockage: Pick<Storage, "getItem"> | null | undefined, jeu: string): string | null {
  try {
    const v = stockage?.getItem(cleApercuKey(jeu));
    return v && v.length <= 128 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Le lien d'aperçu est ouvert : si l'adresse porte `?apercu=<clé>`, la clé est rangée dans le stockage et **l'adresse sans elle** est rendue (à poser par `history.replaceState`) ; sinon `null`.
 * Une clé illisible (vide, trop longue, caractères hors de l'alphabet d'adresse) est retirée de l'adresse sans être gardée.
 */
export function adopterCleApercu(jeu: string, adresse: { pathname: string; search: string; hash: string }, stockage: Pick<Storage, "setItem"> | null | undefined): { cle: string | null; adresse: string } | null {
  const params = new URLSearchParams(adresse.search);
  if (!params.has("apercu")) return null;
  const cle = params.get("apercu") ?? "";
  params.delete("apercu");
  const reste = params.toString();
  const propre = `${adresse.pathname}${reste ? `?${reste}` : ""}${adresse.hash}`;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(cle)) return { cle: null, adresse: propre };
  try {
    stockage?.setItem(cleApercuKey(jeu), cle);
  } catch {
    /* stockage refusé : l'aperçu ne s'ouvrira pas, rien ne casse */
  }
  return { cle, adresse: propre };
}

/** Un `fetch` qui ajoute `X-Preview-Key` aux seuls appels à l'API de la plateforme (`/api/…` de `base`) : la clé ne va jamais ailleurs ni dans une adresse. */
export function fetchAvecCleApercu(base: string, cle: string, fetchImpl: FetchLike): FetchLike {
  const prefixe = `${base.replace(/\/+$/, "")}/api/`;
  return (input, init) => {
    const url = typeof input === "string" ? input : String(input);
    if (!url.startsWith(prefixe)) return fetchImpl(input, init);
    const entetes = new Headers(init?.headers);
    entetes.set(ENTETE_APERCU, cle);
    return fetchImpl(input, { ...init, headers: entetes });
  };
}

/** Lit `GET /api/jeux` : la liste des états, ou `null` sans réponse lisible (le site prend alors la liste construite). Ne lève jamais. */
export async function lireEtatsDesJeux(base: string, fetchImpl?: FetchLike): Promise<{ etats: Record<string, EtatJeu>; apercuDePr: boolean } | null> {
  const r = await call<unknown>(base, "GET", "/api/jeux", undefined, 5000, undefined, fetchImpl);
  if (!r.ok) return null;
  const etats = etatsDeReponse(r.data);
  return etats ? { etats, apercuDePr: (r.data as { apercu?: unknown }).apercu === true } : null;
}

/** Ce qu'un jeu montre : le jeu (`ouvert`), le jeu avec le bandeau (`apercu`, `brouillon` si le jeu n'est pas encore `on` mais montré par un aperçu de PR), ou la page « Bientôt ». */
export type Ouverture = { vue: "ouvert" } | { vue: "apercu"; brouillon: boolean } | { vue: "bientot" };

/**
 * Décide ce que le jeu `jeu` (son dossier sur le site) montre. `etats` : la liste lue (`null` : pas de réponse → `etatsParDefaut`) ; `cle` : la clé d'aperçu de cet appareil ; `apercuDePr` : la réponse
 * de l'API dit que ce site est un aperçu de PR (qui voit tous les jeux). Un jeu `on` s'ouvre pour tous ; `preview` seulement avec une clé ; `off` jamais (sauf un aperçu de PR).
 */
export function ouvertureDuJeu(jeu: string, lecture: { etats: Record<string, EtatJeu>; apercuDePr: boolean } | null, cle: string | null): Ouverture {
  const etats = lecture?.etats ?? etatsParDefaut();
  const etat = etatDansListe(etats, jeu);
  if (etat === "on") return { vue: "ouvert" };
  if (lecture?.apercuDePr) return { vue: "apercu", brouillon: true };
  if (etat === "preview" && cle) return { vue: "apercu", brouillon: false };
  return { vue: "bientot" };
}

// --- Le démarrage d'un jeu --------------------------------------------------------------------------------------------------------------
export interface OptionsInterrupteur {
  /** Le dossier du jeu sur le site (`track`, `jump`). */
  jeu: string;
  /** Le préfixe de l'API de la page (`apiBase()` du jeu) ; `null` ou la démonstration (`demo`) : pas de serveur, le jeu s'ouvre (liste construite : un jeu déjà public). */
  base: string | null;
  stockage: StockageApercu | null | undefined;
  adresse: { pathname: string; search: string; hash: string };
  /** Pose l'adresse sans la clé (`history.replaceState`). */
  remplacerAdresse: (adresse: string) => void;
  /** Fait porter `X-Preview-Key` à tout appel de la page à l'API (enveloppe de `window.fetch`) : appelé seulement quand une clé est gardée. */
  poserCle: (cle: string) => void;
  fetchImpl?: FetchLike;
}

/**
 * Le démarrage d'un jeu devant l'interrupteur : (1) le lien d'aperçu range sa clé et la retire de l'adresse ; (2) une clé gardée est portée par l'en-tête `X-Preview-Key` ; (3) l'état des jeux est
 * lu (`GET /api/jeux`, repli : la liste construite) ; (4) ce que le jeu montre est décidé. Ne lève jamais.
 */
export async function demarrerInterrupteur(o: OptionsInterrupteur): Promise<Ouverture> {
  const adoptee = adopterCleApercu(o.jeu, o.adresse, o.stockage);
  if (adoptee) o.remplacerAdresse(adoptee.adresse);
  if (o.base === null || o.base === "demo") return { vue: "ouvert" };
  const cle = lireCleApercu(o.stockage, o.jeu);
  if (cle) o.poserCle(cle);
  return ouvertureDuJeu(o.jeu, await lireEtatsDesJeux(o.base, o.fetchImpl), cle);
}
