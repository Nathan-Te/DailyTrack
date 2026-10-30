import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { GAMES } from "../src/registry";
import type { GameDefinition, PortailDuJeu } from "../src/games";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { DAY, DAY_MS, NOON, makeApi, ouvrirJeu, parisDayStart, pilotReplay, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot P (plateforme) — l'interrupteur des jeux côté serveur : les trois états, un jeu inconnu vaut `off`, la clé d'aperçu (bonne, révoquée, absente, jamais en clair), les résultats
// d'aperçu absents des classements publics, la journée (`live_from`, séries). Bases locales seulement (SQLite et libSQL `file:`), jamais Turso. Logique pure : `packages/core/test/jeux.test.ts`.

const ORIGIN = "http://api.test";
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true };
const DATE = formatDay(DAY);
const fast = pilotReplay(DAY, 0.9);
const slow = pilotReplay(DAY, 0.65);
const confirmer = { confirmer: true };
/** Les jeux de l'accueil (leurs codes du registre). */
const codes = (body: { jeux: { jeu: string }[] }) => body.jeux.map((j) => j.jeu);

/** Le panneau (session factice) sur une API de test ; `seed: false` + schéma créé par un premier appel. `connecter` rouvre une session (elle dure une heure : après un saut d'horloge). */
async function panneau(options: Parameters<typeof makeApi>[0] = {}) {
  const t = await makeApi({ admin: OPTIONS_ADMIN, ...options });
  await t.call("GET", "/api/health");
  let headers: Record<string, string> = {};
  const connecter = async () => {
    const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    expect(r.status).toBe(200);
    const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
    headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  };
  await connecter();
  const adm = (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => t.call(method, path, body, { headers: { ...headers, ...extra } });
  const etat = (jeu: string, e: string) => adm("POST", `/api/admin/jeux/${jeu}/etat`, { etat: e, ...confirmer });
  return { t, adm, etat, connecter };
}

const soumettre = (t: TestApi, n: number, code: string, headers: Record<string, string> = {}) =>
  t.call("POST", "/api/submit", { playerId: playerId(n), name: `Joueur${n}`, date: DATE, replay: code }, { headers });

/** Un faux jeu n° 3, qui n'a pas de ligne dans `jeux` : un nouveau jeu naît caché. */
function fauxJeu(finis = new Map<string, number[]>()): GameDefinition<never> {
  const premier = DAY - 30;
  const portail: PortailDuJeu = {
    site: "lune",
    nom: "Lune",
    premierJour: premier,
    jour: async (day) => ({ numero: day - premier + 1, theme: "lune", seuils: null }),
    etat: async (id, day) => (finis.get(id)?.includes(day) ? { statut: "fini", tempsMs: 1500, medaille: "gold", rang: 1, classes: 1 } : { statut: "pas_joue" }),
    joursFinis: async (id) => finis.get(id) ?? [],
    profil: async () => ({ joursFinis: 0, medailles: { author: 0, gold: 0, silver: 0, bronze: 0 }, meilleurRang: null }),
    classes: async (day) => [...finis].filter(([, jours]) => jours.includes(day)).map(([id]) => ({ playerId: id, tempsMs: 1500, medaille: "gold" as const, at: 1 })),
  };
  return { code: "lune", name: "Lune", prefix: "/api/lune", tables: [], schema: [], versions: () => ({}), create: () => ({ route: async () => ({ ok: true }), dailyLevel: async () => null, portail }) };
}

describe(`interrupteur des jeux : les états (${TEST_DB})`, () => {
  it("Track et Jump, déjà publics, sont `on` ; un jeu qui n'a pas de ligne vaut `off` (un nouveau jeu naît caché)", async () => {
    const t = await makeApi({ games: [...GAMES, fauxJeu()] });
    const r = await t.call("GET", "/api/jeux");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ jeux: { track: "on", jump: "on", lune: "off" } });
    // Le jeu inconnu refuse tout, Track et Jump marchent.
    expect(await t.call("GET", "/api/lune/info")).toMatchObject({ status: 404, body: { error: "game_unavailable" } });
    expect((await t.call("GET", `/api/day/${DATE}`)).status).toBe(200);
    // Et il n'est pas à l'accueil.
    const jour = await t.call("GET", "/api/portail/jour");
    expect(codes(jour.body)).toContain("cdj");
    expect(codes(jour.body)).not.toContain("lune");
  });

  it("une ligne sans état lisible vaut `off`", async () => {
    const t = await makeApi({ games: [...GAMES, fauxJeu()] });
    await t.call("GET", "/api/jeux");
    await t.db.run("INSERT INTO jeux (jeu, etat, modifie_le) VALUES ('lune', 'peut-etre', 0)");
    t.clock.now += 60_000; // le cache de l'instance (30 s) est périmé
    expect((await t.call("GET", "/api/jeux")).body.jeux.lune).toBe("off");
    expect((await t.call("GET", "/api/lune/info")).status).toBe(404);
  });

  it("le semis de Track et de Jump (le schéma) se fait une seule fois : un état choisi depuis n'est jamais écrasé, même si le schéma est rejoué", async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    expect(await t.db.all("SELECT jeu, etat FROM jeux ORDER BY jeu")).toEqual([{ jeu: "jump", etat: "on" }, { jeu: "track", etat: "on" }]);
    await t.db.run("UPDATE jeux SET etat = 'off' WHERE jeu = 'jump'");
    await t.db.run("DELETE FROM jeux WHERE jeu = 'track'"); // retiré à la main : il ne revient pas tout seul (il vaut `off`)
    await t.db.run("DELETE FROM meta WHERE key = 'schema'"); // le schéma est rejoué au prochain appel
    const { ensureSchemaOn } = await import("../src/db");
    await ensureSchemaOn(t.db);
    expect(await t.db.all("SELECT jeu, etat FROM jeux ORDER BY jeu")).toEqual([{ jeu: "jump", etat: "off" }]);
  });

  it("`GET /api/jeux` : cache public de 30 s, lecture seule (une lecture n'écrit jamais)", async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    const avant = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM meta");
    const r = await t.call("GET", "/api/jeux");
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=30");
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM meta")).toEqual(avant);
    expect(await t.call("POST", "/api/jeux", {})).toMatchObject({ status: 405 });
  });

  it("`off` : l'API du jeu refuse (404 game_unavailable), l'accueil ne l'a plus, l'autre jeu et le profil commun marchent ; `on` : tout revient, résultats compris", async () => {
    const { t, etat } = await panneau();
    expect((await soumettre(t, 1, fast.code)).status).toBe(200);
    expect(codes((await t.call("GET", "/api/portail/jour")).body)).toContain("cdj");

    expect((await etat("track", "off")).status).toBe(200);
    for (const [m, p, b] of [["GET", `/api/day/${DATE}`], ["GET", `/api/day/${DATE}/leaderboard`], ["POST", "/api/submit", { playerId: playerId(2), name: "Deux", date: DATE, replay: slow.code }], ["GET", "/api/garage"]] as const) {
      const r = await t.call(m, p, b);
      expect([m, p, r.status, r.body.error]).toEqual([m, p, 404, "game_unavailable"]);
    }
    expect((await t.call("GET", "/api/jeux")).body.jeux).toEqual({ track: "off", jump: "on" });
    expect(codes((await t.call("GET", "/api/portail/jour")).body)).not.toContain("cdj"); // l'accueil
    expect((await t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": playerId(1) } })).status).toBe(200); // le profil commun reste
    expect((await t.call("GET", "/api/jump/info")).status).toBe(200); // l'autre jeu

    expect((await etat("track", "on")).status).toBe(200);
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.status).toBe(200);
    expect(board.body.top.map((r: { name: string }) => r.name)).toEqual(["Joueur1"]); // désactiver ne supprime rien
  });

  it("`preview` : fermé sans clé ; avec la bonne clé (en-tête, jamais l'adresse) le jeu s'ouvre ; un jeu `off` ne s'ouvre pas avec une clé", async () => {
    const { t, adm, etat } = await panneau();
    const cle = (await adm("POST", "/api/admin/jeux/track/cle", confirmer)).body.cle as string;
    expect(cle).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const avecCle = { headers: { "X-Preview-Key": cle } };
    await etat("track", "off");
    // `off` + clé : refusé (la clé n'ouvre que l'aperçu).
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, avecCle)).status).toBe(404);
    await etat("track", "preview");
    // `preview` : sans clé, mauvaise clé, clé dans l'adresse → refusé ; bonne clé en en-tête → ouvert.
    expect((await t.call("GET", `/api/day/${DATE}`)).body.error).toBe("game_unavailable");
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, { headers: { "X-Preview-Key": "x".repeat(32) } })).status).toBe(404);
    expect((await t.call("GET", `/api/day/${DATE}?apercu=${cle}&key=${cle}`)).status).toBe(404);
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, avecCle)).status).toBe(200);
    // En aperçu le jeu n'est pas à l'accueil, même pour qui a la clé.
    expect(codes((await t.call("GET", "/api/portail/jour", undefined, avecCle)).body)).not.toContain("cdj");
    expect((await t.call("GET", "/api/jeux")).body.jeux.track).toBe("preview");
  });

  it("la clé n'est gardée qu'en empreinte : ni la table, ni le journal, ni la liste de l'administration ne la contiennent ; la révoquer ferme l'aperçu", async () => {
    const { t, adm, etat } = await panneau();
    const cle = (await adm("POST", "/api/admin/jeux/track/cle", confirmer)).body.cle as string;
    await etat("track", "preview");
    const ligne = await t.db.first<{ cle_hash: string }>("SELECT cle_hash FROM jeux WHERE jeu = 'track'");
    expect(ligne!.cle_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ligne!.cle_hash).not.toContain(cle);
    const journal = JSON.stringify(await t.db.all("SELECT * FROM journal_admin"));
    expect(journal).not.toContain(cle);
    expect(journal).not.toContain(ligne!.cle_hash);
    const liste = await adm("GET", "/api/admin/jeux");
    expect(JSON.stringify(liste.body)).not.toContain(cle);
    expect(liste.body.jeux.find((j: { jeu: string }) => j.jeu === "track")).toMatchObject({ etat: "preview", cle: { presente: true } });

    const avecCle = { headers: { "X-Preview-Key": cle } };
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, avecCle)).status).toBe(200);
    expect((await adm("POST", "/api/admin/jeux/track/cle/revoquer", confirmer)).status).toBe(200);
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, avecCle)).status).toBe(404); // révoquée
    expect((await adm("POST", "/api/admin/jeux/track/cle/revoquer", confirmer)).status).toBe(400); // plus de clé à révoquer
    // Générer une nouvelle clé remplace l'ancienne.
    const nouvelle = (await adm("POST", "/api/admin/jeux/track/cle", confirmer)).body.cle as string;
    expect(nouvelle).not.toBe(cle);
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, avecCle)).status).toBe(404);
    expect((await t.call("GET", `/api/day/${DATE}`, undefined, { headers: { "X-Preview-Key": nouvelle } })).status).toBe(200);
  });
});

