import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  dailyLevel,
  demoAttempts,
  encodeReplay,
  jumpMedalFor,
  replayAttempt,
  type DailyLevel,
  type JumpReplay,
} from "@cdj/jump-sim";
import { GRACE_MS } from "../src/api";
import { readConfig } from "../src/config";
import { JUMP_GRACE_MS } from "../src/jump";
import type { Logger } from "../src/log";
import { DAY_MS, makeApi, parisDayStart, playerId, TEST_DB } from "./helpers";

// Lot P1 (plateforme) : le classement du jour de DailyJump, prouvé par rejeu. `POST /api/jump/submit` (débit → taille → jour → versions → rejeu),
// la table `jump_results`, `GET /api/jump/day/<date>/board`, les égalités, le jour passé figé. Tourne sur SQLite et sur libSQL.

/** Jour de test fixe : le 13/11/2026 (niveau généré, pas figé ; lot 20 : en g15 le 29/10 n a plus que 1 essai fictif qui arrive, le 13/11 en a 4 et 2 plateformes). Midi à Paris. */
const DAY = daysFromCivil(2026, 11, 13);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;

let D: DailyLevel;
/** Des essais qui arrivent, du plus lent au plus rapide (le dernier : la preuve de l'auteur). */
let runs: { code: string; ticks: number; deaths: number }[];

beforeAll(() => {
  D = dailyLevel(DAY);
  const attempts = demoAttempts(D.level, D.replay, 0x5eed, { attempts: 40 }).filter((a) => a.end === "arrivée");
  const seen = new Set<number>();
  runs = [];
  for (const a of attempts) {
    const r = replayAttempt(D.level, a.replay, D.id);
    if (!r.finished || seen.has(r.time) || r.time <= D.authorTicks) continue;
    seen.add(r.time);
    runs.push({ code: encodeReplay(a.replay), ticks: r.time, deaths: r.deaths.length });
  }
  runs.sort((a, b) => b.ticks - a.ticks);
  runs.push({ code: D.code, ticks: D.authorTicks, deaths: 0 });
  if (runs.length < 4) throw new Error("trop peu d'essais fictifs arrivent");
}, 60_000); // génération du niveau du jour et des essais fictifs : ≈ 9 s mesurées en local pour le plus long, plus sur le runner de la CI (limite par défaut : 10 s)

async function jumpApi(extra: { log?: Logger; limits?: { windowMs: number; perClient: number; perPlayer: number } } = {}) {
  const t = await makeApi({ seed: false, environment: "recette", ...extra });
  t.clock.now = NOON;
  return t;
}

const body = (code: string, extra: Record<string, unknown> = {}) => ({ levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code, ...extra });
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

