import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDay } from "@cdj/sim";
import { createApi } from "../src/api";
import { SCHEMA } from "../src/db";
import type { Logger } from "../src/log";
import { readConfig } from "../src/config";
import { createNodeServer, isPublicAddress, peerFromForwarded } from "../src/node-server";
import { PEER_FACTOR, REPLAYS_PER_MINUTE } from "../src/platform";
import { DAY, NOON, TEST_DB, makeApi, openTestDb, pilotReplay, playerId } from "./helpers";

// Lot R5 (plateforme) : la faille d'adresse du lot R4. Derrière Firebase, `TRUST_PROXY` = 2 (mesuré sur la recette) : l'adresse du joueur est
// l'avant-dernière entrée de `X-Forwarded-For`. Un appel DIRECT à `run.app` y met ce qu'il veut ; seule la dernière entrée (écrite par le
// frontal de Google : l'adresse qui a ouvert la connexion) ne se falsifie pas. Elle est maintenant comptée dans chaque limite par adresse
// (× PEER_FACTOR, en mémoire), et un plafond global de rejeux par minute et par instance rend 503 au-delà. SQLite et libSQL.
const DATE = formatDay(DAY);
const NAME_LIMIT = 40; // NAME_CHECKS_PER_WINDOW (identity.ts)

describe("l'adresse de connexion (dernière entrée de X-Forwarded-For)", () => {
  it("est l'entrée écrite par le dernier proxy, jamais ce que le client a écrit avant", () => {
    expect(peerFromForwarded("198.51.100.7, 203.0.113.9")).toBe("203.0.113.9");
    expect(peerFromForwarded("203.0.113.9")).toBe("203.0.113.9");
    expect(peerFromForwarded(["198.51.100.7", "203.0.113.9"])).toBe("203.0.113.9");
    expect(peerFromForwarded(undefined)).toBeUndefined();
  });
});

