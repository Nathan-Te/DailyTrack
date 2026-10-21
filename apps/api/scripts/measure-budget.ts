import { daysFromCivil, dailyCircuit, encodeReplay, formatDay, runPilot, salonCircuit, salonSessionAt, salonSessionEnd, salonSessionStart } from "@cdj/sim";
import { createApi } from "../src/api";
import type { SqlDb, SqlValue } from "../src/db";

// `npm run measure:budget` (lot 28) : ce que coûte un joueur à l'offre gratuite (Cloud Run + Turso). Les requêtes passent par le **vrai code**
// de l'API (`api.handle`), sur un **vrai serveur libSQL** (`sqld`, le moteur et le protocole de Turso) qui répond, pour chaque instruction,
// le nombre de **lignes lues** et **écrites** : ce sont les nombres que Turso facture. Horloge simulée. On mesure, par type de requête :
// instructions SQL (un aller-retour réseau chacune vers Turso), lignes lues, lignes écrites, temps de calcul (CPU) ; puis on calcule le coût
// d'un joueur et d'une journée, et le nombre de joueurs que tient l'offre gratuite.
//
//   docker run -d -p 8081:8080 ghcr.io/tursodatabase/libsql-server     (un sqld local)
//   SQLD_URL=http://localhost:8081 npm run measure:budget -w @cdj/api
//
// ⚠ Le script **vide** les tables de l'API de ce serveur : il refuse tout ce qui n'est pas localhost.
const SQLD_URL = (process.env.SQLD_URL ?? "http://localhost:8081").replace(/\/+$/, "");
const SALON_PLAYERS = (process.env.SALON_PLAYERS ?? "10,50").split(",").map(Number); // présence : joueurs dans la session
const DAY_PLAYERS = Number(process.env.DAY_PLAYERS ?? 30); // joueurs déjà classés ce jour-là
const RTT_MS = Number(process.env.RTT_MS ?? 25); // aller-retour Cloud Run ↔ Turso (même région : 10–40 ms)

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SQLD_URL)) {
  console.error(`measure:budget refuse d'écrire dans ${SQLD_URL} : un sqld local seulement (il vide les tables).`);
  process.exit(1);
}

// --- Base : libSQL par HTTP (hrana), avec compteurs ---------------------------------------------------------------------
interface Tally {
  statements: number;
  roundTrips: number;
  read: number;
  written: number;
}
const tally: Tally = { statements: 0, roundTrips: 0, read: 0, written: 0 };

const arg = (v: SqlValue) => (v === null ? { type: "null" } : typeof v === "number" ? (Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v }) : { type: "text", value: v });
const val = (c: { type: string; value?: string | number }) => (c.type === "null" ? null : c.type === "integer" || c.type === "float" ? Number(c.value) : (c.value as string));

