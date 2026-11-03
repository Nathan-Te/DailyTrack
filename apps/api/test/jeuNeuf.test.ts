import { describe, expect, it } from "vitest";
import { adaptateurResultatsJeu, medailleParSeuils, verifierAdaptateur } from "../src/jeux/index";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { D_ESSAI, ficheEssai, jeuEssai, JOUR_ESSAI, rediffusion } from "./jeuNeufAide";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot K4c — un jeu neuf, sur la table commune `resultats_jeu`, avec le **contrat minimal** seul. Deux fiches de test (un score du plus grand au plus petit, un temps du plus petit au plus grand) : le module,
// les formateurs par défaut et la table se comportent pareil dans les deux sens. SQLite et libSQL (`file:`), jamais Turso.

const MIDI = D_ESSAI * DAY_MS + 12 * 3_600_000;

async function monter(sens: "score" | "temps", options: { copies?: boolean } = {}): Promise<{ t: TestApi; code: string }> {
  const def = jeuEssai(sens);
  const t = await makeApi({ seed: false, games: [...GAMES, def], allowCopies: options.copies !== false });
  t.clock.now = MIDI;
  await ouvrirJeu(t, def.code);
  return { t, code: def.code };
}
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const envoyer = (t: TestApi, code: string, n: number, charge: number[], extra: Record<string, unknown> = {}, jour = D_ESSAI) =>
  t.call("POST", `/api/${code}/submit`, { replay: rediffusion(charge, jour), name: `Joueur${n}`, ...extra }, { headers: entete(n) });

describe("l'adaptateur de la table commune", () => {
  it("range les colonnes de la fiche en croissant (signe -1 pour un score décroissant) et remplit les clés inutilisées", () => {
    const score = adaptateurResultatsJeu("essaiscore", ficheEssai("score").classement.colonnes as never);
    expect(score.colonnes.map((c) => [c.nom, c.colonne, c.signe ?? 1, c.remplissage ?? false])).toEqual([
      ["points", "cle1", -1, false],
      ["octets", "cle2", 1, false],
      ["cle3", "cle3", 1, true],
    ]);
    expect(() => verifierAdaptateur(ficheEssai("score").classement.colonnes as never, score)).not.toThrow();
    const temps = adaptateurResultatsJeu("essaitemps", ficheEssai("temps").classement.colonnes as never);
    expect(temps.colonnes.map((c) => c.colonne)).toEqual(["cle1", "cle2", "cle3"]);
    expect(() => verifierAdaptateur(ficheEssai("temps").classement.colonnes as never, temps)).not.toThrow();
  });
  it("refuse une fiche de plus de trois colonnes de classement ou sans aucune", () => {
    const quatre = ["a", "b", "c", "d"].map((nom) => ({ nom, sens: "asc" as const }));
    expect(() => adaptateurResultatsJeu("x", quatre)).toThrow(/une à 3 colonnes/);
    expect(() => adaptateurResultatsJeu("x", [])).toThrow();
  });
  it("donne la médaille la plus haute dont le seuil est atteint, dans le sens de la colonne", () => {
    const s = { author: 200, gold: 100, silver: 50, bronze: 20 };
    expect([250, 200, 120, 50, 20, 19].map((v) => medailleParSeuils(v, "desc", s))).toEqual(["author", "author", "gold", "silver", "bronze", null]);
    const t = { author: 4, gold: 10, silver: 20, bronze: 40 };
    expect([3, 4, 9, 20, 40, 41].map((v) => medailleParSeuils(v, "asc", t))).toEqual(["author", "author", "gold", "silver", "bronze", null]);
    expect(medailleParSeuils(1, "asc", null)).toBeNull();
  });
});

