// Lot R8 — la remise à zéro du lancement public (« tout le monde repart de zéro »). Lancée par le workflow « Lancement : remise à zéro »
// (`.github/workflows/lancement-remise-a-zero.yml`), jamais par un test ni par un agent :
//
//   npm run lancement:remise-a-zero -- --cible recette|production --base <nom de la base> --phrase "tout le monde repart de zéro"
//        [--sauvegarde-faite] [--lancement-url https://playdujour.com] [--appliquer]
//
// Sans `--appliquer` : essai à blanc (compte les lignes, n'écrit rien). Base : TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Turso), sinon SQLite local
// (DB_PATH). Gardes (toutes vérifiées ici, avant d'écrire) : la cible est `recette` ou `production` ; la base visée suit la règle des noms (recette :
// « recette » dans le nom ; production : jamais) ; le nom de la base saisi est celui de la base visée ; la phrase est exacte ; la production exige la
// confirmation de la sauvegarde et que la date de lancement qu'elle **sert** soit aujourd'hui ou demain (`--lancement-url`).
// **Rien de personnel ne sort** : la sortie ne contient que des noms de tables et des nombres de lignes (le dépôt est public, les journaux aussi).
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ConfigError, assertDatabaseMatches, databaseName } from "../src/config";
import type { SqlDb } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { openSqlite } from "../src/node-sqlite";
import { TABLES_GARDEES, TABLES_VIDEES, refusDesGardes, refusDuLancement, remiseAZero } from "../src/remiseAZero";
import { exigerDistant } from "../src/distant";

const args = process.argv.slice(2);
const value = (name: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? "") : "";
};
const has = (name: string): boolean => args.includes(`--${name}`);

function stop(message: string): never {
  console.error(`::error title=Remise à zéro refusée::${message}`);
  process.exit(1);
}

const cible = value("cible");
const turso = process.env.TURSO_DATABASE_URL?.trim();
const location = turso || (process.env.DB_PATH ?? "./data/cdj.sqlite");
const baseVisee = databaseName(location);

if (turso) exigerDistant(turso, args, "La remise à zéro compte (et, avec --appliquer, efface) les lignes de toutes les tables des joueurs.");

const refus = refusDesGardes({ cible, baseSaisie: value("base"), baseVisee, phrase: value("phrase"), sauvegardeFaite: has("sauvegarde-faite") });
if (refus.length) stop(refus.join(" · "));
try {
  assertDatabaseMatches(cible as "recette" | "production", location);
} catch (e) {
  stop(e instanceof ConfigError ? e.message : String(e));
}

if (cible === "production") {
  const url = value("lancement-url");
  if (!url) stop("--lancement-url manque : la production ne se vide que si elle sert une date de lancement d'aujourd'hui ou de demain");
  const res = await fetch(`${url.replace(/\/+$/, "")}/api/portail/jour`).catch(() => null);
  if (!res || !res.ok) stop(`la date de lancement servie par ${url} est illisible (réponse ${res?.status ?? "aucune"})`);
  const raison = refusDuLancement(await res.json().catch(() => null));
  if (raison) stop(raison);
  console.log("Date de lancement servie par la production : aujourd'hui ou demain (vérifié).");
}

const applique = has("appliquer");
let db: SqlDb & { close(): void };
if (turso) db = await openLibsql({ url: turso, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
else {
  if (location !== ":memory:") mkdirSync(dirname(location), { recursive: true });
  db = openSqlite(location);
}

try {
  const rapport = await remiseAZero(db, { now: Date.now(), applique });
  console.log(`### Remise à zéro de la base « ${baseVisee} » (${cible}) — ${applique ? "appliquée" : "essai à blanc, rien n'a été écrit"}`);
  console.log("");
  console.log("| Table vidée | Contenu | Lignes avant | Lignes après |");
  console.log("|---|---|---:|---:|");
  for (const l of rapport.videes) console.log(`| \`${l.table}\` | ${TABLES_VIDEES[l.table]} | ${l.avant} | ${l.apres} |`);
  console.log("");
  console.log("| Table gardée | Contenu | Lignes |");
  console.log("|---|---|---:|");
  for (const l of rapport.gardees) console.log(`| \`${l.table}\` | ${TABLES_GARDEES[l.table]} | ${l.apres} |`);
  console.log("");
  if (rapport.generation !== null) console.log(`Génération de données : ${rapport.generationAvant || "aucune"} → **${rapport.generation}** (les navigateurs qui en gardent une plus ancienne effacent leurs données de jeu).`);
  const reste = rapport.videes.filter((l) => l.apres !== 0);
  if (applique && reste.length) stop(`des lignes restent après la remise à zéro : ${reste.map((l) => l.table).join(", ")}`);
  console.log("Aucune donnée personnelle dans ce résumé : des noms de tables et des nombres de lignes seulement.");
} finally {
  db.close();
}
