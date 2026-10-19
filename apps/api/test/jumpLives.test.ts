import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  dailyLevel,
  demoAttempts,
  encodeReplay,
  lifeReplay,
  replayAttempt,
  sectionAt,
  tileOf,
  type DailyLevel,
  type JumpReplay,
} from "@cdj/jump-sim";
import type { SqlDb, SqlValue } from "../src/db";
import { JUMP_GRACE_MS } from "../src/jump";
import {
  JUMP_LIVES_PER_DAY,
  JUMP_MAP_REFRESH_MS,
  JUMP_SAMPLE_PER_PLAYER,
  buildDeathMap,
  sampleCarnage,
  type StoredLife,
} from "../src/jumpLives";
import type { Logger } from "../src/log";
import { makeApi, openTestDb, parisDayStart, playerId, TEST_DB } from "./helpers";

// Lot P3 (plateforme) : les morts de tout le monde. `POST /api/jump/lives` (débit → taille → jour → versions → joueur existant → plafonds →
// rejeu de chaque vie), la déduplication, au plus deux lignes écrites par lot, la carte des morts, l'échantillon du carnage, l'oubli des vies
// brutes à la fin du jour. Tourne sur SQLite et sur libSQL.

const DAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;

let D: DailyLevel;
/** Des vies qui finissent par une mort (rediffusions), avec ce que le rejeu en dit. */
let deaths: { code: string; cause: number; x: number; y: number; section: number; checkpoint: number }[];
/** Des vies qui ne finissent pas par une mort (arrivée ou abandon). */
let others: { code: string; end: string }[];

beforeAll(() => {
  D = dailyLevel(DAY);
  deaths = [];
  others = [];
  const seen = new Set<string>();
  for (const a of demoAttempts(D.level, D.replay, 0x11fe, { attempts: 40, maxLives: 8 })) {
    for (const life of replayAttempt(D.level, a.replay, D.id).lives) {
      const code = encodeReplay(lifeReplay(a.replay, life));
      if (seen.has(code)) continue;
      seen.add(code);
      if (life.end === "mort" && life.death) deaths.push({ code, ...life.death, section: sectionAt(D.level, life.death.x), checkpoint: life.start.checkpoint });
      else others.push({ code, end: life.end });
    }
  }
  if (deaths.length < 45 || others.length < 1) throw new Error(`trop peu de vies fictives (${deaths.length} morts, ${others.length} autres)`);
});

/** Compte les lignes écrites par table (hors compteurs de débit) : chaque écriture est suivie de `changes()`. */
function counting(db: SqlDb & { close(): void }) {
  const written: Record<string, number> = {};
  const isWrite = (sql: string) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
  const tableOf = (sql: string) => /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1] ?? "?";
  async function note(sql: string): Promise<void> {
    if (!isWrite(sql)) return;
    const table = tableOf(sql);
    if (table === "rate") return;
    const n = (await db.first<{ n: number }>("SELECT changes() AS n"))?.n ?? 0;
    written[table] = (written[table] ?? 0) + n;
  }
  const wrapped: SqlDb & { close(): void } = {
    close: () => db.close(),
    async run(sql: string, params?: SqlValue[]) {
      await db.run(sql, params);
      await note(sql);
    },
    async first<T>(sql: string, params?: SqlValue[]) {
      const r = await db.first<T>(sql, params);
      await note(sql);
      return r;
    },
    all: (sql, params) => db.all(sql, params),
  };
  return { db: wrapped, written, reset: () => Object.keys(written).forEach((k) => delete written[k]) };
}

async function livesApi(extra: { log?: Logger; limits?: { windowMs: number; perClient: number; perPlayer: number }; db?: SqlDb & { close(): void } } = {}) {
  const t = await makeApi({ seed: false, environment: "recette", ...extra });
  t.clock.now = NOON;
  return t;
}

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const lot = (lives: unknown, extra: Record<string, unknown> = {}) => ({ levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives, ...extra });

