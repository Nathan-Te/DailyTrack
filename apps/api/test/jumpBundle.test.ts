import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, demoAttempts, encodeReplay, lifeReplay, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import { CACHE_CLOSED_S, CACHE_OPEN_S, cacheHeaders, mergeVary } from "../src/cache";
import { JUMP_GRACE_MS } from "../src/jump";
import { JUMP_MAP_REFRESH_MS } from "../src/jumpLives";
import { makeApi, parisDayStart, pilotReplay, playerId, TEST_DB, DAY as CDJ_DAY } from "./helpers";

// Lot P4 (plateforme) : moins de requêtes. La lecture regroupée `GET /api/jump/day/<date>/bundle` (classement, fantôme du premier, carte des
// morts, et le profil du jour avec `X-Player-Id` : une seule adresse personnelle par jour), le classement rendu par l'envoi, et les en-têtes de cache des lectures : long pour un jour figé,
// court pour le jour en cours, **jamais partagés** quand la réponse dépend de `X-Player-Id`. Tourne sur SQLite et sur libSQL.

// Lot 19 : le 13/11/2026 (lot 20 : en g15 le 29/10 n a plus que 1 essai fictif qui arrive, le 13/11 en a 4).
const DAY = daysFromCivil(2026, 11, 13);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;

let D: DailyLevel;
let runs: { code: string; ticks: number; deaths: number }[];
let lives: string[];

beforeAll(() => {
  D = dailyLevel(DAY);
  runs = [];
  lives = [];
  const seen = new Set<number>();
  // Les essais qui arrivent (les graines des tests du P1) et des vies qui finissent par une mort (celles du P3).
  for (const a of demoAttempts(D.level, D.replay, 0x5eed, { attempts: 40 }).filter((x) => x.end === "arrivée")) {
    const r = replayAttempt(D.level, a.replay, D.id);
    if (!r.finished || seen.has(r.time) || r.time <= D.authorTicks) continue;
    seen.add(r.time);
    runs.push({ code: encodeReplay(a.replay), ticks: r.time, deaths: r.deaths.length });
  }
  for (const a of demoAttempts(D.level, D.replay, 0x11fe, { attempts: 40, maxLives: 8 })) {
    for (const life of replayAttempt(D.level, a.replay, D.id).lives) {
      const code = encodeReplay(lifeReplay(a.replay, life));
      if (life.end === "mort" && lives.length < 8 && !lives.includes(code)) lives.push(code);
    }
  }
  runs.sort((a, b) => b.ticks - a.ticks);
  if (runs.length < 3 || lives.length < 3) throw new Error("trop peu d'essais fictifs");
});

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const submitBody = (code: string, extra: Record<string, unknown> = {}) => ({ levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code, ...extra });

async function jumpApi(options: { allowedOrigins?: string[] } = {}) {
  const t = await makeApi({ seed: false, environment: "recette", ...options });
  t.clock.now = NOON;
  return t;
}

/** Deux joueurs classés, des vies envoyées, la carte recalculée. */
async function dayWithPlayers() {
  const t = await jumpApi();
  expect((await t.call("POST", "/api/jump/submit", submitBody(runs[0]!.code, { name: "Alice" }), as(1))).status).toBe(200);
  expect((await t.call("POST", "/api/jump/submit", submitBody(runs[2]!.code, { name: "Bruno" }), as(2))).status).toBe(200);
  const lot = { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: lives.slice(0, 3) };
  expect((await t.call("POST", "/api/jump/lives", lot, as(1))).body.accepted).toBe(3);
  t.clock.now += JUMP_MAP_REFRESH_MS;
  return t;
}

