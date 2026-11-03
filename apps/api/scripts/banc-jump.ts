import { parisDayStart } from "@cdj/clock";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  dailyLevel,
  decodeReplay,
  demoAttempts,
  encodeReplay,
  lifeReplay,
  repriseParPhase,
  replayAttempt,
  thawLevel,
  type DailyLevel,
} from "@cdj/jump-sim";
import { readFileSync } from "node:fs";
import { refOfPlayer, sha256Hex } from "../src/players";
import { replayUnits } from "../src/replayCost";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "../test/adminHelpers";
import { makeApi, playerId, type TestApi } from "../test/helpers";
import { creerBanc, type Banc, type Trace } from "./banc";

// Lot K2b — le scénario du banc de réponses de Jump (voir `banc.ts`), **écrit sur le code d'avant la migration** vers le module des jeux. Il couvre tout ce qui sort du serveur de Jump : un envoi valide, chaque
// refus, le classement (Tous, Amis, Mon groupe, Groupes), le profil, le fantôme du premier, `bundle`, les vies, la carte des morts et le carnage (et leur oubli à la fin du jour), une copie refusée, l'interrupteur
// (`off`, aperçu de PR, `preview` avec et sans clé, `on`), l'administration, le changement de code, l'effacement, un jour figé, le débit et le plafond de rejeux, la grâce de minuit, un niveau gardé abîmé.
// Les essais sont de vrais essais rejoués par le serveur : l'horloge est injectée, tout est déterministe.

const JOUR = "2026-10-30";
const FIGE = "2026-10-17";
const ORIGINE = "http://api.test";
const JETON_ADMIN = "jeton-admin-de-test-assez-long-pour-passer";
const ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };
const HOTE_PR = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };

const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const midi = (jour: number): number => parisDayStart(jour) + 12 * 3_600_000;

interface Preparation {
  niveau: DailyLevel;
  /** Des essais qui arrivent, du plus lent au plus rapide, tous plus lents que l'auteur. */
  essais: { code: string; ticks: number; deaths: number }[];
  /** Des essais complets qui n'arrivent pas (partent du départ). */
  inacheves: string[];
  /** Des vies qui finissent par une mort, et des vies qui n'en sont pas. */
  morts: { code: string; checkpoint: number }[];
  autres: string[];
}

/** Les essais et les vies d'un niveau : générés une fois (le plus long du banc). */
function preparer(niveau: DailyLevel, graine: number): Preparation {
  const essais: Preparation["essais"] = [];
  const inacheves: string[] = [];
  const morts: Preparation["morts"] = [];
  const autres: string[] = [];
  const vus = new Set<number>();
  const vues = new Set<string>();
  // Les essais qui arrivent : les joueurs fictifs qui reprennent bien (recette de `jumpBoard.test.ts`).
  for (const a of demoAttempts(niveau.level, niveau.replay, graine, { attempts: 40, reprise: repriseParPhase(niveau) })) {
    const r = replayAttempt(niveau.level, a.replay, niveau.id);
    if (a.end === "arrivée" && r.finished && !vus.has(r.time) && r.time > niveau.authorTicks) {
      vus.add(r.time);
      essais.push({ code: encodeReplay(a.replay), ticks: r.time, deaths: r.deaths.length });
    } else if (!r.finished && a.replay.start.checkpoint === -1 && inacheves.length < 2) inacheves.push(encodeReplay(a.replay));
  }
  // Les vies (recette de `jumpLives.test.ts`) : ni reprise, huit vies au plus par essai ; les vies longues sont écartées.
  for (const a of demoAttempts(niveau.level, niveau.replay, 0x11fe, { attempts: 70, maxLives: 8 })) {
    const r = replayAttempt(niveau.level, a.replay, niveau.id);
    if (!r.finished && a.replay.start.checkpoint === -1 && inacheves.length < 2) inacheves.push(encodeReplay(a.replay));
    for (const life of r.lives) {
      if (life.end === "mort" && life.ticks > 1800) continue;
      const code = encodeReplay(lifeReplay(a.replay, life));
      if (vues.has(code)) continue;
      vues.add(code);
      if (life.end === "mort" && life.death) morts.push({ code, checkpoint: life.start.checkpoint });
      else autres.push(code);
    }
  }
  essais.sort((x, y) => y.ticks - x.ticks);
  essais.splice(8);
  if (essais.length < 4) throw new Error("trop peu d'essais fictifs arrivent");
  if (morts.length < 45 || autres.length < 1 || inacheves.length < 1) throw new Error(`trop peu de vies fictives (${morts.length} morts, ${autres.length} autres, ${inacheves.length} inachevés)`);
  return { niveau, essais, inacheves, morts, autres };
}

