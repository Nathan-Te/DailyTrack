import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaderboardApi, apiBase } from "../src/api";

afterEach(() => vi.restoreAllMocks());

describe("apiBase", () => {
  it("lot R7 : en production, ?api= ne peut pas mener l'identifiant secret vers un autre serveur", () => {
    const prod = (search: string, env?: string) => apiBase(search, env, "https://playdujour.com", true);
    expect(prod("?api=https://pirate.example", "/")).toBe("https://playdujour.com");
    expect(prod("?api=https://pirate.example")).toBeNull();
    expect(prod("?api=/")).toBe("https://playdujour.com");
    expect(prod("?api=demo")).toBe("demo");
    expect(prod("?api=http://localhost:8787")).toBe("http://localhost:8787");
    // hors production (recette, aperçus, développement) : comme avant
    expect(apiBase("?api=https://x.run.app", "/", "https://recette.playdujour.com", false)).toBe("https://x.run.app");
    // ?prod force le mode restreint depuis l'adresse (il ne peut que restreindre)
    expect(apiBase("?prod&api=https://pirate.example", undefined, "https://recette.playdujour.com")).toBeNull();
  });

  it("lit ?api=, sinon la variable de construction, sinon rien", () => {
    expect(apiBase("?api=https://exemple.test/", undefined)).toBe("https://exemple.test");
    expect(apiBase("", "https://prod.test")).toBe("https://prod.test");
    expect(apiBase("?api=https://a.test", "https://b.test")).toBe("https://a.test");
    expect(apiBase("", undefined)).toBeNull();
    expect(apiBase("?seed=2026-10-06", "")).toBeNull();
    // Lot R4 : « / » = le serveur de la même origine (Firebase Hosting renvoie /api/** vers Cloud Run).
    expect(apiBase("", "/", "https://playdujour.com")).toBe("https://playdujour.com");
    expect(apiBase("?api=/", "https://prod.test", "https://recette.playdujour.com/")).toBe("https://recette.playdujour.com");
  });
});

describe("LeaderboardApi", () => {
  const mockFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => vi.spyOn(globalThis, "fetch").mockImplementation(impl as typeof fetch);

  it("envoie la rediffusion et l'identité, jamais un temps", async () => {
    const spy = mockFetch(async () => new Response(JSON.stringify({ accepted: true, rank: 1 }), { status: 200 }));
    const r = await new LeaderboardApi("https://api.test").submit("a".repeat(32), "Alice", "2026-10-06", "REPLAY");
    expect(r).toEqual({ ok: true, data: { accepted: true, rank: 1 } });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/submit");
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ name: "Alice", date: "2026-10-06", replay: "REPLAY" });
    expect((init!.headers as Record<string, string>)["X-Player-Id"]).toBe("a".repeat(32)); // lot 32 : l'identité dans l'en-tête
  });

  it("n'envoie pas de pseudo vide", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    await new LeaderboardApi("https://api.test").submit("a".repeat(32), null, "2026-10-06", "R");
    expect(JSON.parse(spy.mock.calls[0]![1]!.body as string)).not.toHaveProperty("name");
  });

  it("traduit les erreurs du serveur", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "day_closed", message: "Le classement de ce jour est figé" }), { status: 409 }));
    expect(await new LeaderboardApi("https://api.test").leaderboard("2026-10-05", "a".repeat(32))).toEqual({
      ok: false,
      status: 409,
      code: "day_closed",
      message: "Le classement de ce jour est figé",
    });
  });

  it("ne plante pas quand le serveur est injoignable ou répond n'importe quoi", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await new LeaderboardApi("https://api.test").ghost("2026-10-06", "first", "a".repeat(32))).toMatchObject({ ok: false, code: "network", status: 0 });
    mockFetch(async () => new Response("<html>502</html>", { status: 502 }));
    expect(await new LeaderboardApi("https://api.test").rename("a".repeat(32), "Bob")).toMatchObject({ ok: false, status: 502, code: "http_error" });
  });

  it("interroge classement et fantômes : l'identifiant dans l'en-tête X-Player-Id, jamais dans l'adresse (lot 32)", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    const api = new LeaderboardApi("https://api.test");
    const id = "b".repeat(32);
    await api.leaderboard("2026-10-06", id, 5);
    await api.ghost("2026-10-06", "ahead", id);
    await api.submit(id, "Alice", "2026-10-06", "CODE");
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      "https://api.test/api/day/2026-10-06/leaderboard?limit=5",
      "https://api.test/api/day/2026-10-06/ghost?kind=ahead",
      "https://api.test/api/submit",
    ]);
    for (const [, init] of spy.mock.calls) expect((init!.headers as Record<string, string>)["X-Player-Id"]).toBe(id);
    expect(JSON.parse(spy.mock.calls[2]![1]!.body as string)).toEqual({ name: "Alice", date: "2026-10-06", replay: "CODE" }); // pas d'identifiant dans le corps non plus
  });
});
