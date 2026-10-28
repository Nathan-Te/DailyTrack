import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { medalFor, medalsFor, replayTicks, resumeRegistreTrack } from "@cdj/sim";
import { dailyLevel, jumpMedalFor, TICK_RATE, type DailyLevel } from "@cdj/jump-sim";
import { SESSION_MS } from "../src/adminSession";
import { inputsHash, trackInputs } from "../src/copies";
import { SCHEMA } from "../src/db";
import { refOfPlayer } from "../src/players";
import { nameKey } from "../src/pseudos";
import type { Logger } from "../src/log";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY, cleDeTest, fauxFetch, jeton, type CleDeTest } from "./adminHelpers";
import { circuitOf, makeApi, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot N1 (plateforme) : le panneau d'administration côté serveur — connexion, session, protections, tableau de bord, joueurs, les cinq actions et leur effet sur les
// classements, journal. Les résultats sont écrits directement en base (comme `classement.test.ts`) ; les lectures, elles, sont les vraies. SQLite et libSQL.

const TODAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(TODAY);
const HIER = formatDay(TODAY - 1);
const NOON = parisDayStart(TODAY) + 12 * 3_600_000;
const JOUR = 86_400_000;
const ORIGIN = "http://api.test";
const ADMIN_FAKE = `factice:${ADMIN_EMAIL}`;

let J: DailyLevel;
beforeAll(() => {
  J = dailyLevel(TODAY);
}, 60_000);

// --- Fixtures ---------------------------------------------------------------------------------------------------------------------
type Options = Parameters<typeof makeApi>[0];
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830", commit: "0123456789abcdef0123456789abcdef01234567" };

async function adminApi(options: Options = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN, ...options });
  t.clock.now = NOON;
  await t.call("GET", "/api/health"); // le schéma
  // Le circuit de Track du jour, comme le ferait un premier appel (le générateur est coûteux).
  const c = circuitOf(TODAY);
  const authorHash = await inputsHash(trackInputs(c.authorReplay.runs, replayTicks(c.authorReplay)));
  await t.db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at, author_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [TODAY, c.track.id, c.spec, c.authorMs, c.attempt, c.palette, NOON, authorHash]);
  return t;
}

async function joueur(t: TestApi, n: number, name: string, creation = NOON - 5 * JOUR): Promise<void> {
  await t.db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, ?, ?, ?, 0, ?)", [playerId(n), name, creation, creation, nameKey(name)]);
}
async function track(t: TestApi, day: number, n: number, ms: number, at = NOON - 3_600_000 + n): Promise<void> {
  await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, inputs_hash) VALUES (?, ?, ?, '[]', ?, 0, ?, ?)", [day, playerId(n), ms, `REDIFFUSION-TRACK-${n}-${day}`, at, `h-${n}-${day}`]);
}
async function jump(t: TestApi, day: number, n: number, ticks: number, at = NOON - 3_600_000 + n): Promise<void> {
  await t.db.run(
    "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash) VALUES (?, ?, ?, ?, 2, ?, 1, 1, ?, ?, ?)",
    [day, playerId(n), J.id, ticks, `REDIFFUSION-JUMP-${n}-${day}`, at, at, `j-${n}-${day}`],
  );
}

/** Quatre joueurs : Alice (les deux jeux, aujourd'hui et hier), Bob (les deux jeux), Chloé (Jump, créée aujourd'hui), Dan (Track, il y a deux jours). */
async function peupler(t: TestApi): Promise<void> {
  await joueur(t, 1, "Alice");
  await joueur(t, 2, "Bob");
  await joueur(t, 3, "Chloé", NOON - 1000);
  await joueur(t, 4, "Dan", NOON - 3 * JOUR);
  await track(t, TODAY, 1, 60_000);
  await track(t, TODAY, 2, 61_000);
  await jump(t, TODAY, 1, J.authorTicks + 10);
  await jump(t, TODAY, 2, J.authorTicks + 20);
  await jump(t, TODAY, 3, J.authorTicks + 30);
  await track(t, TODAY - 1, 1, 70_000);
  await track(t, TODAY - 1, 4, 71_000);
  await track(t, TODAY - 2, 4, 72_000);
}

