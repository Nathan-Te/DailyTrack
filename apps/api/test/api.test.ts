import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, LAUNCH_DAY, SIM_VERSION, TICK_RATE, dailyTrackId, decodeReplay, encodeReplay, formatDay, medalsFor, replayRace } from "@cdj/sim";
import { DAY, DAY_MS, NOON, circuitOf, makeApi, pilotReplay, playerId } from "./helpers";

const DATE = formatDay(DAY);
// Quatre rediffusions valides de vitesses différentes : 30 est la plus rapide, 18 la plus lente.
const fast = pilotReplay(DAY, 0.9);
const mid = pilotReplay(DAY, 0.78);
const slow = pilotReplay(DAY, 0.65);
const slowest = pilotReplay(DAY, 0.55);

const submit = (t: Awaited<ReturnType<typeof makeApi>>, n: number, name: string, code: string, extra: Record<string, unknown> = {}) =>
  t.call("POST", "/api/submit", { playerId: playerId(n), name, date: DATE, replay: code, ...extra });

describe("les rediffusions de test", () => {
  it("ont des temps distincts, du plus rapide au plus lent", () => {
    expect(fast.finishMs).toBeLessThan(mid.finishMs);
    expect(mid.finishMs).toBeLessThan(slow.finishMs);
    expect(slow.finishMs).toBeLessThan(slowest.finishMs);
  });
});

