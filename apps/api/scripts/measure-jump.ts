// `npm run measure:jump-api -w @cdj/api` (lot P0 de la plateforme) : ce que coûte `/api/jump/day` et `/api/jump/info`. Les requêtes passent par
// le **vrai code** de l'API (`api.handle`), sur un **vrai serveur libSQL** (`sqld`, le moteur et le protocole de Turso), qui répond pour chaque
// instruction le nombre de **lignes lues** et **écrites** (ce que Turso facture), comme `measure:budget`. Mesuré : premier calcul d'un niveau
// (généré, puis figé), relecture en mémoire de l'instance, relecture en base par une instance neuve (réveil de Cloud Run).
// Lot P1 : le classement — `POST /api/jump/submit` (premier essai qui crée le joueur, essai amélioré, essai qui n'améliore pas, refus de
// version), `GET /api/jump/day/<date>/board` (sans et avec joueur, avec 30 classés), puis **un joueur type** (chargement, une arrivée, un
// partage) sur une journée, à comparer avec celui de DailyTrack (`npm run measure:budget`).
// Lot P2 : le fantôme du premier (`GET /api/jump/day/<date>/ghost/first`, jour en cours et jour passé) et le profil DailyJump
// (`GET /api/jump/me`, 1 jour puis 30 jours d'historique), et le joueur type avec eux.
// Lot P3 : les morts de tout le monde — un lot de vies (instructions, lignes, temps de rejeu), une journée de joueur type (50 morts, 3 lots,
// plafond de 30), la carte et l'échantillon avec **1 000 joueurs simulés** (calcul, lignes lues, taille des réponses), l'oubli d'un jour, et
// le seuil de l'offre gratuite de Turso (500 M lignes lues, 10 M écrites par mois) et de Cloud Run (2 M requêtes par mois).
// Lot P4 : la lecture regroupée (`/bundle` : classement, fantôme du premier, carte, profil du jour) et l'envoi qui rend le classement ; le
// joueur type avant / après, **avec les pré-vols CORS** (OPTIONS : une requête Cloud Run par adresse personnelle et par 2 heures dans Chrome,
// jamais comptés avant ce lot) ; le seuil de l'offre gratuite pour DailyJump seul. Le partage avec DailyTrack : `npm run measure:platform`.
//
//   docker run -d -p 8081:8080 ghcr.io/tursodatabase/libsql-server     (un sqld local)
//   SQLD_URL=http://localhost:8081 npm run measure:jump-api -w @cdj/api
//
// ⚠ Le script **vide** la table `jump_levels` (et le schéma) de ce serveur : il refuse tout ce qui n'est pas localhost.
import { readFileSync, readdirSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, checkLife, decodeReplay, demoAttempts, encodeReplay, lifeReplay, replayAttempt } from "@cdj/jump-sim";
import { JUMP_MAP_REFRESH_MS } from "../src/jumpLives";
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
const make = () => createApi({ db, now: () => clock.now, rateSalt: "mesure", jumpFrozen: frozen, environment: "local", allowCopies: true });

const TABLES = ["jump_levels", "jump_results", "jump_lives", "jump_deaths", "players", "rate", "revoked_codes", "meta"];
for (const t of TABLES) await db.run(`DROP TABLE IF EXISTS ${t}`);

const costs = new Map<string, { statements: number; read: number; written: number; ms: number }>();
const sizes = new Map<string, number>();
async function measure(label: string, api: ReturnType<typeof make>, path: string, init: RequestInit = {}, client = "203.0.113.7"): Promise<void> {
  const before = { ...tally };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, init), { clientKey: client });
  const ms = performance.now() - t0;
  const text = await res.text();
  const body = (JSON.parse(text) as { source?: string }) ?? {};
  sizes.set(label, text.length);
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

