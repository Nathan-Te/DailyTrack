import { describe, expect, it } from "vitest";
import { BASCULE_LOT_35, MEDAL_FACTORS, dailyCircuit, etatGarage, nouvellesVoitures, progresGarage, medalFor, dailyTrackId, encodeReplay, formatDay, medalDayStats, medalPoolStats, medalsFor, PREMIER_JOUR, ratiosOf, runPilot, themeForDay, thresholdsOf, THEME_NAMES } from "@cdj/sim";
import { ADMIN_MAX_FAILURES, PLANNING_HORIZON } from "../src/api";
import { DAY, DAY_MS, NOON, circuitOf, makeApi, parisDayStart, pilotReplay, playerId, type TestApi } from "./helpers";

// Planning des circuits (lot 14) : remplacer à l'avance le circuit d'un jour à venir, sans casser « le même circuit pour
// tous » ni la validation par rejeu.

const TOKEN = "jeton-de-test-0123456789";
const auth = { Authorization: `Bearer ${TOKEN}` };
const TOMORROW = DAY + 1;
const T_DATE = formatDay(TOMORROW);
const natural = themeForDay(TOMORROW).name;
const other = THEME_NAMES.find((n) => n !== natural)!;

const admin = () => makeApi({ adminToken: TOKEN });
const put = (t: Awaited<ReturnType<typeof admin>>, date: string, body: unknown, headers: Record<string, string> = auth) => t.call("PUT", `/api/admin/planning/${date}`, body, { headers });

describe("accès admin", () => {
  it("sans jeton, avec un mauvais jeton ou un jeton d'une autre forme : refusé", async () => {
    const t = await admin();
    expect((await t.call("GET", "/api/admin/overview")).status).toBe(401);
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: "Bearer mauvais" } })).status).toBe(401);
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: TOKEN } })).status).toBe(401);
    expect((await put(t, T_DATE, { variant: 1 }, {})).status).toBe(401);
    expect((await t.call("DELETE", `/api/admin/planning/${T_DATE}`)).status).toBe(401);
  });

  it("le bon jeton passe", async () => {
    const t = await admin();
    const r = await t.call("GET", "/api/admin/overview", undefined, { headers: auth });
    expect(r.status).toBe(200);
    expect(r.body.today).toBe(formatDay(DAY));
    expect(r.body.plan).toEqual([]);
    expect(r.body.days).toHaveLength(Math.min(15, DAY - PREMIER_JOUR + 1)); // aujourd'hui + quatorze jours passés, sans remonter avant le premier jour
  });

  it("sans ADMIN_TOKEN (ou trop court), les routes d'admin n'existent pas", async () => {
    for (const adminToken of [undefined, "court"]) {
      const t = await makeApi({ adminToken });
      expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: "Bearer court" } })).status).toBe(404);
    }
  });

  it("limite de débit : après trop d'échecs, même le bon jeton est refusé jusqu'à la fenêtre suivante", async () => {
    const t = await admin();
    for (let i = 0; i < ADMIN_MAX_FAILURES; i++) expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: `Bearer x${i}` } })).status).toBe(401);
    const blocked = await t.call("GET", "/api/admin/overview", undefined, { headers: auth });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    // une autre adresse n'est pas touchée
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: auth, clientKey: "198.51.100.9" })).status).toBe(200);
    // la fenêtre suivante
    t.clock.now += 11 * 60_000;
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: auth })).status).toBe(200);
  });

  it("le jeton n'est jamais renvoyé ni stocké", async () => {
    const t = await admin();
    await put(t, T_DATE, { variant: 1 });
    const dump = JSON.stringify(await t.db.all("SELECT * FROM planning")) + JSON.stringify(await t.db.all("SELECT * FROM rate"));
    expect(dump).not.toContain(TOKEN);
  });
});