describe("POST /api/submit", () => {
  it("rejoue la course et enregistre le temps qu'il a recalculé, premier au classement", async () => {
    const t = await makeApi();
    const r = await submit(t, 1, "Alice", fast.code);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ accepted: true, improved: true, ms: fast.finishMs, bestMs: fast.finishMs, rank: 1, participants: 1 });
    expect(r.body.splits).toHaveLength(circuitOf(DAY).track.gates.length - 1);
  });

  it("ignore un temps annoncé par le client : seul le rejeu fait foi", async () => {
    const t = await makeApi();
    const r = await submit(t, 1, "Alice", slow.code, { ms: 1, time: 1, finishMs: 1, splits: [1, 2, 3] });
    expect(r.status).toBe(200);
    expect(r.body.ms).toBe(slow.finishMs);
    expect(r.body.splits).not.toEqual([1, 2, 3]);
  });

  it("donne la médaille correspondant au temps rejoué", async () => {
    const t = await makeApi();
    const medals = medalsFor(circuitOf(DAY).authorMs);
    const r = await submit(t, 1, "Alice", fast.code);
    expect(r.body.medal).toBe(fast.finishMs <= medals.author ? "author" : fast.finishMs <= medals.gold ? "gold" : fast.finishMs <= medals.silver ? "silver" : "bronze");
  });

  it("deux joueurs, deux temps, un classement", async () => {
    const t = await makeApi();
    const b = await submit(t, 2, "Bob", slow.code);
    expect(b.body).toMatchObject({ rank: 1, participants: 1 });
    const a = await submit(t, 1, "Alice", fast.code);
    expect(a.body).toMatchObject({ rank: 1, participants: 2 });

    const board = await t.call("GET", `/api/day/${DATE}/leaderboard?player=${playerId(2)}`);
    expect(board.status).toBe(200);
    expect(board.body.participants).toBe(2);
    expect(board.body.top.map((r: { rank: number; name: string; ms: number }) => [r.rank, r.name, r.ms])).toEqual([
      [1, "Alice", fast.finishMs],
      [2, "Bob", slow.finishMs],
    ]);
    expect(board.body.me).toMatchObject({ rank: 2, name: "Bob", ms: slow.finishMs });
  });

  it("ne garde que le meilleur temps de chaque joueur", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", mid.code);
    const worse = await submit(t, 1, "Alice", slowest.code);
    expect(worse.body).toMatchObject({ accepted: true, improved: false, ms: slowest.finishMs, bestMs: mid.finishMs, rank: 1, participants: 1 });
    const better = await submit(t, 1, "Alice", fast.code);
    expect(better.body).toMatchObject({ improved: true, bestMs: fast.finishMs });
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.body.top).toHaveLength(1);
    expect(board.body.top[0].ms).toBe(fast.finishMs);
  });

  it("départage deux temps égaux par l'ordre d'arrivée", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", fast.code);
    t.clock.now += 5000;
    const b = await submit(t, 2, "Bob", fast.code);
    expect(b.body).toMatchObject({ ms: fast.finishMs, rank: 2, participants: 2 });
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.body.top.map((r: { name: string }) => r.name)).toEqual(["Alice", "Bob"]);
  });

  it("n'enregistre pas la rediffusion d'une course falsifiée au temps de l'original", async () => {
    const t = await makeApi();
    const tampered = structuredClone(fast.replay);
    const i = tampered.runs.findIndex((r, k) => k > tampered.runs.length / 3 && r.count > 20);
    tampered.runs[i]!.steer = tampered.runs[i]!.steer > 0 ? -64 : 64;
    const r = await submit(t, 1, "Mallory", encodeReplay(tampered));
    if (r.status === 200) expect(r.body.ms).not.toBe(fast.finishMs);
    else expect(r.status).toBe(422);
  });

  it("refuse une rediffusion qui ne franchit pas l'arrivée", async () => {
    const t = await makeApi();
    const cut = { ...fast.replay, runs: fast.replay.runs.slice(0, Math.floor(fast.replay.runs.length / 2)) };
    const r = await submit(t, 1, "Alice", encodeReplay(cut));
    expect(r.status).toBe(422);
    expect(r.body.error).toBe("not_finished");
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.participants).toBe(0);
  });

  it("refuse les rediffusions illisibles, d'une autre version ou d'un autre circuit", async () => {
    const t = await makeApi();
    expect((await submit(t, 1, "Alice", "pas une rediffusion !")).body.error).toBe("invalid_replay");
    expect((await submit(t, 1, "Alice", fast.code.slice(0, 30))).body.error).toBe("invalid_replay");
    const other = encodeReplay({ ...fast.replay, simVersion: SIM_VERSION + 1 });
    expect((await submit(t, 1, "Alice", other)).body.error).toBe("sim_version");
    // Ancienne version (avant la refonte de la conduite du lot 7) : refus clair, rien d'enregistré.
    const old = await submit(t, 1, "Alice", encodeReplay({ ...fast.replay, simVersion: SIM_VERSION - 1 }));
    expect(old.status).toBe(409);
    expect(old.body.error).toBe("sim_version");
    expect(old.body.message).toMatch(/ancienne version du jeu.*recharge la page/);
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.participants).toBe(0);
    const otherTrack = encodeReplay({ ...fast.replay, trackId: dailyTrackId(DAY - 1) });
    const r = await submit(t, 1, "Alice", otherTrack);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("track_mismatch");
  });

  it("valide les champs : joueur, pseudo, date, rediffusion", async () => {
    const t = await makeApi();
    const post = (body: unknown) => t.call("POST", "/api/submit", body);
    expect((await post({ playerId: "abc", name: "A", date: DATE, replay: fast.code })).body.error).toBe("invalid_player");
    expect((await post({ playerId: playerId(1), name: "<script>alert(1)</script>", date: DATE, replay: fast.code })).body.error).toBe("invalid_name");
    expect((await post({ playerId: playerId(1), name: "x".repeat(21), date: DATE, replay: fast.code })).body.error).toBe("invalid_name");
    expect((await post({ playerId: playerId(1), name: "   ", date: DATE, replay: fast.code })).body.error).toBe("invalid_name");
    expect((await post({ playerId: playerId(1), name: "Alice", date: "2026-02-30", replay: fast.code })).body.error).toBe("invalid_date");
    expect((await post({ playerId: playerId(1), name: "Alice", date: DATE })).body.error).toBe("invalid_replay");
    expect((await post({ playerId: playerId(1), date: DATE, replay: fast.code })).body.error).toBe("name_required");
  });

  it("accepte un pseudo avec accents, espaces et tirets, et normalise les espaces", async () => {
    const t = await makeApi();
    const r = await submit(t, 1, "  Zoé   d'Arc-2  ", fast.code);
    expect(r.status).toBe(200);
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].name).toBe("Zoé d'Arc-2");
  });

  it("ne demande plus le pseudo une fois connu", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", slow.code);
    const r = await t.call("POST", "/api/submit", { playerId: playerId(1), date: DATE, replay: fast.code });
    expect(r.status).toBe(200);
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].name).toBe("Alice");
  });
});