/** La base telle que le serveur l'a écrite (rediffusions et textes réduits à leur empreinte : le fichier de référence resterait énorme). */
async function etatDeLaBase(banc: Banc, t: TestApi, nom: string): Promise<void> {
  const jours = [D(JOUR) - 1, D(JOUR), D(FIGE), D("2026-11-20")];
  const resultats: Record<string, unknown>[] = [];
  const niveaux: Record<string, unknown>[] = [];
  const vies: Record<string, unknown>[] = [];
  const morts: Record<string, unknown>[] = [];
  for (const jour of jours) {
    resultats.push(
      ...(await t.db.all<Record<string, unknown>>(
        "SELECT day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, final_rank, final_total, inputs_hash, hidden, apercu FROM jump_results WHERE day = ? ORDER BY player_id",
        [jour],
      )),
    );
    const n = await t.db.first<Record<string, unknown>>("SELECT day, rule, level_id, hash, author_ticks, medals, theme, source, ascii, created_at, author_hash FROM jump_levels WHERE day = ?", [jour]);
    if (n) niveaux.push(n);
    vies.push(...(await t.db.all<Record<string, unknown>>("SELECT day, player_id, level_id, count, lives, rev, updated_at FROM jump_lives WHERE day = ? ORDER BY player_id", [jour])));
    const m = await t.db.first<Record<string, unknown>>("SELECT day, level_id, version, built, built_at, frozen, players, deaths, map, sample FROM jump_deaths WHERE day = ?", [jour]);
    if (m) morts.push(m);
  }
  const court = async (v: unknown) => (v === null || v === undefined ? null : (await sha256Hex(String(v))).slice(0, 16));
  banc.noter(`${nom} — jump_results`, await Promise.all(resultats.map(async (r) => ({ ...r, replay: await court(r.replay) }))));
  banc.noter(`${nom} — jump_levels`, await Promise.all(niveaux.map(async (n) => ({ ...n, ascii: await court(n.ascii) }))));
  banc.noter(`${nom} — jump_lives`, await Promise.all(vies.map(async (v) => ({ ...v, lives: await court(v.lives) }))));
  banc.noter(`${nom} — jump_deaths`, await Promise.all(morts.map(async (m) => ({ ...m, map: await court(m.map), sample: await court(m.sample) }))));
}

async function connecter(banc: Banc, t: TestApi) {
  const r = await banc.appeler(t, "admin : connexion", "POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGINE, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGINE, "X-Cdj-Admin": "1" };
  return (nom: string, method: string, path: string, body?: unknown) => banc.appeler(t, nom, method, path, body, { headers });
}

async function monter(date: string, options: Record<string, unknown> = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, environment: "recette", ...options });
  t.clock.now = midi(D(date));
  return t;
}

