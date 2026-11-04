// Lot D3 (C9) — `npm run measure:minuit -w @cdj/api` : la durée du premier `GET /api/portail/jour` après minuit (30 requêtes simultanées sur une instance neuve, comme les onglets qui se rechargent à zéro, D1 § 6 bis),
// et combien de temps le fil principal est resté bloqué pendant ce temps (une sentinelle de 5 ms : le plus long écart). Trois cas, sur une base libSQL locale (un fichier temporaire, jamais Turso), horloge simulée :
//   avant       le calcul dans le fil principal, rien de préparé (le serveur d'avant le lot D3) ;
//   fil         le calcul dans le fil de calcul, rien de préparé (une instance qui n'a reçu aucune requête avant minuit) ;
//   préparé     une instance a préparé le niveau de demain à 23 h 35 (fil de calcul) ; minuit sur une instance neuve.
// Le processeur de la machine de mesure n'est pas celui de Cloud Run (3 à 5 fois plus lent selon D1) : ce sont les rapports qui comptent.
import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { parisDayStart } from "@cdj/clock";
import { daysFromCivil } from "@cdj/core";
import { createApi } from "../src/api";
import { executeurFil } from "../src/jeux/fil";
import { silentLog } from "../src/log";
import { openLibsql } from "../src/libsql-open";
import { DELAI_NIVEAU_MS, type DemandeNiveau, type ReponseNiveau } from "../src/niveauxFil";

const JOUR = daysFromCivil(2026, 11, 12);
const MINUIT = parisDayStart(JOUR + 1);
const REQUETES = 30;
console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}\n`);

const dossier = mkdtempSync(join(tmpdir(), "cdj-minuit-"));
const fichierFil = join(dossier, "niveaux-fil.mjs");
await build({
  entryPoints: [new URL("../src/niveauxFilTravail.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: fichierFil,
  banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
  logLevel: "silent",
});

let n = 0;
const nouvelleBase = async () => openLibsql({ url: `file:${join(dossier, `m${n++}.db`)}` });
const fil = () => executeurFil<DemandeNiveau, ReponseNiveau>(fichierFil, { delaiMs: DELAI_NIVEAU_MS });
const requete = (api: ReturnType<typeof createApi>) => api.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.7" });

async function minuit(nom: string, api: ReturnType<typeof createApi>): Promise<void> {
  // Le schéma et la table des jeux : le démarrage de l'instance n'est pas ce qu'on mesure (et `/api/jeux` ne calcule aucun niveau).
  await api.handle(new Request("http://api.test/api/jeux"), { clientKey: "203.0.113.7" }).then((r) => r.text());
  // Une sentinelle : le plus long écart entre deux de ses passages = le temps où le fil principal est resté occupé.
  let dernier = performance.now();
  let pire = 0;
  const s = setInterval(() => {
    const t = performance.now();
    pire = Math.max(pire, t - dernier - 5);
    dernier = t;
  }, 5);
  const t0 = performance.now();
  const durees = await Promise.all(Array.from({ length: REQUETES }, async () => {
    const d0 = performance.now();
    const r = await requete(api);
    await r.text();
    if (r.status !== 200) throw new Error(`${nom} : ${r.status}`);
    return performance.now() - d0;
  }));
  const total = performance.now() - t0;
  clearInterval(s);
  console.log(`${nom.padEnd(8)} | ${REQUETES} requêtes en ${total.toFixed(0).padStart(5)} ms | la plus lente ${Math.max(...durees).toFixed(0).padStart(5)} ms | médiane ${[...durees].sort((a, b) => a - b)[REQUETES >> 1]!.toFixed(0).padStart(5)} ms | fil principal bloqué au plus ${pire.toFixed(0).padStart(5)} ms`);
}

console.log("cas      | premier portail/jour après minuit");
{
  // avant : le calcul dans le fil principal, rien de préparé.
  const db = await nouvelleBase();
  await minuit("avant", createApi({ db, now: () => MINUIT + 2_000, allowCopies: true, log: silentLog }));
}
{
  const db = await nouvelleBase();
  const f = fil();
  await minuit("fil", createApi({ db, now: () => MINUIT + 2_000, niveauxExecuteur: f, allowCopies: true, log: silentLog }));
  await f.fermer?.();
}
{
  const db = await nouvelleBase();
  const f = fil();
  const soir = createApi({ db, now: () => MINUIT - 25 * 60_000, niveauxExecuteur: f, allowCopies: true, log: silentLog });
  await requete(soir).then((r) => r.text());
  const t0 = performance.now();
  await soir.preparerLeLendemain();
  console.log(`(23 h 35 : préparation du lendemain en ${(performance.now() - t0).toFixed(0)} ms, hors du fil principal)`);
  await f.fermer?.();
  await minuit("préparé", createApi({ db, now: () => MINUIT + 2_000, allowCopies: true, log: silentLog }));
}
rmSync(dossier, { recursive: true, force: true });
