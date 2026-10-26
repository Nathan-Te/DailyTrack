import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { GENERATOR_VERSION, SIM_VERSION, formatDay } from "@cdj/sim";
import { createApi } from "../src/api";
import { ConfigError, readConfig } from "../src/config";
import { SCHEMA, ensureSchemaOn, schemaVersion, type SqlDb } from "../src/db";
import { libsqlDb } from "../src/libsql";
import type { Logger } from "../src/log";
import { clientFromForwarded } from "../src/node-server";
import { DAY, NOON, makeApi, openTestDb, TEST_DB, verifierErreur } from "./helpers";

// Mise en ligne (lot 28) : base, schéma, circuit unique, CORS, santé, configuration. Tournent sur SQLite *et* libSQL (voir vitest.config.ts).
const DATE = formatDay(DAY);

/** Base qui compte ses écritures et peut tomber en panne. */
function watched(inner: SqlDb) {
  const state = { writes: 0, failing: false, calls: 0 };
  const check = () => {
    state.calls++;
    if (state.failing) throw new Error("réseau coupé");
  };
  const db: SqlDb = {
    async run(sql, params) {
      check();
      state.writes++;
      return inner.run(sql, params);
    },
    async first(sql, params) {
      check();
      return inner.first(sql, params);
    },
    async all(sql, params) {
      check();
      return inner.all(sql, params);
    },
    ...(inner.batch
      ? {
          async batch(statements) {
            check();
            state.writes++;
            return inner.batch!(statements);
          },
        }
      : {}),
  };
  return { db, state };
}

describe(`schéma (${TEST_DB})`, () => {
  it("est créé au premier appel, puis reconnu sans rien écrire", async () => {
    const { db, state } = watched(await openTestDb());
    expect(await ensureSchemaOn(db)).toBe(false);
    const writes = state.writes;
    expect(writes).toBeGreaterThan(0);
    expect(await ensureSchemaOn(db)).toBe(true);
    expect(state.writes).toBe(writes); // une seule lecture
    const meta = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'");
    expect(meta?.value).toBe(schemaVersion());
  });

  it("met à jour une base d'avant ce lot (tables sans `meta`, colonne `demo` manquante)", async () => {
    const raw = await openTestDb();
    for (const sql of SCHEMA) await raw.run(sql.replace(", demo INTEGER NOT NULL DEFAULT 0", ""));
    await raw.run("INSERT INTO players (id, name, created_at, updated_at) VALUES ('a', 'Ancien', 1, 1)");
    expect(await ensureSchemaOn(raw)).toBe(false);
    expect(await raw.first("SELECT demo FROM players WHERE id = 'a'")).toEqual({ demo: 0 });
    expect(await ensureSchemaOn(raw)).toBe(true);
  });

  it("deux instances qui démarrent ensemble sur la même base ne se gênent pas", async () => {
    const db = await openTestDb();
    await Promise.all([ensureSchemaOn(db), ensureSchemaOn(db), ensureSchemaOn(db)]);
    expect(await ensureSchemaOn(db)).toBe(true);
  });

  it("un échec au démarrage n'est pas gardé : la requête suivante réessaie", async () => {
    const { db, state } = watched(await openTestDb());
    const api = createApi({ db, now: () => NOON });
    state.failing = true;
    const down = await api.handle(new Request("http://x/api/day/" + DATE));
    expect(down.status).toBe(500);
    verifierErreur(down.status, await down.json()); // lot I1 : `internal`, son statut et un message
    state.failing = false;
    const health = await api.handle(new Request("http://x/api/health"));
    expect(health.status).toBe(200);
  });
});