describe(`POST /api/jump/submit (${TEST_DB})`, () => {
  it("rejoue l'essai et garde le temps et les morts du serveur ; crée le joueur ; rend médaille, rang et nombre de classés", async () => {
    const t = await jumpApi();
    const slow = runs[0]!;
    const r = await t.call("POST", "/api/jump/submit", body(slow.code, { name: "Alice" }), as(1));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toEqual({
      accepted: true,
      date: DATE,
      levelId: D.id,
      ticks: slow.ticks,
      deaths: slow.deaths,
      improved: true,
      bestTicks: slow.ticks,
      bestDeaths: slow.deaths,
      medal: jumpMedalFor(slow.ticks, D.medals),
      rank: 1,
      participants: 1,
      // Lot P4 : l'envoi rend aussi le classement d'après l'envoi (le jeu ne relit pas `/board`).
      board: {
        date: DATE,
        open: true,
        participants: 1,
        levelId: D.id,
        top: [{ rank: 1, name: "Alice", ticks: slow.ticks, deaths: slow.deaths, medal: jumpMedalFor(slow.ticks, D.medals) }],
        me: { rank: 1, name: "Alice", ticks: slow.ticks, deaths: slow.deaths, medal: jumpMedalFor(slow.ticks, D.medals) },
      },
    });
    const row = await t.db.first<Record<string, unknown>>("SELECT * FROM jump_results WHERE day = ? AND player_id = ?", [DAY, playerId(1)]);
    expect(row).toMatchObject({ level_id: D.id, ticks: slow.ticks, deaths: slow.deaths, replay: slow.code, sim_version: JUMP_SIM_VERSION, generator_version: JUMP_GENERATOR_VERSION, first_at: NOON, submitted_at: NOON });
    expect(await t.db.first("SELECT name, demo FROM players WHERE id = ?", [playerId(1)])).toEqual({ name: "Alice", demo: 0 });
  });

  it("un temps annoncé n'est jamais cru : seuls comptent le rejeu du serveur (temps, morts)", async () => {
    const t = await jumpApi();
    const slow = runs[0]!;
    const r = await t.call("POST", "/api/jump/submit", body(slow.code, { name: "Menteur", ticks: 1, time: 1, deaths: 0, ms: 1 }), as(2));
    expect(r.status).toBe(200);
    expect([r.body.ticks, r.body.deaths]).toEqual([slow.ticks, slow.deaths]);
    expect(await t.db.first("SELECT ticks, deaths FROM jump_results WHERE player_id = ?", [playerId(2)])).toEqual({ ticks: slow.ticks, deaths: slow.deaths });
  });

  it("le meilleur essai n'est remplacé que par un temps strictement meilleur", async () => {
    const t = await jumpApi();
    const [slow, mid] = [runs[0]!, runs[1]!];
    expect((await t.call("POST", "/api/jump/submit", body(mid.code, { name: "Bob" }), as(3))).body.improved).toBe(true);
    t.clock.now += 1000;
    const worse = await t.call("POST", "/api/jump/submit", body(slow.code), as(3));
    expect(worse.body).toMatchObject({ improved: false, ticks: slow.ticks, bestTicks: mid.ticks });
    t.clock.now += 1000;
    const same = await t.call("POST", "/api/jump/submit", body(mid.code), as(3));
    expect(same.body).toMatchObject({ improved: false, bestTicks: mid.ticks });
    expect(await t.db.first("SELECT ticks, submitted_at, first_at FROM jump_results WHERE player_id = ?", [playerId(3)])).toEqual({ ticks: mid.ticks, submitted_at: NOON, first_at: NOON });
    t.clock.now += 1000;
    const best = await t.call("POST", "/api/jump/submit", body(D.code), as(3));
    expect(best.body).toMatchObject({ improved: true, ticks: D.authorTicks, bestTicks: D.authorTicks, medal: "author" });
    expect(await t.db.first("SELECT ticks, submitted_at, first_at FROM jump_results WHERE player_id = ?", [playerId(3)])).toEqual({ ticks: D.authorTicks, submitted_at: NOON + 3000, first_at: NOON });
  });

  it("refuse une autre version (simulation, générateur, niveau d'une autre règle) : 409 version", async () => {
    const t = await jumpApi();
    const sim = await t.call("POST", "/api/jump/submit", body(D.code, { name: "V", simVersion: JUMP_SIM_VERSION + 1 }), as(4));
    expect(sim.status).toBe(409);
    expect(sim.body.error).toBe("version");
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "V", generatorVersion: JUMP_GENERATOR_VERSION - 1 }), as(4))).body.error).toBe("version");
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "V", simVersion: undefined }), as(4))).body.error).toBe("version");
    // Le jeu a joué le niveau d'une autre règle (même date, autre générateur) : le serveur ne joue pas ce niveau-là.
    const other = await t.call("POST", "/api/jump/submit", body(D.code, { name: "V", levelId: `jour-${DATE}-g${JUMP_GENERATOR_VERSION - 1}` }), as(4));
    expect([other.status, other.body.error]).toEqual([409, "version"]);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_results")).toEqual({ n: 0 });
    expect(await t.db.first("SELECT COUNT(*) AS n FROM players")).toEqual({ n: 0 });
  });

  it("le niveau du jour seulement : archive, thème forcé, date future, avant le premier niveau, identifiant illisible", async () => {
    const t = await jumpApi();
    const yesterday = `jour-${formatDay(DAY - 1)}-g${JUMP_GENERATOR_VERSION}`;
    const archive = await t.call("POST", "/api/jump/submit", body(D.code, { name: "W", levelId: yesterday }), as(5));
    expect([archive.status, archive.body.error]).toEqual([409, "day_closed"]);
    const forced = await t.call("POST", "/api/jump/submit", body(D.code, { name: "W", levelId: `${D.id}-tglace` }), as(5));
    expect([forced.status, forced.body.error]).toEqual([409, "not_daily"]);
    const future = await t.call("POST", "/api/jump/submit", body(D.code, { name: "W", levelId: `jour-${formatDay(DAY + 1)}-g${JUMP_GENERATOR_VERSION}` }), as(5));
    expect([future.status, future.body.error]).toEqual([409, "not_daily"]);
    const before = await t.call("POST", "/api/jump/submit", body(D.code, { name: "W", levelId: `jour-2026-10-01-g${JUMP_GENERATOR_VERSION}` }), as(5));
    expect([before.status, before.body.error]).toEqual([409, "not_daily"]);
    for (const levelId of ["essai", "module:cheminee:1", "jour-2026-13-40-g9", 42, undefined]) {
      expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "W", levelId }), as(5))).status, String(levelId)).toBe(400);
    }
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_results")).toEqual({ n: 0 });
  });

  it("refuse un essai qui n'arrive pas, une rediffusion abîmée, une vie qui ne part pas du départ, la rediffusion d'un autre niveau", async () => {
    const t = await jumpApi();
    const half: JumpReplay = { ...D.replay, runs: D.replay.runs.slice(0, Math.floor(D.replay.runs.length / 2)) };
    const short = await t.call("POST", "/api/jump/submit", body(encodeReplay(half), { name: "X" }), as(6));
    expect([short.status, short.body.error]).toEqual([422, "not_finished"]);
    for (const code of ["AAAA", "!!!", "", D.code.slice(0, 12), `${D.code}AAAA`]) {
      const r = await t.call("POST", "/api/jump/submit", body(code, { name: "X" }), as(6));
      expect(r.status, code).toBe(400);
      expect(r.body.error).toBe("invalid_replay");
    }
    const fromCheckpoint: JumpReplay = { ...D.replay, start: { checkpoint: 0, held: 0, time: 0, sections: D.level.sections.map(() => -1), elan: 0 } };
    expect((await t.call("POST", "/api/jump/submit", body(encodeReplay(fromCheckpoint), { name: "X" }), as(6))).body.error).toBe("invalid_replay");
    const otherLevel: JumpReplay = { ...D.replay, levelId: `jour-${formatDay(DAY - 1)}-g${JUMP_GENERATOR_VERSION}` };
    expect((await t.call("POST", "/api/jump/submit", body(encodeReplay(otherLevel), { name: "X" }), as(6))).body.error).toBe("invalid_replay");
    expect(await t.db.first("SELECT COUNT(*) AS n FROM players")).toEqual({ n: 0 });
  });

  it("identifiant dans l'en-tête X-Player-Id (jamais dans le corps ni l'adresse), pseudo exigé au premier essai, pseudo pris refusé avec suggestions", async () => {
    const t = await jumpApi();
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "Y", playerId: playerId(7) }))).body.error).toBe("invalid_player");
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "Y" }), { headers: { "X-Player-Id": "pas-un-id" } })).status).toBe(400);
    const anonymous = await t.call("POST", "/api/jump/submit", body(D.code), as(7));
    expect([anonymous.status, anonymous.body.error]).toEqual([400, "name_required"]);
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "Nowy" }), as(7))).status).toBe(200);
    const taken = await t.call("POST", "/api/jump/submit", body(runs[0]!.code, { name: "NOWY" }), as(8));
    expect([taken.status, taken.body.error]).toEqual([409, "name_taken"]);
    expect(taken.body.suggestions.length).toBeGreaterThan(0);
    // Le joueur connu n'a plus besoin d'envoyer son pseudo.
    expect((await t.call("POST", "/api/jump/submit", body(D.code), as(7))).status).toBe(200);
  });

  it("une identité créée par DailyTrack garde son pseudo dans DailyJump (même table `players`)", async () => {
    const t = await jumpApi();
    await t.call("GET", "/api/jump/info"); // le schéma
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, 'Pilote', 1, 1, 0, 'pilote')", [playerId(9)]);
    const r = await t.call("POST", "/api/jump/submit", body(D.code), as(9));
    expect(r.status).toBe(200);
    const board = await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(9));
    expect(board.body.me).toMatchObject({ name: "Pilote", rank: 1 });
  });

  it("le débit est compté en base avant de lire le corps et avant tout rejeu (par adresse, par joueur)", async () => {
    const log: string[] = [];
    const t = await jumpApi({ limits: { windowMs: 600_000, perClient: 100, perPlayer: 2 }, log: (_s, message) => void log.push(message) });
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "Zoé" }), as(10))).status).toBe(200);
    expect((await t.call("POST", "/api/jump/submit", body(D.code), as(10))).status).toBe(200);
    // Troisième envoi : refusé avant le rejeu, même avec un corps illisible ou un niveau d'un autre jour.
    const third = await t.call("POST", "/api/jump/submit", undefined, { ...as(10), raw: "pas du json" });
    expect([third.status, third.body.error]).toEqual([429, "rate_limited"]);
    expect(third.headers.get("retry-after")).toBeTruthy();
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { levelId: "x" }), as(10))).status).toBe(429);
    expect(log.filter((m) => m === "DailyJump : essai du jour")).toHaveLength(2);
    // Compteurs en base, propres à DailyJump : ceux de DailyTrack (`ip:`, `p:`) ne bougent pas.
    const keys = (await t.db.all<{ key: string }>("SELECT key FROM rate")).map((r) => r.key.split(":")[0]).sort();
    expect([...new Set(keys)]).toEqual(["jip", "jp"]);
    // Par adresse.
    const t2 = await jumpApi({ limits: { windowMs: 600_000, perClient: 1, perPlayer: 100 } });
    await t2.call("POST", "/api/jump/submit", undefined, { ...as(11), raw: "{}" });
    expect((await t2.call("POST", "/api/jump/submit", body(D.code, { name: "Zed" }), as(12))).status).toBe(429);
  });

  it("taille du corps : 413 au-delà de la limite", async () => {
    const t = await jumpApi();
    const r = await t.call("POST", "/api/jump/submit", undefined, { ...as(13), raw: JSON.stringify(body("A".repeat(500_000))) });
    expect(r.status).toBe(413);
  });

  it("un code révoqué est refusé (410)", async () => {
    const t = await jumpApi();
    expect((await t.call("POST", "/api/jump/submit", body(D.code, { name: "Rot" }), as(14))).status).toBe(200);
    expect((await t.call("POST", "/api/me/code", { newId: playerId(15) }, as(14))).status).toBe(200);
    expect((await t.call("POST", "/api/jump/submit", body(D.code), as(14))).status).toBe(410);
    // Les essais ont suivi le nouvel identifiant.
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(15))).body.me).toMatchObject({ name: "Rot", ticks: D.authorTicks });
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(14))).body.me).toBeNull();
  });

  it("les journaux ne contiennent ni rediffusion, ni pseudo, ni identifiant, ni adresse", async () => {
    const lines: string[] = [];
    const t = await jumpApi({ log: (severity, message, fields) => void lines.push(JSON.stringify({ severity, message, ...fields })) });
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Secrète" }), { ...as(16), clientKey: "198.51.100.77" });
    await t.call("POST", "/api/jump/submit", body("AAAA", { name: "Secrète" }), { ...as(16), clientKey: "198.51.100.77" });
    await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, { ...as(16), clientKey: "198.51.100.77" });
    const all = lines.join("\n");
    expect(all).toContain("essai du jour");
    for (const secret of [D.code.slice(0, 24), "Secrète", playerId(16), "198.51.100.77"]) expect(all).not.toContain(secret);
  });
});

