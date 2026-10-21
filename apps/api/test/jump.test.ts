import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, dailyLevel, demoAttempts, encodeReplay, lifeReplay, replayAttempt } from "@cdj/jump-sim";
import { loadDaily } from "../../jump/src/dailyLoader";
import { thawLevel } from "../../jump/src/frozen";
import type { Logger } from "../src/log";
import { thawFrozen } from "../src/jump";
import { DAY_MS, makeApi, openTestDb, playerId, TEST_DB } from "./helpers";

// Lot P0 (plateforme) : l'espace `/api/jump/` (lecture seule) et la preuve « serveur = jeu ». Tourne sur SQLite et sur libSQL.

/** Les jours figés publiés avec le jeu (`apps/jump/public/levels/`), comme `vite.config.ts` du jeu et `scripts/build-node.mjs` de l'API les lisent. */
const LEVELS_DIR = join(__dirname, "..", "..", "jump", "public", "levels");
const FROZEN: Record<string, unknown> = Object.fromEntries(
  readdirSync(LEVELS_DIR)
    .map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
    .filter((d): d is string => d !== undefined)
    .sort()
    .map((d) => [d, JSON.parse(readFileSync(join(LEVELS_DIR, `${d}.json`), "utf8"))]),
);
const FROZEN_DAYS = Object.keys(FROZEN);

/** Midi UTC d'un jour (le serveur lit la date à Paris). */
const noonOf = (day: number) => day * DAY_MS + 12 * 3_600_000;
/** 60 dates à partir du premier niveau : « aujourd'hui » est le lendemain de la dernière. */
const DATES = Array.from({ length: 60 }, (_, i) => PREMIER_JOUR_JUMP + i);
const AFTER = noonOf(PREMIER_JOUR_JUMP + 60);

async function jumpApi(at = AFTER, extra: { log?: Logger; db?: Awaited<ReturnType<typeof openTestDb>>; jumpFrozen?: Record<string, unknown> } = {}) {
  const t = await makeApi({ seed: false, jumpFrozen: FROZEN, environment: "recette", ...extra });
  t.clock.now = at;
  return t;
}

describe(`/api/jump/info (${TEST_DB})`, () => {
  it("rend les versions, la date de Paris, les jours figés de l'image et l'environnement", async () => {
    const t = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)));
    const r = await t.call("GET", "/api/jump/info");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ game: "jump", simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, today: "2026-10-19", frozenDays: FROZEN_DAYS, environment: "recette" });
    expect(FROZEN_DAYS.length).toBeGreaterThan(0);
    // À 23 h 30 UTC le 19/10, il est déjà le 20 à Paris.
    t.clock.now = daysFromCivil(2026, 10, 19) * DAY_MS + 23.5 * 3_600_000;
    expect((await t.call("GET", "/api/jump/info")).body.today).toBe("2026-10-20");
  });

  it("sans fichiers figés ni environnement : liste vide, `local`", async () => {
    const t = await makeApi({ seed: false });
    expect((await t.call("GET", "/api/jump/info")).body).toMatchObject({ frozenDays: [], environment: "local" });
  });
});

