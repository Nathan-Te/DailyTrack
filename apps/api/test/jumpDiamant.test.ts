import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  TRAJECTOIRE_PAS,
  dailyLevel,
  decoderTrajectoire,
  echantillonnerTrajectoire,
  encoderTrajectoire,
  trajectoireDuree,
  type DailyLevel,
} from "@cdj/jump-sim";
import { JUMP_GRACE_MS } from "../src/jump";
import { TEST_DB, makeApi, parisDayStart, playerId } from "./helpers";

// Lot G1 (plateforme) : `GET /api/jump/fantome-diamant?date=` — la trajectoire de l'auteur du niveau (positions, jamais les entrées). Refusé avant
// d'avoir fini le niveau du jour (403 `ghost_locked`), rendu ensuite, libre pour un jour passé ; `Cache-Control: private` ; la preuve de l'auteur
// ne sort pas. Tourne sur SQLite et sur libSQL.

const DAY = daysFromCivil(2026, 10, 30);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;
let D: DailyLevel;
let attendu: string;

beforeAll(() => {
  D = dailyLevel(DAY);
  attendu = encoderTrajectoire(echantillonnerTrajectoire(D.level, D.replay, D.medals.author));
}, 60_000);

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const route = (date = DATE) => `/api/jump/fantome-diamant?date=${date}`;

async function jumpApi() {
  const t = await makeApi({ seed: false, environment: "recette" });
  t.clock.now = NOON;
  return t;
}