describe(`lecture regroupée : GET /api/jump/day/<date>/bundle (${TEST_DB})`, () => {
  it("rend exactement le classement, le fantôme du premier et la carte des routes séparées, en une requête", async () => {
    const t = await dayWithPlayers();
    const [bundle, board, ghost, deaths] = await Promise.all([
      t.call("GET", `/api/jump/day/${DATE}/bundle`),
      t.call("GET", `/api/jump/day/${DATE}/board`),
      t.call("GET", `/api/jump/day/${DATE}/ghost/first`),
      t.call("GET", `/api/jump/day/${DATE}/deaths`),
    ]);
    expect(bundle.status, JSON.stringify(bundle.body)).toBe(200);
    expect(bundle.body).toEqual({ date: DATE, open: true, board: board.body, ghost: ghost.body, deaths: deaths.body });
    expect(bundle.body.board.participants).toBe(2);
    expect(bundle.body.ghost.name).toBe("Bruno"); // le plus rapide
    expect(bundle.body.deaths.deaths).toBe(3);
    expect(JSON.stringify(bundle.body)).not.toContain(playerId(1));
    expect(JSON.stringify(bundle.body)).not.toContain(playerId(2));
  });

  it("avec X-Player-Id : ta ligne et « c'est toi » ; sans classé : fantôme null (la route séparée répond 404)", async () => {
    const t = await dayWithPlayers();
    const mine = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(2));
    expect(mine.body.board.me).toMatchObject({ rank: 1, name: "Bruno" });
    expect(mine.body.ghost.mine).toBe(true);
    const other = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    expect(other.body.board.me).toMatchObject({ rank: 2, name: "Alice" });
    expect(other.body.ghost.mine).toBe(false);

    const empty = await jumpApi();
    const r = await empty.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(3));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      date: DATE,
      open: true,
      board: { date: DATE, open: true, participants: 0, levelId: null, top: [], me: null },
      ghost: null,
      deaths: { date: DATE, levelId: null, open: true, players: 0, deaths: 0, tiles: [] },
      // Un identifiant que le serveur ne connaît pas encore (jamais classé) : pas de profil, et la raison.
      profile: null,
      profileError: "unknown_player",
    });
    expect((await empty.call("GET", `/api/jump/day/${DATE}/ghost/first`)).status).toBe(404);
  });

  it("avec X-Player-Id (jour en cours) : le profil DailyJump du joueur (celui de /api/jump/me) ; inconnu ou code révoqué : null et la raison ; jamais sans en-tête", async () => {
    const t = await dayWithPlayers();
    const withProfile = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    const me = await t.call("GET", "/api/jump/me", undefined, as(1));
    expect(withProfile.body.profile).toEqual(me.body);
    expect(withProfile.body.profileError).toBeUndefined();
    const unknown = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(9));
    expect(unknown.status).toBe(200);
    expect([unknown.body.profile, unknown.body.profileError]).toEqual([null, "unknown_player"]);
    expect(unknown.body.board.participants).toBe(2); // le reste est servi
    const anonymous = await t.call("GET", `/api/jump/day/${DATE}/bundle`);
    expect("profile" in anonymous.body).toBe(false);
    expect("profileError" in anonymous.body).toBe(false);
    // « Changer mon code » : l'ancien identifiant est révoqué.
    expect((await t.call("POST", "/api/me/code", { newId: playerId(11) }, as(1))).status).toBe(200);
    const revoked = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    expect([revoked.body.profile, revoked.body.profileError]).toEqual([null, "code_revoked"]);
    expect(revoked.body.board.me).toBeNull(); // ses essais ont suivi le nouvel identifiant
  });

  it("un jour passé : figé (open: false), le même contenu ; le profil n'y est jamais lu", async () => {
    const t = await dayWithPlayers();
    const before = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS + 60_000;
    const after = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    expect(after.status).toBe(200);
    expect(after.body.open).toBe(false);
    expect(after.body.board).toEqual({ ...before.body.board, open: false });
    expect(after.body.ghost).toEqual(before.body.ghost);
    expect(after.body.deaths).toMatchObject({ open: false, players: before.body.deaths.players, deaths: before.body.deaths.deaths, tiles: before.body.deaths.tiles });
    expect("profile" in after.body).toBe(false);
  });

  it("dates refusées comme les autres lectures (futur, avant le premier niveau, illisible) ; GET seulement", async () => {
    const t = await jumpApi();
    expect((await t.call("GET", `/api/jump/day/${formatDay(DAY + 1)}/bundle`)).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/2020-01-01/bundle")).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/hier/bundle")).status).toBe(400);
    expect((await t.call("POST", `/api/jump/day/${DATE}/bundle`, {})).status).toBe(405);
  });

  it("n'écrit rien en base (lecture comptée en mémoire), même avec le profil", async () => {
    const t = await dayWithPlayers();
    await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1)); // carte recalculée et gardée : la lecture suivante n'écrit rien
    const count = async () => (await t.db.first<{ n: number }>("SELECT (SELECT COUNT(*) FROM rate) + (SELECT COUNT(*) FROM players) + (SELECT COUNT(*) FROM jump_results) AS n"))!.n;
    const before = await count();
    const deathsRow = await t.db.first("SELECT * FROM jump_deaths WHERE day = ?", [DAY]);
    for (let i = 0; i < 5; i++) await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, as(1));
    expect(await count()).toBe(before);
    expect(await t.db.first("SELECT * FROM jump_deaths WHERE day = ?", [DAY])).toEqual(deathsRow);
  });
});

