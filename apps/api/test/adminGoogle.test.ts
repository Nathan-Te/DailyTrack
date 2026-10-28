import { beforeAll, describe, expect, it } from "vitest";
import { RefusGoogle, createGoogleVerifier, dureeDeGarde, lireListeAdresses, octetsVersBase64url, verificateurFactice } from "../src/adminGoogle";
import { ADMIN_EMAIL, CLIENT_ID, cleDeTest, fauxFetch, jeton, type CleDeTest } from "./adminHelpers";

// Lot N1 : la vérification du jeton d'identité Google, sans dépendance : signature RS256 (Web Crypto) sur les clés publiques de Google mises en cache selon leur
// `Cache-Control`, puis `iss`, `aud`, `exp`, `email_verified`. Aucun réseau : les clés sont servies par un faux `fetch`.

const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);
let cleA: CleDeTest;
let cleB: CleDeTest;

beforeAll(async () => {
  cleA = await cleDeTest("cle-a");
  cleB = await cleDeTest("cle-b");
});

function verificateur(etat: { cles: CleDeTest[]; cacheControl?: string; echec?: boolean; appels: number }, horloge = { now: T0 }) {
  return { horloge, v: createGoogleVerifier({ clientId: CLIENT_ID, now: () => horloge.now, fetchFn: fauxFetch(etat) }) };
}
const refus = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof RefusGoogle) return e.raison;
    throw e;
  }
  return "accepté";
};

describe("jeton d'identité Google : signature et revendications", () => {
  it("accepte un jeton valide et rend l'adresse en minuscules", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    const r = await v(await jeton(cleA, { now: T0, charge: { email: "Admin@Example.TEST" } }));
    expect(r).toEqual({ email: "admin@example.test" });
  });

  it("refuse une signature qui n'est pas celle de la clé publique (même `kid`, autre clé privée)", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    expect(await refus(v(await jeton(cleA, { now: T0, signerAvec: cleB.privee })))).toBe("signature");
  });

  it("refuse une charge modifiée après la signature", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    const [h, , s] = (await jeton(cleA, { now: T0 })).split(".");
    const autre = (await jeton(cleA, { now: T0, charge: { email: "pirate@example.test" } })).split(".")[1];
    expect(await refus(v(`${h}.${autre}.${s}`))).toBe("signature");
  });

  it("refuse une audience qui n'est pas notre identifiant client", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { aud: "666-autre.apps.googleusercontent.com" } })))).toBe("aud");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { aud: [CLIENT_ID] } })))).toBe("aud"); // une liste n'est pas une audience unique
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { aud: undefined } })))).toBe("aud");
  });

  it("refuse un émetteur qui n'est pas Google (les deux écritures de Google passent)", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { iss: "https://evil.example" } })))).toBe("iss");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { iss: "accounts.google.com" } })))).toBe("accepté");
  });

  it("refuse un jeton expiré (avec une minute de tolérance d'horloge) et un jeton émis dans le futur", async () => {
    const { v, horloge } = verificateur({ cles: [cleA], appels: 0 });
    const j = await jeton(cleA, { now: T0 }); // expire une heure plus tard
    horloge.now = T0 + 3_600_000 + 30_000;
    expect(await refus(v(j))).toBe("accepté"); // 30 s de retard : dans la tolérance
    horloge.now = T0 + 3_600_000 + 61_000;
    expect(await refus(v(j))).toBe("exp");
    horloge.now = T0;
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { exp: undefined } })))).toBe("exp");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { iat: Math.floor(T0 / 1000) + 3600 } })))).toBe("iat");
  });

  it("refuse une adresse non vérifiée par Google (`true` en texte passe, comme Google l'écrit parfois)", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { email_verified: false } })))).toBe("email_non_verifie");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { email_verified: undefined } })))).toBe("email_non_verifie");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { email_verified: "true" } })))).toBe("accepté");
    expect(await refus(v(await jeton(cleA, { now: T0, charge: { email: undefined } })))).toBe("forme");
  });

  it("refuse un autre algorithme que RS256 (jamais « none », ni HS256 signé avec la clé publique)", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    expect(await refus(v(await jeton(cleA, { now: T0, entete: { alg: "none" } })))).toBe("algorithme");
    expect(await refus(v(await jeton(cleA, { now: T0, entete: { alg: "HS256" } })))).toBe("algorithme");
    const sans = (await jeton(cleA, { now: T0 })).split(".").slice(0, 2).join(".");
    expect(await refus(v(`${sans}.`))).toBe("signature");
  });

  it("refuse ce qui n'a pas la forme d'un jeton : vide, trop long, pas de trois parties, base64 illisible", async () => {
    const { v } = verificateur({ cles: [cleA], appels: 0 });
    for (const x of ["", "a.b", "a.b.c.d", "é.é.é", "x".repeat(5000), "!!!.@@@.###"]) expect(await refus(v(x)), x.slice(0, 10)).toBe("forme");
    expect(await refus(v(undefined as unknown as string))).toBe("forme");
  });
});

