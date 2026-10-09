import { describe, expect, it } from "vitest";
import { SIM_VERSION, decodeReplay, encodeReplay, replayRace, salonSessionEnd, salonSessionStart, salonTrackId } from "@cdj/sim";
import { createApi } from "../src/api";
import { MAX_GHOST_REFS, PRESENCE_MS, SALON_GRACE_MS, SALON_RETENTION_MS } from "../src/salon";
import { NOON, SALON_SESSION, SESSION_MS, makeApi, playerId, salonCircuitOf, salonReplay, seedSalonCircuit, type TestApi } from "./helpers";

// Le Salon côté serveur (lot 27) : mêmes exigences que le classement du jour — seul le temps rejoué compte.
const S = SALON_SESSION;
const START = salonSessionStart(S);
const END = salonSessionEnd(S);
const fast = salonReplay(S, 0.9);
const mid = salonReplay(S, 0.78);
const slow = salonReplay(S, 0.65);
const slowest = salonReplay(S, 0.55);

async function salonApi(options: Parameters<typeof makeApi>[0] = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, ...options });
  await seedSalonCircuit(t.db, S);
  return t;
}
const submit = (t: TestApi, n: number, name: string, code: string, extra: Record<string, unknown> = {}, session = S) =>
  t.call("POST", `/api/salon/${session}/submit`, { playerId: playerId(n), name, replay: code, ...extra }, { clientKey: `203.0.113.${n}` });
/** Fait avancer l'horloge au-delà du délai minimal entre deux envois du même joueur. */
const wait = (t: TestApi, ms = 6000) => void (t.clock.now += ms);

describe("les rediffusions de test du Salon", () => {
  it("ont des temps distincts, du plus rapide au plus lent, sur le circuit de la session", () => {
    expect(fast.finishMs).toBeLessThan(mid.finishMs);
    expect(mid.finishMs).toBeLessThan(slow.finishMs);
    expect(slow.finishMs).toBeLessThan(slowest.finishMs);
    expect(fast.replay.trackId).toBe(salonTrackId(S));
    expect(NOON).toBe(START); // l'horloge de test est au début de la session
  });
});

