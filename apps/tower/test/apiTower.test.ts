import { describe, expect, it } from "vitest";
import { API_MEDAILLE, baseApi, HttpTowerSource, medailleLue, MEDAILLE_API } from "../src/apiTower";

// Lot T4 — le client du serveur de Tower : les chemins, les en-têtes (l'identifiant secret ne voyage jamais dans l'adresse), les médailles de la plateforme et la règle R7 de `?api=`.
interface Requete {
  url: string;
  init: RequestInit;
}
function client() {
  const requetes: Requete[] = [];
  const source = new HttpTowerSource("https://x.test", async (url, init) => {
    requetes.push({ url, init });
    return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
  });
  return { source, requetes };
}
const ID = "0123456789abcdef0123456789abcdef";

describe("le client du serveur de Tower", () => {
  it("l'envoi : POST /api/tower/submit, la rediffusion et le pseudo dans le corps, l'identifiant dans l'en-tête, rien d'autre", async () => {
    const { source, requetes } = client();
    await source.submit(ID, "Kiwi", "AAAA");
    expect(requetes[0]!.url).toBe("https://x.test/api/tower/submit");
    expect(requetes[0]!.init.method).toBe("POST");
    expect(JSON.parse(requetes[0]!.init.body as string)).toEqual({ replay: "AAAA", name: "Kiwi" });
    expect((requetes[0]!.init.headers as Record<string, string>)["X-Player-Id"]).toBe(ID);
    await source.submit(ID, null, "BBBB");
    expect(JSON.parse(requetes[1]!.init.body as string)).toEqual({ replay: "BBBB" });
  });

  it("les lectures : le classement (identifiant facultatif), le Diamant et le profil Tower ; jamais l'identifiant dans l'adresse", async () => {
    const { source, requetes } = client();
    await source.board("2026-11-06", null);
    await source.board("2026-11-06", ID);
    await source.diamant("2026-11-06", ID);
    await source.towerMe(ID);
    expect(requetes.map((r) => r.url)).toEqual(["https://x.test/api/tower/day/2026-11-06/board", "https://x.test/api/tower/day/2026-11-06/board", "https://x.test/api/tower/day/2026-11-06/diamant", "https://x.test/api/tower/me"]);
    expect((requetes[0]!.init.headers as Record<string, string> | undefined)?.["X-Player-Id"]).toBeUndefined();
    for (const r of requetes.slice(1)) expect((r.init.headers as Record<string, string>)["X-Player-Id"]).toBe(ID);
    for (const r of requetes) expect(r.url).not.toContain(ID);
  });

  it("les médailles de la plateforme se lisent sous les noms de la simulation, et inversement", () => {
    expect(MEDAILLE_API).toEqual({ author: "auteur", gold: "or", silver: "argent", bronze: "bronze" });
    for (const [api, sim] of Object.entries(MEDAILLE_API)) expect(API_MEDAILLE[sim]).toBe(api);
    expect(medailleLue("author")).toBe("auteur");
    expect(medailleLue(null)).toBeNull();
  });

  it("l'adresse de l'API : ?api= pour les essais, VITE_API_URL sinon, « / » = la même origine, rien = pas de classement ; sur la production ?api= ne vise que la page elle-même (R7)", () => {
    expect(baseApi("http://localhost:8791", undefined, "https://p.test", false)).toBe("http://localhost:8791");
    expect(baseApi(null, "https://api.test/", "https://p.test", false)).toBe("https://api.test");
    expect(baseApi(null, "/", "https://p.test", false)).toBe("https://p.test");
    expect(baseApi("/", undefined, "https://p.test/", false)).toBe("https://p.test");
    expect(baseApi(null, undefined, "https://p.test", false)).toBeNull();
    expect(baseApi("demo", undefined, "https://p.test", false)).toBeNull();
    // Production : un lien piégé n'obtient jamais l'identifiant secret.
    expect(baseApi("https://pirate.test", "/", "https://playdujour.com", true)).toBe("https://playdujour.com");
    expect(baseApi("https://playdujour.com", undefined, "https://playdujour.com", true)).toBe("https://playdujour.com");
  });
});
