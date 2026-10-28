import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { PREMIER_JOUR_TEXTE } from "@cdj/core/lancement";
import { PREMIER_JOUR, medalFor, medalsFor } from "@cdj/sim";
import { PREMIER_JOUR_JUMP, TICK_RATE, dailyLevel, jumpMedalFor, type DailyLevel } from "@cdj/jump-sim";
import type { GameDefinition, PortailDuJeu } from "../src/games";
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

// Lot I3 (plateforme, phase 3), refait au lot A1 : la journée partagée côté serveur — le numéro de journée commun, le classement du jour **au chrono**
// (`GET /api/portail/classement?vue=cumul|track|jump`) et le cumul et la place du joueur dans `GET /api/portail/jour`. Les classés sont écrits directement
// en base à des temps choisis (le classement prouvé par rejeu est testé par `portail.test.ts` et les tests de chaque jeu) ; la lecture, elle, est la
// vraie. SQLite **et** libSQL.

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
  track?: { c?: Choix; at?: number; ms?: number };
  jump?: { c?: Choix; at?: number; ticks?: number };
}
/** Le temps d'un essai de Jump en ms, comme le portail le lit (les pas, arrondis). */
const msJump = (ticks: number) => Math.round((ticks * 1000) / TICK_RATE);
/** Écrit un joueur et ses résultats classés du jour `day` (directement en base). Rend son identifiant. */
async function joueur(t: TestApi, num: number, name: string, f: Fini, day = TODAY): Promise<string> {
  const id = playerId(num);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [id, name, name.toLowerCase()]);
  if (f.track) {
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [day, id, f.track.ms ?? track(f.track.c ?? null), f.track.at ?? 1000 + num]);
  }
  if (f.jump) {
    await t.db.run(
      "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, ?, 0, 'x', 1, 1, 0, ?)",
      [day, id, J.id, f.jump.ticks ?? jump(f.jump.c ?? null), f.jump.at ?? 1000 + num],
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
  it("vue d'un jeu : le meilleur temps prouvé de chaque joueur, croissant, avec la pastille de médaille ; aucun identifiant ni point", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { ms: 31_000 }, jump: { ticks: 3_000 } });
    await joueur(t, 2, "Bruno", { track: { ms: 30_000 } });
    await joueur(t, 3, "Chloé", { jump: { ticks: 2_880 } });
    await joueur(t, 4, "Denis", { track: { ms: 33_000 }, jump: { ticks: 3_600 } });
    const tr = await t.call("GET", "/api/portail/classement?vue=track");
    expect(tr.status, JSON.stringify(tr.body)).toBe(200);
    expect(tr.body).toMatchObject({ date: DATE, journee: null, ouvert: true, vue: "track", classes: 3 });
    expect(tr.body.bareme).toBeUndefined();
    expect(tr.body.jeux).toEqual([
      { jeu: "cdj", site: "track", nom: "Track" },
      { jeu: "jump", site: "jump", nom: "Jump" },
    ]);
    expect(tr.body.top.map((l: { rang: number; pseudo: string; tempsMs: number; complet: boolean }) => [l.rang, l.pseudo, l.tempsMs, l.complet])).toEqual([
      [1, "Bruno", 30_000, true],
      [2, "Alice", 31_000, true],
      [3, "Denis", 33_000, true],
    ]);
    expect(Object.keys(tr.body.top[0].resultats[("cdj")]).sort()).toEqual(["medaille", "rang", "tempsMs"]);
    // Jump : l'ordre est celui du classement du jeu (les pas), le temps rendu est le temps rejoué en ms.
    const ju = await t.call("GET", "/api/portail/classement?vue=jump");
    expect(ju.body.top.map((l: { rang: number; pseudo: string; tempsMs: number }) => [l.rang, l.pseudo, l.tempsMs])).toEqual([
      [1, "Chloé", msJump(2_880)],
      [2, "Alice", msJump(3_000)],
      [3, "Denis", msJump(3_600)],
    ]);
    for (let i = 1; i <= 4; i++) expect(JSON.stringify([tr.body, ju.body])).not.toContain(playerId(i));
    expect(tr.body.moi).toBeUndefined();
    expect(tr.headers.get("cache-control")).toBe(`public, max-age=${CLASSEMENT_PUBLIC_MAX_S}`);
    expect(tr.headers.get("vary")).toContain("X-Player-Id");
  }, 60_000);

  it("la vue d'un jeu garde l'ordre du jeu : à temps égal le premier arrivé, et le rang de la vue est celui du jeu", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { jump: { ticks: 3_000, at: 900 } });
    await joueur(t, 2, "Bruno", { jump: { ticks: 3_000, at: 100 } });
    await joueur(t, 3, "Chloé", { jump: { ticks: 2_999, at: 5_000 } });
    const r = await t.call("GET", "/api/portail/classement?vue=jump", undefined, as(1));
    expect(r.body.top.map((l: { pseudo: string; resultats: { jump: { rang: number } } }) => [l.pseudo, l.resultats.jump.rang])).toEqual([["Chloé", 1], ["Bruno", 2], ["Alice", 3]]);
    expect(r.body.moi).toMatchObject({ rang: 3, pseudo: "Alice", classes: 3, tempsMs: msJump(3_000) });
  }, 60_000);

  it("vue cumulée : ceux qui ont fini les deux jeux par la somme de leurs temps, puis « un jeu sur deux » par rang dans leur jeu ; égalité : le premier arrivé", async () => {
    const t = await portailApi();
    // Complets : Alice 31 000 + 25 000 = 56 000 ; Bruno 30 000 + 26 000 = 56 000 (même total, arrivé plus tôt : 400 contre 700) ; Cleo 40 000 + 20 000 = 60 000.
    await joueur(t, 1, "Alice", { track: { ms: 31_000, at: 300 }, jump: { ticks: 3_000, at: 700 } });
    await joueur(t, 2, "Bruno", { track: { ms: 30_000, at: 400 }, jump: { ticks: 3_120, at: 200 } });
    await joueur(t, 3, "Cleo", { track: { ms: 40_000, at: 100 }, jump: { ticks: 2_400, at: 100 } });
    // Un seul jeu : Track 1er = Dora (28 000), 2e = Eva (29 000) ; Jump 1er = Fred (2 000 pas), 2e = Gina (2 100) ; Track a 5 classés, Jump 5.
    await joueur(t, 4, "Dora", { track: { ms: 28_000 } });
    await joueur(t, 5, "Eva", { track: { ms: 29_000 } });
    await joueur(t, 6, "Fred", { jump: { ticks: 2_000 } });
    await joueur(t, 7, "Gina", { jump: { ticks: 2_100 } });
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ vue: "cumul", classes: 7 });
    expect(msJump(3_000)).toBe(25_000);
    expect(msJump(3_120)).toBe(26_000);
    expect(r.body.top.map((l: { rang: number; pseudo: string; tempsMs: number | null; complet: boolean }) => [l.rang, l.pseudo, l.tempsMs, l.complet])).toEqual([
      [1, "Bruno", 56_000, true], // total égal à Alice : l'essai le plus tardif de Bruno (400) est antérieur à celui d'Alice (700)
      [2, "Alice", 56_000, true],
      [3, "Cleo", 60_000, true],
      [4, "Dora", null, false], // le 1er de Track, puis le 1er de Jump, puis les 2es…
      [5, "Fred", null, false],
      [6, "Eva", null, false],
      [7, "Gina", null, false],
    ]);
    // Le résultat de chaque jeu accompagne la ligne (« — » côté portail quand c'est null).
    expect(r.body.top[0].resultats).toMatchObject({ cdj: { rang: 3, tempsMs: 30_000 }, jump: { rang: 5, tempsMs: 26_000 } });
    expect(r.body.top[3].resultats.jump).toBeNull();
    expect(r.body.top[4].resultats.cdj).toBeNull();
  }, 60_000);

  it("un jeu non fini n'est jamais compté pour un temps : un joueur lent aux deux jeux passe avant un joueur très rapide à un seul", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Lent", { track: { ms: 90_000 }, jump: { ticks: 12_000 } });
    await joueur(t, 2, "Rapide", { track: { ms: 20_000 } });
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.body.top.map((l: { pseudo: string; complet: boolean }) => [l.pseudo, l.complet])).toEqual([["Lent", true], ["Rapide", false]]);
  }, 60_000);

  it("seuls 50 sont montrés ; sa ligne (`moi`) est rendue même hors du haut, et marquée dans le haut quand il y est", async () => {
    const t = await portailApi();
    for (let i = 1; i <= 60; i++) await joueur(t, i, `P${String(i).padStart(2, "0")}`, { track: { ms: 30_000, at: i } }); // même temps : le premier arrivé d'abord
    const pub = await t.call("GET", "/api/portail/classement?vue=track");
    expect(pub.body.classes).toBe(60);
    expect(pub.body.top).toHaveLength(CLASSEMENT_TOP);
    expect(pub.body.top[0]).toMatchObject({ rang: 1, pseudo: "P01", tempsMs: 30_000 });
    expect(pub.body.top.some((l: { moi?: boolean }) => l.moi)).toBe(false);
    // Hors du haut : sa ligne seule.
    let r = await t.call("GET", "/api/portail/classement?vue=track", undefined, as(57));
    expect(r.status).toBe(200);
    expect(r.body.top).toHaveLength(CLASSEMENT_TOP);
    expect(r.body.top.some((l: { moi?: boolean }) => l.moi)).toBe(false);
    expect(r.body.moi).toMatchObject({ rang: 57, pseudo: "P57", tempsMs: 30_000, classes: 60, resultats: { cdj: { rang: 57 }, jump: null } });
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    expect(r.headers.get("vary")).toContain("X-Player-Id");
    // Dans le haut : la ligne est marquée, `moi` aussi.
    r = await t.call("GET", "/api/portail/classement?vue=track", undefined, as(3));
    expect(r.body.top.filter((l: { moi?: boolean }) => l.moi).map((l: { pseudo: string }) => l.pseudo)).toEqual(["P03"]);
    expect(r.body.moi).toMatchObject({ rang: 3, pseudo: "P03" });
    // Au cumul, il n'a fini qu'un jeu : sa ligne est sous la séparation, après les 0 joueurs complets.
    r = await t.call("GET", "/api/portail/classement", undefined, as(57));
    expect(r.body.moi).toMatchObject({ rang: 57, complet: false, tempsMs: null, classes: 60 });
    // Un joueur connu qui n'a rien fini aujourd'hui : pas de ligne. Un joueur qui n'a pas fini Jump : pas de ligne dans la vue de Jump.
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Vide', 0, 0, 'vide')", [playerId(900)]);
    expect((await t.call("GET", "/api/portail/classement", undefined, as(900))).body.moi).toBeNull();
    expect((await t.call("GET", "/api/portail/classement?vue=jump", undefined, as(57))).body.moi).toBeNull();
  }, 120_000);

  it("une vue inconnue est refusée (`invalid_view`) ; un jeu qui n'existe pas encore ce jour-là aussi", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "gold" } });
    const r = await t.call("GET", "/api/portail/classement?vue=points");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_view");
    const avantJump = PREMIER_JOUR_JUMP - 1;
    await joueur(t, 2, "Bruno", { track: { c: "silver" } }, avantJump);
    const a = await t.call("GET", `/api/portail/classement?date=${formatDay(avantJump)}&vue=jump`);
    expect(a.body.error).toBe("invalid_view");
    expect((await t.call("GET", `/api/portail/classement?date=${formatDay(avantJump)}&vue=track`)).status).toBe(200);
  }, 60_000);

  it("un classement calculé au plus une fois par fenêtre et par instance, pas à chaque requête ni à chaque vue ; un jour fermé est gardé plus longtemps", async () => {
    const t = await portailApi();
    const lectures = espion(t);
    await joueur(t, 1, "Alice", { track: { c: "gold" }, jump: { c: "gold" } });
    const vues = ["cumul", "track", "jump"];
    for (let i = 0; i < 12; i++) await t.call("GET", `/api/portail/classement?vue=${vues[i % 3]}`, undefined, i % 2 ? as(1) : {});
    expect(lectures).toEqual({ results: 1, jump: 1 });
    // Deux requêtes en même temps : un seul calcul.
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    await Promise.all([t.call("GET", "/api/portail/classement"), t.call("GET", "/api/portail/classement?vue=jump"), t.call("GET", "/api/portail/jour", undefined, as(1))]);
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

  it("jours passés lisibles (archives) avec la règle d'aujourd'hui ; jours futurs et jours d'avant les jeux refusés ; date illisible refusée", async () => {
    const t = await portailApi();
    const veille = TODAY - 1;
    await joueur(t, 1, "Alice", { track: { ms: 30_000 } }, veille);
    const r = await t.call("GET", `/api/portail/classement?date=${formatDay(veille)}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ date: formatDay(veille), ouvert: false, classes: 1 });
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump"]);
    // Avant le premier jour de Jump, il n'existe pas : le cumul est le classement de Track, tous les joueurs y sont « complets ».
    const avantJump = PREMIER_JOUR_JUMP - 1;
    await joueur(t, 2, "Bruno", { track: { ms: 32_000 } }, avantJump);
    const a = await t.call("GET", `/api/portail/classement?date=${formatDay(avantJump)}`);
    expect(a.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj"]);
    expect(a.body.top[0]).toMatchObject({ pseudo: "Bruno", tempsMs: 32_000, complet: true });
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

  it("un jeu n° 3 se déclare au registre : sa vue, et son temps au cumul, sans toucher à la route", async () => {
    const finis = new Map<string, { medaille: "gold" | "bronze"; ms: number }>([
      [playerId(1), { medaille: "bronze", ms: 1_800 }],
      [playerId(2), { medaille: "gold", ms: 1_500 }],
    ]);
    const faux: PortailDuJeu = {
      site: "lune",
      nom: "Lune",
      premierJour: TODAY - 1,
      jour: async (day) => ({ numero: day - TODAY + 2, theme: "lune", seuils: null }),
      etat: async (id) => {
        const m = finis.get(id);
        return m ? { statut: "fini", tempsMs: m.ms, medaille: m.medaille, rang: id === playerId(2) ? 1 : 2, classes: 2 } : { statut: "pas_joue" };
      },
      joursFinis: async () => [],
      profil: async () => ({ joursFinis: 0, medailles: { author: 0, gold: 0, silver: 0, bronze: 0 }, meilleurRang: null }),
      classes: async (day) => (day === TODAY ? [...finis].sort((a, b) => a[1].ms - b[1].ms).map(([playerId, m]) => ({ playerId, tempsMs: m.ms, medaille: m.medaille, at: 1 })) : []),
    };
    const FAUX: GameDefinition<never> = { code: "lune", name: "Faux jeu", prefix: "/api/lune", tables: [], schema: [], versions: () => ({}), create: () => ({ route: async () => undefined, dailyLevel: async () => null, portail: faux }) };
    const t = await portailApi({ games: [...GAMES, FAUX] });
    await joueur(t, 1, "Alice", { track: { ms: 30_000 }, jump: { ticks: 2_400 } }); // 30 000 + 20 000 + 1 800 = 51 800
    await joueur(t, 2, "Bruno", { track: { ms: 29_000 }, jump: { ticks: 2_400 } }); // 29 000 + 20 000 + 1 500 = 50 500
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump", "lune"]);
    expect(r.body.top.map((l: { pseudo: string; tempsMs: number }) => [l.pseudo, l.tempsMs])).toEqual([["Bruno", 50_500], ["Alice", 51_800]]);
    expect(r.body.top[0].resultats.lune).toEqual({ rang: 1, tempsMs: 1_500, medaille: "gold" });
    const v = await t.call("GET", "/api/portail/classement?vue=lune");
    expect(v.body.top.map((l: { pseudo: string; tempsMs: number }) => [l.pseudo, l.tempsMs])).toEqual([["Bruno", 1_500], ["Alice", 1_800]]);
  }, 60_000);
});

describe(`le cumul et la place du joueur dans GET /api/portail/jour (${TEST_DB})`, () => {
  it("temps cumulé, rang et nombre de classés du jour ; aucun jeu fini aujourd'hui : rien à classer", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { ms: 30_000 }, jump: { ticks: 3_000 } }); // 55 000
    await joueur(t, 2, "Bruno", { track: { ms: 25_000 } }); // un seul jeu
    await joueur(t, 3, "Chloé", { track: { ms: 31_000 }, jump: { ticks: 3_240 } }); // 58 000
    let r = await t.call("GET", "/api/portail/jour", undefined, as(3));
    expect(r.body.joueur).toMatchObject({ pseudo: "Chloé", cumulMs: 58_000, rangDuJour: 2, classesDuJour: 3 });
    expect(r.body.joueur.points).toBeUndefined();
    r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(r.body.joueur).toMatchObject({ cumulMs: 55_000, rangDuJour: 1, classesDuJour: 3 });
    // Un seul jeu fini : pas de cumul, mais une place (sous « Un jeu sur deux »).
    r = await t.call("GET", "/api/portail/jour", undefined, as(2));
    expect(r.body.joueur).toMatchObject({ cumulMs: null, rangDuJour: 3, classesDuJour: 3 });
    // Un joueur qui n'a rien fini aujourd'hui (mais une journée hier) : pas de rang ; le classement gardé est lu une fois (par fenêtre, pas par visite).
    const lectures = espion(t);
    await joueur(t, 4, "Denis", { track: { c: "gold" } }, TODAY - 1);
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    r = await t.call("GET", "/api/portail/jour", undefined, as(4));
    expect(r.body.joueur).toMatchObject({ cumulMs: null, rangDuJour: null, classesDuJour: null });
    await t.call("GET", "/api/portail/jour", undefined, as(4));
    expect(lectures).toEqual({ results: 1, jump: 1 });
  }, 60_000);

  it("la visite d'un joueur déjà classé ne compte plus les classés devant lui : sa place vient du classement gardé (coût indépendant du nombre de joueurs)", async () => {
    const t = await portailApi();
    for (let i = 1; i <= 40; i++) await joueur(t, i, `P${i}`, { track: { ms: 30_000 + i, at: i }, jump: { ticks: 3_000 + i, at: i } });
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

  it("un joueur qui vient de finir (absent du classement gardé) a tout de suite son cumul et sa place", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { ms: 30_000 }, jump: { ticks: 3_000 } }); // 55 000
    await joueur(t, 2, "Bruno", { track: { ms: 40_000 }, jump: { ticks: 3_000 } }); // 65 000
    expect((await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur).toMatchObject({ rangDuJour: 1, classesDuJour: 2 });
    // Chloé finit dans la fenêtre : le classement gardé ne la connaît pas encore, sa ligne est pourtant exacte.
    await joueur(t, 3, "Chloé", { track: { ms: 28_000 }, jump: { ticks: 3_000 } }); // 53 000
    t.clock.now += 1000;
    expect((await t.call("GET", "/api/portail/jour", undefined, as(3))).body.joueur).toMatchObject({ cumulMs: 53_000, rangDuJour: 1, classesDuJour: 3 });
    const c = await t.call("GET", "/api/portail/classement", undefined, as(3));
    expect(c.body.classes).toBe(2); // le classement public est celui d'il y a quelques secondes
    expect(c.body.moi).toMatchObject({ rang: 1, tempsMs: 53_000, pseudo: "Chloé", classes: 3 });
    // La fenêtre passée, le classement la connaît.
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    const d = await t.call("GET", "/api/portail/classement", undefined, as(3));
    expect(d.body.classes).toBe(3);
    expect(d.body.top[0]).toMatchObject({ pseudo: "Chloé", moi: true });
  }, 60_000);

  it("un joueur qui finit son deuxième jeu passe sous « un jeu sur deux » en tête : sa place est exacte tout de suite", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { ms: 30_000 }, jump: { ticks: 3_000 } });
    await joueur(t, 2, "Bruno", { track: { ms: 29_000 } });
    expect((await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur).toMatchObject({ cumulMs: null, rangDuJour: 2, classesDuJour: 2 });
    // Bruno finit Jump dans la fenêtre : il devient complet, 29 000 + 30 000 = 59 000, derrière Alice (55 000).
    await t.db.run(
      "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, 3600, 0, 'x', 1, 1, 0, 2000)",
      [TODAY, playerId(2), J.id],
    );
    t.clock.now += 1000;
    expect((await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur).toMatchObject({ cumulMs: 59_000, rangDuJour: 2, classesDuJour: 2 });
    const c = await t.call("GET", "/api/portail/classement", undefined, as(2));
    expect(c.body.moi).toMatchObject({ rang: 2, complet: true, tempsMs: 59_000 });
  }, 60_000);

  it("la médaille se lit comme dans `etat` (les seuils du jour) et accompagne le temps de chaque jeu", async () => {
    const t = await portailApi();
    await joueur(t, 1, "Alice", { track: { c: "bronze" }, jump: { c: "author" } });
    const r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    const [cdj, jump] = r.body.jeux;
    expect(cdj.etat.medaille).toBe(medalFor(track("bronze") + 0, medalsFor(circuitOf(TODAY).authorMs)) ?? null);
    expect(jump.etat.medaille).toBe(jumpMedalFor(J.medals.author, J.medals));
    const c = await t.call("GET", "/api/portail/classement", undefined, as(1));
    expect(c.body.moi.resultats.cdj.medaille).toBe(cdj.etat.medaille);
    expect(c.body.moi.resultats.jump.medaille).toBe(jump.etat.medaille);
    expect(c.body.moi.tempsMs).toBe(cdj.etat.tempsMs + jump.etat.tempsMs);
  }, 60_000);
});