describe("seule une adresse de connexion publique est comptée", () => {
  it("0.0.0.0 (mesuré sur la recette pour un appel venu du réseau de Google), privées, locales, réservées : jamais comptées", () => {
    for (const ip of ["203.0.113.9", "35.191.0.1", "8.8.8.8", "2001:4860:4860::8888", "::ffff:8.8.8.8", "[2001:db8::1]"]) expect(isPublicAddress(ip), ip).toBe(true);
    for (const ip of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.1.1", "172.16.0.1", "172.31.255.1", "192.168.1.1", "100.64.0.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "inconnu", "", "300.1.1.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("PEER_FACTOR : 10 par défaut, 0 coupe, hors de 0–100 refusé", () => {
    expect(readConfig({}).peerFactor).toBe(10);
    expect(readConfig({ PEER_FACTOR: "0" }).peerFactor).toBe(0);
    expect(() => readConfig({ PEER_FACTOR: "-1" })).toThrow(/PEER_FACTOR/);
    expect(() => readConfig({ PEER_FACTOR: "1.5" })).toThrow(/PEER_FACTOR/);
  });

  it("PEER_FACTOR = 0 : l'adresse de connexion n'est plus comptée", async () => {
    const t = await makeApi({ seed: false, peerFactor: 0 });
    for (let i = 0; i <= NAME_LIMIT * PEER_FACTOR; i++) expect((await t.call("GET", `/api/name?name=Z${i}`, undefined, { clientKey: `198.18.1.${i % 250}-${i}`, peerKey: "203.0.113.60" })).status).toBe(200);
  });
});

describe(`appel direct avec des adresses inventées, par le vrai serveur HTTP (TRUST_PROXY=2, ${TEST_DB})`, () => {
  let base = "";
  let close: () => Promise<void>;
  beforeAll(async () => {
    const db = await openTestDb();
    for (const sql of SCHEMA) await db.run(sql);
    const server = createNodeServer(createApi({ db, now: () => NOON, environment: "recette" }), { trustProxy: 2 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => server.close(() => resolve()));
  });
  afterAll(() => close());

  // Ce que Cloud Run transmet d'un appel direct : l'en-tête inventé par le client, puis l'adresse réelle ajoutée par le frontal de Google.
  const direct = (forged: string, real = "203.0.113.9") => ({ "X-Forwarded-For": `${forged}, ${real}` });
  const nameCheck = (i: number, headers: Record<string, string>) => fetch(`${base}/api/name?name=Sonde${i}`, { headers }).then((r) => r.status);

  it("une adresse inventée différente à chaque appel ne contourne plus la limite : refus au plus tard après 40 × PEER_FACTOR appels", async () => {
    let first = 0;
    for (let i = 1; i <= NAME_LIMIT * PEER_FACTOR + 1 && !first; i++) if ((await nameCheck(i, direct(`198.18.${i >> 8}.${i & 255}`))) === 429) first = i;
    expect(first).toBe(NAME_LIMIT * PEER_FACTOR + 1);
    // Une autre adresse de connexion (un autre appelant) n'est pas touchée.
    expect(await nameCheck(0, direct("198.18.200.1", "203.0.113.10"))).toBe(200);
  });

  it("une adresse de connexion qui n'est pas publique (0.0.0.0) n'est pas comptée : seule l'adresse lue l'est, comme avant le lot R5", async () => {
    for (let i = 1; i <= NAME_LIMIT * PEER_FACTOR + 1; i++) expect(await nameCheck(i, direct(`198.18.100.${i & 255}-${i}`, "0.0.0.0")), `appel ${i}`).toBe(200);
  });

  it("la même adresse inventée est limitée comme avant (40), et la route de sonde dit ce que le serveur a reçu (recette seulement)", async () => {
    let first = 0;
    for (let i = 1; i <= NAME_LIMIT + 1 && !first; i++) if ((await nameCheck(i, direct("198.51.100.77", "203.0.113.11"))) === 429) first = i;
    expect(first).toBe(NAME_LIMIT + 1);
    const probe = await fetch(`${base}/api/sonde/entetes`, { headers: { ...direct("198.51.100.1", "203.0.113.12"), "X-Forwarded-Host": "recette.playdujour.com" } });
    expect(probe.status).toBe(200);
    const body = await probe.json();
    expect(body).toMatchObject({ relais: 2, connexion: "203.0.113.12", adresseLueEgaleConnexion: false, hoteTransmis: "recette.playdujour.com", xForwardedFor: "198.51.100.1, 203.0.113.12" });
    expect(body.entetes).toContain("x-forwarded-for");
  });
});

describe(`par Firebase : des joueurs différents derrière le même relais (${TEST_DB})`, () => {
  it("chaque joueur garde sa limite ; le relais partagé n'est limité qu'à PEER_FACTOR fois la limite", async () => {
    const t = await makeApi({ seed: false });
    const relay = "35.191.0.1";
    for (let i = 0; i < NAME_LIMIT * PEER_FACTOR; i++) {
      const r = await t.call("GET", `/api/name?name=Joueur${i}`, undefined, { clientKey: `192.0.2.${i % 200}-${i}`, peerKey: relay });
      expect(r.status, `appel ${i + 1}`).toBe(200);
    }
    const over = await t.call("GET", "/api/name?name=Joueur", undefined, { clientKey: "192.0.2.250", peerKey: relay });
    expect(over.status).toBe(429);
    expect(over.headers.get("Retry-After")).toBeTruthy();
  });

  it("sans proxy (local, tests e2e) ou quand l'adresse lue est l'adresse de connexion : rien n'est compté deux fois", async () => {
    const t = await makeApi({ seed: false });
    for (let i = 0; i < NAME_LIMIT; i++) expect((await t.call("GET", `/api/name?name=A${i}`, undefined, { clientKey: "192.0.2.1", peerKey: "192.0.2.1" })).status).toBe(200);
    expect((await t.call("GET", "/api/name?name=A", undefined, { clientKey: "192.0.2.1", peerKey: "192.0.2.1" })).status).toBe(429);
  });

  it("les envois (classement du jour) comptent aussi l'adresse de connexion, avant tout rejeu", async () => {
    const t = await makeApi({ limits: { windowMs: 600_000, perClient: 2, perPlayer: 100 } });
    const run = pilotReplay(DAY, 0.7);
    const results: number[] = [];
    for (let i = 0; i < 2 * PEER_FACTOR + 1; i++) {
      const r = await t.call("POST", "/api/submit", { playerId: playerId(500 + i), name: `Pair${i}`, date: DATE, replay: run.code }, { clientKey: `198.18.0.${i}`, peerKey: "203.0.113.50" });
      results.push(r.status);
    }
    expect(results.slice(0, 2 * PEER_FACTOR).every((s) => s === 200)).toBe(true);
    expect(results.at(-1)).toBe(429);
  });
});

describe(`plafond global de rejeux par minute et par instance (${TEST_DB})`, () => {
  it("au-delà du plafond : 503 `busy` propre avec Retry-After, sans rejeu ; la minute suivante, de nouveau accepté", async () => {
    const lines: string[] = [];
    const log: Logger = (_severity, message) => void lines.push(message);
    const t = await makeApi({ replaysPerMinute: 2, log });
    const run = pilotReplay(DAY, 0.7);
    const send = (n: number) => t.call("POST", "/api/submit", { playerId: playerId(n), name: `Plafond${n}`, date: DATE, replay: run.code }, { clientKey: `192.0.2.${n}` });
    expect((await send(1)).status).toBe(200);
    expect((await send(2)).status).toBe(200);
    // Les vérifications bon marché passent avant le plafond : une rediffusion illisible est refusée sans rien consommer.
    const stale = await t.call("POST", "/api/submit", { playerId: playerId(9), name: "Vieux", date: DATE, replay: run.code.replace(/^[^.]*/, "x") }, { clientKey: "192.0.2.9" });
    expect(stale.status).toBe(400);
    const busy = await send(3);
    expect(busy.status).toBe(503);
    expect(busy.body.error).toBe("busy");
    expect(Number(busy.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ?", [playerId(3)])).toBeNull();
    expect(lines).toContain("plafond de rejeux atteint");
    t.clock.now += 60_000;
    expect((await send(3)).status).toBe(200);
  });

  it("le serveur de production le règle (server.ts) ; createApi sans réglage n'en a pas (outils de démonstration en mémoire)", async () => {
    expect(REPLAYS_PER_MINUTE).toBe(600);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(new URL("../src/server.ts", import.meta.url), "utf8")).toMatch(/replaysPerMinute: REPLAYS_PER_MINUTE/);
    const t = await makeApi();
    const run = pilotReplay(DAY, 0.7);
    for (let n = 1; n <= 3; n++) expect((await t.call("POST", "/api/submit", { playerId: playerId(n), name: `Libre${n}`, date: DATE, replay: run.code })).status).toBe(200);
  });
});

describe(`route de sonde des en-têtes : recette seulement (${TEST_DB})`, () => {
  it("404 en production et en local ; n'écrit rien", async () => {
    for (const environment of ["production", "local"]) {
      const t = await makeApi({ seed: false, environment });
      expect((await t.call("GET", "/api/sonde/entetes")).status).toBe(404);
    }
    const t = await makeApi({ seed: false, environment: "recette" });
    const r = await t.call("GET", "/api/sonde/entetes", undefined, { clientKey: "192.0.2.1", peerKey: "203.0.113.1" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ relais: 0, connexion: "203.0.113.1", adresseLueEgaleConnexion: false });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});
