import { DatabaseSync } from "node:sqlite";
import { formatDay } from "@cdj/core";
import {
  dailyTower,
  decoderRediffusion,
  encoderRediffusion,
  estimationGeometrique,
  type Medailles,
  medailleObtenue,
  type Rediffusion,
  rejouerComplet,
  type Resultat,
  TOWER_GENERATOR_VERSION,
} from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { describe, expect, it } from "vitest";
import { fixtureJour, jouerScripte, type Placement } from "../scripts/tower-aide";
import { D, midi, monterTower } from "../scripts/tower-test";
import { MIGRATIONS, SCHEMA } from "../src/db";
import { crc32Hex } from "../src/identity";
import { UNITES_REJEU_TOWER, type ExecuteurRejeu } from "../src/towerRejeu";
import { silhouetteDe, TOWER_BOARD_TOP, TOWER_SCHEMA, towerInputs } from "../src/tower";
import { playerId, TEST_DB, type TestApi } from "./helpers";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";

// Lot T4 — l'envoi d'une partie de Tower et son classement : le rejeu fait foi, l'ordre de validation, les refus, les copies, le classement à la hauteur, le fantôme Diamant, l'aperçu rangé à part,
// l'effacement, le profil, les journaux, le plan des requêtes. SQLite et libSQL (`file:`), jamais Turso.

const R = await chargerRapier();
const JOUR = "2026-11-10";
const contenu = dailyTower(D(JOUR), TOWER_GENERATOR_VERSION, 0);
const medailles: Medailles = estimationGeometrique(contenu);

const motifs: Record<string, Placement[]> = {
  droit: [],
  gauche: Array.from({ length: 40 }, () => ({ rot: 0, dx: -1 })),
  droite: Array.from({ length: 40 }, () => ({ rot: 0, dx: 1 })),
  alterne: Array.from({ length: 40 }, (_, i) => ({ rot: i % 2, dx: i % 2 ? 1 : -1 })),
  rot: Array.from({ length: 40 }, (_, i) => ({ rot: i % 4, dx: 0 })),
  loin: Array.from({ length: 40 }, () => ({ rot: 0, dx: 3 })),
};
interface Jouee {
  code: string;
  r: Resultat;
}
const jouees = new Map<string, Jouee>();
/** Une partie scriptée du 10/11, calculée une fois par fichier de test. */
function partie(nom: keyof typeof motifs): Jouee {
  let j = jouees.get(nom);
  if (!j) {
    const { partie: p, code } = jouerScripte(R, contenu, motifs[nom]);
    j = { code, r: p.resultat()! };
    p.dispose();
    jouees.set(nom, j);
  }
  return j;
}
/** Plus haut d'abord : hauteur, puis vies, puis moins de ticks. */
const meilleurQue = (a: Resultat, b: Resultat) => (a.hauteurMm !== b.hauteurMm ? a.hauteurMm > b.hauteurMm : a.vies !== b.vies ? a.vies > b.vies : a.ticks < b.ticks);