describe(`GET /api/jump/day/<date>/board (${TEST_DB})`, () => {
  it("top 10, nombre de classés, la ligne du joueur ; égalités : le premier envoyé passe devant, puis l'identifiant", async () => {
    const t = await jumpApi();
    // 12 joueurs : temps différents, et trois au temps de l'auteur (deux envoyés au même instant).
    let n = 100;
    for (const r of runs.slice(0, -1)) {
      t.clock.now += 1000;
      expect((await t.call("POST", "/api/jump/submit", body(r.code, { name: `Lent${n}` }), as(n++))).status).toBe(200);
    }
    while (n < 109) {
      t.clock.now += 1000;
      expect((await t.call("POST", "/api/jump/submit", body(runs[0]!.code, { name: `Lent${n}` }), as(n++))).status).toBe(200);
    }
    t.clock.now += 1000;
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Premier" }), as(300));
    t.clock.now += 1000;
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Second" }), as(202));
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Troisième" }), as(201)); // même instant : l'identifiant le plus petit d'abord
    const total = n - 100 + 3;
    const r = await t.call("GET", `/api/jump/day/${DATE}/board`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: DATE, open: true, participants: total, levelId: D.id, me: null });
    expect(r.body.top).toHaveLength(10);
    expect(r.body.top.slice(0, 3).map((x: { name: string }) => x.name)).toEqual(["Premier", "Troisième", "Second"]);
    expect(r.body.top[0]).toEqual({ rank: 1, name: "Premier", ticks: D.authorTicks, deaths: 0, medal: "author" });
    const ticks = r.body.top.map((x: { ticks: number }) => x.ticks);
    expect([...ticks].sort((a: number, b: number) => a - b)).toEqual(ticks);
    expect(r.body.top.map((x: { rank: number }) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // La ligne du joueur : son rang, cohérent avec le top.
    for (const [id, rank] of [
      [300, 1],
      [201, 2],
      [202, 3],
    ] as const) {
      expect((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(id))).body.me.rank).toBe(rank);
    }
    // Lent100 a le temps le plus lent, à égalité avec les derniers inscrits, envoyés après lui : il passe devant eux.
    const slowRank = runs.length - 2 + 3 + 1;
    const first = await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(100));
    expect(first.body.me).toMatchObject({ rank: slowRank, name: "Lent100", ticks: runs[0]!.ticks });
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(108))).body.me).toMatchObject({ rank: total, name: "Lent108" });
    // Le rang rendu par l'envoi est le même.
    t.clock.now += 1000;
    expect((await t.call("POST", "/api/jump/submit", body(runs[0]!.code), as(100))).body).toMatchObject({ rank: slowRank, participants: total, improved: false });
    // Un inconnu : pas de ligne.
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(999))).body.me).toBeNull();
  });

  it("jour sans classés, futur, avant le premier niveau, date illisible ; lectures limitées en mémoire (aucune écriture)", async () => {
    const t = await jumpApi();
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`)).body).toEqual({ date: DATE, open: true, participants: 0, levelId: null, top: [], me: null });
    expect((await t.call("GET", `/api/jump/day/${formatDay(DAY + 1)}/board`)).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/2026-10-01/board")).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/demain/board")).status).toBe(400);
    expect((await t.call("POST", `/api/jump/day/${DATE}/board`)).status).toBe(405);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM rate")).toEqual({ n: 0 });
  });

  it("un jour passé est figé : lisible, plus aucun envoi après la grâce (la même que DailyTrack)", async () => {
    expect(JUMP_GRACE_MS).toBe(GRACE_MS);
    const t = await jumpApi();
    await t.call("POST", "/api/jump/submit", body(runs[0]!.code, { name: "Hier" }), as(400));
    // Juste après minuit de Paris : la grâce accepte encore un essai de la veille.
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS - 1000;
    const late = await t.call("POST", "/api/jump/submit", body(D.code, { name: "Tard" }), as(401));
    expect(late.status).toBe(200);
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`)).body.open).toBe(true);
    // Après la grâce : figé.
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS + 1000;
    const closed = await t.call("POST", "/api/jump/submit", body(D.code), as(400));
    expect([closed.status, closed.body.error]).toEqual([409, "day_closed"]);
    const board = await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, as(400));
    expect(board.body).toMatchObject({ open: false, participants: 2, me: { rank: 2, name: "Hier" } });
    expect(board.body.top.map((x: { name: string }) => x.name)).toEqual(["Tard", "Hier"]);
    // Le lendemain : toujours lisible.
    t.clock.now += 3 * DAY_MS;
    expect((await t.call("GET", `/api/jump/day/${DATE}/board`)).body.participants).toBe(2);
  });
});

describe("joueurs de démonstration", () => {
  it("jamais en production : la configuration du serveur ne les connaît pas, le serveur ne les règle jamais", () => {
    const prod = readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://nathan-te.github.io", RATE_SALT: "x".repeat(20), DEMO_PLAYERS: "1", TURSO_DATABASE_URL: "libsql://cdj-prod.turso.io" } as Record<string, string>);
    expect(Object.keys(prod)).not.toContain("demoPlayers");
    const server = readFileSync(join(__dirname, "..", "src", "server.ts"), "utf8");
    expect(server).not.toMatch(/demoPlayers/);
  });
});