/** Le joueur `n` existe : il a un essai classé (la preuve de l'auteur). */
async function known(t: Awaited<ReturnType<typeof livesApi>>, n: number, name = `Joueur${n}`) {
  const r = await t.call("POST", "/api/jump/submit", { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: D.code, name }, as(n));
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

describe(`POST /api/jump/lives (${TEST_DB})`, () => {
  it("un inconnu est refusé (404 unknown_player) : rien n'est écrit, le jeu garde ses vies", async () => {
    const t = await livesApi();
    const r = await t.call("POST", "/api/jump/lives", lot([deaths[0]!.code]), as(1));
    expect([r.status, r.body.error]).toEqual([404, "unknown_player"]);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_lives")).toEqual({ n: 0 });
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_deaths")).toEqual({ n: 0 });
  });

  it("rejoue chaque vie : position et cause calculées par le serveur ; seules les morts sont gardées", async () => {
    const t = await livesApi();
    await known(t, 2);
    const sent = deaths.slice(0, 5);
    const r = await t.call("POST", "/api/jump/lives", lot([...sent.map((d) => d.code), others[0]!.code]), as(2));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ accepted: 5, received: 6, duplicates: 0, invalid: 0, notDeath: 1, overCap: 0, dayCount: 5, cap: JUMP_LIVES_PER_DAY, message: "" });
    expect(r.body.results).toEqual(["ok", "ok", "ok", "ok", "ok", "not_death"]);
    const row = await t.db.first<{ count: number; lives: string; level_id: string }>("SELECT count, lives, level_id FROM jump_lives WHERE day = ? AND player_id = ?", [DAY, playerId(2)]);
    expect(row?.count).toBe(5);
    expect(row?.level_id).toBe(D.id);
    const stored = JSON.parse(row!.lives) as StoredLife[];
    expect(stored.map((l) => [l[1], l[2], l[3], l[4], l[5]])).toEqual(sent.map((d) => [tileOf(d.x), tileOf(d.y), d.cause, d.section, d.code]));
    expect(await t.db.first("SELECT version, frozen FROM jump_deaths WHERE day = ?", [DAY])).toEqual({ version: 1, frozen: 0 });
  });

  it("une vie forgée est écartée seule, le reste du lot est accepté : en-tête incohérent, mort inventée, autre niveau, illisible", async () => {
    const t = await livesApi();
    await known(t, 3);
    const fromCheckpoint = deaths.find((d) => d.checkpoint >= 1)!;
    const replay = JSON.parse(JSON.stringify((await import("@cdj/jump-sim")).decodeReplay(fromCheckpoint.code))) as JumpReplay;
    const incoherent = encodeReplay({ ...replay, start: { ...replay.start, sections: replay.start.sections.map(() => -1) } });
    // « Mort inventée » : la vie coupée juste avant sa mort ne meurt pas au rejeu (abandon) ; ce que le jeu en dirait ne compte pas.
    const cut: JumpReplay = { ...replay, runs: replay.runs.slice(0, -1) };
    const otherLevel = encodeReplay({ ...replay, levelId: `jour-${formatDay(DAY - 1)}-g${JUMP_GENERATOR_VERSION}` });
    const r = await t.call("POST", "/api/jump/lives", lot([incoherent, encodeReplay(cut), otherLevel, "pas-une-rediffusion", deaths[1]!.code]), as(3));
    expect(r.status).toBe(200);
    expect(r.body.results).toEqual(["invalid", "not_death", "invalid", "invalid", "ok"]);
    expect(r.body).toMatchObject({ accepted: 1, invalid: 3, notDeath: 1, dayCount: 1 });
  });

  it("déduplication : un lot renvoyé (même joueur, même contenu) n'est pas compté deux fois ; rien n'est écrit", async () => {
    const c = counting(await openTestDb());
    const t = await livesApi({ db: c.db });
    await known(t, 4);
    const codes = deaths.slice(0, 4).map((d) => d.code);
    expect((await t.call("POST", "/api/jump/lives", lot(codes), as(4))).body.accepted).toBe(4);
    c.reset();
    const again = await t.call("POST", "/api/jump/lives", lot([...codes, codes[0]]), as(4));
    expect(again.body).toMatchObject({ accepted: 0, duplicates: 5, dayCount: 4 });
    expect(c.written).toEqual({});
    // Un autre joueur peut avoir la même vie : elle compte pour lui.
    await known(t, 5);
    expect((await t.call("POST", "/api/jump/lives", lot([codes[0]]), as(5))).body.accepted).toBe(1);
  });

  it("au plus deux lignes écrites par lot (jamais une ligne par mort), quel que soit le nombre de vies", async () => {
    const c = counting(await openTestDb());
    const t = await livesApi({ db: c.db });
    await known(t, 6);
    for (const n of [1, 12, 17]) {
      c.reset();
      const start = n === 1 ? 0 : n === 12 ? 1 : 13;
      const r = await t.call("POST", "/api/jump/lives", lot(deaths.slice(start, start + n).map((d) => d.code)), as(6));
      expect(r.body.accepted).toBe(n);
      expect(c.written).toEqual({ jump_lives: 1, jump_deaths: 1 });
    }
  });

  it("plafond de 30 morts par joueur et par jour : les vies en trop sont refusées et la réponse le dit ; 30 au plus par lot", async () => {
    const t = await livesApi();
    await known(t, 7);
    const first = await t.call("POST", "/api/jump/lives", lot(deaths.slice(0, 25).map((d) => d.code)), as(7));
    expect(first.body).toMatchObject({ accepted: 25, dayCount: 25, overCap: 0 });
    const second = await t.call("POST", "/api/jump/lives", lot(deaths.slice(25, 35).map((d) => d.code)), as(7));
    expect(second.body).toMatchObject({ accepted: 5, dayCount: 30, overCap: 5 });
    expect(second.body.message).toMatch(/au plus 30 morts par joueur et par jour/);
    expect(second.body.results.slice(5)).toEqual(new Array(5).fill("over_cap"));
    expect(await t.db.first("SELECT count FROM jump_lives WHERE player_id = ?", [playerId(7)])).toEqual({ count: 30 });
    const tooMany = await t.call("POST", "/api/jump/lives", lot(new Array(31).fill(deaths[0]!.code)), as(7));
    expect([tooMany.status, tooMany.body.error]).toEqual([413, "too_many_lives"]);
    const empty = await t.call("POST", "/api/jump/lives", lot([]), as(7));
    expect(empty.status).toBe(400);
  });

  it("une vie trop longue (plus de 2 minutes) n'est pas rejouée", async () => {
    const t = await livesApi();
    await known(t, 8);
    const long = encodeReplay({ simVersion: JUMP_SIM_VERSION, levelId: D.id, start: { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 }, runs: [{ count: 120 * 121, bits: 0 }] });
    const r = await t.call("POST", "/api/jump/lives", lot([long, deaths[2]!.code]), as(8));
    expect(r.body.results).toEqual(["too_long", "ok"]);
  });

  it("refus : autre version, autre jour (archive), thème forcé, futur ; code révoqué", async () => {
    const t = await livesApi();
    await known(t, 9);
    const one = [deaths[0]!.code];
    for (const [extra, status, error] of [
      [{ simVersion: JUMP_SIM_VERSION + 1 }, 409, "version"],
      [{ generatorVersion: JUMP_GENERATOR_VERSION - 1 }, 409, "version"],
      [{ levelId: `jour-${DATE}-g${JUMP_GENERATOR_VERSION - 1}` }, 409, "version"],
      [{ levelId: `jour-${formatDay(DAY - 1)}-g${JUMP_GENERATOR_VERSION}` }, 409, "day_closed"],
      [{ levelId: `${D.id}-tglace` }, 409, "not_daily"],
      [{ levelId: `jour-${formatDay(DAY + 1)}-g${JUMP_GENERATOR_VERSION}` }, 409, "not_daily"],
      [{ levelId: "essai" }, 400, "invalid_level"],
    ] as const) {
      const r = await t.call("POST", "/api/jump/lives", lot(one, extra), as(9));
      expect([r.status, r.body.error], JSON.stringify(extra)).toEqual([status, error]);
    }
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_lives")).toEqual({ n: 0 });
    // « Changer mon code » : l'ancien est refusé (410), les vies suivent le nouveau.
    expect((await t.call("POST", "/api/jump/lives", lot(one), as(9))).body.accepted).toBe(1);
    const rot = await t.call("POST", "/api/me/code", { newId: playerId(99) }, as(9));
    expect(rot.status).toBe(200);
    expect((await t.call("POST", "/api/jump/lives", lot([deaths[1]!.code]), as(9))).status).toBe(410);
    expect(await t.db.first("SELECT player_id, count FROM jump_lives")).toEqual({ player_id: playerId(99), count: 1 });
  });

  it("le débit est compté en base avant de lire le corps et avant tout rejeu", async () => {
    const log: string[] = [];
    const t = await livesApi({ limits: { windowMs: 600_000, perClient: 3, perPlayer: 100 }, log: (_s, message) => void log.push(message) });
    await known(t, 10); // 1 envoi de l'adresse (compteur de DailyJump : `jip`) ; les vies ont le leur (`jlip`)
    for (let k = 0; k < 3; k++) expect((await t.call("POST", "/api/jump/lives", lot([deaths[k]!.code]), as(10))).status).toBe(200);
    const limited = await t.call("POST", "/api/jump/lives", { raw: "pas du json" } as never, { ...as(10), raw: "pas du json" });
    expect(limited.status).toBe(429);
    expect(log.filter((m) => m === "DailyJump : vies du jour")).toHaveLength(3);
    const keys = (await t.db.all<{ key: string }>("SELECT key FROM rate")).map((r) => r.key.split(":")[0]);
    expect(new Set(keys)).toEqual(new Set(["jip", "jp", "jlip", "jlp"]));
  });

  it("journaux : ni rediffusion, ni pseudo, ni identifiant, ni adresse", async () => {
    const lines: string[] = [];
    const t = await livesApi({ log: (severity, message, fields) => void lines.push(JSON.stringify({ severity, message, ...fields })) });
    await known(t, 11, "Secret");
    await t.call("POST", "/api/jump/lives", lot(deaths.slice(0, 3).map((d) => d.code)), as(11));
    await t.call("GET", `/api/jump/day/${DATE}/deaths`);
    const all = lines.join("\n");
    expect(all).toMatch(/vies du jour/);
    for (const secret of [playerId(11), "Secret", "203.0.113.7", deaths[0]!.code, deaths[0]!.code.slice(0, 24)]) expect(all).not.toContain(secret);
  });
});

