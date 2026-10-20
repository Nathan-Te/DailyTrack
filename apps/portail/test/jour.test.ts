import { describe, expect, it } from "vitest";
import { avancement, baseApi, formatCompte, lireJour, prochainMinuit, type Jour } from "../src/jour";

// Lot I2 : la lecture du jour par le portail (une requête, l'heure du serveur, l'âge d'un cache partagé, les erreurs comme des valeurs) et le
// compte à rebours (jusqu'au prochain minuit de Paris, journées de 25 h comprises).

const JOUR: Jour = {
  date: "2026-10-20",
  maintenant: "2026-10-20T12:00:00.000Z",
  prochainJour: "2026-10-20T22:00:00.000Z",
  jeux: [{ jeu: "cdj", numero: 8, theme: "nuit", seuils: null, premierJour: "2026-10-13" }],
};

const repondre = (status: number, corps: unknown, entetes: Record<string, string> = {}) =>
  (async () => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json", ...entetes } })) as unknown as typeof fetch;

describe("portail : lecture du jour", () => {
  it("une requête, l'identifiant en en-tête (jamais dans l'adresse), sans cache du navigateur", async () => {
    const vues: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      vues.push({ url, init });
      return new Response(JSON.stringify(JOUR), { status: 200 });
    }) as unknown as typeof fetch;
    await lireJour(f, "0123456789abcdef0123456789abcdef");
    await lireJour(f, null);
    expect(vues.map((v) => v.url)).toEqual(["/api/portail/jour", "/api/portail/jour"]);
    expect(vues[0]!.init.headers).toEqual({ "X-Player-Id": "0123456789abcdef0123456789abcdef" });
    expect(vues[1]!.init.headers).toEqual({});
    expect(vues[0]!.init.cache).toBe("no-store");
  });

  it("l'adresse du serveur fixée à la construction : la même origine (« / » ou rien), ou la révision de recette d'un aperçu", async () => {
    expect(baseApi(undefined)).toBe("");
    expect(baseApi("/")).toBe("");
    expect(baseApi("https://b-x---cdj-api-recette.run.app/")).toBe("https://b-x---cdj-api-recette.run.app");
    const vues: string[] = [];
    const f = (async (url: string) => (vues.push(url), new Response(JSON.stringify(JOUR), { status: 200 }))) as unknown as typeof fetch;
    await lireJour(f, null, Date.now, 1000, "https://b-x---cdj-api-recette.run.app");
    expect(vues).toEqual(["https://b-x---cdj-api-recette.run.app/api/portail/jour"]);
  });

  it("le décalage de l'horloge : l'heure du serveur au milieu de l'aller-retour, plus l'âge d'un cache partagé", async () => {
    let t = Date.parse("2026-10-20T11:59:00.000Z"); // le téléphone retarde d'une minute
    const horloge = () => (t += 100);
    const l = await lireJour(repondre(200, JOUR), null, horloge);
    expect(l.erreur).toBeNull();
    expect(l.decalage).toBe(60_000 - 150);
    const vieille = await lireJour(repondre(200, JOUR, { Age: "20" }), null, () => Date.parse(JOUR.maintenant));
    expect(vieille.decalage).toBe(20_000);
  });

  it("un joueur inconnu (404) ou un code révoqué (410) : la partie publique est gardée, sans joueur ; le code d'erreur est rendu", async () => {
    const l = await lireJour(repondre(404, { ...JOUR, error: "unknown_player", message: "x", joueur: { pseudo: "?" } }), "0123456789abcdef0123456789abcdef");
    expect(l.erreur).toBe("unknown_player");
    expect(l.jour?.jeux).toHaveLength(1);
    expect(l.jour?.joueur).toBeUndefined();
    const r = await lireJour(repondre(429, { error: "rate_limited", message: "x" }), null);
    expect(r).toEqual({ jour: null, decalage: 0, erreur: "rate_limited" });
  });

  it("serveur injoignable, réponse illisible, délai dépassé : des valeurs, jamais une exception", async () => {
    expect((await lireJour((async () => Promise.reject(new TypeError("réseau"))) as unknown as typeof fetch, null)).erreur).toBe("reseau");
    expect((await lireJour((async () => new Response("<html>", { status: 502 })) as unknown as typeof fetch, null)).erreur).toBe("reseau");
    const lente = ((_u: string, init: RequestInit) =>
      new Promise((_ok, ko) => init.signal?.addEventListener("abort", () => ko(new DOMException("coupé", "AbortError"))))) as unknown as typeof fetch;
    expect((await lireJour(lente, null, Date.now, 20)).erreur).toBe("delai");
  });
});

describe("portail : compte à rebours", () => {
  it("hh:mm:ss, jamais négatif ; plus de 24 h un jour de 25 h", () => {
    expect(formatCompte(10 * 3_600_000)).toBe("10:00:00");
    expect(formatCompte(1)).toBe("00:00:01");
    expect(formatCompte(-5000)).toBe("00:00:00");
    expect(formatCompte(24.5 * 3_600_000)).toBe("24:30:00");
  });

  it("le prochain minuit : celui du serveur, sinon celui de Paris calculé sur l'heure du téléphone (changements d'heure compris)", () => {
    const maintenant = Date.parse(JOUR.maintenant);
    expect(prochainMinuit(JOUR, maintenant)).toBe(Date.parse("2026-10-20T22:00:00.000Z"));
    expect(prochainMinuit(null, maintenant)).toBe(Date.parse("2026-10-20T22:00:00.000Z"));
    expect(prochainMinuit(null, Date.parse("2026-10-24T22:30:00Z"))).toBe(Date.parse("2026-10-25T23:00:00Z"));
    expect(prochainMinuit(null, Date.parse("2027-03-28T10:00:00Z"))).toBe(Date.parse("2027-03-28T22:00:00Z"));
    // Un jour du serveur dépassé depuis longtemps (téléphone en veille) : le minuit de Paris calculé.
    expect(prochainMinuit(JOUR, Date.parse("2026-10-22T10:00:00Z"))).toBe(Date.parse("2026-10-22T22:00:00Z"));
  });

  it("« n fini(s) sur m » : les jeux finis parmi ceux montrés", () => {
    expect(avancement([{ ...JOUR.jeux[0]!, etat: { statut: "fini", tempsMs: 1, medaille: null, rang: 1, classes: 1 } }, { ...JOUR.jeux[0]!, etat: { statut: "en_cours", morts: 3 } }])).toEqual({ finis: 1, total: 2 });
  });
});
