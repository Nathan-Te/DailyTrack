// `npm run measure:jump-api -w @cdj/api` (lot P0 de la plateforme) : ce que coûte `/api/jump/day` et `/api/jump/info`. Les requêtes passent par
// le **vrai code** de l'API (`api.handle`), sur un **vrai serveur libSQL** (`sqld`, le moteur et le protocole de Turso), qui répond pour chaque
// instruction le nombre de **lignes lues** et **écrites** (ce que Turso facture), comme `measure:budget`. Mesuré : premier calcul d'un niveau
// (généré, puis figé), relecture en mémoire de l'instance, relecture en base par une instance neuve (réveil de Cloud Run).
//
//   docker run -d -p 8081:8080 ghcr.io/tursodatabase/libsql-server     (un sqld local)
//   SQLD_URL=http://localhost:8081 npm run measure:jump-api -w @cdj/api
//
// ⚠ Le script **vide** la table `jump_levels` (et le schéma) de ce serveur : il refuse tout ce qui n'est pas localhost.
import { readFileSync, readdirSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { createApi } from "../src/api";
import type { SqlDb, SqlValue } from "../src/db";

const SQLD_URL = (process.env.SQLD_URL ?? "http://localhost:8081").replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SQLD_URL)) {
  console.error(`measure:jump-api refuse d'écrire dans ${SQLD_URL} : un sqld local seulement.`);
  process.exit(1);
}

const tally = { statements: 0, read: 0, written: 0 };
const arg = (v: SqlValue) => (v === null ? { type: "null" } : typeof v === "number" ? (Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v }) : { type: "text", value: v });
const val = (c: { type: string; value?: string | number }) => (c.type === "null" ? null : c.type === "integer" || c.type === "float" ? Number(c.value) : (c.value as string));
async function pipeline(statements: { sql: string; params?: SqlValue[] }[]) {
  const res = await fetch(`${SQLD_URL}/v2/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...statements.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.params ?? []).map(arg) } })), { type: "close" }] }),
  });
  const body = (await res.json()) as { results: { type: string; response?: { result?: any }; error?: { message: string } }[] };
  const out: { cols: { name: string }[]; rows: any[][] }[] = [];
  for (const r of body.results.slice(0, statements.length)) {
    if (r.type !== "ok") throw new Error(r.error?.message ?? "erreur sqld");
    const result = r.response!.result!;
    tally.statements++;
    tally.read += result.rows_read ?? 0;
    tally.written += result.rows_written ?? 0;
    out.push(result);
  }
  return out;
}
const rowsOf = (r: { cols: { name: string }[]; rows: any[][] }) => r.rows.map((row) => Object.fromEntries(r.cols.map((c, i) => [c.name, val(row[i])])));
const db: SqlDb = {
  async run(sql, params) {
    await pipeline([{ sql, params }]);
  },
  async first<T>(sql: string, params?: SqlValue[]) {
    const [r] = await pipeline([{ sql, params }]);
    return (rowsOf(r!)[0] as T | undefined) ?? null;
  },
  async all<T>(sql: string, params?: SqlValue[]) {
    const [r] = await pipeline([{ sql, params }]);
    return rowsOf(r!) as T[];
  },
  async batch(statements) {
    await pipeline(statements);
  },
};

const levelsDir = new URL("../../jump/public/levels/", import.meta.url);
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(levelsDir).sort()) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}
const frozenDay = Object.keys(frozen)[0];
const today = daysFromCivil(2026, 10, 19);
const clock = { now: today * 86_400_000 + 12 * 3_600_000 };
const make = () => createApi({ db, now: () => clock.now, rateSalt: "mesure", jumpFrozen: frozen, environment: "local" });

await db.run("DROP TABLE IF EXISTS jump_levels");
await db.run("DROP TABLE IF EXISTS meta");

async function measure(label: string, api: ReturnType<typeof make>, path: string): Promise<void> {
  const before = { ...tally };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`), { clientKey: "203.0.113.7" });
  const ms = performance.now() - t0;
  const body = (await res.json()) as { source?: string };
  console.log(
    `${label.padEnd(58)} ${String(res.status).padStart(3)}  ${ms.toFixed(1).padStart(7)} ms  instructions ${String(tally.statements - before.statements).padStart(2)}  lues ${String(tally.read - before.read).padStart(3)}  écrites ${String(tally.written - before.written).padStart(2)}${body.source ? `  (${body.source})` : ""}`,
  );
}

console.log(`sqld : ${SQLD_URL} — aujourd'hui ${formatDay(today)}, jour figé mesuré ${frozenDay}\n`);
const a = make();
await measure("schéma (premier appel d'une instance, /api/health)", a, "/api/health");
await measure("/api/jump/info", a, "/api/jump/info");
await measure("/api/jump/day/<aujourd'hui> : premier calcul (généré)", a, `/api/jump/day/${formatDay(today)}`);
await measure("/api/jump/day/<aujourd'hui> : même instance (mémoire)", a, `/api/jump/day/${formatDay(today)}`);
await measure(`/api/jump/day/${frozenDay} : premier calcul (figé, preuve rejouée)`, a, `/api/jump/day/${frozenDay}`);
await measure(`/api/jump/day/${frozenDay} : même instance (mémoire)`, a, `/api/jump/day/${frozenDay}`);
const b = make();
await measure("instance neuve : schéma à jour (/api/health)", b, "/api/health");
await measure("instance neuve : /api/jump/day/<aujourd'hui> (lu en base)", b, `/api/jump/day/${formatDay(today)}`);
await measure(`instance neuve : /api/jump/day/${frozenDay} (lu en base)`, b, `/api/jump/day/${frozenDay}`);
await measure("instance neuve : /api/jump/day/<aujourd'hui> (mémoire)", b, `/api/jump/day/${formatDay(today)}`);