async function pipeline(statements: { sql: string; params?: SqlValue[] }[]) {
  const res = await fetch(`${SQLD_URL}/v2/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...statements.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.params ?? []).map(arg) } })), { type: "close" }] }),
  });
  const body = (await res.json()) as { results: { type: string; response?: { result?: any }; error?: { message: string } }[] };
  tally.roundTrips++;
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
};

async function reset(): Promise<void> {
  const tables = ["players", "circuits", "planning", "results", "rate", "salon_runs", "salon_sessions", "salon_circuits", "salon_presence", "salon_throttle", "revoked_codes", "meta"];
  for (const t of tables) await db.run(`DROP TABLE IF EXISTS ${t}`);
}

// --- Mesure d'une requête -----------------------------------------------------------------------------------------------
const clock = { now: 0 };
interface Sample {
  statements: number;
  roundTrips: number;
  read: number;
  written: number;
  cpuMs: number;
  wallMs: number;
}
const samples = new Map<string, Sample[]>();

async function call(label: string | null, api: ReturnType<typeof createApi>, method: string, path: string, body?: unknown, client = "203.0.113.7", headers: Record<string, string> = {}): Promise<any> {
  const before = { ...tally };
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }), { clientKey: client });
  const wallMs = performance.now() - t0;
  const cpu = process.cpuUsage(cpu0);
  const json = await res.json();
  if (label) {
    const list = samples.get(label) ?? [];
    list.push({
      statements: tally.statements - before.statements,
      roundTrips: tally.roundTrips - before.roundTrips,
      read: tally.read - before.read,
      written: tally.written - before.written,
      cpuMs: (cpu.user + cpu.system) / 1000, // CPU de l'API *et* du client HTTP vers sqld (un peu pessimiste : sur Turso, c'est pareil)
      wallMs,
    });
    samples.set(label, list);
  }
  return { status: res.status, body: json };
}

const mean = (label: string): Sample => {
  const list = samples.get(label);
  if (!list?.length) throw new Error(`rien de mesuré pour ${label}`);
  const m = (k: keyof Sample) => list.reduce((n, s) => n + s[k], 0) / list.length;
  return { statements: m("statements"), roundTrips: m("roundTrips"), read: m("read"), written: m("written"), cpuMs: m("cpuMs"), wallMs: m("wallMs") };
};

const playerId = (n: number) => n.toString(16).padStart(32, "0");
const fmt = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });

// --- Préparation : rediffusions de pilotes de niveaux variés (non mesurée) ----------------------------------------------------
const DAY = daysFromCivil(2026, 10, 14);
const DAY_START = DAY * 86_400_000 + 12 * 3_600_000;
console.log("Préparation : circuits et rediffusions de pilotes…");
const daily = dailyCircuit(DAY);
const SESSION = salonSessionAt(DAY_START);
const salon = salonCircuit(SESSION);
const GRIPS = [0.97, 0.93, 0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.66, 0.62];
const dayReplays = GRIPS.map((grip) => runPilot(daily.track, { grip })).filter((r) => r.valid).map((r) => ({ code: encodeReplay(r.replay), ms: r.finishMs }));
const salonReplays = GRIPS.map((grip) => runPilot(salon.track, { grip })).filter((r) => r.valid).map((r) => ({ code: encodeReplay(r.replay), ms: r.finishMs }));
dayReplays.sort((a, b) => b.ms - a.ms); // du plus lent au plus rapide : chaque envoi améliore le précédent
salonReplays.sort((a, b) => b.ms - a.ms);
if (dayReplays.length < 4 || salonReplays.length < 4) throw new Error("trop peu de pilotes finissent ces circuits");
const replayKb = dayReplays.reduce((n, r) => n + r.code.length, 0) / dayReplays.length / 1024;

async function freshApi(at: number) {
  await reset();
  clock.now = at;
  const api = createApi({ db, now: () => clock.now });
  await call(null, api, "GET", "/api/health"); // schéma
  return api;
}

// --- 1. Circuit du jour : un joueur sur une journée ------------------------------------------------------------------------------
console.log(`\n=== Circuit du jour : un joueur, ${DAY_PLAYERS} autres déjà classés ===`);
{
  const api = await freshApi(DAY_START);
  await call("jour : circuit (1re requête du jour : le génère)", api, "GET", `/api/day/${formatDay(DAY)}`);
  for (let i = 0; i < DAY_PLAYERS; i++) {
    const r = dayReplays[i % dayReplays.length]!;
    await call(null, api, "POST", "/api/submit", { playerId: playerId(1000 + i), name: `Autre${i}`, date: formatDay(DAY), replay: r.code }, `198.51.100.${i % 250}`);
  }
  const me = playerId(1);
  await call("jour : circuit (déjà en base)", api, "GET", `/api/day/${formatDay(DAY)}`);
  for (let k = 0; k < 3; k++) {
    // trois temps de plus en plus rapides : chaque envoi améliore le précédent (le cas le plus coûteux en écritures)
    await call("jour : envoi d'un temps (rejeu)", api, "POST", "/api/submit", { playerId: me, name: "Moi", date: formatDay(DAY), replay: dayReplays[1 + k * 2]!.code });
  }
  await call("jour : envoi d'un temps qui n'améliore pas", api, "POST", "/api/submit", { playerId: me, name: "Moi", date: formatDay(DAY), replay: dayReplays[0]!.code });
  for (let k = 0; k < 4; k++) await call("jour : classement", api, "GET", `/api/day/${formatDay(DAY)}/leaderboard?limit=10`, undefined, undefined, { "X-Player-Id": me });
  await call("jour : fantôme du premier", api, "GET", `/api/day/${formatDay(DAY)}/ghost?kind=first`);
  await call("jour : fantôme de devant", api, "GET", `/api/day/${formatDay(DAY)}/ghost?kind=ahead`, undefined, undefined, { "X-Player-Id": me });
}

// --- 1b. Profil synchronisé (lot 30) : `GET /api/me` selon l'historique du joueur ----------------------------------------------------------------------
// Chaque lancement du jeu et chaque retour à l'accueil (au plus un par 30 s) lit le profil. La place de chaque jour passé (les 90 derniers) coûte une
// lecture par concurrent ce jour-là : on mesure donc avec `DAY_PLAYERS` concurrents par jour et un historique de 1 à 120 jours.
const HISTORY = (process.env.HISTORY_DAYS ?? "1,14,60,120").split(",").map(Number);
console.log(`\n=== Profil : GET /api/me, ${DAY_PLAYERS} concurrents par jour, historique de ${HISTORY.join(", ")} jours ===`);
for (const history of HISTORY) {
  const api = await freshApi(DAY_START);
  const me = playerId(1);
  await call(null, api, "POST", "/api/submit", { playerId: me, name: "Moi", date: formatDay(DAY), replay: dayReplays[1]!.code });
  // Jours passés (fabriqués directement : le serveur ne classe que le jour courant) : une ligne de circuit et DAY_PLAYERS résultats par jour.
  for (let d = 1; d <= history - 1; d++) {
    const day = DAY - d;
    await db.run("INSERT INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, 'x', ?, 1, 'stade', 0)", [day, `jour-${formatDay(day)}-g15`, daily.authorMs]);
    const rows: string[] = [];
    const params: SqlValue[] = [];
    for (let i = 0; i < DAY_PLAYERS; i++) {
      rows.push("(?, ?, ?, '[]', 'x', 0, ?)");
      params.push(day, i === 0 ? me : playerId(1000 + i), daily.authorMs + 100 * i, day * 10 + i);
    }
    await db.run(`INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES ${rows.join(",")}`, params);
  }
  for (let k = 0; k < 3; k++) {
    const r = await call(`profil ${history} j : GET /api/me${k === 0 ? " (1re lecture : calcule les places des jours terminés)" : ""}`, api, "GET", "/api/me", undefined, "203.0.113.7", { "X-Player-Id": me });
    if (r.status !== 200 || r.body.stats.days !== history) throw new Error(`profil : ${history} jours attendus, reçu ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  }
}
{
  const api = await freshApi(DAY_START);
  const me = playerId(1);
  await call(null, api, "POST", "/api/submit", { playerId: me, name: "Moi", date: formatDay(DAY), replay: dayReplays[1]!.code });
  for (let k = 0; k < 3; k++) await call("profil : vérifier un pseudo", api, "GET", `/api/name?name=Libre${k}`, undefined, "203.0.113.7", { "X-Player-Id": me });
  await call("profil : changer de pseudo", api, "PUT", "/api/player", { playerId: me, name: "Moi2" });
  await call("profil : changer mon code", api, "POST", "/api/me/code", { newId: playerId(2) }, "203.0.113.7", { "X-Player-Id": me });
  await call("profil : ancien code refusé (GET /api/me)", api, "GET", "/api/me", undefined, "203.0.113.7", { "X-Player-Id": me });
}

