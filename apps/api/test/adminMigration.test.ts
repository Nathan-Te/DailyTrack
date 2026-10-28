import { describe, expect, it } from "vitest";
import { ensureSchemaOn } from "../src/db";
import { CODES_ERREUR } from "../src/codesErreur";
import { ERREURS_PAR_MINUTE, aNoter, createJournaux, genreDe, routeDe } from "../src/journaux";
import { silentLog } from "../src/log";
import { TEST_DB, openTestDb } from "./helpers";

// Lot N1 : la migration (colonnes et tables ajoutées, réversibles) sur une base « d'avant », et le journal des erreurs (bornes, routes, genres).

/** Les tables d'une base d'avant le lot N1 (telles que la production les avait avant la migration), avec quelques lignes. */
const AVANT = [
  "CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, demo INTEGER NOT NULL DEFAULT 0, name_key TEXT, rename_required INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE results (day INTEGER NOT NULL, player_id TEXT NOT NULL, ms INTEGER NOT NULL, splits TEXT NOT NULL, replay TEXT NOT NULL, respawns INTEGER NOT NULL, submitted_at INTEGER NOT NULL, final_rank INTEGER, final_total INTEGER, car TEXT, inputs_hash TEXT, PRIMARY KEY (day, player_id))",
  "CREATE TABLE jump_results (day INTEGER NOT NULL, player_id TEXT NOT NULL, level_id TEXT NOT NULL, ticks INTEGER NOT NULL, deaths INTEGER NOT NULL, replay TEXT NOT NULL, sim_version INTEGER NOT NULL, generator_version INTEGER NOT NULL, first_at INTEGER NOT NULL, submitted_at INTEGER NOT NULL, final_rank INTEGER, final_total INTEGER, inputs_hash TEXT, PRIMARY KEY (day, player_id))",
  "CREATE TABLE salon_runs (session INTEGER NOT NULL, player_id TEXT NOT NULL, ref TEXT NOT NULL, name TEXT NOT NULL, ms INTEGER NOT NULL, splits TEXT NOT NULL, replay TEXT NOT NULL, submitted_at INTEGER NOT NULL, car TEXT, PRIMARY KEY (session, player_id))",
  "INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES ('a', 'Alice', 1, 1, 'alice'), ('b', 'Bob', 2, 2, 'bob')",
  "INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (1, 'a', 60000, '[]', 'r', 0, 5), (1, 'b', 61000, '[]', 'r', 0, 6)",
  "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (1, 'a', 'l', 100, 1, 'r', 1, 1, 5, 5)",
  "INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (1, 'a', 'ra', 'Alice', 50000, '[]', 'r', 5)",
];

describe(`migration du lot N1 sur une base d'avant (${TEST_DB})`, () => {
  it("ajoute les colonnes et les tables sans toucher aux données : tout le monde reste visible (hidden = 0), les références viennent plus tard", async () => {
    const db = await openTestDb();
    for (const sql of AVANT) await db.run(sql);
    expect(await ensureSchemaOn(db)).toBe(false);
    expect(await db.all("SELECT id, name, hidden, ref FROM players ORDER BY id")).toEqual([
      { id: "a", name: "Alice", hidden: 0, ref: null },
      { id: "b", name: "Bob", hidden: 0, ref: null },
    ]);
    expect(await db.all("SELECT player_id, ms, hidden FROM results ORDER BY player_id")).toEqual([
      { player_id: "a", ms: 60000, hidden: 0 },
      { player_id: "b", ms: 61000, hidden: 0 },
    ]);
    expect(await db.all("SELECT ticks, hidden FROM jump_results")).toEqual([{ ticks: 100, hidden: 0 }]);
    expect(await db.all("SELECT ms, hidden FROM salon_runs")).toEqual([{ ms: 50000, hidden: 0 }]);
    for (const table of ["admin_sessions", "journal_admin", "journal_erreurs", "resultats_retires"]) expect(await db.all(`SELECT * FROM ${table}`), table).toEqual([]);
    expect(await ensureSchemaOn(db)).toBe(true); // rejouée : rien à faire
  });

  it("est réversible : retirer les colonnes, les index et les tables rend la base d'avant ; l'ancien code (ses INSERT sans les colonnes) tourne sur la base migrée", async () => {
    const db = await openTestDb();
    for (const sql of AVANT) await db.run(sql);
    await ensureSchemaOn(db);
    // L'ancien code écrit sur la base déjà migrée (retour arrière d'un serveur, sans restaurer la base) : les nouvelles colonnes ont leur valeur par défaut.
    await db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES ('c', 'Chloé', 3, 3, 'chloe')");
    await db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (1, 'c', 62000, '[]', 'r', 0, 7)");
    await db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (1, 'c', 'l', 110, 0, 'r', 1, 1, 7, 7)");
    await db.run("INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (1, 'c', 'rc', 'Chloé', 52000, '[]', 'r', 7)");
    expect((await db.first<{ hidden: number }>("SELECT hidden FROM results WHERE player_id = 'c'"))!.hidden).toBe(0);
    // Le retour complet : les index, puis les colonnes, puis les tables (voir la note de MIGRATIONS dans db.ts).
    for (const sql of ["DROP INDEX players_by_ref", "DROP INDEX players_by_created", "DROP INDEX players_masques", "DROP INDEX results_by_visible", "DROP INDEX jump_results_by_visible"]) await db.run(sql);
    for (const table of ["players", "results", "jump_results", "salon_runs"]) await db.run(`ALTER TABLE ${table} DROP COLUMN hidden`);
    await db.run("ALTER TABLE players DROP COLUMN ref");
    for (const table of ["admin_sessions", "journal_admin", "journal_erreurs", "resultats_retires"]) await db.run(`DROP TABLE ${table}`);
    expect(await db.all("SELECT id, name FROM players ORDER BY id")).toEqual([{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }, { id: "c", name: "Chloé" }]);
    expect(await db.all("SELECT player_id, ms FROM results ORDER BY player_id")).toHaveLength(3);
  });
});

