import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyLevel } from "@cdj/jump-sim";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { joursProteges, lireResultats } from "../../../scripts/mise-en-production.mjs";
import { circuitOf, makeApi, parisDayStart, playerId } from "./helpers";

// Lot R11 (décision de Nathan) : « Mettre en production » ne protège que les jours d'avant le lancement, les jours déjà figés et ceux qui ont **au moins un résultat en base (Track ou
// Jump)**. Il les lit **en lecture seule** sur la production : `GET /api/portail/classement?date=` (route publique existante, `classes` = les joueurs qui ont fini au moins un jeu ce
// jour-là). Ce test prouve, contre le vrai serveur (SQLite et libSQL), que cette lecture voit un résultat de Track, un résultat de Jump, rien, et qu'elle n'écrit rien.

const JOUR = daysFromCivil(2026, 10, 20); // avant le lancement du serveur : la route ne refuse aucun jour
const NOON = parisDayStart(JOUR + 2) + 12 * 3_600_000;
const date = (n: number) => formatDay(JOUR + n);

describe("lire les jours qui ont des résultats en production (lecture seule)", () => {
  it("voit un jour avec un résultat de Track, un jour avec un résultat de Jump, un jour sans rien ; n'écrit rien, n'envoie ni identifiant ni corps", async () => {
    const t = await makeApi({ seed: false });
    t.clock.now = NOON;
    await t.call("GET", "/api/health"); // le schéma
    for (const n of [1, 2]) await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [playerId(n), `Joueur${n}`, `joueur${n}`]);
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, 1000)", [JOUR, playerId(1), circuitOf(JOUR).authorMs + 3000]);
    const niveau = dailyLevel(JOUR + 1);
    await t.db.run(
      "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, ?, 0, 'x', 1, 1, 0, 1000)",
      [JOUR + 1, playerId(2), niveau.id, niveau.medals.bronze + 500],
    );

    const requetes: { methode: string; chemin: string; entetes: string[]; corps: boolean }[] = [];
    const ecritures: string[] = [];
    const run = t.db.run.bind(t.db);
    t.db.run = ((sql: string, params?: Parameters<typeof run>[1]) => {
      if (!/^SELECT/i.test(sql)) ecritures.push(sql);
      return run(sql, params);
    }) as typeof t.db.run;
    const batch = t.db.batch?.bind(t.db);
    if (batch) {
      t.db.batch = ((statements: Parameters<typeof batch>[0]) => {
        ecritures.push("batch");
        return batch(statements);
      }) as typeof t.db.batch;
    }
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const u = new URL(url);
      requetes.push({ methode: String(init.method), chemin: u.pathname + u.search, entetes: Object.keys((init.headers as Record<string, string>) ?? {}).map((h) => h.toLowerCase()), corps: init.body !== undefined });
      return t.api.handle(new Request(url, init), { clientKey: "203.0.113.9" });
    }) as unknown as typeof fetch;

    const resultats = await lireResultats("http://api.test", [date(0), date(1), date(2)], { fetchImpl });
    expect(resultats[date(0)]).toBe(1); // un résultat de Track
    expect(resultats[date(1)]).toBe(1); // un résultat de Jump
    expect(resultats[date(2)]).toBe(0); // aucun résultat
    expect(requetes.map((r) => r.methode)).toEqual(["GET", "GET", "GET"]);
    for (const r of requetes) {
      expect(r.chemin).toMatch(/^\/api\/portail\/classement\?date=2026-10-2\d$/);
      expect(r.entetes).not.toContain("x-player-id");
      expect(r.corps).toBe(false);
    }
    // La lecture n'écrit aucune donnée de joueur : seulement, comme la première requête de n'importe quel joueur, les deux caches déterministes du serveur (le circuit et le niveau du jour).
    expect(ecritures.filter((sql) => !/^INSERT OR REPLACE INTO (circuits|jump_levels) /.test(sql)), "la lecture n'écrit aucune donnée").toEqual([]);

    // … et ce que le garde-fou en fait : seuls les deux jours qui ont un résultat sont protégés, le troisième est régénéré.
    const proteges = joursProteges({ premier: date(0), veille: date(2), resultats });
    expect(Object.keys(proteges.jours)).toEqual([date(0), date(1)]);
  }, 60_000);
});