// --- 2. Salon : un joueur pendant une session, avec P joueurs présents ------------------------------------------------------------------
const salonBy = new Map<number, Record<string, Sample>>();
for (const players of SALON_PLAYERS) {
  console.log(`\n=== Salon : un joueur parmi ${players} présents ===`);
  const L = (name: string) => `salon ${players} : ${name}`;
  const start = salonSessionStart(SESSION);
  const api = await freshApi(start + 30_000);
  // Les autres : présents (ils lisent) et déjà classés. Le premier envoi de la session génère le circuit (mesuré à part).
  for (let i = 0; i < players - 1; i++) {
    const r = salonReplays[i % salonReplays.length]!;
    const id = playerId(2000 + i);
    clock.now = start + 30_000 + i * 6_000; // un envoi toutes les 6 s (au plus un par 5 s et par joueur)
    await call(i === 0 ? L("premier envoi (génère le circuit)") : null, api, "POST", `/api/salon/${SESSION}/submit`, { playerId: id, name: `Autre${i}`, replay: r.code }, `198.51.100.${i % 250}`);
    await call(null, api, "GET", "/api/salon/now", undefined, `198.51.100.${i % 250}`, { "X-Player-Id": id });
  }
  clock.now = start + 5 * 60_000;
  const me = playerId(1);
  await call(L("maintenant"), api, "GET", "/api/salon/now", undefined, undefined, { "X-Player-Id": me });
  let board = await call(L("classement (a changé)"), api, "GET", `/api/salon/${SESSION}/board`, undefined, undefined, { "X-Player-Id": me });
  for (let k = 0; k < 10; k++) {
    clock.now += 5_000;
    await call(L("classement (rien de neuf)"), api, "GET", `/api/salon/${SESSION}/board?since=${board.body.version}`, undefined, undefined, { "X-Player-Id": me });
  }
  await call(L("maintenant"), api, "GET", "/api/salon/now", undefined, undefined, { "X-Player-Id": me });
  for (let k = 0; k < 2; k++) {
    clock.now += 6_000;
    await call(L(k === 0 ? "envoi (1er de la session, rejeu)" : "envoi suivant (rejeu)"), api, "POST", `/api/salon/${SESSION}/submit`, { playerId: me, name: "Moi", replay: salonReplays[1 + k * 3]!.code });
  }
  board = await call(null, api, "GET", `/api/salon/${SESSION}/board`, undefined, undefined, { "X-Player-Id": me });
  const refs: string[] = board.body.rows.slice(0, 5).map((r: { ref: string }) => r.ref);
  await call(L("fantômes (5)"), api, "GET", `/api/salon/${SESSION}/ghosts?refs=${refs.join(",")}`);
  await call(L("classement (a changé)"), api, "GET", `/api/salon/${SESSION}/board?since=${board.body.version - 1}`, undefined, undefined, { "X-Player-Id": me });
  salonBy.set(players, {
    now: mean(L("maintenant")),
    boardSame: mean(L("classement (rien de neuf)")),
    boardNew: mean(L("classement (a changé)")),
    ghosts: mean(L("fantômes (5)")),
    submitFirst: mean(L("envoi (1er de la session, rejeu)")),
    submitNext: mean(L("envoi suivant (rejeu)")),
    generate: mean(L("premier envoi (génère le circuit)")),
  });
}

