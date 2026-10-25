import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, demoAttempts, encodeReplay, jumpMedalFor, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import { JUMP_GRACE_MS } from "../src/jump";
import { DAY as CDJ_DAY, NOON as CDJ_NOON, makeApi, parisDayStart, pilotReplay, playerId, TEST_DB } from "./helpers";

// Lot P2 (plateforme) : le fantôme du premier (`GET /api/jump/day/<date>/ghost/first`) et le profil DailyJump (`GET /api/jump/me`) ; le
// `GET /api/me` de DailyTrack ne change pas. Tourne sur SQLite et sur libSQL.

/** Jour de test fixe : le 29/10/2026 (niveau généré ; lot 19 : le 20/10 en g14 n'a presque plus d'essais fictifs qui arrivent), et son lendemain (pour la série et un jour passé). Midi à Paris. */
const DAY = daysFromCivil(2026, 10, 29);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;

let D: DailyLevel;
let D2: DailyLevel;
/** Des essais qui arrivent, du plus lent au plus rapide (le dernier : la preuve de l'auteur). */
let runs: { code: string; ticks: number; deaths: number }[];

beforeAll(() => {
  D = dailyLevel(DAY);
  D2 = dailyLevel(DAY + 1);
  const seen = new Set<number>();
  runs = [];
  for (const a of demoAttempts(D.level, D.replay, 0x5eed, { attempts: 30 }).filter((x) => x.end === "arrivée")) {
    const r = replayAttempt(D.level, a.replay, D.id);
    if (!r.finished || seen.has(r.time) || r.time <= D.authorTicks) continue;
    seen.add(r.time);
    runs.push({ code: encodeReplay(a.replay), ticks: r.time, deaths: r.deaths.length });
  }
  runs.sort((a, b) => b.ticks - a.ticks);
  runs.push({ code: D.code, ticks: D.authorTicks, deaths: 0 });
  if (runs.length < 3) throw new Error("trop peu d'essais fictifs arrivent");
});

async function jumpApi() {
  const t = await makeApi({ seed: false, environment: "recette" });
  t.clock.now = NOON;
  return t;
}

const body = (code: string, extra: Record<string, unknown> = {}, level: DailyLevel = D) => ({ levelId: level.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code, ...extra });
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