describe(`l'envoi rend le classement (${TEST_DB})`, () => {
  it("`board` de la réponse = ce que /board rend juste après, ta ligne comprise (le jeu ne le relit pas)", async () => {
    const t = await jumpApi();
    await t.call("POST", "/api/jump/submit", submitBody(runs[0]!.code, { name: "Alice" }), as(1));
    const r = await t.call("POST", "/api/jump/submit", submitBody(runs[1]!.code, { name: "Bruno" }), as(2));
    const board = await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(2));
    expect(r.body.board).toEqual(board.body);
    expect(r.body.board.me).toMatchObject({ rank: 1, name: "Bruno" });
    // Un essai qui n'améliore pas : le meilleur gardé, son rang.
    const worse = await t.call("POST", "/api/jump/submit", submitBody(runs[0]!.code), as(2));
    expect(worse.body.improved).toBe(false);
    expect(worse.body.board).toEqual((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(2))).body);
  });
});

describe(`en-têtes de cache (${TEST_DB})`, () => {
  it("règle : personnel = private + Vary: X-Player-Id (jamais partagé) ; commun = public ; jour figé long, jour en cours court", () => {
    expect(cacheHeaders({ open: true, perPlayer: true })).toEqual({ "Cache-Control": `private, max-age=${CACHE_OPEN_S}`, Vary: "X-Player-Id" });
    expect(cacheHeaders({ open: false, perPlayer: true })).toEqual({ "Cache-Control": `private, max-age=${CACHE_CLOSED_S}`, Vary: "X-Player-Id" });
    expect(cacheHeaders({ open: true, perPlayer: false })).toEqual({ "Cache-Control": `public, max-age=${CACHE_OPEN_S}` });
    expect(cacheHeaders({ open: false, perPlayer: false })).toEqual({ "Cache-Control": `public, max-age=${CACHE_CLOSED_S}` });
    expect(cacheHeaders({ open: true, perPlayer: true, noCache: true })).toEqual({ "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
    expect(mergeVary("Origin", "X-Player-Id")).toBe("Origin, X-Player-Id");
    expect(mergeVary("Origin", "origin")).toBe("Origin");
    expect(mergeVary(undefined, undefined)).toBeUndefined();
  });

  it("chaque lecture de DailyJump porte le sien ; celles qui dépendent du joueur ne sont jamais publiques", async () => {
    const t = await dayWithPlayers();
    const cc = async (path: string, n?: number) => (await t.call("GET", path, undefined, n === undefined ? {} : as(n))).headers;
    const today = {
      level: await cc(`/api/jump/day/${DATE}`),
      board: await cc(`/api/jump/day/${DATE}/board`, 1),
      boardAnon: await cc(`/api/jump/day/${DATE}/board`),
      ghost: await cc(`/api/jump/day/${DATE}/ghost/first`, 1),
      deaths: await cc(`/api/jump/day/${DATE}/deaths`),
      carnage: await cc(`/api/jump/day/${DATE}/carnage`),
      bundle: await cc(`/api/jump/day/${DATE}/bundle`),
      bundleProfile: await cc(`/api/jump/day/${DATE}/bundle`, 1),
    };
    expect(today.level.get("cache-control")).toBe(`public, max-age=${CACHE_OPEN_S}`);
    expect(today.deaths.get("cache-control")).toBe(`public, max-age=${CACHE_OPEN_S}`);
    expect(today.carnage.get("cache-control")).toBe(`public, max-age=${CACHE_OPEN_S}`);
    for (const h of [today.board, today.boardAnon, today.ghost, today.bundle]) {
      expect(h.get("cache-control")).toBe(`private, max-age=${CACHE_OPEN_S}`);
      expect(h.get("vary")).toBe("X-Player-Id");
    }
    expect(today.bundleProfile.get("cache-control")).toBe("private, no-cache");
    expect(today.bundleProfile.get("vary")).toBe("X-Player-Id");
    // Toute réponse qui peut porter une donnée du joueur : jamais « public ».
    for (const h of [today.board, today.boardAnon, today.ghost, today.bundle, today.bundleProfile]) expect(h.get("cache-control")).not.toMatch(/public/);

    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS + 60_000;
    expect((await cc(`/api/jump/day/${DATE}`)).get("cache-control")).toBe(`public, max-age=${CACHE_CLOSED_S}`);
    expect((await cc(`/api/jump/day/${DATE}/deaths`)).get("cache-control")).toBe(`public, max-age=${CACHE_CLOSED_S}`);
    expect((await cc(`/api/jump/day/${DATE}/carnage`)).get("cache-control")).toBe(`public, max-age=${CACHE_CLOSED_S}`);
    for (const path of ["board", "ghost/first", "bundle"]) {
      const h = await cc(`/api/jump/day/${DATE}/${path}`, 1);
      expect(h.get("cache-control")).toBe(`private, max-age=${CACHE_CLOSED_S}`);
      expect(h.get("vary")).toBe("X-Player-Id");
    }
  });

  it("pendant la grâce de minuit, hier est encore ouvert : cache court", async () => {
    const t = await dayWithPlayers();
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS / 2;
    const h = (await t.call("GET", `/api/jump/day/${DATE}/bundle`)).headers;
    expect(h.get("cache-control")).toBe(`private, max-age=${CACHE_OPEN_S}`);
  });

  it("avec CORS par liste d'origines : Vary garde Origin et ajoute X-Player-Id", async () => {
    const t = await jumpApi({ allowedOrigins: ["https://nathan-te.github.io"] });
    const r = await t.call("GET", `/api/jump/day/${DATE}/bundle`, undefined, { headers: { Origin: "https://nathan-te.github.io" } });
    expect(r.headers.get("vary")).toBe("Origin, X-Player-Id");
    expect(r.headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
    const d = await t.call("GET", `/api/jump/day/${DATE}/deaths`, undefined, { headers: { Origin: "https://nathan-te.github.io" } });
    expect(d.headers.get("vary")).toBe("Origin");
  });

  it("les erreurs, les envois et toutes les routes de DailyTrack restent « no-store »", async () => {
    const t = await makeApi({ environment: "recette" });
    const { code } = pilotReplay(CDJ_DAY, 0.8);
    const routes = [
      await t.call("GET", "/api/health"),
      await t.call("GET", `/api/day/${formatDay(CDJ_DAY)}`),
      await t.call("POST", "/api/submit", { playerId: playerId(1), name: "Piste", date: formatDay(CDJ_DAY), replay: code }),
      await t.call("GET", `/api/day/${formatDay(CDJ_DAY)}/leaderboard?player=${playerId(1)}`),
      await t.call("GET", "/api/me", undefined, as(1)),
      await t.call("GET", "/api/jump/info"),
      await t.call("GET", `/api/jump/day/${formatDay(CDJ_DAY + 400)}/bundle`),
    ];
    for (const r of routes) expect(r.headers.get("cache-control")).toBe("no-store");
    expect(routes.slice(0, 5).every((r) => r.headers.get("vary") === null)).toBe(true);
  });
});
