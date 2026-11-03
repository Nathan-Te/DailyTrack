// Lot D1 (analyse sans code) — reproduction locale des hypothèses de `docs/plateforme/analyse-refus.md`. **À lancer à la main, jamais par la CI.**
// Tout est local : base libSQL `file:` (jamais Turso, règle R14), horloge fixée, aucun accès à la production. Le script n'écrit rien dans le dépôt.
//
//   TMP=$(mktemp -d) && npx esbuild scripts/analyse/reproduire-refus.ts --bundle --platform=node --format=esm --target=node22 --outfile=$TMP/rep.mjs --log-level=warning \
//     "--banner:js=import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" && NODE_NO_WARNINGS=1 node $TMP/rep.mjs   (depuis la racine du dépôt)
//
// Il joue, sur le vrai code de l'API (`createApi`) :
//   A. le coût d'un envoi (instructions SQL, durée) — de quoi calculer la latence par instruction qui ferait dépasser les 8 s du jeu (H1) ;
//   B. un jeu qui abandonne l'attente alors que le serveur finit son travail, puis renvoie (H1 + H2), par un vrai serveur HTTP ;
//   C. un refus de chaque famille, et ce que le tableau de bord en compte (`journal_erreurs`) : H2, H3, H4, H5, H7 ;
//   D. le plafond de rejeux (503) et les limites de débit (429).
import { mkdtempSync } from "node:fs";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyCircuit, decodeReplay as decodeTrack, encodeReplay as encodeTrack, runPilot } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import { createApi } from "../../apps/api/src/api";
import { createNodeServer } from "../../apps/api/src/node-server";
import { fictionalJumps, jumpDailyOf } from "../../apps/api/src/jumpHistory";
import { openLibsql } from "../../apps/api/src/libsql-open";
import type { SqlDb, SqlValue } from "../../apps/api/src/db";

const DAY_MS = 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) => n.toString(16).padStart(32, "0");
const dir = mkdtempSync(join(tmpdir(), "analyse-refus-"));
let dbCount = 0;

/** Une base neuve (fichier libSQL local) dont chaque instruction est comptée et peut être ralentie (`latenceMs` = un aller-retour réseau vers Turso). */
async function ouvrir(latenceMs: () => number) {
  const base = await openLibsql({ url: `file:${join(dir, `b${dbCount++}.db`)}` });
  const t = { instructions: 0 };
  const pause = async () => {
    t.instructions++;
    const l = latenceMs();
    if (l > 0) await sleep(l);
  };
  const db: SqlDb = {
    async run(sql: string, p?: SqlValue[]) {
      await pause();
      return base.run(sql, p);
    },
    async first<T>(sql: string, p?: SqlValue[]) {
      await pause();
      return base.first<T>(sql, p);
    },
    async all<T>(sql: string, p?: SqlValue[]) {
      await pause();
      return base.all<T>(sql, p);
    },
    async batch(s) {
      await pause();
      return base.batch(s);
    },
  };
  return { db, base, t };
}

// --- Les données : Track (le pilote automatique du jour) et Jump (un essai fictif du jour) ------------------------------------------------
const TRACK_DAY = daysFromCivil(2026, 10, 14);
const trackCircuit = dailyCircuit(TRACK_DAY);
const trackRun = runPilot(trackCircuit.track, { grip: 0.9 });
const trackCode = encodeTrack(trackRun.replay);
const otherCircuit = dailyCircuit(TRACK_DAY - 1);
const otherRun = runPilot(otherCircuit.track, { grip: 0.9 });

const levelsDir = new URL("apps/jump/public/levels/", `file://${process.cwd()}/`); // à lancer depuis la racine du dépôt
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(levelsDir).sort()) {
  const d = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (d) frozen[d] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}