/** Se connecte (vérificateur factice) et rend un appel d'administration (cookie, en-tête et origine posés). */
async function connecte(t: TestApi, email = ADMIN_EMAIL) {
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${email}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  return {
    cookie,
    login: r,
    adm: (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => t.call(method, path, body, { headers: { ...headers, ...extra } }),
  };
}
type Adm = Awaited<ReturnType<typeof connecte>>["adm"];

const ref = (n: number) => refOfPlayer(playerId(n));
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const confirmer = { confirmer: true };

// --- Configuration ----------------------------------------------------------------------------------------------------------------
describe(`panneau : configuration (${TEST_DB})`, () => {
  it("non configuré : `config` le dit, tout le reste n'existe pas (404) ; les outils de DailyTrack ne changent pas", async () => {
    const t = await makeApi({ seed: false });
    expect((await t.call("GET", "/api/admin/config")).body).toEqual({ actif: false, clientId: null, factice: false });
    for (const [m, p] of [["GET", "/api/admin/tableau"], ["GET", "/api/admin/joueurs"], ["GET", "/api/admin/journal"], ["POST", "/api/admin/session"], ["GET", "/api/admin/session"]] as const) {
      const r = await t.call(m, p, m === "POST" ? {} : undefined);
      expect([m, p, r.status], JSON.stringify(r.body)).toEqual([m, p, 404]);
    }
    expect((await t.call("GET", "/api/admin/overview")).status).toBe(404); // pas de jeton : comme avant
  });

  it("incomplet (pas de clé de session, ou aucune adresse) : non configuré", async () => {
    for (const admin of [{ ...OPTIONS_ADMIN, sessionKey: undefined }, { ...OPTIONS_ADMIN, emails: [] }, { ...OPTIONS_ADMIN, sessionKey: "courte" }, { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY }]) {
      const t = await makeApi({ seed: false, admin });
      expect((await t.call("GET", "/api/admin/config")).body.actif).toBe(false);
    }
  });

  it("configuré : donne l'identifiant client (public) et dit si le vérificateur est factice ; jamais une adresse ni une clé", async () => {
    const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
    const r = await t.call("GET", "/api/admin/config");
    expect(r.body).toEqual({ actif: true, clientId: CLIENT_ID, factice: true });
    expect(JSON.stringify(r.body)).not.toContain(ADMIN_EMAIL);
    const reel = await makeApi({ seed: false, admin: { ...OPTIONS_ADMIN, fakeVerifier: false, verifier: undefined, fetchFn: (async () => new Response("{}")) as unknown as typeof fetch } });
    expect((await reel.call("GET", "/api/admin/config")).body).toEqual({ actif: true, clientId: CLIENT_ID, factice: false });
  });
});

// --- Connexion et session ---------------------------------------------------------------------------------------------------------
describe(`panneau : connexion, session, protections (${TEST_DB})`, () => {
  it("la connexion ouvre une session d'une heure : cookie `__session` HttpOnly, Secure, SameSite=Strict ; la réponse n'a ni adresse ni cookie lisible", async () => {
    const t = await adminApi();
    const { login, cookie } = await connecte(t);
    const sc = login.headers.get("set-cookie")!;
    for (const attr of ["__session=", "Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=3600"]) expect(sc).toContain(attr);
    expect(login.headers.get("cache-control")).toBe("no-store");
    expect(login.body).toEqual({ admin: expect.stringMatching(/^[0-9a-f]{12}$/), expire: new Date(NOON + SESSION_MS).toISOString() });
    expect(JSON.stringify(login.body)).not.toContain("admin@");
    expect(Buffer.from(cookie.split(".")[0]!, "base64url").toString()).not.toContain("@");
    const me = await t.call("GET", "/api/admin/session", undefined, { headers: { Cookie: `__session=${cookie}` } });
    expect(me.body).toEqual({ admin: login.body.admin, expire: login.body.expire, dureeMs: 3_600_000 });
  });

  it("une adresse hors de la liste est refusée, et la réponse est la même qu'un jeton invalide (on ne dit jamais lequel ne va pas)", async () => {
    const t = await adminApi();
    const headers = { Origin: ORIGIN, "X-Cdj-Admin": "1" };
    const hors = await t.call("POST", "/api/admin/session", { credential: "factice:intrus@example.test" }, { headers, clientKey: "203.0.113.50" });
    const faux = await t.call("POST", "/api/admin/session", { credential: "n'importe quoi" }, { headers, clientKey: "203.0.113.51" });
    const vide = await t.call("POST", "/api/admin/session", {}, { headers, clientKey: "203.0.113.52" });
    for (const r of [hors, faux, vide]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: "unauthorized" });
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });

  it("vraie vérification Google : l'adresse de la liste entre, une autre adresse authentique est refusée comme un jeton invalide", async () => {
    const cle = await cleDeTest("cle-a");
    const etat = { cles: [cle], appels: 0 };
    const t = await makeApi({ seed: false, admin: { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fetchFn: fauxFetch(etat) } });
    t.clock.now = NOON;
    const headers = { Origin: ORIGIN, "X-Cdj-Admin": "1" };
    const post = (credential: string, clientKey: string) => t.call("POST", "/api/admin/session", { credential }, { headers, clientKey });
    const bon = await post(await jeton(cle, { now: NOON }), "203.0.113.60");
    expect(bon.status, JSON.stringify(bon.body)).toBe(200);
    const autre = await post(await jeton(cle, { now: NOON, charge: { email: "intrus@example.test" } }), "203.0.113.61");
    const expire = await post(await jeton(cle, { now: NOON - 2 * 3_600_000 }), "203.0.113.62");
    const mauvaiseAudience = await post(await jeton(cle, { now: NOON, charge: { aud: "autre.apps.googleusercontent.com" } }), "203.0.113.63");
    const nonVerifiee = await post(await jeton(cle, { now: NOON, charge: { email_verified: false } }), "203.0.113.64");
    const factice = await post(ADMIN_FAKE, "203.0.113.65"); // le vérificateur factice n'est pas branché : un jeton « factice: » n'est pas un jeton Google
    for (const r of [autre, expire, mauvaiseAudience, nonVerifiee, factice]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: "unauthorized" });
    }
    expect(etat.appels).toBe(1); // les clés de Google sont gardées
  });

  it("les requêtes qui modifient quelque chose exigent `X-Cdj-Admin: 1` et une `Origin` égale au site (403 `forbidden`)", async () => {
    const t = await adminApi();
    const ok = { Origin: ORIGIN, "X-Cdj-Admin": "1" };
    for (const [nom, headers] of [
      ["sans en-tête", { Origin: ORIGIN }],
      ["sans origine", { "X-Cdj-Admin": "1" }],
      ["autre origine", { Origin: "https://evil.example", "X-Cdj-Admin": "1" }],
      ["mauvaise valeur", { Origin: ORIGIN, "X-Cdj-Admin": "yes" }],
    ] as const) {
      const r = await t.call("POST", "/api/admin/session", { credential: ADMIN_FAKE }, { headers });
      expect([nom, r.status]).toEqual([nom, 403]);
      expect(r.body).toEqual({ error: "forbidden" });
    }
    const { cookie, adm } = await connecte(t);
    await peupler(t);
    // La session seule (le cookie) ne suffit pas à écrire : un formulaire d'un autre site l'enverrait.
    const sansEntete = await t.call("POST", `/api/admin/joueurs/${await ref(1)}/masquer`, { masque: true, ...confirmer }, { headers: { Cookie: `__session=${cookie}`, Origin: ORIGIN } });
    expect(sansEntete.status).toBe(403);
    const autreOrigine = await t.call("POST", `/api/admin/joueurs/${await ref(1)}/masquer`, { masque: true, ...confirmer }, { headers: { Cookie: `__session=${cookie}`, Origin: "https://evil.example", "X-Cdj-Admin": "1" } });
    expect(autreOrigine.status).toBe(403);
    const deco = await t.call("DELETE", "/api/admin/session", undefined, { headers: { Cookie: `__session=${cookie}` } });
    expect(deco.status).toBe(403); // la déconnexion non plus, sans les en-têtes
    expect((await adm("GET", "/api/admin/tableau")).status).toBe(200); // la session est intacte
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_admin"))!.n).toBe(0);
    void ok;
  });

  it("avec ALLOWED_ORIGINS, l'`Origin` doit en faire partie", async () => {
    const t = await adminApi({ allowedOrigins: ["https://playdujour.com", "https://recette.playdujour.com"] });
    const post = (origin: string) => t.call("POST", "/api/admin/session", { credential: ADMIN_FAKE }, { headers: { Origin: origin, "X-Cdj-Admin": "1" }, clientKey: `203.0.113.${origin.length}` });
    expect((await post("https://playdujour.com")).status).toBe(200);
    expect((await post("https://recette.playdujour.com/")).status).toBe(200);
    expect((await post(ORIGIN)).status).toBe(403);
    expect((await post("https://playdujour.com.evil.example")).status).toBe(403);
  });

  it("toutes les réponses de /api/admin/* sont `no-store`, succès comme refus", async () => {
    const t = await adminApi();
    const { adm, cookie } = await connecte(t);
    const reponses = [
      await t.call("GET", "/api/admin/config"),
      await t.call("GET", "/api/admin/session"),
      await t.call("GET", "/api/admin/tableau"),
      await t.call("POST", "/api/admin/session", { credential: "x" }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } }),
      await t.call("POST", "/api/admin/session", {}),
      await adm("GET", "/api/admin/tableau"),
      await adm("GET", "/api/admin/joueurs"),
      await adm("GET", "/api/admin/journal"),
      await adm("GET", "/api/admin/joueurs/000000000000"),
      await adm("DELETE", "/api/admin/session"),
      await t.call("GET", "/api/admin/inconnu", undefined, { headers: { Cookie: `__session=${cookie}` } }),
    ];
    for (const r of reponses) expect(r.headers.get("cache-control"), `${r.status}`).toBe("no-store");
  });

  it("limite de débit sur la connexion : dix tentatives par adresse et par fenêtre, la onzième est refusée même avec le bon jeton", async () => {
    const t = await adminApi();
    const headers = { Origin: ORIGIN, "X-Cdj-Admin": "1" };
    for (let i = 0; i < 10; i++) expect((await t.call("POST", "/api/admin/session", { credential: "mauvais" }, { headers })).status).toBe(401);
    const r = await t.call("POST", "/api/admin/session", { credential: ADMIN_FAKE }, { headers });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toMatch(/^\d+$/);
    // Une autre adresse n'est pas touchée.
    expect((await t.call("POST", "/api/admin/session", { credential: ADMIN_FAKE }, { headers, clientKey: "198.51.100.9" })).status).toBe(200);
  });

  it("la session expire au bout d'une heure ; la déconnexion l'efface et la révoque côté serveur", async () => {
    const t = await adminApi();
    const { cookie, adm } = await connecte(t);
    expect((await adm("GET", "/api/admin/journal")).status).toBe(200);
    // Déconnexion : le cookie est effacé, et la session ne vaut plus rien même pour qui a gardé la valeur.
    const deco = await adm("DELETE", "/api/admin/session");
    expect(deco.status).toBe(200);
    expect(deco.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await adm("GET", "/api/admin/journal")).status).toBe(401);
    expect((await t.call("GET", "/api/admin/session", undefined, { headers: { Cookie: `__session=${cookie}` } })).status).toBe(401);
    // Expiration.
    const autre = await connecte(t);
    t.clock.now = NOON + SESSION_MS - 1;
    expect((await autre.adm("GET", "/api/admin/journal")).status).toBe(200);
    t.clock.now = NOON + SESSION_MS;
    expect((await autre.adm("GET", "/api/admin/journal")).status).toBe(401);
  });

  it("un cookie falsifié, d'une autre clé ou absent n'ouvre rien", async () => {
    const t = await adminApi();
    const { cookie } = await connecte(t);
    const autre = await adminApi({ admin: { ...OPTIONS_ADMIN, sessionKey: "une-autre-cle-de-session-de-test-tout-aussi-longue" } });
    const [charge, signature] = cookie.split(".") as [string, string];
    const forge = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(charge, "base64url").toString()), e: NOON + 10 * JOUR })).toString("base64url")}.${signature}`;
    for (const c of [forge, `${charge}.AAAA`, "n'importe quoi", ""]) {
      const r = await t.call("GET", "/api/admin/tableau", undefined, { headers: { Cookie: `__session=${c}` } });
      expect([c.slice(0, 12), r.status]).toEqual([c.slice(0, 12), 401]);
    }
    expect((await t.call("GET", "/api/admin/tableau")).status).toBe(401);
    expect((await autre.call("GET", "/api/admin/tableau", undefined, { headers: { Cookie: `__session=${cookie}` } })).status).toBe(401);
  });

  it("le journal du serveur ne contient jamais l'adresse, le jeton, la clé ni le cookie", async () => {
    const lignes: string[] = [];
    const log: Logger = (sev, msg, champs) => lignes.push(JSON.stringify({ sev, msg, ...champs }));
    const t = await adminApi({ log });
    const headers = { Origin: ORIGIN, "X-Cdj-Admin": "1" };
    await t.call("POST", "/api/admin/session", { credential: "factice:intrus@example.test" }, { headers, clientKey: "203.0.113.70" });
    await t.call("POST", "/api/admin/session", { credential: "jeton-bidon" }, { headers, clientKey: "203.0.113.71" });
    const { cookie, adm } = await connecte(t);
    await peupler(t);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/renommer`, { pseudo: "Robert", ...confirmer });
    const tout = lignes.join("\n");
    expect(tout).toContain("connexion refusée");
    expect(tout).toContain("connexion acceptée");
    for (const secret of ["admin@example", "intrus", "jeton-bidon", SESSION_KEY, cookie, "Robert", "Bob", playerId(2)]) expect(tout, secret).not.toContain(secret);
  });
});

