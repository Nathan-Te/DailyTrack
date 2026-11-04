// Lot D3 (C8) — `npm run measure:charge -w @cdj/api` : une charge réaliste en local pour chercher un blocage du fil principal. Des envois des trois jeux **en même temps** (par vagues), des lectures du portail, le serveur
// **mesuré** comme en production (`mesures.ts`, Tower dans son fil de calcul, niveaux dans leur fil), sur une base libSQL locale (jamais Turso) ; une sentinelle indépendante donne le plus long retard de la boucle.
// Ce qu'on regarde : le plus long blocage, et quelles lignes « blocage » / « envoi lent » le serveur a écrites.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { parisDayStart } from "@cdj/clock";
import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel } from "@cdj/jump-sim";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { TOWER_GENERATOR_VERSION, dailyTower } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { executeurFil } from "../src/jeux/fil";
import { openLibsql } from "../src/libsql-open";
import type { Logger } from "../src/log";
import { creerMesures } from "../src/mesures";
import { DELAI_NIVEAU_MS, type DemandeNiveau, type ReponseNiveau } from "../src/niveauxFil";
import type { DemandeTower, ReponseTower } from "../src/towerRejeu";
import { creerTablesTower, gamesAvecTower, jouerScripte } from "./tower-aide";

const arg = (n: string): string | undefined => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const VAGUES = Number(arg("vagues") ?? 8);
const PAR_VAGUE = Number(arg("par-vague") ?? 6);
const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const JOUR = D("2026-11-10");
const id = (n: number) => n.toString(16).padStart(32, "0");

const dossier = mkdtempSync(join(tmpdir(), "cdj-charge-"));
const empaqueter = (entree: string, sortie: string) =>
  build({ entryPoints: [new URL(entree, import.meta.url).pathname], bundle: true, platform: "node", format: "esm", target: "node22", outfile: join(dossier, sortie), logLevel: "silent", banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" } });
await empaqueter("../src/towerFilTravail.ts", "tower-fil.mjs");
await empaqueter("../src/niveauxFilTravail.ts", "niveaux-fil.mjs");

const lignes: { message: string; fields: Record<string, unknown> }[] = [];
const log: Logger = (_s, message, fields = {}) => void lignes.push({ message, fields });
const mesures = creerMesures({ log });

const db = await openLibsql({ url: `file:${join(dossier, "charge.db")}` });
await ensureSchemaOn(db);
await creerTablesTower(db);
await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('tower', 'on', 0, '[[0,null]]', 0)");
const filTower = executeurFil<DemandeTower, ReponseTower>(join(dossier, "tower-fil.mjs"));
const filNiveaux = executeurFil<DemandeNiveau, ReponseNiveau>(join(dossier, "niveaux-fil.mjs"), { delaiMs: DELAI_NIVEAU_MS });
const horloge = { now: parisDayStart(JOUR) + 12 * 3_600_000 };
const api = createApi({ db, now: () => horloge.now, mesures, niveauxExecuteur: filNiveaux, allowCopies: true, log, environment: "local", games: gamesAvecTower({ executeur: filTower }) });

// Les rediffusions à envoyer (calculées une fois).
const R = await chargerRapier();
const tower = jouerScripte(R, dailyTower(JOUR, TOWER_GENERATOR_VERSION, 0));
tower.partie.dispose();
const niveau = dailyLevel(JOUR);
const circuit = dailyCircuit(JOUR);
const course = encodeReplay(runPilot(circuit.track, { grip: 0.9 }).replay);

mesures.demarrer(); // après la préparation des rediffusions (compiler Rapier et jouer les parties bloque le fil, et ce n'est pas le serveur)

// La sentinelle indépendante de `mesures`.
let dernier = performance.now();
let pire = 0;
const sentinelle = setInterval(() => {
  const t = performance.now();
  pire = Math.max(pire, t - dernier - 5);
  dernier = t;
}, 5);

let k = 0;
const post = async (chemin: string, corps: unknown): Promise<{ status: number; ms: number }> => {
  const n = ++k;
  const t0 = performance.now();
  const r = await api.handle(new Request(`http://api.test${chemin}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": id(n) }, body: JSON.stringify(corps) }), { clientKey: `198.51.100.${(n % 250) + 1}` });
  await r.text();
  return { status: r.status, ms: performance.now() - t0 };
};
const lire = async (chemin: string) => {
  const r = await api.handle(new Request(`http://api.test${chemin}`), { clientKey: "203.0.113.7" });
  await r.text();
};

await lire("/api/portail/jour"); // le démarrage et les niveaux du jour
const par: Record<string, number[]> = { track: [], jump: [], tower: [], lectures: [] };
const refus: Record<string, number> = {};
const t0 = performance.now();
for (let v = 0; v < VAGUES; v++) {
  horloge.now += 1_000;
  const vague: Promise<void>[] = [];
  for (let i = 0; i < PAR_VAGUE; i++) {
    const noter = (jeu: string) => (r: { status: number; ms: number }) => {
      par[jeu]!.push(r.ms);
      if (r.status !== 200) refus[`${jeu} ${r.status}`] = (refus[`${jeu} ${r.status}`] ?? 0) + 1;
    };
    vague.push(post("/api/submit", { date: "2026-11-10", replay: course, name: `T${k}` }).then(noter("track")));
    vague.push(post("/api/jump/submit", { levelId: niveau.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: niveau.code, name: `J${k}` }).then(noter("jump")));
    vague.push(post("/api/tower/submit", { replay: tower.code, name: `W${k}` }).then(noter("tower")));
    vague.push(lire("/api/portail/jour").then(() => void par.lectures!.push(0)));
    vague.push(lire("/api/portail/classement").then(() => void 0));
  }
  await Promise.all(vague);
}
const total = performance.now() - t0;
clearInterval(sentinelle);
mesures.arreter();
const med = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1]!.toFixed(0) : "-");
const max = (v: number[]) => (v.length ? Math.max(...v).toFixed(0) : "-");
console.log(`${VAGUES} vagues de ${PAR_VAGUE} envois par jeu (+ lectures du portail) en ${total.toFixed(0)} ms, fil principal sentinelle : plus long retard ${pire.toFixed(0)} ms\n`);
for (const j of ["track", "jump", "tower"]) console.log(`${j.padEnd(6)} ${String(par[j]!.length).padStart(3)} envois : médiane ${med(par[j]!).padStart(5)} ms, max ${max(par[j]!).padStart(5)} ms`);
console.log(`refus : ${JSON.stringify(refus)}`);
const interessantes = lignes.filter((l) => ["blocage de la boucle d'événements", "envoi lent", "ramasse-miettes long"].includes(l.message));
console.log(`lignes du serveur : ${interessantes.length} (blocage / envoi lent / ramasse-miettes long)`);
for (const l of interessantes.slice(0, 8)) console.log(`  ${l.message} ${JSON.stringify(l.fields)}`);
await filTower.fermer?.();
await filNiveaux.fermer?.();
rmSync(dossier, { recursive: true, force: true });
