import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daysFromCivil, formatDay } from "@cdj/core";
import { actionDe, BLOCKS_GENERATOR_VERSION, figerJour, decoderRediffusion, BLOCKS_SIM_VERSION, contenuDeScenario, dailyBlocks, empreinteContenu, enregistrer, jouer, PLAFOND_PIECES, medailleDe, scoreParColonnes, themeDuJour, VARIANTE } from "@cdj/blocks-sim";
import { figerJourDuDiamant, jouerDiamant, seuilsDe } from "@cdj/blocks-sim/diamant";
import { seuilsDepuis } from "@cdj/blocks-sim";
import { empreinteJour } from "../scripts/blocks-empreintes";
import { describe, expect, it } from "vitest";
import { ESSAIS_BLOCKS } from "../scripts/blocks-essais";
import { contenuDeBlocks, contratBlocks, seuilsDeBlocks } from "../src/blocks";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot B1 — « Blocks » sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le jour (serveur = jeu), rejoue la liste des poses, classe score ↓ puis combo maximal ↓ puis le
// premier arrivé, refuse une pose illégale, une pose après la fin, une suite au-delà du plafond et une partie non terminée, refuse les copies, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le
// jour figé de l'image. SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { blocks: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "blocks");
  return t;
}
const envoyerTexte = (t: TestApi, n: number, replay: string) => t.call("POST", "/api/blocks/submit", { replay, name: `Joueur${n}` }, { headers: entete(n) });
const envoyer = (t: TestApi, n: number, variante: number) => envoyerTexte(t, n, ESSAIS_BLOCKS.partie(JOUR, VERSIONS, variante).rediffusion);

/** Les parties d'essai 0 à n − 1 sont toutes différentes (le serveur refuse une copie). */
const essais = Array.from({ length: 12 }, (_, v) => ESSAIS_BLOCKS.partie(JOUR, VERSIONS, v));

