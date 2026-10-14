import { describe, expect, it } from "vitest";
import { SIM_VERSION } from "@cdj/sim";
import type { ApiResult, LeaderboardSource, MeProfile } from "../src/api";
import { listDayBests } from "../src/records";
import { listPlayedDays, loadRanks } from "../src/profile";
import { ProfileSync, mergeProfile } from "../src/profileSync";

// Synchronisation du profil (lot 30) : le serveur fait foi, le stockage local n'est qu'un cache.
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const TODAY = "jour-2026-10-20-g15";
type Mem = ReturnType<typeof memory>;
/** Le record gardé dans ce stockage pour ce circuit (`loadBest` lit le vrai `localStorage`, pas celui du test). */
const best = (s: Mem, trackId: string) => JSON.parse(s.getItem(`cdj:best:${trackId}`) ?? "null") as { ms: number; replay?: string; medal?: string | null; splits: number[] } | null;
const PAST = "jour-2026-10-19-g15";
const local = (ms: number, extra: object = {}) => JSON.stringify({ ms, splits: [1000, 2000], simVersion: SIM_VERSION, medal: null, ...extra });

const profile = (patch: Partial<MeProfile> = {}): MeProfile => ({
  name: "Nowy",
  renameRequired: false,
  today: "2026-10-20",
  simVersion: SIM_VERSION,
  stats: { days: 2, medals: { author: 0, gold: 1, silver: 1, bronze: 0 }, bestRank: { date: "2026-10-19", rank: 2, participants: 9 }, streak: 2 },
  best: { date: "2026-10-20", trackId: TODAY, ms: 40_000, medal: "gold", splits: [11, 22], replay: "REPLAY-SERVEUR", simVersion: SIM_VERSION },
  past: [{ date: "2026-10-19", trackId: PAST, ms: 42_000, medal: "silver" }],
  ...patch,
});

