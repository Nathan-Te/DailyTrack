import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, type DailyLevel } from "@cdj/jump-sim";
import { HEALTH_FIELDS, isLocalBase, readOnlyFetch, readOnlySmoke, smokeRefusal, smokeSummary, type FetchFn } from "../scripts/smokeRead";
import { makeApi, parisDayStart, playerId, TEST_DB, verifierErreur, type TestApi } from "./helpers";

// Lot P4 (plateforme) : `smoke --lecture-seule`, la vérification de la production après chaque déploiement. Elle **n'écrit jamais rien**
// (des GET seulement, sans identifiant de joueur : la base est identique avant et après), et c'est **le seul mode permis contre la production**
// (le mode complet, qui crée des joueurs « Fumée », refuse une cible de production qui n'est pas locale). Tourne sur SQLite et sur libSQL.

const DAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(DAY);
const NOON = parisDayStart(DAY) + 12 * 3_600_000;
const BASE = "https://cdj-api-exemple.a.run.app";

let D: DailyLevel;
beforeAll(() => {
  D = dailyLevel(DAY);
});

/** Le `fetch` d'un serveur en mémoire (le vrai `createApi`), qui note chaque méthode envoyée. */
function fetchOf(t: TestApi, methods: string[]): FetchFn {
  return async (url, init = {}) => {
    methods.push((init.method ?? "GET").toUpperCase());
    const res = await t.api.handle(new Request(url.replace(BASE, "http://api.test"), init), { clientKey: "198.51.100.9" });
    if (res.status >= 400) verifierErreur(res.status, await res.clone().json()); // lot I1 : une erreur a un code de la liste
    return res;
  };
}

/** Tout le contenu de la base, table par table (pour vérifier qu'il n'a pas bougé). */
async function snapshot(t: TestApi): Promise<Record<string, unknown[]>> {
  const tables = await t.db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY name");
  const out: Record<string, unknown[]> = {};
  for (const { name } of tables) out[name] = await t.db.all(`SELECT * FROM ${name} ORDER BY 1, 2`);
  return out;
}

/** Un serveur « de production » avec un joueur classé et ses vies du jour (le niveau du jour déjà calculé, comme en vrai). */
async function productionLike(): Promise<TestApi> {
  const t = await makeApi({ seed: false, environment: "production" });
  t.clock.now = NOON;
  const sub = await t.call("POST", "/api/jump/submit", { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: D.code, name: "Vraie" }, { headers: { "X-Player-Id": playerId(1) } });
  expect(sub.status).toBe(200);
  return t;
}

