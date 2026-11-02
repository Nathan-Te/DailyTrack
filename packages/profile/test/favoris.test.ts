import { describe, expect, it } from "vitest";
import { FAVORIS_MAX as MAX_CORE, listeDeFavoris } from "@cdj/core/favoris";
import { FAVORIS_KEY, FAVORIS_MAX, aReprendre, basculer, ecrireFavorisLocaux, lireFavorisLocaux, listeAffichee, listeLue } from "../src/favoris";
import { enregistrerFavoris } from "../src/favorisReseau";

// Lot F1 : « Mes jeux » côté client — le stockage du visiteur, la reprise dans le profil à sa création, ce que l'accueil dessine. Stockage et réseau injectés.
const memoire = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), d };
};

describe("la forme d'une liste, la même que celle du serveur", () => {
  it("accepte et refuse les mêmes noms que @cdj/core/favoris", () => {
    expect(FAVORIS_MAX).toBe(MAX_CORE);
    for (const x of ["track", "jump", "tower", "a-b", "x1", "Track", "../x", "", "a b", "é"]) expect(listeLue([x]).length === 1, x).toBe(listeDeFavoris([x]) !== null);
  });
  it("lue avec prudence : le reste est écarté, sans doublon, au plus FAVORIS_MAX", () => {
    expect(listeLue(["track", "track", 3, null, "jump"])).toEqual(["track", "jump"]);
    expect(listeLue("track")).toEqual([]);
    expect(listeLue(Array.from({ length: 30 }, (_, i) => `j${i}`))).toHaveLength(FAVORIS_MAX);
  });
});

describe("le stockage du navigateur (`cdj:favoris`)", () => {
  it("écrit puis relit ; une liste vide efface la clé ; sans stockage ou illisible : aucun favori, rien ne lève", () => {
    const s = memoire();
    ecrireFavorisLocaux(s, { jeux: ["track"], attente: true });
    expect(s.d.has(FAVORIS_KEY)).toBe(true);
    expect(lireFavorisLocaux(s)).toEqual({ jeux: ["track"], attente: true });
    ecrireFavorisLocaux(s, { jeux: [], attente: false });
    expect(s.d.has(FAVORIS_KEY)).toBe(false);
    expect(lireFavorisLocaux(s)).toEqual({ jeux: [], attente: false });
    expect(lireFavorisLocaux(null)).toEqual({ jeux: [], attente: false });
    s.d.set(FAVORIS_KEY, "pas du json");
    expect(lireFavorisLocaux(s)).toEqual({ jeux: [], attente: false });
    const refuse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); }, removeItem: () => { throw new Error("refusé"); } };
    expect(lireFavorisLocaux(refuse)).toEqual({ jeux: [], attente: false });
    expect(() => ecrireFavorisLocaux(refuse, { jeux: ["track"], attente: true })).not.toThrow();
  });
});

describe("toucher une étoile", () => {
  it("épingle ou retire, sans perdre le reste", () => {
    expect(basculer([], "jump")).toEqual(["jump"]);
    expect(basculer(["track"], "jump")).toEqual(["track", "jump"]);
    expect(basculer(["track", "jump"], "track")).toEqual(["jump"]);
  });
});

describe("ce que l'accueil dessine, et la reprise d'un visiteur dans son profil", () => {
  const local = (jeux: string[], attente: boolean) => ({ jeux, attente });
  it("un joueur connu du serveur : la liste du serveur fait foi (même vide) ; un visiteur : celle du navigateur", () => {
    expect(listeAffichee(["track"], true, local(["jump"], false))).toEqual(["track"]);
    expect(listeAffichee(null, true, local(["jump"], false))).toEqual([]);
    expect(listeAffichee(undefined, false, local(["jump"], true))).toEqual(["jump"]);
  });
  it("visiteur puis création du profil : sa liste est reprise une fois (serveur sans choix, liste en attente)", () => {
    expect(aReprendre(null, local(["track"], true))).toBe(true);
    expect(aReprendre(null, local([], true))).toBe(false);
    // Une liste déjà confirmée (ou venue d'un autre appareil) ne ressuscite jamais un choix défait ailleurs.
    expect(aReprendre(null, local(["track"], false))).toBe(false);
    // Le serveur a déjà un choix : il fait foi.
    expect(aReprendre(["jump"], local(["track"], true))).toBe(false);
    expect(aReprendre(undefined, local(["track"], true))).toBe(false);
  });
});

describe("l'écriture", () => {
  it("PUT /api/portail/favoris, la liste entière, l'identifiant en en-tête (jamais dans l'adresse)", async () => {
    const vus: { url: string; methode: string | undefined; id: string | null; corps: unknown }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      vus.push({ url, methode: init?.method, id: new Headers(init?.headers).get("x-player-id"), corps: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ favoris: ["track"], jeuxDuJour: ["track", "jump"], effetLe: "2026-11-03", serie: 2, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await enregistrerFavoris("https://api.exemple", "ab".repeat(16), ["track"], f);
    expect(r.ok && r.data.effetLe).toBe("2026-11-03");
    expect(vus).toEqual([{ url: "https://api.exemple/api/portail/favoris", methode: "PUT", id: "ab".repeat(16), corps: { favoris: ["track"] } }]);
  });
  it("un refus ou une panne est une valeur, jamais une exception", async () => {
    const panne = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect(await enregistrerFavoris("", "ab".repeat(16), [], panne)).toMatchObject({ ok: false, code: "network" });
    const inconnu = (async () => new Response(JSON.stringify({ error: "unknown_player" }), { status: 404 })) as unknown as typeof fetch;
    expect(await enregistrerFavoris("", "ab".repeat(16), [], inconnu)).toMatchObject({ ok: false, status: 404, code: "unknown_player" });
  });
});
