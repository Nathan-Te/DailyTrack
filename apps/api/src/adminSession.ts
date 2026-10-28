import type { SqlDb } from "./db";
import { base64urlVersOctets, octetsVersBase64url } from "./adminGoogle";

// Lot N1 (plateforme) : la session du panneau d'administration.
//
//   - un cookie **`__session`** (le seul nom que Firebase Hosting transmet à Cloud Run), `HttpOnly`, `Secure`, `SameSite=Strict`, valable **1 heure** ;
//   - sa valeur : `<charge>.<signature>` ; la charge est `{ s: identifiant de session, a: empreinte de l'administrateur, e: expiration }` en base64url, la
//     signature un HMAC-SHA-256 de la charge avec le secret `cdj-admin-session-key`. **Aucune adresse en clair** : seulement l'empreinte (`a`) ;
//   - **révocable côté serveur** : la session est aussi une ligne de `admin_sessions` (identifiant tiré au hasard) ; la déconnexion y écrit `revoked_at`, et
//     chaque requête vérifie que la ligne existe et n'est pas révoquée. Une signature valide ne suffit donc pas.

export const SESSION_COOKIE = "__session";
/** Durée d'une session : une heure, sans prolongation (se reconnecter ensuite). */
export const SESSION_MS = 3_600_000;
/** Les lignes de `admin_sessions` finies depuis plus d'un jour sont effacées (à la connexion suivante). */
export const SESSIONS_GARDEES_MS = 24 * 3_600_000;

export interface Session {
  /** L'identifiant de session (aléatoire, 128 bits). */
  id: string;
  /** L'empreinte de l'administrateur (jamais son adresse). */
  admin: string;
  /** Fin de validité (ms). */
  expire: number;
}

export interface SessionsOptions {
  db: SqlDb;
  now: () => number;
  /** Le secret `cdj-admin-session-key` (32 caractères au moins : vérifié par `config.ts`). */
  cle: string;
}

const encoder = new TextEncoder();

export function createSessions({ db, now, cle }: SessionsOptions) {
  let hmac: Promise<CryptoKey> | null = null;
  const cleHmac = () => (hmac ??= crypto.subtle.importKey("raw", encoder.encode(cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));

  async function signer(charge: string): Promise<string> {
    return octetsVersBase64url(new Uint8Array(await crypto.subtle.sign("HMAC", await cleHmac(), encoder.encode(charge))));
  }

  /** L'empreinte d'un administrateur : HMAC de son adresse (jamais l'adresse, et pas un hachage nu qu'on retrouverait par essais). 12 hexadécimaux. */
  async function empreinteAdmin(email: string): Promise<string> {
    const sig = await crypto.subtle.sign("HMAC", await cleHmac(), encoder.encode(`admin:${email}`));
    return [...new Uint8Array(sig)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Ouvre une session : une ligne en base et la valeur du cookie. */
  async function ouvrir(admin: string): Promise<{ cookie: string; session: Session }> {
    const t = now();
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const expire = t + SESSION_MS;
    await db.run("DELETE FROM admin_sessions WHERE expires_at < ?", [t - SESSIONS_GARDEES_MS]);
    await db.run("INSERT INTO admin_sessions (sid, admin, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)", [id, admin, t, expire]);
    const charge = octetsVersBase64url(encoder.encode(JSON.stringify({ s: id, a: admin, e: expire })));
    return { cookie: `${charge}.${await signer(charge)}`, session: { id, admin, expire } };
  }

  /** La session d'une valeur de cookie, ou `null` (forme, signature, expiration, ligne absente ou révoquée : sans dire laquelle). */
  async function lire(valeur: string | null | undefined): Promise<Session | null> {
    if (!valeur || valeur.length > 600) return null;
    const point = valeur.indexOf(".");
    if (point < 1 || valeur.indexOf(".", point + 1) !== -1) return null;
    const charge = valeur.slice(0, point);
    let signature: Uint8Array;
    let contenu: { s?: unknown; a?: unknown; e?: unknown };
    try {
      signature = base64urlVersOctets(valeur.slice(point + 1));
      contenu = JSON.parse(new TextDecoder().decode(base64urlVersOctets(charge)));
    } catch {
      return null;
    }
    // crypto.subtle.verify compare en temps constant.
    if (!(await crypto.subtle.verify("HMAC", await cleHmac(), signature as BufferSource, encoder.encode(charge)))) return null;
    if (typeof contenu.s !== "string" || typeof contenu.a !== "string" || typeof contenu.e !== "number") return null;
    if (contenu.e <= now()) return null;
    const ligne = await db.first<{ admin: string; expires_at: number; revoked_at: number | null }>("SELECT admin, expires_at, revoked_at FROM admin_sessions WHERE sid = ?", [contenu.s]);
    if (!ligne || ligne.revoked_at !== null || ligne.expires_at <= now() || ligne.admin !== contenu.a) return null;
    return { id: contenu.s, admin: contenu.a, expire: ligne.expires_at };
  }

  /** Révoque la session côté serveur (le cookie qui la porte ne vaut plus rien, même sans être effacé). */
  async function revoquer(id: string): Promise<void> {
    await db.run("UPDATE admin_sessions SET revoked_at = ? WHERE sid = ? AND revoked_at IS NULL", [now(), id]);
  }

  return { ouvrir, lire, revoquer, empreinteAdmin };
}

export type Sessions = ReturnType<typeof createSessions>;

/** La valeur du cookie `__session` d'une requête, ou `null`. */
export function cookieDe(req: Request): string | null {
  const brut = req.headers.get("cookie");
  if (!brut) return null;
  for (const morceau of brut.split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0 && morceau.slice(0, i).trim() === SESSION_COOKIE) return morceau.slice(i + 1).trim();
  }
  return null;
}

/** L'en-tête `Set-Cookie` d'une session ouverte. */
export const cookieOuvert = (valeur: string): string => `${SESSION_COOKIE}=${valeur}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`;
/** L'en-tête `Set-Cookie` qui efface le cookie (déconnexion). */
export const cookieEfface = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
