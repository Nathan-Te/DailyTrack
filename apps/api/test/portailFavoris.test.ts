import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { crc32Hex } from "../src/identity";
import { FAVORIS_PER_PLAYER } from "../src/portail";
import { makeApi, parisDayStart, playerId, TEST_DB } from "./helpers";

// Lot F1 (plateforme) : « Mes jeux », les jeux épinglés. Dates fixes (jamais l'horloge) ; SQLite **et** libSQL (`file:`, jamais Turso).
// La règle : la journée parfaite, « n fini sur m », la série et la ligne de partage portent sur mes jeux (tous les jeux sans favori) ; un changement compte à partir
// du lendemain (chaque jour est jugé avec la liste qui était la sienne) ; le classement du jour ne change pas.

const T = daysFromCivil(2026, 11, 2);
const midi = (jour: number) => parisDayStart(jour) + 12 * 3_600_000;
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const TOKEN = "jeton-admin-de-test-assez-long";

type T = Awaited<ReturnType<typeof portail>>;
async function portail(options: Parameters<typeof makeApi>[0] = {}) {
  const t = await makeApi({ seed: false, ...options });
  t.clock.now = midi(T);
  await t.call("GET", "/api/portail/jour", undefined, { clientKey: "192.0.2.1" }); // le schéma
  return t;
}

/** Un joueur connu du serveur, avec ses jours finis (insérés : le rejeu prouvé est testé ailleurs). `cree` : l'instant de création du profil (défaut : très ancien). */
async function joueur(t: T, n: number, jours: { track?: number[]; jump?: number[] }, cree = 0) {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, ?, 0, ?)", [id, `J${n}`, cree, `j${n}`]);
  for (const d of jours.track ?? []) await t.db.run("INSERT OR IGNORE INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 40000, '[]', 'x', 0, 0)", [d, id]);
  for (const d of jours.jump ?? []) {
    await t.db.run("INSERT OR IGNORE INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, 5000, 0, 'x', 1, 1, 0, 0)", [
      d,
      id,
      `jour-${formatDay(d)}-g1`,
    ]);
  }
  return id;
}

const epingler = (t: T, n: number, favoris: unknown, clientKey = "198.51.100.9") => t.call("PUT", "/api/portail/favoris", { favoris }, { ...as(n), clientKey });
const jour = async (t: T, n: number) => (await t.call("GET", "/api/portail/jour", undefined, { ...as(n), clientKey: "198.51.100.10" })).body as {
  jeux: { jeu: string; site: string; nouveau?: true }[];
  joueur: { serie: number; aProlonger: boolean; journeesParfaites: number; aujourdhuiParfaite: boolean; favoris: string[] | null; jeuxDuJour: string[] };
};
const lignes = async (t: T, n: number) => await t.db.all<{ du: number; jeux: string }>("SELECT du, jeux FROM favoris_jeux WHERE player_id = ? ORDER BY du", [playerId(n)]);
const avancer = (t: T, jours: number) => {
  t.clock.now = midi(T + jours);
};

describe(`Mes jeux : la route d'écriture (${TEST_DB})`, () => {
  it("un identifiant, une méthode PUT, une liste de jeux connus ; sinon un code de la liste", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    expect((await t.call("PUT", "/api/portail/favoris", { favoris: ["track"] })).status).toBe(400); // pas d'identifiant
    expect((await t.call("GET", "/api/portail/favoris", undefined, as(1))).status).toBe(405);
    expect((await epingler(t, 1, "track")).body).toMatchObject({ error: "invalid_json" });
    expect((await epingler(t, 1, undefined)).body).toMatchObject({ error: "invalid_json" });
    expect((await epingler(t, 1, ["track", 3])).body).toMatchObject({ error: "invalid_json" });
    expect((await epingler(t, 1, ["monopoly"])).body).toMatchObject({ error: "invalid_json" }); // un jeu que le serveur ne connaît pas
    expect((await t.call("PUT", "/api/portail/favoris", { favoris: ["track"] }, as(99))).status).toBe(404); // un visiteur : sa liste reste dans son navigateur
    expect(await lignes(t, 1)).toEqual([]); // rien n'a été écrit par un refus
  });

  it("la limite de débit : au-delà de quelques écritures par fenêtre, 429", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    let dernier = 200;
    for (let i = 0; i <= FAVORIS_PER_PLAYER; i++) dernier = (await epingler(t, 1, i % 2 ? ["track"] : [])).status;
    expect(dernier).toBe(429);
  });

  it("le corps trop gros est refusé avant tout", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    const r = await t.call("PUT", "/api/portail/favoris", undefined, { ...as(1), raw: JSON.stringify({ favoris: [], x: "a".repeat(500_000) }) });
    expect(r.status).toBe(413);
  });
});