describe("mergeProfile : le meilleur gagne", () => {
  it("un cache vide reçoit le pseudo, le record du jour avec sa rediffusion, les jours passés et la meilleure place", () => {
    const s = memory();
    const r = mergeProfile(profile(), s);
    expect(r).toEqual({ nameChanged: true, todayChanged: true, pastChanged: 1 });
    expect(s.getItem("cdj:name")).toBe("Nowy");
    expect(best(s, TODAY)).toMatchObject({ ms: 40_000, replay: "REPLAY-SERVEUR", medal: "gold", splits: [11, 22] });
    expect(s.getItem(`cdj:sub:${TODAY}`)).toBe("40000"); // confirmé par le serveur : rien à renvoyer
    expect(listPlayedDays(s).map((d) => [d.date, d.ms, d.medal])).toEqual([["2026-10-19", 42_000, "silver"], ["2026-10-20", 40_000, "gold"]]);
    expect([...loadRanks(s)]).toEqual([["2026-10-19", { rank: 2, participants: 9 }]]);
  });

  it("un temps battu sur un autre appareil remplace le local, avec son fantôme", () => {
    const s = memory({ [`cdj:best:${TODAY}`]: local(41_000, { replay: "VIEUX" }), "cdj:name": "Nowy" });
    const r = mergeProfile(profile(), s);
    expect(r.todayChanged).toBe(true);
    expect(r.nameChanged).toBe(false);
    expect(best(s, TODAY)!.replay).toBe("REPLAY-SERVEUR");
  });

  it("un record local meilleur (fait hors ligne) est gardé : il reste à envoyer", () => {
    const s = memory({ [`cdj:best:${TODAY}`]: local(39_000, { replay: "LOCAL" }) });
    const r = mergeProfile(profile(), s);
    expect(r.todayChanged).toBe(false);
    expect(best(s, TODAY)).toMatchObject({ ms: 39_000, replay: "LOCAL" });
    expect(Number(s.getItem(`cdj:sub:${TODAY}`))).toBe(40_000); // le serveur n'a que 40 000 : le jeu voit qu'il y a mieux à envoyer
  });

  it("à temps égal, le local sans rediffusion reçoit celle du serveur ; avec, il la garde", () => {
    const bare = memory({ [`cdj:best:${TODAY}`]: local(40_000) });
    expect(mergeProfile(profile(), bare).todayChanged).toBe(true);
    expect(best(bare, TODAY)!.replay).toBe("REPLAY-SERVEUR");
    const full = memory({ [`cdj:best:${TODAY}`]: local(40_000, { replay: "LOCAL" }) });
    expect(mergeProfile(profile(), full).todayChanged).toBe(false);
    expect(best(full, TODAY)!.replay).toBe("LOCAL");
  });

  it("une rediffusion d'une autre version de la simulation n'est pas gardée comme fantôme", () => {
    const s = memory({ [`cdj:best:${TODAY}`]: local(45_000) });
    mergeProfile(profile({ best: { ...profile().best!, simVersion: SIM_VERSION - 1 } }), s);
    expect(best(s, TODAY)!.ms).toBe(45_000); // le local reste, le fantôme du serveur serait faux avec cette physique
  });

  it("les jours passés : médaille et temps pour les archives, jamais écrasés par un moins bon temps", () => {
    const s = memory({ [`cdj:best:${PAST}`]: local(41_000, { medal: "gold" }) });
    expect(mergeProfile(profile(), s).pastChanged).toBe(0);
    expect(best(s, PAST)!.ms).toBe(41_000);
    const empty = memory();
    mergeProfile(profile(), empty);
    expect(listDayBests(empty).get("2026-10-19")).toEqual({ date: "2026-10-19", ms: 42_000, medal: "silver" });
  });

  it("ne supprime jamais rien : un record local d'un jour que le serveur ne connaît pas reste", () => {
    const s = memory({ "cdj:best:jour-2026-10-10-g15": local(50_000) });
    mergeProfile(profile({ best: null, past: [] }), s);
    expect(s.getItem("cdj:best:jour-2026-10-10-g15")).not.toBeNull();
  });

  it("ignore ce qui n'est pas un circuit du jour (identifiant piégé, trackId absent)", () => {
    const s = memory();
    mergeProfile(profile({ best: { ...profile().best!, trackId: "../../cdj:tune" }, past: [{ date: "2026-10-19", trackId: null, ms: 1, medal: null }, { date: "x", trackId: "essai", ms: 1, medal: null }] }), s);
    expect(Object.keys(s.dump()).filter((k) => k.startsWith("cdj:best"))).toEqual([]);
  });

  it("le pseudo du serveur remplace le local (changé sur un autre appareil)", () => {
    const s = memory({ "cdj:name": "Ancien" });
    expect(mergeProfile(profile({ name: "Nouveau" }), s).nameChanged).toBe(true);
    expect(s.getItem("cdj:name")).toBe("Nouveau");
    expect(mergeProfile(profile({ name: "Nouveau" }), s).nameChanged).toBe(false);
  });

  it("un stockage qui refuse l'écriture ne casse rien", () => {
    const full = { ...memory(), setItem: () => { throw new Error("quota"); } };
    expect(() => mergeProfile(profile(), full)).not.toThrow();
  });
});

// --- Le service ----------------------------------------------------------------------------------------------------------------
type Answer = ApiResult<MeProfile>;
function fakeApi(answers: Answer[] | ((id: string) => Answer)) {
  const seen: string[] = [];
  const api = {
    me: async (id: string) => {
      seen.push(id);
      return typeof answers === "function" ? answers(id) : answers.shift()!;
    },
  } as unknown as LeaderboardSource;
  return { api, seen };
}
const fail = (code: string, status: number): Answer => ({ ok: false, code, status, message: code });
const ID = "0123456789abcdef0123456789abcdef";
const NEXT = "fedcba9876543210fedcba9876543210";

function sync(api: LeaderboardSource | null, extra: { storage?: ReturnType<typeof memory>; now?: () => number; adopted?: string[] } = {}) {
  const storage = extra.storage ?? memory();
  return {
    storage,
    sync: new ProfileSync({ api: () => api, playerId: () => ID, adopt: (id) => void extra.adopted?.push(id), storage, now: extra.now ?? (() => 0) }),
  };
}

