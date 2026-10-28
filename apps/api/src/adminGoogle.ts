// Lot N1 (plateforme) : la vérification du jeton d'identité Google (Google Identity Services) du panneau d'administration, **sans dépendance** :
// signature RS256 vérifiée avec Web Crypto sur les clés publiques de Google (mises en cache selon leur `Cache-Control`), puis `iss`, `aud` (l'identifiant
// client), `exp` et `email_verified`. L'adresse n'est lue que pour la comparer à la liste du secret `cdj-admin-emails` : elle n'est jamais journalisée,
// rendue ni gardée (voir `adminSession.ts` : la session ne porte qu'une empreinte).
//
// Un refus a **une seule forme** pour l'appelant (401 `unauthorized`, `admin.ts`) : jamais « mauvaise adresse » ou « mauvais jeton ». La raison exacte
// (`RaisonRefus`) ne va que dans le journal du serveur, sans l'adresse.

export const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS: readonly string[] = ["https://accounts.google.com", "accounts.google.com"];
/** Un jeton d'identité Google fait ≈ 1 ko ; au-delà, ce n'en est pas un (borne avant tout décodage). */
const MAX_TOKEN_CHARS = 4096;
/** Tolérance d'horloge entre Google et nous (secondes) : `exp` et `iat`. */
const SKEW_S = 60;
/** Bornes de la durée de garde des clés (secondes), quoi que dise `Cache-Control`. */
const KEYS_MIN_S = 60;
const KEYS_MAX_S = 24 * 3600;
const KEYS_DEFAULT_S = 3600;
/** Une clé inconnue (rotation) provoque au plus une relecture des clés par minute (un jeton forgé ne fait pas appeler Google en boucle). */
const REFETCH_MIN_MS = 60_000;

export type RaisonRefus = "forme" | "algorithme" | "cle_inconnue" | "cles_indisponibles" | "signature" | "iss" | "aud" | "exp" | "iat" | "email_non_verifie" | "hors_liste" | "factice_interdit";

export class RefusGoogle extends Error {
  constructor(readonly raison: RaisonRefus) {
    super(raison);
  }
}

