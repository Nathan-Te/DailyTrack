import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION } from "@cdj/blocks-sim";
import { ESSAIS_BLOCKS } from "../scripts/blocks-essais";
import { refOfPlayer } from "../src/players";
import { makeApi, ouvrirJeu, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot B4 — « Blocks » est un jeu d'ARCADE (lot A3) : la journée, la série, la journée parfaite et le cumul ne le comptent pas, qu'il soit épinglé ou non ; il garde son niveau, son état et sa vue de classement.
// Même parcours que Tower (`towerPortail.test.ts`), avec de vraies parties de Blocks envoyées au serveur (rejouées). Le départage (score ↓, combo ↓, premier arrivé) est dans `blocks.test.ts`.
// SQLite et libSQL (`file:`), jamais Turso.
const JOUR = daysFromCivil(2026, 11, 10);
const MIDI = parisDayStart(JOUR) + 12 * 3_600_000;
const VERSIONS = { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION };
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

async function api(): Promise<TestApi> {
  const t = await makeApi({ seed: false });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track");
  await ouvrirJeu(t, "jump");
  await ouvrirJeu(t, "blocks", JOUR - 3);
  return t;
}
async function joueur(t: TestApi, n: number, nom: string): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [playerId(n), nom, nom.toLowerCase(), (await refOfPlayer(playerId(n))) as string]);
}
async function track(t: TestApi, n: number, ms: number): Promise<void> {
  await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [JOUR, playerId(n), ms, 1000 + n]);
}
async function jump(t: TestApi, n: number, ticks: number): Promise<void> {
  await t.db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, 'x', ?, 0, 'x', 1, 1, 0, ?)", [JOUR, playerId(n), ticks, 1000 + n]);
}
/** Une vraie partie de Blocks, envoyée par le joueur `n` : le serveur la rejoue et la classe. */
async function blocks(t: TestApi, n: number, variante: number): Promise<void> {
  const r = await t.call("POST", "/api/blocks/submit", { replay: ESSAIS_BLOCKS.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, as(n));
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}
type Entree = { jeu: string; categorie?: string; compte?: boolean; etat?: { statut: string } };

describe(`Blocks, jeu d'arcade, sur le portail (${TEST_DB})`, () => {
  it("la journée liste Blocks : `arcade`, `compte: false` ; Track et Jump gardent leur forme (aucune catégorie)", { timeout: 30_000 }, async () => {
    const t = await api();
    const jeux = (await t.call("GET", "/api/portail/jour")).body.jeux as Entree[];
    expect(jeux.find((j) => j.jeu === "blocks")).toMatchObject({ jeu: "blocks", categorie: "arcade", compte: false });
    for (const j of jeux.filter((x) => x.jeu === "cdj" || x.jeu === "jump")) expect("categorie" in j).toBe(false);
  });

  it("ni la journée parfaite ni la série ne le comptent, épinglé ou non ; Track et Jump gardent leur journée", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await track(t, 1, 60_000);
    await jump(t, 1, 2400);
    await blocks(t, 1, 3); // Alice a fini Track, Jump et Blocks
    await track(t, 2, 61_000); // Bruno : Track seul
    expect((await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur).toMatchObject({ aujourdhuiParfaite: true, journeesParfaites: 1, serie: 1, jeuxDuJour: ["track", "jump"] }); // Blocks n'est pas exigé
    expect((await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur).toMatchObject({ aujourdhuiParfaite: false, journeesParfaites: 0, serie: 1 });
    // Un joueur qui n'a fini que Blocks n'a ni série ni journée.
    await joueur(t, 3, "Chloé");
    await blocks(t, 3, 5);
    const chloe = await t.call("GET", "/api/portail/jour", undefined, as(3));
    expect(chloe.body.joueur).toMatchObject({ serie: 0, aujourdhuiParfaite: false, journeesParfaites: 0 });
    // ... même épinglé.
    expect((await t.call("PUT", "/api/portail/favoris", { favoris: ["blocks"] }, as(3))).status).toBe(200);
    const epingle = await t.call("GET", "/api/portail/jour", undefined, as(3));
    expect(epingle.body.joueur).toMatchObject({ serie: 0, aujourdhuiParfaite: false, favoris: ["blocks"] });
    // Il garde son niveau et son état : fini pour Chloé, avec la médaille que le serveur a rejouée.
    expect((epingle.body.jeux as Entree[]).find((j) => j.jeu === "blocks")).toMatchObject({ categorie: "arcade", compte: false, etat: { statut: "fini" } });
  });

  it("jamais le cumul : la liste du cumul le marque `arcade`, aucune ligne du cumul ne porte de résultat de Blocks ; sa vue de classement existe à part", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await track(t, 1, 60_000);
    await jump(t, 1, 2400);
    await blocks(t, 1, 3);
    await blocks(t, 2, 0);
    const cumul = await t.call("GET", "/api/portail/classement");
    expect(cumul.status).toBe(200);
    expect((cumul.body.jeux as Entree[]).find((j) => j.jeu === "blocks")).toMatchObject({ categorie: "arcade" });
    expect(cumul.body.top.length).toBeGreaterThan(0);
    expect(cumul.body.top.every((l: { resultats: Record<string, unknown> }) => !("blocks" in l.resultats))).toBe(true);
    // Bruno n'a fini que Blocks : il n'a aucune ligne dans le cumul au temps.
    expect(cumul.body.top.map((l: { pseudo: string }) => l.pseudo)).not.toContain("Joueur2");
    const vue = await t.call("GET", "/api/portail/classement?vue=blocks");
    expect(vue.status).toBe(200);
    expect(vue.body.top.map((l: { pseudo: string }) => l.pseudo).sort()).toEqual(["Joueur1", "Joueur2"]);
  });

  it("le jour s'écrit en date de Paris : la partie est celle du jour de la fiche (garde-fou du numéro)", async () => {
    const t = await api();
    const info = await t.call("GET", "/api/blocks/info");
    expect(info.body.today).toBe(formatDay(JOUR));
  });
});
