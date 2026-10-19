import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileClient } from "../src/index";

// Déplacé d'`apps/web/test/api.test.ts` au lot P0 (plateforme), assertions inchangées : `me`, `checkName`, `rename` et `rotateCode` de
// `LeaderboardApi` (DailyTrack) sont maintenant ceux de `ProfileClient`, dont `LeaderboardApi` hérite. Le nom d'avant est gardé ici pour que les
// assertions restent mot pour mot celles d'`apps/web`.
const LeaderboardApi = ProfileClient;

afterEach(() => vi.restoreAllMocks());

describe("profil, pseudo et code (lot 30)", () => {
  const mockFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => vi.spyOn(globalThis, "fetch").mockImplementation(impl as typeof fetch);
  const id = "a".repeat(32);

  it("l'identifiant secret voyage dans un en-tête, jamais dans l'adresse", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    const api = new LeaderboardApi("https://api.test");
    await api.me(id);
    await api.checkName("Nowy été", id);
    await api.rotateCode(id, "b".repeat(32));
    const calls = spy.mock.calls.map(([url, init]) => ({ url: String(url), method: init!.method, headers: init!.headers as Record<string, string>, body: init!.body }));
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", "https://api.test/api/me"],
      ["GET", "https://api.test/api/name?name=Nowy%20%C3%A9t%C3%A9"],
      ["POST", "https://api.test/api/me/code"],
    ]);
    for (const c of calls) expect(c.url).not.toContain(id);
    expect(calls[0]!.headers["X-Player-Id"]).toBe(id);
    expect(calls[2]!.headers["X-Player-Id"]).toBe(id); // l'ancien code dans l'en-tête…
    expect(JSON.parse(calls[2]!.body as string)).toEqual({ newId: "b".repeat(32) }); // … le nouveau dans le corps
  });

  it("garde les pseudos libres proposés quand le pseudo est pris, et le code d'un code remplacé", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "name_taken", message: "Ce pseudo est déjà utilisé.", suggestions: ["Nowy2", 5, "Nowy_FR"] }), { status: 409 }));
    expect(await new LeaderboardApi("https://api.test").rename(id, "Nowy")).toEqual({ ok: false, status: 409, code: "name_taken", message: "Ce pseudo est déjà utilisé.", suggestions: ["Nowy2", "Nowy_FR"] });
    mockFetch(async () => new Response(JSON.stringify({ error: "code_revoked", message: "Ce code n'est plus valide" }), { status: 410 }));
    expect(await new LeaderboardApi("https://api.test").me(id)).toMatchObject({ ok: false, status: 410, code: "code_revoked" });
  });
});
