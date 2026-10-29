import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  daysFromCivil,
  decodeReplay,
  encodeReplay,
  dailyCircuit,
  runPilot,
  type DailyCircuit,
  salonCircuit,
  salonSessionAt,
  replayTicks,
  type Replay,
  type SalonCircuit,
} from "@cdj/sim";
import { inputsHash, trackInputs } from "../src/copies";
import { createApi, type ApiOptions } from "../src/api";
import { CODES_ERREUR, estCodeErreur } from "../src/codesErreur";
import type { SqlDb } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { openSqlite } from "../src/node-sqlite";
import { surveiller } from "./enregistreur";

export const DAY_MS = 86_400_000;

// « Aujourd'hui » est la date à Paris (lot 31) : les tests de passage d'un jour à l'autre partent de minuit de Paris, pas de minuit UTC.
export { parisDay, parisDayStart } from "@cdj/clock";

/** Base sur laquelle tournent les tests d'API : SQLite (`node:sqlite`, défaut) ou libSQL (`CDJ_TEST_DB=libsql` : projet « libsql » de vitest). */
export const TEST_DB = process.env.CDJ_TEST_DB === "libsql" ? "libsql" : "sqlite";

const libsqlDir = TEST_DB === "libsql" ? mkdtempSync(join(tmpdir(), "cdj-libsql-")) : "";
let libsqlCount = 0;
if (libsqlDir) process.on("exit", () => rmSync(libsqlDir, { recursive: true, force: true }));

/**
 * Une base neuve et vide. libSQL : un fichier temporaire (le client natif de `@libsql/client`, le même moteur que Turso et que le serveur
 * `sqld`) ; la base est supprimée à la fin du processus. La mémoire (`:memory:`) n'est pas utilisée : le client libSQL peut rouvrir une
 * connexion et la perdre.
 */
export async function openTestDb(): Promise<SqlDb & { close(): void }> {
  const db = TEST_DB === "sqlite" ? openSqlite(":memory:") : await openLibsql({ url: `file:${join(libsqlDir, `t${libsqlCount++}.db`)}` });
  // Lot R14 : chaque requête du serveur est examinée une fois par `EXPLAIN QUERY PLAN` (un parcours complet non justifié fait échouer le test : test/enregistreur.ts).
  return surveiller(db);
}
/**
 * Jour de test : le 14/10/2026 (fixe : indépendant de `PREMIER_JOUR`, qui ne change que la numérotation). L'horloge de l'API est
 * réglée sur midi UTC de ce jour. Choisi à la retouche 18b (le 12/10 du lot 18 n'a plus le même circuit : l'ordre des temps selon la prudence
 * du pilote n'y tenait plus) : un circuit avec un virage en cuve, où le pilote finit à chaque niveau et où plus il est prudent, plus il est
 * lent (les tests de classement comptent sur cet ordre) ; le serveur y rejoue donc de la physique de paroi.
 */
export const DAY = daysFromCivil(2026, 10, 14);
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

/**
 * Lot I1 : une réponse d'erreur du serveur (statut ≥ 400) a la forme `{ error: <code de la liste>, …détails }` (lot I6 : **sans `message`**) et le statut de la
 * liste (`src/codesErreur.ts`) ; sinon une erreur explicite est levée. `makeApi().call` l'applique à chaque réponse (toute erreur déjà testée
 * est donc vérifiée) ; les tests qui appellent `createApi(...).handle` ou le serveur HTTP l'appellent là où ils lisent une réponse d'erreur.
 */
export function verifierErreur(status: number, body: unknown): void {
  if (status < 400) return;
  const shown = JSON.stringify(body)?.slice(0, 300);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(`Réponse ${status} sans corps JSON d'erreur : ${shown}`);
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (!estCodeErreur(error)) throw new Error(`Réponse ${status} dont le code n'est pas dans CODES_ERREUR (apps/api/src/codesErreur.ts) : ${shown}`);
  if (CODES_ERREUR[error].status !== status) throw new Error(`Réponse ${status} avec le code « ${error} », dont le statut de la liste est ${CODES_ERREUR[error].status} : ${shown}`);
  if (message !== undefined) throw new Error(`Réponse ${status} (« ${error} ») avec un \`message\` : le serveur ne renvoie plus que le code (lot I6) : ${shown}`);
}