describe(`Mes jeux : la journée sur mes jeux, un changement compte à partir du lendemain (${TEST_DB})`, () => {
  it("sans favori : tous les jeux, comme avant (favoris null)", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T - 1, T] });
    const j = await jour(t, 1);
    expect(j.joueur.favoris).toBeNull();
    expect(j.joueur.jeuxDuJour).toEqual(["track", "jump"]);
    expect(j.joueur.aujourdhuiParfaite).toBe(false);
    expect(j.joueur.serie).toBe(2);
  });

  it("épingler en cours de journée : la journée en cours est celle du début du jour, le choix compte dès demain", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T - 3, T - 2, T - 1, T] });
    const r = await epingler(t, 1, ["track"]);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ favoris: ["track"], effetLe: formatDay(T + 1), jeuxDuJour: ["track", "jump"], aujourdhuiParfaite: false });
    const auj = await jour(t, 1);
    expect(auj.joueur.favoris).toEqual(["track"]); // la liste choisie est rendue tout de suite
    expect(auj.joueur.jeuxDuJour).toEqual(["track", "jump"]); // mais aujourd'hui compte comme ce matin
    expect(auj.joueur.aujourdhuiParfaite).toBe(false);
    expect(auj.joueur.journeesParfaites).toBe(0);
    expect(await lignes(t, 1)).toEqual([{ du: T + 1, jeux: '["track"]' }]);
    // Demain : Track fini, c'est une journée parfaite ; les jours d'avant restent jugés avec tous les jeux (jamais parfaits).
    avancer(t, 1);
    await joueur(t, 1, { track: [T + 1] });
    const demain = await jour(t, 1);
    expect(demain.joueur.jeuxDuJour).toEqual(["track"]);
    expect(demain.joueur).toMatchObject({ aujourdhuiParfaite: true, journeesParfaites: 1, serie: 5 });
  });

  it("retirer un jeu : pareil, il sort de la journée dès demain seulement (personne ne le retire à 23 h 59 pour une journée parfaite)", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T], jump: [] });
    t.clock.now = midi(T - 5); // le joueur a épinglé les deux jeux il y a cinq jours
    await epingler(t, 1, ["track", "jump"]);
    t.clock.now = parisDayStart(T) + 23 * 3_600_000 + 59 * 60_000; // 23 h 59
    const r = await epingler(t, 1, ["track"]);
    expect(r.body).toMatchObject({ effetLe: formatDay(T + 1), jeuxDuJour: ["track", "jump"], aujourdhuiParfaite: false });
    expect((await jour(t, 1)).joueur.aujourdhuiParfaite).toBe(false);
    t.clock.now = parisDayStart(T + 1) + 60_000; // 00 h 01
    await joueur(t, 1, { track: [T + 1] });
    expect((await jour(t, 1)).joueur).toMatchObject({ jeuxDuJour: ["track"], aujourdhuiParfaite: true });
    expect((await lignes(t, 1)).map((l) => l.du)).toEqual([T - 4, T + 1]);
  });

  it("basculer une étoile puis la remettre le même jour ne laisse aucune ligne", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    await epingler(t, 1, ["track"]);
    expect(await lignes(t, 1)).toHaveLength(1);
    const r = await epingler(t, 1, []);
    expect(r.body).toMatchObject({ favoris: null, jeuxDuJour: ["track", "jump"] }); // plus rien en attente : comme avant d'avoir choisi
    expect(await lignes(t, 1)).toEqual([]);
    expect((await jour(t, 1)).joueur.favoris).toBeNull();
    // Plusieurs changements dans la journée n'écrivent qu'une ligne (celle de demain), la dernière.
    await epingler(t, 1, ["jump"]);
    await epingler(t, 1, ["track", "jump"]);
    await epingler(t, 1, ["track"]);
    expect(await lignes(t, 1)).toEqual([{ du: T + 1, jeux: '["track"]' }]);
  });

  it("la série à cheval sur un changement : chaque jour est jugé avec la liste qui était la sienne", async () => {
    const t = await portail();
    // Jump les deux premiers jours, Track ensuite : avec tous les jeux la série est continue.
    await joueur(t, 1, { jump: [T - 3, T - 2], track: [T - 1, T] });
    expect((await jour(t, 1)).joueur.serie).toBe(4);
    await epingler(t, 1, ["track"]); // compte dès demain
    expect((await jour(t, 1)).joueur.serie).toBe(4); // aujourd'hui, rien ne bouge
    avancer(t, 1);
    await joueur(t, 1, { track: [T + 1] });
    // Les jours où il ne jouait que Jump comptent toujours : ils étaient jugés sur tous les jeux. Appliquée en arrière, la liste actuelle casserait la série à 3.
    expect((await jour(t, 1)).joueur).toMatchObject({ serie: 5, journeesParfaites: 1 });
    // Un jour sans Track après le changement la casse : le jeu de Jump seul ne suffit plus.
    avancer(t, 3);
    await joueur(t, 1, { jump: [T + 2, T + 3] });
    const apres = await jour(t, 1);
    expect(apres.joueur.serie).toBe(0);
    expect(apres.joueur.aProlonger).toBe(false);
  });

  it("un joueur dont le profil est créé aujourd'hui : son premier choix compte tout de suite", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] }, midi(T) - 3_600_000); // créé ce matin, première visite
    const r = await epingler(t, 1, ["track"]);
    expect(r.body).toMatchObject({ effetLe: formatDay(T), jeuxDuJour: ["track"], aujourdhuiParfaite: true });
    expect((await jour(t, 1)).joueur).toMatchObject({ jeuxDuJour: ["track"], aujourdhuiParfaite: true });
    // La veille, ce joueur n'existait pas : ses changements suivants, eux, comptent dès le lendemain.
    avancer(t, 1);
    const r2 = await epingler(t, 1, ["track", "jump"]);
    expect(r2.body).toMatchObject({ effetLe: formatDay(T + 2) });
  });

  it("le classement du jour ne change pas", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    const avant = JSON.stringify((await t.call("GET", "/api/portail/classement", undefined, as(1))).body);
    await epingler(t, 1, ["jump"]);
    avancer(t, 1);
    await epingler(t, 1, ["track"]);
    t.clock.now = midi(T);
    expect(JSON.stringify((await t.call("GET", "/api/portail/classement", undefined, as(1))).body)).toBe(avant);
  });
});

