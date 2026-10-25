import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { PREMIER_JOUR_TEXTE } from "@cdj/core/lancement";
import { PREMIER_JOUR, medalFor, medalsFor } from "@cdj/sim";
import { PREMIER_JOUR_JUMP, dailyLevel, jumpMedalFor, type DailyLevel } from "@cdj/jump-sim";
import type { GameDefinition, PortailDuJeu } from "../src/games";
import { BAREME_POINTS } from "../src/classementDuJour";
import {
  CLASSEMENT_FENETRE_MS,
  CLASSEMENT_FERME_MAX_S,
  CLASSEMENT_GRACE_MS,
  CLASSEMENT_JOUR_FERME_MS,
  CLASSEMENT_PUBLIC_MAX_S,
  CLASSEMENT_TOP,
  PREMIER_JOUR_DU_JOUR,
  numeroDeJournee,
} from "../src/portail";
import { GRACE_MS } from "../src/cdj";
import { JUMP_GRACE_MS } from "../src/jump";
import { GAMES } from "../src/registry";
import { circuitOf, makeApi, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot I3 (plateforme, phase 3) : la journée partagée côté serveur — le numéro de journée commun (23/10/2026 = n° 1), les points du jour, le classement
// du jour tous jeux confondus (`GET /api/portail/classement`) et la place du joueur dans `GET /api/portail/jour`. Les classés sont écrits directement
// en base à des temps choisis par rapport aux seuils des médailles du jour (le classement prouvé par rejeu est testé par `portail.test.ts` et les tests
// de chaque jeu) ; la lecture, elle, est la vraie. SQLite **et** libSQL.

const TODAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(TODAY);
const NOON = parisDayStart(TODAY) + 12 * 3_600_000;
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

/** Une médaille choisie → un temps (ms pour Track, pas pour Jump) qui la donne, et `null` → un temps sans médaille. */
type Choix = "author" | "gold" | "silver" | "bronze" | null;
let J: DailyLevel;
const track = (c: Choix) => {
  const m = medalsFor(circuitOf(TODAY).authorMs);
  return c ? m[c] : m.bronze + 5_000;
};
const jump = (c: Choix) => (c ? J.medals[c] : J.medals.bronze + 500);

beforeAll(() => {
  J = dailyLevel(TODAY);
}, 60_000);

async function portailApi(options: Parameters<typeof makeApi>[0] = {}) {
  const t = await makeApi({ seed: false, ...options });
  t.clock.now = NOON;
  await t.call("GET", "/api/health"); // le schéma (les classés sont écrits directement en base)
  return t;
}

/** Un temps qui donne la médaille choisie (`ms` / `ticks` : un temps précis pour départager dans un jeu) ; `at` : l'horodatage de l'essai classé (départage les temps égaux). */
interface Fini {
  track?: { c: Choix; at?: number; ms?: number };
  jump?: { c: Choix; at?: number; ticks?: number };
}
/** Écrit un joueur et ses résultats classés du jour `day` (directement en base). Rend son identifiant. */
async function joueur(t: TestApi, num: number, name: string, f: Fini, day = TODAY): Promise<string> {
  const id = playerId(num);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [id, name, name.toLowerCase()]);
  if (f.track) {
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [day, id, f.track.ms ?? track(f.track.c), f.track.at ?? 1000 + num]);
  }
  if (f.jump) {
    await t.db.run(
      "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, ?, 0, 'x', 1, 1, 0, ?)",
      [day, id, J.id, f.jump.ticks ?? jump(f.jump.c), f.jump.at ?? 1000 + num],
    );
  }
  return id;
}

/** Combien de fois la base a lu les classés de chaque jeu (un calcul du classement du jour = une lecture de `results` et de `jump_results`). */
function espion(t: TestApi) {
  const compte = { results: 0, jump: 0 };
  const all = t.db.all.bind(t.db);
  t.db.all = ((sql: string, params?: unknown[]) => {
    if (/^SELECT player_id, ms, submitted_at FROM results WHERE day = \?/.test(sql)) compte.results++;
    if (/^SELECT player_id, ticks, submitted_at FROM jump_results WHERE day = \?/.test(sql)) compte.jump++;
    return all(sql, params as never);
  }) as typeof t.db.all;
  return compte;
}