describe(`smoke --lecture-seule (${TEST_DB})`, () => {
  it("contre un serveur de production : tout est vert, des GET seulement, et la base est identique avant et après", async () => {
    const t = await productionLike();
    // Une première lecture de chaque route remplit les caches du serveur (niveau du jour, carte) comme le ferait le premier joueur venu.
    await readOnlySmoke(BASE, fetchOf(t, []), { expectEnvironment: "production" });
    const before = await snapshot(t);
    const methods: string[] = [];
    const checks = await readOnlySmoke(BASE, fetchOf(t, methods), { expectEnvironment: "production" });
    expect(checks.filter((c) => !c.ok), JSON.stringify(checks, null, 1)).toEqual([]);
    expect(checks.map((c) => c.route)).toEqual([
      "/api/health",
      "/api/jump/info",
      `/api/jump/day/${DATE}`,
      `/api/jump/day/${DATE}/board`,
      `/api/jump/day/${DATE}/ghost/first`,
      `/api/jump/day/${DATE}/deaths`,
      `/api/jump/day/${DATE}/bundle`,
      `/api/jump/day/${formatDay(DAY - 1)}/bundle`,
    ]);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
    expect(await snapshot(t)).toEqual(before);
    expect((before.players ?? []).length).toBe(1); // aucun joueur « Fumée »
  });

  it("même sur une base neuve, l'outil n'écrit ni joueur, ni temps, ni vie, ni compteur de débit (seuls les caches du serveur se remplissent)", async () => {
    const t = await makeApi({ seed: false, environment: "production" });
    t.clock.now = NOON;
    await readOnlySmoke(BASE, fetchOf(t, []), { expectEnvironment: "production" });
    for (const table of ["players", "jump_results", "jump_lives", "rate", "results", "revoked_codes"]) {
      expect((await t.db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n, table).toBe(0);
    }
  });

  it("le fetch de la lecture seule refuse d'écrire : POST, PUT, DELETE, un corps ou un identifiant de joueur ne partent jamais", async () => {
    const sent: string[] = [];
    const f = readOnlyFetch(async (url, init) => {
      sent.push(`${init?.method} ${url}`);
      return new Response("{}");
    });
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) await expect(f(`${BASE}/api/jump/submit`, { method, body: "{}" })).rejects.toThrow(/refusé/);
    await expect(f(`${BASE}/api/jump/day/${DATE}/bundle`, { method: "GET", headers: { "X-Player-Id": playerId(1) } })).rejects.toThrow(/identifiant/);
    await expect(f(`${BASE}/api/health`, { method: "GET", body: "x" })).rejects.toThrow(/corps/);
    expect(sent).toEqual([]);
    await f(`${BASE}/api/health`);
    expect(sent).toEqual([`GET ${BASE}/api/health`]);
  });

  it("garde : seul --lecture-seule est permis contre la production ; le mode complet la refuse (sauf l'image locale de la CI)", () => {
    expect(smokeRefusal({ base: BASE, environment: "production", readOnly: true })).toBeNull();
    expect(smokeRefusal({ base: BASE, environment: "production", readOnly: false })).toMatch(/production.*--lecture-seule/s);
    expect(smokeRefusal({ base: "http://localhost:8080", environment: "production", readOnly: false })).toBeNull();
    expect(smokeRefusal({ base: "http://127.0.0.1:8080/", environment: "production", readOnly: false })).toBeNull();
    expect(smokeRefusal({ base: BASE, environment: "recette", readOnly: false })).toBeNull();
    expect(smokeRefusal({ base: BASE, environment: "recette", readOnly: true })).toBeNull();
    expect(isLocalBase("http://localhost.evil.example")).toBe(false);
  });

  it("un échec dit quelle route et quelle réponse ; l'environnement attendu est vérifié ; le résumé donne la commande de retour arrière", async () => {
    const t = await makeApi({ seed: false, environment: "recette" });
    t.clock.now = NOON;
    const checks = await readOnlySmoke(BASE, fetchOf(t, []), { expectEnvironment: "production" });
    const info = checks.find((c) => c.route === "/api/jump/info")!;
    expect(info.ok).toBe(false);
    expect(info.status).toBe(200);
    expect(info.detail).toMatch(/environnement recette/);
    expect(info.detail).toMatch(/"environment":"recette"/);
    const summary = smokeSummary(BASE, checks, "gcloud run services update-traffic cdj-api --to-revisions=<révision>=100");
    expect(summary).toMatch(/❌ Vérification de la production : 1 échec/);
    expect(summary).toContain("`/api/jump/info`");
    expect(summary).toContain("gcloud run services update-traffic");
    // Une route en panne (500) : son code et son corps.
    const broken: FetchFn = async (url, init) => (url.endsWith("/deaths") ? new Response('{"error":"internal"}', { status: 500 }) : fetchOf(t, [])(url, init));
    const failed = (await readOnlySmoke(BASE, broken)).filter((c) => !c.ok);
    expect(failed.map((c) => [c.route, c.status])).toEqual([[`/api/jump/day/${DATE}/deaths`, 500]]);
    expect(failed[0]!.detail).toContain('{"error":"internal"}');
    expect(smokeSummary(BASE, await readOnlySmoke(BASE, fetchOf(t, [])), "x")).toMatch(/✅/);
  });

  it("/api/health : les champs n'ont pas changé (une clé de plus ou de moins fait échouer)", async () => {
    const t = await productionLike();
    const health = (await t.call("GET", "/api/health")).body as Record<string, unknown>;
    expect(Object.keys(health).sort()).toEqual([...HEALTH_FIELDS].sort());
    const extra: FetchFn = async (url, init) => {
      const res = await fetchOf(t, [])(url, init);
      if (!url.endsWith("/api/health")) return res;
      return new Response(JSON.stringify({ ...(await res.json()), nouveau: 1 }), { status: 200 });
    };
    expect((await readOnlySmoke(BASE, extra)).find((c) => c.route === "/api/health")!.ok).toBe(false);
  });
});