describe(`carte des morts et échantillon du carnage (${TEST_DB})`, () => {
  it("carte agrégée par tuile, cause dominante, joueurs et morts ; recalculée au plus toutes les 3 minutes", async () => {
    const t = await livesApi();
    for (const n of [20, 21, 22]) await known(t, n);
    const a = deaths.slice(0, 10);
    const b = deaths.slice(5, 15);
    await t.call("POST", "/api/jump/lives", lot(a.map((d) => d.code)), as(20));
    await t.call("POST", "/api/jump/lives", lot(b.map((d) => d.code)), as(21));
    const r = await t.call("GET", `/api/jump/day/${DATE}/deaths`);
    expect(r.status).toBe(200);
    const all = [...a, ...b];
    const expected = buildDeathMap([{ lives: a.map((d) => ["h", tileOf(d.x), tileOf(d.y), d.cause, 0, ""] as StoredLife) }, { lives: b.map((d) => ["h", tileOf(d.x), tileOf(d.y), d.cause, 0, ""] as StoredLife) }]);
    expect(r.body).toEqual({ date: DATE, levelId: D.id, open: true, players: 2, deaths: all.length, tiles: expected.tiles });
    expect(r.body.tiles.reduce((n: number, tile: number[]) => n + tile[2]!, 0)).toBe(all.length);
    // Un nouveau lot : la carte reste celle d'avant pendant 3 minutes (mémoire de l'instance), puis suit.
    await t.call("POST", "/api/jump/lives", lot(deaths.slice(30, 33).map((d) => d.code)), as(22));
    expect((await t.call("GET", `/api/jump/day/${DATE}/deaths`)).body.deaths).toBe(all.length);
    t.clock.now += JUMP_MAP_REFRESH_MS;
    expect((await t.call("GET", `/api/jump/day/${DATE}/deaths`)).body).toMatchObject({ players: 3, deaths: all.length + 3 });
    // Une instance neuve lit la carte gardée en base (aucun recalcul : rien de nouveau).
    const lines: string[] = [];
    const fresh = await makeApi({ db: t.db, seed: false, log: (_s, m) => void lines.push(m) });
    fresh.clock.now = t.clock.now;
    const again = await fresh.call("GET", `/api/jump/day/${DATE}/deaths`);
    expect(again.body.deaths).toBe(all.length + 3);
    expect(lines).not.toContain("DailyJump : carte des morts calculée");
  });

  it("buildDeathMap : chaque mort compte une fois, cause dominante (à égalité la plus petite), N tuiles au plus", () => {
    const l = (col: number, row: number, cause: number): StoredLife => ["h", col, row, cause, 0, ""];
    const map = buildDeathMap([{ lives: [l(5, 3, 1), l(5, 3, 2), l(5, 3, 2), l(9, 9, 3)] }, { lives: [l(5, 3, 1), l(2, 2, 3), l(2, 2, 1)] }, { lives: [] }], 2);
    expect(map).toEqual({ players: 2, deaths: 7, tiles: [[5, 3, 4, 1], [2, 2, 2, 1]] });
  });

  it("échantillon : réparti entre les joueurs (3 au plus chacun) et le long du niveau, déterministe, sans identifiant", async () => {
    const t = await livesApi();
    const players = 12;
    const sections = new Set<number>();
    for (let n = 0; n < players; n++) {
      await known(t, 40 + n);
      const mine = deaths.slice((n * 4) % deaths.length, ((n * 4) % deaths.length) + 6);
      for (const d of mine) sections.add(d.section);
      await t.call("POST", "/api/jump/lives", lot(mine.map((d) => d.code)), as(40 + n));
    }
    const r = await t.call("GET", `/api/jump/day/${DATE}/carnage`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: DATE, levelId: D.id, open: true, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, dayPlayers: players });
    const lives = r.body.lives as { replay: string; section: number; p: number }[];
    const perPlayer = new Map<number, number>();
    for (const l of lives) perPlayer.set(l.p, (perPlayer.get(l.p) ?? 0) + 1);
    expect(Math.max(...perPlayer.values())).toBeLessThanOrEqual(JUMP_SAMPLE_PER_PLAYER);
    expect(perPlayer.size).toBe(r.body.players);
    expect(lives.length).toBe(Math.min(150, players * JUMP_SAMPLE_PER_PLAYER));
    expect(new Set(lives.map((l) => l.section))).toEqual(sections);
    const text = JSON.stringify(r.body);
    for (let n = 0; n < players; n++) {
      expect(text).not.toContain(playerId(40 + n));
      expect(text).not.toContain(`Joueur${40 + n}`);
    }
    // Déterministe : la même chose d'une instance à l'autre.
    const other = await makeApi({ db: t.db, seed: false });
    other.clock.now = t.clock.now;
    expect((await other.call("GET", `/api/jump/day/${DATE}/carnage`)).body).toEqual(r.body);
  });

  it("sampleCarnage : toutes les sections représentées, déterministe à partir du jour, au plus `size` vies", () => {
    const rows = Array.from({ length: 80 }, (_, p) => ({
      player: playerId(1000 + p),
      lives: Array.from({ length: 10 }, (_, k): StoredLife => [`h${p}-${k}`, k, 1, 1, p % 2 === 0 ? 0 : (k % 4) + 1, `vie${p}-${k}`]),
    }));
    const a = sampleCarnage(DAY, rows, { sections: 6 });
    expect(a.lives.length).toBe(150);
    expect(new Set(a.lives.map((l) => l.section))).toEqual(new Set([0, 1, 2, 3, 4]));
    const counts = [0, 1, 2, 3, 4].map((s) => a.lives.filter((l) => l.section === s).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(20);
    expect(sampleCarnage(DAY, rows, { sections: 6 })).toEqual(a);
    expect(sampleCarnage(DAY + 1, rows, { sections: 6 }).lives.map((l) => l.replay)).not.toEqual(a.lives.map((l) => l.replay));
    expect(sampleCarnage(DAY, [...rows].reverse(), { sections: 6 })).toEqual(a);
    expect(sampleCarnage(DAY, rows, { size: 10 }).lives).toHaveLength(10);
    expect(sampleCarnage(DAY, [])).toEqual({ lives: [], players: 0 });
  });
});

