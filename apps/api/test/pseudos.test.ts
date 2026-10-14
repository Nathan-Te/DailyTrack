import { describe, expect, it } from "vitest";
import { formatDay, medalFor, medalsFor } from "@cdj/sim";
import { ensureSchemaOn, schemaVersion } from "../src/db";
import { FORBIDDEN_WORDS, isForbidden, migratePseudos, nameKey, provisionalName, suggestionCandidates } from "../src/pseudos";
import { DAY, DAY_MS, NOON, SALON_SESSION, circuitOf, makeApi, openTestDb, pilotReplay, playerId, salonReplay, seedSalonCircuit, type TestApi } from "./helpers";

// Pseudos réservés, profil synchronisé et code révocable (lot 30).
const DATE = formatDay(DAY);
const fast = pilotReplay(DAY, 0.9);
const slow = pilotReplay(DAY, 0.65);
const salonFast = salonReplay(SALON_SESSION, 0.9);

const submit = (t: TestApi, n: number, name: string | undefined, code = fast.code, extra: Record<string, unknown> = {}) =>
  t.call("POST", "/api/submit", { playerId: playerId(n), ...(name === undefined ? {} : { name }), date: DATE, replay: code, ...extra });
const me = (t: TestApi, id: string, opts: { clientKey?: string } = {}) => t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": id }, ...opts });
const rotate = (t: TestApi, oldId: string, newId: string) => t.call("POST", "/api/me/code", { newId }, { headers: { "X-Player-Id": oldId } });
const players = (t: TestApi) => t.db.all<{ id: string; name: string; name_key: string | null; rename_required: number }>("SELECT id, name, name_key, rename_required FROM players ORDER BY created_at, id");

describe("forme d'un pseudo : clé, mots refusés, suggestions", () => {
  it("la clé ignore la casse, les accents et les espaces en trop", () => {
    expect(nameKey("Nowy")).toBe("nowy");
    expect(nameKey("  NÓWY ")).toBe("nowy");
    expect(nameKey("Éloïse   Dupont")).toBe("eloise dupont");
    expect(nameKey("L’as")).toBe("l'as");
    expect(nameKey("Nowy_FR")).not.toBe(nameKey("Nowy"));
  });

  it("refuse les mots interdits et les noms réservés, sans faux positif sur un mot qui les contient", () => {
    for (const bad of ["Connard", "xx_hitler_xx", "Admin", "ADMINISTRATEUR", "Circuit du Jour", "Fuck You", "Le Nazi"]) expect(isForbidden(bad), bad).toBe(true);
    for (const ok of ["Nowy", "Technique", "Computer", "Cabite", "Admin42", "Nathan", "Pétula", "Bitcoin", "Shiitake", "Naziha"]) expect(isForbidden(ok), ok).toBe(false);
    expect(FORBIDDEN_WORDS.every((w) => w === nameKey(w) && !/\s/.test(w))).toBe(true); // liste modifiable : mots minuscules, sans accent
  });

  it("propose des variantes valides qui tiennent en 20 caractères", () => {
    const list = suggestionCandidates("Nowy");
    expect(list.slice(0, 2)).toEqual(["Nowy2", "Nowy_FR"]);
    for (const s of suggestionCandidates("A".repeat(20))) expect([...s].length).toBeLessThanOrEqual(20);
    expect(provisionalName("Nowy", 2)).toBe("Nowy·2");
    expect([...provisionalName("A".repeat(20), 12)].length).toBe(20);
  });
});