describe("remplacement d'un circuit", () => {
  it("un jour futur est accepté, visible par le jeu (route publique) et par l'admin", async () => {
    const t = await admin();
    const r = await put(t, T_DATE, { variant: 2 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: T_DATE, variant: 2, theme: null, trackId: dailyTrackId(TOMORROW, null, 2) });
    // aujourd'hui l'API ne révèle pas le jour à venir…
    expect((await t.call("GET", `/api/day/${T_DATE}`)).status).toBe(404);
    expect((await t.call("GET", "/api/planning")).body.days).toEqual([]);
    // … l'admin le voit
    const o = await t.call("GET", "/api/admin/overview", undefined, { headers: auth });
    expect(o.body.plan).toMatchObject([{ date: T_DATE, variant: 2, theme: null }]);
    // le lendemain, le jeu le demande : variante et identifiant du circuit en vigueur
    t.clock.now = NOON + DAY_MS;
    const day = await t.call("GET", `/api/day/${T_DATE}`);
    expect(day.status).toBe(200);
    expect(day.body).toMatchObject({ variant: 2, theme: null, trackId: dailyTrackId(TOMORROW, null, 2) });
    expect((await t.call("GET", "/api/planning")).body.days).toEqual([{ date: T_DATE, variant: 2, theme: null }]);
  });

  it("un thème imposé est gardé ; le thème de la date n'est pas « imposé »", async () => {
    const t = await admin();
    const r = await put(t, T_DATE, { variant: 1, theme: other });
    expect(r.body).toMatchObject({ variant: 1, theme: other, trackId: dailyTrackId(TOMORROW, other, 1) });
    const same = await put(t, T_DATE, { variant: 1, theme: natural });
    expect(same.body).toMatchObject({ variant: 1, theme: null, trackId: dailyTrackId(TOMORROW, null, 1) });
  });

  it("aujourd'hui et le passé sont refusés : un jour commencé est figé", async () => {
    const t = await admin();
    for (const day of [DAY, DAY - 1, DAY - 30]) {
      const r = await put(t, formatDay(day), { variant: 1 });
      expect(r.status).toBe(409);
      expect(r.body.error).toBe("day_started");
      expect((await t.call("DELETE", `/api/admin/planning/${formatDay(day)}`, undefined, { headers: auth })).status).toBe(409);
    }
    expect((await t.db.all("SELECT * FROM planning")).length).toBe(0);
    // à minuit, « demain » devient « aujourd'hui » : le remplacement est alors refusé
    await put(t, T_DATE, { variant: 1 });
    t.clock.now = parisDayStart(TOMORROW) + 1;
    expect((await put(t, T_DATE, { variant: 3 })).status).toBe(409);
    expect((await t.call("GET", `/api/day/${T_DATE}`)).body.variant).toBe(1);
  });

  it("entrées invalides : date, variante, thème, horizon", async () => {
    const t = await admin();
    expect((await put(t, "demain", { variant: 1 })).status).toBe(400);
    for (const variant of [-1, 1.5, "1", null, 100000]) expect((await put(t, T_DATE, { variant })).body.error).toBe("invalid_variant");
    expect((await put(t, T_DATE, { variant: 1, theme: "lave" })).body.error).toBe("invalid_theme");
    expect((await put(t, formatDay(DAY + PLANNING_HORIZON + 1), { variant: 1 })).body.error).toBe("too_far");
    expect((await put(t, T_DATE, {}, auth)).status).toBe(400);
  });

  it("revenir à l'original : DELETE, ou variante 0 sans thème", async () => {
    const t = await admin();
    await put(t, T_DATE, { variant: 2 });
    const back = await t.call("DELETE", `/api/admin/planning/${T_DATE}`, undefined, { headers: auth });
    expect(back.status).toBe(200);
    expect((await t.db.all("SELECT * FROM planning")).length).toBe(0);
    await put(t, T_DATE, { variant: 2 });
    await put(t, T_DATE, { variant: 0 });
    expect((await t.db.all("SELECT * FROM planning")).length).toBe(0);
    t.clock.now = NOON + DAY_MS;
    expect((await t.call("GET", `/api/day/${T_DATE}`)).body).toMatchObject({ variant: 0, trackId: dailyTrackId(TOMORROW) });
  });

  it("les corps trop gros sont refusés", async () => {
    const t = await admin();
    const r = await t.call("PUT", `/api/admin/planning/${T_DATE}`, undefined, { headers: auth, raw: JSON.stringify({ variant: 1, pad: "x".repeat(500_000) }) });
    expect(r.status).toBe(413);
  });
});

