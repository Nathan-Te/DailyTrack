import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP } from "@cdj/jump-sim";
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
    const seen: { accepted: number; refused: number }[] = [];
    const total = await seedJumpDays({ db, frozen: FROZEN, days: [day], demoOnly: true, onDay: (d) => void seen.push(d) });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.refused).toBe(0);
    expect(total).toBeGreaterThanOrEqual(5);
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
    // Base qui contient de vrais joueurs : refus du jeu de données de démonstration.
    await db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, 'Vrai', 1, 1, 0, 'vrai')", [playerId(1)]);
    await expect(seedJumpDays({ db, frozen: FROZEN, days: [day], demoOnly: true })).rejects.toThrow(/vrai/);
  }, 60_000);

  it("déterministes : mêmes joueurs, mêmes rediffusions pour une date", () => {
    const d = jumpDailyOf(PREMIER_JOUR_JUMP, FROZEN);
    expect(d.id).toBe("jour-2026-10-16-g4"); // le jour figé, comme le jeu
    const a = fictionalJumps(d, 6);
    const b = fictionalJumps(d, 6);
    expect(a).toEqual(b);
    expect(a[0]!.ticks).toBe(d.authorTicks);
  }, 60_000);
});

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
  });

  it("« aujourd'hui » de la démo : toutes les lignes, celles que le vrai serveur classe (même code, même ordre)", async () => {
    const db = await openTestDb();
    await seedJumpDays({ db, frozen: FROZEN, days: [JUMP_DEMO_TODAY], demoOnly: true });
    const rows = await db.all("SELECT p.name AS name, r.ticks AS ticks, r.deaths AS deaths FROM jump_results r JOIN players p ON p.id = r.player_id ORDER BY r.ticks, r.submitted_at, r.player_id");
    const file = JSON.parse(readFileSync(join(PUBLIC, "demo", `${index.demoToday}.json`), "utf8")) as { rows: unknown[] };
    expect(file.rows, "relancer jump:seed").toEqual(rows);
  }, 60_000);
});