/** Ce qu'un vérificateur rend : l'adresse (minuscules) d'un jeton valide ; elle sert une seule fois, à chercher la liste puis à calculer une empreinte. */
export type Verificateur = (jeton: string) => Promise<{ email: string }>;

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function base64urlVersOctets(texte: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(texte)) throw new RefusGoogle("forme");
  const base64 = texte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(texte.length / 4) * 4, "=");
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function octetsVersBase64url(octets: Uint8Array): string {
  let bin = "";
  for (const b of octets) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonDe(partie: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(decoder.decode(base64urlVersOctets(partie)));
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch (e) {
    if (e instanceof RefusGoogle) throw e;
  }
  throw new RefusGoogle("forme");
}

/** La durée de garde annoncée par `Cache-Control: … max-age=N` (secondes), bornée ; sans `max-age` : une heure. */
export function dureeDeGarde(cacheControl: string | null): number {
  const m = /max-age=(\d+)/i.exec(cacheControl ?? "");
  const s = m ? Number(m[1]) : KEYS_DEFAULT_S;
  return Math.min(KEYS_MAX_S, Math.max(KEYS_MIN_S, Number.isFinite(s) ? s : KEYS_DEFAULT_S));
}

export interface GoogleOptions {
  /** L'identifiant client OAuth (public) : doit être l'audience (`aud`) du jeton. */
  clientId: string;
  now: () => number;
  /** `fetch` (injecté : les tests servent leurs propres clés, aucun réseau). */
  fetchFn?: typeof fetch;
  /** L'adresse des clés publiques (tests). */
  certsUrl?: string;
}

/** Le vérificateur réel : clés de Google en cache, signature, puis les revendications. Ne connaît pas la liste des adresses (`admin.ts`). */
export function createGoogleVerifier(options: GoogleOptions): Verificateur & { cles(): number } {
  const fetchFn = options.fetchFn ?? fetch;
  const certsUrl = options.certsUrl ?? GOOGLE_CERTS_URL;
  let keys = new Map<string, Jwk>();
  let expireA = 0;
  let relueA = -Infinity;
  let enCours: Promise<void> | null = null;
  const importees = new Map<string, Promise<CryptoKey>>();

  async function relire(): Promise<void> {
    const t = options.now();
    relueA = t;
    let res: Response;
    try {
      res = await fetchFn(certsUrl, { headers: { accept: "application/json" } });
    } catch {
      throw new RefusGoogle("cles_indisponibles");
    }
    if (!res.ok) throw new RefusGoogle("cles_indisponibles");
    let corps: unknown;
    try {
      corps = await res.json();
    } catch {
      throw new RefusGoogle("cles_indisponibles");
    }
    const liste = (corps as { keys?: unknown })?.keys;
    if (!Array.isArray(liste)) throw new RefusGoogle("cles_indisponibles");
    const neuves = new Map<string, Jwk>();
    for (const k of liste as Partial<Jwk>[]) {
      if (typeof k?.kid === "string" && k.kty === "RSA" && typeof k.n === "string" && typeof k.e === "string") neuves.set(k.kid, k as Jwk);
    }
    if (neuves.size === 0) throw new RefusGoogle("cles_indisponibles");
    keys = neuves;
    importees.clear();
    expireA = t + dureeDeGarde(res.headers.get("cache-control")) * 1000;
  }

  /** Les clés à jour : relues quand elles ont expiré, ou (au plus une fois par minute) quand le jeton en nomme une qu'on ne connaît pas. */
  async function cle(kid: string): Promise<CryptoKey> {
    const t = options.now();
    const perimees = t >= expireA;
    if (perimees || (!keys.has(kid) && t - relueA >= REFETCH_MIN_MS)) {
      enCours ??= relire().finally(() => {
        enCours = null;
      });
      try {
        await enCours;
      } catch (e) {
        if (perimees) throw e; // pas de clé périmée : on ne vérifie jamais avec des clés dont la garde est finie
      }
    }
    const jwk = keys.get(kid);
    if (!jwk) throw new RefusGoogle("cle_inconnue");
    let importee = importees.get(kid);
    if (!importee) {
      importee = crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      importees.set(kid, importee);
    }
    return importee;
  }

  const verifier: Verificateur = async (jeton) => {
    if (typeof jeton !== "string" || jeton.length === 0 || jeton.length > MAX_TOKEN_CHARS) throw new RefusGoogle("forme");
    const parties = jeton.split(".");
    if (parties.length !== 3) throw new RefusGoogle("forme");
    const [entete, charge, signature] = parties as [string, string, string];
    const h = jsonDe(entete);
    if (h.alg !== "RS256") throw new RefusGoogle("algorithme"); // jamais « none » ni HS256 avec une clé publique
    if (typeof h.kid !== "string") throw new RefusGoogle("forme");
    const clePublique = await cle(h.kid);
    let ok = false;
    try {
      ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", clePublique, base64urlVersOctets(signature), encoder.encode(`${entete}.${charge}`));
    } catch {
      ok = false;
    }
    if (!ok) throw new RefusGoogle("signature");
    const c = jsonDe(charge);
    const maintenant = Math.floor(options.now() / 1000);
    if (typeof c.iss !== "string" || !ISSUERS.includes(c.iss)) throw new RefusGoogle("iss");
    if (c.aud !== options.clientId) throw new RefusGoogle("aud");
    if (typeof c.exp !== "number" || c.exp + SKEW_S < maintenant) throw new RefusGoogle("exp");
    if (typeof c.iat === "number" && c.iat - SKEW_S > maintenant) throw new RefusGoogle("iat");
    if (c.email_verified !== true && c.email_verified !== "true") throw new RefusGoogle("email_non_verifie");
    if (typeof c.email !== "string" || c.email.length === 0 || c.email.length > 254) throw new RefusGoogle("forme");
    return { email: c.email.trim().toLowerCase() };
  };
  return Object.assign(verifier, { cles: () => keys.size });
}

/**
 * Le vérificateur **factice** (tests locaux et CI seulement : `ADMIN_FAKE_VERIFIER`, refusé au démarrage en production et en recette par `config.ts`) :
 * le « jeton » est `factice:<adresse>`. Il ne vérifie rien d'autre que la liste (comme le vrai, ensuite).
 */
export const verificateurFactice: Verificateur = async (jeton) => {
  const m = /^factice:([^\s:]{3,254})$/.exec(typeof jeton === "string" ? jeton : "");
  if (!m) throw new RefusGoogle("forme");
  return { email: m[1]!.toLowerCase() };
};

/** SHA-256 en hexadécimal (empreinte de l'adresse, comparaison à la liste). */
export async function empreinte(texte: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", encoder.encode(texte));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** La liste du secret `cdj-admin-emails` : virgules, points-virgules, espaces ou retours à la ligne ; minuscules, adresses d'allure valide seulement. */
export function lireListeAdresses(brut: string | undefined): string[] {
  return [...new Set((brut ?? "").split(/[,;\s]+/).map((a) => a.trim().toLowerCase()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)))];
}
