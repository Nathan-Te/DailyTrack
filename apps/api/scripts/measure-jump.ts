// `npm run measure:jump-api -w @cdj/api` (lot P0 de la plateforme) : ce que coûte `/api/jump/day` et `/api/jump/info`. Les requêtes passent par
// le **vrai code** de l'API (`api.handle`), sur un **vrai serveur libSQL** (`sqld`, le moteur et le protocole de Turso), qui répond pour chaque
// instruction le nombre de **lignes lues** et **écrites** (ce que Turso facture), comme `measure:budget`. Mesuré : premier calcul d'un niveau
// (généré, puis figé), relecture en mémoire de l'instance, relecture en base par une instance neuve (réveil de Cloud Run).
// Lot P1 : le classement — `POST /api/jump/submit` (premier essai qui crée le joueur, essai amélioré, essai qui n'améliore pas, refus de
// version), `GET /api/jump/day/<date>/board` (sans et avec joueur, avec 30 classés), puis **un joueur type** (chargement, une arrivée, un
// partage) sur une journée, à comparer avec celui de DailyTrack (`npm run measure:budget`).
// Lot P2 : le fantôme du premier (`GET /api/jump/day/<date>/ghost/first`, jour en cours et jour passé) et le profil DailyJump
// (`GET /api/jump/me`, 1 jour puis 30 jours d'historique), et le joueur type avec eux.
//
//   docker run -d -p 8081:8080 ghcr.io/tursodatabase/libsql-server     (un sqld local)
//   SQLD_URL=http://localhost:8081 npm run measure:jump-api -w @cdj/api
//
// ⚠ Le script **vide** la table `jump_levels` (et le schéma) de ce serveur : il refuse tout ce qui n'est pas localhost.
import { readFileSync, readdirSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import { createApi } from "../src/api";
import { fictionalJumps, jumpDailyOf } from "../src/jumpHistory";
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

for (const t of ["jump_levels", "jump_results", "players", "rate", "revoked_codes", "meta"]) await db.run(`DROP TABLE IF EXISTS ${t}`);

const costs = new Map<string, { statements: number; read: number; written: number; ms: number }>();
async function measure(label: string, api: ReturnType<typeof make>, path: string, init: RequestInit = {}, client = "203.0.113.7"): Promise<void> {
  const before = { ...tally };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, init), { clientKey: client });
  const ms = performance.now() - t0;
  const body = (await res.json()) as { source?: string };
  costs.set(label, { statements: tally.statements - before.statements, read: tally.read - before.read, written: tally.written - before.written, ms });
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

// --- Lot P1 : le classement ---------------------------------------------------------------------------------------------------------
const day = jumpDailyOf(today, frozen);
const date = formatDay(today);
const hex = (n: number) => n.toString(16).padStart(32, "0");
const post = (replay: string, player: string, extra: Record<string, unknown> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Player-Id": player },
  body: JSON.stringify({ levelId: day.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay, ...extra }),
});
const others = fictionalJumps(day, 31);
const c = make();
await c.handle(new Request("http://api.test/api/health"));
for (let i = 0; i < 30; i++) {
  const o = others[i % others.length]!;
  await c.handle(new Request("http://api.test/api/jump/submit", post(o.code, hex(1000 + i), { name: `Autre${i}` })), { clientKey: `198.51.100.${i}` });
}
const slow = [...others].sort((a, b) => b.ticks - a.ticks);
console.log(`\n--- Classement (lot P1) : ${date}, 30 joueurs déjà classés, rediffusions de ${Math.min(...others.map((o) => o.code.length))} à ${Math.max(...others.map((o) => o.code.length))} octets ---\n`);
const me = hex(1);
await measure("pseudo libre ? (GET /api/name, la plateforme)", c, "/api/name?name=Moi", { headers: { "X-Player-Id": me } });
await measure("board, sans joueur", c, `/api/jump/day/${date}/board`);
await measure("board, joueur pas encore classé", c, `/api/jump/day/${date}/board`, { headers: { "X-Player-Id": me } });
await measure("submit : premier essai (crée le joueur)", c, "/api/jump/submit", post(slow[0]!.code, me, { name: "Moi" }));
await measure("board, joueur classé", c, `/api/jump/day/${date}/board`, { headers: { "X-Player-Id": me } });
await measure("submit : essai amélioré", c, "/api/jump/submit", post(day.code, me));
await measure("submit : essai qui n'améliore pas", c, "/api/jump/submit", post(slow[1]!.code, me));
await measure("submit : autre version (refus avant le rejeu)", c, "/api/jump/submit", post(day.code, me, { generatorVersion: 0 }));
const fresh = make();
await fresh.handle(new Request("http://api.test/api/health"));
await measure("instance neuve : submit (niveau lu en base, puis rejoué)", fresh, "/api/jump/submit", post(day.code, me));

