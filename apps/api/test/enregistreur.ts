import { appendFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { META_TABLE, MIGRATIONS, SCHEMA, type SqlDb, type SqlValue } from "../src/db";
import { analyserPlan, normaliser, type Verdict } from "../src/plans";
import { UNIQUE_NAME_INDEX } from "../src/pseudos";

/**
 * Lot R14 — chaque requête du **serveur** (`apps/api/src`) qu'un test fait passer par `openTestDb` est examinée une fois par `EXPLAIN QUERY PLAN` : un `SCAN` d'une grande table qui
 * n'est pas justifié dans `PARCOURS_PERMIS` (src/plans.ts) fait échouer le test. Turso compte les lignes **parcourues** ; une requête sans index lit toute la table à chaque appel.
 * Toute nouvelle requête est donc vérifiée par les tests qui la font tourner, sans rien ajouter.
 *
 * Le plan est celui d'une base **locale en mémoire** avec le schéma et les migrations du serveur, sans donnée ni statistiques : c'est le plan que choisit Turso (qui ne lance pas `ANALYZE`).
 * `CDJ_SQL_DUMP=<fichier>` garde en plus chaque requête distincte, une ligne JSON chacune, pour l'audit complet (`npm run plans -w @cdj/api -- <fichier>`).
 * Seules comptent les requêtes dont l'appelant est dans `src/` ou `scripts/` : celles qu'un test écrit lui-même pour préparer ou lire une base n'en sont pas.
 */
let planDb: DatabaseSync | null = null;
function bancDEssai(): DatabaseSync {
  if (planDb) return planDb;
  const db = new DatabaseSync(":memory:");
  for (const sql of [META_TABLE, ...SCHEMA]) db.exec(sql);
  db.exec(UNIQUE_NAME_INDEX); // posé par la migration des pseudos au démarrage du serveur
  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      /* colonne déjà là */
    }
  }
  return (planDb = db);
}

/** Les plans déjà examinés par ce processus (texte normalisé → verdict) et les textes dont le premier appelant était un test. */
const examinees = new Set<string>();
const dEssai = new Set<string>();

export class PlanNonJustifie extends Error {}

function noter(sql: string, params: SqlValue[] = [], fichier: string | undefined): void {
  const cle = normaliser(sql);
  if (examinees.has(cle) || dEssai.has(cle)) return;
  const appelant = (new Error().stack ?? "").split("\n").find((l, i) => i > 1 && !l.includes("enregistreur"));
  if (appelant?.includes("/test/")) {
    dEssai.add(cle);
    return;
  }
  examinees.add(cle);
  if (fichier) appendFileSync(fichier, `${JSON.stringify({ sql: cle, params })}\n`);
  const e = expliquer(sql, params);
  if (e && e.verdict.injustifies.length) {
    throw new PlanNonJustifie(
      `Requête qui parcourt toute une table (Turso compte les lignes parcourues, pas les lignes rendues) : ${cle.slice(0, 220)}\n  plan : ${e.plan.join(" | ")}\n  → ajoute l'index qui manque (migration réversible dans MIGRATIONS, db.ts), ou, si le parcours est voulu, justifie-le dans PARCOURS_PERMIS (apps/api/src/plans.ts).`,
    );
  }
}

/** Le plan d'une requête sur le banc d'essai et son verdict, ou `null` si le banc ne sait pas l'expliquer (table d'un test…). */
export function expliquer(sql: string, params: SqlValue[] = []): { plan: string[]; verdict: Verdict } | null {
  if (/^\s*(CREATE|DROP|ALTER|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql)) return null;
  try {
    const plan = (bancDEssai().prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((l) => l.detail);
    return { plan, verdict: analyserPlan(sql, plan) };
  } catch {
    return null;
  }
}

export function surveiller<T extends SqlDb>(db: T): T {
  const fichier = process.env.CDJ_SQL_DUMP || undefined;
  const run = db.run.bind(db);
  const first = db.first.bind(db);
  const all = db.all.bind(db);
  const batch = db.batch?.bind(db);
  db.run = (sql, params) => (noter(sql, params, fichier), run(sql, params));
  db.first = ((sql: string, params?: SqlValue[]) => (noter(sql, params, fichier), first(sql, params))) as typeof db.first;
  db.all = ((sql: string, params?: SqlValue[]) => (noter(sql, params, fichier), all(sql, params))) as typeof db.all;
  if (batch) db.batch = (statements) => (statements.forEach((s) => noter(s.sql, s.params, fichier)), batch(statements));
  return db;
}
