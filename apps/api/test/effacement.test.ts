import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, demoAttempts, encodeReplay, lifeReplay, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import { GRACE_MS } from "../src/api";
import { crc32Hex, playerIdFromCode } from "../src/identity";
import { CLOSED_GHOST_TTL_MS } from "../src/jump";
import type { Logger } from "../src/log";
import { crc32 } from "../../../packages/profile/src/transfer";
import { DAY, TEST_DB, makeApi, parisDayStart, pilotReplay, playerId, type TestApi } from "./helpers";

// Lot R5 (plateforme) : l'effacement d'un joueur à sa demande (`POST /api/admin/effacer`, jeton d'admin ; procédure :
// docs/plateforme/effacement.md). Le joueur, ses temps et essais, ses vies, ses courses du Salon, son pseudo libéré ; les classements passés
// recalculés sans lui ; son fantôme de premier plus servi. SQLite et libSQL.
const TOKEN = "jeton-admin-de-test-assez-long";
const code = (id: string) => `CDJ2.${id}.${crc32Hex(new TextEncoder().encode(id))}`;
const admin = { Authorization: `Bearer ${TOKEN}` };
const erase = (t: TestApi, body: unknown, headers: Record<string, string> = admin) => t.call("POST", "/api/admin/effacer", body, { headers });

describe("le code de transfert (CDJ2) lu par le serveur", () => {
  it("la même somme de contrôle que @cdj/profile ; un code abîmé ou d'une autre forme est refusé", () => {
    const id = playerId(42);
    expect(crc32Hex(new TextEncoder().encode(id))).toBe(crc32(new TextEncoder().encode(id)));
    expect(playerIdFromCode(code(id))).toBe(id);
    expect(playerIdFromCode(` ${code(id)} `)).toBe(id);
    expect(() => playerIdFromCode(code(id).replace(id, playerId(43)))).toThrow(/abîmé/);
    expect(() => playerIdFromCode(id)).toThrow(/CDJ2/);
    expect(() => playerIdFromCode(null)).toThrow();
  });
});

