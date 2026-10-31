import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { TICK_RATE } from "@cdj/jump-sim";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, ouvrirJeu, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";
import { refOfPlayer } from "../src/players";

// Lot TP — Tower sur la plateforme : un jeu classé à la **hauteur** (`score: { unite: "mm", valeur, vies }`) à côté de deux jeux classés au temps. Le portail le montre (cartouche : numéro, thème,
// seuils en mm ; état du joueur avec son score), le classement du jour lui donne **sa vue** et ne le met jamais dans le cumul au temps, la journée le compte (série, journée parfaite) à partir de son
// `live_from`, et l'administration le connaît (fiche d'un joueur, retirer, masquer, tableau). Les parties sont écrites directement en base (le rejeu est testé par `towerEnvoi.test.ts`) ; la lecture,
// elle, est la vraie. SQLite et libSQL (`file:`), jamais Turso.

const JOUR = PREMIER_JOUR_TOWER + 8; // une semaine après la première tour
const DATE = formatDay(JOUR);
const MIDI = parisDayStart(JOUR) + 12 * 3_600_000;
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const ORIGIN = "http://api.test";
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true };
const confirmer = { confirmer: true };

async function api(options: Parameters<typeof makeApi>[0] = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, ...options });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track");
  await ouvrirJeu(t, "jump");
  await ouvrirJeu(t, "tower", JOUR - 3);
  return t;
}

async function joueur(t: TestApi, n: number, nom: string): Promise<string> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [id, nom, nom.toLowerCase(), (await refOfPlayer(id)) as string]);
  return id;
}
/** Une partie de Tower écrite en base : hauteur (mm), vies, ticks, médaille, instant d'envoi. */
async function partie(t: TestApi, n: number, h: number, vies: number, ticks: number, medal: string | null = null, at = 1000 + n, jour = JOUR, extra: { hidden?: number; apercu?: number } = {}): Promise<void> {
  await t.db.run(
    "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'x', 3, 3, ?, ?, ?, ?, ?)",
    [jour, playerId(n), h, h, vies, ticks, medal, at, at, `h${n}-${jour}`, extra.hidden ?? 0, extra.apercu ?? 0],
  );
}
async function track(t: TestApi, n: number, ms: number, jour = JOUR): Promise<void> {
  await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [jour, playerId(n), ms, 1000 + n]);
}
async function jump(t: TestApi, n: number, ticks: number, jour = JOUR): Promise<void> {
  await t.db.run(
    "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, 'x', ?, 0, 'x', 1, 1, 0, ?)",
    [jour, playerId(n), ticks, 1000 + n],
  );
}

