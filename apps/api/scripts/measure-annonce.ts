// `npm run measure:annonce -w @cdj/api` (lot N2 de la plateforme) : ce que coûte le **message en direct** pour 100, 1 000 et 10 000 pages ouvertes.
//
//   - Le **coût d'une requête qui arrive à Cloud Run** est mesuré sur le vrai code (`api.handle`) : instructions SQL, lignes lues, durée, octets de la réponse (corps et
//     en-têtes). Une base en mémoire ; les lignes lues sont celles que rendent les instructions (1 : l'index de `fin`).
//   - Le **nombre de requêtes qui y arrivent** vient d'une simulation d'une heure : chaque page ouverte relit toutes les 60 s (phases tirées au hasard), derrière un cache
//     partagé qui respecte l'en-tête réel de la réponse (`s-maxage=30`), par point de présence. C'est un **modèle** du cache de Hosting (Fastly), pas une mesure de Hosting :
//     le nombre de points de présence qui servent la France n'est pas connu ; on montre 1, 3 et 10.
//   - Le poids porté par **Hosting** (requêtes et octets) est exact : une requête par page et par minute, quel que soit le cache.
import { openSqlite } from "../src/node-sqlite";
import { SCHEMA, type SqlDb, type SqlValue } from "../src/db";
import { createApi } from "../src/api";
import { ANNONCE, annonceParHeure } from "./platformBudget";

const brut = openSqlite(":memory:");
const compte = { instructions: 0, lignes: 0 };
const db: SqlDb = {
  async run(sql, params) {
    compte.instructions++;
    await brut.run(sql, params);
  },
  async first<T>(sql: string, params?: SqlValue[]) {
    compte.instructions++;
    const r = await brut.first<T>(sql, params);
    compte.lignes += r ? 1 : 0;
    return r;
  },
  async all<T>(sql: string, params?: SqlValue[]) {
    compte.instructions++;
    const r = await brut.all<T>(sql, params);
    compte.lignes += r.length;
    return r;
  },
  async batch(statements) {
    compte.instructions += statements.length;
    await brut.batch!(statements);
  },
};
const t0 = Date.UTC(2026, 9, 28, 12, 0, 0);
const horloge = { now: t0 };
const api = createApi({ db, now: () => horloge.now, rateSalt: "mesure", environment: "local" });
await api.handle(new Request("http://mesure.local/api/health"));
for (const sql of SCHEMA) void sql;
await brut.run("INSERT INTO annonces (texte_fr, texte_en, ou, ton, debut, fin, retire_le) VALUES (?, ?, 'portail,track,jump', 'information', ?, ?, NULL)", ["Maintenance ce soir à 22 h : le classement sera figé dix minutes.", "Maintenance tonight at 10 pm: the leaderboard will freeze for ten minutes.", t0 - 60_000, t0 + 3_600_000]);

// --- Une requête qui arrive à Cloud Run -------------------------------------------------------------------------------------------------
compte.instructions = 0;
compte.lignes = 0;
const N = 200;
const debut = performance.now();
let octets = 0;
let controle = "";
for (let i = 0; i < N; i++) {
  const res = await api.handle(new Request("http://mesure.local/api/annonce"), { clientKey: `203.0.113.${i % 200}` });
  const corps = await res.text();
  octets = corps.length + [...res.headers].reduce((n, [k, v]) => n + k.length + v.length + 4, 0);
  controle = res.headers.get("cache-control") ?? "";
}
const ms = (performance.now() - debut) / N;
console.log("Une requête qui arrive à Cloud Run (GET /api/annonce, message actif)");
console.log(`  cache-control : ${controle}`);
console.log(`  instructions : ${compte.instructions / N} · lignes lues : ${compte.lignes / N} · écrites : 0 · durée : ${ms.toFixed(2)} ms · réponse : ≈ ${octets} octets (corps et en-têtes)`);
console.log(`  (modèle de coût : ANNONCE.octetsParReponse = ${ANNONCE.octetsParReponse} ; à remettre à jour si cette mesure change)\n`);

// --- Une heure de pages ouvertes derrière un cache partagé ------------------------------------------------------------------------------
const sMaxage = Number(/s-maxage=(\d+)/.exec(controle)?.[1] ?? 0);
function simuler(pages: number, points: number): number {
  const copie = new Array<number>(points).fill(-Infinity); // l'instant où la copie de chaque point expire
  let origine = 0;
  // Les relectures de toutes les pages sur une heure, dans l'ordre du temps (phase tirée au hasard, 60 s d'écart, graine fixe).
  let graine = 12345;
  const alea = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const evenements: { t: number; point: number }[] = [];
  for (let p = 0; p < pages; p++) {
    const point = Math.floor(alea() * points);
    const phase = alea() * ANNONCE.relectureS;
    for (let t = phase; t < 3600; t += ANNONCE.relectureS) evenements.push({ t, point });
  }
  evenements.sort((a, b) => a.t - b.t);
  for (const e of evenements) {
    if (e.t >= copie[e.point]!) {
      origine++;
      copie[e.point] = e.t + sMaxage;
    }
  }
  return origine;
}

console.log("Une heure de pages ouvertes et visibles (relecture toutes les 60 s ; cache partagé s-maxage=30 par point de présence)");
console.log("| pages | requêtes Hosting | octets Hosting | Cloud Run sans cache | Cloud Run, 1 point | 3 points | 10 points (simulé / borne) | lignes Turso (3 pts) |");
console.log("|---|---|---|---|---|---|---|---|");
for (const pages of [100, 1000, 10_000]) {
  const m = annonceParHeure(pages, 3);
  const un = simuler(pages, 1);
  const trois = simuler(pages, 3);
  const dix = simuler(pages, 10);
  const borne10 = annonceParHeure(pages, 10).cloudRun;
  console.log(`| ${pages} | ${m.hosting} | ${(m.octetsHosting / 1e6).toFixed(1)} Mo | ${m.cloudRunSansCache} | ${un} | ${trois} | ${dix} / ${borne10} | ${trois * ANNONCE.lignesParRequete} |`);
}
console.log("\nLe poids qui compte est celui de Hosting (transfert gratuit : 360 Mo par jour) : Cloud Run ne voit jamais plus de 120 requêtes par heure et par point de présence.");