describe("clés de Google : cache selon Cache-Control", () => {
  it("ne relit les clés qu'à l'expiration de leur `max-age`", async () => {
    const etat = { cles: [cleA], cacheControl: "public, max-age=600, must-revalidate", appels: 0 };
    const { v, horloge } = verificateur(etat);
    const j = await jeton(cleA, { now: T0 });
    await v(j);
    await v(j);
    horloge.now = T0 + 599_000;
    await v(j);
    expect(etat.appels).toBe(1);
    horloge.now = T0 + 601_000;
    await v(await jeton(cleA, { now: horloge.now }));
    expect(etat.appels).toBe(2);
  });

  it("borne la durée de garde : au moins une minute, au plus un jour ; une heure sans `max-age`", () => {
    expect(dureeDeGarde("public, max-age=5")).toBe(60);
    expect(dureeDeGarde("max-age=99999999")).toBe(86_400);
    expect(dureeDeGarde("public, max-age=19000, must-revalidate")).toBe(19_000);
    expect(dureeDeGarde(null)).toBe(3600);
    expect(dureeDeGarde("no-store")).toBe(3600);
  });

  it("une clé nouvelle (rotation) déclenche une relecture, au plus une par minute : un jeton forgé ne fait pas appeler Google en boucle", async () => {
    const etat = { cles: [cleA], appels: 0 };
    const { v, horloge } = verificateur(etat);
    await v(await jeton(cleA, { now: T0 }));
    expect(etat.appels).toBe(1);
    etat.cles = [cleA, cleB]; // Google fait tourner ses clés
    horloge.now = T0 + 5000;
    expect(await refus(v(await jeton(cleB, { now: horloge.now })))).toBe("cle_inconnue"); // relue il y a moins d'une minute : on ne relit pas
    expect(etat.appels).toBe(1);
    horloge.now = T0 + 61_000;
    expect(await refus(v(await jeton(cleB, { now: horloge.now })))).toBe("accepté");
    expect(etat.appels).toBe(2);
    const forgee = await jeton(cleA, { now: horloge.now, entete: { kid: "inconnue" } });
    for (let i = 0; i < 5; i++) expect(await refus(v(forgee))).toBe("cle_inconnue");
    expect(etat.appels).toBe(2); // clés relues à l'instant : aucune relecture pour cinq jetons forgés
    horloge.now += 61_000;
    for (let i = 0; i < 5; i++) expect(await refus(v(forgee))).toBe("cle_inconnue");
    expect(etat.appels).toBe(3); // une minute plus tard : une seule relecture pour cinq jetons forgés
  });

  it("des clés périmées ne servent jamais : si Google ne répond pas à l'expiration, tout est refusé", async () => {
    const etat = { cles: [cleA], cacheControl: "max-age=60", appels: 0, echec: false };
    const { v, horloge } = verificateur(etat);
    await v(await jeton(cleA, { now: T0 }));
    etat.echec = true;
    horloge.now = T0 + 61_000;
    expect(await refus(v(await jeton(cleA, { now: horloge.now })))).toBe("cles_indisponibles");
  });

  it("Google injoignable dès le départ : refus, sans planter", async () => {
    const etat = { cles: [cleA], appels: 0, echec: true };
    const { v } = verificateur(etat);
    expect(await refus(v(await jeton(cleA, { now: T0 })))).toBe("cles_indisponibles");
  });
});

describe("liste des adresses et vérificateur factice", () => {
  it("lit la liste du secret : virgules, points-virgules, espaces, lignes ; minuscules, sans doublon, adresses valides seulement", () => {
    expect(lireListeAdresses("A@example.test, b@example.test;\nA@EXAMPLE.test  pas-une-adresse")).toEqual(["a@example.test", "b@example.test"]);
    expect(lireListeAdresses(undefined)).toEqual([]);
    expect(lireListeAdresses("   ")).toEqual([]);
  });

  it("le vérificateur factice n'accepte que `factice:<adresse>`", async () => {
    expect(await verificateurFactice(`factice:${ADMIN_EMAIL}`)).toEqual({ email: ADMIN_EMAIL });
    expect(await refus(verificateurFactice("n'importe quoi"))).toBe("forme");
    expect(await refus(verificateurFactice(`factice:${ADMIN_EMAIL}:x`))).toBe("forme");
  });

  it("base64url : aller-retour sans remplissage", () => {
    expect(octetsVersBase64url(new Uint8Array([251, 255, 254]))).toBe("-__-");
  });
});
