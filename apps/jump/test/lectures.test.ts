import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION } from "@cdj/jump-sim";
import { PLAYER_KEY, createIdentity, type ApiResult, type KeyValueStore } from "@cdj/profile";
import { ARRIVAL_REFRESH_MS, DayReads, READ_FRESH_MS, type DayBundle } from "../src/dayReads";
import { DEMO_TODAY, DemoRankSource, type DemoDay } from "../src/demoRank";
import type { FirstGhostData } from "../src/firstGhost";
import type { JumpMe } from "../src/jumpProfile";
import type { DeathMapData, JumpBoard, JumpSubmitResult, RankEntry, RankSource } from "../src/rankApi";
import { RankQueue } from "../src/rankQueue";
import { Ranking } from "../src/ranking";

// Lot P4 (plateforme) : moins de requêtes. Les lectures du jour regroupées (`dayReads.ts` : une requête pour le classement, le fantôme du premier,
// la carte des morts et le profil), jamais relues en moins de 30 s (3 min à l'arrivée), une lecture en cours partagée, le repli sur les routes
// séparées d'un serveur plus ancien ; et le classement rendu par l'envoi (`Ranking` ne relit plus `/board` après un envoi accepté).

class MemStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

const DAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(DAY);
const LEVEL = `jour-${DATE}-g${JUMP_GENERATOR_VERSION}`;
const ME = "a".repeat(32);

const board = (participants: number, me: JumpBoard["me"] = null): JumpBoard => ({
  date: DATE,
  open: true,
  participants,
  levelId: participants ? LEVEL : null,
  top: participants ? [{ rank: 1, name: "Alice", ticks: 3000, deaths: 0, medal: "gold" }] : [],
  me,
});
const ghost: FirstGhostData = { date: DATE, levelId: LEVEL, name: "Alice", ticks: 3000, deaths: 0, replay: "r", simVersion: 3, generatorVersion: JUMP_GENERATOR_VERSION, mine: false };
const deaths: DeathMapData = { date: DATE, levelId: LEVEL, open: true, players: 2, deaths: 5, tiles: [[3, 4, 5, 0]] };
const profile: JumpMe = { name: "Moi", renameRequired: false, today: DATE, simVersion: 3, generatorVersion: JUMP_GENERATOR_VERSION, days: [], stats: { days: 0, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, streak: 0 } };

/** Un faux serveur qui compte ses requêtes par route. */
function fakeServer(o: { bundle?: boolean; offline?: boolean; profileError?: string } = {}) {
  const calls: string[] = [];
  const ok = <T>(data: T): Promise<ApiResult<T>> => Promise.resolve({ ok: true, data });
  const down = <T>(): Promise<ApiResult<T>> => Promise.resolve({ ok: false, status: 0, code: "network", message: "Classement injoignable" });
  const source: RankSource = {
    me: () => down(),
    checkName: () => down(),
    rename: () => down(),
    rotateCode: () => down(),
    submit: () => down(),
    board: (_d, id) => (calls.push(`board:${id ?? "-"}`), o.offline ? down() : ok(board(2, id ? { rank: 2, name: "Moi", ticks: 3100, deaths: 1, medal: "silver" } : null))),
    firstGhost: () => (calls.push("ghost"), o.offline ? down() : ok(ghost)),
    deaths: () => (calls.push("deaths"), o.offline ? down() : ok(deaths)),
    jumpMe: () => (calls.push("me"), o.offline ? down() : ok(profile)),
    ...(o.bundle === false
      ? {}
      : {
          bundle: (date: string, id: string | null, opt?: { fresh?: boolean }) => {
            calls.push(`bundle:${id ?? "-"}${opt?.fresh ? ":frais" : ""}`);
            if (o.offline) return down<DayBundle>();
            const b: DayBundle = { date, open: true, board: board(2, id ? { rank: 2, name: "Moi", ticks: 3100, deaths: 1, medal: "silver" } : null), ghost, deaths };
            if (id) Object.assign(b, o.profileError ? { profile: null, profileError: o.profileError } : { profile });
            return ok(b);
          },
        }),
  };
  return { source, calls };
}

