import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, decodeReplay as decodeJumpReplay, demoAttempts, encodeReplay as encodeJumpReplay, repriseParPhase, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import { decodeReplay, encodeReplay, replayTicks } from "@cdj/sim";
import { readConfig } from "../src/config";
import { jumpInputs, inputsHash, trackInputs } from "../src/copies";
import { ensureSchemaOn } from "../src/db";
import { DAY, TEST_DB, circuitOf, makeApi, openTestDb, parisDayStart, pilotReplay, playerId } from "./helpers";

// Lot R9 (plateforme) : le refus des copies. Un classement du jour (DailyTrack, DailyJump) refuse (409 `replay_copy`) une rediffusion dont les entrées sont
// identiques à celles de l'auteur du niveau ou à celles d'une course déjà classée d'un autre joueur ce jour-là ; le même joueur qui renvoie sa propre
// course n'est pas concerné ; l'ordre d'arrivée ne change rien. Ces tests passent `allowCopies: false`, le réglage du serveur de production (les autres tests
// d'API le lèvent : `helpers.ts`). SQLite et libSQL.

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const REFUSE = { allowCopies: false } as const;

describe(`DailyTrack : refus des copies (${TEST_DB})`, () => {
  const author = encodeReplay(circuitOf(DAY).authorReplay);
  const fast = pilotReplay(DAY, 0.9);
  const mid = pilotReplay(DAY, 0.78);
  const submit = (t: Awaited<ReturnType<typeof makeApi>>, n: number, code: string, name?: string) => t.call("POST", "/api/submit", { date: formatDay(DAY), replay: code, ...(name ? { name } : {}) }, as(n));
  const count = async (t: Awaited<ReturnType<typeof makeApi>>, table: string) => (await t.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

  it("la copie de la rediffusion de l'auteur (le pilote) est refusée : 409 `replay_copy`, rien n'est écrit, pas même le joueur", async () => {
    const t = await makeApi(REFUSE);
    const r = await submit(t, 1, author, "Copieur");
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: "replay_copy" });
    expect(await count(t, "results")).toBe(0);
    expect(await count(t, "players")).toBe(0);
  });

  it("la copie d'une course déjà classée (le fantôme du premier, téléchargeable) est refusée ; l'originale garde sa place", async () => {
    const t = await makeApi(REFUSE);
    expect((await submit(t, 1, fast.code, "Premier")).status).toBe(200);
    const ghost = await t.call("GET", `/api/day/${formatDay(DAY)}/ghost?kind=first`);
    expect(ghost.status).toBe(200);
    const copy = await submit(t, 2, ghost.body.replay as string, "Copieur");
    expect(copy.status).toBe(409);
    expect(copy.body).toEqual({ error: "replay_copy" });
    const board = await t.call("GET", `/api/day/${formatDay(DAY)}/leaderboard`);
    expect(board.body.participants).toBe(1);
    expect(await count(t, "players")).toBe(1);
  });

  it("une vraie course est acceptée, avant comme après les autres : l'ordre d'arrivée est sans effet sur la règle", async () => {
    // A puis B, puis B puis A : dans les deux ordres, chacun est accepté (deux courses différentes) et la copie de l'une ou de l'autre est refusée.
    for (const [first, second] of [[fast, mid], [mid, fast]] as const) {
      const t = await makeApi(REFUSE);
      expect((await submit(t, 1, first.code, "Alice")).status).toBe(200);
      expect((await submit(t, 2, second.code, "Bob")).status).toBe(200);
      expect((await submit(t, 3, first.code, "Carl")).body.error).toBe("replay_copy");
      expect((await submit(t, 3, second.code, "Carl")).body.error).toBe("replay_copy");
      expect((await submit(t, 3, author, "Carl")).body.error).toBe("replay_copy");
      expect(await count(t, "results")).toBe(2);
    }
    // La copie de l'auteur est refusée sans que personne d'autre n'ait couru, et la course du pilote réglé autrement passe.
    const t = await makeApi(REFUSE);
    expect((await submit(t, 4, author, "Dan")).body.error).toBe("replay_copy");
    expect((await submit(t, 4, fast.code, "Dan")).status).toBe(200);
  });

  it("le même joueur qui renvoie sa propre course n'est pas concerné", async () => {
    const t = await makeApi(REFUSE);
    expect((await submit(t, 1, mid.code, "Alice")).status).toBe(200);
    const again = await submit(t, 1, mid.code);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ accepted: true, improved: false });
    // … une meilleure course du même joueur remplace la sienne : c'est elle, désormais, qu'on ne peut pas copier.
    expect((await submit(t, 1, fast.code)).body).toMatchObject({ accepted: true, improved: true });
    expect((await submit(t, 2, fast.code, "Bob")).body.error).toBe("replay_copy");
  });

  it("l'empreinte porte sur les entrées jouées : séries recollées ou coupées, pas ajoutés après l'arrivée, rien ne fait passer une copie", async () => {
    const t = await makeApi(REFUSE);
    expect((await submit(t, 1, fast.code, "Alice")).status).toBe(200);
    const replay = decodeReplay(fast.code);
    // (1) Une série coupée en deux (même commande, un autre codage d'octets) : les mêmes entrées.
    const first = replay.runs[0]!;
    expect(first.count).toBeGreaterThan(1);
    const split = { ...replay, runs: [{ ...first, count: 1 }, { ...first, count: first.count - 1 }, ...replay.runs.slice(1)] };
    expect(encodeReplay(split)).not.toBe(fast.code);
    expect((await submit(t, 2, encodeReplay(split), "Bob")).body.error).toBe("replay_copy");
    // (2) Des pas ajoutés après la ligne d'arrivée (le rejeu s'arrête à l'arrivée : ils ne comptent pas).
    const trailing = { ...replay, runs: [...replay.runs, { count: 30, steer: 1, throttle: 0, brake: 1, respawn: 0 }] };
    expect((await submit(t, 3, encodeReplay(trailing), "Carl")).body.error).toBe("replay_copy");
    expect(await count(t, "results")).toBe(1);
  });

  it("l'empreinte est gardée avec chaque résultat et avec le circuit (une colonne, migration en avant)", async () => {
    const t = await makeApi(REFUSE);
    expect((await submit(t, 1, fast.code, "Alice")).status).toBe(200);
    const result = await t.db.first<{ inputs_hash: string }>("SELECT inputs_hash FROM results");
    const replay = decodeReplay(fast.code);
    expect(result!.inputs_hash).toBe(await inputsHash(trackInputs(replay.runs, replayTicks(replay))));
    expect(result!.inputs_hash).toMatch(/^[0-9a-f]{64}$/);
    const circuit = await t.db.first<{ author_hash: string }>("SELECT author_hash FROM circuits");
    expect(circuit!.author_hash).toBe(await inputsHash(trackInputs(decodeReplay(author).runs, replayTicks(decodeReplay(author)))));
    expect(circuit!.author_hash).not.toBe(result!.inputs_hash);
  });

  it("un résultat d'avant le lot (sans empreinte) ne bloque personne ; un circuit d'avant est recalculé avec l'empreinte de son auteur", async () => {
    const t = await makeApi(REFUSE);
    expect((await submit(t, 1, fast.code, "Alice")).status).toBe(200);
    await t.db.run("UPDATE results SET inputs_hash = NULL");
    expect((await submit(t, 2, fast.code, "Bob")).status).toBe(200);
    // Le circuit gardé sans `author_hash` (écrit avant le lot) : le serveur le recalcule (même circuit) et la copie de l'auteur est refusée.
    const u = await makeApi(REFUSE);
    await u.db.run("UPDATE circuits SET author_hash = NULL");
    expect((await submit(u, 5, author, "Eve")).body.error).toBe("replay_copy");
    expect((await u.db.first<{ author_hash: string | null }>("SELECT author_hash FROM circuits"))!.author_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe(`le refus des copies n'est jamais réglé en production (${TEST_DB})`, () => {
  it("la configuration du serveur ne le connaît pas, `server.ts` ne le règle jamais ; `createApi` le refuse par défaut", async () => {
    const prod = readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://playdujour.com", RATE_SALT: "x".repeat(20), ALLOW_COPIES: "1", TURSO_DATABASE_URL: "libsql://cdj-prod.turso.io" } as Record<string, string>);
    expect(Object.keys(prod)).not.toContain("allowCopies");
    const server = readFileSync(join(__dirname, "..", "src", "server.ts"), "utf8");
    expect(server).not.toMatch(/allowCopies|ALLOW_COPIES/);
    // Sans réglage, la copie de l'auteur est refusée (ce que fait le serveur de production).
    const { createApi } = await import("../src/api");
    const db = await openTestDb();
    const api = createApi({ db, now: () => parisDayStart(DAY) + 12 * 3_600_000 });
    const res = await api.handle(new Request("http://api.test/api/submit", { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": playerId(1) }, body: JSON.stringify({ date: formatDay(DAY), replay: encodeReplay(circuitOf(DAY).authorReplay), name: "Copieur" }) }), { clientKey: "203.0.113.9" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "replay_copy" });
  });
});

describe(`migration en avant (${TEST_DB})`, () => {
  it("une base d'avant le lot reçoit les colonnes d'empreinte et leurs index sans rien perdre", async () => {
    const db = await openTestDb();
    // Les quatre tables telles qu'elles étaient avant le lot R9 (sans empreinte), avec une ligne chacune.
    await db.run("CREATE TABLE results (day INTEGER NOT NULL, player_id TEXT NOT NULL, ms INTEGER NOT NULL, splits TEXT NOT NULL, replay TEXT NOT NULL, respawns INTEGER NOT NULL, submitted_at INTEGER NOT NULL, final_rank INTEGER, final_total INTEGER, PRIMARY KEY (day, player_id))");
    await db.run("CREATE TABLE circuits (day INTEGER PRIMARY KEY, track_id TEXT NOT NULL, spec TEXT NOT NULL, author_ms INTEGER NOT NULL, attempt INTEGER NOT NULL, palette TEXT NOT NULL, created_at INTEGER NOT NULL)");
    await db.run("CREATE TABLE jump_results (day INTEGER NOT NULL, player_id TEXT NOT NULL, level_id TEXT NOT NULL, ticks INTEGER NOT NULL, deaths INTEGER NOT NULL, replay TEXT NOT NULL, sim_version INTEGER NOT NULL, generator_version INTEGER NOT NULL, first_at INTEGER NOT NULL, submitted_at INTEGER NOT NULL, final_rank INTEGER, final_total INTEGER, PRIMARY KEY (day, player_id))");
    await db.run("CREATE TABLE jump_levels (day INTEGER PRIMARY KEY, rule TEXT NOT NULL, level_id TEXT NOT NULL, hash TEXT NOT NULL, author_ticks INTEGER NOT NULL, medals TEXT NOT NULL, theme TEXT NOT NULL, source TEXT NOT NULL, ascii TEXT NOT NULL, created_at INTEGER NOT NULL)");
    await db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (1, 'p', 30000, '[]', 'x', 0, 1)");
    await ensureSchemaOn(db);
    for (const [table, column] of [["results", "inputs_hash"], ["circuits", "author_hash"], ["jump_results", "inputs_hash"], ["jump_levels", "author_hash"]] as const) {
      const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(cols.map((c) => c.name), table).toContain(column);
    }
    const indexes = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map((i) => i.name);
    expect(indexes).toContain("results_by_inputs");
    expect(indexes).toContain("jump_results_by_inputs");
    expect((await db.first<{ ms: number; inputs_hash: string | null }>("SELECT ms, inputs_hash FROM results"))).toEqual({ ms: 30000, inputs_hash: null });
    // Idempotent : une seconde application (autre instance) ne casse rien.
    await ensureSchemaOn(db);
  });
});

// ——— DailyJump ———
const JDAY = daysFromCivil(2026, 10, 28);
const JDATE = formatDay(JDAY);
const JNOON = parisDayStart(JDAY) + 12 * 3_600_000;
let D: DailyLevel;
let authorCode: string;
let runs: { code: string; ticks: number }[];

beforeAll(() => {
  D = dailyLevel(JDAY);
  authorCode = D.code;
  const seen = new Set<number>();
  runs = [];
  for (const a of demoAttempts(D.level, D.replay, 0x5eed, { attempts: 40, reprise: repriseParPhase(D) })) {
    const r = replayAttempt(D.level, a.replay, D.id);
    if (a.end !== "arrivée" || !r.finished || seen.has(r.time) || r.time <= D.authorTicks) continue;
    seen.add(r.time);
    runs.push({ code: encodeJumpReplay(a.replay), ticks: r.time });
  }
  if (runs.length < 3) throw new Error("trop peu d'essais fictifs arrivent");
}, 120_000);

describe(`DailyJump : refus des copies (${TEST_DB})`, () => {
  const jbody = (code: string, extra: Record<string, unknown> = {}) => ({ levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code, ...extra });
  async function jumpApi(options: Parameters<typeof makeApi>[0] = REFUSE) {
    const t = await makeApi({ seed: false, environment: "recette", ...options });
    t.clock.now = JNOON;
    return t;
  }
  const submit = (t: Awaited<ReturnType<typeof makeApi>>, n: number, code: string, name?: string) => t.call("POST", "/api/jump/submit", jbody(code, name ? { name } : {}), as(n));
  const count = async (t: Awaited<ReturnType<typeof makeApi>>, table: string) => (await t.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

  it("la copie de la preuve de l'auteur est refusée : 409 `replay_copy`, rien n'est écrit, pas même le joueur", async () => {
    const t = await jumpApi();
    const r = await submit(t, 1, authorCode, "Copieur");
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: "replay_copy" });
    expect(await count(t, "jump_results")).toBe(0);
    expect(await count(t, "players")).toBe(0);
  });

  it("la copie du fantôme du premier est refusée ; l'originale garde sa place ; une vraie course est acceptée", async () => {
    const t = await jumpApi();
    expect((await submit(t, 1, runs[0]!.code, "Premier")).status).toBe(200);
    const ghost = await t.call("GET", `/api/jump/day/${JDATE}/ghost/first`);
    expect(ghost.status).toBe(200);
    const copy = await submit(t, 2, ghost.body.replay as string, "Copieur");
    expect(copy.status).toBe(409);
    expect(copy.body).toEqual({ error: "replay_copy" });
    expect((await t.call("GET", `/api/jump/day/${JDATE}/board`)).body).toMatchObject({ participants: 1, top: [{ name: "Premier" }] });
    // Une vraie course (d'autres entrées) passe.
    expect((await submit(t, 2, runs[1]!.code, "Honnête")).status).toBe(200);
    expect((await t.call("GET", `/api/jump/day/${JDATE}/board`)).body.participants).toBe(2);
  });

  it("l'ordre d'arrivée est sans effet ; le même joueur qui renvoie sa propre course n'est pas concerné", async () => {
    for (const [a, b] of [[runs[0]!, runs[1]!], [runs[1]!, runs[0]!]] as const) {
      const t = await jumpApi();
      expect((await submit(t, 1, a.code, "Alice")).status).toBe(200);
      expect((await submit(t, 2, b.code, "Bob")).status).toBe(200);
      for (const code of [a.code, b.code, authorCode]) expect((await submit(t, 3, code, "Carl")).body.error).toBe("replay_copy");
      expect(await count(t, "jump_results")).toBe(2);
      const again = await submit(t, 1, a.code);
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ accepted: true, improved: false });
    }
  });

  it("l'empreinte porte sur les entrées : une série coupée en deux (autre codage d'octets) ne fait pas passer une copie", async () => {
    const t = await jumpApi();
    expect((await submit(t, 1, runs[0]!.code, "Alice")).status).toBe(200);
    const replay = decodeJumpReplay(runs[0]!.code);
    const first = replay.runs.find((r) => r.count > 1)!;
    const i = replay.runs.indexOf(first);
    const split = { ...replay, runs: [...replay.runs.slice(0, i), { ...first, count: 1 }, { ...first, count: first.count - 1 }, ...replay.runs.slice(i + 1)] };
    expect(encodeJumpReplay(split)).not.toBe(runs[0]!.code);
    expect(jumpInputs(split.runs)).toBe(jumpInputs(replay.runs));
    expect((await submit(t, 2, encodeJumpReplay(split), "Bob")).body.error).toBe("replay_copy");
  });

  it("l'empreinte est gardée avec chaque essai et avec le niveau ; un niveau ou un essai d'avant le lot ne bloque personne", async () => {
    const t = await jumpApi();
    expect((await submit(t, 1, runs[0]!.code, "Alice")).status).toBe(200);
    const row = await t.db.first<{ inputs_hash: string }>("SELECT inputs_hash FROM jump_results");
    expect(row!.inputs_hash).toBe(await inputsHash(jumpInputs(decodeJumpReplay(runs[0]!.code).runs)));
    const level = await t.db.first<{ author_hash: string }>("SELECT author_hash FROM jump_levels");
    expect(level!.author_hash).toBe(await inputsHash(jumpInputs(D.replay.runs)));
    // Un essai sans empreinte (d'avant le lot) : la même course d'un autre joueur passe (limite connue, README du lot R9).
    await t.db.run("UPDATE jump_results SET inputs_hash = NULL");
    expect((await submit(t, 2, runs[0]!.code, "Bob")).status).toBe(200);
    // Un niveau gardé sans `author_hash` est recalculé (même niveau) : la copie de la preuve reste refusée.
    const u = await jumpApi();
    expect((await submit(u, 5, runs[1]!.code, "Eve")).status).toBe(200);
    await u.db.run("UPDATE jump_levels SET author_hash = NULL");
    const fresh = await jumpApi({ ...REFUSE, db: u.db });
    fresh.clock.now = JNOON;
    expect((await submit(fresh, 6, authorCode, "Dan")).body.error).toBe("replay_copy");
    expect((await u.db.first<{ author_hash: string | null }>("SELECT author_hash FROM jump_levels"))!.author_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("par défaut (`allowCopies` levé, outils de données fictives) la copie passe : c'est ce que font `history:seed`, `jump:seed` et `recette:seed`", async () => {
    const t = await jumpApi({ allowCopies: true });
    expect((await submit(t, 1, authorCode, "Auteur")).status).toBe(200);
    expect((await submit(t, 2, authorCode, "Démo")).status).toBe(200);
  });
});