for (const sens of ["score", "temps"] as const) {
  describe(`un jeu neuf ${sens === "score" ? "au score (du plus grand au plus petit)" : "au temps (du plus petit au plus grand)"} avec le contrat minimal`, () => {
    // Au score : [60, 40] = 100 points (or) en 2 octets ; au temps : 2 octets = 4 ticks (Diamant).
    const bon = sens === "score" ? [60, 40] : [1, 1];
    const moyen = sens === "score" ? [30, 30, 1] : [1, 1, 1, 1];
    const faible = sens === "score" ? [5] : [1, 1, 1, 1, 1, 1];

    it("sert le niveau du jour (versions, seuils, thème), jamais de preuve, et refuse un jour futur", async () => {
      const { t, code } = await monter(sens);
      const info = await t.call("GET", `/api/${code}/info`);
      expect(info.body).toMatchObject({ game: code, simVersion: 1, generatorVersion: 1, today: JOUR_ESSAI });
      const jour = await t.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
      expect(jour.status).toBe(200);
      expect(jour.body).toMatchObject({ simVersion: 1, generatorVersion: 1, theme: "plat" });
      expect(jour.body.medals).toEqual(sens === "score" ? { author: 200, gold: 100, silver: 50, bronze: 20 } : { author: 4, gold: 10, silver: 20, bronze: 40 });
      expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
      expect((await t.call("GET", `/api/${code}/day/2026-11-11`)).status).toBe(404);
    });

    it("rejoue, classe, médaille, et ne garde que la meilleure partie d'un joueur", async () => {
      const { t, code } = await monter(sens);
      const a = await envoyer(t, code, 1, moyen);
      expect(a.status).toBe(200);
      expect(a.body).toMatchObject({ accepted: true, improved: true, rank: 1, participants: 1, date: JOUR_ESSAI });
      const b = await envoyer(t, code, 2, bon);
      expect(b.body).toMatchObject({ rank: 1, participants: 2, improved: true });
      expect(b.body.medal).toBe(sens === "score" ? "gold" : "author");
      const c = await envoyer(t, code, 3, faible);
      expect(c.body).toMatchObject({ rank: 3, participants: 3 });
      // Une partie moins bonne du même joueur n'est pas un record et ne remplace rien.
      const pire = await envoyer(t, code, 2, faible);
      expect(pire.body).toMatchObject({ improved: false, rank: 1 });
      expect(pire.body.best).toMatchObject(sens === "score" ? { points: 100, octets: 2 } : { ticks: 4 });
      const board = await t.call("GET", `/api/${code}/day/${JOUR_ESSAI}/board`, undefined, { headers: entete(3) });
      expect(board.body.top.map((l: { name: string }) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
      expect(board.body.me).toMatchObject({ rank: 3, name: "Joueur3" });
      expect(board.body.top[0]).toHaveProperty("ref");
      // Le serveur garde son résultat : un score annoncé est ignoré.
      const triche = await envoyer(t, code, 4, faible, { points: 9999, ticks: 1, score: { points: 9999 } });
      expect(triche.body.best).toMatchObject(sens === "score" ? { points: 5, octets: 1 } : { ticks: 12 });
      expect(triche.body.participants).toBe(4);
    });

    it("départage une égalité par l'ordre d'envoi, puis par l'identifiant", async () => {
      const { t, code } = await monter(sens);
      t.clock.now = MIDI;
      await envoyer(t, code, 5, bon);
      t.clock.now = MIDI + 1000;
      await envoyer(t, code, 4, bon);
      const board = await t.call("GET", `/api/${code}/day/${JOUR_ESSAI}/board`);
      expect(board.body.top.map((l: { name: string }) => l.name)).toEqual(["Joueur5", "Joueur4"]);
    });

    it("refuse chaque rediffusion qu'il ne sait pas lire, par un code de la liste", async () => {
      const { t, code } = await monter(sens);
      const refus = async (corps: Record<string, unknown>, h = entete(1)) => (await t.call("POST", `/api/${code}/submit`, corps, { headers: h })).body;
      expect(await refus({ name: "Nowy" })).toMatchObject({ error: "invalid_replay" });
      expect(await refus({ replay: "é!", name: "Nowy" })).toMatchObject({ error: "invalid_replay" });
      expect(await refus({ replay: "A".repeat(700), name: "Nowy" })).toMatchObject({ error: "invalid_replay" });
      expect(await refus({ replay: rediffusion([1], D_ESSAI, 9), name: "Nowy" })).toMatchObject({ error: "version" });
      expect(await refus({ replay: rediffusion([]), name: "Nowy" })).toMatchObject({ error: "not_finished" });
      expect(await refus({ replay: rediffusion([1], D_ESSAI + 1), name: "Nowy" })).toMatchObject({ error: "not_daily" });
      expect(await refus({ replay: rediffusion([1], D_ESSAI - 3), name: "Nowy" })).toMatchObject({ error: "day_closed" });
      expect((await t.call("POST", `/api/${code}/submit`, { replay: rediffusion([1]), name: "Nowy" })).body).toMatchObject({ error: "invalid_player" });
    });

    it("refuse la copie de la partie d'un autre joueur (409 replay_copy), sauf `allowCopies`", async () => {
      const { t, code } = await monter(sens, { copies: false });
      expect((await envoyer(t, code, 1, bon)).status).toBe(200);
      expect((await envoyer(t, code, 2, bon)).body).toMatchObject({ error: "replay_copy" });
      // Le joueur n'existe pas après le refus (comme pour un essai invalide).
      expect((await t.call("GET", `/api/${code}/me`, undefined, { headers: entete(2) })).status).toBe(404);
      expect((await envoyer(t, code, 1, bon)).status).toBe(200);
    });

    it("garde le profil, le fantôme réservé aux classés et le portail", async () => {
      const { t, code } = await monter(sens);
      await envoyer(t, code, 1, bon);
      const me = await t.call("GET", `/api/${code}/me`, undefined, { headers: entete(1) });
      expect(me.body).toMatchObject({ name: "Joueur1", stats: { days: 1 }, simVersion: 1, generatorVersion: 1 });
      expect(me.body.days[0]).toMatchObject({ date: JOUR_ESSAI });
      const jour = await t.call("GET", "/api/portail/jour", undefined, { headers: entete(1) });
      const entree = jour.body.jeux.find((j: { jeu: string }) => j.jeu === code);
      expect(entree).toBeTruthy();
      expect(entree.etat).toMatchObject({ statut: "fini", rang: 1, classes: 1 });
      if (sens === "score") expect(entree.etat.score).toEqual({ unite: "points", valeur: 100, vies: 0 });
      else expect(entree.etat.tempsMs).toBe(Math.round((4 * 1000) / 60));
    });

    it("range l'aperçu à part et le vide au passage en ligne", async () => {
      const def = jeuEssai(sens);
      const t = await makeApi({ seed: false, games: [...GAMES, def], allowCopies: true });
      t.clock.now = MIDI;
      const { ensureSchemaOn } = await import("../src/db");
      await ensureSchemaOn(t.db);
      const { createHash } = await import("node:crypto");
      const cle = "cle-apercu-de-test";
      await t.db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, cle_hash, modifie_le) VALUES (?, 'preview', 0, '[]', ?, 0)", [def.code, createHash("sha256").update(cle).digest("hex")]);
      const r = await t.call("POST", `/api/${def.code}/submit`, { replay: rediffusion(bon), name: "Apercu" }, { headers: { ...entete(1), "X-Preview-Key": cle } });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const ligne = await t.db.first<{ hidden: number; apercu: number }>("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = ?", [def.code]);
      expect(ligne).toEqual({ hidden: 1, apercu: 1 }); // rangée à part : aucun classement public ne la voit
      expect((await t.call("GET", `/api/${def.code}/day/${JOUR_ESSAI}/board`, undefined, { headers: { "X-Preview-Key": cle } })).body.participants).toBe(0);
      const { sqlDe } = await import("../src/jeux/index");
      await t.db.run(sqlDe(adaptateurResultatsJeu(def.code, ficheEssai(sens).classement.colonnes as never)).viderApercu);
      expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = ?", [def.code]))!.n).toBe(0);
    });

    it("effacement d'un joueur (ses parties seulement), « Changer mon code » et remise à zéro du lancement", async () => {
      const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
      const def = jeuEssai(sens);
      const t = await makeApi({ seed: false, games: [...GAMES, def], allowCopies: true, adminToken: TOKEN });
      t.clock.now = MIDI;
      await ouvrirJeu(t, def.code);
      await envoyer(t, def.code, 1, bon);
      await envoyer(t, def.code, 2, moyen);
      const lignes = async () => (await t.db.all<{ player_id: string }>("SELECT player_id FROM resultats_jeu WHERE jeu = ? ORDER BY player_id", [def.code])).map((x) => x.player_id);
      expect(await lignes()).toEqual([playerId(1), playerId(2)]);
      // « Changer mon code » : les parties suivent le joueur.
      const nouveau = playerId(77);
      const rot = await t.call("POST", "/api/me/code", { newId: nouveau }, { headers: entete(2) });
      expect(rot.status, JSON.stringify(rot.body)).toBe(200);
      expect(await lignes()).toEqual([playerId(1), nouveau]);
      // L'effacement : essai à blanc d'abord, puis pour de bon ; les parties des autres restent.
      const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
      expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
      expect(await lignes()).toHaveLength(2);
      const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
      expect(sec.status, JSON.stringify(sec.body)).toBe(200);
      expect(JSON.stringify(sec.body)).toContain(`parties${def.name.replace(/[^A-Za-z0-9]/g, "")}`);
      expect(await lignes()).toEqual([nouveau]);
      // La remise à zéro vide la table (liée à un joueur).
      const { remiseAZero } = await import("../src/remiseAZero");
      await remiseAZero(t.db, { now: MIDI, applique: true });
      expect(await lignes()).toEqual([]);
    });
  });
}

describe("deux jeux sur la table commune restent séparés", () => {
  it("un même joueur, deux jeux, le même jour : deux classements, aucune fuite de l'un à l'autre", async () => {
    const a = jeuEssai("score");
    const b = jeuEssai("temps");
    const t = await makeApi({ seed: false, games: [...GAMES, a, b], allowCopies: true });
    t.clock.now = MIDI;
    await ouvrirJeu(t, a.code);
    await ouvrirJeu(t, b.code);
    await envoyer(t, a.code, 1, [60, 40]);
    await envoyer(t, b.code, 2, [1, 1]);
    expect((await t.call("GET", `/api/${a.code}/day/${JOUR_ESSAI}/board`)).body.participants).toBe(1);
    expect((await t.call("GET", `/api/${b.code}/day/${JOUR_ESSAI}/board`)).body.participants).toBe(1);
    // Le joueur 1 est connu de la plateforme (il a joué dans l'autre jeu) : son profil du second jeu est vide, rien ne fuit.
    expect((await t.call("GET", `/api/${b.code}/me`, undefined, { headers: entete(1) })).body).toMatchObject({ days: [], stats: { days: 0 } });
  });
  it("un jeu fermé (absent de la table des jeux) répond 404 game_unavailable", async () => {
    const def = jeuEssai("score");
    const t = await makeApi({ seed: false, games: [...GAMES, def] });
    t.clock.now = MIDI;
    expect((await t.call("GET", `/api/${def.code}/info`)).body).toMatchObject({ error: "game_unavailable" });
  });
});