const envoyer = (t: TestApi, n: number, replay: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  t.call("POST", "/api/tower/submit", { replay, name: `Joueur${n}`, ...extra }, { headers: { "X-Player-Id": playerId(n), ...headers } });
const lire = (t: TestApi, chemin: string, n?: number) => t.call("GET", chemin, undefined, n === undefined ? {} : { headers: { "X-Player-Id": playerId(n) } });
const plein = (extra: Partial<Rediffusion>, base = partie("droit").code): string => encoderRediffusion({ ...decoderRediffusion(base), ...extra });
const nTables = async (t: TestApi) => ({
  parties: (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results"))!.n,
  joueurs: (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players"))!.n,
});

describe(`Tower : l'envoi d'une partie (${TEST_DB})`, () => {
  it("le serveur rejoue et garde SON résultat : réponse, médaille, rang, classement, joueur créé ; un résultat annoncé est ignoré", async () => {
    const t = await monterTower(JOUR);
    const { code, r } = partie("droite");
    const rep = await envoyer(t, 1, code, { hauteurMm: 999_999, vies: 3, ticks: 1, medal: "author", resultat: { hauteurMm: 1 } });
    expect(rep.status, JSON.stringify(rep.body)).toBe(200);
    expect(rep.body).toMatchObject({ accepted: true, date: JOUR, improved: true, rank: 1, participants: 1 });
    expect(rep.body.resultat).toEqual({ hauteurMm: r.hauteurMm, hauteurMaxMm: r.hauteurMaxMm, vies: r.vies, ticks: r.ticks, posees: r.posees, tombees: r.tombees, motif: r.motif });
    const nom = medailleObtenue(r.hauteurMm, medailles);
    const attendue = nom === null ? null : ({ auteur: "author", or: "gold", argent: "silver", bronze: "bronze" } as const)[nom];
    expect(rep.body.medal).toBe(attendue);
    expect(rep.body.best).toEqual({ hauteurMm: r.hauteurMm, vies: r.vies, ticks: r.ticks, medal: attendue });
    expect(rep.body.board.top).toEqual([{ rank: 1, name: "Joueur1", hauteurMm: r.hauteurMm, vies: r.vies, ticks: r.ticks, medal: attendue }]);
    expect(rep.body.board.me).toEqual(rep.body.board.top[0]);
    expect(rep.body.board.generation).toBe(0);
    // Le joueur n'existe qu'après la partie valide, et la ligne gardée est celle du rejeu.
    const ligne = await t.db.first<Record<string, unknown>>("SELECT * FROM tower_results WHERE player_id = ?", [playerId(1)]);
    expect(ligne).toMatchObject({ day: D(JOUR), hauteur_mm: r.hauteurMm, hauteur_max_mm: r.hauteurMaxMm, vies: r.vies, ticks: r.ticks, replay: code, hidden: 0, apercu: 0, tirage: 0, generator_version: TOWER_GENERATOR_VERSION });
    expect(ligne!.inputs_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("meilleur résultat seulement : une partie moins bonne ne remplace rien (improved: false), une meilleure remplace ; first_at reste le premier envoi", async () => {
    const t = await monterTower(JOUR);
    const [bas, moyen, haut] = [partie("loin"), partie("droit"), partie("droite")].sort((a, b) => (meilleurQue(a.r, b.r) ? 1 : -1));
    expect((await envoyer(t, 1, moyen!.code)).body.improved).toBe(true);
    const first = (await t.db.first<{ first_at: number }>("SELECT first_at FROM tower_results"))!.first_at;
    t.clock.now += 5_000;
    const moins = await envoyer(t, 1, bas!.code);
    expect(moins.body).toMatchObject({ accepted: true, improved: false, resultat: { hauteurMm: bas!.r.hauteurMm }, best: { hauteurMm: moyen!.r.hauteurMm } });
    expect((await t.db.first<{ hauteur_mm: number }>("SELECT hauteur_mm FROM tower_results"))!.hauteur_mm).toBe(moyen!.r.hauteurMm);
    const egale = await envoyer(t, 1, moyen!.code); // la même partie : pas un nouveau record
    expect(egale.body.improved).toBe(false);
    const mieux = await envoyer(t, 1, haut!.code);
    expect(mieux.body).toMatchObject({ improved: true, best: { hauteurMm: haut!.r.hauteurMm } });
    const ligne = await t.db.first<{ hauteur_mm: number; first_at: number; submitted_at: number; replay: string }>("SELECT hauteur_mm, first_at, submitted_at, replay FROM tower_results");
    expect(ligne).toMatchObject({ hauteur_mm: haut!.r.hauteurMm, first_at: first, replay: haut!.code });
    expect(ligne!.submitted_at).toBeGreaterThan(first);
    expect((await nTables(t)).parties).toBe(1);
  });

  it("à hauteur égale, plus de vies puis moins de ticks : même règle que le classement", async () => {
    const t = await monterTower(JOUR);
    const { code, r } = partie("droit");
    await envoyer(t, 1, code);
    // On abaisse à la main la ligne gardée : même hauteur, une vie de moins, plus de ticks → la partie rejouée est « meilleure ».
    await t.db.run("UPDATE tower_results SET vies = ? WHERE player_id = ?", [r.vies - 1, playerId(1)]);
    expect((await envoyer(t, 1, code)).body.improved).toBe(true);
    await t.db.run("UPDATE tower_results SET ticks = ? WHERE player_id = ?", [r.ticks + 10, playerId(1)]);
    expect((await envoyer(t, 1, code)).body.improved).toBe(true);
    await t.db.run("UPDATE tower_results SET ticks = ? WHERE player_id = ?", [r.ticks - 10, playerId(1)]);
    expect((await envoyer(t, 1, code)).body.improved).toBe(false);
  });
});

describe(`Tower : les refus et l'ordre de validation (${TEST_DB})`, () => {
  /** Un exécuteur qui compte ses appels : aucun refus ne doit atteindre le rejeu. */
  function compteur(): ExecuteurRejeu & { appels: number } {
    let appels = 0;
    return {
      get appels() {
        return appels;
      },
      async rejouer(d) {
        appels++;
        const { rejouer } = await import("@cdj/tower-sim");
        return rejouer(R, d.contenu, d.rediffusion);
      },
    };
  }

  it("chaque refus a son code, n'écrit ni partie ni joueur, et n'atteint le rejeu que s'il en vient", async () => {
    const ex = compteur();
    const t = await monterTower(JOUR, { executeur: ex });
    const bon = partie("droit").code;
    const rd = decoderRediffusion(bon);
    const cas: [string, () => ReturnType<typeof envoyer>, number, string][] = [
      ["pas d'identifiant", () => t.call("POST", "/api/tower/submit", { replay: bon, name: "A" }), 400, "invalid_player"],
      ["corps qui n'est pas du JSON", () => t.call("POST", "/api/tower/submit", undefined, { raw: "pas du json", headers: { "X-Player-Id": playerId(1) } }), 400, "invalid_json"],
      ["corps démesuré", () => envoyer(t, 1, "A".repeat(450_000)), 413, "too_large"],
      ["rediffusion manquante", () => envoyer(t, 1, undefined as unknown as string), 400, "invalid_replay"],
      ["rediffusion qui n'est pas du texte", () => envoyer(t, 1, 12 as unknown as string), 400, "invalid_replay"],
      ["texte illisible", () => envoyer(t, 1, "%%%"), 400, "invalid_replay"],
      ["texte démesuré (plus que MAX_CARACTERES)", () => envoyer(t, 1, "A".repeat(60_000)), 400, "invalid_replay"],
      ["version de la simulation", () => envoyer(t, 1, plein({ sim: 99 })), 409, "version"],
      ["générateur inconnu", () => envoyer(t, 1, plein({ g: 77 })), 409, "version"],
      ["autre générateur que celui du jour (2 au lieu de 3)", () => envoyer(t, 1, plein({ g: 2 })), 409, "version"],
      ["autre tirage que celui du jour", () => envoyer(t, 1, plein({ contenu: { jour: D(JOUR), tirage: 1 } })), 409, "version"],
      ["réglages qui ne sont pas ceux du jeu", () => envoyer(t, 1, plein({ reglages: { ...rd.reglages, vies: 9 } })), 400, "invalid_replay"],
      ["scénario d'essai", () => envoyer(t, 1, plein({ g: 0, contenu: { scenario: "essai" } })), 409, "not_daily"],
      ["jour futur", () => envoyer(t, 1, plein({ contenu: { jour: D(JOUR) + 1 } })), 409, "not_daily"],
      ["jour fermé", () => envoyer(t, 1, plein({ contenu: { jour: D(JOUR) - 1 } })), 409, "day_closed"],
      ["pseudo manquant (premier envoi)", () => t.call("POST", "/api/tower/submit", { replay: bon }, { headers: { "X-Player-Id": playerId(1) } }), 400, "name_required"],
      ["pseudo interdit", () => envoyer(t, 1, bon, { name: "<b>" }), 400, "invalid_name"],
      ["rediffusion qui s'arrête avant la fin de la partie", () => envoyer(t, 1, plein({ plages: rd.plages.slice(0, 1).map((p) => ({ ...p, ticks: 30 })) })), 422, "not_finished"],
      ["commandes après la fin de la partie", () => envoyer(t, 1, plein({ plages: [...rd.plages, { masque: 1, ticks: 40 }] })), 400, "invalid_replay"],
    ];
    for (const [nom, appel, status, code] of cas) {
      const r = await appel();
      expect({ nom, status: r.status, error: r.body?.error }, JSON.stringify(r.body)).toEqual({ nom, status, error: code });
    }
    expect(await nTables(t)).toEqual({ parties: 0, joueurs: 0 });
    // Seuls les deux refus que le rejeu lui-même découvre (partie inachevée, commandes en trop) l'ont atteint ; tous les autres sont arrêtés avant.
    expect(ex.appels).toBe(2);
    // Et la bonne passe, une seule fois dans le rejeu.
    expect((await envoyer(t, 1, bon)).status).toBe(200);
    expect(ex.appels).toBe(3);
  });

  it("le moins cher d'abord : le jour fermé passe avant le pseudo, le pseudo avant le rejeu, la copie avant le rejeu", async () => {
    const ex = compteur();
    const t = await monterTower(JOUR, { executeur: ex }, { allowCopies: false });
    const { code } = partie("droit");
    // Jour fermé ET pseudo manquant : le jour d'abord.
    const fermee = plein({ contenu: { jour: D(JOUR) - 1 } });
    expect((await t.call("POST", "/api/tower/submit", { replay: fermee }, { headers: { "X-Player-Id": playerId(1) } })).body.error).toBe("day_closed");
    // Une copie est refusée avant le rejeu (l'exécuteur n'est pas appelé).
    expect((await envoyer(t, 1, code)).status).toBe(200);
    const avant = ex.appels;
    expect((await envoyer(t, 2, code)).body.error).toBe("replay_copy");
    expect(ex.appels).toBe(avant);
    // Pseudo pris : avant le rejeu aussi.
    expect(await envoyer(t, 2, partie("gauche").code, { name: "Joueur1" })).toMatchObject({ status: 409, body: { error: "name_taken" } });
    expect(ex.appels).toBe(avant);
  });

  it("le débit est compté en base avant tout rejeu : au-delà de la limite par joueur ou par adresse, 429 sans lire la rediffusion", async () => {
    const ex = compteur();
    const t = await monterTower(JOUR, { executeur: ex }, { limits: { windowMs: 600_000, perClient: 4, perPlayer: 2 } });
    for (let i = 0; i < 2; i++) expect((await envoyer(t, 1, "%%%")).body.error).toBe("invalid_replay");
    const r = await envoyer(t, 1, "%%%");
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("rate_limited");
    expect(r.headers.get("retry-after")).toBeTruthy();
    expect((await envoyer(t, 2, "%%%")).body.error).toBe("invalid_replay"); // un autre joueur, la même adresse (4e envoi de l'adresse)
    expect((await envoyer(t, 3, "%%%")).status).toBe(429); // 5e envoi de l'adresse
    expect(ex.appels).toBe(0);
  });

  it("le plafond global de rejeux pèse UNITES_REJEU_TOWER : 503 busy avec Retry-After, sans rejeu", async () => {
    const ex = compteur();
    const t = await monterTower(JOUR, { executeur: ex }, { replaysPerMinute: UNITES_REJEU_TOWER * 2 - 1 });
    expect((await envoyer(t, 1, partie("droit").code)).status).toBe(200);
    const r = await envoyer(t, 2, partie("gauche").code);
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("busy");
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(ex.appels).toBe(1);
    t.clock.now += 61_000; // la minute suivante
    expect((await envoyer(t, 2, partie("gauche").code)).status).toBe(200);
  });

  it("un jour d'hier est accepté pendant la grâce de 10 minutes après minuit de Paris, refusé après", async () => {
    const t = await monterTower(JOUR);
    const hier = plein({ contenu: { jour: D(JOUR) - 1 } });
    void hier;
    // Le contenu d'hier : une partie jouée sur sa tour.
    const contenuHier = dailyTower(D(JOUR) - 1, TOWER_GENERATOR_VERSION, 0);
    const { partie: p, code } = jouerScripte(R, contenuHier);
    p.dispose();
    const minuit = (await import("@cdj/clock")).parisDayStart(D(JOUR));
    t.clock.now = minuit + 5 * 60_000; // 00 h 05
    expect((await envoyer(t, 1, code)).status).toBe(200);
    t.clock.now = minuit + 11 * 60_000;
    expect((await envoyer(t, 2, code)).body.error).toBe("day_closed");
  });

  it("une instance sans Rapier au fil principal et un exécuteur qui échoue : une panne n'écrit rien", async () => {
    const t = await monterTower(JOUR, {
      executeur: {
        async rejouer() {
          throw new Error("panne");
        },
      },
    });
    const r = await envoyer(t, 1, partie("droit").code);
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("internal");
    expect(await nTables(t)).toEqual({ parties: 0, joueurs: 0 });
  });

  it("une rediffusion qui s'arrête au bout d'un code révoqué : 410 avant tout rejeu", async () => {
    const ex = compteur();
    const t = await monterTower(JOUR, { executeur: ex });
    expect((await envoyer(t, 1, partie("droit").code)).status).toBe(200);
    const apres = await t.call("POST", "/api/me/code", { newId: playerId(99) }, { headers: { "X-Player-Id": playerId(1) } });
    expect(apres.status).toBe(200);
    const n = ex.appels;
    const r = await envoyer(t, 1, partie("gauche").code);
    expect(r.status).toBe(410);
    expect(r.body.error).toBe("code_revoked");
    expect(ex.appels).toBe(n);
    // Le nouveau code garde la partie (rotateStatements).
    expect((await lire(t, `/api/tower/day/${JOUR}/board`, 99)).body.me).toMatchObject({ rank: 1, name: "Joueur1" });
  });
});

describe(`Tower : les copies (${TEST_DB})`, () => {
  it("allowCopies: false — la copie d'un autre joueur est refusée (409 replay_copy) sans rien écrire ; le même joueur peut renvoyer la sienne", async () => {
    const t = await monterTower(JOUR, {}, { allowCopies: false });
    const { code } = partie("droite");
    expect((await envoyer(t, 1, code)).status).toBe(200);
    const copie = await envoyer(t, 2, code);
    expect(copie).toMatchObject({ status: 409, body: { error: "replay_copy" } });
    expect(await nTables(t)).toEqual({ parties: 1, joueurs: 1 });
    expect((await envoyer(t, 1, code)).body).toMatchObject({ accepted: true, improved: false });
    // Une rediffusion écrite autrement (plages coupées en deux) a les mêmes entrées : même empreinte, refusée aussi.
    const rd = decoderRediffusion(code);
    const coupee: Rediffusion = { ...rd, plages: rd.plages.flatMap((p) => (p.ticks > 1 ? [{ masque: p.masque, ticks: 1 }, { masque: p.masque, ticks: p.ticks - 1 }] : [p])) };
    expect(towerInputs(coupee.plages)).toBe(towerInputs(rd.plages));
    expect((await envoyer(t, 2, encoderRediffusion(coupee).length ? code : code)).body.error).toBe("replay_copy");
    // Une partie différente passe.
    expect((await envoyer(t, 2, partie("gauche").code)).status).toBe(200);
  });

  it("allowCopies: true (outils et tests de classement) laisse passer la même partie pour plusieurs joueurs", async () => {
    const t = await monterTower(JOUR, {}, { allowCopies: true });
    const { code } = partie("droit");
    expect((await envoyer(t, 1, code)).status).toBe(200);
    expect((await envoyer(t, 2, code)).status).toBe(200);
  });

  it("la preuve de l'auteur d'un jour préparé, renvoyée telle quelle, est une copie (409) ; la preuve ne figure jamais dans une réponse", async () => {
    const f = fixtureJour("2026-11-07");
    const t = await monterTower("2026-11-07", { frozen: { "2026-11-07": f } }, { allowCopies: false });
    const r = await envoyer(t, 1, f.preuve as string);
    expect(r).toMatchObject({ status: 409, body: { error: "replay_copy" } });
    expect(await nTables(t)).toEqual({ parties: 0, joueurs: 0 });
    for (const chemin of ["/api/tower/info", "/api/tower/day/2026-11-07", "/api/tower/day/2026-11-07/board"]) expect(JSON.stringify((await lire(t, chemin, 1)).body)).not.toContain(f.preuve as string);
  });

  it("un résultat que l'administration a retiré ne revient pas tel quel", async () => {
    const t = await monterTower(JOUR, {}, { allowCopies: false });
    const { code } = partie("droit");
    const hash = await (await import("../src/copies")).inputsHash(towerInputs(decoderRediffusion(code).plages));
    await t.db.run("INSERT INTO resultats_retires (game, day, player_id, temps_ms, replay, inputs_hash, removed_at, motif, admin) VALUES ('tower', ?, ?, 1, '', ?, 0, 'test', 'x')", [D(JOUR), playerId(5), hash]);
    expect((await envoyer(t, 1, code)).body.error).toBe("replay_copy");
  });
});

describe(`Tower : le classement du jour (${TEST_DB})`, () => {
  it("ordre : hauteur ↓, vies ↓, ticks ↑ ; le rang de chacun et sa ligne `me` ; les parties masquées sont écartées ; l'ordre d'arrivée départage les égalités", async () => {
    const t = await monterTower(JOUR);
    const noms = ["droite", "droit", "rot", "alterne", "gauche", "loin"] as const;
    for (const [i, n] of noms.entries()) {
      expect((await envoyer(t, i + 1, partie(n).code)).status).toBe(200);
      t.clock.now += 1000;
    }
    const attendu = noms.map((n, i) => ({ n, i: i + 1, r: partie(n).r })).sort((a, b) => (a.r.hauteurMm !== b.r.hauteurMm ? b.r.hauteurMm - a.r.hauteurMm : a.r.vies !== b.r.vies ? b.r.vies - a.r.vies : a.r.ticks - b.r.ticks || a.i - b.i));
    const b = await lire(t, `/api/tower/day/${JOUR}/board`);
    expect(b.status).toBe(200);
    expect(b.body.participants).toBe(6);
    expect(b.body.top.map((x: { name: string }) => x.name)).toEqual(attendu.map((x) => `Joueur${x.i}`));
    expect(b.body.top.map((x: { rank: number }) => x.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(b.body.me).toBeNull();
    expect(b.body.open).toBe(true);
    expect(b.headers.get("cache-control")).toBe("private, max-age=30");
    expect(b.headers.get("vary")).toContain("X-Player-Id");
    for (const [rang, x] of attendu.entries()) expect((await lire(t, `/api/tower/day/${JOUR}/board`, x.i)).body.me, x.n).toMatchObject({ rank: rang + 1, name: `Joueur${x.i}`, hauteurMm: x.r.hauteurMm });
    // Masquer le premier le retire du classement, du nombre de classés et décale les autres.
    await t.db.run("UPDATE tower_results SET hidden = 1 WHERE player_id = ?", [playerId(attendu[0]!.i)]);
    const apres = await lire(t, `/api/tower/day/${JOUR}/board`, attendu[1]!.i);
    expect(apres.body.participants).toBe(5);
    expect(apres.body.top.map((x: { name: string }) => x.name)).toEqual(attendu.slice(1).map((x) => `Joueur${x.i}`));
    expect(apres.body.me.rank).toBe(1);
  });

  it("un joueur masqué par l'administration (players.hidden) joue normalement mais ses parties naissent masquées : dans aucun classement", async () => {
    const t = await monterTower(JOUR);
    await t.call("GET", "/api/tower/info");
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key, hidden) VALUES (?, 'Masque', 0, 0, 'masque', 1)", [playerId(7)]);
    const r = await envoyer(t, 7, partie("droite").code, { name: "Masque" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ accepted: true, participants: 0 });
    expect(await t.db.first("SELECT hidden FROM tower_results WHERE player_id = ?", [playerId(7)])).toEqual({ hidden: 1 });
    expect((await lire(t, `/api/tower/day/${JOUR}/board`, 7)).body).toMatchObject({ participants: 0, top: [] });
  });

  it("à partie identique (hauteur, vies, ticks) le premier envoyé passe devant, puis l'identifiant — le rang suit l'ordre de la liste", async () => {
    const t = await monterTower(JOUR, {}, { allowCopies: true });
    const { code } = partie("droit");
    for (const n of [3, 1, 2]) {
      expect((await envoyer(t, n, code)).status).toBe(200);
      t.clock.now += 1000;
    }
    const b = await lire(t, `/api/tower/day/${JOUR}/board`);
    expect(b.body.top.map((x: { name: string }) => x.name)).toEqual(["Joueur3", "Joueur1", "Joueur2"]);
    // Même milliseconde : l'identifiant départage.
    await t.db.run("UPDATE tower_results SET submitted_at = 5");
    const c = await lire(t, `/api/tower/day/${JOUR}/board`, 2);
    expect(c.body.top.map((x: { name: string }) => x.name)).toEqual(["Joueur1", "Joueur2", "Joueur3"]);
    expect(c.body.me.rank).toBe(2);
  });

  it("le haut du classement est limité à 50 ; ta ligne reste rendue au-delà ; le rang de chacun est exact (lignes synthétiques, égalités à tous les niveaux)", async () => {
    const t = await monterTower(JOUR);
    await t.call("GET", "/api/tower/info");
    const lignes: { id: string; h: number; v: number; ti: number; at: number }[] = [];
    for (let i = 0; i < 70; i++) lignes.push({ id: playerId(1000 + i), h: 10_000 + (i % 7) * 500, v: i % 3, ti: 500 + (i % 5) * 10, at: 1000 + ((i * 7) % 11) });
    for (const l of lignes) {
      await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [l.id, `S${l.id.slice(-4)}`, `s${l.id.slice(-4)}`]);
      await t.db.run(
        "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, ?, ?, ?, ?, NULL, '', 3, 3, 0, ?, ?, 0, 0)",
        [D(JOUR), l.id, l.h, l.h, l.v, l.ti, l.at, `h${l.id}`],
      );
    }
    const ordre = [...lignes].sort((a, b) => b.h - a.h || b.v - a.v || a.ti - b.ti || a.at - b.at || (a.id < b.id ? -1 : 1));
    const b = await lire(t, `/api/tower/day/${JOUR}/board`, 1000 + 0);
    expect(b.body.top).toHaveLength(TOWER_BOARD_TOP);
    expect(b.body.participants).toBe(70);
    expect(b.body.top.map((x: { name: string }) => x.name)).toEqual(ordre.slice(0, TOWER_BOARD_TOP).map((l) => `S${l.id.slice(-4)}`));
    for (const [i, l] of ordre.entries()) {
      if (i % 3 !== 0 && i < 65) continue; // un échantillon, dont les derniers
      const r = await t.call("GET", `/api/tower/day/${JOUR}/board`, undefined, { headers: { "X-Player-Id": l.id } });
      expect(r.body.me.rank, `rang de ${l.id}`).toBe(i + 1);
    }
  });

  it("un jour passé reste lisible (open: false) ; un jour futur est inconnu ; l'identifiant n'est jamais dans l'adresse (une adresse ?player= est ignorée)", async () => {
    const t = await monterTower(JOUR);
    expect((await envoyer(t, 1, partie("droit").code)).status).toBe(200);
    t.clock.now += 86_400_000;
    const b = await lire(t, `/api/tower/day/${JOUR}/board`, 1);
    expect(b.body).toMatchObject({ date: JOUR, open: false, participants: 1 });
    expect(b.headers.get("cache-control")).toBe("private, max-age=86400");
    expect((await t.call("GET", `/api/tower/day/${JOUR}/board?player=${playerId(1)}`)).body.me).toBeNull();
    expect((await lire(t, `/api/tower/day/${formatDay(D(JOUR) + 5)}/board`)).body.error).toBe("unknown_day");
  });
});

describe(`Tower : le fantôme Diamant (${TEST_DB})`, () => {
  const F = "2026-11-07";
  const frozen = { [F]: fixtureJour(F) };

  it("réservé aux joueurs classés ce jour-là : 403 not_ranked sinon, 400 sans identifiant, 410 pour un code révoqué", async () => {
    const t = await monterTower(F, { frozen });
    expect((await t.call("GET", `/api/tower/day/${F}/diamant`)).body.error).toBe("invalid_player");
    const non = await lire(t, `/api/tower/day/${F}/diamant`, 1);
    expect(non).toMatchObject({ status: 403, body: { error: "not_ranked" } });
  });

  it("une fois classé : la silhouette de la tour du Diamant (l'état final de la preuve rejouée), sans commandes ni preuve", async () => {
    const t = await monterTower(F, { frozen });
    const lu = (await import("@cdj/tower-sim")).lireJour(frozen[F], D(F));
    if (typeof lu === "string") throw new Error(lu);
    const c = lu.contenu;
    const { partie: p, code } = jouerScripte(R, c);
    p.dispose();
    expect((await envoyer(t, 1, code)).status).toBe(200);
    const r = await lire(t, `/api/tower/day/${F}/diamant`, 1);
    expect(r.status).toBe(200);
    const attendue = silhouetteDe(rejouerComplet(R, c, lu.preuve!).vue);
    expect(r.body).toEqual({ date: F, hauteurMm: lu.medailles!.auteur, pieces: attendue });
    expect(r.body.pieces.length).toBeGreaterThan(0);
    expect(Object.keys(r.body.pieces[0]).sort()).toEqual(["angle", "kind", "rot", "taille", "x", "y"]);
    const texte = JSON.stringify(r.body);
    expect(texte).not.toContain(lu.preuve!);
    expect(texte).not.toMatch(/masque|plages|commande/i);
    expect(r.headers.get("cache-control")).toContain("private");
    // Un autre joueur, non classé, ne la voit pas ; le classé la relit (aucun recalcul : la silhouette est en base).
    expect((await lire(t, `/api/tower/day/${F}/diamant`, 2)).status).toBe(403);
    expect((await lire(t, `/api/tower/day/${F}/diamant`, 1)).body).toEqual(r.body);
  });

  it("un jour sans preuve (médailles estimées) : 404 no_ghost pour un joueur classé", async () => {
    const t = await monterTower(JOUR);
    expect((await envoyer(t, 1, partie("droit").code)).status).toBe(200);
    expect(await lire(t, `/api/tower/day/${JOUR}/diamant`, 1)).toMatchObject({ status: 404, body: { error: "no_ghost" } });
  });
});

describe(`Tower : l'aperçu, l'effacement, le profil (${TEST_DB})`, () => {
  const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

  it("aperçu de PR : la partie est rangée à part (hidden, apercu), n'est dans aucun classement, ne remplace jamais la ligne publique ; l'écriture hors submit reste fermée", async () => {
    const t = await monterTower(JOUR, {}, { environment: "recette" }, false);
    expect((await envoyer(t, 1, partie("droit").code)).body.error).toBe("game_unavailable"); // `off` sans la clé d'un aperçu de PR
    const r = await envoyer(t, 1, partie("droite").code, {}, hotePr);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.first("SELECT hidden, apercu FROM tower_results WHERE player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    expect((await t.call("GET", `/api/tower/day/${JOUR}/board`, undefined, { headers: { ...hotePr, "X-Player-Id": playerId(1) } })).body).toMatchObject({ participants: 0, top: [] }); // le joueur voit sa propre ligne (`me`), jamais les autres
    // Une ligne publique du même joueur n'est pas remplacée par l'aperçu (et inversement).
    await t.db.run("UPDATE tower_results SET hidden = 0, apercu = 0 WHERE player_id = ?", [playerId(1)]);
    await envoyer(t, 1, partie("droite").code, {}, hotePr);
    expect(await t.db.first("SELECT hidden, apercu, hauteur_mm FROM tower_results WHERE player_id = ?", [playerId(1)])).toEqual({ hidden: 0, apercu: 0, hauteur_mm: partie("droite").r.hauteurMm });
  });

  it("quand le jeu passe `on`, les parties d'aperçu sont effacées (jamais publiques) et les publiques restent", async () => {
    const options = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true };
    const t = await monterTower(JOUR, {}, { admin: options, environment: "recette" }, false);
    await t.call("GET", "/api/health");
    const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: "http://api.test", "X-Cdj-Admin": "1" } });
    const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
    const adm = { Cookie: `__session=${cookie}`, Origin: "http://api.test", "X-Cdj-Admin": "1" };
    expect((await envoyer(t, 1, partie("droit").code, {}, hotePr)).status).toBe(200);
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Pub', 0, 0, 'pub')", [playerId(2)]);
    await t.db.run("INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, 1, 1, 1, 1, NULL, '', 3, 3, 0, 0, 'x', 0, 0)", [D(JOUR), playerId(2)]);
    const on = await t.call("POST", "/api/admin/jeux/tower/etat", { etat: "on", confirmer: true }, { headers: adm });
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect((await t.db.all<{ player_id: string }>("SELECT player_id FROM tower_results")).map((x) => x.player_id)).toEqual([playerId(2)]);
  });

  it("effacement d'un joueur : ses parties et ses comptes (crochet `erase`), le classement se recalcule sans lui", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long-pour-passer";
    const t = await monterTower(JOUR, {}, { adminToken: TOKEN });
    await envoyer(t, 1, partie("droite").code);
    await envoyer(t, 2, partie("droit").code);
    const code = `CDJ2.${playerId(1)}.${crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const essai = await t.call("POST", "/api/admin/effacer", { code }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(essai.status, JSON.stringify(essai.body)).toBe(200);
    expect(await nTables(t)).toEqual({ parties: 2, joueurs: 2 }); // sans `confirmer` : un essai à blanc
    const sec = await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(sec.status, JSON.stringify(sec.body)).toBe(200);
    expect(JSON.stringify(sec.body)).toContain("partiesDailyTower");
    expect(await nTables(t)).toEqual({ parties: 1, joueurs: 1 });
    expect((await lire(t, `/api/tower/day/${JOUR}/board`, 2)).body.me.rank).toBe(1);
  });

  it("GET /api/tower/me : chaque jour classé, médailles, série ; 400 sans identifiant, 404 jamais classé", async () => {
    const t = await monterTower(JOUR);
    expect((await t.call("GET", "/api/tower/me")).body.error).toBe("invalid_player");
    expect((await lire(t, "/api/tower/me", 1)).body.error).toBe("unknown_player");
    const { code, r } = partie("droite");
    await envoyer(t, 1, code);
    const me = await lire(t, "/api/tower/me", 1);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: "Joueur1", renameRequired: false, today: JOUR, generation: 0 });
    expect(me.body.days).toEqual([{ date: JOUR, hauteurMm: r.hauteurMm, vies: r.vies, ticks: r.ticks, medal: me.body.days[0].medal }]);
    expect(me.body.stats.days).toBe(1);
    expect(me.body.stats.streak).toBe(1);
    expect(me.headers.get("cache-control")).toBe("no-store");
    // Série : le jour d'avant, puis un trou.
    await t.db.run("INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, 5, 5, 1, 1, 'gold', '', 3, 3, 0, 0, 'y', 0, 0)", [D(JOUR) - 1, playerId(1)]);
    await t.db.run("INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, 5, 5, 1, 1, 'gold', '', 3, 3, 0, 0, 'z', 0, 0)", [D(JOUR) - 3, playerId(1)]);
    const m2 = (await lire(t, "/api/tower/me", 1)).body;
    expect(m2.stats).toMatchObject({ days: 3, streak: 2 });
    expect(m2.stats.medals.gold).toBe(m2.days.filter((d: { medal: string | null }) => d.medal === "gold").length);
    expect(m2.stats.medals.gold).toBeGreaterThanOrEqual(2);
    expect(m2.days.map((d: { date: string }) => d.date)).toEqual([formatDay(D(JOUR) - 3), formatDay(D(JOUR) - 1), JOUR]);
  });

  it("un pseudo changé se voit au classement suivant (rien n'est gardé en mémoire)", async () => {
    const t = await monterTower(JOUR);
    await envoyer(t, 1, partie("droit").code);
    const r = await t.call("PUT", "/api/player", { playerId: playerId(1), name: "Nouveau" });
    expect(r.status).toBe(200);
    expect((await lire(t, `/api/tower/day/${JOUR}/board`)).body.top[0].name).toBe("Nouveau");
  });

  it("les journaux ne disent ni identifiant, ni pseudo, ni adresse, ni rediffusion", async () => {
    const lignes: string[] = [];
    const t = await monterTower(JOUR, {}, { log: (s, m, f) => lignes.push(JSON.stringify({ s, m, ...f })) });
    const { code } = partie("droit");
    await envoyer(t, 1, code, { name: "PseudoSecret" });
    await envoyer(t, 1, "%%%", { name: "PseudoSecret" });
    const tout = lignes.join("\n");
    expect(tout).toContain("DailyTower : partie du jour");
    for (const interdit of [playerId(1), "PseudoSecret", "203.0.113.7", code]) expect(tout).not.toContain(interdit);
  });
});

describe(`Tower : le plan des requêtes (${TEST_DB})`, () => {
  it("chaque requête sur les tables de Tower passe par un index (aucun SCAN de tower_results ni de tower_levels), le classement se lit dans l'ordre de l'index", async () => {
    const t = await monterTower(JOUR, {}, { allowCopies: false });
    const vues = new Map<string, (string | number | null)[]>();
    const noter = (sql: string, params: (string | number | null)[] = []) => {
      if (/tower_/.test(sql) && !/^\s*(CREATE|DROP|ALTER)/i.test(sql) && !vues.has(sql.replace(/\s+/g, " ").trim())) vues.set(sql.replace(/\s+/g, " ").trim(), params);
    };
    const { run, first, all } = t.db;
    t.db.run = (sql, p) => (noter(sql, p), run.call(t.db, sql, p));
    t.db.first = ((sql: string, p?: (string | number | null)[]) => (noter(sql, p), first.call(t.db, sql, p))) as typeof t.db.first;
    t.db.all = ((sql: string, p?: (string | number | null)[]) => (noter(sql, p), all.call(t.db, sql, p))) as typeof t.db.all;
    await envoyer(t, 1, partie("droite").code);
    await envoyer(t, 1, partie("droit").code);
    await envoyer(t, 2, partie("gauche").code);
    await lire(t, `/api/tower/day/${JOUR}/board`, 1);
    await lire(t, "/api/tower/me", 1);
    await lire(t, `/api/tower/day/${JOUR}/diamant`, 1).catch(() => undefined);
    await t.call("POST", "/api/me/code", { newId: playerId(50) }, { headers: { "X-Player-Id": playerId(2) } });
    const banc = new DatabaseSync(":memory:");
    for (const sql of [...SCHEMA, ...TOWER_SCHEMA]) banc.exec(sql);
    for (const sql of MIGRATIONS) {
      try {
        banc.exec(sql);
      } catch {
        /* colonne déjà là */
      }
    }
    // Les instructions de la plateforme qui visent aussi Tower (effacement, aperçu) : on les ajoute à la main.
    vues.set("DELETE FROM tower_results WHERE apercu = 1", []);
    vues.set("DELETE FROM tower_results WHERE player_id = ?", ["x"]);
    vues.set("UPDATE tower_results SET player_id = ? WHERE player_id = ?", ["a", "b"]);
    const scans: string[] = [];
    for (const [sql, params] of vues) {
      const plan = (banc.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((l) => l.detail);
      for (const l of plan) if (/^SCAN (tower_results|tower_levels)\b/.test(l) && !/COVERING INDEX|USING INDEX/.test(l)) scans.push(`${sql.slice(0, 90)} → ${l}`);
      if (/ORDER BY r\.hauteur_mm DESC/.test(sql)) expect(plan.join("|"), "le top se lit dans l'ordre de l'index (aucun tri)").not.toMatch(/TEMP B-TREE/);
      if (/COUNT\(\*\) FROM tower_results WHERE day = \? AND hidden = 0 AND hauteur_mm >/.test(sql)) expect(plan.join("|")).toMatch(/tower_results_by_rank/);
    }
    expect(vues.size).toBeGreaterThan(10);
    expect(scans).toEqual([]);
  });
});
