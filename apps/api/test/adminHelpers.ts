import { octetsVersBase64url } from "../src/adminGoogle";

// Lot N1 : de quoi fabriquer de vrais jetons d'identité Google (RS256) et servir « les clés de Google » sans réseau. Les adresses de ces tests sont fictives
// (`example.test`) : l'adresse de l'éditeur n'est jamais dans le dépôt.

export const CLIENT_ID = "123456789012-testtesttest.apps.googleusercontent.com";
export const ADMIN_EMAIL = "admin@example.test";
export const SESSION_KEY = "cle-de-session-de-test-assez-longue-pour-passer";

const enc = new TextEncoder();
const b64 = (v: unknown) => octetsVersBase64url(enc.encode(JSON.stringify(v)));

export interface CleDeTest {
  kid: string;
  privee: CryptoKey;
  jwk: JsonWebKey & { kid: string };
}

/** Une paire RSA de test (2048 bits, comme Google) et sa clé publique au format JWK avec son `kid`. */
export async function cleDeTest(kid: string): Promise<CleDeTest> {
  const paire = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = (await crypto.subtle.exportKey("jwk", paire.publicKey)) as JsonWebKey;
  return { kid, privee: paire.privateKey, jwk: { ...jwk, kid, alg: "RS256", use: "sig" } };
}

/** Un jeton signé. `charge` complète ou remplace les revendications valides par défaut (`undefined` retire la revendication). */
export async function jeton(
  cle: CleDeTest,
  o: { now: number; charge?: Record<string, unknown>; entete?: Record<string, unknown>; signerAvec?: CryptoKey },
): Promise<string> {
  const s = Math.floor(o.now / 1000);
  const charge: Record<string, unknown> = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: s + 3600,
    iat: s - 5,
    email: ADMIN_EMAIL,
    email_verified: true,
    ...o.charge,
  };
  for (const k of Object.keys(charge)) if (charge[k] === undefined) delete charge[k];
  const entete = b64({ alg: "RS256", kid: cle.kid, typ: "JWT", ...o.entete });
  const corps = b64(charge);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", o.signerAvec ?? cle.privee, enc.encode(`${entete}.${corps}`));
  return `${entete}.${corps}.${octetsVersBase64url(new Uint8Array(signature))}`;
}

/** Un faux `fetch` qui sert les clés données (et compte les appels), avec le `Cache-Control` voulu. */
export function fauxFetch(etat: { cles: CleDeTest[]; cacheControl?: string; echec?: boolean; appels: number }): typeof fetch {
  return (async () => {
    etat.appels++;
    if (etat.echec) return new Response("erreur", { status: 500 });
    return new Response(JSON.stringify({ keys: etat.cles.map((c) => c.jwk) }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": etat.cacheControl ?? "public, max-age=19000, must-revalidate, no-transform" },
    });
  }) as typeof fetch;
}
