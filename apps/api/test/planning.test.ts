import { describe, expect, it } from "vitest";
import { dailyCircuit, dailyTrackId, encodeReplay, formatDay, runPilot, themeForDay, THEME_NAMES } from "@cdj/sim";
import { ADMIN_MAX_FAILURES, PLANNING_HORIZON } from "../src/api";
import { DAY, DAY_MS, NOON, makeApi, playerId } from "./helpers";

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
    expect(r.body.days).toHaveLength(15); // aujourd'hui + quatorze jours passés
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
    t.clock.now = (TOMORROW * DAY_MS) + 1;
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