// --- Tableau de bord --------------------------------------------------------------------------------------------------------------
describe(`panneau : tableau de bord (${TEST_DB})`, () => {
  it("exige une session", async () => {
    const t = await adminApi();
    for (const p of ["/api/admin/tableau", "/api/admin/joueurs", "/api/admin/joueurs/000000000000", "/api/admin/journal"]) expect((await t.call("GET", p)).status, p).toBe(401);
    expect((await t.call("POST", "/api/admin/joueurs/000000000000/masquer", { masque: true, ...confirmer })).status).toBe(401);
  });

  it("les chiffres du jour : joueurs distincts des deux jeux, hier, nouveaux profils, Track finis, Jump finis et leurs morts", async () => {
    const t = await adminApi();
    await peupler(t);
    await joueur(t, 5, "Eve", NOON - 2000); // un profil de plus créé aujourd'hui, sans résultat
    for (const [n, morts] of [[1, 3], [3, 5]] as const) {
      await t.db.run("INSERT INTO jump_lives (day, player_id, level_id, count, lives, rev, updated_at) VALUES (?, ?, ?, ?, '[]', 1, ?)", [TODAY, playerId(n), J.id, morts, NOON]);
    }
    const { adm } = await connecte(t);
    const r = await adm("GET", "/api/admin/tableau");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.date).toBe(DATE);
    expect(r.body.chiffres).toEqual({
      joueursAujourdhui: 3, // Alice et Bob (les deux jeux, comptés une fois), Chloé (Jump) ; Dan n'a pas joué aujourd'hui
      joueursHier: 2, // Alice et Dan
      nouveauxProfils: 2, // Chloé et Eve, créées aujourd'hui (heure de Paris)
      track: { finis: 2 },
      jump: { finis: 3, morts: 8 },
    });
    const courbe = r.body.courbe as { date: string; joueurs: number }[];
    expect(courbe).toHaveLength(14);
    expect(courbe[0]!.date).toBe(formatDay(TODAY - 13));
    expect(courbe[13]).toEqual({ date: DATE, joueurs: 3 });
    expect(courbe[12]).toEqual({ date: HIER, joueurs: 2 });
    expect(courbe[11]).toEqual({ date: formatDay(TODAY - 2), joueurs: 1 }); // Dan
    expect(courbe.slice(0, 11).every((c) => c.joueurs === 0)).toBe(true);
  });

  it("un jour fini, les morts de Jump viennent du total figé (les vies brutes sont oubliées)", async () => {
    const t = await adminApi();
    await peupler(t);
    await t.db.run("INSERT INTO jump_deaths (day, level_id, version, built, built_at, frozen, players, deaths) VALUES (?, ?, 1, 1, 0, 1, 3, 41)", [TODAY, J.id]);
    const { adm } = await connecte(t);
    expect((await adm("GET", "/api/admin/tableau")).body.chiffres.jump.morts).toBe(41);
  });

  it("l'état du site : API et base (temps de réponse), version en production, jours prêts par jeu, erreurs sur 24 h, place réservée de N2", async () => {
    const t = await adminApi({ revision: "cdj-api-r123" });
    await t.db.run("INSERT INTO planning (day, variant, theme, chosen_at) VALUES (?, 1, NULL, ?)", [TODAY + 2, NOON]);
    await t.db.run("INSERT INTO planning (day, variant, theme, chosen_at) VALUES (?, 1, NULL, ?)", [TODAY - 1, NOON]); // un jour passé n'est plus « à venir »
    const { adm } = await connecte(t);
    const r = await adm("GET", "/api/admin/tableau");
    const etat = r.body.etat;
    expect(etat.environnement).toBe("local");
    expect(etat.api).toEqual({ ok: true, ms: expect.any(Number) });
    expect(etat.base).toEqual({ ok: true, ms: expect.any(Number) });
    expect(etat.version).toEqual({ etiquette: "prod-2026-10-19-1830", commit: "0123456", revision: "cdj-api-r123" });
    expect(etat.joursPrets).toEqual([
      { jeu: "cdj", nom: "DailyTrack", figes: resumeRegistreTrack().jours, planifies: 1 },
      { jeu: "jump", nom: "DailyJump", figes: 0 },
    ]);
    expect(etat.erreurs24h).toEqual({ serveur: 0, rediffusions: 0 });
    expect(etat.prDepuisMiseEnProduction).toBeNull(); // la place des « PR depuis la dernière mise en production » (lot N2) : aucun chiffre
  });

  it("compte les erreurs serveur et les rediffusions refusées des dernières 24 h (journal_erreurs : code, route, heure ; ni joueur ni corps)", async () => {
    const t = await adminApi();
    await joueur(t, 1, "Alice");
    // Un vrai refus de rediffusion : une rediffusion illisible envoyée au classement du jour.
    const r = await t.call("POST", "/api/submit", { name: "Alice", date: DATE, replay: "pas une rediffusion" }, as(1));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_replay");
    // Une erreur ordinaire (404) ne se note pas.
    await t.call("GET", "/api/day/2026-01-01");
    // Des erreurs serveur déjà notées, dont une de plus de 24 h.
    for (const [at, code, route] of [[NOON - 3_600_000, "internal", "/api/x"], [NOON - 7_200_000, "db_unavailable", "/api/health"], [NOON - 25 * 3_600_000, "internal", "/api/vieux"]] as const) {
      await t.db.run("INSERT INTO journal_erreurs (at, code, route) VALUES (?, ?, ?)", [at, code, route]);
    }
    const lignes = await t.db.all<{ code: string; route: string }>("SELECT code, route FROM journal_erreurs ORDER BY id");
    expect(lignes.find((l) => l.code === "invalid_replay")).toEqual({ code: "invalid_replay", route: "/api/submit" });
    expect(JSON.stringify(lignes)).not.toContain(playerId(1));
    const { adm } = await connecte(t);
    expect((await adm("GET", "/api/admin/tableau")).body.etat.erreurs24h).toEqual({ serveur: 2, rediffusions: 1 });
  });

  it("est calculé au plus une fois par minute et par instance ; les dernières actions sont toujours fraîches", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const premier = await adm("GET", "/api/admin/tableau");
    expect(premier.body.chiffres.joueursAujourdhui).toBe(3);
    await joueur(t, 6, "Fred");
    await track(t, TODAY, 6, 59_000);
    t.clock.now += 59_000;
    // `t.clock.now` avance : la session (1 h) tient encore ; le calcul est celui d'il y a 59 s.
    const gardee = await adm("GET", "/api/admin/tableau");
    expect(gardee.body.calculeA).toBe(premier.body.calculeA);
    expect(gardee.body.chiffres.joueursAujourdhui).toBe(3);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: true, ...confirmer });
    expect((await adm("GET", "/api/admin/tableau")).body.journal).toHaveLength(1); // le journal, lui, n'est pas gardé
    t.clock.now += 2000;
    const neuve = await adm("GET", "/api/admin/tableau");
    expect(neuve.body.calculeA).not.toBe(premier.body.calculeA);
    expect(neuve.body.chiffres.joueursAujourdhui).toBe(4);
  });

  it("montre les trois dernières actions, la plus récente d'abord", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    for (const n of ["Robert", "Bobby", "Bobi", "Bobo"]) {
      t.clock.now += 1000;
      expect((await adm("POST", `/api/admin/joueurs/${await ref(2)}/renommer`, { pseudo: n, ...confirmer })).status).toBe(200);
    }
    const journal = (await adm("GET", "/api/admin/tableau")).body.journal as { apres: { pseudo: string } }[];
    expect(journal.map((j) => j.apres.pseudo)).toEqual(["Bobo", "Bobi", "Bobby"]);
  });
});