// --- Lot P3 : les morts de tout le monde ----------------------------------------------------------------------------------------------
console.log(`\n--- Les morts de tout le monde (lot P3) ---\n`);
// Des vies qui finissent par une mort, tirées d'essais fictifs du niveau du jour (perturbations de la preuve de l'auteur).
const pool: string[] = [];
for (const a of demoAttempts(day.level, day.replay, 0x9a7e, { attempts: 120, maxLives: 8 })) {
  for (const life of replayAttempt(day.level, a.replay, day.id).lives) if (life.end === "mort") pool.push(encodeReplay(lifeReplay(a.replay, life)));
}
const lengths = pool.map((c) => c.length);
console.log(`${pool.length} vies (des morts) disponibles, ${Math.min(...lengths)} à ${Math.max(...lengths)} caractères (moyenne ${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)})`);
const lotOf = (lives: string[], extra: Record<string, unknown> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Player-Id": me },
  body: JSON.stringify({ levelId: day.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives, ...extra }),
});
// Le rejeu seul d'un lot de 10 vies (dans le processus, sans base) : ce que coûte la validation.
const level = day.level;
const t10 = performance.now();
for (const c of pool.slice(0, 10)) checkLife(level, decodeReplay(c), day.id);
const replay10 = performance.now() - t10;
console.log(`rejeu de 10 vies (checkLife, sans base) : ${replay10.toFixed(1)} ms\n`);
await measure("lives : premier lot de 10 (crée la ligne du joueur)", c, "/api/jump/lives", lotOf(pool.slice(0, 10)));
await measure("lives : deuxième lot de 10", c, "/api/jump/lives", lotOf(pool.slice(10, 20)));
await measure("lives : troisième lot de 10 (le plafond de 30 atteint)", c, "/api/jump/lives", lotOf(pool.slice(20, 30)));
await measure("lives : lot renvoyé (10 doublons, rien n'est écrit)", c, "/api/jump/lives", lotOf(pool.slice(20, 30)));
await measure("lives : lot au-delà du plafond (refusé sans rejeu)", c, "/api/jump/lives", lotOf(pool.slice(30, 40)));
await measure("lives : autre version (refus avant le rejeu)", c, "/api/jump/lives", lotOf(pool.slice(30, 40), { generatorVersion: 0 }));
clock.now += JUMP_MAP_REFRESH_MS;
await measure("deaths : carte recalculée (1 joueur)", c, `/api/jump/day/${date}/deaths`);
await measure("deaths : même instance (mémoire, 3 min)", c, `/api/jump/day/${date}/deaths`);
await measure("carnage : échantillon (mémoire, calculé avec la carte)", c, `/api/jump/day/${date}/carnage`);
const fresh2 = make();
await fresh2.handle(new Request("http://api.test/api/health"));
await measure("instance neuve : deaths (lu en base, rien de nouveau)", fresh2, `/api/jump/day/${date}/deaths`);