describe("un pseudo appartient à son premier propriétaire", () => {
  it("refuse un pseudo pris, casse et accents compris, sans créer de joueur", async () => {
    const t = await makeApi();
    expect((await submit(t, 1, "Nowy")).status).toBe(200);
    for (const [n, name] of [[2, "nowy"], [3, "NOWY"], [4, "Nówy"], [5, " nowy  "]] as const) {
      const r = await submit(t, n, name, slow.code);
      expect(r.status, name).toBe(409);
      expect(r.body.error).toBe("name_taken");
      expect(r.body.message).toBe("Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.");
      expect(r.body.suggestions.length).toBeGreaterThan(0);
    }
    expect(await t.db.all("SELECT id FROM players")).toHaveLength(1); // aucun joueur créé par une course refusée
    expect(await t.db.all("SELECT player_id FROM results")).toHaveLength(1);
    // Le même joueur garde le droit de réécrire son propre pseudo, avec une autre casse.
    expect((await submit(t, 1, "NOWY")).status).toBe(200);
    expect((await players(t))[0]!.name).toBe("NOWY");
  });

  it("propose des suggestions libres, jamais un pseudo déjà pris", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await submit(t, 2, "Nowy2");
    const r = await submit(t, 3, "Nowy", slow.code);
    expect(r.body.suggestions).not.toContain("Nowy2");
    expect(r.body.suggestions).toContain("Nowy_FR");
    expect(r.body.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of r.body.suggestions) expect((await t.call("GET", `/api/name?name=${encodeURIComponent(s)}`)).body).toEqual({ available: true });
  });

  it("rend le pseudo quand son propriétaire en change", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    expect((await submit(t, 2, "Nowy", slow.code)).status).toBe(409);
    const renamed = await t.call("PUT", "/api/player", { playerId: playerId(1), name: "Alice" });
    expect(renamed).toMatchObject({ status: 200, body: { name: "Alice" } });
    const r = await submit(t, 2, "Nowy", slow.code);
    expect(r.status).toBe(200);
    expect(await t.db.first("SELECT name FROM players WHERE id = ?", [playerId(2)])).toEqual({ name: "Nowy" });
    // Et l'ancien propriétaire ne peut plus reprendre ce pseudo.
    expect((await t.call("PUT", "/api/player", { playerId: playerId(1), name: "nowy" })).body.error).toBe("name_taken");
  });

  it("change de pseudo : le sien en autre casse passe, celui d'un autre est refusé, et il faut avoir couru", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice");
    await submit(t, 2, "Bob");
    expect((await t.call("PUT", "/api/player", { playerId: playerId(2), name: "bob" })).status).toBe(200);
    const clash = await t.call("PUT", "/api/player", { playerId: playerId(2), name: "ALICE" });
    expect(clash.status).toBe(409);
    expect((await t.call("PUT", "/api/player", { playerId: playerId(9), name: "Zoe" })).body.error).toBe("unknown_player");
    expect((await t.call("PUT", "/api/player", { playerId: playerId(2), name: "Connard" })).body.error).toBe("name_forbidden");
    expect((await t.call("PUT", "/api/player", { playerId: playerId(2), name: "Bob!" })).body.error).toBe("invalid_name");
  });

  it("la vérification répond seulement « libre » ou « pris » (le propriétaire voit son pseudo libre)", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    const taken = await t.call("GET", "/api/name?name=nówy");
    expect(taken.status).toBe(200);
    expect(Object.keys(taken.body).sort()).toEqual(["available", "suggestions"]);
    expect(taken.body.available).toBe(false);
    expect(JSON.stringify(taken.body)).not.toContain(playerId(1));
    expect((await t.call("GET", "/api/name?name=Libre")).body).toEqual({ available: true });
    expect((await t.call("GET", "/api/name?name=nowy", undefined, { headers: { "X-Player-Id": playerId(1) } })).body).toEqual({ available: true });
    expect((await t.call("GET", "/api/name?name=nowy", undefined, { headers: { "X-Player-Id": playerId(2) } })).body.available).toBe(false);
    expect((await t.call("GET", "/api/name?name=Bad!")).body.error).toBe("invalid_name");
    expect((await t.call("GET", "/api/name?name=Hitler")).body.error).toBe("name_forbidden");
    expect((await t.call("GET", "/api/name")).body.error).toBe("invalid_name");
    expect((await t.call("POST", "/api/name", {})).status).toBe(405);
  });

  it("limite les vérifications par adresse (pas de balayage de pseudos)", async () => {
    const t = await makeApi();
    let last = 200;
    for (let i = 0; i < 45 && last === 200; i++) last = (await t.call("GET", `/api/name?name=Essai${i}`, undefined, { clientKey: "198.51.100.9" })).status;
    expect(last).toBe(429);
    expect((await t.call("GET", "/api/name?name=Autre", undefined, { clientKey: "198.51.100.10" })).status).toBe(200); // une autre adresse n'est pas touchée
  });

  it("la base a le dernier mot : un doublon qui passe la vérification est refusé à l'écriture", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await expect(t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [playerId(7), "NOWY", "nowy"])).rejects.toThrow(/UNIQUE|constraint/i);
    // Course simultanée de deux joueurs pour le même pseudo : un seul gagne, l'autre reçoit un refus propre (pas une erreur 500).
    const [a, b] = await Promise.all([submit(t, 2, "Duel"), submit(t, 3, "duel", slow.code)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await t.db.all("SELECT id FROM players WHERE name_key = 'duel'")).toHaveLength(1);
  });

  it("le Salon applique la même règle", async () => {
    const t = await makeApi();
    await seedSalonCircuit(t.db, SALON_SESSION);
    await submit(t, 1, "Nowy");
    const refused = await t.call("POST", `/api/salon/${SALON_SESSION}/submit`, { playerId: playerId(2), name: "nowy", replay: salonFast.code });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("name_taken");
    expect(await t.db.all("SELECT player_id FROM salon_runs")).toHaveLength(0);
    expect(await t.db.first("SELECT id FROM players WHERE id = ?", [playerId(2)])).toBeNull();
    const ok = await t.call("POST", `/api/salon/${SALON_SESSION}/submit`, { playerId: playerId(2), name: "Libre", replay: salonFast.code });
    expect(ok.status).toBe(200);
  });

  it("un pseudo réservé au premier propriétaire l'est dans le classement : un seul « Nowy »", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await submit(t, 2, "Nowy", slow.code);
    await submit(t, 3, "nowy", slow.code);
    const board = await t.call("GET", `/api/day/${DATE}/leaderboard`);
    expect(board.body.top.map((r: { name: string }) => r.name)).toEqual(["Nowy"]);
  });
});