describe("une course sur un jour remplacé", () => {
  it("est rejouée avec la variante du planning ; l'ancien circuit est refusé", async () => {
    const t = await admin();
    await put(t, T_DATE, { variant: 1 });
    t.clock.now = TOMORROW * DAY_MS + 12 * 3_600_000; // le lendemain à midi

    const variant = dailyCircuit(TOMORROW, 1);
    const original = dailyCircuit(TOMORROW, 0);
    expect(variant.track.id).not.toBe(original.track.id);
    expect(variant.spec).not.toBe(original.spec);

    const good = runPilot(variant.track, { grip: 0.9 });
    const bad = runPilot(original.track, { grip: 0.9 });
    expect(good.valid && bad.valid).toBe(true);

    const refused = await t.call("POST", "/api/submit", { playerId: playerId(1), name: "Alice", date: T_DATE, replay: encodeReplay(bad.replay) });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("track_mismatch");

    const ok = await t.call("POST", "/api/submit", { playerId: playerId(1), name: "Alice", date: T_DATE, replay: encodeReplay(good.replay) });
    expect(ok.status).toBe(200);
    expect(ok.body.ms).toBe(good.finishMs);
  });

  it("la variante 0 est exactement le circuit d'avant (même identifiant, même texte)", () => {
    expect(dailyTrackId(TOMORROW)).toBe(dailyTrackId(TOMORROW, null, 0));
    expect(dailyCircuit(TOMORROW, 0).track.id).toBe(dailyTrackId(TOMORROW));
  });
});

describe("vue d'ensemble", () => {
  it("joueurs, meilleur temps et temps du jour", async () => {
    const t = await makeApi({ adminToken: TOKEN });
    const { pilotReplay } = await import("./helpers");
    const a = pilotReplay(DAY, 0.9);
    const b = pilotReplay(DAY, 0.7);
    for (const [n, name, code] of [[1, "Alice", a.code], [2, "Bob", b.code]] as const) {
      expect((await t.call("POST", "/api/submit", { playerId: playerId(n), name, date: formatDay(DAY), replay: code })).status).toBe(200);
    }
    const o = (await t.call("GET", "/api/admin/overview", undefined, { headers: auth })).body;
    expect(o.times).toEqual([a.finishMs, b.finishMs]);
    expect(o.days[0]).toMatchObject({ date: formatDay(DAY), participants: 2, bestMs: a.finishMs, variant: 0 });
    expect(o.days[1]).toMatchObject({ participants: 0, bestMs: null });
  });
});

