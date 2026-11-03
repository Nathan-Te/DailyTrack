import { parisDayStart } from "@cdj/clock";
import { formatDay, SIM_VERSION, VOITURE_PAR_DEFAUT, decodeReplay, dailyTrackId, encodeReplay, salonSessionEnd, salonSessionStart, themeForDay, THEME_NAMES } from "@cdj/sim";
import { refOfPlayer, sha256Hex } from "../src/players";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "../test/adminHelpers";
import { circuitOf, DAY, DAY_MS, NOON, makeApi, pilotReplay, playerId, salonReplay, SALON_SESSION, seedSalonCircuit, type TestApi } from "../test/helpers";
import { creerBanc, type Banc, type Trace } from "./banc";

// Lot K2c — le scénario du banc de réponses de Track (voir `banc.ts`), **écrit sur le code d'avant la migration** vers le module des jeux. Il couvre tout ce qui sort du serveur de Track : un envoi valide et un refus par
// code, les routes historiques sous `/api` (`day`, `leaderboard`, `ghost`, `run/<ref>`, `planning`, `garage`, `me`), le circuit du jour et les variantes du planning, les médailles de chaque version du générateur (G1),
// le Salon et le Garage (routes propres : au banc pour prouver qu'elles n'ont pas bougé), les fantômes choisis, `X-Player-Id` et l'ancien `?player=` en transition, le classement Tous / Amis / Mon groupe / Groupes /
// portail, l'interrupteur (`off`, aperçu de PR, `preview` avec et sans clé, `on`), l'administration, le changement de code, l'effacement, le débit, le plafond de rejeux, la grâce de minuit.
// Les courses sont de vraies courses du pilote automatique rejouées par le serveur : l'horloge est injectée, tout est déterministe.

const ORIGINE = "http://api.test";
const JETON = "jeton-admin-de-test-assez-long-pour-passer";
const ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };
const HOTE_PR = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };
const AUTH = { Authorization: `Bearer ${JETON}` };
const JOUR = formatDay(DAY);
const DEMAIN = formatDay(DAY + 1);
const midi = (jour: number): number => jour * DAY_MS + 12 * 3_600_000;
const GT = { id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 };

/** La base telle que le serveur l'a écrite (rediffusions et textes réduits à leur empreinte). */
async function etatDeLaBase(banc: Banc, t: TestApi, nom: string, jours: readonly number[], joueurs: readonly number[] = [1, 2, 3, 4, 5, 99]): Promise<void> {
  const court = async (v: unknown) => (v === null || v === undefined ? null : (await sha256Hex(String(v))).slice(0, 16));
  const resultats: Record<string, unknown>[] = [];
  const circuits: Record<string, unknown>[] = [];
  const plans: Record<string, unknown>[] = [];
  for (const jour of jours) {
    resultats.push(
      ...(await t.db.all<Record<string, unknown>>(
        "SELECT day, player_id, ms, splits, replay, respawns, submitted_at, final_rank, final_total, inputs_hash, car, hidden, apercu FROM results WHERE day = ? ORDER BY player_id",
        [jour],
      )),
    );
    const c = await t.db.first<Record<string, unknown>>("SELECT day, track_id, spec, author_ms, attempt, palette, created_at, author_hash FROM circuits WHERE day = ?", [jour]);
    if (c) circuits.push(c);
    const p = await t.db.first<Record<string, unknown>>("SELECT day, variant, theme, chosen_at FROM planning WHERE day = ?", [jour]);
    if (p) plans.push(p);
  }
  banc.noter(`${nom} — results`, await Promise.all(resultats.map(async (r) => ({ ...r, replay: await court(r.replay) }))));
  banc.noter(`${nom} — circuits`, await Promise.all(circuits.map(async (c) => ({ ...c, spec: await court(c.spec) }))));
  banc.noter(`${nom} — planning`, plans);
  const choix: Record<string, unknown>[] = [];
  for (const n of joueurs) {
    const g = await t.db.first<Record<string, unknown>>("SELECT player_id, car, minute FROM garage_choices WHERE player_id = ?", [playerId(n)]);
    if (g) choix.push(g);
  }
  banc.noter(`${nom} — garage_choices`, choix);
}