// --- Tableau par type de requête ------------------------------------------------------------------------------------------------------
const row = (label: string, s: Sample) =>
  `  ${label.padEnd(58)} ${fmt(s.statements, 1).padStart(6)} ${fmt(s.read, 1).padStart(8)} ${fmt(s.written, 1).padStart(7)} ${fmt(s.cpuMs, 1).padStart(8)}`;
console.log(`\n${"Par requête (moyennes)".padEnd(60)} ${"instr.".padStart(6)} ${"lignes lues".padStart(8)} ${"écrites".padStart(7)} ${"CPU ms".padStart(8)}`);
for (const label of [...samples.keys()].filter((l) => l.startsWith("jour"))) console.log(row(label, mean(label)));
for (const label of [...samples.keys()].filter((l) => l.startsWith("profil"))) console.log(row(label, mean(label)));
for (const players of SALON_PLAYERS) for (const label of [...samples.keys()].filter((l) => l.startsWith(`salon ${players} :`))) console.log(row(label, mean(label)));

// --- Un joueur, une journée ---------------------------------------------------------------------------------------------------------------
interface Budget {
  requests: number;
  statements: number;
  read: number;
  written: number;
  cpuMs: number;
  /** vCPU-secondes si chaque requête était facturée seule, arrondie aux 100 ms (borne haute : sans partage entre requêtes simultanées). */
  vcpuHigh: number;
}
const budgetOf = (items: [number, Sample][]): Budget => {
  const b: Budget = { requests: 0, statements: 0, read: 0, written: 0, cpuMs: 0, vcpuHigh: 0 };
  for (const [n, s] of items) {
    b.requests += n;
    b.statements += n * s.statements;
    b.read += n * s.read;
    b.written += n * s.written;
    b.cpuMs += n * s.cpuMs;
    const wall = s.cpuMs + s.roundTrips * RTT_MS; // sur Turso : le calcul + un aller-retour par instruction (en parallèle : par lot)
    b.vcpuHigh += (n * Math.max(100, Math.ceil(wall / 100) * 100)) / 1000;
  }
  return b;
};
const sum = (a: Budget, c: Budget): Budget => ({ requests: a.requests + c.requests, statements: a.statements + c.statements, read: a.read + c.read, written: a.written + c.written, cpuMs: a.cpuMs + c.cpuMs, vcpuHigh: a.vcpuHigh + c.vcpuHigh });