describe(`Tower sur le portail : un jeu classé à la hauteur (${TEST_DB})`, () => {
  it("la journée liste Tower avec son unité et ses seuils en mm ; Track et Jump gardent exactement leur forme (aucun champ `unite`, aucun `score`)", async () => {
    const t = await api();
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.status).toBe(200);
    const jeux = r.body.jeux as Record<string, unknown>[];
    expect(jeux.map((j) => j.jeu)).toEqual(["cdj", "jump", "tower"]);
    const tower = jeux[2]!;
    expect(tower).toMatchObject({ jeu: "tower", site: "tower", nom: "Tower", unite: "mm", compte: true });
    expect(tower.numero).toBe(JOUR - PREMIER_JOUR_TOWER + 1);
    const seuils = tower.seuils as Record<string, number>;
    expect(Object.keys(seuils).sort()).toEqual(["author", "bronze", "gold", "silver"]);
    expect(seuils.author).toBeGreaterThan(seuils.gold!);
    expect(seuils.gold).toBeGreaterThan(seuils.silver!);
    expect(seuils.silver).toBeGreaterThan(seuils.bronze!);
    for (const j of [jeux[0]!, jeux[1]!]) expect("unite" in j).toBe(false);
  });

  it("l'état du joueur : fini avec son score (hauteur, vies), son rang et la médaille ; pas_joue sinon ; le cumul au temps l'ignore", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bruno"], [3, "Chloé"]] as const) await joueur(t, n, nom);
    await partie(t, 1, 30_000, 2, 3000, "gold");
    await partie(t, 2, 42_700, 1, 3500, "author");
    await track(t, 1, 60_000);
    await jump(t, 1, 2400);
    const alice = await t.call("GET", "/api/portail/jour", undefined, as(1));
    const etat = alice.body.jeux.find((j: { jeu: string }) => j.jeu === "tower").etat;
    expect(etat).toMatchObject({ statut: "fini", medaille: "gold", rang: 2, classes: 2, score: { unite: "mm", valeur: 30_000, vies: 2 } });
    expect(etat.tempsMs).toBe(Math.round((3000 * 1000) / 60));
    // Les états de Track et de Jump n'ont pas de `score`.
    for (const code of ["cdj", "jump"]) expect("score" in alice.body.jeux.find((j: { jeu: string }) => j.jeu === code).etat).toBe(false);
    // Le cumul au temps = Track + Jump seulement : Alice (deux jeux finis) a un cumul, la hauteur n'y entre pas.
    expect(alice.body.joueur.cumulMs).toBe(60_000 + Math.round((2400 * 1000) / TICK_RATE));
    // Bruno n'a joué que Tower : il n'est pas dans le cumul au temps (aucun cumul, aucune place).
    const bruno = await t.call("GET", "/api/portail/jour", undefined, as(2));
    expect(bruno.body.joueur.cumulMs).toBeNull();
    expect(bruno.body.joueur.rangDuJour).toBeNull();
    expect(bruno.body.jeux.find((j: { jeu: string }) => j.jeu === "tower").etat.statut).toBe("fini");
    expect((await t.call("GET", "/api/portail/jour", undefined, as(3))).body.jeux.find((j: { jeu: string }) => j.jeu === "tower").etat).toEqual({ statut: "pas_joue" });
  });

  it("le classement du jour : le cumul n'a que les jeux au temps ; la vue `tower` classe à la hauteur, puis aux vies, puis au temps, avec le score de chaque ligne", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bruno"], [3, "Chloé"], [4, "Dan"]] as const) await joueur(t, n, nom);
    await partie(t, 1, 30_000, 2, 3000, "gold", 1001);
    await partie(t, 2, 42_700, 1, 3500, "author", 1002);
    await partie(t, 3, 30_000, 3, 4000, "gold", 1003); // même hauteur qu'Alice, plus de vies : devant elle
    await partie(t, 4, 30_000, 2, 2500, null, 1004); // même hauteur et mêmes vies qu'Alice, plus rapide : devant elle
    await track(t, 1, 60_000);
    await jump(t, 1, 2400);
    const cumul = await t.call("GET", "/api/portail/classement");
    expect(cumul.status).toBe(200);
    expect(cumul.body.jeux.map((j: { jeu: string; unite?: string }) => [j.jeu, j.unite])).toEqual([["cdj", undefined], ["jump", undefined], ["tower", "mm"]]);
    expect(cumul.body.top.map((l: { pseudo: string }) => l.pseudo)).toEqual(["Alice"]); // les joueurs de Tower seul ne sont pas au cumul
    expect(Object.keys(cumul.body.top[0].resultats)).toEqual(["cdj", "jump"]);
    expect("unite" in cumul.body).toBe(false);
    expect("score" in cumul.body.top[0]).toBe(false);

    const v = await t.call("GET", "/api/portail/classement?vue=tower");
    expect(v.status).toBe(200);
    expect(v.body.unite).toBe("mm");
    expect(v.body.classes).toBe(4);
    expect(v.body.top.map((l: { rang: number; pseudo: string; score: { valeur: number; vies: number } }) => [l.rang, l.pseudo, l.score.valeur, l.score.vies])).toEqual([
      [1, "Bruno", 42_700, 1],
      [2, "Chloé", 30_000, 3],
      [3, "Dan", 30_000, 2],
      [4, "Alice", 30_000, 2],
    ]);
    expect(v.body.top[0].resultats.tower).toMatchObject({ rang: 1, medaille: "author", score: { unite: "mm", valeur: 42_700, vies: 1 } });
    // Ta ligne, exacte, avec ton score.
    const moi = await t.call("GET", "/api/portail/classement?vue=tower", undefined, as(1));
    expect(moi.body.moi).toMatchObject({ rang: 4, pseudo: "Alice", classes: 4, score: { unite: "mm", valeur: 30_000, vies: 2 } });
    expect(moi.body.top[3].moi).toBe(true);
    // Un joueur de Track seul n'a pas de ligne dans la vue de Tower.
    await joueur(t, 5, "Eve");
    await track(t, 5, 61_000);
    expect((await t.call("GET", "/api/portail/classement?vue=tower", undefined, as(5))).body.moi).toBeNull();
    // Les autres vues ne changent pas de forme.
    const vt = await t.call("GET", "/api/portail/classement?vue=track");
    expect("unite" in vt.body).toBe(false);
    expect((await t.call("GET", "/api/portail/classement?vue=lune")).body).toEqual({ error: "invalid_view" });
  });

  it("un joueur masqué n'est dans aucune vue des autres ; le joueur lui-même se voit (sa ligne), et une partie d'aperçu n'est dans aucun classement", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bruno"]] as const) await joueur(t, n, nom);
    await partie(t, 1, 30_000, 2, 3000, null, 1001, JOUR, { hidden: 1 });
    await partie(t, 2, 20_000, 2, 3000, null, 1002);
    const v = await t.call("GET", "/api/portail/classement?vue=tower");
    expect(v.body.top.map((l: { pseudo: string }) => l.pseudo)).toEqual(["Bruno"]);
    const lui = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(lui.body.jeux.find((j: { jeu: string }) => j.jeu === "tower").etat.statut).toBe("fini");
  });

  it("la journée parfaite et la série comptent Tower (à partir de son `live_from`), jamais le cumul", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    for (const n of [1, 2]) {
      await track(t, n, 60_000);
      await jump(t, n, 2400);
    }
    await partie(t, 1, 30_000, 2, 3000); // Alice a fini les trois jeux, Bruno deux
    const a = await t.call("GET", "/api/portail/jour", undefined, as(1));
    const b = await t.call("GET", "/api/portail/jour", undefined, as(2));
    expect(a.body.joueur).toMatchObject({ aujourdhuiParfaite: true, journeesParfaites: 1, serie: 1 });
    expect(b.body.joueur).toMatchObject({ aujourdhuiParfaite: false, journeesParfaites: 0, serie: 1 });
    // Un joueur qui n'a fini que Tower a une série de 1 (un jeu fini suffit).
    await joueur(t, 3, "Chloé");
    await partie(t, 3, 12_000, 1, 3000);
    expect((await t.call("GET", "/api/portail/jour", undefined, as(3))).body.joueur).toMatchObject({ serie: 1, aujourdhuiParfaite: false });
    // Le jour de l'activation, Tower est présent mais ne compte pas : la journée parfaite n'exige pas Tower.
    const neuf = await makeApi({ seed: false });
    neuf.clock.now = MIDI;
    await neuf.call("GET", "/api/health");
    await ouvrirJeu(neuf, "track");
    await ouvrirJeu(neuf, "jump");
    await ouvrirJeu(neuf, "tower", JOUR + 1); // il comptera demain
    await joueur(neuf, 1, "Alice");
    await track(neuf, 1, 60_000);
    await jump(neuf, 1, 2400);
    const jour = await neuf.call("GET", "/api/portail/jour", undefined, as(1));
    expect(jour.body.jeux.find((j: { jeu: string }) => j.jeu === "tower").compte).toBe(false);
    expect(jour.body.joueur.aujourdhuiParfaite).toBe(true);
  });

  it("le profil commun : jours finis, médailles et meilleure place de Tower", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await partie(t, 1, 30_000, 2, 3000, "gold");
    await partie(t, 2, 40_000, 2, 3000, "silver");
    await partie(t, 1, 10_000, 1, 3000, "bronze", 1001, JOUR - 1);
    const p = await t.call("GET", "/api/portail/profil", undefined, as(1));
    const tower = p.body.jeux.find((j: { jeu: string }) => j.jeu === "tower");
    expect(tower).toEqual({ jeu: "tower", joursFinis: 2, medailles: { author: 0, gold: 1, silver: 0, bronze: 1 }, meilleurRang: { date: formatDay(JOUR - 1), rang: 1, classes: 1 } });
  });
});

