import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/sim";
import { DAY, TEST_DB, makeApi, pilotReplay, playerId } from "./helpers";

// Lot 55 : choisir ses fantômes dans le classement. Chaque ligne du classement du jour porte la référence publique de son joueur (`ref`, déjà gardée par `players`) ;
// `GET /api/day/<date>/run/<ref>` rend la rediffusion de cette ligne. Jamais l'identifiant secret ; aucune donnée gardée de plus. SQLite et libSQL.
const DATE = formatDay(DAY);
const REF = /^[0-9a-f]{12}$/;
const fast = pilotReplay(DAY, 0.9);
const slow = pilotReplay(DAY, 0.65);

async function deuxJoueurs() {
  const t = await makeApi();
  const a = playerId(5501);
  const b = playerId(5502);
  expect((await t.call("POST", "/api/submit", { playerId: a, name: "Rapide", date: DATE, replay: fast.code })).status).toBe(200);
  expect((await t.call("POST", "/api/submit", { playerId: b, name: "Lent", date: DATE, replay: slow.code })).status).toBe(200);
  return { t, a, b };
}

describe(`la rediffusion d'une ligne du classement (${TEST_DB})`, () => {
  it("les lignes du classement portent une référence publique de 12 hexadécimaux, jamais l'identifiant secret", async () => {
    const { t, a, b } = await deuxJoueurs();
    const r = await t.call("GET", `/api/day/${DATE}/leaderboard?limit=10`);
    expect(r.status).toBe(200);
    expect(r.body.top).toHaveLength(2);
    for (const row of r.body.top) expect(row.ref).toMatch(REF);
    expect(r.body.top[0].ref).not.toBe(r.body.top[1].ref);
    const texte = JSON.stringify(r.body);
    expect(texte).not.toContain(a);
    expect(texte).not.toContain(b);
  });

  it("rend la rediffusion, le pseudo, le rang, la voiture et la version, sans identifiant et sans X-Player-Id", async () => {
    const { t, a, b } = await deuxJoueurs();
    const refs = (await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top.map((x: { ref: string }) => x.ref);
    const premier = await t.call("GET", `/api/day/${DATE}/run/${refs[0]}`);
    expect(premier.status).toBe(200);
    expect(premier.body).toMatchObject({ ref: refs[0], name: "Rapide", rank: 1 });
    expect(premier.body.replay).toBe(fast.code);
    expect(premier.body.simVersion).toBeGreaterThan(0);
    expect(premier.body.voiture).toBeTruthy();
    expect(premier.body.splits).toBeInstanceOf(Array);
    const second = await t.call("GET", `/api/day/${DATE}/run/${refs[1]}`);
    expect(second.body).toMatchObject({ name: "Lent", rank: 2 });
    expect(second.body.replay).toBe(slow.code);
    for (const r of [premier, second]) {
      const texte = JSON.stringify(r.body);
      expect(texte).not.toContain(a);
      expect(texte).not.toContain(b);
    }
    // l'identité de celui qui lit n'est pas utilisée : la même réponse avec ou sans X-Player-Id
    const avec = await t.call("GET", `/api/day/${DATE}/run/${refs[0]}`, undefined, { headers: { "X-Player-Id": b } });
    expect(avec.body).toEqual(premier.body);
  });

  it("une référence mal formée : 400 invalid_ref ; inconnue ou d'un autre jour : 404 no_ghost", async () => {
    const { t } = await deuxJoueurs();
    const ref = (await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].ref as string;
    for (const mauvaise of ["zz", "0123456789abcdeg", "0123456789a", ref + "0"]) {
      const r = await t.call("GET", `/api/day/${DATE}/run/${mauvaise}`);
      expect(r.status, mauvaise).toBe(400);
      expect(r.body.error).toBe("invalid_ref");
    }
    expect((await t.call("GET", `/api/day/${DATE}/run/000000000000`)).body.error).toBe("no_ghost");
    const veille = formatDay(DAY - 1);
    const autre = await t.call("GET", `/api/day/${veille}/run/${ref}`);
    expect(autre.status).toBe(404);
    expect(autre.body.error).toBe("no_ghost");
    expect((await t.call("GET", `/api/day/%E0/run/${ref}`)).body.error).toBe("invalid_date");
  });

  it("un joueur masqué n'a ni référence au classement ni rediffusion", async () => {
    const { t, a } = await deuxJoueurs();
    const ref = (await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].ref as string;
    await t.db.run("UPDATE results SET hidden = 1 WHERE player_id = ?", [a]);
    expect((await t.call("GET", `/api/day/${DATE}/run/${ref}`)).status).toBe(404);
    const lb = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(lb.body.top.map((x: { name: string }) => x.name)).toEqual(["Lent"]);
  });

  it("une lecture n'écrit rien dans la base (aucune donnée gardée de plus)", async () => {
    const { t } = await deuxJoueurs();
    const ref = (await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].ref as string;
    const compte = async () => (await t.db.first<{ n: number }>("SELECT (SELECT COUNT(*) FROM results) + (SELECT COUNT(*) FROM players) + (SELECT COUNT(*) FROM rate) AS n"))!.n;
    await t.call("GET", `/api/day/${DATE}/run/${ref}`); // première lecture : peut créer le circuit en cache
    const avant = await compte();
    await t.call("GET", `/api/day/${DATE}/run/${ref}`);
    expect(await compte()).toBe(avant);
  });

  it("POST sur la route : 405", async () => {
    const { t } = await deuxJoueurs();
    expect((await t.call("POST", `/api/day/${DATE}/run/000000000000`, {})).status).toBe(405);
  });
});