// 1 000 joueurs simulés : 40 joueurs envoient vraiment leurs vies (par l'API, rejouées), puis leurs lignes sont recopiées pour 960 autres
// identifiants (mêmes vies : seul le coût de lecture et de calcul compte ici).
const PLAYERS = 1000;
for (let i = 0; i < 40; i++) {
  const id = hex(5000 + i);
  await db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, ?, 1, 1, 0, ?)", [id, `Mesure${i}`, `mesure${i}`]);
  const start = (i * 17) % Math.max(1, pool.length - 30);
  await c.handle(
    new Request("http://api.test/api/jump/lives", { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": id }, body: JSON.stringify({ levelId: day.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: pool.slice(start, start + 30) }) }),
    { clientKey: `192.0.2.${i}` },
  );
}
for (let i = 40; i < PLAYERS; i++) {
  await db.run("INSERT INTO jump_lives (day, player_id, level_id, count, lives, rev, updated_at) SELECT day, ?, level_id, count, lives, 1, updated_at FROM jump_lives WHERE day = ? AND player_id = ?", [hex(5000 + i), today, hex(5000 + (i % 40))]);
}
await db.run("UPDATE jump_deaths SET version = version + 1 WHERE day = ?", [today]);
const rowBytes = (await db.first<{ n: number }>("SELECT AVG(LENGTH(lives)) AS n FROM jump_lives WHERE day = ?", [today]))!.n;
console.log(`\n${PLAYERS + 1} joueurs avec des vies aujourd'hui ; ligne d'un joueur à 30 vies : ${Math.round(rowBytes)} octets en moyenne\n`);
clock.now += JUMP_MAP_REFRESH_MS;
await measure(`deaths : carte recalculée (${PLAYERS} joueurs)`, c, `/api/jump/day/${date}/deaths`);
await measure(`carnage : échantillon (${PLAYERS} joueurs, mémoire)`, c, `/api/jump/day/${date}/carnage`);
const fresh3 = make();
await fresh3.handle(new Request("http://api.test/api/health"));
await measure(`instance neuve : carnage (${PLAYERS} joueurs, lu en base)`, fresh3, `/api/jump/day/${date}/carnage`);
console.log(`  taille des réponses : carte ${sizes.get(`deaths : carte recalculée (${PLAYERS} joueurs)`)} octets, échantillon ${sizes.get(`carnage : échantillon (${PLAYERS} joueurs, mémoire)`)} octets`);
// --- Lot P4 : la lecture regroupée ---------------------------------------------------------------------------------------------------
console.log(`\n--- La lecture regroupée (lot P4) : ${PLAYERS + 1} joueurs avec des vies, 31 classés, le joueur avec 30 jours d'historique ---\n`);
const asMe = { headers: { "X-Player-Id": me } };
await measure("bundle, sans joueur (carte en mémoire)", c, `/api/jump/day/${date}/bundle`);
await measure("bundle, joueur classé (profil du jour compris)", c, `/api/jump/day/${date}/bundle`, asMe);
const fresh4 = make();
await fresh4.handle(new Request("http://api.test/api/health"));
await measure("instance neuve : bundle, joueur classé (carte lue en base)", fresh4, `/api/jump/day/${date}/bundle`, asMe);
await measure("instance neuve : bundle, même instance ensuite", fresh4, `/api/jump/day/${date}/bundle`, asMe);
await measure("bundle d'un jour passé (archive, sans profil)", c, `/api/jump/day/${past}/bundle`, asMe);
console.log(`  taille de la réponse regroupée (joueur classé, 30 jours) : ${sizes.get("bundle, joueur classé (profil du jour compris)")} octets`);

// L'oubli : le lendemain, après la grâce, la première requête fige la carte et l'échantillon et efface les vies brutes.
const forgetClock = clock.now;
clock.now = (today + 1) * 86_400_000 + 12 * 3_600_000;
const g = make();
await g.handle(new Request("http://api.test/api/health"));
await measure(`oubli du jour (${PLAYERS + 1} joueurs : carte et échantillon figés, vies effacées)`, g, "/api/jump/info");
await measure("jour passé : deaths (figé, lu en base)", g, `/api/jump/day/${date}/deaths`);
await measure("jour passé : deaths (figé, mémoire)", g, `/api/jump/day/${date}/deaths`);
clock.now = forgetClock;

// Joueur type du lot P3 : 50 morts dans la journée, 3 lots (le jeu n'envoie que 30 morts : plafond) ; la carte lue à chaque chargement (2) et
// rafraîchie à chaque arrivée (4) ; le carnage de tout le monde regardé 2 fois. Les lectures de la carte et de l'échantillon sont presque
// toujours servies par la mémoire de l'instance (3 min) : on les compte au prix d'une lecture en base (le pire cas pour un joueur seul).
const typicalP3 = sum([
  [1, "pseudo libre ? (GET /api/name, la plateforme)"],
  [1, "submit : premier essai (crée le joueur)"],
  [1, "submit : essai amélioré"],
  [6, "board, joueur classé"],
  [6, "ghost/first, jour en cours (joueur)"],
  [4, "/api/jump/me, 30 jours classés"],
  [1, "lives : premier lot de 10 (crée la ligne du joueur)"],
  [2, "lives : deuxième lot de 10"],
  [6, "instance neuve : deaths (lu en base, rien de nouveau)"],
  [2, `instance neuve : carnage (${PLAYERS} joueurs, lu en base)`],
]);
const livesOnly = sum([
  [1, "lives : premier lot de 10 (crée la ligne du joueur)"],
  [2, "lives : deuxième lot de 10"],
  [6, "instance neuve : deaths (lu en base, rien de nouveau)"],
  [2, `instance neuve : carnage (${PLAYERS} joueurs, lu en base)`],
]);
console.log(
  `\nJoueur type avec le lot P3 (P2 + 3 lots de vies, carte ×6, carnage ×2) : ${typicalP3.requests} requêtes · ${typicalP3.statements} instructions · ${typicalP3.read} lignes lues · ${typicalP3.written} lignes écrites`,
);
console.log(`  dont le lot P3 : ${livesOnly.requests} requêtes · ${livesOnly.read} lignes lues · ${livesOnly.written} lignes écrites`);
// Lot P4 : le joueur type du lot P3 avec le jeu du lot P4. Mêmes hypothèses (2 chargements, 4 arrivées dont 2 envois, 1 pseudo, 50 morts dont 30
// envoyées en 3 lots, carnage de tout le monde regardé 2 fois, 30 jours d'historique) : chaque chargement = **une** lecture regroupée (classement,
// premier, carte, profil) ; à l'arrivée, le jour n'est relu que si la dernière lecture a plus de 3 minutes (une fois par visite) ; l'envoi rend le
// classement (rien à relire) ; plus de relecture du profil après un envoi (l'historique local a l'essai). Lectures comptées au prix d'une instance
// neuve (le pire cas pour un joueur seul).
const typicalP4 = sum([
  [1, "pseudo libre ? (GET /api/name, la plateforme)"],
  [1, "submit : premier essai (crée le joueur)"],
  [1, "submit : essai amélioré"],
  [4, "instance neuve : bundle, joueur classé (carte lue en base)"],
  [1, "lives : premier lot de 10 (crée la ligne du joueur)"],
  [2, "lives : deuxième lot de 10"],
  [2, `instance neuve : carnage (${PLAYERS} joueurs, lu en base)`],
]);
// Les pré-vols CORS (OPTIONS) : le navigateur en fait un par adresse « personnelle » (en-tête `X-Player-Id`, corps JSON) et le garde 2 heures
// (Chrome). Hypothèse : deux visites à plus de 2 heures d'écart. P3 : board, ghost/first, /jump/me, submit, lives (+ /api/name la première
// visite) = 6 + 5 ; P4 : bundle, submit, lives (+ /api/name) = 4 + 3. Aucune ligne Turso, un peu de calcul.
const PREFLIGHTS_P3 = 11;
const PREFLIGHTS_P4 = 7;
console.log(
  `\nJoueur type avec le lot P4 (lecture regroupée ×4, carnage ×2, 3 lots de vies, 2 envois, 1 pseudo) : ${typicalP4.requests} requêtes · ${typicalP4.statements} instructions · ${typicalP4.read} lignes lues · ${typicalP4.written} lignes écrites`,
);
console.log(`  pré-vols CORS (OPTIONS, deux visites à plus de 2 h d'écart) : P3 ${PREFLIGHTS_P3}, P4 ${PREFLIGHTS_P4} → requêtes Cloud Run par jour : P3 ${typicalP3.requests + PREFLIGHTS_P3}, P4 ${typicalP4.requests + PREFLIGHTS_P4}`);

// Coût du jour qui ne dépend pas d'un joueur : la carte recalculée au plus toutes les 3 min tant que des vies arrivent (≤ 480 fois par jour,
// une ligne lue par joueur du jour et une écrite), puis l'oubli (une ligne lue et une effacée par joueur).
const rebuild = costs.get(`deaths : carte recalculée (${PLAYERS} joueurs)`)!;
const forgetCost = costs.get(`oubli du jour (${PLAYERS + 1} joueurs : carte et échantillon figés, vies effacées)`)!;
const perRebuildRead = rebuild.read / (PLAYERS + 1);
console.log(`  carte recalculée : ${rebuild.read} lignes lues pour ${PLAYERS + 1} joueurs (${perRebuildRead.toFixed(2)} par joueur), ${rebuild.written} écrite, ${rebuild.ms.toFixed(0)} ms`);
console.log(`  oubli : ${forgetCost.read} lignes lues, ${forgetCost.written} écrites (effacements compris), ${forgetCost.ms.toFixed(0)} ms`);
const REBUILDS = (24 * 60) / (JUMP_MAP_REFRESH_MS / 60_000);
const month = (player: { read: number; written: number; requests: number }, preflights: number) => (n: number) => {
  const reads = 30 * (n * player.read + REBUILDS * (n * perRebuildRead + 2) + n * (forgetCost.read / (PLAYERS + 1)));
  const writes = 30 * (n * player.written + REBUILDS + n * (forgetCost.written / (PLAYERS + 1)));
  const requests = 30 * n * (player.requests + preflights);
  return { reads, writes, requests };
};
for (const [label, player, preflights] of [
  ["P3, sans les pré-vols (le chiffre du lot P3)", typicalP3, 0],
  ["P3, pré-vols compris", typicalP3, PREFLIGHTS_P3],
  ["P4, sans les pré-vols", typicalP4, 0],
  ["P4, pré-vols compris", typicalP4, PREFLIGHTS_P4],
] as const) {
  const m = month(player, preflights);
  for (const n of [1000, 3000]) {
    const x = m(n);
    console.log(`  ${label.padEnd(44)} ${String(n).padStart(5)} joueurs/jour : ${(x.reads / 1e6).toFixed(1)} M lues, ${(x.writes / 1e6).toFixed(2)} M écrites, ${(x.requests / 1e6).toFixed(2)} M requêtes par mois`);
  }
  let limit = 1;
  while (m(limit).reads < 500e6 && m(limit).writes < 10e6 && m(limit).requests < 2e6) limit += 10;
  const y = m(limit);
  const which = y.reads >= 500e6 ? "lignes lues de Turso" : y.writes >= 10e6 ? "lignes écrites de Turso" : "requêtes de Cloud Run";
  console.log(`  ${label.padEnd(44)} → offre gratuite dépassée vers ${limit} joueurs DailyJump par jour (DailyJump seul ; premier plafond : ${which})`);
}
for (const t of TABLES) await db.run(`DROP TABLE IF EXISTS ${t}`);
