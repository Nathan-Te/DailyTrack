import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, decodeReplay, replayAttempt } from "@cdj/jump-sim";
import { JUMP_DEMO_DAYS, JUMP_DEMO_TODAY, fictionalJumps, jumpDailyOf, seedJumpDays } from "../src/jumpHistory";
import { fictionalId } from "../src/history";
import { openTestDb, playerId, TEST_DB } from "./helpers";

// Lot P1 (plateforme) : les joueurs fictifs de DailyJump (démonstration `?api=demo` et `recette:seed`) : de vraies rediffusions, envoyées par
// le vrai `createApi` (rejeu serveur), joueurs marqués `demo`, déterministes ; et le jeu de données statique du jeu est à jour.

const PUBLIC = join(__dirname, "..", "..", "jump", "public");
const FROZEN: Record<string, unknown> = Object.fromEntries(
  readdirSync(join(PUBLIC, "levels"))
    .map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
    .filter((d): d is string => d !== undefined)
    .map((d) => [d, JSON.parse(readFileSync(join(PUBLIC, "levels", `${d}.json`), "utf8"))]),
);

describe(`joueurs fictifs de DailyJump (${TEST_DB})`, () => {
  it("passent par le vrai createApi (aucun refus), sont marqués demo, avec un identifiant stable par pseudo ; relancer ne crée aucun doublon", async () => {
    const db = await openTestDb();
    const day = JUMP_DEMO_TODAY;
    const seen: { accepted: number; refused: number; lives: number; firstError: string }[] = [];
    const total = await seedJumpDays({ db, frozen: FROZEN, days: [day], demoOnly: true, onDay: (d) => void seen.push(d) });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.refused).toBe(0);
    expect(seen[0]!.firstError).toBe("");
    expect(total).toBeGreaterThanOrEqual(5);
    // Lot P3 : leurs vies (des morts rejouées par le serveur), au plus 30 par joueur, une ligne par joueur.
    const lives = await db.all<{ player_id: string; count: number }>("SELECT player_id, count FROM jump_lives WHERE day = ?", [day]);
    expect(lives.length).toBeGreaterThanOrEqual(total - 1);
    expect(lives.reduce((n, r) => n + r.count, 0)).toBe(seen[0]!.lives);
    for (const r of lives) expect(r.count).toBeLessThanOrEqual(30);
    const rows = await db.all<{ id: string; name: string; demo: number; ticks: number }>("SELECT p.id AS id, p.name AS name, p.demo AS demo, r.ticks AS ticks FROM jump_results r JOIN players p ON p.id = r.player_id WHERE r.day = ?", [day]);
    expect(rows).toHaveLength(total);
    for (const r of rows) {
      expect(r.demo).toBe(1);
      expect(r.name).toMatch(/^Démo /);
      expect(r.id).toBe(fictionalId(r.name));
    }
    // Des temps variés : l'auteur, et des essais qui ont trébuché (plus lents).
    const d = jumpDailyOf(day, FROZEN);
    expect(Math.min(...rows.map((r) => r.ticks))).toBe(d.authorTicks);
    expect(new Set(rows.map((r) => r.ticks)).size).toBeGreaterThan(rows.length / 2);
    await seedJumpDays({ db, frozen: FROZEN, days: [day] });
    expect(await db.first("SELECT COUNT(*) AS n FROM jump_results")).toEqual({ n: total });
    expect(await db.first<{ n: number }>("SELECT SUM(count) AS n FROM jump_lives WHERE day = ?", [day])).toEqual({ n: seen[0]!.lives });
    // Base qui contient de vrais joueurs : refus du jeu de données de démonstration.
    await db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, 'Vrai', 1, 1, 0, 'vrai')", [playerId(1)]);
    await expect(seedJumpDays({ db, frozen: FROZEN, days: [day], demoOnly: true })).rejects.toThrow(/vrai/);
  }, 180_000); // lot 19 : 65 s seul en g14 (les essais fictifs du 30/10 coûtent 10,5 s contre 5,5 s en g13, mesuré : un autre niveau, plus de vies)

  it("déterministes : mêmes joueurs, mêmes rediffusions pour une date", () => {
    const d = jumpDailyOf(PREMIER_JOUR_JUMP, FROZEN);
    expect(d.id).toBe("jour-2026-10-16-g4"); // le jour figé, comme le jeu
    const a = fictionalJumps(d, 6);
    const b = fictionalJumps(d, 6);
    expect(a).toEqual(b);
    expect(a[0]!.ticks).toBe(d.authorTicks);
  }, 60_000);
});

/** Le niveau d'un jour du jeu de données, généré une fois par fichier de test (le générateur est coûteux). */
const levels = new Map<number, ReturnType<typeof jumpDailyOf>>();
function levelOf(day: number): ReturnType<typeof jumpDailyOf> {
  let l = levels.get(day);
  if (!l) levels.set(day, (l = jumpDailyOf(day, FROZEN)));
  return l;
}