export async function scenarioJump(): Promise<Trace[]> {
  const banc = creerBanc(playerId);
  const P = preparer(dailyLevel(D(JOUR)), 0x5eed);
  const N = P.niveau;
  const corps = (replay: unknown, extra: Record<string, unknown> = {}) => ({ levelId: N.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay, ...extra });
  const lot = (lives: unknown, extra: Record<string, unknown> = {}) => ({ levelId: N.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives, ...extra });
  const [lent, moyen, bon, meilleur] = [P.essais[0]!, P.essais[1]!, P.essais[2]!, P.essais[3]!];

  // --- 1. Le jour générique : lectures, refus, envois, classement, profil, amis, groupes, vies, portail, administration, effacement ----------------------
  {
    const t = await monter(JOUR, { allowCopies: false, admin: ADMIN, adminToken: JETON_ADMIN });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const envoyer = (nom: string, n: number, body: unknown, extra: Record<string, unknown> = {}) => a(nom, "POST", "/api/jump/submit", { ...(body as object), name: `Joueur${n}`, ...extra }, n);
    const lots = (nom: string, n: number, body: unknown) => a(nom, "POST", "/api/jump/lives", body, n);

    await a("info", "GET", "/api/jump/info");
    await a("jour", "GET", `/api/jump/day/${JOUR}`);
    await a("jour futur", "GET", `/api/jump/day/${formatDay(D(JOUR) + 5)}`);
    await a("jour avant le premier niveau", "GET", "/api/jump/day/2020-01-01");
    await a("date illisible", "GET", "/api/jump/day/2026-13-45");
    await a("date mal encodée", "GET", "/api/jump/day/%E0");
    await a("jour d'hier", "GET", `/api/jump/day/${formatDay(D(JOUR) - 1)}`);
    await a("info en POST", "POST", "/api/jump/info", {});
    await a("submit en GET", "GET", "/api/jump/submit");
    await a("lives en GET", "GET", "/api/jump/lives");
    await a("board en POST", "POST", `/api/jump/day/${JOUR}/board`, {});
    await a("me en POST", "POST", "/api/jump/me", {});
    await a("route inconnue", "GET", "/api/jump/zz");
    await a("racine de Jump", "GET", "/api/jump");
    await a("classement vide", "GET", `/api/jump/day/${JOUR}/board`);
    await a("classement vide avec identifiant", "GET", `/api/jump/day/${JOUR}/board`, undefined, 1);
    await a("fantôme du premier sans classé", "GET", `/api/jump/day/${JOUR}/ghost/first`);
    await a("carte des morts vide", "GET", `/api/jump/day/${JOUR}/deaths`);
    await a("carnage vide", "GET", `/api/jump/day/${JOUR}/carnage`);
    await a("bundle vide", "GET", `/api/jump/day/${JOUR}/bundle`);
    await a("bundle vide d'un inconnu", "GET", `/api/jump/day/${JOUR}/bundle`, undefined, 1);
    await a("me sans identifiant", "GET", "/api/jump/me");
    await a("me d'un inconnu", "GET", "/api/jump/me", undefined, 1);

    // Les refus, un par code (ils n'écrivent ni essai ni joueur).
    const r0 = decodeReplay(lent.code);
    await a("refus : pas d'identifiant", "POST", "/api/jump/submit", { ...corps(lent.code), name: "A" });
    await banc.appeler(t, "refus : corps illisible", "POST", "/api/jump/submit", undefined, { id: 1, raw: "pas du json" });
    await envoyer("refus : corps démesuré", 1, corps("A".repeat(450_000)));
    await envoyer("refus : niveau manquant", 1, { ...corps(lent.code), levelId: undefined });
    await envoyer("refus : niveau illisible", 1, { ...corps(lent.code), levelId: "n'importe quoi" });
    await envoyer("refus : thème forcé", 1, { ...corps(lent.code), levelId: `${N.id}-tneon` });
    await envoyer("refus : niveau d'un jour futur", 1, { ...corps(lent.code), levelId: `jour-${formatDay(D(JOUR) + 1)}-g${JUMP_GENERATOR_VERSION}` });
    await envoyer("refus : niveau d'avant le premier", 1, { ...corps(lent.code), levelId: `jour-2020-01-01-g${JUMP_GENERATOR_VERSION}` });
    await envoyer("refus : niveau d'un jour fermé", 1, { ...corps(lent.code), levelId: `jour-${formatDay(D(JOUR) - 1)}-g${JUMP_GENERATOR_VERSION}` });
    await envoyer("refus : versions manquantes", 1, { levelId: N.id, replay: lent.code });
    await envoyer("refus : version de la simulation plus récente", 1, { ...corps(lent.code), simVersion: JUMP_SIM_VERSION + 1 });
    await envoyer("refus : version de la simulation autre", 1, { ...corps(lent.code), simVersion: 1 });
    await envoyer("refus : générateur autre", 1, { ...corps(lent.code), generatorVersion: JUMP_GENERATOR_VERSION + 5 });
    await envoyer("refus : rediffusion manquante", 1, corps(undefined));
    await envoyer("refus : rediffusion vide", 1, corps(""));
    await envoyer("refus : rediffusion qui n'est pas du texte", 1, corps(12));
    await envoyer("refus : texte illisible", 1, corps("%%%"));
    await envoyer("refus : rediffusion d'une version plus récente", 1, corps(encodeReplay({ ...r0, simVersion: JUMP_SIM_VERSION + 1 })));
    await envoyer("refus : rediffusion d'un autre niveau", 1, corps(encodeReplay({ ...r0, levelId: `jour-${formatDay(D(JOUR) + 1)}-g${JUMP_GENERATOR_VERSION}` })));
    await envoyer("refus : l'essai ne part pas du départ", 1, corps(P.morts.find((m) => m.checkpoint >= 1)!.code));
    await envoyer("refus : l'essai n'arrive pas", 1, corps(P.inacheves[0]!));
    await a("refus : pseudo manquant", "POST", "/api/jump/submit", corps(lent.code), 1);
    await envoyer("refus : pseudo interdit", 1, corps(lent.code), { name: "<b>" });
    await etatDeLaBase(banc, t, "après les refus");

    // Les envois : un premier, le même, un meilleur, d'autres joueurs, des copies, un pseudo pris.
    await envoyer("envoi valide", 1, corps(lent.code));
    t.clock.now += 1000;
    await envoyer("même essai renvoyé (pas un record)", 1, corps(lent.code));
    t.clock.now += 1000;
    await envoyer("autre joueur", 2, corps(moyen.code));
    t.clock.now += 1000;
    await envoyer("troisième joueur", 3, corps(bon.code));
    t.clock.now += 1000;
    await envoyer("quatrième joueur", 4, corps(meilleur.code));
    t.clock.now += 1000;
    await envoyer("copie de l'essai d'un autre", 5, corps(lent.code));
    await envoyer("copie de la preuve de l'auteur", 5, corps(N.code));
    await envoyer("pseudo déjà pris", 5, corps(P.essais[4]!.code), { name: "Joueur1" });
    await envoyer("résultat annoncé ignoré", 5, corps(P.essais[4]!.code), { ticks: 1, deaths: 0, medal: "author" });
    await envoyer("le joueur 1 améliore son essai", 1, corps((P.essais[5] ?? P.essais[4]!).code));

    // Lectures du classement, du fantôme, de la lecture regroupée et du profil.
    await a("classement", "GET", `/api/jump/day/${JOUR}/board`);
    await a("classement du joueur 1", "GET", `/api/jump/day/${JOUR}/board`, undefined, 1);
    await a("classement du joueur 3", "GET", `/api/jump/day/${JOUR}/board`, undefined, 3);
    await a("classement d'un non-classé", "GET", `/api/jump/day/${JOUR}/board`, undefined, 9);
    await a("fantôme du premier", "GET", `/api/jump/day/${JOUR}/ghost/first`);
    await a("fantôme du premier, c'est moi", "GET", `/api/jump/day/${JOUR}/ghost/first`, undefined, 4);
    await a("bundle", "GET", `/api/jump/day/${JOUR}/bundle`);
    await a("bundle du joueur 1", "GET", `/api/jump/day/${JOUR}/bundle`, undefined, 1);
    await a("bundle d'un inconnu", "GET", `/api/jump/day/${JOUR}/bundle`, undefined, 9);
    await a("bundle d'hier", "GET", `/api/jump/day/${formatDay(D(JOUR) - 1)}/bundle`, undefined, 1);
    await a("me du joueur 1", "GET", "/api/jump/me", undefined, 1);
    await a("portail : le jour", "GET", "/api/portail/jour");
    await a("portail : le jour du joueur 1", "GET", "/api/portail/jour", undefined, 1);
    await a("portail : classement Jump", "GET", `/api/portail/classement?date=${JOUR}&vue=jump`);
    await a("portail : classement Jump du joueur 2", "GET", `/api/portail/classement?date=${JOUR}&vue=jump`, undefined, 2);
    await a("portail : classement cumulé", "GET", `/api/portail/classement?date=${JOUR}`, undefined, 1);
    await a("portail : profil du joueur 1", "GET", "/api/portail/profil", undefined, 1);
    await a("le jour du serveur après les essais", "GET", `/api/jump/day/${JOUR}`);

    // Les vies : refus puis lots acceptés, doublons, plafonds, carte des morts et carnage.
    await lots("vies : un inconnu", 9, lot([P.morts[0]!.code]));
    await lots("vies : lot vide", 1, lot([]));
    await lots("vies : pas un tableau", 1, lot("x"));
    await lots("vies : version", 1, lot([P.morts[0]!.code], { simVersion: JUMP_SIM_VERSION + 1 }));
    await lots("vies : jour fermé", 1, lot([P.morts[0]!.code], { levelId: `jour-${formatDay(D(JOUR) - 1)}-g${JUMP_GENERATOR_VERSION}` }));
    await a("vies : sans en-tête", "POST", "/api/jump/lives", lot([P.morts[0]!.code]));
    await lots("vies : trop de vies dans le lot", 1, lot(P.morts.slice(0, 31).map((m) => m.code)));
    await lots("vies : lot accepté", 1, lot([...P.morts.slice(0, 5).map((m) => m.code), P.autres[0]!, "%%%"]));
    await lots("vies : les mêmes renvoyées", 1, lot(P.morts.slice(0, 5).map((m) => m.code)));
    await lots("vies : lot du joueur 2", 2, lot(P.morts.slice(5, 15).map((m) => m.code)));
    await lots("vies : lot du joueur 3", 3, lot(P.morts.slice(10, 20).map((m) => m.code)));
    t.clock.now += 1000;
    await etatDeLaBase(banc, t, "après les vies");
    await a("carte des morts", "GET", `/api/jump/day/${JOUR}/deaths`);
    await a("carnage", "GET", `/api/jump/day/${JOUR}/carnage`);
    await a("bundle avec les morts", "GET", `/api/jump/day/${JOUR}/bundle`, undefined, 2);
    t.clock.now += 4 * 60_000; // la carte se recalcule toutes les 3 minutes
    await lots("vies : le plafond du jour (30)", 4, lot(P.morts.slice(0, 31).map((m) => m.code).slice(0, 30)));
    await lots("vies : au-delà du plafond", 4, lot(P.morts.slice(30, 35).map((m) => m.code)));
    await a("carte des morts après le plafond", "GET", `/api/jump/day/${JOUR}/deaths`);
    await a("portail : le jour d'un joueur qui n'a que des vies", "GET", "/api/portail/jour", undefined, 4);

    // Amis : le joueur 1 suit le 2 (sens unique), le 3 suit le 1.
    await a("amis : ajouter par pseudo", "POST", "/api/amis", { pseudo: "Joueur2" }, 1);
    await a("amis : ajouter le premier", "POST", "/api/amis", { pseudo: "Joueur1" }, 3);
    await a("classement Amis du joueur 1", "GET", `/api/jump/day/${JOUR}/board?filtre=amis`, undefined, 1);
    await a("classement Amis du joueur 3", "GET", `/api/jump/day/${JOUR}/board?filtre=amis`, undefined, 3);
    await a("classement Amis sans identifiant", "GET", `/api/jump/day/${JOUR}/board?filtre=amis`);
    await a("classement : filtre inconnu", "GET", `/api/jump/day/${JOUR}/board?filtre=zz`, undefined, 1);
    await a("classement Amis du portail", "GET", `/api/portail/classement?date=${JOUR}&vue=jump&filtre=amis`, undefined, 1);
    await a("feuille d'un ami", "GET", `/api/amis/fiche/${await refOfPlayer(playerId(2))}?date=${JOUR}`, undefined, 1);

    // Groupes : « Les Hauts » (4 membres, tous classés), puis « Mon groupe » et le classement des groupes.
    const creation = await a("groupe : création", "POST", "/api/groupes", { nom: "Les Hauts", description: "" }, 1);
    const moi = await a("groupe : mon groupe", "GET", "/api/groupes/moi", undefined, 1);
    for (const n of [2, 3, 4]) await a(`groupe : le joueur ${n} rejoint`, "POST", "/api/groupes/rejoindre", { jeton: moi.body.groupe.invitation }, n);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [D(JOUR) - 1, creation.body.id]);
    await a("classement Mon groupe du joueur 1", "GET", `/api/jump/day/${JOUR}/board?filtre=groupe`, undefined, 1);
    await a("classement Mon groupe du joueur 5 (sans groupe)", "GET", `/api/jump/day/${JOUR}/board?filtre=groupe`, undefined, 5);
    await a("amis : le sélecteur porte le groupe", "GET", "/api/amis", undefined, 1);
    await a("classement des groupes (Jump)", "GET", `/api/groupes/classement?date=${JOUR}&vue=jump`);
    await a("classement des groupes (cumulé)", "GET", `/api/groupes/classement?date=${JOUR}&vue=cumul`);

    // L'administration lit Jump : fiche d'un joueur, masquer, retirer.
    const adm = await connecter(banc, t);
    const ref1 = await refOfPlayer(playerId(1));
    const ref2 = await refOfPlayer(playerId(2));
    await adm("admin : recherche", "GET", "/api/admin/joueurs?q=Joueur");
    await adm("admin : fiche du joueur 1", "GET", `/api/admin/joueurs/${ref1}`);
    await adm("admin : tableau de bord", "GET", "/api/admin/tableau");
    await adm("admin : masquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: true, confirmer: true });
    await a("classement sans le joueur masqué", "GET", `/api/jump/day/${JOUR}/board`, undefined, 3);
    await a("fantôme du premier sans le masqué", "GET", `/api/jump/day/${JOUR}/ghost/first`);
    await a("portail : classement Jump sans le masqué", "GET", `/api/portail/classement?date=${JOUR}&vue=jump`);
    await a("le masqué se voit lui-même", "GET", `/api/jump/day/${JOUR}/board`, undefined, 2);
    await adm("admin : démasquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: false, confirmer: true });
    await adm("admin : retirer l'essai du joueur 4", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(4))}/retirer`, { jeu: "jump", date: JOUR, motif: "temps impossible", confirmer: true });
    await envoyer("l'essai retiré ne revient pas", 4, corps(meilleur.code));
    await a("classement après le retrait", "GET", `/api/jump/day/${JOUR}/board`);
    await adm("admin : renommer le joueur 3", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(3))}/renommer`, { pseudo: "Troisieme", confirmer: true });
    await a("classement après le renommage", "GET", `/api/jump/day/${JOUR}/board`);
    await a("pseudo changé par le joueur", "PUT", "/api/player", { playerId: playerId(1), name: "Nouveau" });
    await a("classement après le changement de pseudo", "GET", `/api/jump/day/${JOUR}/board`);

    // Changer de code, puis un ancien code refusé.
    await a("changer de code", "POST", "/api/me/code", { newId: playerId(99) }, 2);
    await envoyer("ancien code refusé", 2, corps(moyen.code));
    await lots("ancien code refusé pour les vies", 2, lot([P.morts[0]!.code]));
    await a("le nouveau code garde l'essai", "GET", `/api/jump/day/${JOUR}/board`, undefined, 99);
    await a("me avec l'ancien code", "GET", "/api/jump/me", undefined, 2);
    await a("bundle avec l'ancien code", "GET", `/api/jump/day/${JOUR}/bundle`, undefined, 2);
    await etatDeLaBase(banc, t, "avant l'effacement");

    // La fin du jour : les vies brutes sont oubliées, la carte et l'échantillon sont figés.
    t.clock.now = parisDayStart(D(JOUR) + 1) + 11 * 60_000;
    await a("lendemain : carte des morts d'hier (figée)", "GET", `/api/jump/day/${JOUR}/deaths`);
    await a("lendemain : carnage d'hier (figé)", "GET", `/api/jump/day/${JOUR}/carnage`);
    await a("lendemain : classement d'hier", "GET", `/api/jump/day/${JOUR}/board`, undefined, 3);
    await a("lendemain : fantôme du premier d'hier", "GET", `/api/jump/day/${JOUR}/ghost/first`, undefined, 3);
    await etatDeLaBase(banc, t, "après l'oubli des vies");
    t.clock.now = midi(D(JOUR));

    // Effacement d'un joueur (essai à blanc, puis pour de bon).
    const code = `CDJ2.${playerId(1)}.${(await import("../src/identity")).crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    const admin = { Authorization: `Bearer ${JETON_ADMIN}` };
    await banc.appeler(t, "effacement : essai à blanc", "POST", "/api/admin/effacer", { code }, { headers: admin });
    await banc.appeler(t, "effacement", "POST", "/api/admin/effacer", { code, confirmer: true }, { headers: admin });
    await a("classement après l'effacement", "GET", `/api/jump/day/${JOUR}/board`, undefined, 3);
    await a("me après l'effacement", "GET", "/api/jump/me", undefined, 1);
    await a("portail : jour après l'effacement", "GET", "/api/portail/jour", undefined, 3);
    await etatDeLaBase(banc, t, "après l'effacement");
  }

  // --- 2. Le plafond global de rejeux (503) -------------------------------------------------------------------------------------------------------
  {
    const t = await monter(JOUR, { replaysPerMinute: replayUnits(decodeReplay(lent.code).runs) });
    const envoyer = (nom: string, n: number, replay: string) => banc.appeler(t, nom, "POST", "/api/jump/submit", corps(replay, { name: `Joueur${n}` }), { id: n });
    await envoyer("plafond : premier rejeu", 1, lent.code);
    await envoyer("plafond : trop de rejeux", 2, moyen.code);
    t.clock.now += 61_000;
    await envoyer("plafond : la minute suivante", 2, moyen.code);
  }

  // --- 3. Le débit par joueur et par adresse (429) -------------------------------------------------------------------------------------------------
  {
    const t = await monter(JOUR, { limits: { windowMs: 600_000, perClient: 4, perPlayer: 2 } });
    const envoyer = (nom: string, n: number) => banc.appeler(t, nom, "POST", "/api/jump/submit", corps("%%%", { name: `Joueur${n}` }), { id: n, clientKey: "203.0.113.7" });
    await envoyer("débit : 1er envoi du joueur", 1);
    await envoyer("débit : 2e envoi du joueur", 1);
    await envoyer("débit : limite du joueur", 1);
    await envoyer("débit : un autre joueur, même adresse", 2);
    await envoyer("débit : limite de l'adresse", 3);
    const lots = (nom: string, n: number) => banc.appeler(t, nom, "POST", "/api/jump/lives", lot(["%%%"]), { id: n, clientKey: "203.0.113.8" });
    for (let i = 1; i <= 5; i++) await lots(`débit des vies : lot ${i}`, 7);
  }

  // --- 4. La grâce après minuit et le jour fermé ----------------------------------------------------------------------------------------------------
  {
    const t = await monter(JOUR);
    const hier = dailyLevel(D(JOUR) - 1);
    const minuit = parisDayStart(D(JOUR));
    const corpsHier = { levelId: hier.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: hier.code };
    t.clock.now = minuit + 5 * 60_000;
    await banc.appeler(t, "grâce : 00 h 05", "POST", "/api/jump/submit", { ...corpsHier, name: "Joueur1" }, { id: 1 });
    await banc.appeler(t, "grâce : classement d'hier", "GET", `/api/jump/day/${formatDay(D(JOUR) - 1)}/board`, undefined, { id: 1 });
    t.clock.now = minuit + 11 * 60_000;
    await banc.appeler(t, "grâce : 00 h 11", "POST", "/api/jump/submit", { ...corpsHier, name: "Joueur2" }, { id: 2 });
    await banc.appeler(t, "grâce : classement d'hier, jour fermé", "GET", `/api/jump/day/${formatDay(D(JOUR) - 1)}/board`, undefined, { id: 1 });
    await banc.appeler(t, "grâce : fantôme d'hier, jour fermé", "GET", `/api/jump/day/${formatDay(D(JOUR) - 1)}/ghost/first`, undefined, { id: 1 });
  }

  // --- 5. Un niveau gardé abîmé n'est jamais cru (le serveur répond 503 et n'écrit aucun essai) -----------------------------------------------------
  {
    const t = await monter(JOUR);
    await banc.appeler(t, "niveau abîmé : le jour", "GET", `/api/jump/day/${JOUR}`);
    await t.db.run("UPDATE jump_levels SET ascii = ? WHERE day = ?", ["# abîmé", D(JOUR)]);
    const t2 = await makeApi({ seed: false, environment: "recette", db: t.db });
    t2.clock.now = midi(D(JOUR));
    await banc.appeler(t2, "niveau abîmé : envoi", "POST", "/api/jump/submit", corps(lent.code, { name: "Joueur1" }), { id: 1 });
    await etatDeLaBase(banc, t2, "après le niveau abîmé");
  }

  // --- 6. L'interrupteur : off, aperçu de PR, preview avec et sans clé, puis on ------------------------------------------------------------------------
  {
    const t = await monter(JOUR, { admin: ADMIN });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const adm = await connecter(banc, t);
    await a("on : info", "GET", "/api/jump/info");
    await adm("admin : Jump en off", "POST", "/api/admin/jeux/jump/etat", { etat: "off", confirmer: true });
    await a("off : info", "GET", "/api/jump/info");
    await a("off : jour", "GET", `/api/jump/day/${JOUR}`);
    await a("off : classement", "GET", `/api/jump/day/${JOUR}/board`);
    await a("off : envoi", "POST", "/api/jump/submit", corps(lent.code, { name: "Joueur1" }), 1);
    await a("off : vies", "POST", "/api/jump/lives", lot([P.morts[0]!.code]), 1);
    await a("off : les jeux", "GET", "/api/jeux");
    await a("aperçu de PR : jour", "GET", `/api/jump/day/${JOUR}`, undefined, null, HOTE_PR);
    await a("aperçu de PR : envoi", "POST", "/api/jump/submit", corps(lent.code, { name: "Joueur1" }), 1, HOTE_PR);
    await a("aperçu de PR : classement public vide", "GET", `/api/jump/day/${JOUR}/board`, undefined, 1, HOTE_PR);
    await a("aperçu de PR : vies non permises", "POST", "/api/jump/lives", lot([P.morts[0]!.code]), 1, HOTE_PR);
    await a("aperçu de PR : écriture non permise", "PUT", "/api/jump/submit", {}, 1, HOTE_PR);
    await adm("admin : Jump en preview", "POST", "/api/admin/jeux/jump/etat", { etat: "preview", confirmer: true });
    const cle = await adm("admin : clé d'aperçu", "POST", "/api/admin/jeux/jump/cle", { confirmer: true });
    const cleApercu = String(cle.body.cle ?? cle.body.key ?? Object.values(cle.body).find((v) => typeof v === "string" && v.length > 20) ?? "");
    await a("preview sans clé : info", "GET", "/api/jump/info");
    await a("preview, mauvaise clé : info", "GET", "/api/jump/info", undefined, null, { "X-Preview-Key": "mauvaise-cle" });
    await a("preview avec clé : info", "GET", "/api/jump/info", undefined, null, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : jour", "GET", `/api/jump/day/${JOUR}`, undefined, null, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : envoi (rangé à part)", "POST", "/api/jump/submit", corps(moyen.code, { name: "Joueur2" }), 2, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : vies non permises", "POST", "/api/jump/lives", lot([P.morts[0]!.code]), 2, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : classement public vide", "GET", `/api/jump/day/${JOUR}/board`, undefined, 2, { "X-Preview-Key": cleApercu });
    await a("preview : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "en preview");
    await adm("admin : clé révoquée", "POST", "/api/admin/jeux/jump/cle/revoquer", { confirmer: true });
    await a("preview, clé révoquée : info", "GET", "/api/jump/info", undefined, null, { "X-Preview-Key": cleApercu });
    await adm("admin : Jump on", "POST", "/api/admin/jeux/jump/etat", { etat: "on", confirmer: true });
    await a("on : info", "GET", "/api/jump/info");
    await a("on : classement (les essais d'aperçu sont effacés)", "GET", `/api/jump/day/${JOUR}/board`, undefined, 2);
    await a("on : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "après le passage à on");
  }

  // --- 7. Un jour figé : fichier de l'image, copie de la preuve, fichier abîmé, jour sans fichier ----------------------------------------------------------
  {
    const fichier = JSON.parse(readFileSync(new URL(`../../jump/public/levels/${FIGE}.json`, import.meta.url), "utf8")) as Record<string, unknown>;
    const fige = thawLevel(fichier, D(FIGE));
    if (typeof fige === "string") throw new Error(`le fichier figé ${FIGE} ne se vérifie pas : ${fige}`);
    const essai = demoAttempts(fige.level, fige.replay, 0x1234, { attempts: 12, reprise: repriseParPhase(fige) })
      .filter((x) => x.end === "arrivée")
      .map((x) => ({ code: encodeReplay(x.replay), r: replayAttempt(fige.level, x.replay, fige.id) }))
      .find((x) => x.r.finished && x.r.time > fige.authorTicks);
    if (!essai) throw new Error("aucun essai fictif n'arrive sur le jour figé");
    const c = (replay: string) => ({ levelId: fige.id, simVersion: fige.level.simVersion, generatorVersion: JUMP_GENERATOR_VERSION, replay });
    const t = await monter(FIGE, { jumpFrozen: { [FIGE]: fichier }, allowCopies: false });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null) => banc.appeler(t, nom, method, path, body, { id });
    await a("figé : info", "GET", "/api/jump/info");
    await a("figé : jour", "GET", `/api/jump/day/${FIGE}`);
    await a("figé : copie de la preuve de l'auteur", "POST", "/api/jump/submit", { ...c(fige.code), name: "Joueur1" }, 1);
    await a("figé : envoi", "POST", "/api/jump/submit", { ...c(essai.code), name: "Joueur1" }, 1);
    await a("figé : envoi avec les versions d'un vieil onglet", "POST", "/api/jump/submit", { ...c(essai.code), simVersion: fige.level.simVersion, generatorVersion: 1, name: "Joueur2" }, 2);
    await a("figé : classement", "GET", `/api/jump/day/${FIGE}/board`, undefined, 1);
    await a("figé : fantôme du premier", "GET", `/api/jump/day/${FIGE}/ghost/first`, undefined, 1);
    await a("figé : portail", "GET", "/api/portail/jour", undefined, 1);
    await etatDeLaBase(banc, t, "jour figé");

    const abime = { ...fichier, hash: "0000000000000000" };
    const t2 = await monter(FIGE, { jumpFrozen: { [FIGE]: abime } });
    await banc.appeler(t2, "figé abîmé : jour (généré)", "GET", `/api/jump/day/${FIGE}`);
    await etatDeLaBase(banc, t2, "figé abîmé");

    const t3 = await monter("2026-11-20", { jumpFrozen: { [FIGE]: fichier } });
    await banc.appeler(t3, "jour sans fichier", "GET", "/api/jump/day/2026-11-20");
  }

  return banc.traces;
}
