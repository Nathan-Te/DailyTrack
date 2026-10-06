import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDay } from "@cdj/sim";
import { createApi } from "../src/api";
import { SCHEMA } from "../src/db";
import { createNodeServer } from "../src/node-server";
import { openSqlite } from "../src/node-sqlite";
import { DAY, NOON, circuitOf, pilotReplay, playerId } from "./helpers";

// Le vrai serveur HTTP Node (celui du conteneur Docker), de bout en bout : deux « appareils », deux temps, un classement.
const DATE = formatDay(DAY);
const fast = pilotReplay(DAY, 30);
const slow = pilotReplay(DAY, 22);

let base = "";
let close: () => Promise<void>;

beforeAll(async () => {
  const db = openSqlite(":memory:");
  for (const sql of SCHEMA) await db.run(sql);
  const c = circuitOf(DAY);
  await db.run("INSERT INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [DAY, c.track.id, c.spec, c.authorMs, c.attempt, c.palette, NOON]);
  const server = createNodeServer(createApi({ db, now: () => NOON, allowOrigin: "https://nathan-te.github.io" }), { trustProxy: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((resolve) => server.close(() => resolve()));
});
afterAll(() => close());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("serveur HTTP Node", () => {
  it("deux appareils, deux temps, un classement", async () => {
    // Appareil de Bob : un temps plus lent.
    const b = await post("/api/submit", { playerId: playerId(2), name: "Bob", date: DATE, replay: slow.code });
    expect(b.status).toBe(200);
    expect(await b.json()).toMatchObject({ ms: slow.finishMs, rank: 1, participants: 1 });
    // Appareil d'Alice : un meilleur temps.
    const a = await post("/api/submit", { playerId: playerId(1), name: "Alice", date: DATE, replay: fast.code });
    expect(await a.json()).toMatchObject({ ms: fast.finishMs, rank: 1, participants: 2 });

    // Chacun voit le même classement, et sa propre place.
    const forBob = await (await fetch(`${base}/api/day/${DATE}/leaderboard?player=${playerId(2)}`)).json();
    expect(forBob.top.map((r: { name: string }) => r.name)).toEqual(["Alice", "Bob"]);
    expect(forBob.me).toMatchObject({ name: "Bob", rank: 2 });
    const forAlice = await (await fetch(`${base}/api/day/${DATE}/leaderboard?player=${playerId(1)}`)).json();
    expect(forAlice.me).toMatchObject({ name: "Alice", rank: 1 });

    // Le fantôme du premier est celui d'Alice.
    const ghost = await (await fetch(`${base}/api/day/${DATE}/ghost?kind=first`)).json();
    expect(ghost).toMatchObject({ name: "Alice", ms: fast.finishMs, replay: fast.code });
  });

  it("répond aux requêtes préalables CORS du jeu hébergé ailleurs", async () => {
    const res = await fetch(`${base}/api/submit`, { method: "OPTIONS", headers: { Origin: "https://nathan-te.github.io", "Access-Control-Request-Method": "POST" } });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://nathan-te.github.io");
  });

  it("refuse un corps énorme envoyé en flux, sans le charger en mémoire", async () => {
    const chunk = new TextEncoder().encode("A".repeat(100_000));
    let sent = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (sent++ < 20) controller.enqueue(chunk); // 2 Mo, sans Content-Length
        else controller.close();
      },
    });
    const res = await fetch(base + "/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half" } as RequestInit);
    expect(res.status).toBe(413);
  });

  it("répond en JSON aux routes inconnues et à /api/health", async () => {
    expect((await fetch(base + "/api/health")).status).toBe(200);
    const res = await fetch(base + "/nimporte-quoi");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });
});