describe("GET /api/salon/now", () => {
  it("donne l'heure du serveur, la session en cours, son circuit et les présents", async () => {
    const t = await salonApi();
    const r = await t.call("GET", `/api/salon/now?player=${playerId(1)}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ serverMs: NOON, session: S, startMs: START, endMs: END, trackId: salonTrackId(S), players: 1 });
    t.clock.now += 5000;
    await t.call("GET", `/api/salon/now?player=${playerId(2)}`);
    expect((await t.call("GET", "/api/salon/now")).body).toMatchObject({ serverMs: NOON + 5000, players: 2 }); // sans joueur : n'ajoute personne
  });

  it("compte comme présents les joueurs vus dans les 30 dernières secondes, par empreinte seulement", async () => {
    const t = await salonApi();
    await t.call("GET", `/api/salon/now?player=${playerId(1)}`);
    t.clock.now += PRESENCE_MS - 1000;
    await t.call("GET", `/api/salon/${S}/board?player=${playerId(2)}`); // le classement compte aussi comme une visite
    expect((await t.call("GET", "/api/salon/now")).body.players).toBe(2);
    t.clock.now += 2000; // le premier a plus de 30 s : parti
    expect((await t.call("GET", "/api/salon/now")).body.players).toBe(1);
    // Rien d'autre n'est conservé : ni identifiant ni adresse en clair.
    const rows = await t.db.all<{ key: string }>("SELECT key FROM salon_presence");
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.key).toMatch(/^pr:[0-9a-f]{16}$/);
    expect(JSON.stringify(rows)).not.toContain(playerId(1));
  });

  it("refuse un identifiant de joueur invalide et une mauvaise méthode", async () => {
    const t = await salonApi();
    expect((await t.call("GET", "/api/salon/now?player=1' OR '1'='1")).status).toBe(400);
    expect((await t.call("POST", "/api/salon/now", {})).status).toBe(405);
    expect((await t.call("GET", "/api/salon/%E0%A4%A/board")).status).toBe(400); // adresse mal encodée : une erreur claire, pas un 500
  });

  it("suit SALON_MINUTES (tests et essais locaux) et refuse une valeur hors limites", async () => {
    const t = await makeApi({ seed: false, salonMinutes: 1 });
    const r = await t.call("GET", "/api/salon/now");
    expect(r.body.endMs - r.body.startMs).toBe(60_000);
    expect(r.body.session).toBe(Math.floor(NOON / 60_000));
    expect((await t.call("GET", "/api/health")).body.salonMinutes).toBe(1);
    expect(() => createApi({ db: t.db, salonMinutes: 0 })).toThrow(/SALON_MINUTES/);
    expect(() => createApi({ db: t.db, salonMinutes: 90 })).toThrow(/SALON_MINUTES/);
    expect(() => createApi({ db: t.db, salonMinutes: Number.NaN })).toThrow(/SALON_MINUTES/);
  });
});

describe("POST /api/salon/<session>/submit", () => {
  it("rejoue la course, enregistre le temps recalculé et classe le joueur", async () => {
    const t = await salonApi();
    const r = await submit(t, 1, "Alice", fast.code);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ accepted: true, improved: true, ms: fast.finishMs, bestMs: fast.finishMs, rank: 1, participants: 1 });
    expect(r.body.board).toMatchObject({ session: S, participants: 1, me: { rank: 1, name: "Alice", ms: fast.finishMs, gap: 0, mine: true } });
    expect(r.body.board.rows).toHaveLength(1);
    expect(r.body.board.rows[0].mine).toBe(true);
  });

  it("ignore un temps annoncé par le client : seul le rejeu fait foi", async () => {
    const t = await salonApi();
    const r = await submit(t, 1, "Alice", slow.code, { ms: 1, time: 1, finishMs: 1, splits: [1, 2, 3] });
    expect(r.status).toBe(200);
    expect(r.body.ms).toBe(slow.finishMs);
    const ghost = (await t.call("GET", `/api/salon/${S}/ghosts?refs=${r.body.board.me.ref}`)).body.ghosts[0];
    expect(ghost.ms).toBe(slow.finishMs);
    expect(ghost.splits).not.toEqual([1, 2, 3]);
  });

  it("deux joueurs, deux temps, un classement (écarts au premier, ta ligne marquée)", async () => {
    const t = await salonApi();
    await submit(t, 2, "Bob", slow.code);
    wait(t, 1000);
    const a = await submit(t, 1, "Alice", fast.code);
    expect(a.body).toMatchObject({ rank: 1, participants: 2 });
    const forBob = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(2)}`)).body;
    expect(forBob.rows.map((r: { rank: number; name: string; ms: number; gap: number }) => [r.rank, r.name, r.ms, r.gap])).toEqual([
      [1, "Alice", fast.finishMs, 0],
      [2, "Bob", slow.finishMs, slow.finishMs - fast.finishMs],
    ]);
    expect(forBob.me).toMatchObject({ rank: 2, name: "Bob" });
    expect(forBob.rows.filter((r: { mine?: boolean }) => r.mine).map((r: { name: string }) => r.name)).toEqual(["Bob"]);
    const anonymous = (await t.call("GET", `/api/salon/${S}/board`)).body;
    expect(anonymous.me).toBeNull();
    expect(anonymous.rows.some((r: { mine?: boolean }) => r.mine)).toBe(false);
  });

  it("garde le meilleur temps de chaque joueur et ne l'améliore que s'il est battu", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", mid.code);
    const v1 = (await t.call("GET", `/api/salon/${S}/board`)).body.version;
    wait(t);
    const worse = await submit(t, 1, "Alice", slowest.code);
    expect(worse.body).toMatchObject({ improved: false, ms: slowest.finishMs, bestMs: mid.finishMs, rank: 1, participants: 1 });
    expect((await t.call("GET", `/api/salon/${S}/board`)).body.version).toBe(v1); // rien n'a changé : pas de rechargement
    wait(t);
    const better = await submit(t, 1, "Alice", fast.code);
    expect(better.body).toMatchObject({ improved: true, ms: fast.finishMs, bestMs: fast.finishMs, participants: 1 });
    const board = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(1)}`)).body;
    expect(board.version).toBeGreaterThan(v1);
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0].ms).toBe(fast.finishMs);
    // La rediffusion gardée est celle du meilleur temps.
    const ghost = (await t.call("GET", `/api/salon/${S}/ghosts?refs=${board.me.ref}`)).body.ghosts[0];
    expect(ghost.replay).toBe(fast.code);
  });

  it("à temps égal, le premier arrivé garde la place", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    wait(t, 1000);
    const b = await submit(t, 2, "Bob", fast.code);
    expect(b.body).toMatchObject({ rank: 2, ms: fast.finishMs });
  });

  it("un pseudo mémorisé (course du jour ou du Salon) suffit ; un joueur inconnu doit en choisir un", async () => {
    const t = await salonApi();
    const anon = await t.call("POST", `/api/salon/${S}/submit`, { playerId: playerId(1), replay: fast.code });
    expect(anon.status).toBe(400);
    expect(anon.body.error).toBe("name_required");
    expect(await t.db.first("SELECT id FROM players")).toBeNull(); // un joueur n'existe qu'après une course valide
    await submit(t, 1, "Alice", fast.code);
    wait(t);
    const again = await t.call("POST", `/api/salon/${S}/submit`, { playerId: playerId(1), replay: slow.code });
    expect(again.status).toBe(200);
    expect(again.body.board.me.name).toBe("Alice");
  });

  it("un joueur n'existe qu'après une course valide : une rediffusion refusée ne crée rien", async () => {
    const t = await salonApi();
    const r = await submit(t, 1, "Alice", "AAAA");
    expect(r.status).toBe(400);
    expect(await t.db.first("SELECT id FROM players")).toBeNull();
    expect(await t.db.first("SELECT session FROM salon_runs")).toBeNull();
  });

  it("refuse une rediffusion falsifiée : tronquée, ou d'un autre circuit, ou d'une autre version de la physique", async () => {
    const t = await salonApi();
    // Commandes coupées avant la ligne d'arrivée : le rejeu ne finit pas, le serveur n'enregistre rien.
    const cut = encodeReplay({ ...fast.replay, runs: fast.replay.runs.slice(0, Math.max(1, fast.replay.runs.length >> 3)) });
    const truncated = await submit(t, 1, "Alice", cut);
    expect(truncated.status).toBe(422);
    expect(truncated.body.error).toBe("not_finished");
    wait(t);
    // Le circuit d'une autre session (ou d'un jour) n'est pas celui-ci.
    const other = await submit(t, 1, "Alice", encodeReplay({ ...fast.replay, trackId: salonTrackId(S + 1) }));
    expect(other.status).toBe(409);
    expect(other.body.error).toBe("track_mismatch");
    wait(t);
    const day = await submit(t, 1, "Alice", encodeReplay({ ...fast.replay, trackId: "jour-2026-10-14-g15" }));
    expect(day.body.error).toBe("track_mismatch");
    wait(t);
    // Enregistrée avec une autre physique : les mêmes commandes ne donneraient pas le même temps.
    const old = await submit(t, 1, "Alice", encodeReplay({ ...fast.replay, simVersion: SIM_VERSION - 1 }));
    expect(old.status).toBe(409);
    expect(old.body.error).toBe("sim_version");
    wait(t);
    // Du texte qui n'est pas une rediffusion.
    for (const junk of ["", "!!!", "x".repeat(500)]) {
      const r = await submit(t, 1, "Alice", junk);
      expect([400]).toContain(r.status);
      wait(t);
    }
    expect(await t.db.first("SELECT session FROM salon_runs")).toBeNull();
    expect(await t.db.first("SELECT id FROM players")).toBeNull();
    // Et la bonne passe encore : rien n'a été abîmé.
    expect((await submit(t, 1, "Alice", fast.code)).status).toBe(200);
  });

  it("le temps enregistré est celui du rejeu : les mêmes commandes donnent le même temps ici et dans la simulation", async () => {
    const t = await salonApi();
    const r = await submit(t, 1, "Alice", mid.code);
    expect(r.body.ms).toBe(replayRace(salonCircuitOf(S).track, decodeReplay(mid.code)).finishMs);
  });

  it("accepte une course finie dans la minute qui suit la fin de la session, refuse après et avant le début", async () => {
    const t = await salonApi();
    t.clock.now = END + SALON_GRACE_MS - 1;
    expect((await submit(t, 1, "Alice", fast.code)).status).toBe(200); // commencée avant la fin, envoyée juste dans la minute
    t.clock.now = END + SALON_GRACE_MS + 1;
    const late = await submit(t, 2, "Bob", fast.code);
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({ error: "session_closed" });
    expect(late.body.message).toMatch(/terminée/);
    t.clock.now = END - 60_000;
    const future = await submit(t, 3, "Carole", fast.code, {}, S + 1);
    expect(future.status).toBe(409);
    expect(future.body.error).toBe("session_future");
    expect(await t.db.first("SELECT id FROM players WHERE name = 'Bob' OR name = 'Carole'")).toBeNull();
  });

  it("refuse un pseudo invalide (rien n'est enregistré), un corps invalide et une session absurde", async () => {
    const t = await salonApi();
    for (const name of ["<b>Alice</b>", "", " ", "x".repeat(21), 42, "Al\u0000ice"]) {
      const r = await submit(t, 1, name as string, fast.code);
      expect(r.status, JSON.stringify(name)).toBe(400);
      wait(t);
    }
    expect((await t.call("POST", `/api/salon/${S}/submit`, undefined, { raw: "pas du json" })).status).toBe(400);
    expect((await t.call("POST", `/api/salon/${S}/submit`, [1, 2])).status).toBe(400);
    expect((await t.call("POST", `/api/salon/${S}/submit`, { playerId: "nope", name: "Alice", replay: fast.code })).body.error).toBe("invalid_player");
    expect((await t.call("POST", `/api/salon/${S}/submit`, { playerId: playerId(1), name: "Alice" })).body.error).toBe("invalid_replay");
    for (const bad of ["abc", "-1", "1.5", "1e3", "99999999999", "0x10"]) {
      expect([400, 404], bad).toContain((await t.call("POST", `/api/salon/${bad}/submit`, { playerId: playerId(1), name: "Alice", replay: fast.code })).status);
    }
    expect((await t.call("GET", `/api/salon/${S}/submit`)).status).toBe(405);
  });

  it("refuse un corps énorme sans rien rejouer", async () => {
    const t = await salonApi();
    const r = await t.call("POST", `/api/salon/${S}/submit`, undefined, { raw: JSON.stringify({ playerId: playerId(1), name: "Alice", replay: "A".repeat(500_000) }) });
    expect(r.status).toBe(413);
  });

  it("génère lui-même le circuit de la session s'il n'est pas en cache, puis le garde (et le relit après un redémarrage)", async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health"); // crée les tables
    expect(await t.db.first("SELECT session FROM salon_circuits")).toBeNull();
    expect((await submit(t, 1, "Alice", fast.code)).body.ms).toBe(fast.finishMs);
    const row = await t.db.first<{ session: number; track_id: string; spec: string }>("SELECT session, track_id, spec FROM salon_circuits");
    expect(row).toMatchObject({ session: S, track_id: salonTrackId(S), spec: salonCircuitOf(S).spec });
    // Un autre serveur (même base, mémoire vide) rejoue sur le circuit gardé, sans le régénérer.
    const restarted = createApi({ db: t.db, now: () => t.clock.now });
    t.clock.now += 6000;
    const res = await restarted.handle(new Request(`http://api.test/api/salon/${S}/submit`, { method: "POST", body: JSON.stringify({ playerId: playerId(2), name: "Bob", replay: mid.code }) }), { clientKey: "198.51.100.2" });
    expect((await res.json()).ms).toBe(mid.finishMs);
  });

  it("n'enregistre pas la course du Salon au classement du jour (ni l'inverse)", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    expect(await t.db.first("SELECT day FROM results")).toBeNull();
    expect((await t.call("GET", "/api/health")).status).toBe(200);
  });
});