async function connecter(banc: Banc, t: TestApi) {
  const r = await banc.appeler(t, "admin : connexion", "POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGINE, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGINE, "X-Cdj-Admin": "1" };
  return (nom: string, method: string, path: string, body?: unknown) => banc.appeler(t, nom, method, path, body, { headers });
}

export async function scenarioTrack(): Promise<Trace[]> {
  const banc = creerBanc(playerId);
  const grips = [0.9, 0.8, 0.7, 0.6, 0.5, 0.55];
  const courses = grips.map((g) => pilotReplay(DAY, g));
  const auteur = encodeReplay(circuitOf(DAY).authorReplay);
  const [c1, c2, c3, c4, c5, c6] = courses as [(typeof courses)[0], (typeof courses)[0], (typeof courses)[0], (typeof courses)[0], (typeof courses)[0], (typeof courses)[0]];
  const corps = (replay: unknown, extra: Record<string, unknown> = {}) => ({ date: JOUR, replay, ...extra });

  // --- 1. Le jour générique : lectures, refus, envois, classements, fantômes, profil, garage, planning, amis, groupes, portail, administration, effacement ------------
  {
    const t = await makeApi({ allowCopies: false, adminToken: JETON, admin: ADMIN, environment: "recette" });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const envoyer = (nom: string, n: number, body: unknown, extra: Record<string, unknown> = {}) => a(nom, "POST", "/api/submit", { ...(body as object), name: `Joueur${n}`, ...extra }, n);

    await a("jour", "GET", `/api/day/${JOUR}`);
    await a("jour futur", "GET", `/api/day/${DEMAIN}`);
    await a("jour avant le premier circuit", "GET", "/api/day/2020-01-01");
    await a("date illisible", "GET", "/api/day/2026-13-45");
    await a("date mal encodée", "GET", "/api/day/%E0");
    await a("planning public", "GET", "/api/planning");
    await a("jour en POST", "POST", `/api/day/${JOUR}`, {});
    await a("submit en GET", "GET", "/api/submit");
    await a("leaderboard en POST", "POST", `/api/day/${JOUR}/leaderboard`, {});
    await a("route inconnue", "GET", "/api/zz");
    await a("classement vide", "GET", `/api/day/${JOUR}/leaderboard`);
    await a("classement vide avec identifiant", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 1);
    await a("classement : date illisible", "GET", "/api/day/2026-13-45/leaderboard");
    await a("fantôme : genre manquant", "GET", `/api/day/${JOUR}/ghost`);
    await a("fantôme : genre inconnu", "GET", `/api/day/${JOUR}/ghost?kind=zz`);
    await a("fantôme du premier sans classé", "GET", `/api/day/${JOUR}/ghost?kind=first`);
    await a("fantôme devant toi sans identifiant", "GET", `/api/day/${JOUR}/ghost?kind=ahead`);
    await a("fantôme devant toi, jamais classé", "GET", `/api/day/${JOUR}/ghost?kind=ahead`, undefined, 1);
    await a("course d'une référence mal formée", "GET", `/api/day/${JOUR}/run/zz`);
    await a("course d'une référence inconnue", "GET", `/api/day/${JOUR}/run/0123456789ab`);
    await a("me sans identifiant", "GET", "/api/me");
    await a("me d'un inconnu", "GET", "/api/me", undefined, 1);
    await a("garage sans identifiant", "GET", "/api/garage");
    await a("garage en POST", "POST", "/api/garage", {}, 1);
    await a("garage : choix d'un inconnu", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT, minute: 5 }, 1);

    // Les refus, un par code (ils n'écrivent ni course ni joueur).
    const r0 = decodeReplay(c1.code);
    await a("refus : pas d'identifiant", "POST", "/api/submit", { ...corps(c1.code), name: "A" });
    await banc.appeler(t, "refus : corps illisible", "POST", "/api/submit", undefined, { id: 1, raw: "pas du json" });
    await envoyer("refus : corps démesuré", 1, corps("A".repeat(450_000)));
    await envoyer("refus : date manquante", 1, { replay: c1.code });
    await envoyer("refus : date illisible", 1, corps(c1.code, { date: "demain" }));
    await envoyer("refus : jour futur", 1, corps(c1.code, { date: DEMAIN }));
    await envoyer("refus : jour avant le premier", 1, corps(c1.code, { date: "2020-01-01" }));
    await envoyer("refus : jour fermé", 1, corps(c1.code, { date: formatDay(DAY - 1) }));
    await envoyer("refus : rediffusion manquante", 1, corps(undefined));
    await envoyer("refus : rediffusion vide", 1, corps(""));
    await envoyer("refus : rediffusion qui n'est pas du texte", 1, corps(12));
    await envoyer("refus : texte illisible", 1, corps("%%%"));
    await envoyer("refus : simulation plus ancienne", 1, corps(encodeReplay({ ...r0, simVersion: SIM_VERSION - 1 })));
    await envoyer("refus : simulation plus récente", 1, corps(encodeReplay({ ...r0, simVersion: SIM_VERSION + 1 })));
    await envoyer("refus : autre circuit", 1, corps(encodeReplay({ ...r0, trackId: dailyTrackId(DAY - 3) })));
    await envoyer("refus : la course n'arrive pas", 1, corps(encodeReplay({ ...r0, runs: r0.runs.slice(0, Math.floor(r0.runs.length / 2)) })));
    await a("refus : pseudo manquant", "POST", "/api/submit", corps(c1.code), 1);
    await envoyer("refus : pseudo interdit", 1, corps(c1.code), { name: "<b>" });
    await a("refus : identifiant mal formé", "POST", "/api/submit", { ...corps(c1.code), name: "A" }, undefined, { "X-Player-Id": "pas-un-identifiant" });
    await etatDeLaBase(banc, t, "après les refus", [DAY]);

    // Les envois : un premier (avec une voiture verrouillée), le même, d'autres joueurs, des copies, un pseudo pris, l'ancien identifiant du corps.
    await envoyer("envoi valide (voiture verrouillée)", 1, corps(c4.code, { voiture: GT }));
    t.clock.now += 1000;
    await envoyer("même course renvoyée (pas un record)", 1, corps(c4.code));
    t.clock.now += 1000;
    await envoyer("le joueur 1 améliore sa course", 1, corps(c2.code, { voiture: VOITURE_PAR_DEFAUT }));
    t.clock.now += 1000;
    await envoyer("autre joueur", 2, corps(c3.code));
    t.clock.now += 1000;
    await envoyer("troisième joueur", 3, corps(c1.code));
    t.clock.now += 1000;
    await envoyer("quatrième joueur", 4, corps(c5.code));
    t.clock.now += 1000;
    await envoyer("copie de la course d'un autre", 5, corps(c1.code));
    await envoyer("copie de la course de l'auteur", 5, corps(auteur));
    await envoyer("pseudo déjà pris", 5, corps(c3.code), { name: "Joueur1" });
    await envoyer("temps annoncé ignoré", 5, corps(c6.code), { ms: 1, medal: "author" });
    await a("envoi avec l'identifiant dans le corps (transition)", "POST", "/api/submit", { ...corps(c4.code), name: "Joueur6", playerId: playerId(6) });

    // Lectures : classement, fantômes, course choisie, profil, garage.
    await a("classement", "GET", `/api/day/${JOUR}/leaderboard`);
    await a("classement du joueur 1", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 1);
    await a("classement du joueur 3", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 3);
    await a("classement d'un non-classé", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 9);
    await a("classement : limite 2", "GET", `/api/day/${JOUR}/leaderboard?limit=2`);
    await a("classement : limite démesurée", "GET", `/api/day/${JOUR}/leaderboard?limit=500`);
    await a("classement : limite illisible", "GET", `/api/day/${JOUR}/leaderboard?limit=abc`);
    await a("classement avec l'ancien ?player=", "GET", `/api/day/${JOUR}/leaderboard?player=${playerId(3)}`);
    await a("classement avec ?player= mal formé", "GET", `/api/day/${JOUR}/leaderboard?player=zz`);
    await a("fantôme du premier", "GET", `/api/day/${JOUR}/ghost?kind=first`);
    await a("fantôme devant le joueur 2", "GET", `/api/day/${JOUR}/ghost?kind=ahead`, undefined, 2);
    await a("fantôme devant le joueur 3", "GET", `/api/day/${JOUR}/ghost?kind=ahead`, undefined, 3);
    await a("fantôme devant le premier", "GET", `/api/day/${JOUR}/ghost?kind=ahead`, undefined, 1);
    await a("fantôme devant avec l'ancien ?player=", "GET", `/api/day/${JOUR}/ghost?kind=ahead&player=${playerId(3)}`);
    const ref1 = await refOfPlayer(playerId(1));
    const ref2 = await refOfPlayer(playerId(2));
    await a("course choisie (joueur 1)", "GET", `/api/day/${JOUR}/run/${ref1}`);
    await a("course choisie en majuscules", "GET", `/api/day/${JOUR}/run/${ref2.toUpperCase()}`);
    await a("course choisie d'un autre jour", "GET", `/api/day/${formatDay(DAY - 1)}/run/${ref1}`);
    await a("me du joueur 1", "GET", "/api/me", undefined, 1);
    await a("garage du joueur 1", "GET", "/api/garage", undefined, 1);
    await a("garage : choix de la voiture par défaut", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT, minute: 10 }, 1);
    await a("garage : voiture verrouillée refusée", "PUT", "/api/garage", { voiture: GT, minute: 11 }, 1);
    await a("garage : choix plus ancien refusé", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT, minute: 5 }, 1);
    await a("garage : choix illisible", "PUT", "/api/garage", { voiture: "n'importe quoi", minute: 12 }, 1);
    await a("garage : identifiant dans le corps refusé", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT, playerId: playerId(1) });
    await a("garage relu", "GET", "/api/garage", undefined, 1);
    await a("me avec le choix du garage", "GET", "/api/me", undefined, 1);
    await a("portail : le jour", "GET", "/api/portail/jour");
    await a("portail : le jour du joueur 1", "GET", "/api/portail/jour", undefined, 1);
    await a("portail : classement Track", "GET", `/api/portail/classement?date=${JOUR}&vue=track`);
    await a("portail : classement Track du joueur 2", "GET", `/api/portail/classement?date=${JOUR}&vue=track`, undefined, 2);
    await a("portail : classement cumulé", "GET", `/api/portail/classement?date=${JOUR}`, undefined, 1);
    await a("portail : profil du joueur 1", "GET", "/api/portail/profil", undefined, 1);
    await a("jour après les courses", "GET", `/api/day/${JOUR}`);

    // Le planning : l'administration remplace le circuit de demain (jeton), le jeu le lit le lendemain.
    await a("planning : sans jeton", "PUT", `/api/admin/planning/${DEMAIN}`, { variant: 1 });
    await a("planning : remplacer demain", "PUT", `/api/admin/planning/${DEMAIN}`, { variant: 2, theme: THEME_NAMES.find((n) => n !== themeForDay(DAY + 1).name) }, undefined, AUTH);
    await a("planning : aujourd'hui refusé", "PUT", `/api/admin/planning/${JOUR}`, { variant: 1 }, undefined, AUTH);
    await a("planning : variante invalide", "PUT", `/api/admin/planning/${DEMAIN}`, { variant: -1 }, undefined, AUTH);
    await a("planning : thème invalide", "PUT", `/api/admin/planning/${DEMAIN}`, { variant: 1, theme: "lave" }, undefined, AUTH);
    await a("planning : trop loin", "PUT", `/api/admin/planning/${formatDay(DAY + 200)}`, { variant: 1 }, undefined, AUTH);
    await a("planning : demain n'est pas public", "GET", `/api/day/${DEMAIN}`);
    await a("planning : la vue de l'administration", "GET", "/api/admin/overview", undefined, undefined, AUTH);
    await a("planning : médailles de l'administration", "GET", "/api/admin/medailles", undefined, undefined, AUTH);
    await a("planning : route d'administration inconnue", "GET", "/api/admin/zz", undefined, undefined, AUTH);
    await a("planning : revenir à l'original", "DELETE", `/api/admin/planning/${DEMAIN}`, undefined, undefined, AUTH);
    await a("planning : remplacer à nouveau", "PUT", `/api/admin/planning/${DEMAIN}`, { variant: 3 }, undefined, AUTH);
    await etatDeLaBase(banc, t, "après les envois", [DAY, DAY + 1]);

    // Amis : le joueur 1 suit le 2 (sens unique), le 3 suit le 1.
    await a("amis : ajouter par pseudo", "POST", "/api/amis", { pseudo: "Joueur2" }, 1);
    await a("amis : ajouter le premier", "POST", "/api/amis", { pseudo: "Joueur1" }, 3);
    await a("classement Amis du joueur 1", "GET", `/api/day/${JOUR}/leaderboard?filtre=amis`, undefined, 1);
    await a("classement Amis du joueur 3", "GET", `/api/day/${JOUR}/leaderboard?filtre=amis`, undefined, 3);
    await a("classement Amis sans identifiant", "GET", `/api/day/${JOUR}/leaderboard?filtre=amis`);
    await a("classement : filtre inconnu", "GET", `/api/day/${JOUR}/leaderboard?filtre=zz`, undefined, 1);
    await a("classement Amis du portail", "GET", `/api/portail/classement?date=${JOUR}&vue=track&filtre=amis`, undefined, 1);
    await a("feuille d'un ami", "GET", `/api/amis/fiche/${ref2}?date=${JOUR}`, undefined, 1);

    // Groupes.
    const creation = await a("groupe : création", "POST", "/api/groupes", { nom: "Les Hauts", description: "" }, 1);
    const moi = await a("groupe : mon groupe", "GET", "/api/groupes/moi", undefined, 1);
    for (const n of [2, 3, 4]) await a(`groupe : le joueur ${n} rejoint`, "POST", "/api/groupes/rejoindre", { jeton: moi.body.groupe.invitation }, n);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [DAY - 1, creation.body.id]);
    await a("classement Mon groupe du joueur 1", "GET", `/api/day/${JOUR}/leaderboard?filtre=groupe`, undefined, 1);
    await a("classement Mon groupe du joueur 5 (sans groupe)", "GET", `/api/day/${JOUR}/leaderboard?filtre=groupe`, undefined, 5);
    await a("amis : le sélecteur porte le groupe", "GET", "/api/amis", undefined, 1);
    await a("classement des groupes (Track)", "GET", `/api/groupes/classement?date=${JOUR}&vue=track`);
    await a("classement des groupes (cumulé)", "GET", `/api/groupes/classement?date=${JOUR}&vue=cumul`);

    // L'administration (session) lit Track : fiche d'un joueur, masquer, retirer, renommer.
    const adm = await connecter(banc, t);
    await adm("admin : recherche", "GET", "/api/admin/joueurs?q=Joueur");
    await adm("admin : fiche du joueur 1", "GET", `/api/admin/joueurs/${ref1}`);
    await adm("admin : tableau de bord", "GET", "/api/admin/tableau");
    await adm("admin : masquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: true, confirmer: true });
    await a("classement sans le joueur masqué", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 3);
    await a("fantôme du premier sans le masqué", "GET", `/api/day/${JOUR}/ghost?kind=first`);
    await a("course choisie d'un masqué", "GET", `/api/day/${JOUR}/run/${ref2}`);
    await a("portail : classement Track sans le masqué", "GET", `/api/portail/classement?date=${JOUR}&vue=track`);
    await a("le masqué se voit lui-même", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 2);
    await adm("admin : démasquer le joueur 2", "POST", `/api/admin/joueurs/${ref2}/masquer`, { masque: false, confirmer: true });
    await adm("admin : retirer la course du joueur 4", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(4))}/retirer`, { jeu: "cdj", date: JOUR, motif: "temps impossible", confirmer: true });
    await envoyer("la course retirée ne revient pas", 4, corps(c5.code));
    await a("classement après le retrait", "GET", `/api/day/${JOUR}/leaderboard`);
    await adm("admin : renommer le joueur 3", "POST", `/api/admin/joueurs/${await refOfPlayer(playerId(3))}/renommer`, { pseudo: "Troisieme", confirmer: true });
    await a("classement après le renommage", "GET", `/api/day/${JOUR}/leaderboard`);
    await a("pseudo changé par le joueur", "PUT", "/api/player", { playerId: playerId(1), name: "Nouveau" });
    await a("classement après le changement de pseudo", "GET", `/api/day/${JOUR}/leaderboard`);

    // Changer de code, puis un ancien code refusé.
    await a("changer de code", "POST", "/api/me/code", { newId: playerId(99) }, 2);
    await envoyer("ancien code refusé", 2, corps(c3.code));
    await a("le nouveau code garde la course", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 99);
    await a("me avec l'ancien code", "GET", "/api/me", undefined, 2);
    await a("garage avec l'ancien code", "GET", "/api/garage", undefined, 2);
    await a("fantôme avec l'ancien code", "GET", `/api/day/${JOUR}/ghost?kind=ahead`, undefined, 2);
    await a("la vue de l'administration compte l'ancien ?player=", "GET", "/api/admin/overview", undefined, undefined, AUTH);
    await etatDeLaBase(banc, t, "avant l'effacement", [DAY]);

    // Le lendemain : la course de la veille est figée, la place finale est calculée au profil.
    t.clock.now = parisDayStart(DAY + 1) + 11 * 60_000;
    await a("lendemain : classement d'hier", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 3);
    await a("lendemain : me", "GET", "/api/me", undefined, 3);
    await a("lendemain : le circuit de demain remplacé", "GET", `/api/day/${DEMAIN}`);
    t.clock.now = NOON;

    // Effacement d'un joueur (essai à blanc, puis pour de bon).
    const code = `CDJ2.${playerId(1)}.${(await import("../src/identity")).crc32Hex(new TextEncoder().encode(playerId(1)))}`;
    await a("effacement : essai à blanc", "POST", "/api/admin/effacer", { code }, undefined, AUTH);
    await a("effacement", "POST", "/api/admin/effacer", { code, confirmer: true }, undefined, AUTH);
    await a("classement après l'effacement", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 3);
    await a("me après l'effacement", "GET", "/api/me", undefined, 1);
    await a("garage après l'effacement", "GET", "/api/garage", undefined, 1);
    await a("portail : jour après l'effacement", "GET", "/api/portail/jour", undefined, 3);
    await etatDeLaBase(banc, t, "après l'effacement", [DAY]);
  }

  // --- 2. Le Salon (routes propres) ---------------------------------------------------------------------------------------------------------------------
  {
    const S = SALON_SESSION;
    const fast = salonReplay(S, 0.9);
    const mid = salonReplay(S, 0.78);
    const slow = salonReplay(S, 0.65);
    const t = await makeApi({ allowCopies: false });
    await seedSalonCircuit(t.db, S);
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    await a("salon : maintenant", "GET", `/api/salon/now?player=${playerId(1)}`);
    await a("salon : maintenant avec l'en-tête", "GET", "/api/salon/now", undefined, 2);
    await a("salon : maintenant sans joueur", "GET", "/api/salon/now");
    await a("salon : session illisible", "GET", "/api/salon/%E0/board");
    await a("salon : route inconnue", "GET", `/api/salon/${S}/zz`);
    await a("salon : classement vide", "GET", `/api/salon/${S}/board?player=${playerId(1)}`);
    await a("salon : fantômes vides", "GET", `/api/salon/${S}/ghosts`);
    await a("salon : envoi sans identifiant", "POST", `/api/salon/${S}/submit`, { name: "A", replay: fast.code });
    await a("salon : envoi illisible", "POST", `/api/salon/${S}/submit`, { playerId: playerId(1), name: "Salon1", replay: "%%%" });
    await a("salon : session future", "POST", `/api/salon/${S + 5}/submit`, { playerId: playerId(1), name: "Salon1", replay: fast.code });
    t.clock.now += 6_000;
    await a("salon : envoi valide", "POST", `/api/salon/${S}/submit`, { playerId: playerId(1), name: "Salon1", replay: slow.code, voiture: VOITURE_PAR_DEFAUT });
    t.clock.now += 6_000;
    await a("salon : meilleur temps", "POST", `/api/salon/${S}/submit`, { playerId: playerId(1), name: "Salon1", replay: fast.code });
    t.clock.now += 6_000;
    await a("salon : deuxième joueur", "POST", `/api/salon/${S}/submit`, { playerId: playerId(2), name: "Salon2", replay: mid.code });
    await a("salon : copie", "POST", `/api/salon/${S}/submit`, { playerId: playerId(3), name: "Salon3", replay: fast.code });
    await a("salon : classement", "GET", `/api/salon/${S}/board?player=${playerId(2)}`);
    await a("salon : classement avec l'en-tête", "GET", `/api/salon/${S}/board`, undefined, 1);
    await a("salon : fantômes", "GET", `/api/salon/${S}/ghosts`);
    await a("salon : fantômes choisis", "GET", `/api/salon/${S}/ghosts?refs=zz`);
    const lignes = await t.db.all<Record<string, unknown>>("SELECT session, player_id, ref, name, ms, splits, replay, submitted_at, car FROM salon_runs WHERE session = ? ORDER BY player_id", [S]);
    banc.noter("salon — salon_runs", await Promise.all(lignes.map(async (l) => ({ ...l, replay: (await sha256Hex(String(l.replay))).slice(0, 16) }))));
    t.clock.now = salonSessionEnd(S) + 2_000;
    await a("salon : envoi dans la grâce", "POST", `/api/salon/${S}/submit`, { playerId: playerId(4), name: "Salon4", replay: slow.code });
    t.clock.now = salonSessionEnd(S) + 5_000;
    await a("salon : envoi trop tard", "POST", `/api/salon/${S}/submit`, { playerId: playerId(5), name: "Salon5", replay: slow.code });
    await a("salon : classement final servi", "GET", `/api/salon/${S}/board`);
    t.clock.now = salonSessionEnd(S) + 25_000;
    await a("salon : session oubliée", "GET", `/api/salon/${S}/board`);
    banc.noter("salon — après l'oubli", await t.db.all<Record<string, unknown>>("SELECT session, player_id FROM salon_runs WHERE session = ?", [S]));
    banc.noter("salon — début", { debut: salonSessionStart(S) });
  }

  // --- 3. Le plafond global de rejeux (503) -------------------------------------------------------------------------------------------------------
  {
    const t = await makeApi({ replaysPerMinute: 1 });
    const envoyer = (nom: string, n: number, replay: string) => banc.appeler(t, nom, "POST", "/api/submit", { ...corps(replay), name: `Joueur${n}` }, { id: n });
    await envoyer("plafond : premier rejeu", 1, c1.code);
    await envoyer("plafond : trop de rejeux", 2, c2.code);
    t.clock.now += 61_000;
    await envoyer("plafond : la minute suivante", 2, c2.code);
  }

  // --- 4. Le débit par joueur et par adresse (429) -------------------------------------------------------------------------------------------------
  {
    const t = await makeApi({ limits: { windowMs: 600_000, perClient: 4, perPlayer: 2 } });
    const envoyer = (nom: string, n: number) => banc.appeler(t, nom, "POST", "/api/submit", { ...corps("%%%"), name: `Joueur${n}` }, { id: n, clientKey: "203.0.113.7" });
    await envoyer("débit : 1er envoi du joueur", 1);
    await envoyer("débit : 2e envoi du joueur", 1);
    await envoyer("débit : limite du joueur", 1);
    await envoyer("débit : un autre joueur, même adresse", 2);
    await envoyer("débit : limite de l'adresse", 3);
  }

  // --- 5. La grâce après minuit et le jour fermé ----------------------------------------------------------------------------------------------------
  {
    const hier = pilotReplay(DAY - 1, 0.9);
    const t = await makeApi();
    const minuit = parisDayStart(DAY);
    const corpsHier = { date: formatDay(DAY - 1), replay: hier.code };
    t.clock.now = minuit + 5 * 60_000;
    await banc.appeler(t, "grâce : 00 h 05", "POST", "/api/submit", { ...corpsHier, name: "Joueur1" }, { id: 1 });
    await banc.appeler(t, "grâce : classement d'hier", "GET", `/api/day/${formatDay(DAY - 1)}/leaderboard`, undefined, { id: 1 });
    t.clock.now = minuit + 11 * 60_000;
    await banc.appeler(t, "grâce : 00 h 11", "POST", "/api/submit", { ...corpsHier, name: "Joueur2" }, { id: 2 });
    await banc.appeler(t, "grâce : classement d'hier, jour fermé", "GET", `/api/day/${formatDay(DAY - 1)}/leaderboard`, undefined, { id: 1 });
    await banc.appeler(t, "grâce : fantôme d'hier", "GET", `/api/day/${formatDay(DAY - 1)}/ghost?kind=first`);
  }

  // --- 6. L'interrupteur : off, aperçu de PR, preview avec et sans clé, puis on ------------------------------------------------------------------------
  {
    const t = await makeApi({ admin: ADMIN, environment: "recette" });
    const a = (nom: string, method: string, path: string, body?: unknown, id?: number | null, headers?: Record<string, string>) => banc.appeler(t, nom, method, path, body, { id, headers });
    const adm = await connecter(banc, t);
    await a("on : jour", "GET", `/api/day/${JOUR}`);
    await adm("admin : Track en off", "POST", "/api/admin/jeux/track/etat", { etat: "off", confirmer: true });
    await a("off : jour", "GET", `/api/day/${JOUR}`);
    await a("off : classement", "GET", `/api/day/${JOUR}/leaderboard`);
    await a("off : envoi", "POST", "/api/submit", { ...corps(c1.code), name: "Joueur1" }, 1);
    await a("off : garage", "GET", "/api/garage", undefined, 1);
    await a("off : planning", "GET", "/api/planning");
    await a("off : les jeux", "GET", "/api/jeux");
    await a("aperçu de PR : jour", "GET", `/api/day/${JOUR}`, undefined, null, HOTE_PR);
    await a("aperçu de PR : envoi", "POST", "/api/submit", { ...corps(c1.code), name: "Joueur1" }, 1, HOTE_PR);
    await a("aperçu de PR : classement public vide", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 1, HOTE_PR);
    await a("aperçu de PR : garage non permis", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT }, 1, HOTE_PR);
    await adm("admin : Track en preview", "POST", "/api/admin/jeux/track/etat", { etat: "preview", confirmer: true });
    const cle = await adm("admin : clé d'aperçu", "POST", "/api/admin/jeux/track/cle", { confirmer: true });
    const cleApercu = String(cle.body.cle ?? cle.body.key ?? Object.values(cle.body).find((v) => typeof v === "string" && v.length > 20) ?? "");
    await a("preview sans clé : jour", "GET", `/api/day/${JOUR}`);
    await a("preview, mauvaise clé : jour", "GET", `/api/day/${JOUR}`, undefined, null, { "X-Preview-Key": "mauvaise-cle" });
    await a("preview avec clé : jour", "GET", `/api/day/${JOUR}`, undefined, null, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : envoi (rangé à part)", "POST", "/api/submit", { ...corps(c2.code), name: "Joueur2" }, 2, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : garage non permis", "PUT", "/api/garage", { voiture: VOITURE_PAR_DEFAUT }, 2, { "X-Preview-Key": cleApercu });
    await a("preview avec clé : classement public vide", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 2, { "X-Preview-Key": cleApercu });
    await a("preview : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "en preview", [DAY]);
    await adm("admin : clé révoquée", "POST", "/api/admin/jeux/track/cle/revoquer", { confirmer: true });
    await a("preview, clé révoquée : jour", "GET", `/api/day/${JOUR}`, undefined, null, { "X-Preview-Key": cleApercu });
    await adm("admin : Track on", "POST", "/api/admin/jeux/track/etat", { etat: "on", confirmer: true });
    await a("on : jour", "GET", `/api/day/${JOUR}`);
    await a("on : classement (les courses d'aperçu sont effacées)", "GET", `/api/day/${JOUR}/leaderboard`, undefined, 2);
    await a("on : les jeux", "GET", "/api/jeux");
    await etatDeLaBase(banc, t, "après le passage à on", [DAY]);
  }

  // --- 7. Les médailles de chaque version du générateur (lot G1) : une course sur un jour de chaque plage du registre ---------------------------------------
  for (const date of ["2026-10-27", "2026-10-28", "2026-10-29"]) {
    const jour = Number(await (async () => (await import("@cdj/core")).parseDay(date))());
    const course = pilotReplay(jour, 0.9);
    const t = await makeApi({ seed: false });
    t.clock.now = midi(jour);
    await banc.appeler(t, `médailles ${date} : jour`, "GET", `/api/day/${date}`);
    await banc.appeler(t, `médailles ${date} : envoi`, "POST", "/api/submit", { date, replay: course.code, name: "Joueur1" }, { id: 1 });
    await banc.appeler(t, `médailles ${date} : classement`, "GET", `/api/day/${date}/leaderboard`, undefined, { id: 1 });
    await banc.appeler(t, `médailles ${date} : portail`, "GET", "/api/portail/jour", undefined, { id: 1 });
    await etatDeLaBase(banc, t, `médailles ${date}`, [jour], [1]);
  }

  return banc.traces;
}
