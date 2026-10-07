import {
  daysFromCivil,
  decodeReplay,
  encodeReplay,
  dailyCircuit,
  runPilot,
  type DailyCircuit,
  type Replay,
} from "@cdj/sim";
import { createApi, type ApiOptions } from "../src/api";
import type { SqlDb } from "../src/db";
import { openSqlite } from "../src/node-sqlite";

export const DAY_MS = 86_400_000;
/**
 * Jour de test : le 09/10/2026 (fixe : indépendant de `PREMIER_JOUR`, qui ne change que la numérotation). L'horloge de l'API est
 * réglée sur midi UTC de ce jour. Choisi au lot 17 (le 13/10 de ce jour-là donnait des temps non monotones selon le niveau du pilote) :
 * un circuit où plus le pilote est prudent, plus il est lent (les tests de classement comptent sur cet ordre).
 */
export const DAY = daysFromCivil(2026, 10, 9);
export const NOON = DAY * DAY_MS + 12 * 3_600_000;

const circuits = new Map<number, DailyCircuit>();
/** Circuit du jour (calculé une seule fois par fichier de test : le générateur est coûteux). */
export function circuitOf(day: number): DailyCircuit {
  let c = circuits.get(day);
  if (!c) circuits.set(day, (c = dailyCircuit(day)));
  return c;
}

/** Une rediffusion valide du jour, avec le pilote réglé sur `grip` (part de l'adhérence utilisée : plus bas = plus lent). */
export function pilotReplay(day: number, grip: number): { code: string; replay: Replay; finishMs: number } {
  const run = runPilot(circuitOf(day).track, { grip });
  if (!run.valid) throw new Error("le pilote ne finit pas ce circuit");
  return { code: encodeReplay(run.replay), replay: run.replay, finishMs: run.finishMs };
}

export const playerId = (n: number) => n.toString(16).padStart(32, "0");

export interface TestApi {
  db: SqlDb & { close(): void };
  clock: { now: number };
  api: ReturnType<typeof createApi>;
  call(method: string, path: string, body?: unknown, opts?: { raw?: string; clientKey?: string; headers?: Record<string, string> }): Promise<{ status: number; body: any; headers: Headers }>;
}

/** API de test : SQLite en mémoire, horloge réglable, circuit du jour déjà en cache (sauf `seed: false`). */
export async function makeApi(options: Partial<ApiOptions> & { seed?: boolean } = {}): Promise<TestApi> {
  const db = options.db ? (options.db as TestApi["db"]) : openSqlite(":memory:");
  const clock = { now: NOON };
  const api = createApi({ db, now: () => clock.now, ...options });
  if (options.seed !== false) {
    // On amorce le cache comme le ferait un premier appel, pour ne pas régénérer le circuit à chaque test.
    const { SCHEMA } = await import("../src/db");
    for (const sql of SCHEMA) await db.run(sql);
    const c = circuitOf(DAY);
    await db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      DAY,
      c.track.id,
      c.spec,
      c.authorMs,
      c.attempt,
      c.palette,
      NOON,
    ]);
  }
  return {
    db,
    clock,
    api,
    async call(method, path, body, opts = {}) {
      const init: RequestInit = { method, headers: { ...(body !== undefined || opts.raw !== undefined ? { "Content-Type": "application/json" } : {}), ...opts.headers } };
      if (opts.raw !== undefined) init.body = opts.raw;
      else if (body !== undefined) init.body = JSON.stringify(body);
      const res = await api.handle(new Request(`http://api.test${path}`, init), { clientKey: opts.clientKey ?? "203.0.113.7" });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
    },
  };
}

export { decodeReplay, encodeReplay };