describe(`interrupteur des jeux : les résultats d'aperçu (${TEST_DB})`, () => {
  it("un envoi en aperçu est rangé à part : jamais dans un classement public, ni dans le haut, ni dans le nombre de classés ; il est effacé quand le jeu passe `on`", async () => {
    const { t, adm, etat } = await panneau();
    expect((await soumettre(t, 1, slow.code)).status).toBe(200); // un résultat public
    const cle = (await adm("POST", "/api/admin/jeux/track/cle", confirmer)).body.cle as string;
    await etat("track", "preview");
    const avecCle = { "X-Preview-Key": cle };
    // Sans la clé : refusé, rien n'est écrit.
    expect((await soumettre(t, 2, fast.code)).body.error).toBe("game_unavailable");
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ?", [playerId(2)])).toBeNull();
    // Avec la clé : accepté, et le joueur voit son résultat…
    const r = await soumettre(t, 2, fast.code, avecCle);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.accepted).toBe(true);
    // …rangé à part.
    expect(await t.db.first("SELECT hidden, apercu FROM results WHERE player_id = ?", [playerId(2)])).toEqual({ hidden: 1, apercu: 1 });
    // Les autres écritures du jeu (Salon, Garage…) restent fermées en aperçu.
    expect((await t.call("PUT", "/api/garage", { voiture: {}, minute: 1 }, { headers: { ...avecCle, "X-Player-Id": playerId(2) } })).body.error).toBe("game_unavailable");
    // Le classement public (jeu rouvert à tous) ne montre que le résultat public.
    await etat("track", "on");
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.body.top.map((x: { name: string }) => x.name)).toEqual(["Joueur1"]);
    expect(board.body.participants).toBe(1);
    // Le passage à `on` a effacé le résultat d'aperçu (il ne devient jamais public), le public reste.
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ?", [playerId(2)])).toBeNull();
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results")).toEqual({ n: 1 });
    // Et le portail (classement du jour) ne l'a jamais vu.
    const cl = await t.call("GET", "/api/portail/classement");
    expect(cl.body.top.map((x: { pseudo: string }) => x.pseudo)).toEqual(["Joueur1"]);
  });

  it("un aperçu ne remplace jamais le résultat public du même joueur, et inversement", async () => {
    const { t, adm, etat } = await panneau();
    expect((await soumettre(t, 1, slow.code)).status).toBe(200);
    const cle = (await adm("POST", "/api/admin/jeux/track/cle", confirmer)).body.cle as string;
    await etat("track", "preview");
    const r = await soumettre(t, 1, fast.code, { "X-Preview-Key": cle }); // plus rapide : serait « amélioré » s'il touchait la ligne publique
    expect(r.status).toBe(200);
    const ligne = await t.db.first<{ ms: number; hidden: number; apercu: number }>("SELECT ms, hidden, apercu FROM results WHERE player_id = ?", [playerId(1)]);
    expect(ligne).toEqual({ ms: slow.finishMs, hidden: 0, apercu: 0 });
  });

  it("un aperçu de PR (recette) ouvre un jeu `off` et range ce qu'il écrit à part ; la production n'a pas d'aperçu de PR", async () => {
    const hotePr = { "X-Forwarded-Host": "site-recette--pr-12-0123abcd.web.app" };
    const recette = await makeApi({ environment: "recette" });
    await recette.call("GET", "/api/health");
    await recette.db.run("UPDATE jeux SET etat = 'off' WHERE jeu = 'track'");
    recette.clock.now += 60_000;
    expect((await recette.call("GET", `/api/day/${DATE}`)).status).toBe(404);
    expect((await recette.call("GET", `/api/day/${DATE}`, undefined, { headers: hotePr })).status).toBe(200);
    expect((await soumettre(recette, 1, fast.code, hotePr)).status).toBe(200);
    expect(await recette.db.first("SELECT hidden, apercu FROM results WHERE player_id = ?", [playerId(1)])).toEqual({ hidden: 1, apercu: 1 });
    // L'accueil d'un aperçu de PR montre le jeu avec le badge « Brouillon » ; l'accueil de la recette ne l'a pas.
    const apercu = await recette.call("GET", "/api/portail/jour", undefined, { headers: hotePr });
    expect(apercu.body.jeux.find((j: { jeu: string }) => j.jeu === "cdj")).toMatchObject({ brouillon: true });
    expect(apercu.headers.get("cache-control")).toBe("no-store");
    expect(codes((await recette.call("GET", "/api/portail/jour")).body)).not.toContain("cdj");
    // Un hôte qui n'est pas un aperçu de PR n'ouvre rien.
    expect((await recette.call("GET", `/api/day/${DATE}`, undefined, { headers: { "X-Forwarded-Host": "recette.playdujour.com" } })).status).toBe(404);

    const prod = await makeApi({ environment: "production" });
    await prod.call("GET", "/api/health");
    await prod.db.run("UPDATE jeux SET etat = 'off' WHERE jeu = 'track'");
    prod.clock.now += 60_000;
    expect((await prod.call("GET", `/api/day/${DATE}`, undefined, { headers: hotePr })).status).toBe(404);
    expect((await prod.call("GET", `/api/day/${DATE}`, undefined, { headers: { Origin: "https://site--pr-1-abcdef0.web.app" } })).status).toBe(404);
  });
});