describe("jours ouverts et fermés", () => {
  it("refuse un jour futur, un jour avant le lancement, et un jour passé une fois le délai de grâce écoulé", async () => {
    const t = await makeApi();
    expect((await t.call("POST", "/api/submit", { playerId: playerId(1), name: "A", date: formatDay(DAY + 1), replay: fast.code })).status).toBe(404);
    expect((await t.call("POST", "/api/submit", { playerId: playerId(1), name: "A", date: formatDay(LAUNCH_DAY - 1), replay: fast.code })).status).toBe(404);
    // Le lendemain à 00:30 UTC : le classement de DAY est figé.
    t.clock.now = (DAY + 1) * DAY_MS + 30 * 60_000;
    const r = await submit(t, 1, "Alice", fast.code);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("day_closed");
  });

  it("laisse finir une course commencée juste avant minuit (10 minutes de grâce)", async () => {
    const t = await makeApi();
    t.clock.now = (DAY + 1) * DAY_MS + 5 * 60_000; // 00:05 UTC le lendemain
    const r = await submit(t, 1, "Alice", fast.code);
    expect(r.status).toBe(200);
    expect(r.body.rank).toBe(1);
  });

  it("garde le classement d'un jour passé consultable, figé", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", fast.code);
    t.clock.now = (DAY + 3) * DAY_MS;
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.status).toBe(200);
    expect(board.body.top[0].name).toBe("Alice");
  });
});

describe("fantômes", () => {
  it("sert la rediffusion du premier et celle du joueur juste devant, rejouables à l'identique", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", fast.code);
    await submit(t, 2, "Bob", slow.code);
    await submit(t, 3, "Carol", slowest.code);

    const first = await t.call("GET", `/api/day/${DATE}/ghost?kind=first`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ name: "Alice", rank: 1, ms: fast.finishMs, simVersion: SIM_VERSION });
    expect(replayRace(circuitOf(DAY).track, decodeReplay(first.body.replay)).finishMs).toBe(fast.finishMs);

    const ahead = await t.call("GET", `/api/day/${DATE}/ghost?kind=ahead&player=${playerId(3)}`);
    expect(ahead.body).toMatchObject({ name: "Bob", rank: 2, ms: slow.finishMs });
    expect(ahead.body.splits).toHaveLength(circuitOf(DAY).track.gates.length - 1);
  });

  it("n'a pas de fantôme devant le premier, ni sans temps, ni sans classement", async () => {
    const t = await makeApi();
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=first`)).status).toBe(404);
    await submit(t, 1, "Alice", fast.code);
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=ahead&player=${playerId(1)}`)).body.error).toBe("no_ghost");
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=ahead&player=${playerId(9)}`)).body.error).toBe("no_ghost");
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=nope`)).body.error).toBe("invalid_kind");
  });
});

