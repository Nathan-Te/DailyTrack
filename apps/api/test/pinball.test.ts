import { daysFromCivil, formatDay } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, DUREE_MAX_TICKS, MAX_EVENEMENTS, DROITE, GAUCHE, LANCEUR, dailyPinball, enregistrer, figerJour, jouer, jouerRobot, graineDuRobot, scoreParColonnes, seuilsDe, seuilsValides, themeDuJour, planDuJour, NB_PLANS, IDS_PLANS, type Evenement } from "@cdj/pinball-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_PINBALL } from "../scripts/pinball-essais";
import { contenuDePinball } from "../src/pinball";
import { crc32Hex } from "../src/identity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot PB1 — « Pinball » sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), **rejoue les événements des commandes jusqu'à la fin de la partie** (dernière bille perdue, ou quinze minutes),
// classe au score du plus grand au plus petit (puis la durée), refuse les copies et les rediffusions abîmées ou trop longues, range l'aperçu à part, efface un joueur, filtre « Mon groupe » et lit le jour figé de l'image
// (ses seuils comptent, jamais ceux du calcul). SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });
/** Une rediffusion valide et courte : le lanceur tenu 0,5 s, relâché. */
const VALIDE: Evenement[] = [{ tick: 30, c: LANCEUR, enfonce: true }, { tick: 330, c: LANCEUR, enfonce: false }];
const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown>; adminToken?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { pinball: options.frozen } : undefined, ...(options.adminToken ? { adminToken: options.adminToken } : {}) });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "pinball");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/pinball/submit", { replay: ESSAIS_PINBALL.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Pinball sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu) : seuils, thème, jamais de preuve", async () => {
    const t = await monter();
    const c = dailyPinball(JOUR);
    const info = await t.call("GET", "/api/pinball/info");
    expect(info.body).toMatchObject({ game: "pinball", simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION, today: DATE });
    const jour = await t.call("GET", `/api/pinball/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.medals).toEqual(seuilsDe(c));
    expect(seuilsValides(jour.body.medals)).toBe(true); // sans fichier de jour : ceux du robot (calculés une fois par table : quelques secondes)
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
    expect((await t.call("GET", "/api/pinball/day/2026-11-11")).status).toBe(404);
  }, 120_000); // lot PBG2 : les seuils du robot (quatre parties de six minutes) sont calculés ici

  it("rejoue chaque partie, classe dans l'ordre de la fiche (le score du plus grand au plus petit) et garde le résultat du serveur", async () => {
    const t = await monter();
    const parties = [[1, 4], [2, 0], [3, 9]] as const;
    const attendus = parties.map(([, v]) => ESSAIS_PINBALL.partie(JOUR, VERSIONS, v).attendu);
    for (const [i, [n, v]] of parties.entries()) {
      const r = await envoyer(t, n, v);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.score).toEqual(attendus[i]);
    }
    const board = await t.call("GET", `/api/pinball/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as ({ name: string; score: number; ticks: number; medal: string | null })[];
    const attendu = parties.map(([n], i) => ({ n: `Joueur${n}`, score: attendus[i]!.score!, ticks: attendus[i]!.ticks! })).sort((a, b) => b.score - a.score || a.ticks - b.ticks);
    expect(lignes.map((l) => l.name)).toEqual(attendu.map((x) => x.n));
    for (let i = 1; i < lignes.length; i++) expect(lignes[i - 1]!.score).toBeGreaterThanOrEqual(lignes[i]!.score);
    expect(board.body.me).toMatchObject({ name: "Joueur3" });
  });

  it("lot PB3 : le module d'essais joue les quatre thèmes (éléments, missions) et le serveur retrouve les mêmes scores ; lot PBG1 : sur tous les plans (rampes, orbite, combo, mini-batteur)", async () => {
    // lot PB4 : les jours sont figés (leurs seuils sont ceux du fichier) : le robot ne calcule pas les seuils de seize tables à chaque jour de ce test
    const figes = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [formatDay(JOUR + i), figerJour(JOUR + i, { bronze: 1000, silver: 3000, gold: 8000, author: 20000 })]));
    const t = await monter({ frozen: figes });
    const themes = new Set<string>();
    const plans = new Set<string>();
    let n = 20;
    // les jours qui suivent : on avance l'horloge du serveur d'un jour à chaque fois (un jour n'est ouvert qu'à son jour de Paris)
    for (let i = 0; themes.size < 4 || plans.size < NB_PLANS || i < 8; i++) {
      const jour = JOUR + i;
      t.clock.now = jour * DAY_MS + 12 * 3_600_000;
      themes.add(themeDuJour(jour));
      plans.add(planDuJour(jour).id);
      const date = formatDay(jour);
      for (const variante of [0, 3]) {
        const essai = ESSAIS_PINBALL.partie(jour, VERSIONS, variante);
        const r = await t.call("POST", "/api/pinball/submit", { replay: essai.rediffusion, name: `Joueur${n}` }, { headers: entete(n) });
        n++;
        expect(r.status, `${date} (${themeDuJour(jour)}) : ${JSON.stringify(r.body)}`).toBe(200);
        expect(r.body.score, `${date} (${themeDuJour(jour)})`).toEqual(essai.attendu);
      }
    }
    expect([...themes].sort()).toEqual(["espace", "foire", "ocean", "volcan"]);
    expect([...plans].sort()).toEqual([...IDS_PLANS].sort());
  });

  it("lot PBG2 : une partie qui passe par une multibille (verrou, trois billes, jackpots, mission du niveau suivant) : le serveur rejoue les mêmes événements et retrouve le même score", async () => {
    const t = await monter({ frozen: { [DATE]: figerJour(JOUR, { bronze: 1000, silver: 3000, gold: 8000, author: 20000 }) } });
    const c = dailyPinball(JOUR);
    const r = jouerRobot(c, 7, { maxTicks: 216000 }); // 6 minutes du robot
    expect(r.partie.multibilles, "la partie passe par une multibille").toBeGreaterThanOrEqual(1);
    expect(r.partie.jackpotsPartie).toBeGreaterThanOrEqual(1);
    const attendu = scoreParColonnes(jouer(c, r.evenements));
    const rep = await t.call("POST", "/api/pinball/submit", { replay: enregistrer(c, r.evenements), name: "Multi" }, { headers: entete(77) });
    expect(rep.status, JSON.stringify(rep.body)).toBe(200);
    expect(rep.body.score).toEqual(attendu);
    expect(attendu.score).toBeGreaterThanOrEqual(r.partie.score); // le serveur joue la fin de la partie : jamais moins que ce que le robot avait déjà
  }, 60_000);

  it("lot PBG3 : une partie où la porte est franchie, le poteau renvoie une bille et l'aiguillage dérive une bille : le serveur rejoue les mêmes événements et retrouve le même score", async () => {
    // le 03/11/2026 (volcan, table B) : la partie du robot de 3 minutes (graine 1) passe une fois la porte, est sauvée une fois par le poteau, dérivée 7 fois par l'aiguillage (golden : « robot-deblocages »)
    const jour = daysFromCivil(2026, 11, 3);
    const t = await monter({ frozen: { [DATE]: figerJour(JOUR, { bronze: 1000, silver: 3000, gold: 8000, author: 20000 }) } });
    t.clock.now = jour * DAY_MS + 12 * 3_600_000;
    await ouvrirJeu(t, "pinball");
    const c = dailyPinball(jour);
    const r = jouerRobot(c, graineDuRobot(1), { maxTicks: 108000 });
    expect(r.partie.passages, "la porte est franchie").toBeGreaterThanOrEqual(1);
    expect(r.partie.sauvetages, "le poteau renvoie une bille").toBeGreaterThanOrEqual(1);
    expect(r.partie.aiguillages, "l'aiguillage dérive une bille").toBeGreaterThanOrEqual(1);
    const attendu = scoreParColonnes(jouer(c, r.evenements));
    const rep = await t.call("POST", "/api/pinball/submit", { replay: enregistrer(c, r.evenements), name: "Deblocages" }, { headers: entete(78) });
    expect(rep.status, JSON.stringify(rep.body)).toBe(200);
    expect(rep.body.score).toEqual(attendu);
    expect(attendu.score).toBeGreaterThanOrEqual(r.partie.score);
  }, 120_000);

  it("range la durée de la partie (en pas) comme départage, à côté du score (cle1 = −score, cle2 = pas)", async () => {
    const t = await monter();
    expect((await envoyer(t, 1, 3)).status).toBe(200);
    const attendu = ESSAIS_PINBALL.partie(JOUR, VERSIONS, 3).attendu;
    expect(attendu.score).toBeGreaterThan(0);
    const cles = await t.db.all<{ cle1: number; cle2: number }>("SELECT cle1, cle2 FROM resultats_jeu WHERE jeu = 'pinball'");
    expect(cles).toEqual([{ cle1: -attendu.score!, cle2: attendu.ticks! }]);
  });

  it("refuse les copies (deux fois les mêmes événements), les rediffusions illisibles, trafiquées, trop longues et les autres jours", async () => {
    const t = await monter({ copies: false });
    const c = dailyPinball(JOUR);
    expect((await envoyer(t, 1, 2)).status).toBe(200);
    const copie = await envoyer(t, 2, 2);
    expect(copie.status).toBe(409);
    expect(copie.body.error).toBe("replay_copy");
    const refuse = async (n: number, replay: string, erreur: string) => expect((await t.call("POST", "/api/pinball/submit", { replay, name: `X${n}` }, { headers: entete(n) })).body.error, `${n}`).toBe(erreur);
    await refuse(4, "pas-une-rediffusion", "invalid_replay");
    await refuse(5, "A".repeat(70000), "invalid_replay"); // trop de caractères
    const bon = enregistrer(c, VALIDE);
    await refuse(6, bon.slice(0, bon.length - 2), "invalid_replay"); // tronquée
    await refuse(7, bon.replace(/.$/, "!"), "invalid_replay"); // un caractère hors alphabet
    const trop: Evenement[] = Array.from({ length: MAX_EVENEMENTS + 2 }, (_, i) => ({ tick: i * 2, c: GAUCHE, enfonce: i % 2 === 0 }));
    await refuse(8, enregistrer(c, trop), "invalid_replay"); // trop d'événements
    await refuse(9, enregistrer(c, [{ tick: DUREE_MAX_TICKS + 5, c: GAUCHE, enfonce: true }]), "invalid_replay"); // un appui après les quinze minutes
    await refuse(12, enregistrer(c, [{ tick: 5, c: DROITE, enfonce: true }, { tick: 9, c: DROITE, enfonce: true }]), "invalid_replay"); // un double appui
    expect((await t.call("POST", "/api/pinball/submit", { replay: enregistrer(dailyPinball(JOUR - 1), []), name: "Hier" }, { headers: entete(10) })).status).toBe(409);
    expect((await t.call("POST", "/api/pinball/submit", { name: "Sans" }, { headers: entete(11) })).status).toBeGreaterThanOrEqual(400);
  });

  it("le score vient du seul rejeu : une rediffusion ne peut pas annoncer mieux que ce qu'elle joue", async () => {
    const t = await monter();
    const c = dailyPinball(JOUR);
    const replay = enregistrer(c, VALIDE);
    const r = await t.call("POST", "/api/pinball/submit", { replay, name: "Menteur", score: 999999, ticks: 1 }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(c, VALIDE)));
  });

  it("une partie vide est rejouée jusqu'à sa fin (les quinze minutes, zéro point), classée la dernière", async () => {
    const t = await monter();
    const c = dailyPinball(JOUR);
    await envoyer(t, 2, 3);
    const r = await t.call("POST", "/api/pinball/submit", { replay: enregistrer(c, []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(jouer(c, [])));
    const board = await t.call("GET", `/api/pinball/day/${DATE}/board`);
    expect((board.body.top as { name: string }[]).at(-1)!.name).toBe("Rêveur");
  });

  it("lit le jour figé de l'image s'il se vérifie ; ses seuils figés l'emportent sur le calcul ; un fichier abîmé est ignoré", async () => {
    const fige = figerJour(JOUR, { bronze: 111, silver: 222, gold: 333, author: 444 });
    expect(contenuDePinball(JOUR, { [DATE]: fige }).seuilsFiges).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    const abime = { ...fige, contenu: { ...fige.contenu, empreinte: "00000000" } };
    expect(contenuDePinball(JOUR, { [DATE]: abime }).seuilsFiges).toBeUndefined();
    const t = await monter({ frozen: { [DATE]: fige } });
    expect((await t.call("GET", "/api/pinball/info")).body.frozenDays).toEqual([DATE]);
    expect((await t.call("GET", `/api/pinball/day/${DATE}`)).body.medals).toEqual({ bronze: 111, silver: 222, gold: 333, author: 444 });
    const r = await envoyer(t, 1, 0);
    expect(r.body.medal).toBe("author"); // 444 points suffisent au Diamant figé
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/pinball/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/pinball/info")).body.error).toBe("game_unavailable");
  });

  it("aperçu de PR : la partie est rangée à part, n'est dans aucun classement ; effacée quand le jeu passe `on`", async () => {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, environment: "recette" });
    t.clock.now = MIDI;
    await t.call("GET", "/api/health");
    const rep = ESSAIS_PINBALL.partie(JOUR, VERSIONS, 2).rediffusion;
    expect((await t.call("POST", "/api/pinball/submit", { replay: rep, name: "Joueur1" }, { headers: entete(1) })).body.error).toBe("game_unavailable"); // `off`, sans la clé d'un aperçu
    const r = await t.call("POST", "/api/pinball/submit", { replay: rep, name: "Joueur1" }, { headers: { ...entete(1), ...hotePr } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM resultats_jeu WHERE jeu = 'pinball' AND player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/pinball/day/${DATE}/board`, undefined, { headers: { ...hotePr, ...entete(2) } })).body).toMatchObject({ participants: 0, top: [] });
  });

  it("effacement d'un joueur : ses parties (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monter({ adminToken: TOKEN });
    await envoyer(t, 1, 0);
    await envoyer(t, 2, 4);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const parties = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM resultats_jeu WHERE jeu = 'pinball'"))!.n;
    expect((await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect(await parties()).toBe(2); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(await parties()).toBe(1);
    expect((await t.call("GET", `/api/pinball/day/${DATE}/board`, undefined, { headers: entete(2) })).body.me.rank).toBe(1);
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
    const r = await appel(2, "GET", `/api/pinball/day/${DATE}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 2 });
    expect((r.body.top as { name: string }[]).map((l) => l.name).sort()).toEqual(["Joueur1", "Joueur2"]);
  });
});