// --- Coût : aucune requête du panneau ne lit une table entière ---------------------------------------------------------------------
describe(`panneau : coût des requêtes (${TEST_DB})`, () => {
  /** Les tables qui grandissent avec les joueurs : jamais lues en entier par le panneau (les tables du panneau lui-même restent petites). */
  const GRANDES = ["players", "results", "jump_results", "jump_lives", "salon_runs", "revoked_codes"];

  it("le tableau de bord, la recherche (pseudo, référence, masqués, pages), la fiche et le journal passent tous par un index", async () => {
    const t = await adminApi();
    await peupler(t);
    for (let i = 10; i < 60; i++) await joueur(t, i, `Joueur${i}`);
    const vues: { sql: string; params: (string | number | null)[] | undefined }[] = [];
    const brut = { all: t.db.all.bind(t.db), first: t.db.first.bind(t.db), run: t.db.run.bind(t.db) };
    const { adm } = await connecte(t);
    t.db.all = ((sql: string, params?: (string | number | null)[]) => (vues.push({ sql, params }), brut.all(sql, params))) as typeof t.db.all;
    t.db.first = ((sql: string, params?: (string | number | null)[]) => (vues.push({ sql, params }), brut.first(sql, params))) as typeof t.db.first;
    const refAlice = await ref(1);
    await adm("GET", "/api/admin/tableau");
    await adm("GET", "/api/admin/joueurs");
    await adm("GET", "/api/admin/joueurs?page=2");
    await adm("GET", "/api/admin/joueurs?q=ali");
    await adm("GET", `/api/admin/joueurs?q=${refAlice.slice(0, 5)}`);
    await adm("GET", "/api/admin/joueurs?filtre=masques");
    await adm("GET", `/api/admin/joueurs/${refAlice}`);
    await adm("GET", "/api/admin/journal");
    t.db.all = brut.all as typeof t.db.all;
    t.db.first = brut.first as typeof t.db.first;
    const lectures = [...new Map(vues.filter((v) => /^\s*(SELECT|UPDATE|DELETE)/i.test(v.sql)).map((v) => [v.sql, v])).values()];
    expect(lectures.length).toBeGreaterThan(10);
    const fautes: string[] = [];
    for (const v of lectures) {
      // Un nombre de paramètres égal au nombre de « ? » : la requête est rejouée telle quelle pour demander son plan.
      const plan = await brut.all<{ detail: string }>(`EXPLAIN QUERY PLAN ${v.sql}`, v.params);
      for (const ligne of plan) {
        const m = /^(?:SCAN|SEARCH) (?:TABLE )?(\w+)(.*)$/.exec(ligne.detail);
        if (!m || !GRANDES.includes(m[1]!)) continue;
        const parIndex = /USING (COVERING )?INDEX|USING INTEGER PRIMARY KEY/.test(m[2]!);
        const balayage = ligne.detail.startsWith("SCAN") && !/\(.*[=<>]/.test(m[2]!); // un SCAN par index sans borne (tri + LIMIT) est lu jusqu'à la limite seulement
        if (!parIndex) fautes.push(`${ligne.detail} ← ${v.sql.replace(/\s+/g, " ").slice(0, 110)}`);
        else if (balayage && !/LIMIT/i.test(v.sql)) fautes.push(`${ligne.detail} (sans limite) ← ${v.sql.replace(/\s+/g, " ").slice(0, 110)}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("écarter les masqués ne coûte aucune lecture de plus : la place et le nombre de classés restent lus dans un index qui porte `hidden`, sans toucher la table", async () => {
    const t = await adminApi();
    await peupler(t);
    await topTrack(t); // le classement de Track (avec le niveau de Jump gardé par la lecture suivante)
    await topJump(t);
    const brut = t.db.all.bind(t.db);
    const comptes = [
      ["SELECT COUNT(*) AS n FROM results WHERE day = ? AND hidden = 0", [TODAY]],
      ["SELECT COUNT(*) AS n FROM results WHERE day = ? AND hidden = 0 AND (ms < ? OR (ms = ? AND submitted_at < ?))", [TODAY, 61_000, 61_000, NOON]],
      ["SELECT player_id, ms, submitted_at FROM results WHERE day = ? AND hidden = 0 ORDER BY ms ASC, submitted_at ASC", [TODAY]],
      ["SELECT COUNT(*) AS n FROM jump_results WHERE day = ? AND hidden = 0", [TODAY]],
      ["SELECT player_id, ticks, submitted_at FROM jump_results WHERE day = ? AND hidden = 0 ORDER BY ticks ASC, submitted_at ASC, player_id ASC", [TODAY]],
    ] as const;
    for (const [sql, params] of comptes) {
      const plan = (await brut<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, [...params])).map((l) => l.detail);
      expect(plan.some((d) => /USING COVERING INDEX \w+_by_visible/.test(d)), `${sql} → ${plan.join(" | ")}`).toBe(true);
      expect(plan.some((d) => /TEMP B-TREE FOR ORDER BY/.test(d)), sql).toBe(false);
    }
  });
});

// --- Joueurs : recherche et fiche -------------------------------------------------------------------------------------------------
describe(`panneau : joueurs (${TEST_DB})`, () => {
  it("cherche par début de pseudo (sans casse ni accents) ou de référence, jamais par l'identifiant secret", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const noms = async (q: string, filtre = "tous") => ((await adm("GET", `/api/admin/joueurs?q=${encodeURIComponent(q)}&filtre=${filtre}`)).body.joueurs as { pseudo: string }[]).map((j) => j.pseudo);
    expect(await noms("")).toEqual(["Alice", "Bob", "Chloé", "Dan"]);
    expect(await noms("al")).toEqual(["Alice"]);
    expect(await noms("CHLO")).toEqual(["Chloé"]);
    expect(await noms("chloé")).toEqual(["Chloé"]);
    expect(await noms("zz")).toEqual([]);
    const r1 = await ref(1);
    expect(await noms(r1.slice(0, 7))).toEqual(["Alice"]);
    expect(await noms(r1)).toEqual(["Alice"]);
    expect(await noms(playerId(1))).toEqual([]); // l'identifiant secret ne trouve rien : il ne sort jamais du serveur
    expect(await noms("b")).toEqual(["Bob"]); // « b » est aussi un début hexadécimal : le pseudo répond
  });

  it("ne rend jamais l'identifiant secret d'un joueur : seulement sa référence publique", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const liste = await adm("GET", "/api/admin/joueurs");
    const fiche = await adm("GET", `/api/admin/joueurs/${await ref(1)}`);
    const tableau = await adm("GET", "/api/admin/tableau");
    for (let n = 1; n <= 4; n++) for (const r of [liste, fiche, tableau]) expect(JSON.stringify(r.body)).not.toContain(playerId(n));
    expect(liste.body.joueurs[0]).toEqual({ ref: await ref(1), pseudo: "Alice", masque: false, creeLe: new Date(NOON - 5 * JOUR).toISOString() });
    expect(liste.body.joueurs[0].ref).toMatch(/^[0-9a-f]{12}$/);
  });

  it("répare au passage les références manquantes (joueurs d'avant le lot)", async () => {
    const t = await adminApi();
    await peupler(t);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE ref IS NULL"))!.n).toBe(4);
    const { adm } = await connecte(t);
    await adm("GET", "/api/admin/joueurs");
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE ref IS NULL"))!.n).toBe(0);
  });

  it("une première course crée le joueur avec sa référence ; « Changer mon code » la recalcule", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    await adm("GET", "/api/admin/joueurs"); // références posées
    const nouveau = playerId(99);
    const r = await t.call("POST", "/api/me/code", { newId: nouveau }, as(1));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const alice = (await adm("GET", "/api/admin/joueurs?q=alice")).body.joueurs[0];
    expect(alice.ref).toBe(await refOfPlayer(nouveau));
    expect((await adm("GET", `/api/admin/joueurs/${alice.ref}`)).body.pseudo).toBe("Alice");
    expect((await adm("GET", `/api/admin/joueurs/${await ref(1)}`)).status).toBe(404); // l'ancienne référence ne désigne plus personne
  });

  it("50 résultats par page, le tri est celui des pseudos, `suivante` dit s'il y en a d'autres", async () => {
    const t = await adminApi();
    for (let i = 1; i <= 120; i++) await joueur(t, i, `Joueur${String(i).padStart(3, "0")}`);
    const { adm } = await connecte(t);
    const p1 = (await adm("GET", "/api/admin/joueurs")).body;
    const p2 = (await adm("GET", "/api/admin/joueurs?page=2")).body;
    const p3 = (await adm("GET", "/api/admin/joueurs?page=3")).body;
    expect([p1.joueurs.length, p2.joueurs.length, p3.joueurs.length]).toEqual([50, 50, 20]);
    expect([p1.suivante, p2.suivante, p3.suivante]).toEqual([true, true, false]);
    expect(p1.joueurs[0].pseudo).toBe("Joueur001");
    expect(p2.joueurs[0].pseudo).toBe("Joueur051");
    expect(p3.joueurs[19].pseudo).toBe("Joueur120");
    expect((await adm("GET", "/api/admin/joueurs?q=Joueur1&page=1")).body.joueurs).toHaveLength(21); // Joueur100 à Joueur120
  });

  it("le filtre « Masqués » ne montre que les joueurs masqués (il n'y a pas de filtre « Signalés »)", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    expect((await adm("GET", "/api/admin/joueurs?filtre=masques")).body.joueurs).toEqual([]);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: true, ...confirmer });
    const masques = (await adm("GET", "/api/admin/joueurs?filtre=masques")).body.joueurs;
    expect(masques.map((j: { pseudo: string; masque: boolean }) => [j.pseudo, j.masque])).toEqual([["Bob", true]]);
    expect((await adm("GET", "/api/admin/joueurs?filtre=signales")).body.joueurs).toHaveLength(4); // un filtre inconnu vaut « Tous »
  });

  it("la fiche : création, dernière partie, jours joués, résultats par jour et par jeu (temps, médaille, rang), lien de rediffusion quand le jeu en a un", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    await topJump(t); // une lecture du jour a gardé son niveau (et ses seuils de médailles), comme en production
    const f = (await adm("GET", `/api/admin/joueurs/${await ref(1)}`)).body;
    expect(f).toMatchObject({ pseudo: "Alice", masque: false, joursJoues: 2, creeLe: new Date(NOON - 5 * JOUR).toISOString(), retires: [], gardeJours: 30 });
    expect(f.dernierePartie).toBe(new Date(NOON - 3_600_000 + 1).toISOString());
    const [trackJeu, jumpJeu] = f.resultats;
    const medT = medalFor(60_000, medalsFor(circuitOf(TODAY).authorMs, TODAY));
    expect(trackJeu).toMatchObject({ jeu: "cdj", nom: "DailyTrack", jours: 2 });
    expect(trackJeu.resultats[0]).toEqual({ date: DATE, tempsMs: 60_000, morts: null, medaille: medT, rang: 1, classes: 2, envoyeA: new Date(NOON - 3_600_000 + 1).toISOString(), rediffusion: null });
    expect(trackJeu.resultats[1]).toMatchObject({ date: HIER, tempsMs: 70_000, rang: 1, classes: 2 });
    const msJump = Math.round(((J.authorTicks + 10) * 1000) / TICK_RATE);
    expect(jumpJeu).toMatchObject({ jeu: "jump", nom: "DailyJump", jours: 1 });
    expect(jumpJeu.resultats[0]).toMatchObject({ date: DATE, tempsMs: msJump, morts: 2, medaille: jumpMedalFor(J.authorTicks + 10, J.medals), rang: 1, classes: 3, rediffusion: `/jump/?watch=first&seed=${DATE}` });
    const bob = (await adm("GET", `/api/admin/joueurs/${await ref(2)}`)).body;
    expect(bob.resultats[1].resultats[0]).toMatchObject({ rang: 2, rediffusion: null }); // seul le premier du jour a un lecteur (`?watch=first`)
    expect((await adm("GET", `/api/admin/joueurs/${await ref(3)}`)).body.resultats[0].resultats).toEqual([]); // Chloé n'a pas joué à Track
    expect((await adm("GET", "/api/admin/joueurs/pas-une-ref")).status).toBe(404);
    expect((await adm("GET", "/api/admin/joueurs/000000000000")).status).toBe(404);
  });
});

// --- Les cinq actions ------------------------------------------------------------------------------------------------------------
async function classementTrack(t: TestApi, vue = "track"): Promise<string[]> {
  return ((await t.call("GET", `/api/portail/classement?vue=${vue}`)).body.top as { pseudo: string }[]).map((l) => l.pseudo);
}
const topTrack = async (t: TestApi, me?: number) => (await t.call("GET", `/api/day/${DATE}/leaderboard`, undefined, me ? as(me) : undefined)).body;
const topJump = async (t: TestApi, me?: number) => (await t.call("GET", `/api/jump/day/${DATE}/board`, undefined, me ? as(me) : undefined)).body;

describe(`panneau : 1. renommer (${TEST_DB})`, () => {
  it("applique les règles de pseudo de la création, confirme, inscrit au journal, et les classements montrent le nouveau pseudo dès la fenêtre suivante", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const bob = `/api/admin/joueurs/${await ref(2)}/renommer`;
    expect(await classementTrack(t)).toEqual(["Alice", "Bob"]); // le classement est gardé en mémoire
    expect((await adm("POST", bob, { pseudo: "Robert" })).body).toEqual({ error: "invalid_action" }); // sans confirmation
    expect((await adm("POST", bob, { pseudo: "Robert", confirmer: false })).status).toBe(400);
    expect((await adm("POST", bob, { pseudo: "Merde", ...confirmer })).body).toEqual({ error: "name_forbidden" });
    expect((await adm("POST", bob, { pseudo: "", ...confirmer })).body).toEqual({ error: "invalid_name" });
    expect((await adm("POST", bob, { pseudo: "x".repeat(21), ...confirmer })).body).toEqual({ error: "invalid_name" });
    const pris = await adm("POST", bob, { pseudo: "ALICE", ...confirmer });
    expect(pris.status).toBe(409);
    expect(pris.body.error).toBe("name_taken");
    expect(pris.body.suggestions.length).toBeGreaterThan(0);
    expect((await adm("POST", bob, { pseudo: "Bob", ...confirmer })).status).toBe(400); // déjà celui-là
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_admin"))!.n).toBe(0); // les refus n'écrivent rien

    const ok = await adm("POST", bob, { pseudo: "Robert", ...confirmer });
    expect(ok.body).toEqual({ pseudo: "Robert" });
    const ligne = await t.db.first<{ name: string; name_key: string; rename_required: number }>("SELECT name, name_key, rename_required FROM players WHERE id = ?", [playerId(2)]);
    expect(ligne).toEqual({ name: "Robert", name_key: "robert", rename_required: 0 });
    expect(await classementTrack(t)).toEqual(["Alice", "Robert"]);
    expect((await classementTrack(t, "cumul")).includes("Robert")).toBe(true);
    expect((await topTrack(t)).top.map((l: { name: string }) => l.name)).toEqual(["Alice", "Robert"]);
    // Le joueur le voit à sa prochaine visite : le pseudo du serveur fait foi.
    expect((await t.call("GET", "/api/portail/profil", undefined, as(2))).body.pseudo).toBe("Robert");
    expect((await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur.pseudo).toBe("Robert");
    // L'ancien pseudo est libre ; l'ancien propriétaire ne le reprend pas par hasard.
    expect((await t.call("GET", "/api/name?name=Bob")).body).toEqual({ available: true });
    // Journal.
    const journal = (await adm("GET", "/api/admin/journal")).body.lignes;
    expect(journal).toEqual([{ id: expect.any(Number), at: new Date(NOON).toISOString(), admin: expect.stringMatching(/^[0-9a-f]{12}$/), action: "renommer", cible: `Bob · ${await ref(2)}`, avant: { pseudo: "Bob" }, apres: { pseudo: "Robert" } }]);
  });

  it("le Salon en cours montre aussi le nouveau pseudo", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    await t.db.run("INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (1, ?, 'refbob', 'Bob', 50000, '[]', 'x', ?)", [playerId(2), NOON]);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/renommer`, { pseudo: "Robert", ...confirmer });
    expect((await t.db.first<{ name: string }>("SELECT name FROM salon_runs WHERE player_id = ?", [playerId(2)]))!.name).toBe("Robert");
  });
});

describe(`panneau : 2. masquer et démasquer (${TEST_DB})`, () => {
  it("le joueur disparaît de tous les classements (portail, DailyTrack, DailyJump), les autres montent ; lui ne voit aucune différence ; le profil est gardé ; démasquer le rétablit", async () => {
    const t = await adminApi();
    await peupler(t);
    // Les places finales déjà gardées du jour sont oubliées (recalculées sans lui).
    await t.db.run("UPDATE results SET final_rank = 1, final_total = 2 WHERE day = ?", [TODAY]);
    await t.db.run("UPDATE jump_results SET final_rank = 1, final_total = 3 WHERE day = ?", [TODAY]);
    const { adm } = await connecte(t);
    // Avant : tout le monde, et les classements sont gardés en mémoire.
    expect(await classementTrack(t)).toEqual(["Alice", "Bob"]);
    expect(await classementTrack(t, "jump")).toEqual(["Alice", "Bob", "Chloé"]);
    expect((await topJump(t)).top.map((l: { name: string }) => l.name)).toEqual(["Alice", "Bob", "Chloé"]);
    expect((await topJump(t, 3)).me.rank).toBe(3);

    const r = await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: true, ...confirmer });
    expect(r.body).toEqual({ masque: true });

    // Les classements : Bob n'y est plus.
    expect(await classementTrack(t)).toEqual(["Alice"]);
    expect(await classementTrack(t, "jump")).toEqual(["Alice", "Chloé"]);
    expect(await classementTrack(t, "cumul")).toEqual(["Alice", "Chloé"]);
    const lb = await topTrack(t);
    expect(lb.top.map((l: { name: string }) => l.name)).toEqual(["Alice"]);
    expect(lb.participants).toBe(1);
    const jb = await topJump(t, 3);
    expect(jb.top.map((l: { name: string }) => l.name)).toEqual(["Alice", "Chloé"]);
    expect(jb.participants).toBe(2);
    expect(jb.me.rank).toBe(2); // Chloé monte
    // Les places finales gardées sont oubliées.
    expect(await t.db.all("SELECT 1 FROM results WHERE day = ? AND final_rank IS NOT NULL", [TODAY])).toEqual([]);
    expect(await t.db.all("SELECT 1 FROM jump_results WHERE day = ? AND final_rank IS NOT NULL", [TODAY])).toEqual([]);

    // Lui ne voit aucune différence : son profil, ses résultats, sa ligne et sa place.
    const sien = await topJump(t, 2);
    expect(sien.me).toMatchObject({ name: "Bob", rank: 2, ticks: J.authorTicks + 20 });
    expect((await topTrack(t, 2)).me).toMatchObject({ name: "Bob", rank: 2, ms: 61_000 });
    const jour = (await t.call("GET", "/api/portail/jour", undefined, as(2))).body;
    expect(jour.joueur.pseudo).toBe("Bob");
    expect(jour.jeux.map((j: { etat: { statut: string } }) => j.etat.statut)).toEqual(["fini", "fini"]);
    expect(jour.joueur.cumulMs).not.toBeNull();
    const moi = (await t.call("GET", "/api/portail/classement?vue=track", undefined, as(2))).body.moi;
    expect(moi).toMatchObject({ pseudo: "Bob", rang: 2 });
    expect((await t.call("GET", "/api/portail/profil", undefined, as(2))).body.jeux.map((j: { joursFinis: number }) => j.joursFinis)).toEqual([1, 1]);
    expect(await t.db.first("SELECT 1 FROM players WHERE id = ?", [playerId(2)])).not.toBeNull(); // il garde son profil

    // La fiche et la liste disent « masqué » ; le journal garde la trace.
    expect((await adm("GET", `/api/admin/joueurs/${await ref(2)}`)).body.masque).toBe(true);
    // Démasquer : tout revient.
    expect((await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: false, ...confirmer })).body).toEqual({ masque: false });
    expect(await classementTrack(t)).toEqual(["Alice", "Bob"]);
    expect((await topJump(t)).top.map((l: { name: string }) => l.name)).toEqual(["Alice", "Bob", "Chloé"]);
    expect((await adm("GET", "/api/admin/journal")).body.lignes.map((l: { action: string }) => l.action)).toEqual(["démasquer", "masquer"]);
  });

  it("refuse une action sans confirmation, sans valeur ou qui ne change rien", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const url = `/api/admin/joueurs/${await ref(2)}/masquer`;
    expect((await adm("POST", url, { masque: true })).body).toEqual({ error: "invalid_action" });
    expect((await adm("POST", url, { masque: "oui", ...confirmer })).status).toBe(400);
    expect((await adm("POST", url, { masque: false, ...confirmer })).status).toBe(400); // déjà visible
    await adm("POST", url, { masque: true, ...confirmer });
    expect((await adm("POST", url, { masque: true, ...confirmer })).status).toBe(400); // déjà masqué
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_admin"))!.n).toBe(1);
  });

  it("un joueur masqué le reste : ses nouveaux résultats (Track, Jump, Salon) ne rejoignent pas les classements", async () => {
    const t = await makeApi({ admin: OPTIONS_ADMIN, allowCopies: false }); // jour et circuit de test par défaut ; refus des copies comme en production
    const { DAY, pilotReplay, playerId: pid } = await import("./helpers");
    const date = formatDay(DAY);
    const headersJoueur = (n: number) => ({ headers: { "X-Player-Id": pid(n) } });
    const lent = pilotReplay(DAY, 0.7);
    const rapide = pilotReplay(DAY, 0.9);
    expect((await t.call("POST", "/api/submit", { name: "Alice", date, replay: rapide.code }, headersJoueur(1))).status).toBe(200);
    expect((await t.call("POST", "/api/submit", { name: "Bob", date, replay: lent.code }, headersJoueur(2))).status).toBe(200);
    const { adm } = await connecte(t);
    const refBob = await refOfPlayer(pid(2));
    expect((await adm("POST", `/api/admin/joueurs/${refBob}/masquer`, { masque: true, ...confirmer })).status).toBe(200);
    // Bob fait mieux que son premier temps (le pilote moyen) : son nouveau résultat reste masqué.
    const moyen = pilotReplay(DAY, 0.8);
    const r = await t.call("POST", "/api/submit", { name: "Bob", date, replay: moyen.code }, headersJoueur(2));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.improved).toBe(true);
    expect((await t.db.first<{ hidden: number; ms: number }>("SELECT hidden, ms FROM results WHERE player_id = ?", [pid(2)]))).toEqual({ hidden: 1, ms: moyen.finishMs });
    const lb = (await t.call("GET", `/api/day/${date}/leaderboard`)).body;
    expect(lb.top.map((l: { name: string }) => l.name)).toEqual(["Alice"]);
    expect(lb.participants).toBe(1);
  });

  it("le Salon : un joueur masqué n'est plus dans le classement de la session, il garde sa propre ligne, et sa version avance", async () => {
    const t = await makeApi({ admin: OPTIONS_ADMIN });
    const { SALON_SESSION, NOON: NOON_DEFAULT, seedSalonCircuit } = await import("./helpers");
    await seedSalonCircuit(t.db, SALON_SESSION);
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bob");
    await joueur(t, 3, "Chloé");
    for (const [n, ms, nom] of [[1, 50_000, "Alice"], [2, 51_000, "Bob"], [3, 52_000, "Chloé"]] as const) {
      await t.db.run("INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (?, ?, ?, ?, ?, '[]', 'x', ?)", [SALON_SESSION, playerId(n), `ref${n}`.padEnd(8, "0"), nom, ms, NOON_DEFAULT]);
    }
    const lire = async (me?: number) => (await t.call("GET", `/api/salon/${SALON_SESSION}/board`, undefined, me ? as(me) : undefined)).body;
    const avant = await lire();
    expect(avant.rows.map((r: { name: string }) => r.name)).toEqual(["Alice", "Bob", "Chloé"]);
    t.clock.now = NOON_DEFAULT;
    const { adm } = await connecte(t);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: true, ...confirmer });
    const apres = await lire();
    expect(apres.rows.map((r: { name: string }) => r.name)).toEqual(["Alice", "Chloé"]);
    expect(apres.participants).toBe(2);
    expect(apres.version).toBeGreaterThan(avant.version);
    expect((await lire(2)).me).toMatchObject({ name: "Bob", rank: 2 }); // sa propre ligne reste
    expect((await lire(3)).me.rank).toBe(2);
  });
});