describe("migration des doublons existants", () => {
  /** Une base d'avant le lot 30 : `players` sans clé de pseudo, avec des doublons et des temps. */
  async function oldDatabase() {
    const db = await openTestDb();
    await db.run("CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, demo INTEGER NOT NULL DEFAULT 0)");
    const rows: [number, string, number][] = [
      [1, "Nowy", 1000], // le plus ancien : garde le pseudo
      [2, "nowy", 3000],
      [3, "Nówy", 2000],
      [4, "Nathan", 1500],
      [5, "Nathan", 1600],
      [6, "Solo", 1700],
      [7, "A".repeat(20), 1800],
      [8, "A".repeat(20), 1900],
    ];
    for (const [n, name, at] of rows) await db.run("INSERT INTO players (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [playerId(n), name, at, at]);
    return db;
  }

  it("garde le pseudo au plus ancien, suffixe les autres, ne touche à aucun temps", async () => {
    const db = await oldDatabase();
    const t = await makeApi({ db, seed: false });
    await t.api.handle(new Request("http://api.test/api/health")); // ensureSchema : migration
    await db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [DAY, circuitOf(DAY).track.id, circuitOf(DAY).spec, circuitOf(DAY).authorMs, 1, circuitOf(DAY).palette, NOON]);
    const byId = new Map((await players(t)).map((p) => [p.id, p]));
    expect(byId.get(playerId(1))).toMatchObject({ name: "Nowy", name_key: "nowy", rename_required: 0 });
    expect(byId.get(playerId(3))).toMatchObject({ name: "Nówy·2", rename_required: 1 }); // 2000 < 3000 : celui-ci passe avant « nowy »
    expect(byId.get(playerId(2))).toMatchObject({ name: "nowy·3", rename_required: 1 });
    expect(byId.get(playerId(4))).toMatchObject({ name: "Nathan", rename_required: 0 });
    expect(byId.get(playerId(5))).toMatchObject({ name: "Nathan·2", rename_required: 1 });
    expect(byId.get(playerId(6))).toMatchObject({ name: "Solo", rename_required: 0 });
    expect([...byId.get(playerId(8))!.name].length).toBeLessThanOrEqual(20);
    expect(byId.get(playerId(8))!.name.endsWith("·2")).toBe(true);
    // Chaque clé est unique, et l'index unique est posé.
    const keys = [...byId.values()].map((p) => p.name_key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(await db.first("SELECT name FROM sqlite_master WHERE name = 'players_by_name_key'")).not.toBeNull();
    // Le rapport est gardé (pseudos, pas d'identifiant entier).
    const report = JSON.parse((await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'pseudo_migration'"))!.value);
    expect(report.renamed.map((r: { to: string }) => r.to).sort()).toEqual(["A".repeat(18) + "·2", "Nathan·2", "Nówy·2", "nowy·3"].sort());
    expect(JSON.stringify(report)).not.toContain(playerId(1));
    // Les temps d'un joueur renommé sont intacts : il se connecte avec le même code et le voit proposer un nouveau pseudo.
    const r = await submit(t, 5, undefined);
    expect(r.status).toBe(200);
    const profile = await me(t, playerId(5));
    expect(profile.body).toMatchObject({ name: "Nathan·2", renameRequired: true, stats: { days: 1 } });
    // Choisir un nouveau pseudo lève le drapeau.
    expect((await t.call("PUT", "/api/player", { playerId: playerId(5), name: "Nathan Deux" })).status).toBe(200);
    expect((await me(t, playerId(5))).body).toMatchObject({ name: "Nathan Deux", renameRequired: false });
  });

  it("est idempotente et prévisible : deuxième passage sans effet, essai à blanc sans écriture", async () => {
    const db = await oldDatabase();
    await db.run("ALTER TABLE players ADD COLUMN name_key TEXT");
    await db.run("ALTER TABLE players ADD COLUMN rename_required INTEGER NOT NULL DEFAULT 0");
    await db.run("CREATE TABLE salon_runs (session INTEGER, player_id TEXT, name TEXT)");
    const dry = await migratePseudos(db, { dryRun: true });
    expect(dry.renamed).toHaveLength(4);
    expect(await db.first("SELECT name FROM players WHERE name_key IS NOT NULL")).toBeNull();
    const first = await migratePseudos(db);
    expect(first.renamed.map((r) => r.to)).toEqual(dry.renamed.map((r) => r.to));
    const second = await migratePseudos(db);
    expect(second).toEqual({ keyed: 0, renamed: [] });
  });

  it("une base neuve ou déjà migrée est à jour : une seule lecture au réveil", async () => {
    const db = await openTestDb();
    expect(await ensureSchemaOn(db)).toBe(false);
    expect(await ensureSchemaOn(db)).toBe(true);
    expect((await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'"))!.value).toBe(schemaVersion());
    expect(await db.first("SELECT value FROM meta WHERE key = 'pseudo_migration'")).toBeNull(); // rien à signaler
  });
});

describe("GET /api/me — le profil vu par le serveur", () => {
  /** Quatre jours passés joués par le joueur 1 (avec des concurrents), plus aujourd'hui. */
  async function withHistory() {
    const t = await makeApi();
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Nowy', 0, 0, 'nowy')", [playerId(1)]);
    const author = circuitOf(DAY).authorMs;
    const medals = medalsFor(author);
    const days: { day: number; ms: number; others: number[] }[] = [
      { day: DAY - 1, ms: author, others: [author + 500] }, // 1er sur 2
      { day: DAY - 2, ms: Math.round(author * 1.2), others: [author, author + 100, author + 200] }, // 4e sur 4
      { day: DAY - 3, ms: Math.round(author * 1.5), others: [] },
      { day: DAY - 5, ms: Math.round(author * 1.05), others: [author * 2] }, // un jour sauté : la série s'arrête
    ];
    for (const d of days) {
      await t.db.run("INSERT INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, 'x', ?, 1, 'stade', 0)", [d.day, `jour-${formatDay(d.day)}-g15`, author]);
      await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [d.day, playerId(1), d.ms, d.day * 10]);
      let k = 100;
      for (const ms of d.others) await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", [d.day, playerId(k++), ms, d.day * 10 + 1]);
    }
    return { t, author, medals, days };
  }

  it("rend le pseudo, les statistiques, le temps du jour avec sa rediffusion et les temps des jours passés", async () => {
    const { t, author, medals, days } = await withHistory();
    await submit(t, 1, "Nowy");
    const r = await me(t, playerId(1));
    expect(r.status).toBe(200);
    expect(r.body.name).toBe("Nowy");
    expect(r.body.renameRequired).toBe(false);
    expect(r.body.today).toBe(DATE);
    // Aujourd'hui : temps, rediffusion rejouable, circuit et médaille.
    expect(r.body.best).toMatchObject({ date: DATE, trackId: circuitOf(DAY).track.id, ms: fast.finishMs, replay: fast.code, medal: medalFor(fast.finishMs, medals) });
    expect(r.body.best.splits.length).toBeGreaterThan(0);
    expect(r.body.best.simVersion).toBe(fast.replay.simVersion);
    // Jours passés : un seul temps par jour, avec le circuit et la médaille, sans rediffusion (poids).
    expect(r.body.past.map((p: { date: string }) => p.date)).toEqual(days.map((d) => formatDay(d.day)));
    expect(r.body.past[0]).toEqual({ date: formatDay(DAY - 1), trackId: `jour-${formatDay(DAY - 1)}-g15`, ms: author, medal: "author" });
    expect(r.body.past[2].medal).toBe(medalFor(Math.round(author * 1.5), medals));
    expect(JSON.stringify(r.body.past)).not.toContain("replay");
    // Statistiques : jours joués, médailles par type, meilleure place, série.
    expect(r.body.stats.days).toBe(5);
    const counted = { author: 0, gold: 0, silver: 0, bronze: 0 };
    for (const ms of [fast.finishMs, ...days.map((d) => d.ms)]) {
      const m = medalFor(ms, medals);
      if (m) counted[m]++;
    }
    expect(r.body.stats.medals).toEqual(counted);
    expect(r.body.stats.bestRank).toEqual({ date: formatDay(DAY - 1), rank: 1, participants: 2 }); // 1er aujourd'hui, la veille et il y a cinq jours : le plus fréquenté gagne, puis le plus récent
    expect(r.body.stats.streak).toBe(4); // aujourd'hui, -1, -2, -3 ; -4 manque
  });

  it("la série compte depuis hier tant qu'aujourd'hui n'est pas joué, et la meilleure place départage par le nombre de concurrents", async () => {
    const { t } = await withHistory();
    const r = await me(t, playerId(1));
    expect(r.body.best).toBeNull();
    expect(r.body.stats.streak).toBe(3);
    expect(r.body.stats.bestRank).toEqual({ date: formatDay(DAY - 1), rank: 1, participants: 2 });
    expect(r.body.stats.days).toBe(4);
  });

  it("calcule la place d'un jour terminé une fois, puis la garde (une synchronisation ne relit pas tout le classement)", async () => {
    const { t } = await withHistory();
    const finals = () => t.db.all<{ day: number; final_rank: number | null; final_total: number | null }>("SELECT day, final_rank, final_total FROM results WHERE player_id = ? ORDER BY day DESC", [playerId(1)]);
    expect((await finals()).every((r) => r.final_rank === null)).toBe(true);
    const first = await me(t, playerId(1));
    expect((await finals()).map((r) => [r.day - DAY, r.final_rank, r.final_total])).toEqual([[-1, 1, 2], [-2, 4, 4], [-3, 1, 1], [-5, 1, 2]]);
    // Un classement qui bouge après coup (impossible sur un vrai jour fermé) ne change plus la place gardée : elle est figée.
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 1, '[]', 'x', 0, 0)", [DAY - 1, playerId(500)]);
    expect((await me(t, playerId(1))).body).toEqual(first.body);
  });

  it("la place d'hier reste « du moment » pendant la minute de grâce, puis se fige", async () => {
    const { t } = await withHistory();
    t.clock.now = DAY * DAY_MS + 60_000; // une minute après minuit : hier compte encore (grâce de dix minutes)
    await me(t, playerId(1));
    expect(await t.db.first("SELECT final_rank FROM results WHERE player_id = ? AND day = ?", [playerId(1), DAY - 1])).toEqual({ final_rank: null });
    expect(await t.db.first("SELECT final_rank FROM results WHERE player_id = ? AND day = ?", [playerId(1), DAY - 2])).toEqual({ final_rank: 4 });
    t.clock.now = DAY * DAY_MS + 11 * 60_000;
    await me(t, playerId(1));
    expect(await t.db.first("SELECT final_rank FROM results WHERE player_id = ? AND day = ?", [playerId(1), DAY - 1])).toEqual({ final_rank: 1 });
  });

  it("refuse un identifiant dans l'adresse, un identifiant invalide et un profil inconnu", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    expect((await t.call("GET", `/api/me?player=${playerId(1)}`)).body.error).toBe("invalid_player"); // jamais dans l'adresse
    expect((await me(t, "zzz")).status).toBe(400);
    expect((await me(t, playerId(9))).body.error).toBe("unknown_player");
    expect((await t.call("POST", "/api/me", {}, { headers: { "X-Player-Id": playerId(1) } })).status).toBe(405);
    expect((await me(t, playerId(1))).status).toBe(200);
  });

  it("ne montre que le profil de celui qui présente l'identifiant", async () => {
    const t = await makeApi();
    await submit(t, 1, "Alice");
    await submit(t, 2, "Bob", slow.code);
    const a = (await me(t, playerId(1))).body;
    const b = (await me(t, playerId(2))).body;
    expect([a.name, a.best.ms]).toEqual(["Alice", fast.finishMs]);
    expect([b.name, b.best.ms]).toEqual(["Bob", slow.finishMs]);
    expect(JSON.stringify(a)).not.toContain(playerId(2));
  });

  it("est limité en débit par joueur", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    let last = 200;
    for (let i = 0; i < 65 && last === 200; i++) last = (await me(t, playerId(1), { clientKey: `192.0.2.${i}` })).status;
    expect(last).toBe(429);
  });

  it("la CORS autorise l'en-tête X-Player-Id", async () => {
    const t = await makeApi();
    const pre = await t.api.handle(new Request("http://api.test/api/me", { method: "OPTIONS" }));
    expect(pre.headers.get("Access-Control-Allow-Headers")).toContain("X-Player-Id");
  });
});

describe("« Changer mon code »", () => {
  const OLD = playerId(1);
  const NEW = playerId(0x77);

  it("le nouvel identifiant garde tout, l'ancien ne vaut plus rien nulle part", async () => {
    const t = await makeApi();
    await seedSalonCircuit(t.db, SALON_SESSION);
    await submit(t, 1, "Nowy");
    await submit(t, 2, "Bob", slow.code);
    const before = (await me(t, OLD)).body;
    expect((await t.call("POST", `/api/salon/${SALON_SESSION}/submit`, { playerId: OLD, replay: salonFast.code })).status).toBe(200);

    expect(await rotate(t, OLD, NEW)).toMatchObject({ status: 200, body: { rotated: true } });

    // Tout est refusé avec l'ancien code, avec un message clair.
    const revoked = [
      await me(t, OLD),
      await submit(t, 1, "Nowy"),
      await submit(t, 1, undefined),
      await t.call("PUT", "/api/player", { playerId: OLD, name: "Autre" }),
      await rotate(t, OLD, playerId(0x78)),
      await t.call("POST", `/api/salon/${SALON_SESSION}/submit`, { playerId: OLD, replay: salonFast.code }),
    ];
    for (const r of revoked) {
      expect(r.status).toBe(410);
      expect(r.body.error).toBe("code_revoked");
      expect(r.body.message).toMatch(/n'est plus valide/);
    }
    expect(await t.db.first("SELECT id FROM players WHERE id = ?", [OLD])).toBeNull(); // pas de joueur recréé par l'ancien code
    // Les lectures publiques ne trahissent rien : l'ancien code n'est plus « moi ».
    expect((await t.call("GET", `/api/day/${DATE}/leaderboard?player=${OLD}`)).body.me).toBeNull();

    // Le nouveau code garde le pseudo, les temps, la place et la série.
    const after = (await me(t, NEW)).body;
    expect(after).toEqual(before);
    const board = (await t.call("GET", `/api/day/${DATE}/leaderboard?player=${NEW}`)).body;
    expect(board.top.map((r: { name: string; ms: number }) => [r.name, r.ms])).toEqual([["Nowy", fast.finishMs], ["Bob", slow.finishMs]]);
    expect(board.me).toMatchObject({ rank: 1, name: "Nowy" });
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=ahead&player=${playerId(2)}`)).body.name).toBe("Nowy");
    // Il peut jouer, renommer et classer comme avant.
    expect((await submit(t, 0x77, undefined, slow.code)).body).toMatchObject({ improved: false, bestMs: fast.finishMs });
    expect((await t.call("PUT", "/api/player", { playerId: NEW, name: "Nowy 2" })).status).toBe(200);
    // Le pseudo reste réservé à ce profil (l'ancien code ne le libère pas pour un autre).
    expect((await submit(t, 3, "nowy 2", slow.code)).body.error).toBe("name_taken");
    // Le Salon en cours est oublié pour ce joueur (une session dure dix minutes) ; l'ancien code n'y apparaît plus.
    expect(await t.db.all("SELECT player_id FROM salon_runs WHERE player_id = ?", [OLD])).toEqual([]);
  });

  it("rejouer la même demande réussit (réponse perdue), un autre nouvel identifiant non", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    expect((await rotate(t, OLD, NEW)).status).toBe(200);
    expect(await rotate(t, OLD, NEW)).toMatchObject({ status: 200, body: { rotated: true } });
    expect((await rotate(t, OLD, playerId(0x99))).status).toBe(410);
    expect((await me(t, NEW)).status).toBe(200);
  });

  it("refuse un identifiant déjà pris, identique ou invalide, et un profil inconnu", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await submit(t, 2, "Bob", slow.code);
    expect((await rotate(t, OLD, playerId(2))).body.error).toBe("id_taken");
    expect((await rotate(t, OLD, OLD)).body.error).toBe("invalid_player");
    expect((await t.call("POST", "/api/me/code", { newId: "zzz" }, { headers: { "X-Player-Id": OLD } })).status).toBe(400);
    expect((await t.call("POST", "/api/me/code", {}, { headers: { "X-Player-Id": OLD } })).status).toBe(400);
    expect((await rotate(t, playerId(9), NEW)).body.error).toBe("unknown_player");
    expect((await t.call("GET", "/api/me/code", undefined, { headers: { "X-Player-Id": OLD } })).status).toBe(405);
    expect((await me(t, OLD)).status).toBe(200); // aucun refus n'a rien changé
    // Un identifiant révoqué ne peut pas non plus servir de nouvel identifiant.
    expect((await rotate(t, OLD, NEW)).status).toBe(200);
    expect((await rotate(t, playerId(2), OLD)).body.error).toBe("id_taken");
  });

  it("est limité en débit (trois changements par fenêtre)", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    let id = OLD;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next = playerId(0x200 + i);
      statuses.push((await rotate(t, id, next)).status);
      id = next;
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]); // chaque nouvel identifiant a sa propre limite
    // Mais un même code ne se change pas à la chaîne : trois tentatives par fenêtre, rejouées ou non.
    const t2 = await makeApi();
    await submit(t2, 1, "Nowy");
    expect((await rotate(t2, OLD, playerId(0x300))).status).toBe(200);
    expect((await rotate(t2, OLD, playerId(0x300))).status).toBe(200);
    expect((await rotate(t2, OLD, playerId(0x300))).status).toBe(200);
    expect((await rotate(t2, OLD, playerId(0x300))).status).toBe(429);
  });

  it("ne garde que l'empreinte de l'ancien code", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await rotate(t, OLD, NEW);
    const rows = await t.db.all<{ hash: string; successor: string }>("SELECT hash, successor FROM revoked_codes");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(OLD);
    expect(JSON.stringify(rows)).not.toContain(NEW);
  });

  it("se fait en une seule transaction : un échec au milieu ne laisse rien derrière lui", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy");
    await t.db.run("CREATE TRIGGER boom BEFORE UPDATE ON players BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const r = await rotate(t, OLD, NEW);
    expect(r.status).toBe(500);
    await t.db.run("DROP TRIGGER boom");
    expect(await t.db.first("SELECT hash FROM revoked_codes")).toBeNull();
    expect((await me(t, OLD)).status).toBe(200);
    expect(await t.db.all("SELECT player_id FROM results WHERE player_id = ?", [OLD])).toHaveLength(1);
    expect((await rotate(t, OLD, NEW)).status).toBe(200); // et on peut recommencer
  });
});

describe("le serveur ne fait toujours pas confiance à un temps annoncé", () => {
  it("/api/me rend le temps que le serveur a rejoué, pas celui que le client annonce", async () => {
    const t = await makeApi();
    await submit(t, 1, "Nowy", slow.code, { ms: 1, finishMs: 1 });
    expect((await me(t, playerId(1))).body.best.ms).toBe(slow.finishMs);
  });
});