describe(`effacement d'un joueur de DailyTrack (${TEST_DB})`, () => {
  const DATE = formatDay(DAY);
  const fast = pilotReplay(DAY, 0.9);
  const slow = pilotReplay(DAY, 0.65);

  async function twoPlayers(log?: Logger) {
    const t = await makeApi({ adminToken: TOKEN, log });
    const alice = playerId(1);
    const bob = playerId(2);
    expect((await t.call("POST", "/api/submit", { playerId: alice, name: "Alice", date: DATE, replay: fast.code })).status).toBe(200);
    expect((await t.call("POST", "/api/submit", { playerId: bob, name: "Bob", date: DATE, replay: slow.code })).status).toBe(200);
    return { t, alice, bob };
  }

  it("gardé par le jeton d'admin ; essai à blanc par défaut ; code invalide, inconnu ou remplacé refusés", async () => {
    const { t, alice } = await twoPlayers();
    expect((await erase(t, { code: code(alice) }, {})).status).toBe(401);
    expect((await erase(t, { code: "CDJ2.abc" })).status).toBe(400);
    expect((await erase(t, { code: code(playerId(99)) })).status).toBe(404);
    expect((await t.call("GET", "/api/admin/effacer", undefined, { headers: admin })).status).toBe(405);
    const dry = await erase(t, { code: code(alice) });
    expect(dry.status).toBe(200);
    expect(dry.body).toEqual({ essai: true, pseudo: "Alice", tempsDailyTrack: 1, coursesSalon: 0, essaisDailyJump: 0, viesDailyJump: 0, partiesDailyTower: 0 });
    expect(await t.db.first("SELECT 1 AS x FROM players WHERE id = ?", [alice])).not.toBeNull();
    // Sans jeton configuré : la route n'existe pas.
    const off = await makeApi({ seed: false });
    expect((await erase(off, { code: code(alice) })).status).toBe(404);
  });

  it("efface le joueur, ses temps, libère son pseudo ; le classement passé est recalculé sans lui et son fantôme de premier n'est plus servi", async () => {
    const lines: { message: string; fields: unknown }[] = [];
    const { t, alice, bob } = await twoPlayers((_s, message, fields) => void lines.push({ message, fields }));
    // Le jour devient passé (après la grâce) ; Bob lit son profil : sa place finale (2ᵉ) est calculée et gardée.
    t.clock.now = parisDayStart(DAY + 1) + GRACE_MS + 60_000;
    const before = await t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": bob } });
    expect(before.body.stats.bestRank).toMatchObject({ date: DATE, rank: 2, participants: 2 });
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=first`)).body.name).toBe("Alice");

    const r = await erase(t, { code: code(alice), confirmer: true });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ efface: true, pseudo: "Alice", tempsDailyTrack: 1 });

    expect(await t.db.first("SELECT 1 AS x FROM players WHERE id = ?", [alice])).toBeNull();
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ?", [alice])).toBeNull();
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.body).toMatchObject({ participants: 1, top: [{ rank: 1, name: "Bob", ms: slow.finishMs }] });
    const ghost = await t.call("GET", `/api/day/${DATE}/ghost?kind=first`);
    expect(ghost.body).toMatchObject({ name: "Bob", ms: slow.finishMs, replay: slow.code });
    const after = await t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": bob } });
    expect(after.body.stats.bestRank).toMatchObject({ date: DATE, rank: 1, participants: 1 });
    expect((await t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": alice } })).status).toBe(404);
    expect((await t.call("GET", "/api/name?name=alice")).body).toEqual({ available: true });
    // Journal : les nombres seulement, jamais le pseudo ni l'identifiant.
    const logged = JSON.stringify(lines);
    expect(lines.map((l) => l.message)).toContain("joueur effacé");
    expect(logged).not.toContain("Alice");
    expect(logged).not.toContain(alice);
    // Un second effacement : plus rien.
    expect((await erase(t, { code: code(alice), confirmer: true })).status).toBe(404);
  });

  it("après « Changer mon code » : l'ancien code est refusé (410), le code actuel efface aussi la chaîne des codes révoqués", async () => {
    const { t, alice } = await twoPlayers();
    const next = playerId(11);
    const rotated = await t.call("POST", "/api/me/code", { newId: next }, { headers: { "X-Player-Id": alice } });
    expect(rotated.status).toBe(200);
    expect((await erase(t, { code: code(alice) })).status).toBe(410);
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM revoked_codes")).toEqual({ n: 1 });
    expect((await erase(t, { code: code(next), confirmer: true })).body).toMatchObject({ efface: true, pseudo: "Alice", tempsDailyTrack: 1 });
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM revoked_codes")).toEqual({ n: 0 });
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players")).toEqual({ n: 1 });
  });
});

describe(`effacement d'un joueur de DailyJump (${TEST_DB})`, () => {
  // Lot V1 : le premier jour, à partir du 20/10/2026, dont le niveau donne assez d'essais fictifs (le sac de thèmes a changé le thème de chaque date).
  const JDAY = (() => {
    for (let d = daysFromCivil(2026, 10, 20); ; d++) {
      const L = dailyLevel(d);
      let slow = false;
      let morts = 0;
      for (const a of demoAttempts(L.level, L.replay, 0x11fe, { attempts: 30, maxLives: 6 })) {
        const r = replayAttempt(L.level, a.replay, L.id);
        if (r.finished && r.time > L.authorTicks) slow = true;
        for (const life of r.lives) if (life.end === "mort") morts++;
      }
      if (slow && morts >= 3) return d;
    }
  })();
  const JDATE = formatDay(JDAY);
  const JNOON = parisDayStart(JDAY) + 12 * 3_600_000;
  let D: DailyLevel;
  let slower = "";
  let deaths: string[] = [];

  beforeAll(() => {
    D = dailyLevel(JDAY);
    deaths = [];
    for (const a of demoAttempts(D.level, D.replay, 0x11fe, { attempts: 30, maxLives: 6 })) {
      const r = replayAttempt(D.level, a.replay, D.id);
      if (!slower && r.finished && r.time > D.authorTicks) slower = encodeReplay(a.replay);
      for (const life of r.lives) if (life.end === "mort" && deaths.length < 5) deaths.push(encodeReplay(lifeReplay(a.replay, life)));
    }
    if (!slower || deaths.length < 3) throw new Error("trop peu d'essais fictifs");
  });

  const jbody = (replay: string, name: string) => ({ levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay, name });
  const as = (id: string) => ({ headers: { "X-Player-Id": id } });

  async function jumpPlayers(t: TestApi) {
    const alice = playerId(1);
    const bob = playerId(2);
    t.clock.now = JNOON;
    expect((await t.call("POST", "/api/jump/submit", jbody(D.code, "Alice"), as(alice))).status).toBe(200);
    expect((await t.call("POST", "/api/jump/submit", jbody(slower, "Bob"), as(bob))).status).toBe(200);
    return { alice, bob };
  }

  it("ses essais et ses vies du jour en cours ; la carte du jour sera recalculée sans elles ; le premier devient le suivant", async () => {
    const t = await makeApi({ seed: false, adminToken: TOKEN, environment: "recette" });
    const { alice } = await jumpPlayers(t);
    const lives = await t.call("POST", "/api/jump/lives", { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: deaths }, as(alice));
    expect(lives.body.accepted).toBe(deaths.length);
    const version = (await t.db.first<{ version: number }>("SELECT version FROM jump_deaths WHERE day = ?", [JDAY]))!.version;
    expect((await t.call("GET", `/api/jump/day/${JDATE}/ghost/first`)).body.name).toBe("Alice");

    const dry = await erase(t, { code: code(alice) });
    expect(dry.body).toEqual({ essai: true, pseudo: "Alice", tempsDailyTrack: 0, coursesSalon: 0, essaisDailyJump: 1, viesDailyJump: deaths.length, partiesDailyTower: 0 });
    expect((await erase(t, { code: code(alice), confirmer: true })).body).toMatchObject({ efface: true, essaisDailyJump: 1, viesDailyJump: deaths.length });

    expect(await t.db.first("SELECT 1 AS x FROM jump_results WHERE player_id = ?", [alice])).toBeNull();
    expect(await t.db.first("SELECT 1 AS x FROM jump_lives WHERE player_id = ?", [alice])).toBeNull();
    expect((await t.db.first<{ version: number }>("SELECT version FROM jump_deaths WHERE day = ?", [JDAY]))!.version).toBe(version + 1);
    const ghost = await t.call("GET", `/api/jump/day/${JDATE}/ghost/first`);
    expect(ghost.body).toMatchObject({ name: "Bob", replay: slower });
    const board = await t.call("GET", `/api/jump/day/${JDATE}/board`);
    expect(board.body).toMatchObject({ participants: 1, top: [{ rank: 1, name: "Bob" }] });
  });

  it("jour passé : le premier gardé en mémoire est oublié ici aussitôt, et sur une autre instance après CLOSED_GHOST_TTL_MS", async () => {
    const t = await makeApi({ seed: false, adminToken: TOKEN, environment: "recette" });
    await jumpPlayers(t);
    const other = await makeApi({ seed: false, environment: "recette", db: t.db });
    const later = parisDayStart(JDAY + 1) + GRACE_MS + 60_000;
    t.clock.now = later;
    other.clock.now = later;
    for (const api of [t, other]) expect((await api.call("GET", `/api/jump/day/${JDATE}/ghost/first`)).body.name).toBe("Alice");
    expect((await erase(t, { code: code(playerId(1)), confirmer: true })).status).toBe(200);
    expect((await t.call("GET", `/api/jump/day/${JDATE}/ghost/first`)).body.name).toBe("Bob");
    other.clock.now = later + CLOSED_GHOST_TTL_MS + 1;
    expect((await other.call("GET", `/api/jump/day/${JDATE}/ghost/first`)).body.name).toBe("Bob");
  });
});