describe(`Tower dans l'administration (${TEST_DB})`, () => {
  async function panneau() {
    const t = await api({ admin: OPTIONS_ADMIN });
    const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
    const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
    const adm = (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers });
    return { t, adm };
  }

  it("la fiche d'un joueur montre ses parties de Tower (hauteur, vies, rang) ; retirer et masquer les sortent des classements ; le tableau les compte", async () => {
    const { t, adm } = await panneau();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await partie(t, 1, 42_700, 1, 3500, "author");
    await partie(t, 2, 30_000, 2, 3000, "gold");
    const ref1 = await refOfPlayer(playerId(1));
    const fiche = (await adm("GET", `/api/admin/joueurs/${ref1}`)).body;
    const tower = fiche.resultats.find((j: { jeu: string }) => j.jeu === "tower");
    expect(tower).toMatchObject({ jeu: "tower", nom: "Tower", jours: 1 });
    expect(tower.resultats[0]).toMatchObject({ date: DATE, medaille: "author", rang: 1, classes: 2, score: { unite: "mm", valeur: 42_700, vies: 1 } });
    // Track et Jump : la ligne n'a pas de `score`.
    expect(fiche.resultats.filter((j: { jeu: string }) => j.jeu !== "tower").every((j: { resultats: object[] }) => j.resultats.every((x) => !("score" in x)))).toBe(true);

    const tab = (await adm("GET", "/api/admin/tableau")).body;
    expect(tab.chiffres.tower).toEqual({ finis: 2 });
    expect(tab.chiffres.joueursAujourdhui).toBe(2);

    // Masquer Alice : elle sort de la vue de Tower ; elle se voit toujours.
    expect((await adm("POST", `/api/admin/joueurs/${ref1}/masquer`, { masque: true, ...confirmer })).status).toBe(200);
    t.clock.now += 60_000;
    await t.call("GET", "/api/health");
    const v = await t.call("GET", "/api/portail/classement?vue=tower");
    expect(v.body.top.map((l: { pseudo: string }) => l.pseudo)).toEqual(["Bruno"]);
    expect((await t.call("GET", "/api/portail/jour", undefined, as(1))).body.jeux.find((j: { jeu: string }) => j.jeu === "tower").etat.statut).toBe("fini");
    expect((await adm("POST", `/api/admin/joueurs/${ref1}/masquer`, { masque: false, ...confirmer })).status).toBe(200);
    expect((await t.db.first<{ hidden: number }>("SELECT hidden FROM tower_results WHERE player_id = ?", [playerId(1)]))!.hidden).toBe(0);

    // Retirer : la ligne part dans resultats_retires (jeu `tower`), la même partie ne revient pas (copie).
    const r = await adm("POST", `/api/admin/joueurs/${ref1}/retirer`, { jeu: "tower", date: DATE, motif: "hauteur impossible", ...confirmer });
    expect(r.body).toEqual({ retire: true, rediffusionGardeeJours: 30 });
    expect(await t.db.all("SELECT 1 FROM tower_results WHERE player_id = ?", [playerId(1)])).toEqual([]);
    expect(await t.db.first<{ game: string }>("SELECT game FROM resultats_retires WHERE player_id = ?", [playerId(1)])).toEqual({ game: "tower" });
  });

  it("Nathan passe Tower en `preview` et génère la clé d'aperçu alors que Tower n'a aucune ligne dans `jeux` (absent = off)", async () => {
    const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
    await t.call("GET", "/api/health");
    t.clock.now = MIDI;
    const r0 = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    const cookie = /__session=([^;]+)/.exec(r0.headers.get("set-cookie") ?? "")![1]!;
    const adm = (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers: { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    expect(await t.db.all("SELECT 1 FROM jeux WHERE jeu = 'tower'")).toEqual([]); // ni semé ni écrit : off
    expect((await t.call("GET", `/api/tower/info`)).body).toEqual({ error: "game_unavailable" });
    const liste = (await adm("GET", "/api/admin/jeux")).body.jeux as { jeu: string; etat: string }[];
    expect(liste.find((j) => j.jeu === "tower")).toMatchObject({ etat: "off" });
    expect((await adm("POST", "/api/admin/jeux/tower/etat", { etat: "preview", ...confirmer })).status).toBe(200);
    const cle = await adm("POST", "/api/admin/jeux/tower/cle", { ...confirmer });
    expect(cle.status).toBe(200);
    const valeur = (cle.body as { cle: string }).cle;
    expect(typeof valeur).toBe("string");
    // Sans clé : fermé ; avec la clé : ouvert (l'état se relit au plus toutes les 30 s ; la même instance l'a relu tout de suite).
    expect((await t.call("GET", "/api/tower/info")).body).toEqual({ error: "game_unavailable" });
    expect((await t.call("GET", "/api/tower/info", undefined, { headers: { "X-Preview-Key": valeur } })).status).toBe(200);
    expect(daysFromCivil(2026, 11, 2)).toBe(PREMIER_JOUR_TOWER); // la date provisoire du lot T4 (Nathan la règle au passage à `on`)
  });
});
