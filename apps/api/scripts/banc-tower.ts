import { dailyTower, estimationGeometrique, lireJour, TOWER_GENERATOR_VERSION, decoderRediffusion, encoderRediffusion, type Rediffusion } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { parisDayStart } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { sha256Hex, refOfPlayer } from "../src/players";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "../test/adminHelpers";
import { playerId, type TestApi } from "../test/helpers";
import { creerBanc, type Banc, type Trace } from "./banc";
import { fixtureJour, jouerScripte, type Placement } from "./tower-aide";
import { D, monterTower } from "./tower-test";
import { UNITES_REJEU_TOWER } from "../src/towerRejeu";

// Lot K2 — le scénario du banc de réponses de Tower (voir `banc.ts`). Il couvre tout ce qui sort du serveur de Tower : un envoi valide, chaque refus, le classement (Tous, Amis, Mon groupe, Groupes), le profil,
// le fantôme Diamant (verrouillé puis débloqué), une copie refusée, l'interrupteur (`off`, `preview` avec et sans clé), l'effacement d'un joueur, un jour figé, le portail et l'administration qui lisent Tower.
// Les parties sont de vraies parties scriptées rejouées par le serveur (Rapier) : l'horloge est injectée, tout est déterministe.

const JOUR = "2026-11-10";
const FIGE = "2026-11-07";
const ORIGINE = "http://api.test";
const JETON_ADMIN = "jeton-admin-de-test-assez-long-pour-passer";
const ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };
const HOTE_PR = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

const motifs: Record<string, Placement[]> = {
  droit: [],
  gauche: Array.from({ length: 40 }, () => ({ rot: 0, dx: -1 })),
  droite: Array.from({ length: 40 }, () => ({ rot: 0, dx: 1 })),
  alterne: Array.from({ length: 40 }, (_, i) => ({ rot: i % 2, dx: i % 2 ? 1 : -1 })),
  rot: Array.from({ length: 40 }, (_, i) => ({ rot: i % 4, dx: 0 })),
  loin: Array.from({ length: 40 }, () => ({ rot: 0, dx: 3 })),
};

/** La base telle que le serveur l'a écrite (les rediffusions réduites à leur empreinte : le fichier de référence resterait énorme). */
async function etatDeLaBase(banc: Banc, t: TestApi, nom: string): Promise<void> {
  // Un jour à la fois, par la clé : le banc d'essai des plans (R14) refuse un parcours complet, même pour un relevé.
  const jours = [D(JOUR) - 1, D(JOUR), D(FIGE), D("2026-11-20")];
  const resultats: Record<string, unknown>[] = [];
  const niveaux: Record<string, unknown>[] = [];
  for (const jour of jours) {
    resultats.push(
      ...(await t.db.all<Record<string, unknown>>(
        "SELECT day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu FROM tower_results WHERE day = ? ORDER BY player_id",
        [jour],
      )),
    );
    const n = await t.db.first<Record<string, unknown>>("SELECT day, rule, g, tirage, theme, source, fichier, medals, silhouette, author_hash, created_at FROM tower_levels WHERE day = ?", [jour]);
    if (n) niveaux.push(n);
  }
  banc.noter(`${nom} — tower_results`, await Promise.all(resultats.map(async (r) => ({ ...r, replay: (await sha256Hex(String(r.replay))).slice(0, 16) }))));
  banc.noter(
    `${nom} — tower_levels`,
    await Promise.all(niveaux.map(async (n) => ({ ...n, silhouette: n.silhouette === null ? null : (await sha256Hex(String(n.silhouette))).slice(0, 16) }))),
  );
}

