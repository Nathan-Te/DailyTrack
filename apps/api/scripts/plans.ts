// `npm run plans -w @cdj/api -- <fichier de requêtes> [--tout]` (lot R14) : l'audit des plans d'exécution de toutes les requêtes de l'API.
//
// Le fichier vient des tests (`CDJ_SQL_DUMP=/tmp/sql.jsonl npx vitest run --project sqlite apps/api/test` : chaque requête distincte, une ligne JSON) ; ici chacune passe
// par `EXPLAIN QUERY PLAN` sur une base **locale en mémoire** (jamais Turso) avec le schéma et les migrations du serveur, sans donnée ni statistiques : c'est le plan que choisit
// Turso, qui ne lance pas `ANALYZE`. Rend les requêtes dont le plan contient un `SCAN` d'une table ou d'un index (toute la table est lue), avec le verdict de `PARCOURS_PERMIS`
// (apps/api/src/plans.ts : chaque parcours accepté est justifié) ; sort en 1 si un parcours n'est pas justifié. `--tout` liste aussi les plans indexés.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { MIGRATIONS, SCHEMA, META_TABLE } from "../src/db";
import { UNIQUE_NAME_INDEX } from "../src/pseudos";
import { analyserPlan, normaliser } from "../src/plans";

const fichier = process.argv[2];
if (!fichier || fichier.startsWith("--")) {
  console.error("usage : plans <fichier de requêtes JSON-lines> [--tout]");
  process.exit(2);
}
const db = new DatabaseSync(":memory:");
for (const sql of [META_TABLE, ...SCHEMA]) db.exec(sql);
db.exec(UNIQUE_NAME_INDEX); // posé par la migration des pseudos au démarrage du serveur (`migratePseudos`), pas par une instruction de MIGRATIONS
for (const sql of MIGRATIONS) {
  try {
    db.exec(sql);
  } catch {
    /* colonne déjà là : la migration est sans effet, comme sur le serveur */
  }
}

const vues = new Map<string, { sql: string; params: (string | number | null)[] }>();
for (const ligne of readFileSync(fichier, "utf8").split("\n")) {
  if (!ligne.trim()) continue;
  const { sql, params } = JSON.parse(ligne) as { sql: string; params: (string | number | null)[] };
  const cle = normaliser(sql);
  if (!vues.has(cle)) vues.set(cle, { sql, params });
}

let inexplicables = 0;
let injustifies = 0;
let parcours = 0;
for (const { sql, params } of [...vues.values()].sort((a, b) => a.sql.localeCompare(b.sql))) {
  if (/^\s*(CREATE|DROP|ALTER|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql)) continue;
  let plan: string[];
  try {
    const lignes = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[];
    plan = lignes.map((l) => l.detail);
  } catch (e) {
    inexplicables++;
    console.log(`? ${sql.slice(0, 140)}\n    ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  const verdict = analyserPlan(sql, plan);
  if (verdict.parcours.length) parcours++;
  if (verdict.injustifies.length) injustifies++;
  if (verdict.parcours.length || process.argv.includes("--tout")) {
    console.log(`${verdict.injustifies.length ? "✗" : verdict.parcours.length ? "~" : " "} ${sql.slice(0, 200)}`);
    for (const d of plan) console.log(`      ${d}`);
    for (const j of verdict.parcours) console.log(`      → ${j.table} : ${j.raison ?? "NON JUSTIFIÉ"}`);
  }
}
console.log(`\n${vues.size} requêtes distinctes · ${parcours} avec un parcours complet · ${injustifies} non justifiées · ${inexplicables} sans plan`);
process.exit(injustifies ? 1 : 0);