const dayOnly = budgetOf([
  [1, mean("jour : circuit (déjà en base)")],
  [3, mean("jour : classement")],
  [1, mean("jour : fantôme du premier")],
  [1, mean("jour : fantôme de devant")],
  [3, mean("jour : envoi d'un temps (rejeu)")],
]);
console.log("\nHypothèses (un joueur) : circuit du jour = 1 lecture du circuit, 3 classements, 2 fantômes, 3 temps envoyés (chacun améliore le précédent).");
console.log("Salon de 30 minutes = 3 sessions : `maintenant` toutes les 10 s (180), classement toutes les 5 s (360 dont 30 % ont changé), 4 lots de fantômes par session (12), 2 envois par session (6).");

// Synchronisation du profil (lot 30) : un lancement + un retour à l'accueil par visite, deux visites par jour = 4 lectures du profil.
const syncOnly = (history: number) => budgetOf([[1, mean(`profil ${history} j : GET /api/me (1re lecture : calcule les places des jours terminés)`)], [3, mean(`profil ${history} j : GET /api/me`)]]);

const FREE = { requests: 2_000_000, vcpuS: 180_000, tursoRead: 500_000_000, tursoWritten: 10_000_000 };
const report = (label: string, b: Budget) => {
  const perDay = (limit: number, per: number) => (per > 0 ? Math.floor(limit / 30 / per) : Infinity);
  console.log(
    `  ${label.padEnd(44)} ${fmt(b.requests, 0).padStart(5)} req · ${fmt(b.statements, 0).padStart(5)} instr. · ${fmt(b.read, 0).padStart(8)} lues · ${fmt(b.written, 1).padStart(5)} écrites · ${fmt(b.cpuMs / 1000, 1)} s de calcul (jusqu'à ${fmt(b.vcpuHigh, 0)} vCPU-s facturées)`,
  );
  console.log(
    `  ${"".padEnd(44)} → joueurs par jour que tient l'offre gratuite : requêtes ${perDay(FREE.requests, b.requests)} · Turso lignes lues ${perDay(FREE.tursoRead, b.read)} · lignes écrites ${perDay(FREE.tursoWritten, b.written)} · vCPU (calcul seul ${perDay(FREE.vcpuS, b.cpuMs / 1000)} ; borne haute ${perDay(FREE.vcpuS, b.vcpuHigh)})`,
  );
};
console.log("\n=== Un joueur, une journée ===");
report("circuit du jour seul", dayOnly);
for (const h of HISTORY) report(`+ synchronisation du profil (4 lectures, ${h} j d'historique)`, sum(dayOnly, syncOnly(h)));
for (const players of SALON_PLAYERS) {
  const s = salonBy.get(players)!;
  const salon30 = budgetOf([
    [180, s.now!],
    [252, s.boardSame!],
    [108, s.boardNew!],
    [12, s.ghosts!],
    [3, s.submitFirst!],
    [3, s.submitNext!],
  ]);
  report(`+ 30 min de Salon (${players} présents)`, sum(dayOnly, salon30));
  report(`  dont le Salon seul`, salon30);
}
console.log(`\n(Rediffusion : ${fmt(replayKb, 1)} ko en moyenne ; aller-retour vers la base supposé : ${RTT_MS} ms ; génération d'un circuit : voir « premier envoi » ci-dessus.)`);
await reset();