describe(`/api/jump/day (${TEST_DB})`, () => {
  it("un jour figé : le fichier de l'image (preuve rejouée), avec son empreinte, son identifiant, son temps de l'auteur ; jamais la grille", async () => {
    const t = await jumpApi();
    for (const date of FROZEN_DAYS) {
      const f = FROZEN[date] as { id: string; hash: string; auteur: number; medailles: Record<string, number> };
      const r = await t.call("GET", `/api/jump/day/${date}`);
      expect(r.status, date).toBe(200);
      expect(r.body).toMatchObject({ date, id: f.id, hash: f.hash, authorTicks: f.auteur, medals: f.medailles, source: "fige" });
      expect(Object.keys(r.body).sort()).toEqual(["authorTicks", "date", "generatorVersion", "hash", "id", "medals", "number", "simVersion", "source", "theme"]);
    }
  });

  it("refuse les dates futures (comme le jeu publié), celles d'avant le premier niveau et les dates illisibles", async () => {
    const t = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)));
    expect((await t.call("GET", "/api/jump/day/2026-10-20")).body).toEqual({ error: "unknown_day" });
    expect((await t.call("GET", "/api/jump/day/2026-10-20")).status).toBe(404);
    expect((await t.call("GET", `/api/jump/day/${formatDay(PREMIER_JOUR_JUMP - 1)}`)).status).toBe(404);
    expect((await t.call("GET", "/api/jump/day/hier")).status).toBe(400);
    expect((await t.call("GET", "/api/jump/day/%E0")).status).toBe(400);
    expect((await t.call("POST", "/api/jump/day/2026-10-19")).status).toBe(405);
    expect((await t.call("POST", "/api/jump/info")).status).toBe(405);
    expect((await t.call("GET", "/api/jump/nimporte")).status).toBe(404);
    expect((await t.call("GET", "/api/jump")).status).toBe(404);
  });

  it("un seul calcul même si deux requêtes arrivent ensemble, puis plus aucun (mémoire, puis base)", async () => {
    const logs: string[] = [];
    const log: Logger = (_s, message) => logs.push(message);
    const db = await openTestDb();
    // Le chemin « généré » : sans fichier figé (le 19/10 est figé depuis la mise en production du 20/10 ; un autre jour le sera un jour aussi).
    const t = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)), { log, db, jumpFrozen: {} });
    const [a, b] = await Promise.all([t.call("GET", "/api/jump/day/2026-10-19"), t.call("GET", "/api/jump/day/2026-10-19")]);
    expect(a.body).toEqual(b.body);
    expect(a.body).toMatchObject({ id: `jour-2026-10-19-g${JUMP_GENERATOR_VERSION}`, source: "genere" });
    expect(logs.filter((m) => m === "DailyJump : niveau du jour calculé")).toHaveLength(1);
    expect((await t.call("GET", "/api/jump/day/2026-10-19")).body).toEqual(a.body);
    expect(logs.filter((m) => m === "DailyJump : niveau du jour calculé")).toHaveLength(1);
    // Une autre instance sur la même base : lu en base, pas recalculé.
    const other = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)), { log, db, jumpFrozen: {} });
    expect((await other.call("GET", "/api/jump/day/2026-10-19")).body).toEqual(a.body);
    expect(logs.filter((m) => m === "DailyJump : niveau du jour calculé")).toHaveLength(1);
    const row = await db.first<{ level_id: string; rule: string; ascii: string }>("SELECT level_id, rule, ascii FROM jump_levels WHERE day = ?", [daysFromCivil(2026, 10, 19)]);
    expect(row).toMatchObject({ level_id: a.body.id, rule: `s${JUMP_SIM_VERSION}-g${JUMP_GENERATOR_VERSION}--` });
    expect(row!.ascii.length).toBeGreaterThan(100);
    // Une ligne d'une autre règle (autre version, fichier figé ajouté) est recalculée.
    await db.run("UPDATE jump_levels SET rule = 'ancienne', hash = 'faux' WHERE day = ?", [daysFromCivil(2026, 10, 19)]);
    const third = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)), { log, db, jumpFrozen: {} });
    expect((await third.call("GET", "/api/jump/day/2026-10-19")).body).toEqual(a.body);
    expect(logs.filter((m) => m === "DailyJump : niveau du jour calculé")).toHaveLength(2);
  });

  it("limite les lectures par adresse (en mémoire : une lecture n'écrit rien)", async () => {
    const db = await openTestDb();
    const t = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)), { db });
    for (let i = 0; i < 120; i++) expect((await t.call("GET", "/api/jump/info", undefined, { clientKey: "198.51.100.9" })).status).toBe(200);
    const r = await t.call("GET", "/api/jump/info", undefined, { clientKey: "198.51.100.9" });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await t.call("GET", "/api/jump/info", undefined, { clientKey: "198.51.100.10" })).status).toBe(200);
    expect(await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM rate")).toEqual({ n: 0 });
  });

  it("/api/health ne change pas avec DailyJump", async () => {
    const t = await jumpApi(noonOf(daysFromCivil(2026, 10, 19)));
    expect(Object.keys((await t.call("GET", "/api/health")).body).sort()).toEqual(["clock", "db", "generatorVersion", "ok", "salonMinutes", "salonOverride", "simVersion", "today"]);
  });
});

