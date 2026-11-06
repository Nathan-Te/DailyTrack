import { daysFromCivil, formatDay } from "@cdj/core";
import { DUREE_TICKS, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, VARIANTE, dailyRush, empreinteContenu, enregistrer, figerJour, jouer, scoreParColonnes, seuilsDe, themeDuJour, entreesDuBot } from "@cdj/rush-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_RUSH } from "../scripts/rush-essais";
import { contenuDeRush } from "../src/rush";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot BR0 — « Rush » (prototype de boss rush) sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), rejoue, classe au temps de la chute du golem
// (colonne de la fiche), refuse les copies et les rediffusions abîmées, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le jour figé de l'image. SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const PREMIERE = VARIANTE.fiche.colonnes[0]!;
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { rush: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "rush");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/rush/submit", { replay: ESSAIS_RUSH.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Rush sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu), jamais la preuve", async () => {
    const t = await monter();
    const c = dailyRush(JOUR);
    const info = await t.call("GET", "/api/rush/info");
    expect(info.body).toMatchObject({ game: "rush", simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION, today: DATE });
    const jour = await t.call("GET", `/api/rush/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.medals).toEqual(seuilsDe(c));
    expect(jour.body.medals.author).toBe(VARIANTE.seuils(jouer(c, entreesDuBot(c).changements, undefined, entreesDuBot(c).choix)).author);
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/rush/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche et garde le résultat du serveur", async () => {
    const t = await monter();
    for (const [n, v] of [[1, 3], [2, 0], [3, 9]] as const) {
      const attendu = ESSAIS_RUSH.partie(JOUR, VERSIONS, v).attendu;
      const r = await envoyer(t, n, v);
      expect(r.status).toBe(200);
      expect(r.body.score).toEqual(attendu);
    }
    const board = await t.call("GET", `/api/rush/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string; medal: string | null } & Record<string, number>)[];
    expect(lignes.map((l) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
    // La première colonne de la fiche range le classement, dans son sens.
    for (let i = 1; i < lignes.length; i++) expect(lignes[i - 1]![PREMIERE.nom]! <= lignes[i]![PREMIERE.nom]!).toBe(true); // le temps, en croissant
    expect(lignes[0]!.medal).not.toBeNull();
    expect(board.body.me).toMatchObject({ name: "Joueur3", rank: 3 });
  });

  it("une partie perdue vaut le pire temps (10 minutes) et se classe après les victoires, à égalité par ordre d'arrivée", async () => {
    const t = await monter();
    const c = dailyRush(JOUR);
    const gagne = await t.call("POST", "/api/rush/submit", { replay: ESSAIS_RUSH.partie(JOUR, VERSIONS, 0).rediffusion, name: "Vainqueur" }, { headers: entete(1) });
    const perdu = await t.call("POST", "/api/rush/submit", { replay: enregistrer(c, []), name: "Perdant" }, { headers: entete(2) });
    expect(gagne.body.score.temps).toBeLessThan(perdu.body.score.temps);
    expect(perdu.body.score).toEqual({ temps: DUREE_TICKS });
    const board = await t.call("GET", `/api/rush/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).map((l) => l.name)).toEqual(["Vainqueur", "Perdant"]);
  });

  it("refuse les copies (la partie du bot, deux fois les mêmes touches), les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    const c = dailyRush(JOUR);
    const bot = await t.call("POST", "/api/rush/submit", { replay: enregistrer(c, entreesDuBot(c).changements, entreesDuBot(c).choix), name: "Copieur" }, { headers: entete(1) });
    expect(bot.status).toBe(409);
    expect(bot.body.error).toBe("replay_copy");
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.body.error).toBe("replay_copy");
    expect((await t.call("POST", "/api/rush/submit", { replay: "pas-une-rediffusion", name: "Zéro" }, { headers: entete(4) })).body.error).toBe("invalid_replay");
    const autreJour = enregistrer(dailyRush(JOUR - 1), []);
    expect((await t.call("POST", "/api/rush/submit", { replay: autreJour, name: "Hier" }, { headers: entete(5) })).status).toBe(409);
  });

  it("valide les choix d'amélioration (lot BR2) : un choix n'est accepté qu'à un niveau gagné, au bon niveau, avec une carte qui existe ; il en manque un ou il y en a un de trop : refusé", async () => {
    const t = await monter();
    const c = dailyRush(JOUR);
    const bot = entreesDuBot(c);
    expect(bot.choix.length).toBeGreaterThanOrEqual(1);
    const poster = async (n: number, choix: typeof bot.choix) => t.call("POST", "/api/rush/submit", { replay: enregistrer(c, bot.changements, choix), name: `Joueur${n}` }, { headers: entete(n) });
    expect((await poster(1, bot.choix)).status).toBe(200);
    for (const [n, choix] of [
      [2, []], // aucun choix alors que des niveaux sont gagnés
      [3, bot.choix.slice(0, -1)], // le dernier niveau gagné n'a pas de choix
      [4, [...bot.choix, { tick: 30000, nv: bot.choix.length + 2, carte: 0 }]], // un choix sans niveau gagné
      [5, bot.choix.map((x, i) => (i === 0 ? { ...x, nv: x.nv + 1 } : x))], // le mauvais niveau
    ] as const) {
      const r = await poster(n, [...choix]);
      expect(r.status, `joueur ${n}`).toBe(400);
      expect(r.body.error).toBe("invalid_replay");
    }
    // une autre carte valable est acceptée (c'est une autre partie, pas une erreur)
    expect((await poster(6, bot.choix.map((x, i) => (i === 0 ? { ...x, carte: (x.carte + 1) % 3 } : x)))).status).toBe(200);
  });

  it("une partie vide est classée la dernière, sans médaille", async () => {
    const t = await monter();
    const c = dailyRush(JOUR);
    const r = await t.call("POST", "/api/rush/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(c, [])));
    expect(r.body.medal).toBeNull();
  });

  it("lit le jour figé de l'image s'il se vérifie, l'ignore sinon", async () => {
    const fige = figerJour(JOUR);
    expect(contenuDeRush(JOUR, { [DATE]: fige })).toEqual(dailyRush(JOUR));
    const abime = { ...fige, contenu: { graine: fige.contenu.graine + 1 } };
    expect(empreinteContenu(contenuDeRush(JOUR, { [DATE]: abime }))).toBe(empreinteContenu(dailyRush(JOUR)));
    const t = await monter({ frozen: { [DATE]: fige } });
    const info = await t.call("GET", "/api/rush/info");
    expect(info.body.frozenDays).toEqual([DATE]);
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/rush/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/rush/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    t.clock.now = MIDI;
    await t.call("GET", "/api/health");
    const rep = ESSAIS_RUSH.partie(JOUR, VERSIONS, 2).rediffusion;
    expect((await t.call("POST", "/api/rush/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/rush/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'rush' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/rush/day/${DATE}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("arcade : Rush a sa vue au temps, mais ne fait jamais le cumul du jour (smoke de la recette du 06/11/2026 : « 666496 ms cumulées »)", async () => {
    const t = await monter();
    expect((await envoyer(t, 1, 3)).status).toBe(200);
    const portail = await t.call("GET", "/api/portail/jour", undefined, { headers: entete(1) });
    expect(portail.status, JSON.stringify(portail.body)).toBe(200);
    // Rien fini hors Rush : ni cumul, ni place au cumul (avant, le temps de Rush y entrait).
    expect(portail.body.joueur).toMatchObject({ cumulMs: null, rangDuJour: null, classesDuJour: null });
    const cumul = await t.call("GET", "/api/portail/classement", undefined, { headers: entete(1) });
    expect(cumul.status, JSON.stringify(cumul.body)).toBe(200);
    expect(cumul.body.top).toEqual([]);
    expect(cumul.body.moi ?? null).toBeNull();
    // Sa vue à lui existe, avec le joueur.
    const vue = await t.call("GET", "/api/portail/classement?vue=rush", undefined, { headers: entete(1) });
    expect(vue.status, JSON.stringify(vue.body)).toBe(200);
    expect((vue.body.top as unknown[]).length).toBe(1);
    expect(vue.body.moi).toMatchObject({ rang: 1 });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'rush'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/rush/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
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
    const r = await appel(2, "GET", `/api/rush/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});
