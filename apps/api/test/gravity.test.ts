import { daysFromCivil, formatDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, DUREE_MAX_TICKS, MAX_APPUIS, dailyGravity, enregistrer, figerJour, jouer, scoreParColonnes, seuilsDe, seuilsSurLePapier, terrainDuJour, themeDuJour } from "@cdj/gravity-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_GRAVITY } from "../scripts/gravity-essais";
import { contenuDeGravity } from "../src/gravity";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot GR1 — « Gravity » sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), **rejoue la liste des appuis jusqu'à la mort ou aux dix minutes**,
// classe au score du plus grand au plus petit (puis la durée), refuse les copies et les rediffusions abîmées ou trop longues, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le jour figé de l'image
// (ses seuils comptent, jamais ceux du calcul). SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { gravity: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "gravity");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/gravity/submit", { replay: ESSAIS_GRAVITY.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Gravity sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu) : seuils, thème, jamais de preuve", async () => {
    const t = await monter();
    const c = dailyGravity(JOUR);
    const info = await t.call("GET", "/api/gravity/info");
    expect(info.body).toMatchObject({ game: "gravity", simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION, today: DATE });
    const jour = await t.call("GET", `/api/gravity/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.medals).toEqual(seuilsDe(c));
    expect(jour.body.medals).toEqual(seuilsSurLePapier(c)); // sans fichier de jour : le calcul provisoire
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/gravity/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche (le score du plus grand au plus petit) et garde le résultat du serveur", async () => {
    const t = await monter();
    const parties = [[1, 4], [2, 0], [3, 9]] as const;
    const attendus = parties.map(([, v]) => ESSAIS_GRAVITY.partie(JOUR, VERSIONS, v).attendu);
    for (const [i, [n, v]] of parties.entries()) {
      const r = await envoyer(t, n, v);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.score).toEqual(attendus[i]);
    }
    const board = await t.call("GET", `/api/gravity/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string; score: number; ticks: number; medal: string | null })[];
    const attendu = parties.map(([n], i) => ({ n: `Joueur${n}`, score: attendus[i]!.score!, ticks: attendus[i]!.ticks! })).sort((a, b) => b.score - a.score || a.ticks - b.ticks);
    expect(lignes.map((l) => l.name)).toEqual(attendu.map((x) => x.n));
    for (let i = 1; i < lignes.length; i++) expect(lignes[i - 1]!.score).toBeGreaterThanOrEqual(lignes[i]!.score);
    expect(board.body.me).toMatchObject({ name: "Joueur3" });
  });

  it("à score égal, la partie la plus courte (le moins de pas) passe devant (le départage de la fiche)", async () => {
    // Deux parties qui meurent au même endroit à des pas différents sont impossibles : on compare les colonnes que le serveur range.
    const t = await monter();
    const c = dailyGravity(JOUR);
    const a = jouer(terrainDuJour(c), []);
    const b = jouer(terrainDuJour(c), [20]);
    expect(a.score).not.toBe(b.score); // (garde-fou : deux parties différentes)
    await t.call("POST", "/api/gravity/submit", { replay: enregistrer(c, []), name: "Immobile" }, { headers: entete(1) });
    await t.call("POST", "/api/gravity/submit", { replay: enregistrer(c, [20]), name: "Un appui" }, { headers: entete(2) });
    const board = await t.call("GET", `/api/gravity/day/${DATE}/board`);
    const noms = (board.body.top as { name: string }[]).map((l) => l.name);
    expect(noms).toEqual(a.score >= b.score ? ["Immobile", "Un appui"] : ["Un appui", "Immobile"]);
    const cles = await t.db.all<{ cle1: number; cle2: number }>("SELECT cle1, cle2 FROM resultats_jeu WHERE jeu = 'gravity' ORDER BY cle1, cle2");
    expect(cles.map((x) => x.cle1)).toEqual([...cles.map((x) => x.cle1)].sort((x, y) => x - y)); // cle1 = −score : croissant
  });

  it("refuse les copies (deux fois les mêmes appuis), les rediffusions illisibles, trafiquées, trop longues et les autres jours", async () => {
    const t = await monter({ copies: false });
    const c = dailyGravity(JOUR);
    expect((await envoyer(t, 1, 2)).status).toBe(200);
    const copie = await envoyer(t, 2, 2);
    expect(copie.status).toBe(409);
    expect(copie.body.error).toBe("replay_copy");
    const refuse = async (n: number, replay: string, erreur: string) => expect((await t.call("POST", "/api/gravity/submit", { replay, name: `X${n}` }, { headers: entete(n) })).body.error, `${n}`).toBe(erreur);
    await refuse(4, "pas-une-rediffusion", "invalid_replay");
    await refuse(5, "A".repeat(20000), "invalid_replay"); // trop de caractères
    const bon = enregistrer(c, [30, 200]);
    await refuse(6, bon.slice(0, bon.length - 2), "invalid_replay"); // tronquée
    await refuse(7, bon.replace(/.$/, "!"), "invalid_replay"); // un caractère hors alphabet
    const trop = Array.from({ length: MAX_APPUIS + 1 }, (_, i) => i * 3 + 5);
    await refuse(8, enregistrer(c, trop), "invalid_replay"); // trop d'appuis
    await refuse(9, enregistrer(c, [DUREE_MAX_TICKS + 5]), "invalid_replay"); // un appui après les dix minutes
    expect((await t.call("POST", "/api/gravity/submit", { replay: enregistrer(dailyGravity(JOUR - 1), []), name: "Hier" }, { headers: entete(10) })).status).toBe(409);
    expect((await t.call("POST", "/api/gravity/submit", { name: "Sans" }, { headers: entete(11) })).status).toBeGreaterThanOrEqual(400);
  });

  it("le score vient du seul rejeu : une rediffusion ne peut pas annoncer mieux que ce qu'elle joue", async () => {
    const t = await monter();
    const c = dailyGravity(JOUR);
    const replay = enregistrer(c, [30, 200]);
    const r = await t.call("POST", "/api/gravity/submit", { replay, name: "Menteur", score: 999999, ticks: 1 }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(terrainDuJour(c), [30, 200])));
  });

  it("une partie vide est rejouée jusqu'à sa mort, classée la dernière", async () => {
    const t = await monter();
    const c = dailyGravity(JOUR);
    await envoyer(t, 2, 3);
    const r = await t.call("POST", "/api/gravity/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(terrainDuJour(c), [])));
    const board = await t.call("GET", `/api/gravity/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).at(-1)!.name).toBe("Rêveur");
  });

  it("lit le jour figé de l'image s'il se vérifie ; ses seuils figés l'emportent sur le calcul ; un fichier abîmé est ignoré", async () => {
    const fige = figerJour(JOUR, { bronze: 111, silver: 222, gold: 333, author: 444 });
    expect(contenuDeGravity(JOUR, { [DATE]: fige }).seuilsFiges).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    const abime = { ...fige, contenu: { ...fige.contenu, empreinte: "00000000" } };
    expect(contenuDeGravity(JOUR, { [DATE]: abime }).seuilsFiges).toBeUndefined();
    const t = await monter({ frozen: { [DATE]: fige } });
    expect((await t.call("GET", "/api/gravity/info")).body.frozenDays).toEqual([DATE]);
    expect((await t.call("GET", `/api/gravity/day/${DATE}`)).body.medals).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    const r = await envoyer(t, 1, 0);
    expect(r.body.medal).toBe("author"); // 444 points suffisent au Diamant figé
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/gravity/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/gravity/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    t.clock.now = MIDI;
    await t.call("GET", "/api/health");
    const rep = ESSAIS_GRAVITY.partie(JOUR, VERSIONS, 2).rediffusion;
    expect((await t.call("POST", "/api/gravity/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/gravity/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'gravity' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/gravity/day/${DATE}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'gravity'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/gravity/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
  });

  it("« Mon groupe » : les membres du groupe seulement, le joueur d'un autre groupe n'y figure pas", { timeout: 30_000 }, async () => {
    const t = await monter();
    const appel = (n: number, methode: "GET" | "POST", chemin: string, corps?: unknown) => t.call(methode, chemin, corps, { headers: entete(n), clientKey: `10.0.0.${n}` });
    for (const n of [1, 2, 3]) await envoyer(t, n, n * 3);
    const g = await appel(1, "POST", "/api/groupes", { nom: "Les Tireurs" });
    expect(g.status, JSON.stringify(g.body)).toBe(200);
    const moi = (await appel(1, "GET", "/api/groupes/moi")).body.groupe;
    expect((await appel(2, "POST", "/api/groupes/rejoindre", { jeton: moi.invitation })).status).toBe(200);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [JOUR - 1, g.body.id]);
    const r = await appel(2, "GET", `/api/gravity/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});
