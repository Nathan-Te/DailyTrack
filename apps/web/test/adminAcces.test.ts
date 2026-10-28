import { describe, expect, it } from "vitest";
import { LIEN_CONNEXION, TEXTES_ACCES, accesDeLaSession, accesSansReseau, verifierAcces } from "../src/adminAcces";

// La page /track/admin/ ne s'ouvre que par la session du panneau d'administration (SSO) : décisions pures, puis la lecture de `GET /api/admin/session`.

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
    const reponse = (status: number): typeof fetch => (async (url: RequestInfo | URL, init?: RequestInit) => {
      appels.push({ url: String(url), init });
      return { status } as Response;
    }) as typeof fetch;
    expect(await verifierAcces("https://playdujour.com", prod, reponse(200))).toEqual({ ouvert: true, mode: "session" });
    expect(appels[0]!.url).toBe("https://playdujour.com/api/admin/session");
    expect(appels[0]!.init?.credentials).toBe("same-origin");
    expect(JSON.stringify(appels[0]!.init?.headers ?? {})).not.toMatch(/authorization|bearer/i);
    expect(await verifierAcces("https://playdujour.com", prod, reponse(401))).toEqual({ ouvert: false, raison: "session" });
    const panne = (async () => {
      throw new TypeError("réseau");
    }) as unknown as typeof fetch;
    expect(await verifierAcces("https://playdujour.com", prod, panne)).toEqual({ ouvert: false, raison: "indisponible" });
  });
});

describe("la porte", () => {
  it("chaque refus a son texte ; seuls ceux qu'une connexion règle ont le lien", () => {
    for (const r of Object.values(TEXTES_ACCES)) expect(r.titre && r.texte).toBeTruthy();
    expect(TEXTES_ACCES.session.connexion).toBe(true);
    expect(TEXTES_ACCES.indisponible.connexion).toBe(false);
  });
  it("le lien de connexion mène au panneau et lui dit où revenir (un chemin du site, jamais une adresse extérieure)", () => {
    expect(LIEN_CONNEXION).toBe("../../admin/?retour=%2Ftrack%2Fadmin%2F");
    expect(decodeURIComponent(LIEN_CONNEXION.split("retour=")[1]!)).toBe("/track/admin/");
  });
});