/** Se connecte au panneau d'administration (vérificateur factice) et rend un appel administrateur enregistré. */
async function connecter(banc: Banc, t: TestApi) {
  const r = await banc.appeler(t, "admin : connexion", "POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGINE, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGINE, "X-Cdj-Admin": "1" };
  return (nom: string, method: string, path: string, body?: unknown) => banc.appeler(t, nom, method, path, body, { headers });
}

export async function scenarioTower(): Promise<Trace[]> {
  const R = await chargerRapier();
  const banc = creerBanc(playerId, { sansSeuilsDeTrack: true }); // le banc de Tower ne protège pas les médailles de Track, que le registre des jours fait varier à chaque mise en production (banc.ts)
  const contenu = dailyTower(D(JOUR), TOWER_GENERATOR_VERSION, 0);
  const jouees = new Map<string, string>();
  const partie = (nom: keyof typeof motifs): string => {
    let code = jouees.get(nom);
    if (!code) {
      const j = jouerScripte(R, contenu, motifs[nom]);
      j.partie.dispose();
      jouees.set(nom, (code = j.code));
    }
    return code;
  };
  const plein = (extra: Partial<Rediffusion>, base = partie("droit")): string => encoderRediffusion({ ...decoderRediffusion(base), ...extra });

  // --- 1. Le jour générique : lectures, refus, envois, classement, profil, amis, groupes, portail, administration, effacement -------------------------
  {
    const t = await monterTower(JOUR, {}, { allowCopies: false, admin: ADMIN, adminToken: JETON_ADMIN });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const envoyer = (nom: string, n: number, replay: unknown, extra: Record<string, unknown> = {}) => a(nom, "POST", "/api/tower/submit", { replay, name: `Joueur${n}`, ...extra }, n);

    await a("info", "GET", "/api/tower/info");
    await a("jour", "GET", `/api/tower/day/${JOUR}`);
    await a("jour futur", "GET", `/api/tower/day/${formatDay(D(JOUR) + 5)}`);
    await a("date illisible", "GET", "/api/tower/day/2026-13-45");
    await a("date mal encodée", "GET", "/api/tower/day/%E0");
    await a("jour d'hier", "GET", `/api/tower/day/${formatDay(D(JOUR) - 1)}`);
    await a("info en POST", "POST", "/api/tower/info", {});
    await a("submit en GET", "GET", "/api/tower/submit");
    await a("board en POST", "POST", `/api/tower/day/${JOUR}/board`, {});
    await a("me en POST", "POST", "/api/tower/me", {});
    await a("route inconnue", "GET", "/api/tower/zz");
    await a("racine de Tower", "GET", "/api/tower");
    await a("classement vide", "GET", `/api/tower/day/${JOUR}/board`);
    await a("classement vide avec identifiant", "GET", `/api/tower/day/${JOUR}/board`, undefined, 1);
    await a("me sans identifiant", "GET", "/api/tower/me");
    await a("me d'un inconnu", "GET", "/api/tower/me", undefined, 1);
    await a("Diamant sans identifiant", "GET", `/api/tower/day/${JOUR}/diamant`);
    await a("Diamant verrouillé", "GET", `/api/tower/day/${JOUR}/diamant`, undefined, 1);

    // Les refus, un par code (ils n'écrivent ni partie ni joueur).
    const bon = partie("droit");
    const rd = decoderRediffusion(bon);
    await a("refus : pas d'identifiant", "POST", "/api/tower/submit", { replay: bon, name: "A" });
    await banc.appeler(t, "refus : corps illisible", "POST", "/api/tower/submit", undefined, { id: 1, raw: "pas du json" });
    await envoyer("refus : corps démesuré", 1, "A".repeat(450_000));
    await envoyer("refus : rediffusion manquante", 1, undefined);
    await envoyer("refus : rediffusion qui n'est pas du texte", 1, 12);
    await envoyer("refus : texte illisible", 1, "%%%");
    await envoyer("refus : texte démesuré", 1, "A".repeat(60_000));
    await envoyer("refus : version de la simulation", 1, plein({ sim: 99 }));
    await envoyer("refus : générateur inconnu", 1, plein({ g: 77 }));
    await envoyer("refus : autre générateur que celui du jour", 1, plein({ g: 2 }));
    await envoyer("refus : autre tirage que celui du jour", 1, plein({ contenu: { jour: D(JOUR), tirage: 1 } }));
    await envoyer("refus : réglages hors défaut", 1, plein({ reglages: { ...rd.reglages, vies: 9 } }));
    await envoyer("refus : scénario d'essai", 1, plein({ g: 0, contenu: { scenario: "essai" } }));
    await envoyer("refus : jour futur", 1, plein({ contenu: { jour: D(JOUR) + 1 } }));
    await envoyer("refus : jour fermé", 1, plein({ contenu: { jour: D(JOUR) - 1 } }));
    await a("refus : pseudo manquant", "POST", "/api/tower/submit", { replay: bon }, 1);
    await envoyer("refus : pseudo interdit", 1, bon, { name: "<b>" });
    await envoyer("refus : partie inachevée", 1, plein({ plages: rd.plages.slice(0, 1).map((p) => ({ ...p, ticks: 30 })) }));
    await envoyer("refus : commandes après la fin", 1, plein({ plages: [...rd.plages, { masque: 1, ticks: 40 }] }));
    await etatDeLaBase(banc, t, "après les refus");

    // Les envois : un premier, le même (pas un record), d'autres joueurs, des copies, un pseudo pris.
    await envoyer("envoi valide", 1, partie("droite"));
    t.clock.now += 1000;
    await envoyer("même partie renvoyée (pas un record)", 1, partie("droite"));
    t.clock.now += 1000;
    await envoyer("autre joueur", 2, partie("droit"));
    t.clock.now += 1000;
    await envoyer("troisième joueur", 3, partie("gauche"));
    t.clock.now += 1000;
    await envoyer("quatrième joueur", 4, partie("loin"));
    t.clock.now += 1000;
    await envoyer("copie de la partie d'un autre", 5, partie("droite"));
    await envoyer("pseudo déjà pris", 5, partie("alterne"), { name: "Joueur1" });
    await envoyer("résultat annoncé ignoré", 5, partie("rot"), { hauteurMm: 999_999, vies: 3, ticks: 1, medal: "author" });

    // Lectures du classement et du profil.
    await a("classement", "GET", `/api/tower/day/${JOUR}/board`);
    await a("classement du joueur 1", "GET", `/api/tower/day/${JOUR}/board`, undefined, 1);
    await a("classement du joueur 3", "GET", `/api/tower/day/${JOUR}/board`, undefined, 3);
    await a("classement d'un non-classé", "GET", `/api/tower/day/${JOUR}/board`, undefined, 9);
    await a("me du joueur 1", "GET", "/api/tower/me", undefined, 1);
    await a("Diamant d'un classé sans preuve", "GET", `/api/tower/day/${JOUR}/diamant`, undefined, 1);
    await a("portail : le jour", "GET", "/api/portail/jour");
    await a("portail : le jour du joueur 1", "GET", "/api/portail/jour", undefined, 1);
    await a("portail : classement Tower", "GET", `/api/portail/classement?date=${JOUR}&vue=tower`);
    await a("portail : classement Tower du joueur 2", "GET", `/api/portail/classement?date=${JOUR}&vue=tower`, undefined, 2);
    await a("portail : classement cumulé", "GET", `/api/portail/classement?date=${JOUR}`, undefined, 1);
    await a("portail : profil du joueur 1", "GET", "/api/portail/profil", undefined, 1);

    // Amis : le joueur 1 suit le 2 (sens unique), le 3 suit le 1.
    await a("amis : ajouter par pseudo", "POST", "/api/amis", { pseudo: "Joueur2" }, 1);
    await a("amis : ajouter le premier", "POST", "/api/amis", { pseudo: "Joueur1" }, 3);
    await a("classement Amis du joueur 1", "GET", `/api/tower/day/${JOUR}/board?filtre=amis`, undefined, 1);
    await a("classement Amis du joueur 3", "GET", `/api/tower/day/${JOUR}/board?filtre=amis`, undefined, 3);
    await a("classement Amis sans identifiant", "GET", `/api/tower/day/${JOUR}/board?filtre=amis`);
    await a("classement : filtre inconnu", "GET", `/api/tower/day/${JOUR}/board?filtre=zz`, undefined, 1);
    await a("classement Amis du portail", "GET", `/api/portail/classement?date=${JOUR}&vue=tower&filtre=amis`, undefined, 1);
    await a("feuille d'un ami", "GET", `/api/amis/fiche/${await refOfPlayer(playerId(2))}?date=${JOUR}`, undefined, 1);

    // Groupes : « Les Hauts » (4 membres, tous classés), puis « Mon groupe » et le classement des groupes.
    const creation = await a("groupe : création", "POST", "/api/groupes", { nom: "Les Hauts", description: "" }, 1);
    const moi = await a("groupe : mon groupe", "GET", "/api/groupes/moi", undefined, 1);
    for (const n of [2, 3, 4]) await a(`groupe : le joueur ${n} rejoint`, "POST", "/api/groupes/rejoindre", { jeton: moi.body.groupe.invitation }, n);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [D(JOUR) - 1, creation.body.id]);
    await a("classement Mon groupe du joueur 1", "GET", `/api/tower/day/${JOUR}/board?filtre=groupe`, undefined, 1);
    await a("classement Mon groupe du joueur 5 (sans groupe)", "GET", `/api/tower/day/${JOUR}/board?filtre=groupe`, undefined, 5);
    await a("amis : le sélecteur porte le groupe", "GET", "/api/amis", undefined, 1);
    await a("classement des groupes (Tower)", "GET", `/api/groupes/classement?date=${JOUR}&vue=tower`);
    await a("classement des groupes (cumulé)", "GET", `/api/groupes/classement?date=${JOUR}&vue=cumul`);

    // L'administration lit Tower : fiche d'un joueur, masquer, retirer.
    const adm = await connecter(banc, t);
    const ref1 = await refOfPlayer(playerId(1));
    const ref2 = await refOfPlayer(playerId(2));
    await adm("admin : recherche", "GET", "/api/admin/joueurs?q=Joueur");
    await adm("admin : fiche du joueur 1", "GET", `/api/admin/joueurs/${ref1}`);
    await adm("admin : masquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: true, confirmer: true });
    await a("classement sans le joueur masqué", "GET", `/api/tower/day/${JOUR}/board`, undefined, 3);
    await a("portail : classement Tower sans le masqué", "GET", `/api/portail/classement?date=${JOUR}&vue=tower`);
    await a("le masqué se voit lui-même", "GET", `/api/tower/day/${JOUR}/board`, undefined, 2);
    await adm("admin : démasquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: false, confirmer: true });
    await adm("admin : retirer le résultat du joueur 4", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(4))}/retirer`, { jeu: "tower", date: JOUR, motif: "hauteur impossible", confirmer: true });
    await envoyer("la partie retirée ne revient pas", 4, partie("loin"));
    await a("classement après le retrait", "GET", `/api/tower/day/${JOUR}/board`);
    await adm("admin : renommer le joueur 3", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(3))}/renommer`, { pseudo: "Troisieme", confirmer: true });
    await a("classement après le renommage", "GET", `/api/tower/day/${JOUR}/board`);
    await a("pseudo changé par le joueur", "PUT", "/api/player", { playerId: playerId(1), name: "Nouveau" });
    await a("classement après le changement de pseudo", "GET", `/api/tower/day/${JOUR}/board`);

    // Changer de code, puis un ancien code refusé.
    await a("changer de code", "POST", "/api/me/code", { newId: playerId(99) }, 2);
    await envoyer("ancien code refusé", 2, partie("gauche"));
    await a("le nouveau code garde la partie", "GET", `/api/tower/day/${JOUR}/board`, undefined, 99);
    await a("me avec l'ancien code", "GET", "/api/tower/me", undefined, 2);
    await etatDeLaBase(banc, t, "avant l'effacement");

    // Effacement d'un joueur (essai à blanc, puis pour de bon).
    const code = `CDJ2.${playerId(1)}.${(await import("../src/identity")).crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const admin = { Authorization: `Bearer ${JETON_ADMIN}` };
    await banc.appeler(t, "effacement : essai à blanc", "POST", "/api/admin/effacer", { code }, { headers: admin });
    await banc.appeler(t, "effacement", "POST", "/api/admin/effacer", { code, confirmer: true }, { headers: admin });
    await a("classement après l'effacement", "GET", `/api/tower/day/${JOUR}/board`, undefined, 3);
    await a("me après l'effacement", "GET", "/api/tower/me", undefined, 1);
    await a("portail : profil après l'effacement", "GET", "/api/portail/jour", undefined, 3);
    await etatDeLaBase(banc, t, "après l'effacement");
  }

  // --- 2. Le plafond global de rejeux (503) -------------------------------------------------------------------------------------------------------
  {
    const t = await monterTower(JOUR, {}, { replaysPerMinute: UNITES_REJEU_TOWER * 2 - 1 });
    const envoyer = (nom: string, n: number, replay: string) => banc.appeler(t, nom, "POST", "/api/tower/submit", { replay, name: `Joueur${n}` }, { id: n });
    await envoyer("plafond : premier rejeu", 1, partie("droit"));
    await envoyer("plafond : trop de rejeux", 2, partie("gauche"));
    t.clock.now += 61_000;
    await envoyer("plafond : la minute suivante", 2, partie("gauche"));
  }

  // --- 3. Le débit par joueur et par adresse (429) -------------------------------------------------------------------------------------------------
  {
    const t = await monterTower(JOUR, {}, { limits: { windowMs: 600_000, perClient: 4, perPlayer: 2 } });
    const envoyer = (nom: string, n: number) => banc.appeler(t, nom, "POST", "/api/tower/submit", { replay: "%%%", name: `Joueur${n}` }, { id: n, clientKey: "203.0.113.7" });
    await envoyer("débit : 1er envoi du joueur", 1);
    await envoyer("débit : 2e envoi du joueur", 1);
    await envoyer("débit : limite du joueur", 1);
    await envoyer("débit : un autre joueur, même adresse", 2);
    await envoyer("débit : limite de l'adresse", 3);
  }

  // --- 4. La grâce après minuit et le jour fermé ----------------------------------------------------------------------------------------------------
  {
    const t = await monterTower(JOUR);
    const hier = jouerScripte(R, dailyTower(D(JOUR) - 1, TOWER_GENERATOR_VERSION, 0));
    hier.partie.dispose();
    const minuit = parisDayStart(D(JOUR));
    t.clock.now = minuit + 5 * 60_000;
    await banc.appeler(t, "grâce : 00 h 05", "POST", "/api/tower/submit", { replay: hier.code, name: "Joueur1" }, { id: 1 });
    await banc.appeler(t, "grâce : classement d'hier", "GET", `/api/tower/day/${formatDay(D(JOUR) - 1)}/board`, undefined, { id: 1 });
    t.clock.now = minuit + 11 * 60_000;
    await banc.appeler(t, "grâce : 00 h 11", "POST", "/api/tower/submit", { replay: hier.code, name: "Joueur2" }, { id: 2 });
    await banc.appeler(t, "grâce : classement d'hier, jour fermé", "GET", `/api/tower/day/${formatDay(D(JOUR) - 1)}/board`, undefined, { id: 1 });
  }

  // --- 5. Une panne du rejeu n'écrit rien ---------------------------------------------------------------------------------------------------------
  {
    const t = await monterTower(JOUR, {
      executeur: {
        async rejouer() {
          throw new Error("panne");
        },
      },
    });
    await banc.appeler(t, "panne du rejeu", "POST", "/api/tower/submit", { replay: partie("droit"), name: "Joueur1" }, { id: 1 });
    await etatDeLaBase(banc, t, "après la panne");
  }

  // --- 6. L'interrupteur : off, aperçu de PR, preview avec et sans clé, puis on ------------------------------------------------------------------------
  {
    const t = await monterTower(JOUR, {}, { environment: "recette", admin: ADMIN }, false);
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const bon = partie("droite");
    await a("off : info", "GET", "/api/tower/info");
    await a("off : jour", "GET", `/api/tower/day/${JOUR}`);
    await a("off : classement", "GET", `/api/tower/day/${JOUR}/board`);
    await a("off : envoi", "POST", "/api/tower/submit", { replay: bon, name: "Joueur1" }, 1);
    await a("off : les jeux", "GET", "/api/jeux");
    await a("aperçu de PR : jour", "GET", `/api/tower/day/${JOUR}`, undefined, null, HOTE_PR);
    await a("aperçu de PR : envoi", "POST", "/api/tower/submit", { replay: bon, name: "Joueur1" }, 1, HOTE_PR);
    await a("aperçu de PR : classement public vide", "GET", `/api/tower/day/${JOUR}/board`, undefined, 1, HOTE_PR);
    await a("aperçu de PR : écriture non permise", "PUT", "/api/tower/submit", {}, 1, HOTE_PR);
    const adm = await connecter(banc, t);
    await adm("admin : Tower en preview", "POST", "/api/admin/jeux/tower/etat", { etat: "preview", confirmer: true });
    const cle = await adm("admin : clé d'aperçu", "POST", "/api/admin/jeux/tower/cle", { confirmer: true });
    const cleAperçu = String(cle.body.cle ?? cle.body.key ?? Object.values(cle.body).find((v) => typeof v === "string" && v.length > 20) ?? "");
    await a("preview sans clé : info", "GET", "/api/tower/info");
    await a("preview, mauvaise clé : info", "GET", "/api/tower/info", undefined, null, { "X-Preview-Key": "mauvaise-cle" });
    await a("preview avec clé : info", "GET", "/api/tower/info", undefined, null, { "X-Preview-Key": cleAperçu });
    await a("preview avec clé : jour", "GET", `/api/tower/day/${JOUR}`, undefined, null, { "X-Preview-Key": cleAperçu });
    await a("preview avec clé : envoi (rangé à part)", "POST", "/api/tower/submit", { replay: partie("droit"), name: "Joueur2" }, 2, { "X-Preview-Key": cleAperçu });
    await a("preview avec clé : écriture non permise", "POST", "/api/tower/zz", {}, 2, { "X-Preview-Key": cleAperçu });
    await a("preview avec clé : classement public vide", "GET", `/api/tower/day/${JOUR}/board`, undefined, 2, { "X-Preview-Key": cleAperçu });
    await a("preview : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "en preview");
    await adm("admin : clé révoquée", "POST", "/api/admin/jeux/tower/cle/revoquer", { confirmer: true });
    await a("preview, clé révoquée : info", "GET", "/api/tower/info", undefined, null, { "X-Preview-Key": cleAperçu });
    await adm("admin : Tower on", "POST", "/api/admin/jeux/tower/etat", { etat: "on", confirmer: true });
    await a("on : info", "GET", "/api/tower/info");
    await a("on : classement (les parties d'aperçu sont effacées)", "GET", `/api/tower/day/${JOUR}/board`, undefined, 2);
    await a("on : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "après le passage à on");
  }

  // --- 7. Un jour figé : fichier préparé, fantôme Diamant, copie de la preuve, fichier abîmé, fichier seulement figé -----------------------------------------
  {
    const fichier = fixtureJour(FIGE);
    const lu = lireJour(fichier, D(FIGE));
    if (typeof lu === "string") throw new Error(lu);
    const joue = jouerScripte(R, lu.contenu);
    joue.partie.dispose();
    const t = await monterTower(FIGE, { frozen: { [FIGE]: fichier } }, { allowCopies: false });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null) => banc.appeler(t, nom, method, path, body, { id });
    await a("figé : info", "GET", "/api/tower/info");
    await a("figé : jour", "GET", `/api/tower/day/${FIGE}`);
    await a("figé : Diamant verrouillé", "GET", `/api/tower/day/${FIGE}/diamant`, undefined, 1);
    await a("figé : copie de la preuve de l'auteur", "POST", "/api/tower/submit", { replay: fichier.preuve, name: "Joueur1" }, 1);
    await a("figé : envoi", "POST", "/api/tower/submit", { replay: joue.code, name: "Joueur1" }, 1);
    await a("figé : Diamant débloqué", "GET", `/api/tower/day/${FIGE}/diamant`, undefined, 1);
    await a("figé : Diamant d'un autre joueur", "GET", `/api/tower/day/${FIGE}/diamant`, undefined, 2);
    await a("figé : Diamant relu", "GET", `/api/tower/day/${FIGE}/diamant`, undefined, 1);
    await a("figé : classement", "GET", `/api/tower/day/${FIGE}/board`, undefined, 1);
    await a("figé : portail", "GET", "/api/portail/jour", undefined, 1);
    await etatDeLaBase(banc, t, "jour figé");

    const abime = { ...fichier, medailles: { auteur: 59_000, or: 29_500, argent: 17_700, bronze: 8_850 } };
    const t2 = await monterTower(FIGE, { frozen: { [FIGE]: abime } });
    await banc.appeler(t2, "figé abîmé : jour (généré)", "GET", `/api/tower/day/${FIGE}`);
    await banc.appeler(t2, "figé abîmé : Diamant", "GET", `/api/tower/day/${FIGE}/diamant`, undefined, { id: 1 });

    const { preuve: _p, medailles: _m, ...sansPreuve } = fichier as Record<string, unknown>;
    const t3 = await monterTower(FIGE, { frozen: { [FIGE]: { ...sansPreuve, medailles: null } } });
    await banc.appeler(t3, "figé sans médailles : jour", "GET", `/api/tower/day/${FIGE}`);
    await etatDeLaBase(banc, t3, "figé sans médailles");

    const t4 = await monterTower("2026-11-20", { frozen: { [FIGE]: fichier } });
    const c = dailyTower(D("2026-11-20"), TOWER_GENERATOR_VERSION, 0);
    banc.noter("jour sans fichier — médailles estimées", estimationGeometrique(c));
    await banc.appeler(t4, "jour sans fichier", "GET", "/api/tower/day/2026-11-20");
  }

  return banc.traces;
}
