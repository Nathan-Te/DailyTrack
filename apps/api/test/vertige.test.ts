import { daysFromCivil, formatDay } from "@cdj/core";
import { VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, DUREE_MAX_TICKS, VARIANTE, decoderRediffusion, empreinteContenu, enregistrer, scoreParColonnes, seuilsDuJour, themeDuJour } from "@cdj/vertige-sim";
import { dailyVertige, figerJour, robotDuJour } from "@cdj/vertige-sim/modules";
import { describe, expect, it } from "vitest";
import { ESSAIS_VERTIGE } from "../scripts/vertige-essais";
import { contenuDeVertige } from "../src/vertige";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot V0 — « Vertige », sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), rejoue les commandes de chaque pas, classe le temps (le plus court
// d'abord), refuse les copies et les rediffusions abîmées, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le jour figé de l'image. Pas de médaille au prototype. SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { vertige: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "vertige");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/vertige/submit", { replay: ESSAIS_VERTIGE.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Vertige sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu), avec les médailles du robot et sans preuve", async () => {
    const t = await monter();
    const info = await t.call("GET", "/api/vertige/info");
    expect(info.body).toMatchObject({ game: "vertige", simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION, today: DATE });
    const jour = await t.call("GET", `/api/vertige/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    const c = dailyVertige(JOUR);
    expect(jour.body.medals).toEqual(VARIANTE.seuils(c.ticksRobot!)); // le Diamant est le temps du robot ; or, argent, bronze : le barème de la fiche
    expect(jour.body.medals.author).toBe(c.ticksRobot);
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/vertige/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe le temps le plus court d'abord et garde le résultat du serveur", async () => {
    const t = await monter();
    const parties = [1, 2, 3].map((v) => ({ n: v, v: [0, 2, 10][v - 1]!, ...ESSAIS_VERTIGE.partie(JOUR, VERSIONS, [0, 2, 10][v - 1]!) }));
    for (const p of parties) {
      const r = await envoyer(t, p.n, p.v);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.score).toEqual(p.attendu);
      expect(r.body.medal).toBe(VARIANTE.medaille([p.attendu.temps!], VARIANTE.seuils(dailyVertige(JOUR).ticksRobot!)));
    }
    // La variante 0 est le robot précédé d'un pas d'attente : il se pose avant de courir et gagne un pas sur le robot (qui part en l'air d'un demi-pas) — le Diamant n'est pas hors d'atteinte.
    expect(Math.abs(parties[0]!.attendu.temps! - dailyVertige(JOUR).ticksRobot!)).toBeLessThanOrEqual(2);
    const board = await t.call("GET", `/api/vertige/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string } & Record<string, number>)[];
    const attendu = [...parties].sort((a, b) => a.attendu.temps! - b.attendu.temps! || a.n - b.n).map((p) => `Joueur${p.n}`);
    expect(lignes.map((l) => l.name)).toEqual(attendu);
    for (let i = 1; i < lignes.length; i++) expect(lignes[i - 1]!.temps! <= lignes[i]!.temps!).toBe(true);
    expect(board.body.me).toMatchObject({ name: "Joueur3" });
  });

  it("refuse les copies (deux fois les mêmes commandes), les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.body.error).toBe("replay_copy");
    expect((await t.call("POST", "/api/vertige/submit", { replay: "pas-une-rediffusion", name: "Zéro" }, { headers: entete(4) })).body.error).toBe("invalid_replay");
    const commandes = decoderRediffusion(ESSAIS_VERTIGE.partie(JOUR, VERSIONS, 1).rediffusion).commandes;
    const autreJour = enregistrer(dailyVertige(JOUR - 1), commandes);
    expect((await t.call("POST", "/api/vertige/submit", { replay: autreJour, name: "Hier" }, { headers: entete(5) })).status).toBe(409);
    // Une rediffusion qui joue des pas après l'arrivée n'est pas l'écriture canonique de la partie.
    const enTrop = enregistrer(dailyVertige(JOUR), [...commandes, { k: 0, dl: 0, dt: 0 }]);
    expect((await t.call("POST", "/api/vertige/submit", { replay: enTrop, name: "Trop" }, { headers: entete(6) })).body.error).toBe("invalid_replay");
  });

  it("une partie vide est classée la dernière : le pire temps, sans médaille", async () => {
    const t = await monter();
    const c = dailyVertige(JOUR);
    const r = await t.call("POST", "/api/vertige/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual({ temps: DUREE_MAX_TICKS });
    expect(r.body.score).toEqual(scoreParColonnes({ arrive: false, ticks: 0 }));
    expect(r.body.medal).toBeNull(); // le pire temps n'a jamais de médaille
  });

  it("lit le jour figé de l'image s'il se vérifie, l'ignore sinon", async () => {
    const fige = figerJour(JOUR);
    expect(contenuDeVertige(JOUR, { [DATE]: fige })).toEqual({ ...dailyVertige(JOUR), seuilsFiges: fige.seuils });
    // Un jour figé garde les seuils qu'on a servis, même si le barème de la fiche change ensuite.
    const autres = { author: fige.seuils.author, gold: fige.seuils.author + 10, silver: fige.seuils.author + 20, bronze: fige.seuils.author + 30 };
    expect(seuilsDuJour(contenuDeVertige(JOUR, { [DATE]: figerJour(JOUR, VERTIGE_GENERATOR_VERSION, autres) }))).toEqual(autres);
    const abime = { ...fige, contenu: { modules: ["saut-1"], ticksRobot: 1 } };
    expect(empreinteContenu(contenuDeVertige(JOUR, { [DATE]: abime }))).toBe(empreinteContenu(dailyVertige(JOUR)));
    const t = await monter({ frozen: { [DATE]: fige } });
    const info = await t.call("GET", "/api/vertige/info");
    expect(info.body.frozenDays).toEqual([DATE]);
  });

  it("l'auteur est le robot : sa rediffusion à l'identique est une copie, le robot avec un pas d'attente de plus est un Diamant", async () => {
    const t = await monter({ copies: false });
    const c = dailyVertige(JOUR);
    const robot = robotDuJour(c);
    const copie = await t.call("POST", "/api/vertige/submit", { replay: enregistrer(c, robot), name: "Copieur" }, { headers: entete(1) });
    expect(copie.body.error).toBe("replay_copy");
    const r = await envoyer(t, 2, 0);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(Math.abs(r.body.score.temps - c.ticksRobot!)).toBeLessThanOrEqual(2);
    expect(r.body.medal).toBe("author");
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

// Lot V3 — l'empreinte de ce que le jeu sert pour un jour couvre aussi les SEUILS des médailles : un jour protégé dont les seuils changent (un autre barème) n'a plus la même empreinte, la mise en production s'arrête.
describe("l'empreinte du jour (garde-fou de la mise en production)", () => {
  it("change quand les seuils changent, qu'ils soient figés dans un fichier ou calculés ; un fichier figé et le jour généré se distinguent", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { empreinteJour } = await import("../scripts/vertige-empreintes");
    const dossier = mkdtempSync(join(tmpdir(), "cdj-vertige-"));
    try {
      const sans = empreinteJour(JOUR, dossier);
      expect(sans.ok).toBe(true);
      const fige = figerJour(JOUR);
      writeFileSync(join(dossier, `${DATE}.json`), JSON.stringify(fige));
      const avec = empreinteJour(JOUR, dossier);
      expect(avec.id).toBe(sans.id);
      expect(avec.h).not.toBe(sans.h);
      writeFileSync(join(dossier, `${DATE}.json`), JSON.stringify(figerJour(JOUR, VERTIGE_GENERATOR_VERSION, { ...fige.seuils, bronze: fige.seuils.bronze + 1 })));
      expect(empreinteJour(JOUR, dossier).h, "d'autres seuils figés : une autre empreinte").not.toBe(avec.h);
      writeFileSync(join(dossier, `${DATE}.json`), "pas du json");
      expect(empreinteJour(JOUR, dossier).h, "un fichier illisible n'est pas servi : le jour est généré").toBe(sans.h);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