describe("pseudo", () => {
  it("se change pour tous les temps du joueur", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", fast.code);
    const r = await t.call("PUT", "/api/player", { playerId: playerId(1), name: "Alicia" });
    expect(r.body).toEqual({ name: "Alicia" });
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard`)).body.top[0].name).toBe("Alicia");
    expect((await t.call("PUT", "/api/player", { playerId: playerId(1), name: "<b>" })).status).toBe(400);
  });

  it("ne crée jamais de joueur sans course : renommer un inconnu est refusé et ne stocke rien", async () => {
    const t = await makeApi();
    const r = await t.call("PUT", "/api/player", { playerId: playerId(7), name: "Fantôme" });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("unknown_player");
    expect(await t.db.first("SELECT 1 AS x FROM players")).toBeNull();
  });

  it("une course refusée ne crée pas de joueur non plus", async () => {
    const t = await makeApi();
    await submit(t, 8, "Mallory", "pas une rediffusion");
    const cut = { ...fast.replay, runs: fast.replay.runs.slice(0, 5) };
    await submit(t, 8, "Mallory", encodeReplay(cut));
    expect(await t.db.first("SELECT 1 AS x FROM players")).toBeNull();
  });
});

describe("classement", () => {
  it("est vide, sans calculer de circuit, quand personne n'a joué", async () => {
    const t = await makeApi({ seed: false });
    const r = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(r.body).toEqual({ date: DATE, participants: 0, top: [], me: null });
    expect(await t.db.first("SELECT 1 AS x FROM circuits")).toBeNull(); // rien n'a été généré
  });

  it("borne `limit` et compte les participants au-delà", async () => {
    const t = await makeApi();
    for (let n = 1; n <= 5; n++) await submit(t, n, `Joueur${n}`, [fast, mid, slow, slowest, slowest][n - 1]!.code);
    const r = await t.call("GET", `/api/day/${DATE}/leaderboard?limit=2`);
    expect(r.body.top).toHaveLength(2);
    expect(r.body.participants).toBe(5);
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard?limit=-4`)).body.top.length).toBeGreaterThan(0);
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard?limit=9999`)).body.top).toHaveLength(5);
  });
});

describe("circuit du jour côté serveur", () => {
  it("est généré au premier appel, mis en cache, et identique à celui du jeu", async () => {
    const t = await makeApi({ seed: false });
    const info = await t.call("GET", `/api/day/${DATE}`);
    const c = circuitOf(DAY);
    expect(info.body).toMatchObject({ date: DATE, number: c.number, trackId: c.track.id, authorMs: c.authorMs, attempt: c.attempt, palette: c.palette, simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION });
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM circuits"))!.n).toBe(1);
    // Une autre instance sur la même base relit le cache et accepte les mêmes rediffusions.
    const again = await makeApi({ db: t.db, seed: false });
    expect((await again.call("GET", `/api/day/${DATE}`)).body.trackId).toBe(c.track.id);
    expect((await submit(again, 1, "Alice", fast.code)).status).toBe(200);
  });

  it("rejouer une course coûte quelques dizaines de millisecondes", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice", fast.code); // chauffe
    const t0 = performance.now();
    for (let n = 2; n <= 6; n++) await submit(t, n, `Joueur${n}`, fast.code);
    const per = (performance.now() - t0) / 5;
    process.stderr.write(`\n[api] soumission avec rejeu : ${per.toFixed(1)} ms (course de ${(fast.finishMs / 1000).toFixed(1)} s = ${Math.round((fast.finishMs / 1000) * TICK_RATE)} pas)\n`);
    expect(per).toBeLessThan(150);
  });
});

describe("protocole", () => {
  it("répond à /api/health", async () => {
    const t = await makeApi();
    const r = await t.call("GET", "/api/health");
    expect(r.body).toEqual({ ok: true, simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, today: DATE });
  });

  it("autorise CORS et répond aux requêtes préalables", async () => {
    const t = await makeApi({ allowOrigin: "https://nathan-te.github.io" });
    const pre = await t.call("OPTIONS", "/api/submit");
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
    expect((await t.call("GET", "/api/health")).headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
  });

  it("refuse proprement les requêtes mal formées", async () => {
    const t = await makeApi();
    expect((await t.call("POST", "/api/submit", undefined, { raw: "pas du json" })).body.error).toBe("invalid_json");
    expect((await t.call("POST", "/api/submit", undefined, { raw: "[1,2]" })).body.error).toBe("invalid_json");
    expect((await t.call("GET", "/api/submit")).status).toBe(405);
    expect((await t.call("POST", `/api/day/${DATE}/leaderboard`)).status).toBe(405);
    expect((await t.call("GET", "/api/nimporte")).status).toBe(404);
    expect((await t.call("GET", "/api/day/demain/leaderboard")).body.error).toBe("invalid_date");
  });

  it("refuse un corps trop volumineux, déclaré ou non", async () => {
    const t = await makeApi();
    const huge = JSON.stringify({ playerId: playerId(1), name: "A", date: DATE, replay: "A".repeat(500_000) });
    expect((await t.call("POST", "/api/submit", undefined, { raw: huge })).status).toBe(413);
    expect((await t.call("POST", "/api/submit", undefined, { raw: huge, headers: { "Content-Length": "10" } })).status).toBe(413);
  });
});

describe("limitation de débit", () => {
  it("bloque un joueur qui martèle l'API, avec Retry-After, avant tout rejeu", async () => {
    const t = await makeApi({ limits: { windowMs: 600_000, perClient: 100, perPlayer: 3 } });
    for (let i = 0; i < 3; i++) expect((await submit(t, 1, "Alice", "garbage")).status).toBe(400);
    const blocked = await submit(t, 1, "Alice", fast.code);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // Un autre joueur n'est pas touché, et la fenêtre suivante repart de zéro.
    expect((await submit(t, 2, "Bob", fast.code)).status).toBe(200);
    t.clock.now += 600_000;
    expect((await submit(t, 1, "Alice", fast.code)).status).toBe(200);
  });

  it("bloque une adresse qui multiplie les identités, sans jamais stocker l'adresse en clair", async () => {
    const t = await makeApi({ limits: { windowMs: 600_000, perClient: 4, perPlayer: 100 }, rateSalt: "sel" });
    for (let n = 1; n <= 4; n++) expect((await submit(t, n, `Joueur${n}`, "garbage")).status).toBe(400);
    expect((await submit(t, 5, "Joueur5", fast.code)).status).toBe(429);
    const keys = await t.db.all<{ key: string }>("SELECT key FROM rate");
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k.key).not.toContain("203.0.113.7");
    // Une autre adresse passe.
    expect((await t.call("POST", "/api/submit", { playerId: playerId(6), name: "Joueur6", date: DATE, replay: fast.code }, { clientKey: "198.51.100.2" })).status).toBe(200);
  });
});

it("l'horloge de test est bien réglée sur le jour de test", () => {
  expect(NOON).toBe(DAY * DAY_MS + 12 * 3_600_000);
});