describe(`panneau : 3. retirer un résultat (${TEST_DB})`, () => {
  it("retrait doux avec un motif : le résultat sort du classement, la rediffusion est gardée 30 jours puis effacée (le motif reste)", async () => {
    const t = await adminApi();
    await peupler(t);
    await t.db.run("UPDATE results SET final_rank = 1, final_total = 2 WHERE day = ?", [TODAY]);
    const { adm } = await connecte(t);
    expect(await classementTrack(t)).toEqual(["Alice", "Bob"]);
    const url = `/api/admin/joueurs/${await ref(1)}/retirer`;
    const demande = { jeu: "cdj", date: DATE, motif: "temps impossible", ...confirmer };
    // Refus.
    expect((await adm("POST", url, { ...demande, confirmer: undefined })).body).toEqual({ error: "invalid_action" });
    expect((await adm("POST", url, { ...demande, motif: "" })).body).toEqual({ error: "invalid_action" });
    expect((await adm("POST", url, { ...demande, motif: "ab" })).status).toBe(400);
    expect((await adm("POST", url, { ...demande, motif: "x".repeat(201) })).status).toBe(400);
    expect((await adm("POST", url, { ...demande, jeu: "inconnu" })).status).toBe(400);
    expect((await adm("POST", url, { ...demande, date: "pas une date" })).status).toBe(400);
    expect((await adm("POST", url, { ...demande, date: formatDay(TODAY - 5) })).body).toEqual({ error: "unknown_result" });
    expect((await adm("POST", `/api/admin/joueurs/${await ref(3)}/retirer`, demande)).body).toEqual({ error: "unknown_result" }); // Chloé n'a pas joué à Track
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_admin"))!.n).toBe(0);

    const r = await adm("POST", url, demande);
    expect(r.body).toEqual({ retire: true, rediffusionGardeeJours: 30 });
    // Effet sur les classements : Alice n'y est plus, Bob est premier ; les places finales sont oubliées.
    expect(await classementTrack(t)).toEqual(["Bob"]);
    expect((await topTrack(t)).top.map((l: { name: string }) => l.name)).toEqual(["Bob"]);
    expect((await topTrack(t, 2)).me.rank).toBe(1);
    expect(await t.db.all("SELECT 1 FROM results WHERE day = ? AND final_rank IS NOT NULL", [TODAY])).toEqual([]);
    // Les autres jeux et les autres jours d'Alice ne bougent pas.
    expect(await classementTrack(t, "jump")).toEqual(["Alice", "Bob", "Chloé"]);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE player_id = ?", [playerId(1)]))!.n).toBe(1); // hier
    // La rediffusion est gardée pour vérification.
    const archive = await t.db.first<Record<string, unknown>>("SELECT game, day, temps_ms, replay, inputs_hash, removed_at, motif FROM resultats_retires WHERE player_id = ?", [playerId(1)]);
    expect(archive).toEqual({ game: "cdj", day: TODAY, temps_ms: 60_000, replay: `REDIFFUSION-TRACK-1-${TODAY}`, inputs_hash: `h-1-${TODAY}`, removed_at: NOON, motif: "temps impossible" });
    // La fiche le montre.
    const fiche = (await adm("GET", `/api/admin/joueurs/${await ref(1)}`)).body;
    expect(fiche.retires).toEqual([{ jeu: "cdj", date: DATE, tempsMs: 60_000, motif: "temps impossible", retireLe: new Date(NOON).toISOString(), rediffusionGardee: true }]);
    expect(fiche.resultats[0].resultats.map((x: { date: string }) => x.date)).toEqual([HIER]);
    // Le journal : le temps et le motif, pas la rediffusion.
    const journal = (await adm("GET", "/api/admin/journal")).body.lignes;
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ action: "retirer un résultat", cible: `Alice · ${await ref(1)}`, avant: { jeu: "DailyTrack", jour: DATE, tempsMs: 60_000 }, apres: { retire: true, motif: "temps impossible" } });
    expect(JSON.stringify(journal)).not.toContain("REDIFFUSION");

    // 29 jours plus tard : la rediffusion est encore là ; au 31e, un envoi (ici une connexion d'administrateur, puis une action) l'efface, le motif reste.
    t.clock.now = NOON + 29 * JOUR;
    await connecte(t);
    await adm("GET", "/api/admin/journal");
    expect((await t.db.first<{ replay: string }>("SELECT replay FROM resultats_retires"))!.replay).not.toBe("");
    t.clock.now = NOON + 31 * JOUR;
    const neuve = await connecte(t);
    await neuve.adm("GET", "/api/admin/journal");
    expect(await t.db.first("SELECT replay, motif FROM resultats_retires")).toEqual({ replay: "", motif: "temps impossible" });
    expect((await neuve.adm("GET", `/api/admin/joueurs/${await ref(1)}`)).body.retires[0]).toMatchObject({ rediffusionGardee: false, motif: "temps impossible" });
  });

  it("DailyJump : le même retrait ; le temps du journal est en millisecondes", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    expect(await classementTrack(t, "jump")).toEqual(["Alice", "Bob", "Chloé"]);
    const r = await adm("POST", `/api/admin/joueurs/${await ref(1)}/retirer`, { jeu: "jump", date: DATE, motif: "essai suspect", ...confirmer });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await classementTrack(t, "jump")).toEqual(["Bob", "Chloé"]);
    expect((await topJump(t)).top.map((l: { name: string }) => l.name)).toEqual(["Bob", "Chloé"]);
    expect((await adm("GET", "/api/admin/journal")).body.lignes[0].avant.tempsMs).toBe(Math.round(((J.authorTicks + 10) * 1000) / TICK_RATE));
    expect(await classementTrack(t)).toEqual(["Alice", "Bob"]); // Track ne bouge pas
  });

  it("la même rediffusion ne revient pas telle quelle (409 `replay_copy`) ; un meilleur temps, oui", async () => {
    const t = await makeApi({ admin: OPTIONS_ADMIN, allowCopies: false });
    const { DAY, pilotReplay, playerId: pid } = await import("./helpers");
    const date = formatDay(DAY);
    const as1 = { headers: { "X-Player-Id": pid(1) } };
    const lent = pilotReplay(DAY, 0.7);
    const rapide = pilotReplay(DAY, 0.9);
    expect((await t.call("POST", "/api/submit", { name: "Alice", date, replay: lent.code }, as1)).status).toBe(200);
    const { adm } = await connecte(t);
    expect((await adm("POST", `/api/admin/joueurs/${await refOfPlayer(pid(1))}/retirer`, { jeu: "cdj", date, motif: "essai", ...confirmer })).status).toBe(200);
    const encore = await t.call("POST", "/api/submit", { name: "Alice", date, replay: lent.code }, as1);
    expect([encore.status, encore.body.error]).toEqual([409, "replay_copy"]);
    expect((await t.call("POST", "/api/submit", { name: "Alice", date, replay: rapide.code }, as1)).status).toBe(200);
    const lb = (await t.call("GET", `/api/day/${date}/leaderboard`)).body;
    expect(lb.top.map((l: { ms: number }) => l.ms)).toEqual([rapide.finishMs]);
  });
});