// --- Lot P2 : le fantôme du premier et le profil DailyJump --------------------------------------------------------------------------
console.log(`\n--- Fantôme du premier et profil (lot P2) ---\n`);
await measure("ghost/first, jour en cours (sans joueur)", c, `/api/jump/day/${date}/ghost/first`);
await measure("ghost/first, jour en cours (joueur)", c, `/api/jump/day/${date}/ghost/first`, { headers: { "X-Player-Id": me } });
await measure("/api/jump/me, 1 jour classé", c, "/api/jump/me", { headers: { "X-Player-Id": me } });
// 29 autres jours d'historique pour ce joueur (lignes posées directement : seule la lecture est mesurée ici).
for (let k = 1; k < 30; k++) {
  await db.run("INSERT OR IGNORE INTO jump_levels (day, rule, level_id, hash, author_ticks, medals, theme, source, ascii, created_at) SELECT ?, rule, level_id, hash, author_ticks, medals, theme, source, '', created_at FROM jump_levels WHERE day = ?", [today - k, today]);
  await db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) SELECT ?, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at FROM jump_results WHERE day = ? AND player_id = ?", [today - k, today, me]);
}
await measure("/api/jump/me, 30 jours classés", c, "/api/jump/me", { headers: { "X-Player-Id": me } });
const past = formatDay(today - 1);
await measure("ghost/first, jour passé (première lecture)", c, `/api/jump/day/${past}/ghost/first`);
await measure("ghost/first, jour passé (gardé en mémoire)", c, `/api/jump/day/${past}/ghost/first`);

const sum = (items: [number, string][]) =>
  items.reduce((acc, [n, label]) => {
    const k = costs.get(label)!;
    return { requests: acc.requests + n, statements: acc.statements + n * k.statements, read: acc.read + n * k.read, written: acc.written + n * k.written };
  }, { requests: 0, statements: 0, read: 0, written: 0 });
// Le joueur type d'une journée (hypothèses, `apps/jump/src/main.ts`) : le jeu calcule le niveau lui-même (aucune requête au chargement d'une
// première visite) ; **chargement** = une relecture du classement quand il a déjà un rang (1 board) ; **arrivée** = 1 envoi (s'il bat son
// meilleur envoyé) + 1 lecture du classement ; **partage** = 0 (la ligne est faite dans le jeu). Journée : 2 chargements, 4 arrivées dont
// 2 améliorées (2 envois + 4 lectures), 1 partage, 1 vérification de pseudo (premier jour).
const typical = sum([
  [1, "pseudo libre ? (GET /api/name, la plateforme)"],
  [1, "submit : premier essai (crée le joueur)"],
  [1, "submit : essai amélioré"],
  [6, "board, joueur classé"],
]);
console.log(
  `\nJoueur type de DailyJump, une journée (2 chargements, 4 arrivées dont 2 envois, 1 partage, 1 pseudo) : ${typical.requests} requêtes · ${typical.statements} instructions · ${typical.read} lignes lues · ${typical.written} lignes écrites`,
);
const visit = sum([
  [1, "submit : essai amélioré"],
  [1, "board, joueur classé"],
]);
// Lot P2 : le jeu lit le fantôme du premier à chaque chargement et à chaque arrivée, et son profil au chargement (au plus une fois par 30 s)
// et après chaque envoi accepté : 2 chargements (2 fantômes + 2 profils), 4 arrivées (4 fantômes), 2 envois acceptés (2 profils).
const typicalP2 = sum([
  [1, "pseudo libre ? (GET /api/name, la plateforme)"],
  [1, "submit : premier essai (crée le joueur)"],
  [1, "submit : essai amélioré"],
  [6, "board, joueur classé"],
  [6, "ghost/first, jour en cours (joueur)"],
  [4, "/api/jump/me, 30 jours classés"],
]);
console.log(
  `Joueur type avec le lot P2 (fantôme du premier ×6, profil ×4, historique de 30 jours) : ${typicalP2.requests} requêtes · ${typicalP2.statements} instructions · ${typicalP2.read} lignes lues · ${typicalP2.written} lignes écrites`,
);
console.log(`  une arrivée qui améliore : ${visit.requests} requêtes, ${visit.read} lignes lues, ${visit.written} écrites ; un partage : 0 requête ; un chargement (rang connu) : 1 requête, ${costs.get("board, joueur classé")!.read} lignes lues`);
for (const t of ["jump_levels", "jump_results", "players", "rate", "revoked_codes", "meta"]) await db.run(`DROP TABLE IF EXISTS ${t}`);