describe("médailles (lot 35) : outil de calibrage en lecture seule", () => {
  /** Tout le contenu de la base, table par table : la route ne doit rien y changer. */
  async function dump(t: Awaited<ReturnType<typeof admin>>): Promise<string> {
    const tables = await t.db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    const out: Record<string, unknown> = {};
    for (const { name } of tables) out[name] = await t.db.all(`SELECT * FROM "${name}"`);
    return JSON.stringify(out);
  }

  it("refusée sans jeton ; par jour : pilote, joueurs, percentiles, parts ; par thème et tous jours réunis ; aucune écriture", async () => {
    const t = await admin();
    expect((await t.call("GET", "/api/admin/medailles")).status).toBe(401);
    const { pilotReplay } = await import("./helpers");
    const runs = [pilotReplay(DAY, 0.95), pilotReplay(DAY, 0.8), pilotReplay(DAY, 0.6)];
    for (const [i, r] of runs.entries()) expect((await t.call("POST", "/api/submit", { playerId: playerId(i + 1), name: `Pilote${i + 1}`, date: formatDay(DAY), replay: r.code })).status).toBe(200);
    // Un pilote fictif (historique de démonstration) : exclu par défaut.
    await t.db.run("UPDATE players SET demo = 1 WHERE id = ?", [playerId(3)]);
    t.clock.now = NOON + DAY_MS; // le lendemain : le jour est fermé, il entre dans les regroupements

    const before = await dump(t);
    const r = await t.call("GET", "/api/admin/medailles", undefined, { headers: auth });
    expect(r.status).toBe(200);
    expect(await dump(t)).toBe(before); // lecture seule : la base n'a pas bougé d'un octet
    expect((await t.call("POST", "/api/admin/medailles", {}, { headers: auth })).status).toBe(405);

    const c = circuitOf(DAY);
    const body = r.body;
    expect(body.today).toBe(formatDay(DAY + 1));
    expect(body.factors).toEqual(MEDAL_FACTORS);
    expect(body.percentiles).toEqual([10, 25, 50, 75, 90]);
    expect(body.days[0]).toMatchObject({ date: formatDay(DAY + 1), open: true, players: 0, pilotMs: null, stats: null }); // aujourd'hui : pas encore de circuit gardé
    const d = body.days[1];
    const times = [runs[0]!.finishMs, runs[1]!.finishMs];
    expect(d).toMatchObject({ date: formatDay(DAY), open: false, theme: themeForDay(DAY).name, trackId: c.track.id, pilotMs: c.authorMs, medals: medalsFor(c.authorMs, DAY), players: 2 });
    expect(d.stats).toEqual(medalDayStats(times, c.authorMs, medalsFor(c.authorMs, DAY)));
    expect(d.ratios).toEqual(ratiosOf(times, c.authorMs));
    expect(body.themes).toEqual([{ theme: themeForDay(DAY).name, ...medalPoolStats([{ ratios: d.ratios, thresholds: thresholdsOf(medalsFor(c.authorMs, DAY), c.authorMs) }]) }]);
    expect(body.all.players).toBe(2);
    expect(JSON.stringify(body)).not.toContain(playerId(1)); // aucune identité, aucun pseudo
    expect(JSON.stringify(body)).not.toContain("Pilote1");

    // `?demo=1` compte aussi les pilotes fictifs (la recette n'a qu'eux).
    const withDemo = (await t.call("GET", "/api/admin/medailles?demo=1", undefined, { headers: auth })).body;
    expect(withDemo.demo).toBe(true);
    expect(withDemo.days[1].players).toBe(3);
    expect(await dump(t)).toBe(before);
  });
});