describe(`panneau : 4. supprimer le profil (${TEST_DB})`, () => {
  it("efface le profil et ses résultats (demande d'un joueur), exige de retaper le pseudo, libère le pseudo ; le journal ne garde que le pseudo", async () => {
    const t = await adminApi();
    await peupler(t);
    await t.db.run("INSERT INTO garage_choices (player_id, car, minute) VALUES (?, 'x', 1)", [playerId(1)]);
    const { adm } = await connecte(t);
    // Un résultat déjà retiré part aussi.
    await adm("POST", `/api/admin/joueurs/${await ref(1)}/retirer`, { jeu: "cdj", date: HIER, motif: "essai", ...confirmer });
    expect(await classementTrack(t, "jump")).toEqual(["Alice", "Bob", "Chloé"]);
    const url = `/api/admin/joueurs/${await ref(1)}/supprimer`;
    expect((await adm("POST", url, { pseudo: "Alice" })).body).toEqual({ error: "invalid_action" }); // sans confirmation
    expect((await adm("POST", url, { ...confirmer })).body).toEqual({ error: "invalid_action" }); // sans pseudo
    expect((await adm("POST", url, { pseudo: "Alicia", ...confirmer })).body).toEqual({ error: "invalid_action" }); // pas le bon
    expect(await t.db.first("SELECT 1 FROM players WHERE id = ?", [playerId(1)])).not.toBeNull();

    const r = await adm("POST", url, { pseudo: "  alice ", ...confirmer }); // la forme normalisée, comme l'unicité des pseudos
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ supprime: true, tempsDailyTrack: 1, essaisDailyJump: 1 }); // celui d'hier avait été retiré
    for (const table of ["players", "results", "jump_results", "garage_choices", "resultats_retires"]) {
      const colonne = table === "players" ? "id" : "player_id";
      expect(await t.db.first(`SELECT 1 FROM ${table} WHERE ${colonne} = ?`, [playerId(1)]), table).toBeNull();
    }
    expect(await t.db.first("SELECT 1 FROM players WHERE id = ?", [playerId(2)])).not.toBeNull(); // les autres ne bougent pas
    expect(await classementTrack(t, "jump")).toEqual(["Bob", "Chloé"]);
    expect(await classementTrack(t)).toEqual(["Bob"]);
    expect((await t.call("GET", "/api/name?name=Alice")).body).toEqual({ available: true }); // le pseudo est libre
    expect((await adm("GET", url.replace("/supprimer", ""))).status).toBe(404);
    expect((await t.call("GET", "/api/portail/profil", undefined, as(1))).status).toBe(404);
    // Journal : la trace (pseudo, nombres de lignes), jamais le contenu effacé.
    const lignes = (await adm("GET", "/api/admin/journal")).body.lignes as { action: string; cible: string; avant: unknown; apres: Record<string, unknown> }[];
    const ligne = lignes.find((l) => l.action === "supprimer le profil")!;
    expect(ligne.cible).toBe(`Alice · ${await ref(1)}`);
    expect(ligne.avant).toBeNull();
    expect(ligne.apres).toMatchObject({ supprime: true, tempsDailyTrack: 1, essaisDailyJump: 1 });
    const brut = JSON.stringify(ligne);
    for (const interdit of ["REDIFFUSION", playerId(1), "60000", "tempsMs", "motif"]) expect(brut, interdit).not.toContain(interdit); // ni rediffusion, ni temps, ni identifiant : le pseudo et des nombres
    expect(JSON.stringify(lignes)).not.toContain(playerId(1));
  });
});