describe("lectures du jour regroupées (DayReads)", () => {
  it("une seule requête pour le classement, le fantôme du premier et la carte ; annoncée à tous (onLoad)", async () => {
    const { source, calls } = fakeServer();
    const reads = new DayReads({ source, now: () => 0 });
    const seen: DayBundle[] = [];
    reads.onLoad((b) => seen.push(b));
    const r = await reads.load(DATE, null);
    expect(r.ok && r.data.board.participants).toBe(2);
    expect(r.ok && r.data.ghost?.name).toBe("Alice");
    expect(r.ok && r.data.deaths.deaths).toBe(5);
    expect(calls).toEqual(["bundle:-"]);
    expect(seen).toHaveLength(1);
    expect(reads.stats).toMatchObject({ requests: 1, bundles: 1, fallbacks: 0 });
  });

  it("jamais relu en moins de 30 s ; relu après ; à l'arrivée, seulement après 3 minutes", async () => {
    const clock = { now: 0 };
    const { source, calls } = fakeServer();
    const reads = new DayReads({ source, now: () => clock.now });
    await reads.load(DATE, ME);
    clock.now = READ_FRESH_MS - 1;
    await reads.load(DATE, ME);
    expect(calls).toHaveLength(1);
    expect(reads.stats.served).toBe(1);
    clock.now = READ_FRESH_MS;
    await reads.load(DATE, ME);
    expect(calls).toHaveLength(2);
    // L'arrivée : la lecture d'il y a moins de 3 minutes suffit.
    clock.now += ARRIVAL_REFRESH_MS - 1;
    await reads.load(DATE, ME, { maxAgeMs: ARRIVAL_REFRESH_MS });
    expect(calls).toHaveLength(2);
    clock.now += 1;
    await reads.load(DATE, ME, { maxAgeMs: ARRIVAL_REFRESH_MS });
    expect(calls).toHaveLength(3);
  });

  it("une lecture en cours est partagée : chargement, profil et classement simultanés = une requête", async () => {
    const { source, calls } = fakeServer();
    const reads = new DayReads({ source, now: () => 0 });
    const [a, b, p] = await Promise.all([reads.load(DATE, ME), reads.load(DATE, ME), reads.profile(DATE, ME)]);
    expect(calls).toEqual([`bundle:${ME}`]);
    expect(a).toEqual(b);
    expect(p).toEqual({ ok: true, data: profile });
  });

  it("le profil de la synchronisation vient de la lecture du jour (même identifiant, moins de 30 s) ; refus traduits comme /api/jump/me", async () => {
    const clock = { now: 0 };
    const { source, calls } = fakeServer();
    const reads = new DayReads({ source, now: () => clock.now });
    await reads.load(DATE, ME);
    expect(await reads.profile(DATE, ME)).toEqual({ ok: true, data: profile });
    expect(calls).toHaveLength(1);
    // Un autre identifiant (« Changer mon code » dont la réponse s'était perdue) : une autre lecture.
    await reads.profile(DATE, "b".repeat(32));
    expect(calls).toHaveLength(2);
    // `force` (synchronisation forcée) : relu, le navigateur revalide.
    await reads.profile(DATE, ME, { force: true });
    expect(calls.at(-1)).toBe(`bundle:${ME}:frais`);

    const revoked = new DayReads({ source: fakeServer({ profileError: "code_revoked" }).source, now: () => 0 });
    expect(await revoked.profile(DATE, ME)).toMatchObject({ ok: false, status: 410, code: "code_revoked" });
    const unknown = new DayReads({ source: fakeServer({ profileError: "unknown_player" }).source, now: () => 0 });
    expect(await unknown.profile(DATE, ME)).toMatchObject({ ok: false, status: 404, code: "unknown_player" });
  });

  it("une identité créée depuis (premier envoi) : la lecture gardée sans identifiant ne vaut plus (ta ligne, ton profil)", async () => {
    const { source, calls } = fakeServer();
    const reads = new DayReads({ source, now: () => 0 });
    await reads.load(DATE, null);
    await reads.load(DATE, ME);
    expect(calls).toEqual(["bundle:-", `bundle:${ME}`]);
  });

  it("hors ligne : l'échec est une valeur, rien n'est gardé, la prochaine occasion réessaie ; sans serveur, aucune requête", async () => {
    const { source, calls } = fakeServer({ offline: true });
    const reads = new DayReads({ source, now: () => 0 });
    const seen: DayBundle[] = [];
    reads.onLoad((b) => seen.push(b));
    expect(await reads.load(DATE, ME)).toMatchObject({ ok: false, status: 0 });
    expect(await reads.load(DATE, ME)).toMatchObject({ ok: false, status: 0 });
    expect(calls).toHaveLength(2);
    expect(seen).toEqual([]);
    expect(reads.last(DATE)).toBeNull();
    const none = new DayReads({ source: null, now: () => 0 });
    expect(none.enabled).toBe(false);
    expect(await none.load(DATE, ME)).toMatchObject({ ok: false, code: "disabled" });
  });

  it("un serveur d'avant le lot P4 (404 not_found sur bundle) : les routes séparées, le même contenu", async () => {
    const { source, calls } = fakeServer({ bundle: false });
    const reads = new DayReads({ source, now: () => 0 });
    const r = await reads.load(DATE, ME);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data).toMatchObject({ board: { participants: 2 }, ghost: { name: "Alice" }, deaths: { deaths: 5 } });
    expect(calls.sort()).toEqual([`board:${ME}`, "deaths", "ghost"]);
    expect(await reads.profile(DATE, ME, { force: true })).toEqual({ ok: true, data: profile });
    expect(calls).toContain("me");

    const old = fakeServer();
    old.source.bundle = (async () => ({ ok: false, status: 404, code: "not_found", message: "Route inconnue" })) as RankSource["bundle"];
    const r2 = await new DayReads({ source: old.source, now: () => 0 }).load(DATE, null);
    expect(r2.ok && r2.data.board.participants).toBe(2);
  });

  it("démonstration : un seul fichier lu pour le classement, le premier et la carte ; rien n'est envoyé", async () => {
    const fetched: string[] = [];
    const day: DemoDay = {
      date: formatDay(DEMO_TODAY),
      number: 15,
      levelId: `jour-${formatDay(DEMO_TODAY)}-g${JUMP_GENERATOR_VERSION}`,
      medals: { author: 1000, gold: 1100, silver: 1300, bronze: 1600 },
      participants: 1,
      top: [{ rank: 1, name: "Démo Renard", ticks: 1050, deaths: 0, medal: "gold" }],
      first: { name: "Démo Renard", ticks: 1050, deaths: 0, replay: "r", simVersion: 3, generatorVersion: JUMP_GENERATOR_VERSION },
      deaths: { players: 1, deaths: 3, tiles: [[1, 2, 3, 0]] },
    };
    const demo = new DemoRankSource("demo/", new MemStore(), async (url, init) => {
      fetched.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(JSON.stringify(day));
    });
    const reads = new DayReads({ source: demo, now: () => 0 });
    const r = await reads.load(day.date, null);
    expect(r.ok && r.data).toMatchObject({ open: true, board: { participants: 1, top: [{ name: "Démo Renard" }] }, ghost: { name: "Démo Renard", mine: false }, deaths: { players: 1, deaths: 3 } });
    expect(fetched).toEqual([`GET demo/${day.date}.json`]);
  });
});