describe(`santé (${TEST_DB})`, () => {
  it("dit la version, la base et la révision ; SALON_MINUTES absente", async () => {
    const t = await makeApi({ revision: "abc1234" });
    const r = await t.call("GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, db: "ok", clock: expect.stringMatching(/^(intl|table)$/), simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, today: DATE, salonMinutes: 10, salonOverride: false, revision: "abc1234" });
  });

  it("signale SALON_MINUTES quand elle est réglée", async () => {
    const t = await makeApi({ salonMinutes: 2 });
    expect((await t.call("GET", "/api/health")).body).toMatchObject({ salonMinutes: 2, salonOverride: true });
  });

  it("répond 503 quand la base est injoignable (la sonde et la CI s'y fient)", async () => {
    const { db, state } = watched(await openTestDb());
    const logs: string[] = [];
    const log: Logger = (_s, message) => logs.push(message);
    const api = createApi({ db, now: () => NOON, log });
    expect((await api.handle(new Request("http://x/api/health"))).status).toBe(200);
    state.failing = true;
    const res = await api.handle(new Request("http://x/api/health"));
    expect(res.status).toBe(503);
    const body = await res.json();
    verifierErreur(res.status, body); // lot I1 : `db_unavailable`, en plus de `ok` et `db`
    expect(body).toMatchObject({ ok: false, db: "error" });
    expect(logs).toContain("santé : base injoignable");
  });

  it("ne journalise ni la rediffusion, ni le pseudo, ni l'identifiant", async () => {
    const lines: string[] = [];
    const t = await makeApi({ log: (s, m, f) => lines.push(JSON.stringify({ s, m, ...f })) });
    await t.call("GET", `/api/day/${DATE}`);
    await t.call("POST", "/api/submit", { playerId: "0".repeat(32), name: "Secret", date: DATE, replay: "ABCDEF" });
    expect(lines.join("\n")).not.toMatch(/Secret|ABCDEF|0{32}/);
  });
});

describe(`circuit du jour à la première requête (${TEST_DB})`, () => {
  it("deux requêtes simultanées ne calculent le circuit qu'une fois, puis il est gardé en base", async () => {
    const logs: string[] = [];
    const t = await makeApi({ seed: false, log: (_s, m) => logs.push(m) });
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => t.call("GET", `/api/day/${DATE}`)));
    expect(a!.status).toBe(200);
    expect(b!.body.trackId).toBe(a!.body.trackId);
    expect(c!.body.trackId).toBe(a!.body.trackId);
    expect(logs.filter((m) => m === "circuit du jour généré")).toHaveLength(1);
    const row = await t.db.first<{ track_id: string }>("SELECT track_id FROM circuits WHERE day = ?", [DAY]);
    expect(row?.track_id).toBe(a!.body.trackId);

    // Une autre instance (mémoire vide) relit la base : aucune génération.
    const logs2: string[] = [];
    const second = createApi({ db: t.db, now: () => NOON, log: (_s, m) => logs2.push(m) });
    const again = await second.handle(new Request(`http://x/api/day/${DATE}`));
    expect((await again.json()).trackId).toBe(a!.body.trackId);
    expect(logs2).not.toContain("circuit du jour généré");
  }, 60_000);
});