describe(`panneau : 5. voir une rediffusion (${TEST_DB})`, () => {
  it("donne le lien du lecteur existant quand il y en a un (Jump : le premier du jour), rien sinon (Track)", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    const alice = (await adm("GET", `/api/admin/joueurs/${await ref(1)}`)).body;
    expect(alice.resultats[1].resultats[0].rediffusion).toBe(`/jump/?watch=first&seed=${DATE}`);
    expect(alice.resultats[0].resultats.every((x: { rediffusion: unknown }) => x.rediffusion === null)).toBe(true);
    // Un joueur masqué ou retiré du classement n'est plus « le premier » : pas de lien.
    await adm("POST", `/api/admin/joueurs/${await ref(1)}/masquer`, { masque: true, ...confirmer });
    expect((await adm("GET", `/api/admin/joueurs/${await ref(1)}`)).body.resultats[1].resultats[0]).toMatchObject({ rang: 1 }); // sa place à lui ne change pas…
    expect((await adm("GET", `/api/admin/joueurs/${await ref(2)}`)).body.resultats[1].resultats[0].rediffusion).toBe(`/jump/?watch=first&seed=${DATE}`); // …et Bob devient le premier du classement visible
  });
});

// --- Journal ---------------------------------------------------------------------------------------------------------------------
describe(`panneau : journal (${TEST_DB})`, () => {
  it("liste les 200 dernières actions, la plus récente d'abord ; chaque ligne : heure, administrateur (empreinte), action, cible, avant / après", async () => {
    const t = await adminApi();
    await joueur(t, 1, "Alice");
    const { adm, login } = await connecte(t);
    const r = await adm("GET", "/api/admin/joueurs");
    const refAlice = r.body.joueurs[0].ref;
    for (let i = 0; i < 205; i++) {
      t.clock.now = NOON + i * 1000;
      // Le débit des actions est par session et par fenêtre : on se reconnecte de temps en temps.
      if (i % 100 === 99) t.clock.now += 11 * 60_000;
      await t.db.run("INSERT INTO journal_admin (at, admin, action, cible, avant, apres) VALUES (?, ?, 'masquer', ?, '{\"masque\":false}', '{\"masque\":true}')", [t.clock.now, login.body.admin, `Alice · ${refAlice}`]);
    }
    const j = (await adm("GET", "/api/admin/journal")).body;
    expect(j.max).toBe(200);
    expect(j.lignes).toHaveLength(200);
    expect(j.lignes[0].id).toBeGreaterThan(j.lignes[199].id);
    expect(j.lignes[0]).toMatchObject({ admin: login.body.admin, action: "masquer", cible: `Alice · ${refAlice}`, avant: { masque: false }, apres: { masque: true } });
    expect(JSON.stringify(j)).not.toContain("@");
  });

  it("ne contient jamais l'adresse de l'administrateur : seulement son empreinte", async () => {
    const t = await adminApi();
    await peupler(t);
    const { adm } = await connecte(t);
    await adm("POST", `/api/admin/joueurs/${await ref(2)}/masquer`, { masque: true, ...confirmer });
    const brut = JSON.stringify(await t.db.all("SELECT * FROM journal_admin UNION ALL SELECT sid, admin, created_at, expires_at, revoked_at, NULL, NULL FROM admin_sessions"));
    expect(brut).not.toContain("example.test");
    expect(brut).not.toContain("admin@");
  });

  it("garde les lignes un an, les erreurs 14 jours : l'entretien efface le reste (au plus une fois par heure et par instance)", async () => {
    const t = await adminApi();
    await t.db.run("INSERT INTO journal_admin (at, admin, action, cible) VALUES (?, 'x', 'vieille', 'c')", [NOON - 366 * JOUR]);
    await t.db.run("INSERT INTO journal_admin (at, admin, action, cible) VALUES (?, 'x', 'recente', 'c')", [NOON - 300 * JOUR]);
    await t.db.run("INSERT INTO journal_erreurs (at, code, route) VALUES (?, 'internal', '/a')", [NOON - 15 * JOUR]);
    await t.db.run("INSERT INTO journal_erreurs (at, code, route) VALUES (?, 'internal', '/b')", [NOON - 13 * JOUR]);
    const { adm } = await connecte(t);
    await adm("GET", "/api/admin/journal");
    expect((await t.db.all<{ action: string }>("SELECT action FROM journal_admin")).map((l) => l.action)).toEqual(["recente"]);
    expect((await t.db.all<{ route: string }>("SELECT route FROM journal_erreurs")).map((l) => l.route)).toEqual(["/b"]);
  });
});

