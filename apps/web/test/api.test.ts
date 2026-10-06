import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaderboardApi, apiBase } from "../src/api";
import { isValidName, normalizeName } from "../src/identity";

afterEach(() => vi.restoreAllMocks());

describe("apiBase", () => {
  it("lit ?api=, sinon la variable de construction, sinon rien", () => {
    expect(apiBase("?api=https://exemple.test/", undefined)).toBe("https://exemple.test");
    expect(apiBase("", "https://prod.test")).toBe("https://prod.test");
    expect(apiBase("?api=https://a.test", "https://b.test")).toBe("https://a.test");
    expect(apiBase("", undefined)).toBeNull();
    expect(apiBase("?seed=2026-10-06", "")).toBeNull();
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
    expect(JSON.parse(init!.body as string)).toEqual({ playerId: "a".repeat(32), name: "Alice", date: "2026-10-06", replay: "REPLAY" });
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

  it("interroge classement et fantômes avec les bons paramètres", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    const api = new LeaderboardApi("https://api.test");
    await api.leaderboard("2026-10-06", "b".repeat(32), 5);
    await api.ghost("2026-10-06", "ahead", "b".repeat(32));
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      `https://api.test/api/day/2026-10-06/leaderboard?limit=5&player=${"b".repeat(32)}`,
      `https://api.test/api/day/2026-10-06/ghost?kind=ahead&player=${"b".repeat(32)}`,
    ]);
  });
});

describe("pseudo", () => {
  it("applique les mêmes règles que le serveur", () => {
    for (const ok of ["Alice", "Zoé d'Arc-2", "a", "x".repeat(20), "  Bob  ", "Léa_B.", "日本語"]) expect(isValidName(ok), ok).toBe(true);
    for (const bad of ["", "   ", "x".repeat(21), "<script>", "-Alice", "A\u0000B", "😀", "a/b"]) expect(isValidName(bad), bad).toBe(false);
  });

  it("normalise les espaces", () => {
    expect(normalizeName("  Zoé    d'Arc ")).toBe("Zoé d'Arc");
  });
});