export interface TestApi {
  db: SqlDb & { close(): void };
  clock: { now: number };
  api: ReturnType<typeof createApi>;
  call(
    method: string,
    path: string,
    body?: unknown,
    opts?: { raw?: string; clientKey?: string; peerKey?: string; headers?: Record<string, string> },
  ): Promise<{ status: number; body: any; headers: Headers }>;
}

/** API de test : SQLite en mémoire, horloge réglable, circuit du jour déjà en cache (sauf `seed: false`). */
export async function makeApi(options: Partial<ApiOptions> & { seed?: boolean } = {}): Promise<TestApi> {
  const db = options.db ? (options.db as TestApi["db"]) : await openTestDb();
  const clock = { now: NOON };
  // Lot R9 : les tests de classement rejouent volontiers **la même course pour plusieurs joueurs** (égalités, débit, profils…) : par défaut le refus des copies est
  // levé (`allowCopies`) ; `copies.test.ts` passe `allowCopies: false`, le réglage du serveur de production, et prouve la règle.
  const api = createApi({ db, now: () => clock.now, allowCopies: true, ...options });
  if (options.seed !== false) {
    // On amorce le cache comme le ferait un premier appel, pour ne pas régénérer le circuit à chaque test.
    const { SCHEMA } = await import("../src/db");
    for (const sql of SCHEMA) await db.run(sql);
    const c = circuitOf(DAY);
    // Lot R9 : l'empreinte des entrées de l'auteur (le pilote) va avec le circuit gardé : sans elle le serveur le régénérerait.
    const authorHash = await inputsHash(trackInputs(c.authorReplay.runs, replayTicks(c.authorReplay)));
    await db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at, author_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      DAY,
      c.track.id,
      c.spec,
      c.authorMs,
      c.attempt,
      c.palette,
      NOON,
      authorHash,
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
      const res = await api.handle(new Request(`http://api.test${path}`, init), { clientKey: opts.clientKey ?? "203.0.113.7", peerKey: opts.peerKey });
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      verifierErreur(res.status, parsed); // lot I1 : toute réponse d'erreur a un code de la liste et son statut ; lot I6 : sans message
      return { status: res.status, body: parsed, headers: res.headers };
    },
  };
}

export { decodeReplay, encodeReplay };

// --- Le Salon (lot 27) -------------------------------------------------------------------------------------------------
/** Session du Salon à l'heure de test (12:00 UTC, début de session) : un circuit « col » que les pilotes finissent à tous les niveaux. */
export const SALON_SESSION = salonSessionAt(NOON);
export const SESSION_MS = 600_000;

const salonCircuits = new Map<number, SalonCircuit>();
/** Circuit du Salon pour une session (calculé une fois par fichier de test : le générateur est coûteux). */
export function salonCircuitOf(session: number): SalonCircuit {
  let c = salonCircuits.get(session);
  if (!c) salonCircuits.set(session, (c = salonCircuit(session)));
  return c;
}

/** Une rediffusion valide d'une session du Salon, avec le pilote réglé sur `grip` (plus bas = plus lent). */
export function salonReplay(session: number, grip: number): { code: string; replay: Replay; finishMs: number } {
  const run = runPilot(salonCircuitOf(session).track, { grip });
  if (!run.valid) throw new Error("le pilote ne finit pas ce circuit");
  return { code: encodeReplay(run.replay), replay: run.replay, finishMs: run.finishMs };
}

/** Amorce le cache des circuits du Salon d'une base (comme le ferait un premier appel) : évite de régénérer le circuit à chaque test. */
export async function seedSalonCircuit(db: SqlDb, session: number): Promise<void> {
  const { SCHEMA } = await import("../src/db");
  for (const sql of SCHEMA) await db.run(sql);
  const c = salonCircuitOf(session);
  await db.run("INSERT OR IGNORE INTO salon_circuits (session, track_id, spec, created_at) VALUES (?, ?, ?, ?)", [session, c.id, c.spec, NOON]);
}
