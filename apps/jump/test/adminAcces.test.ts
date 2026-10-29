import { describe, expect, it } from "vitest";
import { LIEN_CONNEXION, TEXTES_ACCES, accesDeLaSession, accesSansReseau, baseDeLaPage, verifierAcces } from "../src/adminAcces";

// La page /jump/admin/ ne s'ouvre que par la session du panneau d'administration (SSO) : décisions pures, puis la lecture de `GET /api/admin/session`.
// Mêmes règles que la porte de /track/admin/ (`apps/web/test/adminAcces.test.ts`), retour vers /jump/admin/.

const prod = { production: true, memeOrigine: true };
const hors = { production: false, memeOrigine: true };

describe("ce que l'adresse décide sans réseau", () => {
  it("la démonstration et l'absence d'API n'ouvrent rien sur le site publié", () => {
    expect(accesSansReseau("demo", prod)).toEqual({ ouvert: false, raison: "demo-fermee" });
    expect(accesSansReseau("", prod)).toEqual({ ouvert: false, raison: "non-configure" });
  });
  it("hors production, la démonstration et le poste sans serveur ouvrent les outils (essais, recette, développement)", () => {
    expect(accesSansReseau("demo", hors)).toEqual({ ouvert: true, mode: "demo" });
    expect(accesSansReseau("", hors)).toEqual({ ouvert: true, mode: "local" });
  });
  it("une API d'une autre origine est refusée : un cookie ne vaut que pour le site lui-même", () => {
    expect(accesSansReseau("https://autre.example", { production: false, memeOrigine: false })).toEqual({ ouvert: false, raison: "autre-origine" });
  });
  it("la même origine demande au serveur", () => {
    expect(accesSansReseau("https://playdujour.com", prod)).toBeNull();
  });
});

describe("la réponse du serveur", () => {
  it("seul un 200 ouvre ; 401 : connexion ; 404 : pas de panneau ; le reste : injoignable", () => {
    expect(accesDeLaSession(200)).toEqual({ ouvert: true, mode: "session" });
    expect(accesDeLaSession(401)).toEqual({ ouvert: false, raison: "session" });
    expect(accesDeLaSession(404)).toEqual({ ouvert: false, raison: "non-configure" });
    for (const s of [0, 403, 429, 500, 502]) expect(accesDeLaSession(s)).toEqual({ ouvert: false, raison: "indisponible" });
  });

  it("verifierAcces lit /api/admin/session sur l'origine de la page, sans jeton, et ne lève jamais", async () => {
    const appels: { url: string; init?: RequestInit }[] = [];
    const reponse = (status: number): typeof fetch =>
      (async (url: RequestInfo | URL, init?: RequestInit) => {
        appels.push({ url: String(url), init });
        return { status } as Response;
      }) as typeof fetch;
    expect(await verifierAcces("https://playdujour.com", prod, reponse(200))).toEqual({ ouvert: true, mode: "session" });
    expect(appels[0]!.url).toBe("https://playdujour.com/api/admin/session");
    expect(appels[0]!.init).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(JSON.stringify(appels[0]!.init)).not.toMatch(/authorization|token|jeton/i);
    expect(await verifierAcces("https://playdujour.com", prod, reponse(401))).toEqual({ ouvert: false, raison: "session" });
    const panne = (async () => {
      throw new TypeError("réseau");
    }) as unknown as typeof fetch;
    expect(await verifierAcces("https://playdujour.com", prod, panne)).toEqual({ ouvert: false, raison: "indisponible" });
    expect(appels).toHaveLength(2);
  });

  it("une raison sans connexion possible n'offre pas le bouton ; chaque raison a ses mots", () => {
    expect(TEXTES_ACCES.session.connexion).toBe(true);
    expect(TEXTES_ACCES["demo-fermee"].connexion).toBe(true);
    for (const r of ["autre-origine", "non-configure", "indisponible"] as const) expect(TEXTES_ACCES[r].connexion).toBe(false);
    for (const t of Object.values(TEXTES_ACCES)) expect(t.titre && t.texte).toBeTruthy();
  });

  it("le lien de connexion ramène à /jump/admin/ (le panneau n'accepte que ce retour)", () => {
    expect(LIEN_CONNEXION.startsWith("../../admin/?retour=")).toBe(true);
    expect(decodeURIComponent(LIEN_CONNEXION.split("retour=")[1]!)).toBe("/jump/admin/");
  });
});

describe("l'API de la page", () => {
  const origine = "https://playdujour.com";
  it("`/` est l'origine de la page ; l'adresse de la construction sert sans `?api=`", () => {
    expect(baseDeLaPage("/", undefined, origine)).toBe(origine);
    expect(baseDeLaPage(null, "/", origine)).toBe(origine);
    expect(baseDeLaPage(null, undefined, origine)).toBe("");
    expect(baseDeLaPage("demo", "/", origine)).toBe("demo");
  });
  it("une autre adresse n'envoie rien nulle part : la porte la refuse avant tout appel", async () => {
    const base = baseDeLaPage("https://pirate.example/", "/", origine);
    expect(base).toBe("https://pirate.example");
    let appels = 0;
    const jamais = (async () => {
      appels++;
      return { status: 200 } as Response;
    }) as unknown as typeof fetch;
    expect(await verifierAcces(base, { production: true, memeOrigine: new URL(base).origin === origine }, jamais)).toEqual({ ouvert: false, raison: "autre-origine" });
    expect(appels).toBe(0);
  });
});