describe(`l'oubli des vies brutes à la fin du jour (${TEST_DB})`, () => {
  it("à la première requête qui voit le jour terminé : carte et échantillon figés, vies brutes effacées ; pas pendant la grâce", async () => {
    const t = await livesApi();
    for (const n of [60, 61]) await known(t, n);
    await t.call("POST", "/api/jump/lives", lot(deaths.slice(0, 8).map((d) => d.code)), as(60));
    await t.call("POST", "/api/jump/lives", lot(deaths.slice(8, 20).map((d) => d.code)), as(61));
    const map = (await t.call("GET", `/api/jump/day/${DATE}/deaths`)).body;
    const sample = (await t.call("GET", `/api/jump/day/${DATE}/carnage`)).body;
    // Juste après minuit (grâce) : le jour accepte encore des vies, rien n'est oublié.
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS - 1000;
    await t.call("GET", `/api/jump/day/${formatDay(DAY + 1)}/deaths`);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_lives WHERE day = ?", [DAY])).toEqual({ n: 2 });
    // La grâce passée : la première requête fige et oublie.
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS + 1000;
    const lines: string[] = [];
    const later = await makeApi({ db: t.db, seed: false, log: (_s, m) => void lines.push(m) });
    later.clock.now = t.clock.now;
    await later.call("GET", "/api/jump/info");
    expect(lines).toContain("DailyJump : vies du jour oubliées, carte et échantillon figés");
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_lives")).toEqual({ n: 0 });
    expect(await t.db.first("SELECT frozen FROM jump_deaths WHERE day = ?", [DAY])).toEqual({ frozen: 1 });
    const frozenMap = (await later.call("GET", `/api/jump/day/${DATE}/deaths`)).body;
    expect(frozenMap).toEqual({ ...map, open: false });
    const frozenSample = (await later.call("GET", `/api/jump/day/${DATE}/carnage`)).body;
    expect(frozenSample).toEqual({ ...sample, open: false });
    // Plus aucune vie acceptée pour ce jour ; l'ancienne instance aussi le voit (et n'efface rien de plus).
    expect((await later.call("POST", "/api/jump/lives", lot([deaths[30]!.code]), as(60))).body.error).toBe("day_closed");
    expect((await t.call("GET", `/api/jump/day/${DATE}/deaths`)).body).toEqual({ ...map, open: false });
    expect(lines.filter((m) => m.startsWith("DailyJump : vies du jour oubliées"))).toHaveLength(1);
  });

  it("un jour sans vies : carte vide, échantillon vide", async () => {
    const t = await livesApi();
    expect((await t.call("GET", `/api/jump/day/${DATE}/deaths`)).body).toEqual({ date: DATE, levelId: null, open: true, players: 0, deaths: 0, tiles: [] });
    expect((await t.call("GET", `/api/jump/day/${DATE}/carnage`)).body).toMatchObject({ players: 0, dayPlayers: 0, lives: [] });
    expect((await t.call("GET", `/api/jump/day/${formatDay(DAY + 1)}/deaths`)).status).toBe(404);
    // Les lectures n'écrivent rien (débit en mémoire).
    expect(await t.db.first("SELECT COUNT(*) AS n FROM rate")).toEqual({ n: 0 });
  });
});