describe("le numéro de journée commun", () => {
  it("la journée n° 1 est celle de config/lancement.json (la source unique, lot R8) ; avant, aucun numéro", () => {
    expect(PREMIER_JOUR_DU_JOUR).toBe(parseDay(PREMIER_JOUR_TEXTE));
    expect(PREMIER_JOUR_DU_JOUR).toBe(daysFromCivil(2026, 10, 26)); // la valeur posée par le lot R8 ; Nathan la déplace dans le fichier JSON, puis ici
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR - 1)).toBeNull();
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR)).toBe(1);
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR + 41)).toBe(42);
  });

  it(`GET /api/portail/jour rend \`journee\` (null avant la journée n° 1, puis 1, 2…) (${TEST_DB})`, async () => {
    const t = await portailApi();
    expect((await t.call("GET", "/api/portail/jour")).body.journee).toBeNull();
    t.clock.now = parisDayStart(PREMIER_JOUR_DU_JOUR) + 3_600_000;
    expect((await t.call("GET", "/api/portail/jour")).body.journee).toBe(1);
    t.clock.now = parisDayStart(PREMIER_JOUR_DU_JOUR + 1) + 3_600_000;
    expect((await t.call("GET", "/api/portail/jour")).body.journee).toBe(2);
  }, 60_000);

  it("la grâce du classement est celle des deux jeux", () => {
    expect(CLASSEMENT_GRACE_MS).toBe(GRACE_MS);
    expect(CLASSEMENT_GRACE_MS).toBe(JUMP_GRACE_MS);
  });
});