describe("ProfileSync", () => {
  it("fusionne le profil du serveur et se souvient de ce qu'il sait", async () => {
    const { api } = fakeApi([{ ok: true, data: profile({ renameRequired: true }) }]);
    const t = sync(api);
    const o = await t.sync.run();
    expect(o).toMatchObject({ status: "ok", ran: true, merged: { todayChanged: true } });
    expect(t.sync.state).toMatchObject({ status: "ok", known: true, renameRequired: true });
    expect(t.sync.state.stats?.days).toBe(2);
  });

  it("revenir dix fois à l'accueil ne fait pas dix requêtes (une par 30 s), sauf demande expresse", async () => {
    let now = 0;
    const { api, seen } = fakeApi(() => ({ ok: true, data: profile() }));
    const t = sync(api, { now: () => now });
    await t.sync.run();
    for (let i = 0; i < 9; i++) {
      now += 2_000;
      expect((await t.sync.run()).ran).toBe(false);
    }
    expect(seen).toHaveLength(1);
    now += 30_000;
    expect((await t.sync.run()).ran).toBe(true);
    expect((await t.sync.run({ force: true })).ran).toBe(true);
    expect(seen).toHaveLength(3);
  });

  it("plusieurs appels simultanés n'en font qu'un", async () => {
    const { api, seen } = fakeApi(() => ({ ok: true, data: profile() }));
    const t = sync(api);
    await Promise.all([t.sync.run(), t.sync.run(), t.sync.run({ force: true })]);
    expect(seen).toHaveLength(1);
  });

  it("hors ligne : le cache sert, rien n'est touché, l'état le dit", async () => {
    const t = sync(fakeApi([fail("network", 0)]).api, { storage: memory({ [`cdj:best:${TODAY}`]: local(41_000) }) });
    expect(await t.sync.run()).toMatchObject({ status: "offline", merged: null });
    expect(t.sync.state.status).toBe("offline");
    expect(best(t.storage, TODAY)!.ms).toBe(41_000);
  });

  it("serveur en panne (500) ou trop lent : même chose que hors ligne", async () => {
    expect((await sync(fakeApi([fail("internal", 500)]).api).sync.run()).status).toBe("offline");
    expect((await sync(fakeApi([fail("timeout", 0)]).api).sync.run()).status).toBe("offline");
  });

  it("profil inconnu du serveur : jamais classé, ce n'est pas une erreur", async () => {
    const t = sync(fakeApi([fail("unknown_player", 404)]).api);
    expect(await t.sync.run()).toMatchObject({ status: "unknown", merged: null });
    expect(t.sync.state.known).toBe(false);
  });

  it("code remplacé ailleurs : signalé, rien n'est touché", async () => {
    const t = sync(fakeApi([fail("code_revoked", 410)]).api, { storage: memory({ [`cdj:best:${TODAY}`]: local(41_000) }) });
    expect(await t.sync.run()).toMatchObject({ status: "revoked", merged: null });
    expect(best(t.storage, TODAY)!.ms).toBe(41_000);
  });

  it("notre propre « Changer mon code » dont la réponse s'est perdue : le nouvel identifiant gardé est adopté", async () => {
    const storage = memory({ "cdj:player:next": NEXT });
    const adopted: string[] = [];
    const { api, seen } = fakeApi((id) => (id === ID ? fail("code_revoked", 410) : { ok: true, data: profile() }));
    // `clearNextId` agit sur localStorage : on le simule ici pour le test.
    const store = new Map<string, string>([["cdj:player:next", NEXT]]);
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const t = sync(api, { storage, adopted });
    expect(await t.sync.run()).toMatchObject({ status: "ok" });
    expect(adopted).toEqual([NEXT]);
    expect(seen).toEqual([ID, NEXT]);
    expect(store.has("cdj:player:next")).toBe(false);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("sans serveur (aucune API) : rien à faire", async () => {
    const t = sync(null);
    expect(await t.sync.run()).toEqual({ status: "disabled", merged: null, ran: false });
  });

  it("avertit les cartes du profil quand l'état change, et oublie tout après un changement d'identité", async () => {
    const t = sync(fakeApi([{ ok: true, data: profile({ renameRequired: true }) }]).api);
    let calls = 0;
    const off = t.sync.subscribe(() => calls++);
    await t.sync.run();
    expect(calls).toBeGreaterThanOrEqual(2); // en cours, puis terminé
    t.sync.noteRenamed();
    expect(t.sync.state.renameRequired).toBe(false);
    t.sync.noteNameProblem({ message: "pris", suggestions: ["Nowy2"] });
    expect(t.sync.state.nameProblem?.suggestions).toEqual(["Nowy2"]);
    t.sync.reset();
    expect(t.sync.state).toMatchObject({ status: "idle", known: null, nameProblem: null, stats: null });
    off();
    const before = calls;
    t.sync.noteRenamed();
    expect(calls).toBe(before);
  });
});