describe(`Mes jeux : un jeu éteint, un jeu nouveau (${TEST_DB})`, () => {
  /** Éteint Jump à partir de `au` (la période `[0, au[`), puis laisse la liste des jeux se relire (30 s). */
  async function eteindre(t: T, au: number) {
    await t.db.run("UPDATE jeux SET etat = 'off', live_from = 0, periodes = ? WHERE jeu = 'jump'", [JSON.stringify([[0, au]])]);
    t.clock.now += 31_000;
  }

  it("un favori qui repasse à off disparaît sans message, ne compte plus dès demain, et revient avec le jeu", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T - 1, T], jump: [T - 1] });
    t.clock.now = midi(T - 5);
    await epingler(t, 1, ["jump"]); // son seul favori : Jump (compte dès T - 4)
    t.clock.now = midi(T);
    expect((await jour(t, 1)).joueur).toMatchObject({ favoris: ["jump"], jeuxDuJour: ["jump"], aujourdhuiParfaite: false });
    await eteindre(t, T + 1);
    // Aujourd'hui : l'accueil n'a déjà plus Jump (jeux[]), la liste choisie le garde.
    const auj = await jour(t, 1);
    expect(auj.jeux.map((x) => x.site)).toEqual(["track"]);
    expect(auj.joueur.favoris).toEqual(["jump"]);
    expect(auj.joueur.jeuxDuJour).toEqual([]); // le client retombe sur tous les jeux affichés
    // Demain : plus aucun favori ne compte, ses jeux sont tous les jeux qui comptent (Track) : la journée se joue sur Track.
    avancer(t, 1);
    await joueur(t, 1, { track: [T + 1] });
    const demain = await jour(t, 1);
    expect(demain.joueur.jeuxDuJour).toEqual(["track"]);
    expect(demain.joueur.aujourdhuiParfaite).toBe(true);
    // Demander une liste sans Jump ne le retire pas de ses favoris (il est éteint : il n'est pas à l'écran, il est gardé)…
    const r = await epingler(t, 1, ["track"]);
    expect(r.body).toMatchObject({ favoris: ["track", "jump"] });
    // … et on ne peut pas épingler un jeu éteint qu'on n'avait pas.
    const r2 = await epingler(t, 1, ["track", "jump"]);
    expect(r2.body).toMatchObject({ favoris: ["track", "jump"] });
    // Il revient avec le jeu : Jump rouvert, ses favoris le comptent de nouveau.
    await t.db.run("UPDATE jeux SET etat = 'on', live_from = ?, periodes = ? WHERE jeu = 'jump'", [T + 4, JSON.stringify([[0, T + 1], [T + 4, null]])]);
    t.clock.now += 31_000;
    avancer(t, 5);
    const retour = await jour(t, 1);
    expect(retour.jeux.map((x) => x.site)).toEqual(["track", "jump"]);
    expect(retour.joueur.jeuxDuJour).toEqual(["track", "jump"]);
  });

  it("épingler un jeu éteint est écarté : seuls les jeux ouverts s'épinglent", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    await eteindre(t, T + 1);
    const r = await epingler(t, 1, ["jump"]);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ favoris: null });
    expect(await lignes(t, 1)).toEqual([]);
  });

  it("un jeu ouvert depuis moins de 7 jours porte `nouveau`, pas les jeux d'avant l'interrupteur", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    // Jump a été (ré)ouvert hier : sa période commence aujourd'hui.
    await t.db.run("UPDATE jeux SET live_from = ?, periodes = ? WHERE jeu = 'jump'", [T, JSON.stringify([[T, null]])]);
    t.clock.now += 31_000;
    const anonyme = (await t.call("GET", "/api/portail/jour", undefined, { clientKey: "198.51.100.11" })).body as { jeux: { site: string; nouveau?: true }[] };
    expect(anonyme.jeux.find((j) => j.site === "jump")?.nouveau).toBe(true);
    expect(anonyme.jeux.find((j) => j.site === "track")?.nouveau).toBeUndefined();
    avancer(t, 5);
    expect((await jour(t, 1)).jeux.find((j) => j.site === "jump")?.nouveau).toBe(true);
    avancer(t, 6);
    expect((await jour(t, 1)).jeux.find((j) => j.site === "jump")?.nouveau).toBeUndefined();
  });
});