describe("Blocks sur le serveur", () => {
  it("les 12 parties d'essai sont distinctes", () => {
    expect(new Set(essais.map((e) => e.rediffusion)).size).toBe(12);
  });

  it("sert la suite du jour de la simulation (serveur = jeu), jamais de preuve, avec les seuils des médailles du bot Diamant (lot B3)", async () => {
    const t = await monter();
    const info = await t.call("GET", "/api/blocks/info");
    expect(info.body).toMatchObject({ game: "blocks", simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION, today: DATE });
    const jour = await t.call("GET", `/api/blocks/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    const s = seuilsDe(dailyBlocks(JOUR));
    expect(jour.body.medals).toEqual({ author: s.author, gold: s.gold, silver: s.silver, bronze: s.bronze });
    expect(s.bronze).toBeLessThan(s.silver);
    expect(s.silver).toBeLessThan(s.gold);
    expect(s.gold).toBeLessThan(s.author);
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/blocks/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche (score ↓, combo ↓) et garde le résultat du serveur", async () => {
    const t = await monter();
    const variantes = [3, 0, 9];
    for (const [i, v] of variantes.entries()) {
      const r = await envoyer(t, i + 1, v);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.score).toEqual(essais[v]!.attendu);
      expect(r.body.medal).toBe(medailleDe([essais[v]!.attendu.score!], seuilsDe(dailyBlocks(JOUR)))); // le code commun de la médaille (author, gold, silver, bronze) ou null
    }
    const attendu = variantes.map((v, i) => ({ nom: `Joueur${i + 1}`, score: essais[v]!.attendu.score!, combo: essais[v]!.attendu.combo! })).sort((a, b) => b.score - a.score || b.combo - a.combo);
    const board = await t.call("GET", `/api/blocks/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string } & Record<string, number>)[];
    expect(lignes.map((l) => l.name)).toEqual(attendu.map((a) => a.nom));
    expect(lignes.map((l) => [l.score, l.combo])).toEqual(attendu.map((a) => [a.score, a.combo]));
  });

  it("à score égal, le plus grand combo maximal passe devant, même arrivé après ; à égalité totale, le premier arrivé (la partie identique d'un autre joueur)", async () => {
    // Deux parties d'essai de même score mais de combos différents : cherchées parmi 400 variantes (les parties sont déterministes).
    const parties = Array.from({ length: 400 }, (_, v) => ESSAIS_BLOCKS.partie(JOUR, VERSIONS, v));
    let paire: [typeof parties[number], typeof parties[number]] | null = null;
    for (const a of parties) {
      const b = parties.find((x) => x.rediffusion !== a.rediffusion && x.attendu.score === a.attendu.score && x.attendu.combo! > a.attendu.combo!);
      if (b) {
        paire = [a, b];
        break;
      }
    }
    expect(paire, "deux parties de même score et de combos différents parmi 400").not.toBeNull();
    const [petit, grand] = paire!;
    const t = await monter();
    await envoyerTexte(t, 1, petit.rediffusion); // arrive d'abord, combo plus petit
    await envoyerTexte(t, 2, grand.rediffusion);
    const board = await t.call("GET", `/api/blocks/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).map((l) => l.name)).toEqual(["Joueur2", "Joueur1"]);
    // Égalité totale (même partie rejouée par un autre joueur, copies permises) : le premier arrivé passe devant.
    await envoyerTexte(t, 3, petit.rediffusion);
    const b2 = await t.call("GET", `/api/blocks/day/${DATE}/board`);
    expect((b2.body.top as { name: string }[]).map((l) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
  });

  it("refuse les copies, les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.status).toBe(409);
    expect(copie.body.error).toBe("replay_copy");
    expect((await envoyerTexte(t, 4, "pas-une-rediffusion")).body.error).toBe("invalid_replay");
    const autreJour = enregistrer(dailyBlocks(JOUR - 1), []);
    expect((await envoyerTexte(t, 5, autreJour)).status).toBe(409);
  });

  it("refuse une pose illégale, une pose après la fin, une partie non terminée et un scénario d'essai", async () => {
    const t = await monter();
    const contenu = dailyBlocks(JOUR);
    // La partie d'essai 0 : la complète, sans sa dernière pose, avec une pose de trop, avec une pose illégale au milieu.
    const actions = decoderActions(essais[0]!.rediffusion);
    const nonTerminee = await envoyerTexte(t, 1, enregistrer(contenu, actions.slice(0, -1)));
    expect(nonTerminee.status).toBe(400);
    expect(nonTerminee.body.error).toBe("invalid_replay");
    expect((await envoyerTexte(t, 2, enregistrer(contenu, [...actions, actionDe(0, 0, 0)]))).body.error).toBe("invalid_replay");
    expect((await envoyerTexte(t, 3, enregistrer(contenu, [actionDe(0, 0, 0), actionDe(0, 0, 0)]))).body.error).toBe("invalid_replay");
    expect((await envoyerTexte(t, 4, enregistrer(contenu, []))).body.error).toBe("invalid_replay");
    const scenario = await envoyerTexte(t, 5, enregistrer(contenuDeScenario("blocage"), []));
    expect(scenario.status).toBeGreaterThanOrEqual(400);
    expect(scenario.status).toBeLessThan(500);
    const board = await t.call("GET", `/api/blocks/day/${DATE}/board`);
    expect(board.body.participants).toBe(0);
    // Au-delà du plafond : plus de PLAFOND_PIECES poses.
    const trop = enregistrer(contenu, Array.from({ length: PLAFOND_PIECES + 1 }, () => 0));
    expect((await envoyerTexte(t, 6, trop)).body.error).toBe("invalid_replay");
  });

  it("le rejeu du serveur est celui du jeu", () => {
    const c = dailyBlocks(JOUR);
    const e = essais[4]!;
    expect(jouer(c, decoderActions(e.rediffusion))).toMatchObject({ score: e.attendu.score, combo: e.attendu.combo });
    expect(scoreParColonnes(jouer(c, decoderActions(e.rediffusion)))).toEqual(e.attendu);
    expect(VARIANTE.fiche.colonnes.map((k) => k.nom)).toEqual(Object.keys(e.attendu));
  });

  it("lit le jour figé de l'image s'il se vérifie, l'ignore sinon", async () => {
    const fige = figerJourDuDiamant(JOUR);
    expect(contenuDeBlocks(JOUR, { [DATE]: fige })).toEqual({ ...dailyBlocks(JOUR), seuilsFiges: seuilsDe(dailyBlocks(JOUR)) });
    const abime = { ...fige, contenu: { suite: fige.contenu.suite.slice(1) + "0" } };
    expect(empreinteContenu(contenuDeBlocks(JOUR, { [DATE]: abime }))).toBe(empreinteContenu(dailyBlocks(JOUR)));
    const t = await monter({ frozen: { [DATE]: fige } });
    const info = await t.call("GET", "/api/blocks/info");
    expect(info.body.frozenDays).toEqual([DATE]);
  });

  it("un jour figé fige ses seuils : le serveur sert et rend ceux du fichier, même si le bot d'aujourd'hui en calcule d'autres ; l'empreinte du jour les couvre", async () => {
    const ancien = seuilsDepuis(7000); // un fichier figé par un bot plus ancien
    expect(ancien.author).not.toBe(seuilsDe(dailyBlocks(JOUR)).author);
    const fige = { ...figerJourDuDiamant(JOUR), bot: 0, seuils: ancien };
    expect(seuilsDeBlocks(contenuDeBlocks(JOUR, { [DATE]: fige }))).toEqual(ancien);
    const t = await monter({ frozen: { [DATE]: fige } });
    const jour = await t.call("GET", `/api/blocks/day/${DATE}`);
    expect(jour.body.medals).toEqual({ author: ancien.author, gold: ancien.gold, silver: ancien.silver, bronze: ancien.bronze });
    // Sans fichier : le bot d'aujourd'hui.
    expect(seuilsDeBlocks(contenuDeBlocks(JOUR))).toEqual(seuilsDe(dailyBlocks(JOUR)));
    // L'empreinte (comparée à chaque mise en production) change si les seuils changent : un fichier de seuils différents n'a pas l'empreinte du jour généré.
    const dossier = mkdtempSync(join(tmpdir(), "blocks-jours-"));
    try {
      const jourDuBot = empreinteJour(JOUR, dossier); // aucun fichier : généré
      writeFileSync(join(dossier, `${DATE}.json`), JSON.stringify(fige));
      const avecAncien = empreinteJour(JOUR, dossier);
      expect(avecAncien.h).not.toBe(jourDuBot.h);
      writeFileSync(join(dossier, `${DATE}.json`), JSON.stringify(figerJourDuDiamant(JOUR)));
      expect(empreinteJour(JOUR, dossier).h).not.toBe(avecAncien.h);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("la partie du n° 1 du jour (`/first`) : débloquée en finissant, rejouable, publique une fois le jour fermé", async () => {
    const t = await monter();
    expect((await t.call("GET", `/api/blocks/day/${DATE}/first`)).body.error).toBe("invalid_player"); // jour ouvert : il faut un joueur
    expect((await t.call("GET", `/api/blocks/day/${DATE}/first`, undefined, { headers: entete(1) })).body.error).toBe("not_ranked"); // pas classé
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    await envoyer(t, 3, 2);
    const scores = [0, 4, 2].map((v) => Number(essais[v]!.attendu.score));
    const meilleur = scores.indexOf(Math.max(...scores));
    const premier = [0, 4, 2][meilleur]!;
    // Pas classé : refusé. Classé : la partie du premier, avec les versions qui l'ont rejouée.
    expect((await t.call("GET", `/api/blocks/day/${DATE}/first`, undefined, { headers: entete(9) })).body.error).toBe("not_ranked");
    const r = await t.call("GET", `/api/blocks/day/${DATE}/first`, undefined, { headers: entete(1) });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ date: DATE, name: `Joueur${[1, 2, 3][meilleur]}`, replay: essais[premier]!.rediffusion, simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION, mine: meilleur === 0 });
    // Ce que le serveur a rendu se rejoue sur le contenu du jour (c'est une rediffusion valide).
    expect(jouer(dailyBlocks(JOUR), decoderActions(r.body.replay)).score).toBe(essais[premier]!.attendu.score);
    // Jour fermé (le lendemain, grâce passée) : publique, sans identifiant.
    t.clock.now = (JOUR + 2) * DAY_MS + 12 * 3_600_000;
    const ferme = await t.call("GET", `/api/blocks/day/${DATE}/first`);
    expect(ferme.status).toBe(200);
    expect(ferme.body.replay).toBe(essais[premier]!.rediffusion);
    expect(ferme.body.mine).toBe(false);
    // Un jour sans classé : 404 no_ghost.
    expect((await t.call("GET", `/api/blocks/day/${formatDay(JOUR - 1)}/first`)).body.error).toBe("no_ghost");
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/blocks/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/blocks/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    t.clock.now = MIDI;
    await t.call("GET", "/api/health");
    const rep = essais[2]!.rediffusion;
    expect((await t.call("POST", "/api/blocks/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/blocks/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'blocks' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/blocks/day/${DATE}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'blocks'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/blocks/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
  });

  it("« Mon groupe » : les membres du groupe seulement, le joueur d'un autre groupe n'y figure pas", { timeout: 30_000 }, async () => {
    const t = await monter();
    const appel = (n: number, methode: "GET" | "POST", chemin: string, corps?: unknown) => t.call(methode, chemin, corps, { headers: entete(n), clientKey: `10.0.0.${n}` });
    for (const n of [1, 2, 3]) await envoyer(t, n, n * 3);
    const g = await appel(1, "POST", "/api/groupes", { nom: "Les Poseurs" });
    expect(g.status, JSON.stringify(g.body)).toBe(200);
    const moi = (await appel(1, "GET", "/api/groupes/moi")).body.groupe;
    expect((await appel(2, "POST", "/api/groupes/rejoindre", { jeton: moi.invitation })).status).toBe(200);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [JOUR - 1, g.body.id]);
    const r = await appel(2, "GET", `/api/blocks/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});

/** Les actions d'une rediffusion (pour fabriquer des variantes abîmées). */
function decoderActions(texte: string): number[] {
  return decoderRediffusion(texte).actions;
}

describe("Blocks : les médailles du bot Diamant (lot B3)", () => {
  it("la partie du bot, envoyée par un joueur, rapporte le Diamant (`author`) : le serveur la rejoue comme n'importe quelle partie", async () => {
    const t = await monter();
    const bot = jouerDiamant(dailyBlocks(JOUR));
    const r = await envoyerTexte(t, 1, enregistrer(dailyBlocks(JOUR), bot.actions));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.medal).toBe("author");
    expect(r.body.score).toMatchObject({ score: bot.resultat.score, combo: bot.resultat.combo });
  });

  it("calcule les seuils d'un jour vite (médiane de 20 jours ; mesure du README du lot B8 : 53 ms en médiane, 152 ms au pire sur 1 000 jours), puis les rend de la mémoire (le même objet)", () => {
    const temps = Array.from({ length: 20 }, (_, i) => {
      const contenu = dailyBlocks(daysFromCivil(2026, 12, 1) + i);
      const t0 = performance.now();
      const s = seuilsDeBlocks(contenu);
      const ms = performance.now() - t0;
      const t1 = performance.now();
      expect(seuilsDeBlocks(contenu)).toBe(s);
      expect(performance.now() - t1).toBeLessThan(5);
      return ms;
    }).sort((x, y) => x - y);
    expect(temps[10]!).toBeLessThan(400); // la mesure de référence (seule, 1 000 jours) est de 53 ms en médiane : ici les tests tournent en parallèle
    expect(temps[19]!).toBeLessThan(800); // le pire cas, à froid, sur une machine chargée par d'autres tests : la mémoire (ci-dessus) évite de le payer deux fois
  });
});

describe("Blocks : les règles v1 d'un jour figé avant le lot B8, v2 pour les autres (lot B8)", () => {
  // La partie v1 de référence (produite par l'ancien code, jamais régénérée : `packages/blocks-sim/test/fixtures/v1-reference.json`).
  const ref = (JSON.parse(readFileSync(new URL("../../../packages/blocks-sim/test/fixtures/v1-reference.json", import.meta.url), "utf8")) as { jours: { date: string; code: string; resultat: { score: number; combo: number; poses: number } }[] }).jours[0]!;
  const jourV1 = daysFromCivil(2026, 11, 2);
  const seuilsV1 = { bronze: 100, silver: 400, gold: 1000, author: 3000 };
  const fichierV1 = figerJour(jourV1, seuilsV1, 3, 1);

  it("un jour figé en v1 est servi avec son tirage 3 et ses seuils, et son rejeu est celui des règles v1 ; un jour non figé est en v2", async () => {
    expect(ref.date).toBe(DATE.replace("11-10", "11-02"));
    const contrat = contratBlocks({ frozen: { [ref.date]: fichierV1 } });
    const niveau = await contrat.niveauDuJour(jourV1);
    expect(niveau.contenu.g).toBe(3);
    expect(contrat.seuils(niveau)).toEqual(seuilsV1);
    expect(contrat.rejouer(niveau, ref.code)).toMatchObject(ref.resultat);
    // Un autre jour, non figé : les règles v2.
    expect((await contrat.niveauDuJour(jourV1 + 1)).contenu.g).toBe(BLOCKS_GENERATOR_VERSION);
  });
  it("une rediffusion v2 est refusée sur un jour v1 (`invalid_replay`), une v1 sur un jour v2 aussi", async () => {
    const contrat = contratBlocks({ frozen: { [ref.date]: fichierV1 } });
    const niveau = await contrat.niveauDuJour(jourV1);
    const v2 = enregistrer(dailyBlocks(jourV1), []);
    expect(() => contrat.rejouer(niveau, v2)).toThrow(/pas celle de ce jour/);
    const niveauV2 = await contrat.niveauDuJour(jourV1 + 1);
    expect(() => contrat.rejouer(niveauV2, ref.code)).toThrow();
  });
});