// ——— La preuve « serveur = jeu » ———
describe(`le serveur calcule le même niveau que le jeu (${TEST_DB})`, () => {
  /** Ce que calcule `apps/jump` : `loadDaily` (figé d'abord, sinon génération sur le fil principal), sans stockage ni worker. */
  const client = (day: number) =>
    loadDaily(day, { store: null, today: formatDay(day), frozen: { days: FROZEN_DAYS, read: async (date) => FROZEN[date] ?? null } });

  it("pour 60 dates et chaque jour figé : identifiant, empreinte et temps de l'auteur identiques", { timeout: 120_000 }, async () => {
    const t = await jumpApi();
    // Les 60 dates commencent au premier niveau : elles contiennent tous les jours figés (sinon, les ajouter ici).
    const days = [...DATES];
    for (const date of FROZEN_DAYS) expect(days.map(formatDay), date).toContain(date);
    let frozenSeen = 0;
    for (const day of days) {
      const date = formatDay(day);
      const mine = (await client(day)).level;
      const r = await t.call("GET", `/api/jump/day/${date}`);
      expect(r.status, date).toBe(200);
      expect({ id: r.body.id, hash: r.body.hash, authorTicks: r.body.authorTicks, medals: r.body.medals, theme: r.body.theme, number: r.body.number }, date).toEqual({
        id: mine.id,
        hash: mine.hash,
        authorTicks: mine.authorTicks,
        medals: mine.medals,
        theme: mine.theme,
        number: mine.number,
      });
      if (r.body.source === "fige") frozenSeen++;
    }
    expect(frozenSeen).toBe(FROZEN_DAYS.length);
  });

  it("un fichier figé abîmé est refusé des deux côtés, pour la même raison, et les deux génèrent le même niveau", async () => {
    const date = FROZEN_DAYS[0]!;
    const day = DATES.find((d) => formatDay(d) === date)!;
    const f = FROZEN[date] as Record<string, unknown>;
    const variants: Record<string, unknown>[] = [
      { ...f, hash: "00000000" },
      { ...f, auteur: (f.auteur as number) + 1 },
      { ...f, simVersion: JUMP_SIM_VERSION + 1 },
      { ...f, generatorVersion: JUMP_GENERATOR_VERSION + 1 },
      { ...f, date: "2026-01-01" },
      { ...f, preuve: "AAAA" },
      { ...f, grille: (f.grille as string[]).slice(1) },
      { ...f, format: 2 },
    ];
    for (const v of variants) {
      const server = thawFrozen(v, day);
      const game = thawLevel(v, day);
      expect(typeof server, JSON.stringify(Object.keys(v))).toBe("string");
      expect(typeof game).toBe("string");
      expect((server as string).replace("le serveur est en", "le jeu est en")).toBe(game);
    }
    // Le fichier intact : accepté des deux côtés, même niveau.
    const ok = thawFrozen(f, day);
    const game = thawLevel(f, day);
    expect(typeof ok).toBe("object");
    expect(typeof game).toBe("object");
    if (typeof ok !== "string" && typeof game !== "string") expect([ok.info.id, ok.info.hash, ok.info.authorTicks]).toEqual([game.id, game.hash, game.authorTicks]);
  });
});

describe(`lot 15 : les rediffusions v3 se vérifient toujours côté serveur (${TEST_DB})`, () => {
  // Le dernier jour figé (en v3, avant le lot 15) et le lendemain, généré en v4 (horloge unique).
  const date = FROZEN_DAYS[FROZEN_DAYS.length - 1]!;
  const day = DATES.find((d) => formatDay(d) === date)!;
  const thawed = thawLevel(FROZEN[date], day);
  const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
  const body = (levelId: string, replay: string, name?: string) => ({ levelId, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay, ...(name ? { name } : {}) });

  it("un jour figé en v3 : sa preuve (v3) se classe, ses vies v3 sont rejouées ; une rediffusion marquée v4 est refusée (version)", async () => {
    if (typeof thawed === "string") throw new Error(thawed);
    expect(thawed.level.simVersion).toBe(SECTION_CLOCK_VERSION);
    const t = await jumpApi(noonOf(day));
    const ok = await t.call("POST", "/api/jump/submit", body(thawed.id, thawed.code, "Ancien"), as(1));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ accepted: true, ticks: thawed.authorTicks, deaths: 0 });
    const v4 = encodeReplay({ ...thawed.replay, simVersion: SINGLE_CLOCK_VERSION });
    const refused = await t.call("POST", "/api/jump/submit", body(thawed.id, v4), as(1));
    expect([refused.status, refused.body.error]).toEqual([409, "version"]);
    // Des vies v3 vécues sur ce jour (morts, reprises sur un point) : le serveur les rejoue et les garde.
    const lives = demoAttempts(thawed.level, thawed.replay, 9, { attempts: 6 })
      .flatMap((a) => replayAttempt(thawed.level, a.replay).lives.filter((l) => l.end === "mort").map((l) => encodeReplay(lifeReplay(a.replay, l))))
      .slice(0, 5);
    expect(lives.length).toBeGreaterThan(0);
    const r = await t.call("POST", "/api/jump/lives", { levelId: thawed.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives }, as(1));
    expect(r.status).toBe(200);
    expect(r.body.accepted).toBe(lives.length);
  });

  it("le lendemain, généré en v4 : la preuve v4 se classe, la même rediffusion marquée v3 est refusée (version)", async () => {
    const next = dailyLevel(day + 1);
    expect(next.level.simVersion).toBe(SINGLE_CLOCK_VERSION);
    const t = await jumpApi(noonOf(day + 1));
    const ok = await t.call("POST", "/api/jump/submit", body(next.id, next.code, "Nouveau"), as(2));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ accepted: true, ticks: next.authorTicks });
    const v3 = encodeReplay({ ...next.replay, simVersion: SECTION_CLOCK_VERSION });
    const refused = await t.call("POST", "/api/jump/submit", body(next.id, v3), as(2));
    expect([refused.status, refused.body.error]).toEqual([409, "version"]);
  });
});