describe(`classement du jour : GET /api/portail/classement (${TEST_DB})`, () => {
  it("les points (auteur 4 · or 3 · argent 2 · bronze 1 · sans médaille 0), la somme sur les jeux, l'ordre ; aucun identifiant", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" }, jump: { c: "silver" } }); // 3 + 2 = 5
    await joueur(t, 2, "Bruno", { track: { c: "author" } }); // 4
    await joueur(t, 3, "Chloé", { jump: { c: "gold" } }); // 3
    await joueur(t, 4, "Denis", { track: { c: null }, jump: { c: "bronze" } }); // 0 + 1 = 1
    await joueur(t, 5, "Eva", { track: { c: null } }); // 0 : fini sans médaille, classée quand même
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ date: DATE, journee: null, ouvert: true, bareme: BAREME_POINTS, classes: 5 });
    expect(r.body.jeux).toEqual([
      { jeu: "cdj", site: "track", nom: "Track" },
      { jeu: "jump", site: "jump", nom: "Jump" },
    ]);
    expect(r.body.top.map((l: { rang: number; pseudo: string; points: number }) => [l.rang, l.pseudo, l.points])).toEqual([
      [1, "Alice", 5],
      [2, "Bruno", 4],
      [3, "Chloé", 3],
      [4, "Denis", 1],
      [5, "Eva", 0],
    ]);
    // La médaille de chaque jeu (null : pas fini), jamais l'identifiant d'un joueur.
    // Track : Bruno (auteur) 1er, Alice (or) 2e, Denis puis Eva (sans médaille, même temps : le premier arrivé) ; Jump : Chloé (or) 1re, Alice (argent) 2e, Denis (bronze) 3e.
    expect(r.body.top[0].resultats).toEqual({ cdj: { rang: 2, medaille: "gold" }, jump: { rang: 2, medaille: "silver" } });
    expect(r.body.top[1].resultats).toEqual({ cdj: { rang: 1, medaille: "author" }, jump: null });
    expect(r.body.top[2].resultats).toEqual({ cdj: null, jump: { rang: 1, medaille: "gold" } });
    expect(r.body.top[4].resultats).toEqual({ cdj: { rang: 4, medaille: null }, jump: null });
    for (let i = 1; i <= 5; i++) expect(JSON.stringify(r.body)).not.toContain(playerId(i));
    expect(r.body.moi).toBeUndefined();
    expect(r.headers.get("cache-control")).toBe(`public, max-age=${CLASSEMENT_PUBLIC_MAX_S}`);
    expect(r.headers.get("vary")).toContain("X-Player-Id");
  }, 60_000);

  it("à égalité de points : la somme des rangs (un jeu non fini compte pour le nombre de classés + 1), puis le premier arrivé à son total", async () => {
    const t = await portailApi();
    // Tous à 3 points. Track (3 classés) : Dora 1re, Anne 2e (même temps d'or, Dora est arrivée avant), Cleo 3e. Jump (2 classés) : Bea 1re, Cleo 2e.
    await joueur(t, 1, "Anne", { track: { c: "gold", at: 500 } }); // Track 2 + Jump non fini (2 + 1) = 5
    await joueur(t, 2, "Bea", { jump: { c: "gold", at: 400 } }); // Track non fini (3 + 1) + Jump 1 = 5
    await joueur(t, 3, "Cleo", { track: { c: "bronze", at: 100 }, jump: { c: "silver", at: 600 } }); // 1 + 2 = 3 points ; Track 3 + Jump 2 = 5 ; total atteint à 600
    await joueur(t, 4, "Dora", { track: { c: "gold", at: 450 } }); // Track 1 + Jump non fini 3 = 4
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.body.top.map((l: { pseudo: string; points: number }) => [l.pseudo, l.points])).toEqual([
      ["Dora", 3], // la plus petite somme de rangs (4)
      ["Bea", 3], // somme 5, total atteint à 400
      ["Anne", 3], // somme 5, total atteint à 500
      ["Cleo", 3], // somme 5, total atteint à 600 (son essai le plus tardif)
    ]);
  }, 60_000);

  it("seuls 50 sont montrés ; sa ligne (`moi`) est rendue même hors du haut, et marquée dans le haut quand il y est", async () => {
    const t = await portailApi();
    for (let i = 1; i <= 60; i++) await joueur(t, i, `P${String(i).padStart(2, "0")}`, { track: { c: "gold", at: i } }); // même temps d'or : le premier arrivé d'abord
    const pub = await t.call("GET", "/api/portail/classement");
    expect(pub.body.classes).toBe(60);
    expect(pub.body.top).toHaveLength(CLASSEMENT_TOP);
    expect(pub.body.top[0]).toMatchObject({ rang: 1, pseudo: "P01", points: 3 });
    expect(pub.body.top.some((l: { moi?: boolean }) => l.moi)).toBe(false);
    // Hors du haut : sa ligne seule.
    let r = await t.call("GET", "/api/portail/classement", undefined, as(57));
    expect(r.status).toBe(200);
    expect(r.body.top).toHaveLength(CLASSEMENT_TOP);
    expect(r.body.top.some((l: { moi?: boolean }) => l.moi)).toBe(false);
    expect(r.body.moi).toMatchObject({ rang: 57, pseudo: "P57", points: 3, classes: 60, resultats: { cdj: { rang: 57, medaille: "gold" }, jump: null } });
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    expect(r.headers.get("vary")).toContain("X-Player-Id");
    // Dans le haut : la ligne est marquée, `moi` aussi.
    r = await t.call("GET", "/api/portail/classement", undefined, as(3));
    expect(r.body.top.filter((l: { moi?: boolean }) => l.moi).map((l: { pseudo: string }) => l.pseudo)).toEqual(["P03"]);
    expect(r.body.moi).toMatchObject({ rang: 3, pseudo: "P03" });
    // Un joueur connu qui n'a rien fini aujourd'hui : pas de ligne.
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Vide', 0, 0, 'vide')", [playerId(900)]);
    expect((await t.call("GET", "/api/portail/classement", undefined, as(900))).body.moi).toBeNull();
  }, 120_000);

  it("un classement calculé au plus une fois par fenêtre et par instance, pas à chaque requête ; un jour fermé est gardé plus longtemps", async () => {
    const t = await portailApi();
    const lectures = espion(t);
    await joueur(t, 1, "Alice", { track: { c: "gold" }, jump: { c: "gold" } });
    for (let i = 0; i < 10; i++) await t.call("GET", "/api/portail/classement", undefined, i % 2 ? as(1) : {});
    expect(lectures).toEqual({ results: 1, jump: 1 });
    // Deux requêtes en même temps : un seul calcul.
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    await Promise.all([t.call("GET", "/api/portail/classement"), t.call("GET", "/api/portail/classement"), t.call("GET", "/api/portail/jour", undefined, as(1))]);
    expect(lectures).toEqual({ results: 2, jump: 2 });
    // La fenêtre passée, un nouvel arrivant entre au calcul suivant.
    await joueur(t, 2, "Bruno", { track: { c: "author" } });
    expect((await t.call("GET", "/api/portail/classement")).body.classes).toBe(1); // encore l'ancien (gardé)
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    expect((await t.call("GET", "/api/portail/classement")).body.classes).toBe(2);
    expect(lectures).toEqual({ results: 3, jump: 3 });
    // Un jour passé (figé) : gardé 10 min.
    t.clock.now = parisDayStart(TODAY + 1) + CLASSEMENT_GRACE_MS + 1000;
    const hier = `/api/portail/classement?date=${DATE}`;
    const r = await t.call("GET", hier);
    expect(r.body).toMatchObject({ ouvert: false, classes: 2 });
    expect(r.headers.get("cache-control")).toBe(`public, max-age=${CLASSEMENT_FERME_MAX_S}`);
    const avant = { ...lectures };
    t.clock.now += CLASSEMENT_JOUR_FERME_MS - 5000;
    await t.call("GET", hier);
    expect(lectures).toEqual(avant);
    t.clock.now += 6000;
    await t.call("GET", hier);
    expect(lectures.results).toBe(avant.results + 1);
  }, 120_000);

  it("jours passés lisibles (archives) ; jours futurs et jours d'avant les jeux refusés ; date illisible refusée", async () => {
    const t = await portailApi();
    const veille = TODAY - 1;
    await joueur(t, 1, "Alice", { track: { c: "gold" } }, veille);
    const r = await t.call("GET", `/api/portail/classement?date=${formatDay(veille)}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ date: formatDay(veille), ouvert: false, classes: 1 });
    // La veille, DailyJump n'avait pas de classé (il existait) : la colonne est là, vide.
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump"]);
    // Avant le premier jour de Jump, il n'existe pas dans le classement du jour.
    const avantJump = PREMIER_JOUR_JUMP - 1;
    await joueur(t, 2, "Bruno", { track: { c: "silver" } }, avantJump);
    const a = await t.call("GET", `/api/portail/classement?date=${formatDay(avantJump)}`);
    expect(a.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj"]);
    expect(a.body.top[0]).toMatchObject({ pseudo: "Bruno", points: 2 });
    // Futur, avant les jeux, illisible.
    expect((await t.call("GET", `/api/portail/classement?date=${formatDay(TODAY + 1)}`)).body.error).toBe("unknown_day");
    expect((await t.call("GET", `/api/portail/classement?date=${formatDay(PREMIER_JOUR - 1)}`)).body.error).toBe("unknown_day");
    expect((await t.call("GET", "/api/portail/classement?date=hier")).status).toBe(400);
    expect((await t.call("GET", "/api/portail/classement?date=2026-02-30")).body.error).toBe("invalid_date");
    expect((await t.call("POST", "/api/portail/classement")).status).toBe(405);
  }, 60_000);

  it("la veille reste « ouverte » pendant la grâce de 10 min : cache court", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" } }, TODAY);
    t.clock.now = parisDayStart(TODAY + 1) + 60_000;
    const r = await t.call("GET", `/api/portail/classement?date=${DATE}`);
    expect(r.body.ouvert).toBe(true);
    expect(r.headers.get("cache-control")).toBe(`public, max-age=${CLASSEMENT_PUBLIC_MAX_S}`);
  }, 60_000);

  it("joueur inconnu : 404 `unknown_player` qui porte quand même le classement ; code révoqué : 410", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" } });
    const r = await t.call("GET", "/api/portail/classement", undefined, as(99));
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("unknown_player");
    expect(r.body.top).toHaveLength(1);
    expect(r.body.moi).toBeUndefined();
    expect((await t.call("POST", "/api/me/code", { newId: playerId(2) }, as(1))).status).toBe(200);
    const v = await t.call("GET", "/api/portail/classement", undefined, as(1));
    expect(v.status).toBe(410);
    expect(v.body.top).toHaveLength(1);
  }, 60_000);

  it("un jeu n° 3 se déclare au registre : ses points entrent au classement sans toucher à la route", async () => {
    const finis = new Map<string, "gold" | "bronze">([
      [playerId(1), "bronze"],
      [playerId(2), "gold"],
    ]);
    const faux: PortailDuJeu = {
      site: "lune",
      nom: "Lune",
      premierJour: TODAY - 1,
      jour: async (day) => ({ numero: day - TODAY + 2, theme: "lune", seuils: null }),
      etat: async (id) => {
        const m = finis.get(id);
        return m ? { statut: "fini", tempsMs: 1500, medaille: m, rang: id === playerId(2) ? 1 : 2, classes: 2 } : { statut: "pas_joue" };
      },
      joursFinis: async () => [],
      profil: async () => ({ joursFinis: 0, medailles: { author: 0, gold: 0, silver: 0, bronze: 0 }, meilleurRang: null }),
      classes: async (day) => (day === TODAY ? [...finis].sort((a, b) => (a[1] === "gold" ? -1 : 1) - (b[1] === "gold" ? -1 : 1)).map(([playerId, medaille]) => ({ playerId, medaille, at: 1 })) : []),
    };
    const FAUX: GameDefinition<never> = { code: "lune", name: "Faux jeu", prefix: "/api/lune", tables: [], schema: [], versions: () => ({}), create: () => ({ route: async () => undefined, dailyLevel: async () => null, portail: faux }) };
    const t = await portailApi({ games: [...GAMES, FAUX] });
    await joueur(t, 1, "Alice", { track: { c: "gold" } }); // 3 + 1 = 4
    await joueur(t, 2, "Bruno", { track: { c: "silver" } }); // 2 + 3 = 5
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump", "lune"]);
    expect(r.body.top.map((l: { pseudo: string; points: number }) => [l.pseudo, l.points])).toEqual([
      ["Bruno", 5],
      ["Alice", 4],
    ]);
    expect(r.body.top[0].resultats).toEqual({ cdj: expect.objectContaining({ medaille: "silver" }), jump: null, lune: { rang: 1, medaille: "gold" } });
  }, 60_000);
});

describe(`la place du joueur dans GET /api/portail/jour (${TEST_DB})`, () => {
  it("points, rang et nombre de classés du jour ; aucun jeu fini aujourd'hui : rien à classer", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" }, jump: { c: "silver" } }); // 5
    await joueur(t, 2, "Bruno", { track: { c: "author" } }); // 4
    await joueur(t, 3, "Chloé", { jump: { c: "gold" } }); // 3
    let r = await t.call("GET", "/api/portail/jour", undefined, as(2));
    expect(r.body.joueur).toMatchObject({ pseudo: "Bruno", points: 4, rangDuJour: 2, classesDuJour: 3 });
    r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(r.body.joueur).toMatchObject({ points: 5, rangDuJour: 1, classesDuJour: 3 });
    // Un joueur qui n'a rien fini aujourd'hui (mais une journée hier) : 0 point, pas de rang ; le classement gardé est lu une fois (par fenêtre, pas par visite).
    const lectures = espion(t);
    await joueur(t, 4, "Denis", { track: { c: "gold" } }, TODAY - 1);
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    r = await t.call("GET", "/api/portail/jour", undefined, as(4));
    expect(r.body.joueur).toMatchObject({ points: 0, rangDuJour: null, classesDuJour: null });
    await t.call("GET", "/api/portail/jour", undefined, as(4));
    expect(lectures).toEqual({ results: 1, jump: 1 });
  }, 60_000);

  it("la visite d'un joueur déjà classé ne compte plus les classés devant lui : sa place vient du classement gardé (coût indépendant du nombre de joueurs)", async () => {
    const t = await portailApi();
    for (let i = 1; i <= 40; i++) await joueur(t, i, `P${i}`, { track: { c: "gold", at: i }, jump: { c: "silver", at: i } });
    await t.call("GET", "/api/portail/jour", undefined, as(30)); // calcule le classement gardé
    const comptes: string[] = [];
    for (const m of ["all", "first"] as const) {
      const f = t.db[m].bind(t.db) as (sql: string, params?: unknown[]) => Promise<unknown>;
      (t.db as unknown as Record<string, unknown>)[m] = (sql: string, params?: unknown[]) => {
        if (/COUNT\(\*\) AS n FROM (results|jump_results) WHERE day = \?/.test(sql)) comptes.push(sql);
        return f(sql, params);
      };
    }
    const r = await t.call("GET", "/api/portail/jour", undefined, as(30));
    expect(r.body.jeux.map((j: { etat: { rang: number; classes: number } }) => [j.etat.rang, j.etat.classes])).toEqual([[30, 40], [30, 40]]);
    expect(r.body.joueur).toMatchObject({ rangDuJour: 30, classesDuJour: 40 });
    expect(comptes).toEqual([]); // ni rang compté, ni classés comptés
  }, 60_000);

  it("un joueur qui vient de finir (absent du classement gardé) a tout de suite ses points et sa place", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" } }); // 3
    await joueur(t, 2, "Bruno", { track: { c: "bronze" } }); // 1
    expect((await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur).toMatchObject({ rangDuJour: 1, classesDuJour: 2 });
    // Chloé finit dans la fenêtre : le classement gardé ne la connaît pas encore, sa ligne est pourtant exacte.
    await joueur(t, 3, "Chloé", { track: { c: "silver" }, jump: { c: "silver" } }); // 2 + 2 = 4
    t.clock.now += 1000;
    expect((await t.call("GET", "/api/portail/jour", undefined, as(3))).body.joueur).toMatchObject({ points: 4, rangDuJour: 1, classesDuJour: 3 });
    const c = await t.call("GET", "/api/portail/classement", undefined, as(3));
    expect(c.body.classes).toBe(2); // le classement public est celui d'il y a quelques secondes
    expect(c.body.moi).toMatchObject({ rang: 1, points: 4, pseudo: "Chloé", classes: 3 });
    // La fenêtre passée, le classement la connaît.
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    const d = await t.call("GET", "/api/portail/classement", undefined, as(3));
    expect(d.body.classes).toBe(3);
    expect(d.body.top[0]).toMatchObject({ pseudo: "Chloé", moi: true });
  }, 60_000);

  it("la médaille se lit comme dans `etat` (les seuils du jour)", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "bronze" }, jump: { c: "author" } });
    const r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    const [cdj, jump] = r.body.jeux;
    expect(cdj.etat.medaille).toBe(medalFor(track("bronze") + 0, medalsFor(circuitOf(TODAY).authorMs)) ?? null);
    expect(jump.etat.medaille).toBe(jumpMedalFor(J.medals.author, J.medals));
    expect(r.body.joueur.points).toBe(BAREME_POINTS[cdj.etat.medaille as "bronze"] + BAREME_POINTS[jump.etat.medaille as "author"]);
  }, 60_000);
});