describe("journal des erreurs : routes, genres, bornes", () => {
  it("note les erreurs serveur et les rediffusions refusées sur une route d'envoi, pas le reste", () => {
    expect(aNoter(500, "internal", "/api/day/2026-10-20")).toBe(true);
    expect(aNoter(503, "db_unavailable", "/api/health")).toBe(true);
    expect(aNoter(503, "busy", "/api/jump/submit")).toBe(true);
    expect(aNoter(409, "replay_copy", "/api/submit")).toBe(true);
    expect(aNoter(400, "invalid_replay", "/api/salon/12/submit")).toBe(true);
    expect(aNoter(409, "version", "/api/jump/submit")).toBe(true);
    expect(aNoter(409, "replay_copy", "/api/day/2026-10-20/leaderboard")).toBe(false);
    expect(aNoter(404, "not_found", "/api/zzz")).toBe(false);
    expect(aNoter(429, "rate_limited", "/api/submit")).toBe(false);
    expect(aNoter(401, "unauthorized", "/api/admin/session")).toBe(false);
    expect(aNoter(400, "invalid_name", "/api/submit")).toBe(false);
  });

  it("la route notée n'a ni date, ni numéro, ni identifiant long", () => {
    expect(routeDe("/api/day/2026-10-20/leaderboard")).toBe("/api/day/:date/leaderboard");
    expect(routeDe("/api/salon/12345/submit")).toBe("/api/salon/:n/submit");
    expect(routeDe("/api/admin/joueurs/0123456789ab/masquer")).toBe("/api/admin/joueurs/:id/masquer");
    expect(routeDe("/api/" + "x".repeat(100)).length).toBeLessThanOrEqual(80);
    expect(routeDe("/api/jump/day/2026-10-20/board")).toBe("/api/jump/day/:date/board");
  });

  it("le genre d'un code : « serveur » si son statut est ≥ 500, sinon « rediffusion » ; chaque code de la liste a un genre", () => {
    expect(genreDe("internal")).toBe("serveur");
    expect(genreDe("busy")).toBe("serveur");
    expect(genreDe("replay_copy")).toBe("rediffusion");
    for (const code of Object.keys(CODES_ERREUR)) expect(["serveur", "rediffusion"]).toContain(genreDe(code));
  });

  it("l'écriture est bornée : au plus 60 par minute et par instance, puis de nouveau permise à la minute suivante", async () => {
    const db = await openTestDb();
    await ensureSchemaOn(db);
    const horloge = { now: Date.UTC(2026, 9, 28, 12) };
    const j = createJournaux({ db, now: () => horloge.now, log: silentLog });
    expect(ERREURS_PAR_MINUTE).toBe(60);
    for (let i = 0; i < 100; i++) await j.noter("internal", "/api/x");
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_erreurs"))!.n).toBe(60);
    horloge.now += 60_000;
    for (let i = 0; i < 10; i++) await j.noter("internal", "/api/x");
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_erreurs"))!.n).toBe(70);
  });

  it("ne note ni joueur, ni corps, ni adresse : trois colonnes (code, route, heure)", async () => {
    const db = await openTestDb();
    await ensureSchemaOn(db);
    const colonnes = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('journal_erreurs') ORDER BY cid");
    expect(colonnes.map((c) => c.name)).toEqual(["id", "at", "code", "route"]);
  });

  it("une base qui ne répond pas n'ajoute pas d'erreur à l'erreur", async () => {
    const db = await openTestDb();
    await ensureSchemaOn(db);
    await db.run("DROP TABLE journal_erreurs");
    const j = createJournaux({ db, now: () => 1, log: silentLog });
    await expect(j.noter("internal", "/api/x")).resolves.toBeUndefined();
  });
});