describe(`interrupteur des jeux : l'administration et le journal (${TEST_DB})`, () => {
  it("sans session, sans confirmation ou pour un jeu inconnu : refusé ; chaque changement réel est au journal, sans donnée personnelle", async () => {
    const { t, adm, etat } = await panneau();
    expect((await t.call("GET", "/api/admin/jeux")).status).toBe(401);
    expect((await t.call("POST", "/api/admin/jeux/track/etat", { etat: "off", ...confirmer })).status).toBe(401);
    expect((await adm("POST", "/api/admin/jeux/track/etat", { etat: "off" })).status).toBe(400);
    expect((await adm("POST", "/api/admin/jeux/track/etat", { etat: "demain", ...confirmer })).status).toBe(400);
    expect((await adm("POST", "/api/admin/jeux/inconnu/etat", { etat: "on", ...confirmer })).status).toBe(400);
    expect((await adm("POST", "/api/admin/jeux/track/etat", { etat: "off", ...confirmer }, { "X-Cdj-Admin": "0" })).status).toBe(403);

    await etat("track", "off");
    await etat("track", "off"); // déjà off : pas de ligne de plus
    await etat("track", "preview");
    const lignes = await t.db.all<{ action: string; cible: string; avant: string; apres: string }>("SELECT action, cible, avant, apres FROM journal_admin WHERE action LIKE '%jeu%' ORDER BY id");
    expect(lignes.map((l) => [l.cible, JSON.parse(l.avant).etat, JSON.parse(l.apres).etat])).toEqual([["track", "on", "off"], ["track", "off", "preview"]]);
    expect(JSON.stringify(lignes)).not.toContain(ADMIN_EMAIL);
    const liste = await adm("GET", "/api/admin/jeux");
    expect(liste.body.jeux.map((j: { jeu: string; etat: string }) => [j.jeu, j.etat])).toEqual([["track", "preview"], ["jump", "on"]]);
  });

  it("la remise à zéro du lancement garde l'interrupteur (la table est gardée)", async () => {
    const { t, etat } = await panneau();
    await etat("jump", "off");
    const { remiseAZero } = await import("../src/remiseAZero");
    await remiseAZero(t.db, { now: t.clock.now, applique: true });
    expect(await t.db.first("SELECT etat FROM jeux WHERE jeu = 'jump'")).toEqual({ etat: "off" });
  });
});