const JUMP_DAY = daysFromCivil(2026, 10, 19);
const jumpLevel = jumpDailyOf(JUMP_DAY, frozen);
// Le premier joueur fictif rejoue les entrées de l'auteur (voir `fictionalJumps`) : un envoi qui serait refusé comme copie. On l'écarte.
const jumpOthers = fictionalJumps(jumpLevel, 8).slice(1);

const clock = { now: TRACK_DAY * DAY_MS + 12 * 3_600_000 }; // 14/10/2026, midi UTC (Paris : 14 h)
const jumpClock = { now: JUMP_DAY * DAY_MS + 12 * 3_600_000 };
const mk = (db: SqlDb, c: { now: number }, extra: Record<string, unknown> = {}) =>
  createApi({ db, now: () => c.now, rateSalt: "analyse-refus-0123456789", jumpFrozen: frozen, environment: "local", allowCopies: false, ...extra } as never);

type Api = ReturnType<typeof mk>;
async function appel(api: Api, method: string, path: string, body: unknown, headers: Record<string, string> = {}, client = "203.0.113.7") {
  const init: RequestInit = { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };
  const t0 = performance.now();
  const res = await api.handle(new Request(`http://api.test${path}`, init), { clientKey: client });
  const ms = performance.now() - t0;
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Record<string, any>) : {}, ms };
}
const trackSubmit = (api: Api, joueur: number, replay: string, extra: Record<string, unknown> = {}, client?: string) =>
  appel(api, "POST", "/api/submit", { name: `Joueur${joueur}`, date: formatDay(TRACK_DAY), replay, ...extra }, { "X-Player-Id": hex(joueur) }, client);
const jumpSubmit = (api: Api, joueur: number, replay: string, extra: Record<string, unknown> = {}, client?: string) =>
  appel(api, "POST", "/api/jump/submit", { name: `Joueur${joueur}`, levelId: jumpLevel.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay, ...extra }, { "X-Player-Id": hex(joueur) }, client);

const ligne = (...c: (string | number)[]) => console.log(c.map((x, i) => (i === 0 ? String(x).padEnd(64) : String(x).padStart(10))).join(" "));

// --- A. Coût d'un envoi ---------------------------------------------------------------------------------------------------------------
console.log("\n=== A. Coût d'un envoi (une instance, base locale sans latence) ===\n");
const cout: Record<string, { instr: number; ms: number }> = {};
{
  const { db, t } = await ouvrir(() => 0);
  const api = mk(db, clock);
  await appel(api, "GET", "/api/health", undefined); // schéma
  for (const [nom, f] of [
    ["Track : 1er envoi, instance neuve (circuit généré)", () => trackSubmit(api, 1, trackCode)],
    ["Track : envoi suivant, instance chaude", () => trackSubmit(api, 2, runPilot(trackCircuit.track, { grip: 0.8 }).valid ? encodeTrack(runPilot(trackCircuit.track, { grip: 0.8 }).replay) : trackCode)],
  ] as const) {
    const i0 = t.instructions;
    const r = await f();
    cout[nom] = { instr: t.instructions - i0, ms: r.ms };
    ligne(`${nom} [HTTP ${r.status}]`, `${cout[nom]!.instr} instr.`, `${r.ms.toFixed(0)} ms`);
  }
}
{
  const { db, t } = await ouvrir(() => 0);
  const api = mk(db, jumpClock);
  await appel(api, "GET", "/api/health", undefined);
  for (const [nom, joueur, code] of [
    ["Jump : 1er envoi, instance neuve (niveau lu / calculé)", 1, jumpOthers[0]!.code],
    ["Jump : envoi suivant, instance chaude", 2, jumpOthers[1]!.code],
  ] as const) {
    const i0 = t.instructions;
    const r = await jumpSubmit(api, joueur, code);
    cout[nom] = { instr: t.instructions - i0, ms: r.ms };
    ligne(`${nom} [HTTP ${r.status}]`, `${cout[nom]!.instr} instr.`, `${r.ms.toFixed(0)} ms`);
  }
}
console.log("\nLatence par instruction SQL (aller-retour vers Turso) qui ferait dépasser les 8 s du jeu : (8000 − calcul) / instructions");
for (const [nom, c] of Object.entries(cout)) ligne(nom, `${c.instr} instr.`, `${Math.round((8000 - c.ms) / c.instr)} ms`);