/** Un résultat accepté : la course de l'auteur, envoyée par un joueur (les copies sont permises dans les tests : `allowCopies`). */
async function finish(t: Awaited<ReturnType<typeof jumpApi>>, n: number) {
  const r = await t.call(
    "POST",
    "/api/jump/submit",
    { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: D.code, name: `Joueur${n}` },
    as(n),
  );
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

describe(`fantôme Diamant de Jump (${TEST_DB})`, () => {
  it("le jour même : refusé sans identifiant et avant d'avoir fini (403 ghost_locked), rendu après un résultat accepté", async () => {
    const t = await jumpApi();
    const sans = await t.call("GET", route());
    expect(sans.status).toBe(403);
    expect(sans.body).toEqual({ error: "ghost_locked" });
    const pasFini = await t.call("GET", route(), undefined, as(1));
    expect(pasFini.status).toBe(403);
    expect(pasFini.body).toEqual({ error: "ghost_locked" });
    await finish(t, 1);
    const ok = await t.call("GET", route(), undefined, as(1));
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body).toEqual({
      date: DATE,
      levelId: D.id,
      ticks: D.medals.author,
      simVersion: JUMP_SIM_VERSION,
      generatorVersion: JUMP_GENERATOR_VERSION,
      trajectoire: attendu,
    });
    // Un autre joueur qui n'a pas fini n'en profite pas.
    expect((await t.call("GET", route(), undefined, as(2))).status).toBe(403);
  });

  it("la trajectoire rendue est celle de la preuve rejouée par le serveur : 30 points par seconde, de la durée du temps de l'auteur", async () => {
    const t = await jumpApi();
    await finish(t, 1);
    const r = await t.call("GET", route(), undefined, as(1));
    const traj = decoderTrajectoire(r.body.trajectoire);
    expect(traj.pas).toBe(TRAJECTOIRE_PAS);
    // Lot G1 : le Diamant est le seuil de la médaille (105 % du temps de l'auteur depuis la bascule du 30/10) : la trajectoire de l'auteur y est étirée.
    expect(D.medals.author).toBe(Math.ceil((D.authorTicks * 105) / 100));
    expect(r.body.ticks).toBe(D.medals.author);
    expect(trajectoireDuree(traj)).toBeGreaterThanOrEqual(D.medals.author);
    expect(trajectoireDuree(traj)).toBeLessThan(D.medals.author + TRAJECTOIRE_PAS);
    // Une trajectoire de quelques ko, bornée.
    expect(r.body.trajectoire.length).toBeLessThan(8_000);
  });

  it("un jour d'avant la bascule du lot G1 : le Diamant est le temps exact de l'auteur, la trajectoire n'est pas étirée", async () => {
    const jour = daysFromCivil(2026, 10, 29);
    const avant = dailyLevel(jour);
    expect(avant.medals.author).toBe(avant.authorTicks);
    const t = await jumpApi();
    t.clock.now = parisDayStart(jour + 1) + 12 * 3_600_000; // le lendemain : un jour passé, libre
    const r = await t.call("GET", route(formatDay(jour)));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.ticks).toBe(avant.authorTicks);
    expect(r.body.trajectoire).toBe(encoderTrajectoire(echantillonnerTrajectoire(avant.level, avant.replay)));
  });

  it("ne contient ni les entrées ni la preuve de l'auteur", async () => {
    const t = await jumpApi();
    await finish(t, 1);
    const r = await t.call("GET", route(), undefined, as(1));
    const texte = JSON.stringify(r.body);
    expect(Object.keys(r.body).sort()).toEqual(["date", "generatorVersion", "levelId", "simVersion", "ticks", "trajectoire"]);
    expect(texte).not.toContain(D.code);
    expect(texte).not.toContain("replay");
    expect(texte).not.toContain("preuve");
    expect(texte).not.toContain("inputs");
    // Aucune commande jouée : la réponse n'a pas les séries de la rediffusion (le test de R9 sur les fichiers servis reste vert : `apps/jump/test/productionSite.test.ts`).
    for (let i = 0; i + 24 <= D.code.length; i += 12) expect(texte, D.code.slice(i, i + 24)).not.toContain(D.code.slice(i, i + 24));
  });

  it("un jour passé est libre : sans identifiant ni résultat", async () => {
    const t = await jumpApi();
    t.clock.now = NOON + 24 * 3_600_000 + JUMP_GRACE_MS + 60_000; // le lendemain, après la grâce : le classement du jour est figé
    const r = await t.call("GET", route());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.trajectoire).toBe(attendu);
    const avecId = await t.call("GET", route(), undefined, as(9));
    expect(avecId.status).toBe(200);
  });

  it("pendant la grâce après minuit le jour est encore ouvert : il faut avoir fini", async () => {
    const t = await jumpApi();
    t.clock.now = NOON + 12 * 3_600_000 + 60_000; // minuit passé d'une minute, hier est encore ouvert
    expect((await t.call("GET", route(), undefined, as(1))).status).toBe(403);
  });

  it("Cache-Control: private et Vary: X-Player-Id, jamais un cache public (jour ouvert comme jour passé)", async () => {
    const t = await jumpApi();
    await finish(t, 1);
    const ouvert = await t.call("GET", route(), undefined, as(1));
    expect(ouvert.headers.get("cache-control")).toMatch(/^private/);
    expect(ouvert.headers.get("vary")).toContain("X-Player-Id");
    t.clock.now = NOON + 2 * 24 * 3_600_000;
    const passe = await t.call("GET", route());
    expect(passe.headers.get("cache-control")).toMatch(/^private/);
    expect(passe.headers.get("cache-control")).not.toMatch(/public/);
    expect(passe.headers.get("vary")).toContain("X-Player-Id");
  });

  it("un jour futur, une date illisible ou absente, une autre méthode : refusés", async () => {
    const t = await jumpApi();
    expect((await t.call("GET", route(formatDay(DAY + 1)), undefined, as(1))).body).toEqual({ error: "unknown_day" });
    expect((await t.call("GET", route("pas-une-date"))).body).toEqual({ error: "invalid_date" });
    expect((await t.call("GET", "/api/jump/fantome-diamant")).body).toEqual({ error: "invalid_date" });
    expect((await t.call("POST", route(), {}, as(1))).body).toEqual({ error: "method_not_allowed" });
  });

  it("gardé en mémoire : la même trajectoire, rendue sans nouveau calcul, pour tous les joueurs qui ont fini", async () => {
    const t = await jumpApi();
    await finish(t, 1);
    await finish(t, 2);
    const a = await t.call("GET", route(), undefined, as(1));
    const t0 = performance.now();
    const b = await t.call("GET", route(), undefined, as(2));
    const rapide = performance.now() - t0;
    expect(b.body).toEqual(a.body);
    expect(rapide).toBeLessThan(500);
  });

  it("n'écrit rien en base et ne journalise ni identifiant ni trajectoire", async () => {
    const logs: string[] = [];
    const t = await makeApi({ seed: false, environment: "recette", log: (_s: string, m: string, f?: Record<string, unknown>) => void logs.push(`${m} ${JSON.stringify(f ?? {})}`) } as never);
    t.clock.now = NOON;
    await finish(t, 1);
    const avant = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results");
    await t.call("GET", route(), undefined, as(1));
    const apres = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results");
    expect(apres).toEqual(avant);
    const texte = logs.join("\n");
    expect(texte).not.toContain(playerId(1));
    expect(texte).not.toContain(attendu);
  });
});