describe("débit", () => {
  it("au plus un envoi toutes les 5 s par joueur, même avec des rediffusions invalides", async () => {
    const t = await salonApi();
    expect((await submit(t, 1, "Alice", fast.code)).status).toBe(200);
    t.clock.now += 4900;
    const tooFast = await submit(t, 1, "Alice", slow.code);
    expect(tooFast.status).toBe(429);
    expect(tooFast.body.error).toBe("too_fast");
    expect(Number(tooFast.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    t.clock.now += 100;
    expect((await submit(t, 1, "Alice", slow.code)).status).toBe(200);
    // Un autre joueur n'est pas gêné.
    expect((await submit(t, 2, "Bob", slow.code)).status).toBe(200);
    // Un envoi refusé pour son contenu compte aussi (sinon on spammerait des rediffusions invalides sans limite).
    t.clock.now += 6000;
    expect((await submit(t, 3, "Carole", "AAAA")).status).toBe(400);
    expect((await submit(t, 3, "Carole", fast.code)).status).toBe(429);
  });

  it("limite par adresse avant tout rejeu", async () => {
    const t = await salonApi({ salonLimits: { submitsPerClient: 3 } });
    const same = (n: number) => t.call("POST", `/api/salon/${S}/submit`, { playerId: playerId(n), name: `Joueur ${n}`, replay: "AAAA" }, { clientKey: "198.51.100.9" });
    expect((await same(1)).status).toBe(400);
    expect((await same(2)).status).toBe(400);
    expect((await same(3)).status).toBe(400);
    const blocked = await same(4);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");
    // Une autre adresse n'est pas touchée.
    expect((await t.call("POST", `/api/salon/${S}/submit`, { playerId: playerId(5), name: "Eve", replay: "AAAA" }, { clientKey: "198.51.100.10" })).status).toBe(400);
  });

  it("limite aussi les lectures par adresse", async () => {
    const t = await salonApi({ salonLimits: { readsPerClient: 5 } });
    for (let i = 0; i < 5; i++) expect((await t.call("GET", `/api/salon/${S}/board`, undefined, { clientKey: "198.51.100.9" })).status).toBe(200);
    expect((await t.call("GET", "/api/salon/now", undefined, { clientKey: "198.51.100.9" })).status).toBe(429);
    expect((await t.call("GET", "/api/salon/now", undefined, { clientKey: "198.51.100.10" })).status).toBe(200);
  });

  it("ne garde ni l'adresse ni l'identifiant en clair", async () => {
    const t = await salonApi({ rateSalt: "sel" });
    await submit(t, 7, "Alice", fast.code);
    const dump = JSON.stringify([
      await t.db.all("SELECT * FROM rate"),
      await t.db.all("SELECT * FROM salon_throttle"),
      await t.db.all("SELECT * FROM salon_presence"),
    ]);
    expect(dump).not.toContain("203.0.113.7");
    expect(dump).not.toContain(playerId(7));
  });
});

describe("GET /api/salon/<session>/board", () => {
  it("ne renvoie que « unchanged » si la version est la même, avec les compteurs à jour", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    const full = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(1)}`)).body;
    const same = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(1)}&since=${full.version}`)).body;
    expect(same).toMatchObject({ unchanged: true, version: full.version, participants: 1, rows: [], me: { name: "Alice", rank: 1 } });
    wait(t);
    await submit(t, 2, "Bob", slow.code);
    const later = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(1)}&since=${full.version}`)).body;
    expect(later.unchanged).toBeUndefined();
    expect(later.rows).toHaveLength(2);
    expect((await t.call("GET", `/api/salon/${S}/board?since=abc`)).status).toBe(400);
  });

  it("un pseudo changé change la version du classement", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    const v = (await t.call("GET", `/api/salon/${S}/board`)).body.version;
    wait(t);
    await submit(t, 1, "Alicia", slow.code); // pas meilleur, mais le pseudo change
    const after = (await t.call("GET", `/api/salon/${S}/board?player=${playerId(1)}`)).body;
    expect(after.version).toBeGreaterThan(v);
    expect(after.rows[0].name).toBe("Alicia");
    expect(after.rows[0].ms).toBe(fast.finishMs);
  });

  it("sert les premiers, plus le voisin de devant et celui de derrière du joueur (le jeu en tire ses fantômes)", async () => {
    const t = await salonApi();
    // 40 joueurs déjà classés (insérés directement : la validation par rejeu est testée plus haut).
    for (let i = 0; i < 40; i++) {
      await t.db.run("INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (?, ?, ?, ?, ?, '[]', 'x', ?)", [
        S,
        playerId(1000 + i),
        i.toString(16).padStart(16, "0"),
        `Pilote ${i + 1}`,
        30_000 + i * 100,
        NOON + i,
      ]);
    }
    await t.db.run("INSERT INTO salon_sessions (session, version) VALUES (?, 40)", [S]);
    const r = await submit(t, 1, "Alice", slowest.code); // plus lent que les 40 : 41e
    expect(r.body.rank).toBeGreaterThan(30);
    const board = r.body.board;
    expect(board.participants).toBe(41);
    const ranks = board.rows.map((x: { rank: number }) => x.rank);
    expect(ranks.slice(0, 15)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(ranks).toEqual([...ranks].sort((a: number, b: number) => a - b));
    expect(ranks).toContain(r.body.rank - 1);
    expect(ranks).toContain(r.body.rank);
    expect(ranks.length).toBeLessThanOrEqual(15 + 2 + 1);
    expect(board.rows.find((x: { rank: number }) => x.rank === r.body.rank).mine).toBe(true);
    expect(board.rows[0].gap).toBe(0);
    expect(board.rows[1].gap).toBe(100);
  });

  it("refuse une session invalide, trop ancienne ou trop lointaine ; une session sans course est vide", async () => {
    const t = await salonApi();
    expect((await t.call("GET", "/api/salon/abc/board")).status).toBe(400);
    expect((await t.call("GET", `/api/salon/${S + 5}/board`)).status).toBe(404);
    expect((await t.call("GET", `/api/salon/${S - 1000}/board`)).status).toBe(404);
    const next = await t.call("GET", `/api/salon/${S + 1}/board`); // la session suivante peut être demandée (décalage d'horloge de quelques ms)
    expect(next.status).toBe(200);
    expect(next.body).toMatchObject({ participants: 0, rows: [], me: null, version: 0 });
    expect((await t.call("POST", `/api/salon/${S}/board`, {})).status).toBe(405);
  });
});

describe("GET /api/salon/<session>/ghosts", () => {
  it("sert les rediffusions demandées par référence publique, rejouables telles quelles", async () => {
    const t = await salonApi();
    const a = await submit(t, 1, "Alice", fast.code);
    wait(t, 1000);
    await submit(t, 2, "Bob", slow.code);
    const refs = (await t.call("GET", `/api/salon/${S}/board`)).body.rows.map((r: { ref: string }) => r.ref);
    expect(refs).toHaveLength(2);
    const res = await t.call("GET", `/api/salon/${S}/ghosts?refs=${refs.join(",")}`);
    expect(res.status).toBe(200);
    const [g1, g2] = res.body.ghosts;
    expect(g1).toMatchObject({ ref: refs[0], name: "Alice", rank: 1, ms: fast.finishMs, replay: fast.code, simVersion: SIM_VERSION });
    expect(g2).toMatchObject({ ref: refs[1], name: "Bob", rank: 2, ms: slow.finishMs, replay: slow.code });
    expect(g1.splits).toEqual(a.body.splits ?? g1.splits);
    // Le fantôme se rejoue exactement : même circuit, même temps.
    expect(replayRace(salonCircuitOf(S).track, decodeReplay(g2.replay)).finishMs).toBe(g2.ms);
  });

  it("ne dévoile jamais l'identifiant secret : la référence est propre à la session et ne s'en déduit pas", async () => {
    const t = await salonApi();
    const r = await submit(t, 1, "Alice", fast.code);
    const ref = r.body.board.me.ref;
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(r.body)).not.toContain(playerId(1));
    expect(ref).not.toContain(playerId(1).slice(0, 8));
    // D'une session à l'autre, la même personne n'a pas la même référence (on ne peut pas la suivre).
    const other = await t.db.first<{ ref: string }>("SELECT ref FROM salon_runs");
    expect(other!.ref).toBe(ref);
    const t2 = await makeApi({ seed: false });
    await seedSalonCircuit(t2.db, S + 1);
    t2.clock.now = salonSessionStart(S + 1) + 1000;
    const r2 = await submit(t2, 1, "Alice", salonReplay(S + 1, 0.9).code, {}, S + 1);
    expect(r2.body.board.me.ref).not.toBe(ref);
  });

  it("refuse les références invalides (injection comprise) et trop nombreuses ; ignore les inconnues", async () => {
    const t = await salonApi();
    for (const bad of ["abc", "1' OR '1'='1", "%00", "A".repeat(16), "../etc"]) {
      expect((await t.call("GET", `/api/salon/${S}/ghosts?refs=${encodeURIComponent(bad)}`)).status, bad).toBe(400);
    }
    const many = Array.from({ length: MAX_GHOST_REFS + 1 }, (_, i) => i.toString(16).padStart(16, "0")).join(",");
    expect((await t.call("GET", `/api/salon/${S}/ghosts?refs=${many}`)).status).toBe(400);
    const unknown = await t.call("GET", `/api/salon/${S}/ghosts?refs=${"0".repeat(16)}`);
    expect(unknown.body).toEqual({ ghosts: [] });
    expect((await t.call("GET", `/api/salon/${S}/ghosts`)).body).toEqual({ ghosts: [] });
    // Une référence d'une session n'ouvre pas les fantômes d'une autre.
    const r = await submit(t, 1, "Alice", fast.code);
    const ref = r.body.board.me.ref;
    expect((await t.call("GET", `/api/salon/${S + 1}/ghosts?refs=${ref}`)).body).toEqual({ ghosts: [] });
  });
});

describe("circuit de la session suivante, purge et podiums", () => {
  it("prépare le circuit de la session suivante dans les deux dernières minutes (pas avant)", async () => {
    const t = await salonApi();
    const api = createApi({ db: t.db, now: () => t.clock.now });
    await api.tick();
    expect((await t.db.all<{ session: number }>("SELECT session FROM salon_circuits")).map((r) => r.session)).toEqual([S]);
    t.clock.now = END - 125_000;
    await api.tick();
    expect((await t.db.all("SELECT session FROM salon_circuits")).length).toBe(1);
    await seedSalonCircuit(t.db, S + 1); // (le circuit de S + 1 est calculé une fois pour tout le fichier de test : on l'amorce)
    await t.db.run("DELETE FROM salon_circuits WHERE session = ?", [S + 1]);
    t.clock.now = END - 110_000;
    await api.tick();
    const rows = await t.db.all<{ session: number; track_id: string }>("SELECT session, track_id FROM salon_circuits ORDER BY session");
    expect(rows).toEqual([
      { session: S, track_id: salonTrackId(S) },
      { session: S + 1, track_id: salonTrackId(S + 1) },
    ]);
  });

  it("fige le podium des trois premiers d'une session terminée, et le garde quand les courses sont purgées à 48 h", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    await submit(t, 2, "Bob", mid.code);
    await submit(t, 3, "Carole", slow.code);
    await submit(t, 4, "Dave", slowest.code);
    // Pendant la session : pas de podium.
    expect((await t.call("GET", "/api/salon/podiums")).body).toEqual({ podiums: [] });
    // Après la fin et la minute de grâce : le podium est figé (trois premiers, nombre de participants).
    t.clock.now = END + SALON_GRACE_MS + 1000;
    const api = createApi({ db: t.db, now: () => t.clock.now });
    await api.tick();
    const podium = (await t.call("GET", "/api/salon/podiums")).body.podiums;
    expect(podium).toEqual([
      {
        session: S,
        startMs: START,
        participants: 4,
        top: [
          { rank: 1, name: "Alice", ms: fast.finishMs },
          { rank: 2, name: "Bob", ms: mid.finishMs },
          { rank: 3, name: "Carole", ms: slow.finishMs },
        ],
      },
    ]);
    // 47 h plus tard : les courses sont toujours là ; 49 h : purgées, le podium reste.
    t.clock.now = START + 47 * 3_600_000;
    await api.salon.maintain(true);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs"))!.n).toBe(4);
    t.clock.now = START + SALON_RETENTION_MS + 3_600_000;
    await api.salon.maintain(true);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs"))!.n).toBe(0);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_circuits"))!.n).toBe(0);
    expect((await t.call("GET", "/api/salon/podiums")).body.podiums).toEqual(podium);
    // La session purgée n'est plus servie (hors de la fenêtre gardée).
    expect((await t.call("GET", `/api/salon/${S}/board`)).status).toBe(404);
  });

  it("fige le podium d'une session avant de purger ses courses, même si le serveur est resté arrêté plusieurs jours", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    t.clock.now = START + 5 * 86_400_000; // le serveur redémarre cinq jours plus tard
    const api = createApi({ db: t.db, now: () => t.clock.now });
    await api.tick();
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs"))!.n).toBe(0);
    expect((await t.call("GET", "/api/salon/podiums")).body.podiums[0]).toMatchObject({ session: S, participants: 1, top: [{ name: "Alice" }] });
  });

  it("ne purge pas ce qui est récent, ni une session encore ouverte à l'envoi", async () => {
    const t = await salonApi();
    await submit(t, 1, "Alice", fast.code);
    t.clock.now = END + 30_000; // la session est finie, mais on peut encore envoyer : pas de podium figé
    const api = createApi({ db: t.db, now: () => t.clock.now });
    await api.salon.maintain(true);
    expect(await t.db.first("SELECT session FROM salon_podiums")).toBeNull();
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs"))!.n).toBe(1);
  });
});