describe(`interrupteur des jeux : la journée, live_from et les séries (${TEST_DB})`, () => {
  // Quatre jours fixes (novembre 2026, après le premier jour de chaque jeu).
  const J0 = DAY + 30; // le jour de l'activation
  const midi = (d: number) => parisDayStart(d) + 12 * 3_600_000;

  async function lune(finis: Record<number, number[]> = {}) {
    const f = new Map<string, number[]>(Object.entries(finis).map(([n, jours]) => [playerId(Number(n)), jours]));
    const p = await panneau({ seed: false, games: [...GAMES, fauxJeu(f)] });
    /** Va à midi de ce jour (une nouvelle session de l'administrateur : la précédente a expiré). */
    const aller = async (d: number) => {
      p.t.clock.now = midi(d);
      await p.connecter();
    };
    await p.t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Alice', 0, 0, 'alice')", [playerId(1)]);
    const track = async (jours: number[]) => {
      for (const d of jours) await p.t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 40000, '[]', 'x', 0, 0)", [d, playerId(1)]);
    };
    const jour = async () => (await p.t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": playerId(1) } })).body;
    const entree = (b: { jeux: { jeu: string; compte: boolean }[] }) => b.jeux.find((j) => j.jeu === "lune");
    return { ...p, aller, track, jour, entree };
  }

  it("activation en cours de journée : visible tout de suite, mais elle ne compte (jour parfait, série, classement du jour) qu'à partir du lendemain", async () => {
    const { t, aller, etat, track, jour, entree } = await lune({ 1: [J0] });
    await aller(J0);
    await track([J0 - 1, J0]);
    const rr = await etat("lune", "on");
    expect(rr.body, JSON.stringify(rr.body)).toBeTruthy();
    expect(rr.status, JSON.stringify(rr.body)).toBe(200);
    const hui = await jour();
    expect(hui.error, JSON.stringify(hui)).toBeUndefined();
    expect(entree(hui)).toMatchObject({ jeu: "lune", compte: false }); // à l'accueil, jouable
    expect(hui.joueur.aujourdhuiParfaite).toBe(false);
    // Elle ne compte pas dans le classement du jour d'aujourd'hui : pas de vue, aucun temps au cumul.
    expect((await t.call("GET", "/api/portail/classement?vue=lune")).body.error).toBe("invalid_view");
    const live = (await t.db.first<{ live_from: number }>("SELECT live_from FROM jeux WHERE jeu = 'lune'"))!;
    expect(live.live_from).toBe(J0 + 1); // le jour qui suit l'activation
    // Demain, elle compte.
    await aller(J0 + 1);
    expect(entree(await jour())).toMatchObject({ compte: true });
    expect((await t.call("GET", "/api/portail/classement?vue=lune")).status).toBe(200);
  });

  it("série à cheval : un jour fini seulement dans un jeu qui ne comptait pas encore n'est pas un jour de série", async () => {
    // Alice finit Track la veille, Lune seule le jour de l'activation, Track le lendemain.
    const { t, aller, etat, track, jour } = await lune({ 1: [J0] });
    await aller(J0);
    await etat("lune", "on");
    await track([J0 - 1, J0 + 1]);
    await aller(J0 + 1);
    const b = await jour();
    expect(b.joueur.serie).toBe(1); // J0 (Lune seule, pas encore comptée) casse la série : seul le jour du jour compte
  });

  it("désactivation : le jeu sort de l'accueil, ne compte plus dès le lendemain, et les séries déjà acquises restent entières", async () => {
    const { t, aller, etat, track, jour, entree } = await lune({ 1: [J0 + 1, J0 + 2] });
    await aller(J0);
    await etat("lune", "on");
    await track([J0 - 1]);
    // Alice finit Lune le J0+1 et le J0+2 (jours comptés), la désactivation a lieu le J0+2.
    await aller(J0 + 2);
    await etat("lune", "off");
    expect(entree(await jour())).toBeUndefined(); // plus à l'accueil
    // Le jour même de la désactivation il compte encore (retiré « dès le lendemain ») : sa vue du classement du jour existe.
    expect((await t.call("GET", "/api/portail/classement?vue=lune")).status).toBe(200);
    // Le lendemain : il ne compte plus, mais J0+1 et J0+2 restent des jours finis (série de 2 jusqu'à hier, à prolonger).
    await aller(J0 + 3);
    const b = await jour();
    expect(b.joueur).toMatchObject({ serie: 2, aProlonger: true });
    expect((await t.call("GET", "/api/portail/classement?vue=lune")).body.error).toBe("invalid_view");
    // Un jour passé garde son classement d'avant.
    expect((await t.call("GET", `/api/portail/classement?date=${formatDay(J0 + 1)}&vue=lune`)).status).toBe(200);
    // Désactiver ne supprime rien : les résultats restent là.
    expect(await t.db.first("SELECT jeu FROM jeux WHERE jeu = 'lune'")).toEqual({ jeu: "lune" });
  });

  it("réactivation : le jeu revient, et compte à partir du lendemain de la réactivation ; réactivé le jour même de la désactivation, aucun trou", async () => {
    const { t, aller, etat, jour, entree } = await lune();
    await aller(J0);
    await etat("lune", "on"); // compte à partir de J0+1
    await aller(J0 + 2);
    await etat("lune", "off"); // compte jusqu'à J0+2 compris
    await etat("lune", "on"); // réactivé le même jour : la période se rouvre
    expect(await t.db.first("SELECT periodes FROM jeux WHERE jeu = 'lune'")).toEqual({ periodes: JSON.stringify([[J0 + 1, null]]) });
    await etat("lune", "off");
    await aller(J0 + 4);
    await etat("lune", "on"); // période [J0+1, J0+3) puis [J0+5, ∞)
    expect(await t.db.first("SELECT periodes FROM jeux WHERE jeu = 'lune'")).toEqual({ periodes: JSON.stringify([[J0 + 1, J0 + 3], [J0 + 5, null]]) });
    expect(entree(await jour())).toMatchObject({ compte: false }); // de retour à l'accueil, compté demain seulement… (J0+5)
    await aller(J0 + 5);
    expect(entree(await jour())).toMatchObject({ compte: true });
  });

  it("activé puis désactivé le jour même : il n'a jamais compté, aucune période ne reste", async () => {
    const { t, aller, etat } = await lune();
    await aller(J0);
    await etat("lune", "on");
    await etat("lune", "preview");
    expect(await t.db.first("SELECT etat, live_from, periodes FROM jeux WHERE jeu = 'lune'")).toEqual({ etat: "preview", live_from: null, periodes: "[]" });
  });

  it("`preview` et `off` ne comptent jamais dans la journée, ni dans le classement général : le jeu n'y entre qu'à `on`", async () => {
    const { t, aller, etat } = await lune({ 1: [J0] });
    await aller(J0 + 2);
    await etat("lune", "preview");
    const cl = await t.call("GET", `/api/portail/classement?date=${formatDay(J0 + 2)}`);
    expect(codes(cl.body)).not.toContain("lune");
    await etat("lune", "off");
    expect(codes((await t.call("GET", `/api/portail/classement?date=${formatDay(J0 + 2)}`)).body)).not.toContain("lune");
  });

  it("un faux jeu ouvert à la main (test) reste disponible : l'aide de test `ouvrirJeu` n'a pas besoin de session", async () => {
    const t = await makeApi({ seed: false, games: [...GAMES, fauxJeu()] });
    await ouvrirJeu(t, "lune");
    t.clock.now = NOON + DAY_MS;
    expect((await t.call("GET", "/api/lune/info")).status).toBe(200);
  });
});
