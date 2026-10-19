import { describe, expect, it } from "vitest";
import { ProfileSync, createIdentity, mergeName, type ApiResult, type MeProfile } from "../src/index";

// Le service de synchronisation de la plateforme (lot P0), sans la fusion d'un jeu : la fusion est injectée (DailyTrack : `mergeProfile`,
// testé avec le service dans `apps/web/test/profileSync.test.ts`, inchangé).
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    has: (k: string) => m.has(k),
  };
}
const ID = "0123456789abcdef0123456789abcdef";
const NEXT = "fedcba9876543210fedcba9876543210";
const profile = (patch: Partial<MeProfile> = {}): MeProfile => ({
  name: "Nowy",
  renameRequired: false,
  today: "2026-10-20",
  simVersion: 1,
  stats: { days: 1, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, bestRank: null, streak: 1 },
  best: null,
  past: [],
  ...patch,
});
const fail = (code: string, status: number): ApiResult<MeProfile> => ({ ok: false, code, status, message: code });

describe("ProfileSync (plateforme)", () => {
  it("rend le résultat de la fusion du jeu, et la fusion commune garde le pseudo du serveur", async () => {
    const storage = memory({ "cdj:name": "Ancien" });
    const merged: string[] = [];
    const sync = new ProfileSync({
      api: () => ({ me: async () => ({ ok: true, data: profile() }) }),
      playerId: () => ID,
      adopt: () => {},
      storage,
      merge: (me, s) => (merged.push(me.name), mergeName(me, s)),
      identity: createIdentity(() => storage),
      now: () => 0,
    });
    expect(await sync.run()).toEqual({ status: "ok", merged: true, ran: true });
    expect(merged).toEqual(["Nowy"]);
    expect(storage.getItem("cdj:name")).toBe("Nowy");
    expect(sync.state).toMatchObject({ status: "ok", known: true, renameRequired: false });
  });

  it("adopte le nouvel identifiant gardé dans le stockage injecté quand l'ancien est révoqué", async () => {
    const storage = memory({ "cdj:player": ID, "cdj:player:next": NEXT });
    const identity = createIdentity(() => storage);
    const seen: string[] = [];
    const sync = new ProfileSync({
      api: () => ({ me: async (id: string) => (seen.push(id), id === ID ? fail("code_revoked", 410) : { ok: true, data: profile() }) }),
      playerId: () => identity.getPlayerId(),
      adopt: identity.setPlayerId,
      storage,
      merge: mergeName,
      identity,
      now: () => 0,
    });
    expect((await sync.run()).status).toBe("ok");
    expect(seen).toEqual([ID, NEXT]);
    expect(identity.getPlayerId()).toBe(NEXT);
    expect(storage.has("cdj:player:next")).toBe(false);
  });

  it("sans fusion réussie, rien n'est fusionné (hors ligne, inconnu, révoqué)", async () => {
    for (const [answer, status] of [[fail("network", 0), "offline"], [fail("unknown_player", 404), "unknown"], [fail("code_revoked", 410), "revoked"]] as const) {
      let calls = 0;
      const storage = memory();
      const sync = new ProfileSync({ api: () => ({ me: async () => answer }), playerId: () => ID, adopt: () => {}, storage, merge: () => calls++, identity: createIdentity(() => storage) });
      expect(await sync.run()).toEqual({ status, merged: null, ran: true });
      expect(calls).toBe(0);
    }
  });
});
