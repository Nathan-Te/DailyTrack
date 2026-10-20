// `npm run measure:portail -w @cdj/api` (lot I2 de la plateforme ; lot I3 : le classement du jour et la place du joueur, pour 100, 1 000 et 10 000 joueurs du
// jour — voir la fin du script) : ce que coûtent les lectures du portail — `GET /api/portail/jour` (sans
// joueur, puis avec un joueur de 30 et de 365 jours d'historique dans les deux jeux) et le profil commun `GET /api/portail/profil` (premier
// appel : places finales des jours fermés calculées et gardées ; ensuite : relues). Les requêtes passent par le **vrai code** de l'API
// (`api.handle`), sur un **vrai serveur libSQL** (`sqld`, le moteur et le protocole de Turso), qui répond pour chaque instruction le nombre de
// **lignes lues** et **écrites** (ce que Turso facture), comme `measure:jump-api`.
//
//   docker run -d -p 8081:8080 ghcr.io/tursodatabase/libsql-server     (un sqld local)
//   SQLD_URL=http://localhost:8081 npm run measure:portail -w @cdj/api
//
// ⚠ Le script **vide** les tables du serveur sqld : il refuse tout ce qui n'est pas localhost. L'historique est écrit directement en base
// (des lignes `results` / `jump_results` : on mesure la lecture, pas l'envoi, déjà mesuré par `measure:budget` et `measure:jump-api`).
import { daysFromCivil, formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { SCHEMA, type SqlDb, type SqlValue } from "../src/db";

const SQLD_URL = (process.env.SQLD_URL ?? "http://localhost:8081").replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SQLD_URL)) {
  console.error(`measure:portail refuse d'écrire dans ${SQLD_URL} : un sqld local seulement.`);
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

// Un an après le premier jour des deux jeux : 365 jours d'historique possibles dans chacun.
const today = daysFromCivil(2027, 10, 20);
const clock = { now: parisDayStart(today) + 12 * 3_600_000 };
const make = () => createApi({ db, now: () => clock.now, rateSalt: "mesure", environment: "local" });

for (const sql of SCHEMA) {
  const t = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql)?.[1];
  if (t) await db.run(`DROP TABLE IF EXISTS ${t}`);
}
await db.run("DROP TABLE IF EXISTS meta");

const hex = (n: number) => n.toString(16).padStart(32, "0");
const OTHERS = 50; // classés de chaque jour (en plus du joueur mesuré) : le rang et le nombre de classés se comptent sur eux

/** Écrit l'historique : `days` jours finis dans les deux jeux pour `id`, avec `OTHERS` autres classés chaque jour (plus lents de moitié, plus rapides de moitié). */
async function history(id: string, name: string, days: number): Promise<void> {
  await db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [id, name, name.toLowerCase()]);
  const statements: { sql: string; params?: SqlValue[] }[] = [];
  for (let d = today - days + 1; d <= today; d++) {
    statements.push({ sql: "INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 40000, '[]', 'x', 0, 1)", params: [d, id] });
    statements.push({
      sql: "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, 5000, 0, 'x', 1, 1, 1, 1)",
      params: [d, id, `jour-${formatDay(d)}-g1`],
    });
  }
  for (let i = 0; i < statements.length; i += 200) await db.batch!(statements.slice(i, i + 200));
}

async function others(days: number): Promise<void> {
  const statements: { sql: string; params?: SqlValue[] }[] = [{ sql: "INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES ('0', 'x', 0, 0, 'x')" }];
  for (let d = today - days + 1; d <= today; d++) {
    for (let i = 0; i < OTHERS; i++) {
      const id = hex(10_000 + i);
      const faster = i < OTHERS / 2;
      statements.push({ sql: "INSERT OR IGNORE INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, 2)", params: [d, id, faster ? 30_000 : 50_000] });
      statements.push({
        sql: "INSERT OR IGNORE INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, ?, 0, 'x', 1, 1, 2, 2)",
        params: [d, id, `jour-${formatDay(d)}-g1`, faster ? 4000 : 6000],
      });
    }
  }
  for (let i = 0; i < statements.length; i += 500) await db.batch!(statements.slice(i, i + 500));
}