describe("médailles du lot 35 : nouveaux seuils à partir de la bascule seulement", () => {
  it("le même temps : auteur avant la bascule, rien après (classement, envoi, profil, portail)", async () => {
    const t = await admin();
    const { pilotReplay } = await import("./helpers");
    for (const day of [BASCULE_LOT_35 - 1, BASCULE_LOT_35]) {
      t.clock.now = parisDayStart(day) + 12 * 3_600_000;
      const run = pilotReplay(day, 1); // le pilote lui-même : son temps = le temps du pilote du jour
      const author = circuitOf(day).authorMs;
      const sub = await t.call("POST", "/api/submit", { name: `Pilote${day % 1000}`, date: formatDay(day), replay: run.code }, { headers: { "X-Player-Id": playerId(day) } });
      expect(sub.status).toBe(200);
      const expected = medalFor(sub.body.ms, medalsFor(author, day));
      expect(sub.body.medal).toBe(expected);
      if (day < BASCULE_LOT_35) expect(expected).not.toBeNull();
      else expect(expected).toBeNull(); // bronze à 0,95 du pilote : rouler comme lui ne suffit plus
      const board = await t.call("GET", `/api/day/${formatDay(day)}/leaderboard`);
      expect(board.body.top[0].medal).toBe(expected);
      const me = await t.call("GET", "/api/me", undefined, { headers: { "X-Player-Id": playerId(day) } });
      expect(me.body.best.medal).toBe(expected);
      const portail = (await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": playerId(day) } })).body;
      const track = portail.jeux.find((j: { jeu: string }) => j.jeu === "cdj");
      expect(track.seuils).toEqual(medalsFor(author, day));
      expect(track.etat.medaille).toBe(expected);
      const admin = (await t.call("GET", "/api/admin/medailles", undefined, { headers: auth })).body;
      expect(admin.days[0].medals).toEqual(medalsFor(author, day));
    }
  });
});

// --- Lot 41 : le Garage (les déblocages viennent du serveur) -------------------------------------------------------------------------------
// Ces tests vivent ici parce que la zone de Track dans apps/api est une liste fermée (scripts/zones-jeu.mjs) : décision de Nathan (option b du lot 41).
describe("Garage (lot 41) : GET /api/garage et le statut rendu par l'envoi", () => {
  const ID = playerId(4100);
  const moi = { headers: { "X-Player-Id": ID } };
  const PILOTE = 40_000;
  /** Un jour passé avec un temps rejoué (écrit comme le serveur l'aurait gardé) : la médaille voulue selon les seuils de CE jour. */
  async function jourPasse(t: TestApi, day: number, medaille: "author" | "gold" | "silver" | null, id = ID) {
    const m = medalsFor(PILOTE, day);
    const ms = medaille === "author" ? m.author : medaille === "gold" ? m.gold : medaille === "silver" ? m.silver : m.bronze + 500;
    await t.db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, `jour-${formatDay(day)}`, "S", PILOTE, 0, "stade", NOON]);
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, id, ms, "[]", "x", 0, NOON]);
  }
  const garage = (t: TestApi, opts = moi) => t.call("GET", "/api/garage", undefined, opts);

  it("l'en-tête X-Player-Id est obligatoire (jamais l'identifiant dans l'adresse) ; une autre méthode est refusée", async () => {
    const t = await makeApi();
    expect((await t.call("GET", "/api/garage", undefined, {})).status).toBe(400);
    expect((await t.call("GET", `/api/garage?player=${ID}`, undefined, {})).body.error).toBe("invalid_player");
    expect((await garage(t, { headers: { "X-Player-Id": "pas-un-identifiant" } })).status).toBe(400);
    expect((await t.call("POST", "/api/garage", {}, moi)).status).toBe(405);
  });

  it("un joueur jamais classé : la civile seulement, tout à zéro (aucune écriture)", async () => {
    const t = await makeApi();
    const r = await garage(t);
    expect(r.status).toBe(200);
    expect(r.body.progres).toEqual({ jours: 0, or: 0, auteur: 0 });
    expect(r.body.voitures.filter((v: { debloquee: boolean }) => v.debloquee).map((v: { id: string }) => v.id)).toEqual(["civile"]);
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    expect(await t.db.first("SELECT 1 AS x FROM players WHERE id = ?", [ID])).toBeNull();
  });

  it("les jours passés comptent : les joueurs actuels retrouvent ce qu'ils ont déjà gagné ; règles et progression", async () => {
    const t = await makeApi();
    for (let i = 1; i <= 9; i++) await jourPasse(t, DAY - i, i <= 3 ? "gold" : i === 4 ? "silver" : null);
    let r = await garage(t);
    expect(r.body.progres).toEqual({ jours: 9, or: 3, auteur: 0 });
    expect(r.body.voitures).toEqual([
      { id: "civile", debloquee: true, progres: null },
      { id: "fourgon", debloquee: true, progres: { fait: 3, nombre: 3 } },
      { id: "evolution", debloquee: true, progres: { fait: 3, nombre: 3 } },
      { id: "rallye", debloquee: true, progres: { fait: 7, nombre: 7 } },
      { id: "gt", debloquee: false, progres: { fait: 9, nombre: 10 } },
      { id: "roadster", debloquee: false, progres: { fait: 9, nombre: 14 } },
      { id: "pickup", debloquee: false, progres: { fait: 3, nombre: 6 } },
      { id: "proto", debloquee: false, progres: { fait: 0, nombre: 1 } },
      { id: "muscle", debloquee: false, progres: { fait: 9, nombre: 30 } },
      { id: "monoplace", debloquee: false, progres: { fait: 0, nombre: 3 } },
    ]);
    await jourPasse(t, DAY - 10, "author");
    r = await garage(t);
    expect(r.body.progres).toEqual({ jours: 10, or: 4, auteur: 1 });
    const debloquees = () => r.body.voitures.filter((v: { debloquee: boolean }) => v.debloquee).map((v: { id: string }) => v.id);
    expect(debloquees()).toEqual(["civile", "fourgon", "evolution", "rallye", "gt", "proto"]);
    // Les temps d'un autre joueur ne comptent pas pour moi.
    await jourPasse(t, DAY - 11, "author", playerId(4101));
    expect((await garage(t)).body.progres).toEqual({ jours: 10, or: 4, auteur: 1 });
    // Lot 42 : les voitures de prestige — 30 jours joués (muscle car), 3 médailles d'auteur (monoplace) ; 6 ors pour le pick-up, 14 jours pour le roadster.
    for (let i = 11; i <= 30; i++) await jourPasse(t, DAY - i, i <= 12 ? "author" : i <= 13 ? "gold" : null);
    r = await garage(t);
    expect(r.body.progres).toEqual({ jours: 30, or: 7, auteur: 3 });
    expect(r.body.voitures.every((v: { debloquee: boolean }) => v.debloquee)).toBe(true);
  });

  it("une médaille compte avec les seuils de son jour (bascule du 28/10)", async () => {
    const t = await makeApi();
    const ms = Math.round(PILOTE * 1.05); // or avant la bascule, rien après
    for (const day of [BASCULE_LOT_35 - 1, BASCULE_LOT_35]) {
      await t.db.run("INSERT INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, `jour-${formatDay(day)}`, "S", PILOTE, 0, "stade", NOON]);
      await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, ID, ms, "[]", "x", 0, NOON]);
    }
    expect((await garage(t)).body.progres).toEqual({ jours: 2, or: 1, auteur: 0 });
  });

  it("seuls les temps rejoués du circuit du jour comptent : ni le Salon, ni un temps annoncé, ni une rediffusion refusée", async () => {
    const t = await makeApi();
    // Une course du Salon (même excellente) n'est pas un circuit du jour.
    await t.db.run("INSERT INTO salon_runs (session, player_id, ref, name, ms, splits, replay, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [1, ID, "ref", "Garage", 1, "[]", "x", NOON]);
    // Un envoi refusé (rediffusion illisible, temps annoncé) n'écrit rien.
    const refuse = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: "pas-une-rediffusion", ms: 1, medal: "author" }, moi);
    expect(refuse.status).toBeGreaterThanOrEqual(400);
    expect((await garage(t)).body.progres).toEqual({ jours: 0, or: 0, auteur: 0 });
  });

  it("l'envoi d'un temps rend le statut du Garage et les voitures qu'il débloque ; rien de neuf au second envoi", async () => {
    const t = await makeApi();
    for (let i = 1; i <= 9; i++) await jourPasse(t, DAY - i, null); // 9 jours joués, aucune médaille
    const run = pilotReplay(DAY, 0.78);
    const r = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: run.code }, moi);
    expect(r.status).toBe(200);
    // Ce que l'envoi a rejoué compte (10 jours) ; la médaille est celle du serveur, avec les seuils du jour.
    const medaille = medalFor(r.body.ms, medalsFor(circuitOf(DAY).authorMs, DAY));
    const attendu = progresGarage([...Array.from({ length: 9 }, (_, i) => ({ day: DAY - i - 1, ms: 1e9, authorMs: PILOTE })), { day: DAY, ms: r.body.ms, authorMs: circuitOf(DAY).authorMs }]);
    expect(attendu.jours).toBe(10);
    expect(r.body.garage.progres).toEqual(attendu);
    expect(r.body.garage.voitures).toEqual(etatGarage(attendu));
    expect(r.body.garage.nouvelles).toEqual(nouvellesVoitures({ jours: 9, or: 0, auteur: 0 }, attendu));
    expect(r.body.garage.nouvelles).toContain("gt");
    expect(r.body.garage.nouvelles.includes("proto")).toBe(medaille === "author");
    // Le même temps renvoyé : pas meilleur, rien de neuf ; le Garage le confirme.
    const encore = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: run.code }, moi);
    expect(encore.body.improved).toBe(false);
    expect(encore.body.garage.nouvelles).toEqual([]);
    expect((await garage(t)).body.progres).toEqual(attendu);
  });

  it("un meilleur temps du même jour ne redébloque pas ce qui l'était déjà par ce jour", async () => {
    const t = await makeApi();
    for (let i = 1; i <= 9; i++) await jourPasse(t, DAY - i, null);
    const lent = pilotReplay(DAY, 0.55);
    const vite = pilotReplay(DAY, 0.9);
    const a = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: lent.code }, moi);
    expect(a.body.garage.nouvelles).toContain("gt");
    const b = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: vite.code }, moi);
    expect(b.body.improved).toBe(true);
    expect(b.body.garage.nouvelles).not.toContain("gt"); // le 10e jour était déjà joué
  });

  it("un code remplacé est refusé (410)", async () => {
    const t = await makeApi();
    const run = pilotReplay(DAY, 0.78);
    expect((await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: run.code }, moi)).status).toBe(200);
    expect((await t.call("POST", "/api/me/code", { newId: playerId(4199) }, moi)).status).toBe(200);
    expect((await garage(t)).status).toBe(410);
    // Les temps suivent le nouveau code.
    expect((await garage(t, { headers: { "X-Player-Id": playerId(4199) } })).body.progres.jours).toBe(1);
  });

  it("recette seulement : un joueur de démonstration (« Démo » de recette:seed) a toutes les voitures ; jamais un vrai joueur, jamais hors de la recette", async () => {
    const debloquees = (voitures: { debloquee: boolean }[]) => voitures.filter((v) => v.debloquee).length;
    const run = pilotReplay(DAY, 0.78);
    // La recette, un joueur créé comme recette:seed le crée (`demoPlayers` : players.demo = 1).
    const recette = await makeApi({ environment: "recette", demoPlayers: true });
    const envoi = await recette.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: run.code }, moi);
    expect(envoi.status).toBe(200);
    expect(debloquees(envoi.body.garage.voitures)).toBe(10);
    expect(envoi.body.garage.nouvelles).toEqual([]);
    const g = await garage(recette);
    expect(debloquees(g.body.voitures)).toBe(10);
    expect(g.body.progres).toEqual(envoi.body.garage.progres); // la progression rendue reste la vraie
    expect(g.body.progres.jours).toBe(1);
    // Un vrai joueur de la recette (players.demo = 0) : ses vrais déblocages.
    const vrai = playerId(4102);
    await recette.db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, ?, ?, ?, 0, ?)", [vrai, "Vrai", NOON, NOON, "vrai"]);
    await jourPasse(recette, DAY - 1, "gold", vrai);
    expect(debloquees((await garage(recette, { headers: { "X-Player-Id": vrai } })).body.voitures)).toBe(1);
    // Le même joueur de démonstration hors de la recette (production, local) : rien de plus que ce qu'il a gagné.
    for (const environment of ["production", "local"]) {
      const t = await makeApi({ environment, demoPlayers: true });
      const r = await t.call("POST", "/api/submit", { name: "Garage", date: formatDay(DAY), replay: run.code }, moi);
      expect(r.status).toBe(200);
      expect(r.body.garage.voitures).toEqual(etatGarage(r.body.garage.progres));
      expect(debloquees((await garage(t)).body.voitures)).toBe(1);
    }
  });
});