console.log("\nDurée mesurée d'un envoi chaud avec une latence simulée par instruction :");
for (const l of [50, 150, 400]) {
  const { db } = await ouvrir(() => l);
  const api = mk(db, clock);
  await appel(api, "GET", "/api/health", undefined);
  await trackSubmit(api, 1, trackCode); // réchauffe (circuit gardé en base)
  const r = await trackSubmit(api, 2, encodeTrack(runPilot(trackCircuit.track, { grip: 0.8 }).replay));
  ligne(`  Track, ${l} ms par instruction [HTTP ${r.status}]`, `${r.ms.toFixed(0)} ms`);
}

// --- B. Le jeu abandonne à 8 s, le serveur finit (H1), puis le jeu renvoie (H2) ----------------------------------------------------------
console.log("\n=== B. Abandon côté jeu pendant que le serveur travaille, puis renvoi (vrai serveur HTTP, Node) ===\n");
{
  let latence = 0;
  const { db, base } = await ouvrir(() => latence);
  const api = mk(db, clock);
  const srv = createNodeServer(api, {});
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  await fetch(`${url}/api/health`);
  await fetch(`${url}/api/day/${formatDay(TRACK_DAY)}`); // circuit prêt
  latence = 300; // chaque instruction coûte 300 ms : l'envoi dure ≈ 5 s
  const date = formatDay(TRACK_DAY);
  const post = (signal?: AbortSignal) =>
    fetch(`${url}/api/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": hex(7) }, body: JSON.stringify({ name: "Lent", date, replay: trackCode }), ...(signal ? { signal } : {}) });
  const ctl = new AbortController();
  const t0 = performance.now();
  const attente = post(ctl.signal).then(() => "réponse", (e: Error) => `abandon (${e.name})`);
  setTimeout(() => ctl.abort(), 1000); // « le jeu » abandonne après 1 s (en production : 8 s)
  console.log(`  1. Le jeu abandonne après 1 s : ${await attente} à ${(performance.now() - t0).toFixed(0)} ms`);
  const avant = await base.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE day = ?", [TRACK_DAY]);
  console.log(`     Lignes de résultat écrites à cet instant : ${avant?.n}`);
  latence = 0;
  await sleep(9000); // le serveur finit seul
  const apres = await base.first<{ n: number; ms: number }>("SELECT COUNT(*) AS n, MAX(ms) AS ms FROM results WHERE day = ?", [TRACK_DAY]);
  console.log(`  2. 9 s plus tard, sans nouvel envoi : ${apres?.n} résultat écrit (temps rejoué ${apres?.ms} ms) → le classement l'a, le joueur a vu « indisponible »`);
  const r2 = await post();
  const j2 = (await r2.json()) as Record<string, unknown>;
  console.log(`  3. Renvoi de la même partie par le même joueur : HTTP ${r2.status}, improved=${j2.improved}, rank=${j2.rank}`);
  const j = await base.all<{ code: string; route: string }>("SELECT code, route FROM journal_erreurs");
  console.log(`  4. journal_erreurs après les trois étapes : ${j.length} ligne(s) → le renvoi n'est PAS compté comme refus`);
  srv.close();
}

// --- C. Un refus de chaque famille et ce que le tableau de bord en compte -----------------------------------------------------------------
console.log("\n=== C. Codes de refus et journal_erreurs (ce que le tableau de bord appelle « rediffusions refusées ») ===\n");
{
  const { db, base } = await ouvrir(() => 0);
  const cT = { now: clock.now };
  const api = mk(db, cT);
  await appel(api, "GET", "/api/health", undefined); // crée le schéma
  const cas: [string, () => Promise<{ status: number; body: Record<string, any> }>][] = [];
  const nombre = async () => (await base.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_erreurs"))!.n;
  const lance = async (nom: string, f: () => Promise<{ status: number; body: Record<string, any> }>) => {
    const avant = await nombre();
    const r = await f();
    const compte = (await nombre()) - avant;
    ligne(`${nom} → HTTP ${r.status} ${r.body.error ?? (r.body.accepted ? `accepté (improved=${r.body.improved})` : "")}`, compte ? "COMPTÉ" : "non compté");
  };
  const rep = decodeTrack(trackCode);
  console.log("Track :");
  await lance("  envoi normal (joueur 1)", () => trackSubmit(api, 1, trackCode));
  await lance("  H2 : même joueur renvoie la même partie", () => trackSubmit(api, 1, trackCode));
  await lance("  H2/H7 : un autre joueur envoie les mêmes entrées", () => trackSubmit(api, 2, trackCode));
  await lance("  H4 : partie jouée avec une autre version de la simulation", () => trackSubmit(api, 3, encodeTrack({ ...rep, simVersion: rep.simVersion - 1 })));
  await lance("  H4 : partie d'un autre circuit (planning remplacé, vieux code)", () => trackSubmit(api, 4, encodeTrack(otherRun.replay)));
  await lance("  H7 : rediffusion tronquée / abîmée", () => trackSubmit(api, 5, trackCode.slice(0, 40)));
  await lance("  H6/H7 : rediffusion bien formée qui n'arrive pas", () => trackSubmit(api, 6, encodeTrack({ ...rep, runs: rep.runs.slice(0, Math.max(1, Math.floor(rep.runs.length / 3))) })));
  cT.now = (TRACK_DAY + 1) * DAY_MS - 3_600_000 + 3_600_000 + 9 * 60_000 + 59_000 - 2 * 3_600_000; // 00:09:59 heure de Paris du 15/10 = 22:09:59 UTC la veille
  await lance("  H5 : envoi à 00:09:59 Paris (dans la grâce)", () => trackSubmit(api, 8, encodeTrack(runPilot(trackCircuit.track, { grip: 0.85 }).replay)));
  cT.now += 3_000;
  await lance("  H5 : envoi à 00:10:02 Paris (grâce passée)", () => trackSubmit(api, 9, encodeTrack(runPilot(trackCircuit.track, { grip: 0.87 }).replay)));
  cT.now = clock.now;
  await lance("  H8 : date du jeu en avance d'un jour (horloge de l'appareil)", () => trackSubmit(api, 10, trackCode, { date: formatDay(TRACK_DAY + 1) }));
}
{
  const { db, base } = await ouvrir(() => 0);
  const cJ = { now: jumpClock.now };
  const api = mk(db, cJ);
  await appel(api, "GET", "/api/health", undefined);
  const nombre = async () => (await base.first<{ n: number }>("SELECT COUNT(*) AS n FROM journal_erreurs"))!.n;
  const lance = async (nom: string, f: () => Promise<{ status: number; body: Record<string, any> }>) => {
    const avant = await nombre();
    const r = await f();
    const compte = (await nombre()) - avant;
    ligne(`${nom} → HTTP ${r.status} ${r.body.error ?? (r.body.accepted ? `accepté (improved=${r.body.improved})` : "")}`, compte ? "COMPTÉ" : "non compté");
  };
  console.log("\nJump :");
  await lance("  envoi normal (joueur 1)", () => jumpSubmit(api, 1, jumpOthers[0]!.code));
  await lance("  H2 : même joueur renvoie le même essai", () => jumpSubmit(api, 1, jumpOthers[0]!.code));
  await lance("  H2/H7 : un autre joueur envoie les mêmes entrées", () => jumpSubmit(api, 2, jumpOthers[0]!.code));
  await lance("  H7 : copie de la preuve de l'auteur", () => jumpSubmit(api, 3, jumpLevel.code));
  await lance("  H4 : onglet d'avant la mise en production (autre générateur)", () => jumpSubmit(api, 4, jumpOthers[1]!.code, { generatorVersion: JUMP_GENERATOR_VERSION - 1 }));
  await lance("  H4 : onglet d'avant (autre version de la simulation)", () => jumpSubmit(api, 5, jumpOthers[1]!.code, { simVersion: JUMP_SIM_VERSION - 1 }));
  await lance("  H7 : rediffusion tronquée / abîmée", () => jumpSubmit(api, 6, jumpOthers[2]!.code.slice(0, 30)));
  await lance("  H8 : niveau du lendemain (horloge de l'appareil en avance)", () => jumpSubmit(api, 7, jumpOthers[2]!.code, { levelId: jumpLevel.id.replace(/\d{4}-\d{2}-\d{2}/, formatDay(JUMP_DAY + 1)) }));
  cJ.now = (JUMP_DAY + 1) * DAY_MS - 2 * 3_600_000 + 9 * 60_000 + 59_000; // 00:09:59 Paris le 20/10 (UTC+2)
  await lance("  H5 : envoi à 00:09:59 Paris (dans la grâce)", () => jumpSubmit(api, 8, jumpOthers[3]!.code));
  cJ.now += 3_000;
  await lance("  H5 : envoi à 00:10:02 Paris (grâce passée)", () => jumpSubmit(api, 9, jumpOthers[4]!.code));
  const j = await base.all<{ code: string; n: number }>("SELECT code, COUNT(*) AS n FROM journal_erreurs GROUP BY code ORDER BY code");
  console.log(`\n  journal_erreurs de cette base Jump : ${j.map((x) => `${x.code}×${x.n}`).join(", ")}`);
}

// --- D. Plafond de rejeux (503) et limites de débit (429) ---------------------------------------------------------------------------
console.log("\n=== D. 503 (plafond de rejeux) et 429 (débit) : affichés comme « indisponible » côté jeu, jamais comptés « rediffusion refusée » ===\n");
{
  const { db, base } = await ouvrir(() => 0);
  const api = mk(db, clock, { replaysPerMinute: 1 });
  await appel(api, "GET", "/api/health", undefined);
  await trackSubmit(api, 1, trackCode);
  const r = await trackSubmit(api, 2, encodeTrack(runPilot(trackCircuit.track, { grip: 0.8 }).replay));
  const j = await base.all<{ code: string }>("SELECT code FROM journal_erreurs");
  console.log(`  plafond de 1 unité de rejeu par minute : 2e envoi → HTTP ${r.status} ${r.body.error} ; journal : ${j.map((x) => x.code).join(",") || "—"} (genre « serveur », pas « rediffusion »)`);
}
{
  const { db, base } = await ouvrir(() => 0);
  const api = mk(db, clock);
  await appel(api, "GET", "/api/health", undefined);
  let dernier = 0;
  let n = 0;
  for (; n < 40 && dernier !== 429; n++) dernier = (await trackSubmit(api, 1, "x")).status; // même joueur, rediffusion illisible
  console.log(`  même joueur : ${n}ᵉ envoi → HTTP ${dernier} (limite par joueur : 30 par fenêtre de 10 min)`);
  let k = 0;
  dernier = 0;
  for (; k < 80 && dernier !== 429; k++) dernier = (await trackSubmit(api, 100 + k, "x", {}, "198.51.100.9")).status; // joueurs différents, même adresse
  console.log(`  même adresse, joueurs différents (réseau d'entreprise, école, CGNAT) : ${k}ᵉ envoi → HTTP ${dernier} (limite par adresse : 60 par fenêtre de 10 min)`);
  const j = await base.all<{ code: string; n: number }>("SELECT code, COUNT(*) AS n FROM journal_erreurs GROUP BY code");
  console.log(`  journal_erreurs : ${j.map((x) => `${x.code}×${x.n}`).join(", ")} (le 429 n'y est pas)`);
}
console.log("\nFin.");
process.exit(0);