const costs: { label: string; statements: number; read: number; written: number; ms: number; size: number }[] = [];
async function measure(label: string, api: ReturnType<typeof make>, path: string, player?: string): Promise<Record<string, unknown>> {
  const before = { ...tally };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, { headers: player ? { "X-Player-Id": player } : {} }), { clientKey: "203.0.113.7" });
  const ms = performance.now() - t0;
  const text = await res.text();
  const c = { label, statements: tally.statements - before.statements, read: tally.read - before.read, written: tally.written - before.written, ms, size: text.length };
  costs.push(c);
  console.log(
    `${label.padEnd(62)} ${String(res.status).padStart(3)}  ${ms.toFixed(1).padStart(7)} ms  instructions ${String(c.statements).padStart(2)}  lues ${String(c.read).padStart(5)}  écrites ${String(c.written).padStart(3)}  ${String(c.size).padStart(5)} o`,
  );
  if (res.status !== 200) throw new Error(`${label} : ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

console.log(`sqld : ${SQLD_URL} — aujourd'hui ${formatDay(today)}, ${OTHERS} autres classés par jour et par jeu\n`);
const a = make();
await a.handle(new Request("http://api.test/api/health"));
await others(365);
const P30 = hex(1);
const P365 = hex(2);
await history(P30, "Trente", 30);
await history(P365, "Annee", 365);

await measure("jour, sans joueur : premier appel (circuit et niveau calculés)", a, "/api/portail/jour");
await measure("jour, sans joueur : même instance (niveaux en mémoire)", a, "/api/portail/jour");
const b = make();
await b.handle(new Request("http://api.test/api/health"));
await measure("jour, sans joueur : instance neuve (niveaux lus en base)", b, "/api/portail/jour");
const j30 = await measure("jour, joueur de 30 jours", a, "/api/portail/jour", P30);
await measure("jour, joueur de 365 jours", a, "/api/portail/jour", P365);
await measure("profil, 30 jours : premier appel (places finales calculées)", a, "/api/portail/profil", P30);
await measure("profil, 30 jours : ensuite (places finales gardées)", a, "/api/portail/profil", P30);
await measure("profil, 365 jours : premier appel (places finales calculées)", a, "/api/portail/profil", P365);
const p365 = await measure("profil, 365 jours : ensuite (places finales gardées)", a, "/api/portail/profil", P365);
console.log(`\nContrôle : série de 30 jours = ${(j30.joueur as { serie: number }).serie}, profil 365 jours = ${(p365.jeux as { joursFinis: number }[]).map((j) => j.joursFinis).join(" / ")} jours finis`);
console.log("\nRésumé (instructions / lignes lues / écrites) :");
for (const c of costs) console.log(`  ${c.label} : ${c.statements} / ${c.read} / ${c.written}`);

// --- Lot I3 : le classement du jour tous jeux confondus, pour 100, 1 000 et 10 000 joueurs du jour --------------------------------------------------------
// Le classement du jour est calculé **au plus une fois par fenêtre (45 s) et par instance** : une lecture de `results` et de `jump_results` (une ligne par classé
// et par jeu). Mesuré ici : ce calcul (premier appel), la lecture suivante (en mémoire : zéro), la place d'un joueur du milieu dans `GET /api/portail/jour` (ses
// états : le rang d'un jeu lit une ligne par classé devant lui) et le haut du classement avec sa ligne. `CLASSEMENT=100,1000` pour changer les tailles.
const SIZES = (process.env.CLASSEMENT ?? "100,1000,10000").split(",").map((x) => Number(x.trim())).filter((x) => x > 0);
const classementRows: { n: number; label: string; statements: number; read: number; written: number; ms: number; size: number }[] = [];

async function peupler(n: number): Promise<void> {
  for (const t of ["results", "jump_results", "players", "jump_lives", "jump_deaths", "rate"]) await db.run(`DELETE FROM ${t}`);
  for (let from = 0; from < n; from += 250) {
    const statements: { sql: string; params?: SqlValue[] }[] = [];
    for (let j = from; j < Math.min(n, from + 250); j++) {
      const id = hex(1_000_000 + j);
      statements.push({ sql: "INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", params: [id, `Joueur ${j}`, `joueur ${j}`] });
      // Des temps étalés de part et d'autre des seuils des médailles (le circuit et le niveau du jour sont ceux de l'instance) ; un joueur sur dix n'a fini qu'un jeu.
      statements.push({ sql: "INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, '[]', 'x', 0, ?)", params: [today, id, 30_000 + j * 7, 1_000 + j] });
      if (j % 10 !== 9) {
        statements.push({
          sql: "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, ?, 0, 'x', 1, 1, 0, ?)",
          params: [today, id, `jour-${formatDay(today)}-g1`, 4_000 + ((j * 13) % n) * 2, 1_000 + j],
        });
      }
    }
    await db.batch!(statements);
  }
}

async function mesureClassement(n: number, label: string, api: ReturnType<typeof make>, path: string, player?: string): Promise<Record<string, any>> {
  const before = { ...tally };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, { headers: player ? { "X-Player-Id": player } : {} }), { clientKey: `203.0.113.${(classementRows.length % 200) + 10}` });
  const ms = performance.now() - t0;
  const text = await res.text();
  const c = { n, label, statements: tally.statements - before.statements, read: tally.read - before.read, written: tally.written - before.written, ms, size: text.length };
  classementRows.push(c);
  console.log(`${String(n).padStart(6)} joueurs · ${label.padEnd(58)} ${String(res.status).padStart(3)}  ${ms.toFixed(1).padStart(8)} ms  instructions ${String(c.statements).padStart(2)}  lues ${String(c.read).padStart(6)}  écrites ${String(c.written).padStart(3)}  ${String(c.size).padStart(6)} o`);
  if (res.status !== 200) throw new Error(`${label} : ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as Record<string, any>;
}

console.log("\n--- Lot I3 : le classement du jour ---");
for (const n of SIZES) {
  await peupler(n);
  const api = make();
  await api.handle(new Request("http://api.test/api/health"));
  await api.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.1" }); // le circuit et le niveau du jour (hors mesure)
  const milieu = hex(1_000_000 + Math.floor(n / 2));
  const heapAvant = process.memoryUsage().heapUsed;
  const premier = await mesureClassement(n, "classement, sans joueur : premier appel (le calcul)", api, "/api/portail/classement");
  const tas = process.memoryUsage().heapUsed - heapAvant;
  await mesureClassement(n, "classement, sans joueur : ensuite (en mémoire)", api, "/api/portail/classement");
  const moi = await mesureClassement(n, "classement, joueur du milieu : sa ligne (ses états + le classement gardé)", api, "/api/portail/classement", milieu);
  const jour = await mesureClassement(n, "jour, joueur du milieu : points et place (classement gardé)", api, "/api/portail/jour", milieu);
  // Une instance neuve : le calcul se refait (une fois par fenêtre et par instance), puis l'accueil du joueur du milieu.
  const autre = make();
  await autre.handle(new Request("http://api.test/api/health"));
  await mesureClassement(n, "jour, joueur du milieu : instance neuve (calcul compris)", autre, "/api/portail/jour", milieu);
  console.log(
    `        contrôle : ${premier.classes} classés, haut ${premier.top.length}, sa ligne ${moi.moi?.rang}e sur ${moi.moi?.classes}, jour ${jour.joueur?.rangDuJour}e sur ${jour.joueur?.classesDuJour} (${jour.joueur?.points} points) ; mémoire de l'instance ≈ ${(tas / 1024 / 1024).toFixed(1)} Mo`,
  );
}
console.log("\nRésumé du lot I3 (joueurs · lecture : instructions / lignes lues / écrites / ms) :");
for (const c of classementRows) console.log(`  ${c.n} · ${c.label} : ${c.statements} / ${c.read} / ${c.written} / ${c.ms.toFixed(0)} ms`);

