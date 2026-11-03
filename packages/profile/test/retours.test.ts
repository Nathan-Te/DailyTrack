import { describe, expect, it } from "vitest";
import { readPlayerId } from "../src/identity";
import { cheminDePage, clientRetours, famillesDe, joueurDuStockage, lireFil, lireFils } from "../src/retours";

// Lot C1, partie A : le client des routes `/api/retours/…` (réseau injecté), la famille du navigateur et du système, la lecture prudente des réponses.
const ID = "0123456789abcdef0123456789abcdef";
const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status });

describe("famillesDe : jamais le détail", () => {
  it.each([
    ["Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "", "firefox", "linux"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "", "edge", "windows"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "", "chrome", "windows"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "", "safari", "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "MacIntel", "safari", "macos"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "", "chrome", "android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", "", "chrome", "ios"],
    ["", "", "autre", "autre"],
  ])("%s", (ua, plateforme, navigateur, systeme) => {
    expect(famillesDe(ua, plateforme)).toEqual({ navigateur, systeme });
  });
});

describe("pages et identité", () => {
  it("cheminDePage garde le chemin, jamais les paramètres", () => {
    expect(cheminDePage("/track/?api=x#a")).toBe("/track/");
    expect(cheminDePage("/jump/admin/")).toBe("/jump/admin/");
    expect(cheminDePage("//x\\y")).toBe("/");
    expect(cheminDePage(`/${"a".repeat(80)}`)).toBe("/");
  });

  it("joueurDuStockage lit comme readPlayerId", () => {
    const cas: (string | null)[] = [ID, null, "abc", ID.toUpperCase(), `${ID}0`];
    for (const v of cas) {
      const s = { getItem: (k: string) => (k === "cdj:player" ? v : null) };
      expect(joueurDuStockage(s), String(v)).toBe(readPlayerId(s));
    }
    expect(joueurDuStockage(null)).toBeNull();
    expect(joueurDuStockage({ getItem: () => { throw new Error("refusé"); } })).toBeNull();
  });
});

describe("clientRetours", () => {
  it("envoie le message avec l'identifiant en en-tête, jamais dans l'adresse ; sans profil, l'envoi est anonyme", async () => {
    const vus: { url: string; init: RequestInit }[] = [];
    const fetch = async (url: string, init: RequestInit) => (vus.push({ url, init }), reponse({ id: 3, reponsePossible: url.length > 0 && !!(init.headers as Record<string, string>)["X-Player-Id"] }));
    const m = { type: "bug" as const, texte: "<b>x</b>", contexte: { jeu: "jump", page: "/jump/", jour: "2026-11-03", navigateur: "firefox", systeme: "linux", ecran: "390x844", langue: "fr" as const } };
    const avec = await clientRetours({ base: "", playerId: ID, fetch }).envoyer(m);
    const sans = await clientRetours({ base: "https://api.test/", playerId: null, fetch }).envoyer(m);
    expect(avec).toEqual({ ok: true, data: { id: 3, reponsePossible: true } });
    expect(sans).toEqual({ ok: true, data: { id: 3, reponsePossible: false } });
    expect(vus[0]!.url).toBe("/api/retours");
    expect(vus[1]!.url).toBe("https://api.test/api/retours");
    expect(vus.every((v) => !v.url.includes(ID))).toBe(true);
    expect((vus[0]!.init.headers as Record<string, string>)["X-Player-Id"]).toBe(ID);
    expect((vus[1]!.init.headers as Record<string, string>)["X-Player-Id"]).toBeUndefined();
    expect(JSON.parse(String(vus[0]!.init.body)).texte).toBe("<b>x</b>"); // un texte reste un texte
  });

  it("sans profil, lire les fils, un fil, répondre et marquer lu n'ouvrent aucune requête", async () => {
    let appels = 0;
    const c = clientRetours({ base: "", playerId: null, fetch: async () => (appels++, reponse({})) });
    for (const r of [await c.lireFils(), await c.lireFil(1), await c.repondre(1, "x"), await c.marquerLu(1)]) expect(r).toMatchObject({ ok: false, code: "invalid_player" });
    expect(appels).toBe(0);
  });

  it("un refus du serveur est une valeur avec son code ; une réponse illisible aussi", async () => {
    const refus = clientRetours({ base: "", playerId: ID, fetch: async () => reponse({ error: "feedback_limit" }, 429) });
    expect(await refus.envoyer({ type: "bug", texte: "x", contexte: { jeu: "jump", page: "/", jour: "", navigateur: "chrome", systeme: "linux", ecran: "1x1", langue: "fr" } })).toMatchObject({ ok: false, code: "feedback_limit", status: 429 });
    const abime = clientRetours({ base: "", playerId: ID, fetch: async () => reponse({ pas: "un fil" }) });
    expect(await abime.lireFil(1)).toMatchObject({ ok: false, code: "invalid_response" });
    expect(await abime.lireFils()).toMatchObject({ ok: false, code: "invalid_response" });
  });

  it("les lectures écartent ce qui n'a pas la bonne forme", () => {
    expect(lireFils({ fils: [{ id: 1, type: "bug", statut: "nouveau", messages: 2, apercu: "a" }, { id: "x" }, null, { id: 2, type: "pirate", statut: "lu" }], nonLus: 1 })?.fils).toHaveLength(1);
    expect(lireFil({ id: 1, type: "bug", statut: "lu", messages: [{ auteur: "admin", texte: "ok" }, { auteur: "?", texte: 4 }, { auteur: "joueur", texte: "salut" }], peutRepondre: false })).toMatchObject({
      peutRepondre: false,
      messages: [{ auteur: "admin", texte: "ok" }, { auteur: "joueur", texte: "salut" }],
    });
    expect(lireFil({ id: 1, type: "inconnu", statut: "lu", messages: [] })).toBeNull();
  });
});
