import { describe, expect, it } from "vitest";
import { PREMIER_JOUR, SIM_VERSION, formatDay, medalFor, medalsFor, replayRace, decodeReplay, dailyCircuit } from "@cdj/sim";
import { assertDemoOnly, runFictional, seedHistory, styleFor } from "../src/history";
import { createApi } from "../src/api";
import { openSqlite } from "../src/node-sqlite";
import { DAY, NOON, circuitOf, playerId, pilotReplay } from "./helpers";

// Historique de pilotes fictifs (lot 11) : leurs courses passent par le même chemin que les vraies.

describe("seedHistory", () => {
  it("fabrique un jeu de données cohérent, par l'API (rejeu serveur), avec des joueurs marqués demo", async () => {
    const db = openSqlite(":memory:");
    const data = await seedHistory({ days: 2, pilots: { min: 4, max: 5 }, db });
    expect(data.index.days.map((d) => d.date)).toEqual([formatDay(PREMIER_JOUR), formatDay(PREMIER_JOUR + 1)]);
    expect(data.index.demoToday).toBe(formatDay(PREMIER_JOUR + 2));
    expect(data.index.simVersion).toBe(SIM_VERSION);

    for (const day of data.days) {
      expect(day.top.length).toBeGreaterThanOrEqual(3);
      expect(day.participants).toBe(day.top.length);
      day.top.forEach((r, i) => {
        expect(r.rank).toBe(i + 1);
        expect(r.name.startsWith("Démo ")).toBe(true);
      });
      // Le temps enregistré est celui que le serveur a rejoué : le fantôme du premier le redonne exactement.
      const circuit = dailyCircuit(PREMIER_JOUR + data.days.indexOf(day));
      const result = replayRace(circuit.track, decodeReplay(day.ghost!.replay));
      expect(result.finishMs).toBe(day.top[0]!.ms);
      const medals = medalsFor(circuit.authorMs);
      for (const r of day.top) expect(r.medal).toBe(medalFor(r.ms, medals));
    }

    // Tous les joueurs de la base sont des joueurs de démonstration.
    const real = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE demo = 0");
    const demo = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE demo = 1");
    expect(real!.n).toBe(0);
    expect(demo!.n).toBe(data.days.reduce((n, d) => n + d.top.length, 0));
  }, 60_000);

  it("est déterministe : deux fabrications donnent exactement le même jeu de données", async () => {
    const a = await seedHistory({ days: 1, pilots: { min: 3, max: 3 } });
    const b = await seedHistory({ days: 1, pilots: { min: 3, max: 3 } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  }, 60_000);

  it("refuse une base qui contient de vrais joueurs (jamais de production)", async () => {
    const db = openSqlite(":memory:");
    // Un vrai joueur, créé par l'API comme en production (sans l'option demo).
    const real = createApi({ db, now: () => NOON });
    const code = pilotReplay(DAY, 0.9).code;
    const res = await real.handle(new Request("http://x/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: playerId(1), name: "Alice", date: formatDay(DAY), replay: code }) }));
    expect(res.status).toBe(200);
    await expect(assertDemoOnly(db)).rejects.toThrow(/vrai/);
    await expect(seedHistory({ days: 1, db })).rejects.toThrow(/refusée/);
  }, 60_000);

  it("accepte une base vierge ou déjà 100 % démo", async () => {
    const db = openSqlite(":memory:");
    await expect(assertDemoOnly(db)).resolves.toBeUndefined();
    await seedHistory({ days: 1, pilots: { min: 3, max: 3 }, db });
    await expect(assertDemoOnly(db)).resolves.toBeUndefined();
  }, 60_000);
});

describe("pilotes fictifs", () => {
  const track = circuitOf(DAY).track;
  it("plus le niveau baisse, plus ils sont lents", () => {
    const good = runFictional(track, styleFor(1), 1)!;
    const bad = runFictional(track, styleFor(0.2), 1)!;
    expect(good).not.toBeNull();
    expect(bad).not.toBeNull();
    expect(bad.finishMs).toBeGreaterThan(good.finishMs * 1.15);
  });
  it("sont déterministes (même graine, même course)", () => {
    expect(runFictional(track, styleFor(0.5), 7)!.code).toBe(runFictional(track, styleFor(0.5), 7)!.code);
  });
});