// --- Les outils de DailyTrack acceptent la session ou le jeton ---------------------------------------------------------------------
describe(`panneau : les outils de DailyTrack (${TEST_DB})`, () => {
  const JETON = "j".repeat(32);

  it("acceptent la session (sans jeton configuré) ; les écritures exigent alors les en-têtes", async () => {
    const t = await adminApi();
    await peupler(t);
    expect((await t.call("GET", "/api/admin/overview")).status).toBe(404); // ni jeton ni session : comme avant
    const { adm, cookie } = await connecte(t);
    const lu = await adm("GET", "/api/admin/overview");
    expect(lu.status, JSON.stringify(lu.body)).toBe(200);
    expect(lu.body.days[0].participants).toBe(2);
    const futur = formatDay(TODAY + 3);
    expect((await adm("DELETE", `/api/admin/planning/${futur}`)).status).toBe(200);
    // Le cookie seul n'écrit pas.
    expect((await t.call("DELETE", `/api/admin/planning/${futur}`, undefined, { headers: { Cookie: `__session=${cookie}` } })).status).toBe(404);
    // Déconnecté : plus rien.
    await adm("DELETE", "/api/admin/session");
    expect((await adm("GET", "/api/admin/overview")).status).toBe(404);
  });

  it("acceptent toujours le jeton, y compris pour un navigateur qui porte aussi le cookie", async () => {
    const t = await adminApi({ adminToken: JETON });
    const { cookie } = await connecte(t);
    const bearer = { Authorization: `Bearer ${JETON}` };
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: bearer })).status).toBe(200);
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { ...bearer, Cookie: `__session=${cookie}` } })).status).toBe(200);
    // Écriture avec le jeton et le cookie, sans l'en-tête du panneau : c'est le jeton qui l'autorise.
    expect((await t.call("DELETE", `/api/admin/planning/${formatDay(TODAY + 3)}`, undefined, { headers: { ...bearer, Cookie: `__session=${cookie}` } })).status).toBe(200);
    // Ni jeton ni session valide : refus.
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: "Bearer faux", Cookie: "__session=n.importe" } })).status).toBe(401);
  });
});