describe("CORS (ALLOWED_ORIGINS)", () => {
  const ask = async (opts: Parameters<typeof makeApi>[0], origin?: string) => {
    const t = await makeApi(opts);
    return t.call("GET", "/api/health", undefined, { headers: origin ? { Origin: origin } : {} });
  };

  it("répète l'origine du jeu quand elle est dans la liste, et seulement elle", async () => {
    const opts = { allowedOrigins: ["https://nathan-te.github.io", "http://localhost:5173"] };
    const ok = await ask(opts, "https://nathan-te.github.io");
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
    expect(ok.headers.get("vary")).toBe("Origin");
    expect((await ask(opts, "http://localhost:5173")).headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const refused = await ask(opts, "https://pirate.example");
    expect(refused.status).toBe(200); // la réponse existe, mais le navigateur la refusera
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
    expect((await ask(opts)).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("ignore la casse et la barre finale ; * autorise tout le monde", async () => {
    expect((await ask({ allowedOrigins: ["https://Nathan-Te.github.io/"] }, "https://nathan-te.github.io")).headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
    expect((await ask({ allowedOrigins: ["*"] }, "https://n-importe.où")).headers.get("access-control-allow-origin")).toBe("*");
  });

  it("répond aux requêtes préalables avec la liste", async () => {
    const t = await makeApi({ allowedOrigins: ["https://nathan-te.github.io"] });
    const pre = await t.call("OPTIONS", "/api/submit", undefined, { headers: { Origin: "https://nathan-te.github.io", "Access-Control-Request-Method": "POST" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
    const bad = await t.call("OPTIONS", "/api/submit", undefined, { headers: { Origin: "https://pirate.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("adresse du client derrière un proxy", () => {
  it("compte depuis la droite : ce que le client a écrit en tête ne compte pas", () => {
    expect(clientFromForwarded("1.1.1.1", 1)).toBe("1.1.1.1");
    expect(clientFromForwarded("9.9.9.9, 1.1.1.1", 1)).toBe("1.1.1.1"); // 9.9.9.9 : falsifié par le client
    expect(clientFromForwarded("9.9.9.9, 1.1.1.1, 10.0.0.1", 2)).toBe("1.1.1.1");
    expect(clientFromForwarded("1.1.1.1", 3)).toBe("1.1.1.1");
    expect(clientFromForwarded(undefined, 1)).toBeUndefined();
    expect(clientFromForwarded("1.1.1.1", 0)).toBeUndefined();
    expect(clientFromForwarded(["9.9.9.9", "1.1.1.1"], 1)).toBe("1.1.1.1");
  });
});

describe("configuration du serveur", () => {
  const prod = { NODE_ENV: "production", ALLOWED_ORIGINS: "https://nathan-te.github.io", TURSO_DATABASE_URL: "libsql://cdj-nathan.turso.io", TURSO_AUTH_TOKEN: "jeton", RATE_SALT: "un-sel-assez-long-123" };

  it("lit Turso, les origines et le proxy", () => {
    const c = readConfig({ ...prod, PORT: "8080", TRUST_PROXY: "1", ADMIN_TOKEN: "x".repeat(20), GIT_SHA: "abc" });
    expect(c).toMatchObject({ port: 8080, production: true, trustProxy: 1, allowedOrigins: ["https://nathan-te.github.io"], revision: "abc" });
    expect(c.db).toEqual({ kind: "turso", url: "libsql://cdj-nathan.turso.io", authToken: "jeton" });
  });

  it("sans Turso : SQLite local (développement) ; sur Cloud Run : refusé (disque éphémère)", () => {
    expect(readConfig({ DB_PATH: "/data/x.sqlite" }).db).toEqual({ kind: "sqlite", path: "/data/x.sqlite" });
    expect(() => readConfig({ K_SERVICE: "cdj-api", NODE_ENV: "production", ALLOWED_ORIGINS: "*" })).toThrow(/TURSO_DATABASE_URL/);
  });

  it("TEST_CLOCK_OFFSET_MS : permise hors production, refusée en production et sur Cloud Run, entier exigé", () => {
    expect(readConfig({ TEST_CLOCK_OFFSET_MS: "-518400000" }).testClockOffsetMs).toBe(-518_400_000);
    expect(readConfig({}).testClockOffsetMs).toBeUndefined();
    expect(() => readConfig({ ...prod, TEST_CLOCK_OFFSET_MS: "1000" })).toThrow(/TEST_CLOCK_OFFSET_MS/);
    expect(() => readConfig({ K_SERVICE: "cdj-api", TURSO_DATABASE_URL: "libsql://x", TEST_CLOCK_OFFSET_MS: "1000" })).toThrow(/TEST_CLOCK_OFFSET_MS/);
    expect(() => readConfig({ TEST_CLOCK_OFFSET_MS: "demain" })).toThrow(ConfigError);
    expect(() => readConfig({ TEST_CLOCK_OFFSET_MS: "1.5" })).toThrow(ConfigError);
  });

  it("lot R8 — LANCEMENT_PREMIER_JOUR : permise en local et en recette, refusée en production, une date exigée", () => {
    expect(readConfig({ LANCEMENT_PREMIER_JOUR: "2026-11-02" }).premierJourDuJour).toBe(daysFromCivil(2026, 11, 2));
    expect(readConfig({}).premierJourDuJour).toBeUndefined(); // la date de config/lancement.json
    expect(readConfig({ ...prod, ENVIRONMENT: "recette", TURSO_DATABASE_URL: "libsql://cdj-recette-nathan.turso.io", LANCEMENT_PREMIER_JOUR: "2026-11-02" }).premierJourDuJour).toBe(daysFromCivil(2026, 11, 2));
    expect(() => readConfig({ ...prod, LANCEMENT_PREMIER_JOUR: "2026-11-02" })).toThrow(/LANCEMENT_PREMIER_JOUR/);
    expect(() => readConfig({ ...prod, ENVIRONMENT: "production", LANCEMENT_PREMIER_JOUR: "2026-11-02" })).toThrow(/LANCEMENT_PREMIER_JOUR/);
    expect(() => readConfig({ LANCEMENT_PREMIER_JOUR: "demain" })).toThrow(ConfigError);
    expect(() => readConfig({ LANCEMENT_PREMIER_JOUR: "2026-02-30" })).toThrow(ConfigError);
  });

  it("signale l'horloge de test dans /api/health quand l'horloge de test est active", async () => {
    const t = await makeApi({ testClock: true });
    expect((await t.call("GET", "/api/health")).body).toMatchObject({ testClock: true });
    expect((await (await makeApi({})).call("GET", "/api/health")).body.testClock).toBeUndefined();
  });

  it("refuse de démarrer en production avec SALON_MINUTES", () => {
    expect(() => readConfig({ ...prod, SALON_MINUTES: "2" })).toThrow(ConfigError);
    expect(() => readConfig({ ...prod, SALON_MINUTES: "2" })).toThrow(/SALON_MINUTES/);
    expect(readConfig({ SALON_MINUTES: "2" }).salonMinutes).toBe(2); // hors production : permis (essais locaux)
  });

  it("exige ALLOWED_ORIGINS en production et vérifie leur forme", () => {
    expect(() => readConfig({ NODE_ENV: "production", TURSO_DATABASE_URL: "libsql://x.turso.io" })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => readConfig({ ...prod, ALLOWED_ORIGINS: "https://nathan-te.github.io/DailyTrack/" })).toThrow(/origine/);
    expect(readConfig({ ...prod, ALLOWED_ORIGINS: "*" }).allowedOrigins).toEqual(["*"]);
    expect(readConfig({ ...prod, ALLOWED_ORIGINS: "https://a.github.io, http://localhost:5173/" }).allowedOrigins).toEqual(["https://a.github.io", "http://localhost:5173/"]);
  });

  it("exige un sel pour les adresses hachées en production", () => {
    const { RATE_SALT: _omitted, ...sansSel } = prod;
    expect(() => readConfig(sansSel)).toThrow(/RATE_SALT/);
    expect(() => readConfig({ ...prod, RATE_SALT: "court" })).toThrow(/RATE_SALT/);
    expect(readConfig({ DB_PATH: "x" }).rateSalt).toBe(""); // hors production : facultatif
  });

  it("accepte les origines séparées par des points-virgules", () => {
    expect(readConfig({ ...prod, ALLOWED_ORIGINS: "https://a.github.io;http://localhost:5173" }).allowedOrigins).toEqual(["https://a.github.io", "http://localhost:5173"]);
  });

  it("refuse un port ou une adresse de base absurdes", () => {
    expect(() => readConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => readConfig({ TURSO_DATABASE_URL: "mysql://x" })).toThrow(/TURSO_DATABASE_URL/);
    expect(() => readConfig({ TRUST_PROXY: "9" })).toThrow(/TRUST_PROXY/);
  });
});

describe(`adaptateur ${TEST_DB}`, () => {
  it("rend des objets nommés, des entiers, null, et compte écritures et allers-retours", async () => {
    const db = await openTestDb();
    await db.run("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INTEGER)");
    await db.run("INSERT INTO t VALUES (1, 'a', 10), (2, 'b', NULL)");
    expect(await db.first("SELECT id, name, n FROM t WHERE id = ?", [1])).toEqual({ id: 1, name: "a", n: 10 });
    expect(await db.first("SELECT * FROM t WHERE id = 99")).toBeNull();
    expect(await db.all("SELECT n FROM t ORDER BY id")).toEqual([{ n: 10 }, { n: null }]);
    expect(await db.first<{ count: number }>("UPDATE t SET n = COALESCE(n, 0) + 1 WHERE id = ? RETURNING n AS count", [2])).toEqual({ count: 1 });
    await expect(db.run("INSERT INTO t VALUES (1, 'dup', 0)")).rejects.toThrow();
    if (TEST_DB === "libsql") {
      const stats = (db as ReturnType<typeof libsqlDb>).stats;
      // Piège mesuré : `rowsAffected` vaut 0 pour une instruction avec RETURNING (l'UPDATE ci-dessus) ; les compteurs du budget la comptent à part.
      expect(stats.rowsWritten).toBe(2);
      expect(stats.roundTrips).toBe(stats.statements);
    }
  });

  it("SQLite local : un lot est une transaction (tout ou rien)", async () => {
    const db = await openTestDb();
    if (TEST_DB !== "sqlite") return;
    await db.run("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    await db.batch!([{ sql: "INSERT INTO t VALUES (1)" }, { sql: "INSERT INTO t VALUES (?)", params: [2] }]);
    await expect(db.batch!([{ sql: "INSERT INTO t VALUES (3)" }, { sql: "INSERT INTO t VALUES (1)" }])).rejects.toThrow();
    expect(await db.all("SELECT id FROM t ORDER BY id")).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("applique un lot dans une transaction, en un aller-retour (libSQL)", async () => {
    const db = await openTestDb();
    if (TEST_DB !== "libsql") return; // SQLite local : voir le test précédent
    await db.run("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    const before = (db as ReturnType<typeof libsqlDb>).stats.roundTrips;
    await db.batch!([{ sql: "INSERT INTO t VALUES (1)" }, { sql: "INSERT INTO t VALUES (?)", params: [2] }]);
    expect((db as ReturnType<typeof libsqlDb>).stats.roundTrips).toBe(before + 1);
    await expect(db.batch!([{ sql: "INSERT INTO t VALUES (3)" }, { sql: "INSERT INTO t VALUES (1)" }])).rejects.toThrow();
    expect(await db.all("SELECT id FROM t ORDER BY id")).toEqual([{ id: 1 }, { id: 2 }]); // le lot raté n'a rien laissé
  });
});
