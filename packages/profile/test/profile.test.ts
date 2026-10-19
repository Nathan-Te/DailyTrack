import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAME_TAKEN_MESSAGE, Profile, ProfileClient, ProfileSync, createIdentity, mergeName } from "../src/index";

// Déplacé d'`apps/web/test/online.test.ts` au lot P0 (plateforme), assertions inchangées : `rename` et `changeCode` de la façade `Online` de
// DailyTrack sont maintenant ceux de `Profile`, auquel `Online` les délègue. Ci-dessous, la même façade réduite à ce que ces tests utilisent
// (son constructeur `Online(circuit, date, adresse)`), pour que les assertions restent mot pour mot celles d'`apps/web`.
class Online extends Profile<ProfileSync<boolean, Storage>> {
  constructor(_trackId: null, _date: null, base: string | null) {
    const identity = createIdentity(() => localStorage);
    const demo = base === "demo";
    const api = base && !demo ? new ProfileClient(base) : null;
    const sync = new ProfileSync({ api: () => api, playerId: () => identity.getPlayerId(), adopt: identity.setPlayerId, storage: localStorage, merge: mergeName, identity });
    super({ api, demo, identity, sync });
  }
}

describe("Online : pseudo réservé, changement de code", () => {
  const store = new Map<string, string>();
  const calls: { method: string; url: string; body: unknown }[] = [];
  /** Réponses du faux serveur : `route` → statut + corps. */
  let routes: Record<string, { status: number; body: unknown }> = {};

  beforeEach(() => {
    store.clear();
    calls.length = 0;
    routes = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; } });
    vi.spyOn(globalThis, "fetch").mockImplementation((async (url: string, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      calls.push({ method: init?.method ?? "GET", url: String(url), body: init?.body ? JSON.parse(init.body as string) : undefined });
      const r = routes[`${init?.method ?? "GET"} ${path}`];
      if (!r) throw new TypeError("fetch failed");
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as typeof fetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const online = () => new Online(null, null, "https://api.test");
  const taken = { status: 409, body: { error: "name_taken", message: NAME_TAKEN_MESSAGE, suggestions: ["Nowy2"] } };

  it("un joueur connu du serveur change de pseudo sur le serveur, et le garde en local", async () => {
    routes["PUT /api/player"] = { status: 200, body: { name: "Alice" } };
    const o = online();
    expect(await o.rename("  Alice ")).toEqual({ ok: true, name: "Alice" });
    expect(store.get("cdj:name")).toBe("Alice");
    expect(calls[0]).toMatchObject({ method: "PUT", body: { playerId: o.playerId, name: "Alice" } });
  });

  it("pseudo pris : refusé avec des suggestions libres, le pseudo local ne change pas", async () => {
    store.set("cdj:name", "Moi");
    routes["PUT /api/player"] = taken;
    expect(await online().rename("Nowy")).toEqual({ ok: false, code: "name_taken", message: NAME_TAKEN_MESSAGE, suggestions: ["Nowy2"] });
    expect(store.get("cdj:name")).toBe("Moi");
  });

  it("joueur pas encore classé : le serveur dit seulement si le pseudo est libre (il partira avec la première course)", async () => {
    routes["PUT /api/player"] = { status: 404, body: { error: "unknown_player", message: "inconnu" } };
    routes["GET /api/name"] = { status: 200, body: { available: true } };
    const o = online();
    expect(await o.rename("Libre")).toEqual({ ok: true, name: "Libre" });
    expect(o.sync.state.known).toBe(false);
    expect(store.get("cdj:name")).toBe("Libre");
    routes["GET /api/name"] = { status: 200, body: { available: false, suggestions: ["Libre2"] } };
    expect(await o.rename("Pris")).toMatchObject({ ok: false, code: "name_taken", suggestions: ["Libre2"] });
    expect(store.get("cdj:name")).toBe("Libre");
    // Une fois la non-existence connue, plus d'essai de renommage : la vérification seule.
    calls.length = 0;
    await o.rename("Autre");
    expect(calls.map((c) => c.method + " " + new URL(c.url).pathname)).toEqual(["GET /api/name"]);
  });

  it("avec la course à venir (viaSubmit), vérifie sans rien renommer", async () => {
    routes["GET /api/name"] = { status: 200, body: { available: true } };
    expect(await online().rename("Libre", { viaSubmit: true })).toEqual({ ok: true, name: "Libre" });
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("pseudo interdit ou invalide : le message du serveur", async () => {
    routes["PUT /api/player"] = { status: 400, body: { error: "name_forbidden", message: "Ce pseudo n'est pas permis. Choisis-en un autre." } };
    expect(await online().rename("Hitler")).toEqual({ ok: false, code: "name_forbidden", message: "Ce pseudo n'est pas permis. Choisis-en un autre." });
  });

  it("hors ligne : un joueur que le serveur ne connaît pas garde son pseudo en local ; un joueur connu ne peut pas en changer", async () => {
    const o = online(); // aucune route : le réseau est coupé
    expect(await o.rename("Local")).toEqual({ ok: true, name: "Local" });
    o.sync.noteServerKnows(true);
    expect(await o.rename("Autre")).toMatchObject({ ok: false, message: expect.stringContaining("Hors ligne") });
    expect(store.get("cdj:name")).toBe("Local");
  });

  it("sans serveur (aucune adresse) ou en démonstration : pseudo local", async () => {
    expect(await new Online(null, null, null).rename("Seul")).toEqual({ ok: true, name: "Seul" });
    expect(await new Online(null, null, "demo").rename("Démo")).toEqual({ ok: true, name: "Démo" });
    expect(calls).toEqual([]);
  });

  it("« Changer mon code » : l'identifiant change ici une fois que le serveur a répondu", async () => {
    routes["POST /api/me/code"] = { status: 200, body: { rotated: true } };
    const o = online();
    const before = o.playerId;
    expect(await o.changeCode()).toEqual({ ok: true });
    expect(o.playerId).not.toBe(before);
    expect(o.playerId).toMatch(/^[0-9a-f]{32}$/);
    expect(calls[0]!.body).toEqual({ newId: o.playerId });
    expect(store.has("cdj:player:next")).toBe(false);
  });

  it("réponse perdue : le même nouvel identifiant est redemandé, pour ne jamais perdre l'accès", async () => {
    const o = online();
    const before = o.playerId;
    expect(await o.changeCode()).toMatchObject({ ok: false, code: "network" }); // réseau coupé
    expect(o.playerId).toBe(before); // l'ancien identifiant reste jusqu'à la réponse
    const pending = store.get("cdj:player:next")!;
    expect(pending).toMatch(/^[0-9a-f]{32}$/);
    routes["POST /api/me/code"] = { status: 200, body: { rotated: true } };
    expect(await o.changeCode()).toEqual({ ok: true });
    expect(o.playerId).toBe(pending);
  });

  it("un profil que le serveur ne connaît pas reçoit simplement un nouvel identifiant", async () => {
    routes["POST /api/me/code"] = { status: 404, body: { error: "unknown_player", message: "inconnu" } };
    const o = online();
    const before = o.playerId;
    expect(await o.changeCode()).toEqual({ ok: true });
    expect(o.playerId).not.toBe(before);
  });

  it("code déjà remplacé ailleurs : refusé, rien ne change", async () => {
    routes["POST /api/me/code"] = { status: 410, body: { error: "code_revoked", message: "Ce code n'est plus valide" } };
    const o = online();
    const before = o.playerId;
    expect(await o.changeCode()).toMatchObject({ ok: false, code: "code_revoked" });
    expect(o.playerId).toBe(before);
    expect(store.has("cdj:player:next")).toBe(false);
  });
});