describe("l'envoi rend le classement : rien à relire (Ranking)", () => {
  const entry: RankEntry = { date: DATE, levelId: LEVEL, replay: "r", ticks: 3100, deaths: 1 };
  const result = (withBoard: boolean): JumpSubmitResult => ({
    accepted: true,
    date: DATE,
    levelId: LEVEL,
    ticks: 3100,
    deaths: 1,
    improved: true,
    bestTicks: 3100,
    bestDeaths: 1,
    medal: "silver",
    rank: 2,
    participants: 2,
    ...(withBoard ? { board: board(2, { rank: 2, name: "Moi", ticks: 3100, deaths: 1, medal: "silver" }) } : {}),
  });

  function ranking(withBoard: boolean) {
    const store = new MemStore();
    store.setItem(PLAYER_KEY, ME);
    store.setItem("cdj:name", "Moi");
    const calls: string[] = [];
    const accepted: JumpSubmitResult[] = [];
    const { source } = fakeServer();
    source.submit = async () => (calls.push("submit"), { ok: true, data: result(withBoard) });
    source.board = async () => (calls.push("board"), { ok: true, data: board(2, { rank: 2, name: "Moi", ticks: 3100, deaths: 1, medal: "silver" }) });
    const r = new Ranking({
      source,
      queue: new RankQueue(store, () => 0),
      identity: createIdentity(() => store),
      identityStore: () => store,
      today: () => DAY,
      sinceMidnight: () => 3_600_000,
      setTimer: () => null,
      clearTimer: () => {},
      now: () => 0,
      onAccepted: (res) => accepted.push(res),
    });
    return { r, calls, accepted };
  }

  it("après un envoi accepté, le classement de la réponse est gardé (rang connu, top 10) : aucune lecture de /board", async () => {
    const { r, calls, accepted } = ranking(true);
    r.offer(entry);
    await r.flush();
    expect(calls).toEqual(["submit"]);
    expect(r.boards.get(DATE)).toMatchObject({ status: "ok", board: { participants: 2, me: { rank: 2 } } });
    expect(r.known(DATE)).toMatchObject({ rank: 2, participants: 2, ticks: 3100 });
    expect(accepted[0]?.board?.top[0]?.name).toBe("Alice");
  });

  it("un serveur plus ancien (pas de classement dans la réponse) : /board est relu, comme avant", async () => {
    const { r, calls } = ranking(false);
    r.offer(entry);
    await r.flush();
    await new Promise((res) => setTimeout(res, 0));
    expect(calls).toEqual(["submit", "board"]);
  });

  it("un classement lu ailleurs (la lecture du jour) : gardé sans requête ; un échec le dit sans perdre le précédent", () => {
    const { r, calls } = ranking(true);
    r.noteBoardLoading(DATE);
    expect(r.boards.get(DATE)?.status).toBe("loading");
    r.noteBoard(DATE, board(2, { rank: 2, name: "Moi", ticks: 3100, deaths: 1, medal: "silver" }));
    expect(r.known(DATE)).toMatchObject({ rank: 2 });
    r.noteBoardLoading(DATE); // déjà un classement : il reste affiché
    expect(r.boards.get(DATE)?.status).toBe("ok");
    r.noteBoardFailed(DATE, true, "x");
    expect(r.boards.get(DATE)).toMatchObject({ status: "offline", board: { participants: 2 }, code: "reseau" }); // lot I5 : un code, le texte vient du catalogue
    expect(calls).toEqual([]);
  });
});