describe("jeu de données du mode ?api=demo (apps/jump/public/demo)", () => {
  const index = JSON.parse(readFileSync(join(PUBLIC, "demo", "index.json"), "utf8")) as { simVersion: number; generatorVersion: number; demoToday: string; days: { date: string; levelId: string; participants: number }[] };

  it("à jour avec les versions et le calendrier (sinon : relancer npm run jump:seed -w @cdj/api)", () => {
    expect([index.simVersion, index.generatorVersion], "relancer jump:seed").toEqual([JUMP_SIM_VERSION, JUMP_GENERATOR_VERSION]);
    expect(index.demoToday).toBe(formatDay(JUMP_DEMO_TODAY));
    expect(index.days.map((d) => d.date)).toEqual(Array.from({ length: JUMP_DEMO_DAYS + 1 }, (_, i) => formatDay(PREMIER_JOUR_JUMP + i)));
    for (const d of index.days) {
      const day = JSON.parse(readFileSync(join(PUBLIC, "demo", `${d.date}.json`), "utf8")) as { levelId: string; participants: number; top: unknown[] };
      expect(day.levelId, "relancer jump:seed").toBe(jumpDailyOf(PREMIER_JOUR_JUMP + index.days.indexOf(d), FROZEN).id);
      expect(day.participants).toBeGreaterThanOrEqual(3);
      expect(day.top.length).toBe(Math.min(10, day.participants));
    }
    // Lot 16 : il génère les 15 jours de la démo (g11, ≈ 0,3 s par jour) : 5,5 s mesurées, au-dessus du délai par défaut de 5 s.
  }, 60_000);

  it("lot P2 : chaque jour a le fantôme du premier — le premier du classement, sa rediffusion se rejoue à son temps et ses morts", () => {
    for (const d of index.days) {
      const day = JSON.parse(readFileSync(join(PUBLIC, "demo", `${d.date}.json`), "utf8")) as { top: { name: string; ticks: number; deaths: number }[]; first?: { name: string; ticks: number; deaths: number; replay: string; simVersion: number } };
      expect(day.first, "relancer jump:seed").toBeTruthy();
      expect([day.first!.name, day.first!.ticks, day.first!.deaths]).toEqual([day.top[0]!.name, day.top[0]!.ticks, day.top[0]!.deaths]);
      expect(day.first!.simVersion).toBe(JUMP_SIM_VERSION);
      const level = levelOf(PREMIER_JOUR_JUMP + index.days.indexOf(d));
      const r = replayAttempt(level.level, decodeReplay(day.first!.replay), level.id);
      expect([r.finished, r.time, r.deaths.length]).toEqual([true, day.first!.ticks, day.first!.deaths]);
    }
  });

  it("« aujourd'hui » de la démo : toutes les lignes, celles que le vrai serveur classe (même code, même ordre)", async () => {
    const db = await openTestDb();
    await seedJumpDays({ db, frozen: FROZEN, days: [JUMP_DEMO_TODAY], demoOnly: true });
    const rows = await db.all("SELECT p.name AS name, r.ticks AS ticks, r.deaths AS deaths FROM jump_results r JOIN players p ON p.id = r.player_id ORDER BY r.ticks, r.submitted_at, r.player_id");
    const file = JSON.parse(readFileSync(join(PUBLIC, "demo", `${index.demoToday}.json`), "utf8")) as { rows: unknown[] };
    expect(file.rows, "relancer jump:seed").toEqual(rows);
  }, 60_000);

  it("lot P3 : chaque jour a sa carte des morts et l'échantillon du carnage ; chaque vie de l'échantillon se rejoue et meurt", () => {
    for (const d of index.days) {
      const day = JSON.parse(readFileSync(join(PUBLIC, "demo", `${d.date}.json`), "utf8")) as {
        deaths?: { players: number; deaths: number; tiles: number[][] };
        carnage?: { players: number; dayPlayers: number; lives: { replay: string; section: number; p: number }[] };
      };
      expect(day.deaths, "relancer jump:seed").toBeTruthy();
      expect(day.carnage, "relancer jump:seed").toBeTruthy();
      expect(day.deaths!.players).toBeGreaterThanOrEqual(3);
      expect(day.deaths!.tiles.reduce((n, t) => n + t[2]!, 0)).toBeLessThanOrEqual(day.deaths!.deaths);
      expect(day.carnage!.lives.length).toBeGreaterThanOrEqual(10);
      const level = levelOf(PREMIER_JOUR_JUMP + index.days.indexOf(d));
      for (const l of day.carnage!.lives) {
        const r = replayAttempt(level.level, decodeReplay(l.replay), level.id);
        expect(r.lives.map((x) => x.end)).toEqual(["mort"]);
      }
    }
    // Comme les autres tests de ce fichier qui génèrent des niveaux (15 jours, ≈ 1 000 vies rejouées) : 5 s ne suffisent pas en CI.
  }, 60_000);
});
