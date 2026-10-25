import { SIM_VERSION, encodeReplay, formatDay } from "@cdj/sim";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "../src/api";
import { adminTokenWarning } from "../src/config";
import { BOARD_READS_PER_CLIENT } from "../src/cdj";
import { REPLAY_TICKS_PER_UNIT, replayUnits } from "../src/replayCost";
import { DAY, circuitOf, makeApi, pilotReplay, playerId } from "./helpers";

// Lot R7 (audit de sécurité) : ce que le serveur a gagné (docs/plateforme/audit-securite-2026-10.md).

describe("le plafond de rejeux compte la durée du rejeu", () => {
  it("une course normale coûte une unité, la pire rediffusion permise en coûte quinze", () => {
    expect(replayUnits([{ count: 4200 }])).toBe(1);
    expect(replayUnits([{ count: REPLAY_TICKS_PER_UNIT }])).toBe(1);
    expect(replayUnits([{ count: REPLAY_TICKS_PER_UNIT + 1 }])).toBe(2);
    expect(replayUnits([{ count: 72_000 }])).toBe(15);
    expect(replayUnits([{ count: 1 }, { count: 1 }])).toBe(1);
    expect(replayUnits([])).toBe(1);
  });

  it("une rediffusion qui ne finit jamais (72 000 pas) épuise vite le plafond ; une vraie course passe encore", async () => {
    const t = await makeApi({ replaysPerMinute: 20 });
    const date = formatDay(DAY);
    const stalled = encodeReplay({ simVersion: SIM_VERSION, trackId: circuitOf(DAY).track.id, runs: [{ count: 72_000, steer: 0, throttle: 0, brake: 0, respawn: 0 }] });
    const send = (n: number, replay: string, clientKey: string) => t.call("POST", "/api/submit", { name: `Pilote${n}`, date, replay }, { headers: { "X-Player-Id": playerId(n) }, clientKey });
    expect((await send(1, stalled, "203.0.113.1")).status).toBe(422); // rejouée (15 unités sur 20), pas arrivée
    const refused = await send(2, stalled, "203.0.113.2"); // 15 de plus : au-delà du plafond, sans rejeu
    expect(refused.status).toBe(503);
    expect(refused.body.error).toBe("busy");
    expect(refused.headers.get("Retry-After")).toBeTruthy();
    // une vraie course (une unité) tient dans ce qui reste
    expect((await send(3, pilotReplay(DAY, 1).code, "203.0.113.3")).status).toBe(200);
    // la minute suivante, le plafond est remis à zéro
    t.clock.now += 61_000;
    expect((await send(4, stalled, "203.0.113.4")).status).toBe(422);
  });
});

describe("lectures du classement et des fantômes", () => {
  it("limitées par adresse (elles lisent tous les temps du jour) ; les autres adresses ne sont pas touchées", async () => {
    const t = await makeApi();
    const path = `/api/day/${formatDay(DAY)}/leaderboard`;
    for (let i = 0; i < BOARD_READS_PER_CLIENT; i++) expect((await t.call("GET", path)).status).toBe(200);
    const refused = await t.call("GET", path);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBeTruthy();
    expect((await t.call("GET", `/api/day/${formatDay(DAY)}/ghost?kind=first`)).status).toBe(429); // même compteur
    expect((await t.call("GET", path, undefined, { clientKey: "198.51.100.77" })).status).toBe(200);
    t.clock.now += 11 * 60_000;
    expect((await t.call("GET", path)).status).toBe(200);
  });
});

describe("l'administration est journalisée sans jeton ni adresse", () => {
  const TOKEN = "jeton-de-test-0123456789";
  it("un jeton refusé, un circuit remplacé et rétabli : une ligne chacun, rien d'identifiant", async () => {
    const lines: string[] = [];
    const t = await makeApi({ adminToken: TOKEN, log: (level, message, fields) => lines.push(JSON.stringify({ level, message, ...fields })) });
    const tomorrow = formatDay(DAY + 1);
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: "Bearer jeton-mauvais-0123456789" }, clientKey: "203.0.113.55" })).status).toBe(401);
    const auth = { Authorization: `Bearer ${TOKEN}` };
    expect((await t.call("PUT", `/api/admin/planning/${tomorrow}`, { variant: 2 }, { headers: auth })).status).toBe(200);
    expect((await t.call("DELETE", `/api/admin/planning/${tomorrow}`, undefined, { headers: auth })).status).toBe(200);
    const all = lines.join("\n");
    expect(all).toContain("admin : jeton refusé");
    expect(all).toContain("admin : circuit remplacé");
    expect(all).toContain("admin : circuit d'origine rétabli");
    expect(all).toContain(tomorrow);
    for (const secret of [TOKEN, "jeton-mauvais-0123456789", "203.0.113.55", "Bearer"]) expect(all, secret).not.toContain(secret);
  });
});

describe("jeton d'administration", () => {
  it("le jeton ne passe jamais par l'adresse (`?token=` est ignoré) ni sans le préfixe Bearer", async () => {
    const t = await makeApi({ adminToken: "jeton-de-test-0123456789" });
    expect((await t.call("GET", "/api/admin/overview?token=jeton-de-test-0123456789")).status).toBe(401);
    expect((await t.call("GET", "/api/admin/overview", undefined, { headers: { Authorization: "jeton-de-test-0123456789" } })).status).toBe(401);
    expect((await t.call("GET", "/api/admin/inconnue", undefined, { headers: { Authorization: "Bearer jeton-de-test-0123456789" } })).status).toBe(404);
  });

  it("le journal de démarrage signale un jeton faible sans le répéter", () => {
    expect(adminTokenWarning(undefined)).toBeNull();
    expect(adminTokenWarning("")).toBeNull();
    expect(adminTokenWarning("court")).toContain("désactivée");
    expect(adminTokenWarning("a".repeat(24))).toContain("32 caractères");
    expect(adminTokenWarning("a".repeat(48))).toBeNull();
    expect(adminTokenWarning("secret-secret-secret-1")).not.toContain("secret-secret");
  });
});

describe("en-têtes de toute réponse de l'API", () => {
  it("nosniff, aucune ressource chargeable, aucun cadre, pas de référent", async () => {
    const t = await makeApi();
    for (const path of ["/api/health", "/api/planning", "/api/introuvable"]) {
      const r = await t.call("GET", path);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(r.headers.get(k), `${path} ${k}`).toBe(v);
    }
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("default-src 'none'");
  });
});
