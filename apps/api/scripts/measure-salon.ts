import { mkdtempSync, rmSync, statSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { daysFromCivil, encodeReplay, runPilot, salonCircuit, salonSessionAt, salonSessionEnd, salonSessionStart } from "@cdj/sim";
import { createApi } from "../src/api";
import { openSqlite } from "../src/node-sqlite";

// `npm run measure:salon` (lot 27) : charge du Salon sur le serveur Node. N joueurs (50 par défaut) jouent une session entière :
// chacun envoie une course toutes les 40 s et lit le classement toutes les 5 s (plus `now` toutes les 30 s et les fantômes quand le
// classement change). L'horloge est **simulée** (la session de 10 minutes se déroule en une trentaine de secondes de calcul) ; ce qui est
// mesuré est le **vrai** temps de calcul de chaque requête (rejeu compris), la mémoire, la taille de la base. Les requêtes passent par
// `api.handle` (le même code que le serveur HTTP, sans la couche réseau, qui est négligeable devant un rejeu).
//
// Variables : PLAYERS (50) · SUBMIT_EVERY (40, secondes) · POLL_EVERY (5) · SESSION_MINUTES (10) · MEM=1 (base en mémoire au lieu d'un fichier).
const PLAYERS = Number(process.env.PLAYERS ?? 50);
const SUBMIT_EVERY = Number(process.env.SUBMIT_EVERY ?? 40) * 1000;
const POLL_EVERY = Number(process.env.POLL_EVERY ?? 5) * 1000;
const NOW_EVERY = 30_000;
const SESSION_MS = Number(process.env.SESSION_MINUTES ?? 10) * 60_000;

if (process.env.DB_PATH || process.env.NODE_ENV === "production") {
  console.error("measure:salon refuse de tourner avec DB_PATH ou NODE_ENV=production : il fabrique sa propre base.");
  process.exit(1);
}

const START = daysFromCivil(2026, 10, 14) * 86_400_000 + 12 * 3_600_000; // 14/10/2026 12:00 UTC, début d'une session de 10 minutes
const session = salonSessionAt(START);
const end = salonSessionEnd(session);
if (SESSION_MS !== end - salonSessionStart(session)) console.log(`(durée de session ${SESSION_MS / 60_000} min : seule la durée de la mesure change, pas le coût d'une requête)`);

// --- Préparation (non mesurée) : le circuit de la session et quelques rediffusions de niveaux variés ----------------------
console.log(`Préparation : circuit de la session ${session}, rediffusions de pilotes…`);
let t = performance.now();
const circuit = salonCircuit(session);
const generateMs = performance.now() - t;
const replays: string[] = [];
for (const grip of [0.97, 0.93, 0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.66, 0.62, 0.58, 0.54]) {
  const run = runPilot(circuit.track, { grip });
  if (run.valid) replays.push(encodeReplay(run.replay));
}
if (replays.length < 4) throw new Error("trop peu de pilotes finissent ce circuit");
const replayBytes = replays.reduce((n, r) => n + r.length, 0) / replays.length;

const dir = mkdtempSync(join(tmpdir(), "cdj-salon-"));
const dbFile = process.env.MEM ? ":memory:" : join(dir, "salon.sqlite");
const db = openSqlite(dbFile);
let clock = START;
const api = createApi({ db, now: () => clock, rateSalt: "mesure" });
await api.handle(new Request("http://load.test/api/health")); // crée les tables

// --- Les joueurs ----------------------------------------------------------------------------------------------------------
interface Player {
  id: string;
  name: string;
  ip: string;
  seen: Set<string>; // fantômes déjà chargés (ref:temps), comme le cache du jeu
  version?: number;
}
const players: Player[] = Array.from({ length: PLAYERS }, (_, i) => ({
  id: i.toString(16).padStart(32, "0"),
  name: `Charge ${i + 1}`,
  ip: `10.0.${i >> 8}.${i & 255}`,
  seen: new Set(),
}));

type Kind = "now" | "board" | "ghosts" | "submit" | "tick";
const samples: Record<Kind, number[]> = { now: [], board: [], ghosts: [], submit: [], tick: [] };
const errors: Record<string, number> = {};
let bytesOut = 0;

async function call(kind: Exclude<Kind, "tick">, p: Player, path: string, body?: unknown): Promise<any> {
  const init: RequestInit = body === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://load.test${path}`, init), { clientKey: p.ip });
  const text = await res.text();
  samples[kind].push(performance.now() - t0);
  bytesOut += text.length;
  if (res.status !== 200) {
    const key = `${kind} ${res.status}`;
    errors[key] = (errors[key] ?? 0) + 1;
    return null;
  }
  return JSON.parse(text);
}

async function poll(p: Player): Promise<void> {
  const board = await call("board", p, `/api/salon/${session}/board?player=${p.id}${p.version !== undefined ? `&since=${p.version}` : ""}`);
  if (!board || board.unchanged) return;
  p.version = board.version;
  // Comme le jeu : trois premiers, le voisin de devant et celui de derrière, plus soi-même ; seulement ceux qu'il n'a pas déjà.
  const mine = board.me?.rank ?? 0;
  const wanted = (board.rows as { rank: number; ref: string; ms: number }[])
    .filter((r) => r.rank <= 3 || Math.abs(r.rank - mine) <= 1)
    .filter((r) => !p.seen.has(`${r.ref}:${r.ms}`));
  if (wanted.length === 0) return;
  await call("ghosts", p, `/api/salon/${session}/ghosts?refs=${wanted.map((r) => r.ref).join(",")}`);
  for (const r of wanted) p.seen.add(`${r.ref}:${r.ms}`);
}

// --- Déroulé de la session (horloge simulée) --------------------------------------------------------------------------------
interface Event {
  at: number;
  run: () => Promise<void>;
  kind: Kind;
}
const events: Event[] = [];
let attempt = 0;
players.forEach((p, i) => {
  // Arrivée étalée sur les 40 premières secondes ; premier envoi après une course (≈ 35 s), puis un envoi toutes les 40 s.
  const joinAt = Math.round((i * 40_000) / PLAYERS);
  for (let at = joinAt; at < SESSION_MS; at += POLL_EVERY) events.push({ at, kind: "board", run: () => poll(p) });
  for (let at = joinAt; at < SESSION_MS; at += NOW_EVERY) events.push({ at, kind: "now", run: async () => void (await call("now", p, `/api/salon/now?player=${p.id}`)) });
  for (let at = joinAt + 35_000; at < SESSION_MS; at += SUBMIT_EVERY) {
    const replay = replays[(i * 7 + attempt++) % replays.length]!;
    events.push({ at, kind: "submit", run: async () => void (await call("submit", p, `/api/salon/${session}/submit`, { playerId: p.id, name: p.name, replay })) });
  }
});
for (let at = 0; at < SESSION_MS; at += 15_000) {
  events.push({
    at,
    kind: "tick",
    run: async () => {
      const t0 = performance.now();
      await api.tick();
      samples.tick.push(performance.now() - t0);
    },
  });
}
events.sort((a, b) => a.at - b.at);
const submitsPlanned = events.filter((e) => e.kind === "submit").length;
const readsPlanned = events.filter((e) => e.kind === "board" || e.kind === "now").length;

console.log(`Session de ${SESSION_MS / 60_000} min, ${PLAYERS} joueurs : ${submitsPlanned} envois (un toutes les ${SUBMIT_EVERY / 1000} s), ${readsPlanned} lectures (classement toutes les ${POLL_EVERY / 1000} s)…`);
const mem0 = process.memoryUsage();
const cpu0 = process.cpuUsage();
const wall0 = performance.now();
for (const e of events) {
  clock = START + e.at;
  await e.run();
}
const wallMs = performance.now() - wall0;
const cpu = process.cpuUsage(cpu0);
const mem1 = process.memoryUsage();

// --- Pire cas : tous les joueurs envoient en même temps (fin de session, tout le monde finit son dernier tour) --------------
clock = START + SESSION_MS + 6000; // juste après la fin (envois encore acceptés) ; plus de 5 s après le dernier envoi de chacun
const burst: number[] = [];
const burstT0 = performance.now();
await Promise.all(
  players.map(async (p, i) => {
    const t0 = performance.now();
    const res = await api.handle(
      new Request(`http://load.test/api/salon/${session}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: p.id, name: p.name, replay: replays[i % replays.length] }),
      }),
      { clientKey: p.ip },
    );
    await res.text();
    if (res.status === 200) burst.push(performance.now() - t0);
    else errors[`salve ${res.status}`] = (errors[`salve ${res.status}`] ?? 0) + 1;
  }),
);
const burstMs = performance.now() - burstT0;

const runs = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs"))?.n ?? 0;
const dbBytes = process.env.MEM ? 0 : statSync(dbFile).size;

const q = (xs: number[], p: number) => (xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!);
const ms = (x: number) => x.toFixed(2).padStart(8);
console.log(`\nRequêtes (ms de calcul réel, une par une) :`);
console.log(`  ${"".padEnd(8)} ${"nombre".padStart(7)} ${"médiane".padStart(8)} ${"p95".padStart(8)} ${"max".padStart(8)} ${"total s".padStart(8)}`);
let totalMs = 0;
for (const k of ["submit", "board", "ghosts", "now", "tick"] as Kind[]) {
  const xs = samples[k];
  const sum = xs.reduce((a, b) => a + b, 0);
  totalMs += sum;
  console.log(`  ${k.padEnd(8)} ${String(xs.length).padStart(7)} ${ms(q(xs, 0.5))} ${ms(q(xs, 0.95))} ${ms(Math.max(0, ...xs))} ${(sum / 1000).toFixed(2).padStart(8)}`);
}
const sessionSeconds = SESSION_MS / 1000;
const busy = totalMs / SESSION_MS;
console.log(`\nCharge d'une session de ${sessionSeconds / 60} min à ${PLAYERS} joueurs : ${(totalMs / 1000).toFixed(1)} s de calcul (CPU processus : ${((cpu.user + cpu.system) / 1e6).toFixed(1)} s, durée réelle de la simulation : ${(wallMs / 1000).toFixed(1)} s)`);
console.log(`  → fil principal occupé ${(busy * 100).toFixed(1)} % du temps (${(totalMs / sessionSeconds / PLAYERS).toFixed(2)} ms de calcul par joueur et par seconde)`);
console.log(`  → rejeu d'un envoi : ${ms(q(samples.submit, 0.5)).trim()} ms en médiane ; débit moyen ${(samples.submit.length / sessionSeconds).toFixed(2)} envois/s, ${(samples.board.length / sessionSeconds).toFixed(1)} lectures de classement/s`);
console.log(`  → réponses : ${(bytesOut / 1024).toFixed(0)} ko au total (${(bytesOut / sessionSeconds / 1024).toFixed(1)} ko/s)`);
console.log(`\nSalve (les ${PLAYERS} joueurs envoient au même instant) : ${(burstMs / 1000).toFixed(2)} s pour tout traiter, réponse en ${ms(q(burst, 0.5)).trim()} ms (médiane) à ${ms(Math.max(0, ...burst)).trim()} ms (la dernière) — pendant ce temps le serveur ne répond à rien d'autre`);
const mb = (x: number) => (x / 1048576).toFixed(0);
console.log(`Mémoire : RSS ${mb(mem0.rss)} → ${mb(mem1.rss)} Mo, tas JS ${mb(mem0.heapUsed)} → ${mb(mem1.heapUsed)} Mo ; base : ${runs} courses gardées${dbBytes ? `, fichier ${(dbBytes / 1048576).toFixed(1)} Mo (≈ ${(replayBytes / 1024).toFixed(1)} ko par rediffusion)` : ""}`);
if (Object.keys(errors).length) console.log(`Réponses non 200 : ${JSON.stringify(errors)}`);
console.log(`Génération d'un circuit de session (préparée deux minutes avant) : ${(generateMs / 1000).toFixed(2)} s, pendant lesquelles le serveur ne répond à rien d'autre`);

// --- Estimation ------------------------------------------------------------------------------------------------------------
const perPlayer = totalMs / PLAYERS / sessionSeconds; // ms de calcul par joueur et par seconde
const at = (load: number) => Math.floor((load * 1000) / perPlayer);
console.log(`\nEstimation pour ce processeur (${cpus()[0]?.model.trim() ?? "?"}, 1 cœur utilisé : Node traite les requêtes sur un seul fil) :`);
console.log(`  50 % du fil occupé ≈ ${at(0.5)} joueurs présents en continu ; 80 % ≈ ${at(0.8)} (au-delà, les lectures attendent derrière les rejeux).`);
console.log(`  Données : un seul meilleur temps (et sa rediffusion) gardé par joueur et par session → ${PLAYERS} joueurs ≈ ${(PLAYERS * replayBytes / 1024).toFixed(0)} ko de rediffusions par session, ${((PLAYERS * replayBytes * (172800_000 / SESSION_MS)) / 1048576).toFixed(0)} Mo sur 48 h.`);

if (!process.env.MEM) {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