describe(`GET /api/jump/day/<date>/ghost/first (${TEST_DB})`, () => {
  it("absent : personne n'est classé (404 no_ghost) ; futur, avant le premier niveau, date illisible ; aucune écriture (lecture en mémoire)", async () => {
    const t = await jumpApi();
    const none = await t.call("GET", `/api/jump/day/${DATE}/ghost/first`);
    expect([none.status, none.body.error]).toEqual([404, "no_ghost"]);
    expect((await t.call("GET", `/api/jump/day/${formatDay(DAY + 1)}/ghost/first`)).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/2026-10-01/ghost/first")).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/demain/ghost/first")).status).toBe(400);
    expect((await t.call("POST", `/api/jump/day/${DATE}/ghost/first`)).status).toBe(405);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM rate")).toEqual({ n: 0 });
  });

  it("présent : la rediffusion du premier, son pseudo, son temps et ses morts rejoués, les versions ; `mine` seulement pour lui", async () => {
    const t = await jumpApi();
    const [slow, mid] = [runs[0]!, runs[1]!];
    await t.call("POST", "/api/jump/submit", body(slow.code, { name: "Lente" }), as(1));
    t.clock.now += 1000;
    await t.call("POST", "/api/jump/submit", body(mid.code, { name: "Rapide" }), as(2));
    const r = await t.call("GET", `/api/jump/day/${DATE}/ghost/first`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ date: DATE, levelId: D.id, name: "Rapide", ticks: mid.ticks, deaths: mid.deaths, replay: mid.code, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, mine: false });
    // Jamais l'identifiant du premier dans la réponse.
    expect(JSON.stringify(r.body)).not.toContain(playerId(2));
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`, undefined, as(2))).body.mine).toBe(true);
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`, undefined, as(1))).body.mine).toBe(false);
    // Un meilleur temps : le premier change tout de suite (jour en cours, jamais gardé en mémoire).
    t.clock.now += 1000;
    await t.call("POST", "/api/jump/submit", body(D.code), as(1));
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`, undefined, as(1))).body).toMatchObject({ name: "Lente", ticks: D.authorTicks, deaths: 0, replay: D.code, mine: true });
    expect(await t.db.first("SELECT COUNT(*) AS n FROM rate WHERE key NOT LIKE 'jip:%' AND key NOT LIKE 'jp:%'")).toEqual({ n: 0 });
  });

  it("égalités : la règle du classement (P1) — à temps égal le premier envoyé, au même instant le plus petit identifiant", async () => {
    const t = await jumpApi();
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Second" }), as(30));
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Premier" }), as(20)); // même instant : l'identifiant le plus petit
    t.clock.now -= 1000; // (l'horloge recule : un envoi « plus tôt » au même temps passe devant)
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Avant" }), as(40));
    const r = await t.call("GET", `/api/jump/day/${DATE}/ghost/first`);
    expect(r.body.name).toBe("Avant");
    const board = await t.call("GET", `/api/jump/day/${DATE}/board`);
    expect(board.body.top.map((x: { name: string }) => x.name)).toEqual(["Avant", "Premier", "Second"]);
    expect(board.body.top[0].name).toBe(r.body.name);
  });

  it("jour passé : la même rediffusion, figée (plus aucun envoi), gardée en mémoire ; un pseudo changé la suit", async () => {
    const t = await jumpApi();
    await t.call("POST", "/api/jump/submit", body(runs[1]!.code, { name: "Hier" }), as(5));
    const during = await t.call("GET", `/api/jump/day/${DATE}/ghost/first`);
    t.clock.now = parisDayStart(DAY + 1) + JUMP_GRACE_MS + 1000;
    const after = await t.call("GET", `/api/jump/day/${DATE}/ghost/first`);
    expect(after.body).toEqual(during.body);
    expect((await t.call("POST", "/api/jump/submit", body(D.code), as(6))).body.error).toBe("day_closed");
    t.clock.now += 3 * 86_400_000;
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`)).body).toEqual(during.body);
    expect((await t.call("PUT", "/api/player", { playerId: playerId(5), name: "Renommée" })).status).toBe(200);
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`)).body).toMatchObject({ name: "Renommée", replay: runs[1]!.code });
    // « Changer mon code » : le premier reste le même joueur (`mine` pour le nouvel identifiant).
    expect((await t.call("POST", "/api/me/code", { newId: playerId(7) }, as(5))).status).toBe(200);
    expect((await t.call("GET", `/api/jump/day/${DATE}/ghost/first`, undefined, as(7))).body.mine).toBe(true);
  });
});

describe(`GET /api/jump/me (${TEST_DB})`, () => {
  it("contenu : chaque jour classé (meilleur temps rejoué, morts de cet essai, médaille du niveau), jours, médailles, série", async () => {
    const t = await jumpApi();
    const slow = runs[0]!;
    await t.call("POST", "/api/jump/submit", body(slow.code, { name: "Profil" }), as(10));
    t.clock.now += 1000;
    await t.call("POST", "/api/jump/submit", body(runs[0]!.code), as(10)); // pas meilleur : rien ne change
    t.clock.now = parisDayStart(DAY + 1) + 12 * 3_600_000;
    await t.call("POST", "/api/jump/submit", body(D2.code, {}, D2), as(10));
    const r = await t.call("GET", "/api/jump/me", undefined, as(10));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const m1 = jumpMedalFor(slow.ticks, D.medals);
    expect(r.body).toEqual({
      name: "Profil",
      renameRequired: false,
      today: formatDay(DAY + 1),
      simVersion: JUMP_SIM_VERSION,
      generatorVersion: JUMP_GENERATOR_VERSION,
      days: [
        { date: DATE, levelId: D.id, ticks: slow.ticks, deaths: slow.deaths, medal: m1 },
        { date: formatDay(DAY + 1), levelId: D2.id, ticks: D2.authorTicks, deaths: 0, medal: "author" },
      ],
      stats: { days: 2, medals: { author: 1, gold: m1 === "gold" ? 1 : 0, silver: m1 === "silver" ? 1 : 0, bronze: m1 === "bronze" ? 1 : 0 }, streak: 2 },
    });
    // Le surlendemain sans partie : la série tient jusqu'à minuit (hier compte), puis tombe.
    t.clock.now += 86_400_000;
    expect((await t.call("GET", "/api/jump/me", undefined, as(10))).body.stats.streak).toBe(2);
    t.clock.now += 86_400_000;
    expect((await t.call("GET", "/api/jump/me", undefined, as(10))).body.stats.streak).toBe(0);
    // Une lecture n'écrit rien (débit en mémoire).
    const before = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM rate");
    await t.call("GET", "/api/jump/me", undefined, as(10));
    expect(await t.db.first("SELECT COUNT(*) AS n FROM rate")).toEqual(before);
  });

  it("joueur inconnu : 404 unknown_player ; sans en-tête : 400 ; identifiant illisible : 400 ; un joueur de DailyTrack seul : profil vide", async () => {
    const t = await makeApi({ environment: "recette" });
    const unknown = await t.call("GET", "/api/jump/me", undefined, as(77));
    expect([unknown.status, unknown.body.error]).toEqual([404, "unknown_player"]);
    expect((await t.call("GET", "/api/jump/me")).status).toBe(400);
    expect((await t.call("GET", "/api/jump/me", undefined, { headers: { "X-Player-Id": "pas-un-id" } })).status).toBe(400);
    expect((await t.call("POST", "/api/jump/me", undefined, as(77))).status).toBe(405);
    const race = pilotReplay(CDJ_DAY, 0.8);
    expect((await t.call("POST", "/api/submit", { playerId: playerId(78), name: "Pilote", date: formatDay(CDJ_DAY), replay: race.code })).status).toBe(200);
    const r = await t.call("GET", "/api/jump/me", undefined, as(78));
    expect(r.body).toMatchObject({ name: "Pilote", days: [], stats: { days: 0, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, streak: 0 } });
  });

  it("code révoqué : 410 code_revoked ; le nouveau code rend le même profil", async () => {
    const t = await jumpApi();
    await t.call("POST", "/api/jump/submit", body(D.code, { name: "Tourne" }), as(11));
    expect((await t.call("POST", "/api/me/code", { newId: playerId(12) }, as(11))).status).toBe(200);
    const old = await t.call("GET", "/api/jump/me", undefined, as(11));
    expect([old.status, old.body.error]).toEqual([410, "code_revoked"]);
    const fresh = await t.call("GET", "/api/jump/me", undefined, as(12));
    expect(fresh.body).toMatchObject({ name: "Tourne", days: [{ date: DATE, ticks: D.authorTicks, medal: "author" }] });
  });
});

describe(`GET /api/me de DailyTrack inchangé (${TEST_DB})`, () => {
  it("les essais DailyJump d'un joueur ne changent rien à sa réponse (mêmes champs, mêmes valeurs)", async () => {
    const race = pilotReplay(CDJ_DAY, 0.8);
    const play = async (jump: boolean) => {
      const t = await makeApi({ environment: "recette" });
      t.clock.now = CDJ_NOON;
      expect((await t.call("POST", "/api/submit", { playerId: playerId(90), name: "Double", date: formatDay(CDJ_DAY), replay: race.code })).status).toBe(200);
      t.clock.now = NOON;
      if (jump) expect((await t.call("POST", "/api/jump/submit", body(D.code), as(90))).status).toBe(200);
      return (await t.call("GET", "/api/me", undefined, as(90))).body;
    };
    const [alone, both] = [await play(false), await play(true)];
    expect(both).toEqual(alone);
    expect(Object.keys(both).sort()).toEqual(["best", "name", "past", "renameRequired", "simVersion", "stats", "today"]);
  });
});
