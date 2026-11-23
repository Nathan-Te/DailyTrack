import { daysFromCivil, formatDay } from "@cdj/core";
import { COLONNES_CLASSEMENT, PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION, dailyPilepoil, enregistrer, jouer, joueurScripte, scoreParColonnes } from "@cdj/pilepoil-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_PILEPOIL } from "../scripts/pilepoil-essais";
import { crc32Hex } from "../src/identity";
import { contratPilepoil } from "../src/pilepoil";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot PA2 — « Pile poil », le premier jeu Party, sur le contrat Party (lot PA1) et la table commune `resultats_jeu` : le serveur sert la graine du jour, rejoue les pas des appuis, classe dans le sens de la fiche
// (le score, puis les « pile »), refuse les copies et les rediffusions abîmées ou impossibles, range l'aperçu à part, efface un joueur et filtre « Mon groupe ». SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: PILEPOIL_SIM_VERSION, generatorVersion: PILEPOIL_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const PREMIERE = COLONNES_CLASSEMENT[0];
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { pilepoil: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "pilepoil");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/pilepoil/submit", { replay: ESSAIS_PILEPOIL.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Pilepoil sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu), jamais la preuve", async () => {
    const t = await monter();
    const c = dailyPilepoil(JOUR);
    const info = await t.call("GET", "/api/pilepoil/info");
    expect(info.body).toMatchObject({ game: "pilepoil", simVersion: 1, generatorVersion: 1, today: DATE });
    const jour = await t.call("GET", `/api/pilepoil/day/${DATE}`);
    expect(jour.status).toBe(200);
    // Un jeu Party (lot PA1) : le niveau du jour est la graine du jour, rien d'autre — ni thème, ni médailles.
    expect(jour.body.contenu).toEqual({ graine: c.graine });
    expect(jour.body.theme ?? null).toBeNull();
    expect(jour.body.medals ?? null).toBeNull();
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/pilepoil/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche et garde le résultat du serveur", async () => {
    const t = await monter();
    for (const [n, v] of [[1, 3], [2, 0], [3, 9]] as const) {
      const attendu = ESSAIS_PILEPOIL.partie(JOUR, VERSIONS, v).attendu;
      const r = await envoyer(t, n, v);
      expect(r.status).toBe(200);
      expect(r.body.score).toEqual(attendu);
    }
    const board = await t.call("GET", `/api/pilepoil/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string; medal: string | null } & Record<string, number>)[];
    const attendus = ([[1, 3], [2, 0], [3, 9]] as const).map(([n, v]) => ({ nom: `Joueur${n}`, s: ESSAIS_PILEPOIL.partie(JOUR, VERSIONS, v).attendu as Record<string, number> }));
    attendus.sort((a, b) => b.s.score! - a.s.score! || b.s.piles! - a.s.piles!);
    expect(lignes.map((l) => l.name)).toEqual(attendus.map((a) => a.nom));
    // La première colonne de la fiche range le classement, dans son sens.
    for (let i = 1; i < lignes.length; i++) expect(PREMIERE.sens === "desc" ? lignes[i - 1]![PREMIERE.nom]! >= lignes[i]![PREMIERE.nom]! : lignes[i - 1]![PREMIERE.nom]! <= lignes[i]![PREMIERE.nom]!).toBe(true);
    expect(lignes[0]!.medal ?? null).toBeNull(); // pas de médaille pour un jeu Party
    expect(board.body.me).toMatchObject({ name: "Joueur3", rank: 3 });
  });

  it("à score égal, le plus de « pile » passe devant (le départage de la fiche), même envoyé après", async () => {
    const t = await monter();
    const c = dailyPilepoil(JOUR);
    // 150 points chacun : deux arrêts « bien » aux deux premières jauges, ou un seul « pile » à la première (cherchés une fois sur ce jour).
    const sansPile = joueurScripte(c.jauges, (i) => (i === 0 ? 16500 : i === 1 ? 39500 : null));
    const unPile = joueurScripte(c.jauges, (i) => (i === 0 ? 9000 : null));
    expect([jouer(c.jauges, sansPile), jouer(c.jauges, unPile)].map((r) => [r.score, r.piles])).toEqual([[150, 0], [150, 1]]);
    await t.call("POST", "/api/pilepoil/submit", { replay: enregistrer(c, sansPile), name: "Bien" }, { headers: entete(1) });
    await t.call("POST", "/api/pilepoil/submit", { replay: enregistrer(c, unPile), name: "Pile" }, { headers: entete(2) });
    const board = await t.call("GET", `/api/pilepoil/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).map((l) => l.name)).toEqual(["Pile", "Bien"]);
  });

  it("refuse une rediffusion impossible (un appui pendant la pause) avant de rien écrire", async () => {
    const t = await monter();
    const c = dailyPilepoil(JOUR);
    const [p] = joueurScripte(c.jauges, () => 30000);
    const r = await t.call("POST", "/api/pilepoil/submit", { replay: enregistrer(c, [p!, p! + 1]), name: "Pressé" }, { headers: entete(1) });
    expect(r.body.error).toBe("invalid_replay");
    expect(await t.db.first("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'pilepoil'")).toEqual({ n: 0 });
  });

  it("un rejeu coûte peu et la rediffusion est courte (mesure)", () => {
    const c = dailyPilepoil(JOUR);
    const appuis = joueurScripte(c.jauges, () => 30000);
    const code = enregistrer(c, appuis);
    const debut = performance.now();
    for (let k = 0; k < 200; k++) contratPilepoil().rejouer({ jour: JOUR, graine: c.graine }, code);
    const ms = (performance.now() - debut) / 200;
    console.log(`Pile poil : un rejeu ≈ ${ms.toFixed(3)} ms, rediffusion de ${code.length} caractères (${appuis.length} appuis)`);
    expect(ms).toBeLessThan(20);
    expect(code.length).toBeLessThanOrEqual(60);
  });

  it("refuse les copies (deux fois les mêmes touches), les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.body.error).toBe("replay_copy");
    expect((await t.call("POST", "/api/pilepoil/submit", { replay: "pas-une-rediffusion", name: "Zéro" }, { headers: entete(4) })).body.error).toBe("invalid_replay");
    const autreJour = enregistrer(dailyPilepoil(JOUR - 1), []);
    expect((await t.call("POST", "/api/pilepoil/submit", { replay: autreJour, name: "Hier" }, { headers: entete(5) })).status).toBe(409);
  });

  it("une partie vide est classée la dernière, sans médaille", async () => {
    const t = await monter();
    const c = dailyPilepoil(JOUR);
    const r = await t.call("POST", "/api/pilepoil/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(c.jauges, [])));
    expect(r.body.medal ?? null).toBeNull();
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/pilepoil/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/pilepoil/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    // En aperçu, tous les jeux Party du registre sont en lice à tour de rôle (lot PA1b) : un autre jeu Party (le jeu fictif de la CI) peut être celui du jour. On prend le premier jour où Pile poil l'est.
    let jour = JOUR;
    for (; jour < JOUR + 8; jour++) {
      t.clock.now = jour * DAY_MS + 12 * 3_600_000;
      if ((await t.call("GET", `/api/pilepoil/day/${formatDay(jour)}/board`, undefined, { headers: hotePr })).body.party?.classe) break;
    }
    expect(jour, "Pile poil est le jeu Party du jour un jour de la semaine").toBeLessThan(JOUR + 8);
    await t.call("GET", "/api/health");
    const rep = ESSAIS_PILEPOIL.partie(jour, VERSIONS, 2).rediffusion;
    expect((await t.call("POST", "/api/pilepoil/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/pilepoil/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'pilepoil' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/pilepoil/day/${formatDay(jour)}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'pilepoil'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/pilepoil/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
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
    const r = await appel(2, "GET", `/api/pilepoil/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});