describe(`Mes jeux : le profil suit le joueur (${TEST_DB})`, () => {
  it("« Changer mon code » : les jeux épinglés suivent le joueur", async () => {
    const t = await portail();
    await joueur(t, 1, { track: [T] });
    await epingler(t, 1, ["jump"]);
    const nouveau = playerId(500);
    expect((await t.call("POST", "/api/me/code", { newId: nouveau }, as(1))).status).toBe(200);
    expect(await t.db.all("SELECT 1 AS n FROM favoris_jeux WHERE player_id = ?", [playerId(1)])).toEqual([]);
    const j = (await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": nouveau }, clientKey: "198.51.100.12" })).body as { joueur: { favoris: string[] } };
    expect(j.joueur.favoris).toEqual(["jump"]);
  });

  it("l'effacement d'un joueur emporte ses jeux épinglés", async () => {
    const t = await portail({ adminToken: TOKEN });
    const id = await joueur(t, 1, { track: [T] });
    await joueur(t, 2, { track: [T] });
    await epingler(t, 1, ["jump"]);
    await epingler(t, 2, ["track"], "198.51.100.13");
    const code = `CDJ2.${id}.${crc32Hex(new TextEncoder().encode(id))}`;
    expect((await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await lignes(t, 1)).toEqual([]);
    expect(await lignes(t, 2)).toHaveLength(1);
  });

  it("la remise à zéro du lancement vide la table", async () => {
    const { TABLES_VIDEES } = await import("../src/remiseAZero");
    expect(Object.keys(TABLES_VIDEES)).toContain("favoris_jeux");
  });
});
