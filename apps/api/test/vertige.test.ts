import { daysFromCivil, formatDay } from "@cdj/core";
import { VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, VARIANTE, dailyVertige, empreinteContenu, enregistrer, figerJour, jouer, scoreParColonnes, seuilsDe, themeDuJour, touchesDuBot } from "@cdj/vertige-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_VERTIGE } from "../scripts/vertige-essais";
import { contenuDeVertige } from "../src/vertige";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot K4f — « Vertige », le jeu témoin du kit, sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), rejoue, classe dans le sens de la fiche
// (les colonnes de la fiche : celles de la variante du jeu, `variante.ts`), refuse les copies et les rediffusions abîmées, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le jour figé de l'image.
// SQLite et libSQL (`file:`), jamais Turso. Ce test passe pour les deux variantes (score, temps) : ce qui diffère passe par `VARIANTE`.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const PREMIERE = VARIANTE.fiche.colonnes[0]!;
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { vertige: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "vertige");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/vertige/submit", { replay: ESSAIS_VERTIGE.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Vertige sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu), jamais la preuve", async () => {
    const t = await monter();
    const c = dailyVertige(JOUR);
    const info = await t.call("GET", "/api/vertige/info");
    expect(info.body).toMatchObject({ game: "vertige", simVersion: 1, generatorVersion: 1, today: DATE });
    const jour = await t.call("GET", `/api/vertige/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.medals).toEqual(seuilsDe(c));
    expect(jour.body.medals.author).toBe(VARIANTE.seuils(jouer(c, touchesDuBot(c))).author);
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/vertige/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche et garde le résultat du serveur", async () => {
    const t = await monter();
    for (const [n, v] of [[1, 3], [2, 0], [3, 9]] as const) {
      const attendu = ESSAIS_VERTIGE.partie(JOUR, VERSIONS, v).attendu;
      const r = await envoyer(t, n, v);
      expect(r.status).toBe(200);
      expect(r.body.score).toEqual(attendu);
    }
    const board = await t.call("GET", `/api/vertige/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string; medal: string | null } & Record<string, number>)[];
    expect(lignes.map((l) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
    // La première colonne de la fiche range le classement, dans son sens.
    for (let i = 1; i < lignes.length; i++) expect(PREMIERE.sens === "desc" ? lignes[i - 1]![PREMIERE.nom]! >= lignes[i]![PREMIERE.nom]! : lignes[i - 1]![PREMIERE.nom]! <= lignes[i]![PREMIERE.nom]!).toBe(true);
    expect(lignes[0]!.medal).not.toBeNull();
    expect(board.body.me).toMatchObject({ name: "Joueur3", rank: 3 });
  });

  it("à score égal, le plus rapide passe devant (le départage de la fiche)", async () => {
    const t = await monter();
    const c = dailyVertige(JOUR);
    const avecDelai = (delai: number) => enregistrer(c, VARIANTE.joueur(c, () => delai));
    await t.call("POST", "/api/vertige/submit", { replay: avecDelai(20), name: "Lent" }, { headers: entete(1) });
    await t.call("POST", "/api/vertige/submit", { replay: avecDelai(15), name: "Vif" }, { headers: entete(2) });
    const board = await t.call("GET", `/api/vertige/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).map((l) => l.name)).toEqual(["Vif", "Lent"]);
  });

  it("refuse les copies (la partie du bot, deux fois les mêmes touches), les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    const c = dailyVertige(JOUR);
    const bot = await t.call("POST", "/api/vertige/submit", { replay: enregistrer(c, touchesDuBot(c)), name: "Copieur" }, { headers: entete(1) });
    expect(bot.status).toBe(409);
    expect(bot.body.error).toBe("replay_copy");
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.body.error).toBe("replay_copy");
    expect((await t.call("POST", "/api/vertige/submit", { replay: "pas-une-rediffusion", name: "Zéro" }, { headers: entete(4) })).body.error).toBe("invalid_replay");
    const autreJour = enregistrer(dailyVertige(JOUR - 1), []);
    expect((await t.call("POST", "/api/vertige/submit", { replay: autreJour, name: "Hier" }, { headers: entete(5) })).status).toBe(409);
  });

  it("une partie vide est classée la dernière, sans médaille", async () => {
    const t = await monter();
    const c = dailyVertige(JOUR);
    const r = await t.call("POST", "/api/vertige/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(c, [])));
    expect(r.body.medal).toBeNull();
  });

  it("lit le jour figé de l'image s'il se vérifie, l'ignore sinon", async () => {
    const fige = figerJour(JOUR);
    expect(contenuDeVertige(JOUR, { [DATE]: fige })).toEqual(dailyVertige(JOUR));
    const abime = { ...fige, contenu: { vertige: fige.contenu.vertige.slice(1) } };
    expect(empreinteContenu(contenuDeVertige(JOUR, { [DATE]: abime }))).toBe(empreinteContenu(dailyVertige(JOUR)));
    const t = await monter({ frozen: { [DATE]: fige } });
    const info = await t.call("GET", "/api/vertige/info");
    expect(info.body.frozenDays).toEqual([DATE]);
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/vertige/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/vertige/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    t.clock.now = MIDI;
    await t.call("GET", "/api/health");
    const rep = ESSAIS_VERTIGE.partie(JOUR, VERSIONS, 2).rediffusion;
    expect((await t.call("POST", "/api/vertige/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/vertige/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'vertige' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/vertige/day/${DATE}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'vertige'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/vertige/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
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
    const r = await appel(2, "GET", `/api/vertige/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});
