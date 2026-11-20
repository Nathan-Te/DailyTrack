import { describe, expect, it } from "vitest";
import { refOfPlayer } from "../src/players";
import { GAMES } from "../src/registry";
import { D_ESSAI } from "./jeuNeufAide";
import { defPartyJouet, MIDI, rediffusion } from "./partyAide";
import { makeApi, ouvrirJeu, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot PA1 — un jeu Party est **hors de la journée, du cumul, de la série et de la ligne de partage** (comme l'arcade) : le portail le montre `compte: false` et `categorie: "party"`, la journée parfaite
// ne l'attend pas, et ses résultats ne rejoignent jamais le cumul. Dates fixes. SQLite et libSQL (`file:`), jamais Turso.

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

async function api(): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: [...GAMES, defPartyJouet] });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track", 0);
  await ouvrirJeu(t, "jump", 0);
  await ouvrirJeu(t, defPartyJouet.code, D_ESSAI - 3);
  return t;
}
async function joueur(t: TestApi, n: number, nom: string): Promise<void> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [id, nom, nom.toLowerCase(), (await refOfPlayer(id)) as string]);
}

describe(`jeu Party : hors journée, hors cumul (${TEST_DB})`, () => {
  it("le portail le dit hors journée (`compte: false`, `categorie: \"party\"`) et le classement du jour lui garde son onglet", { timeout: 30_000 }, async () => {
    const t = await api();
    const jour = (await t.call("GET", "/api/portail/jour")).body;
    expect(jour.jeux.find((j: { jeu: string }) => j.jeu === "partyjouet")).toMatchObject({ compte: false, categorie: "party" });
    expect(jour.jeux.find((j: { jeu: string }) => j.jeu === "cdj")).not.toHaveProperty("categorie");
    const classement = (await t.call("GET", "/api/portail/classement")).body;
    expect(classement.jeux.find((j: { jeu: string }) => j.jeu === "partyjouet")).toMatchObject({ categorie: "party" });
  });

  it("la journée parfaite et la série ne l'attendent pas", { timeout: 30_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 60000, '[]', 'x', 0, 1000)", [D_ESSAI, playerId(1)]);
    await t.db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, 'x', 2400, 0, 'x', 1, 1, 0, 1000)", [D_ESSAI, playerId(1)]);
    const j = (await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur;
    expect(j).toMatchObject({ aujourdhuiParfaite: true, serie: 1 });
  });

  it("son résultat ne rejoint ni le cumul ni la journée : un joueur qui n'a fini que le jeu Party n'a aucune journée", { timeout: 30_000 }, async () => {
    const t = await api();
    await joueur(t, 2, "Bruno");
    const r = await t.call("POST", `/api/${defPartyJouet.code}/submit`, { replay: rediffusion([10]), name: "Bruno" }, as(2));
    expect(r.status).toBe(200);
    const j = (await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur;
    expect(j).toMatchObject({ serie: 0, journeesParfaites: 0, aujourdhuiParfaite: false });
    const cumul = (await t.call("GET", "/api/portail/classement")).body;
    expect(cumul.top ?? cumul.cumul ?? []).toEqual([]);
  });
});
