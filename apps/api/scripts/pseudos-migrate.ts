// Migration des pseudos en double (lot 30) :
//   npm run pseudos:migrate                 essai à blanc : montre qui serait renommé, n'écrit rien
//   npm run pseudos:migrate -- --apply      applique (schéma, clés de pseudo, doublons, index unique) et montre le rapport
// Base : TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Turso), sinon SQLite local (DB_PATH, ./data/cdj.sqlite par défaut).
//
// Règle : le pseudo reste au joueur le plus ancien (sa première course). Les autres reçoivent un suffixe provisoire (« Nowy·2 ») et, à leur prochaine
// visite, le jeu leur propose de choisir un nouveau pseudo ou de charger leur code. **Aucun temps n'est touché.**
// Le serveur fait la même chose tout seul, une fois, au premier démarrage après le déploiement (le schéma change) : ce script sert à voir le rapport
// *avant* de déployer, à le relire après, et à rattraper un joueur créé par l'ancienne révision pendant la bascule (idempotent).
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ensureSchemaOn, type SqlDb } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { openSqlite } from "../src/node-sqlite";
import { migratePseudos, type PseudoMigration } from "../src/pseudos";
import { exigerDistant } from "../src/distant";

const apply = process.argv.includes("--apply");
const turso = process.env.TURSO_DATABASE_URL?.trim();

if (turso) exigerDistant(turso, process.argv, "pseudos:migrate lit toute la table des joueurs (et, avec --apply, la réécrit).");

let db: SqlDb & { close(): void };
if (turso) {
  console.log(`Base : Turso (${turso.replace(/^libsql:\/\//, "").replace(/\?.*$/, "")})`);
  db = await openLibsql({ url: turso, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
} else {
  const path = process.env.DB_PATH ?? "./data/cdj.sqlite";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  console.log(`Base : SQLite (${path})`);
  db = openSqlite(path);
}

function show(report: PseudoMigration, verb: string): void {
  console.log(`\n${report.keyed} joueur(s) sans clé de pseudo, ${report.renamed.length} pseudo(s) en double ${verb} :`);
  for (const r of report.renamed) console.log(`  « ${r.kept} » reste au plus ancien — « ${r.from} » (joueur ${r.idPrefix}…) devient « ${r.to} »`);
  if (!report.renamed.length) console.log("  (aucun doublon)");
}

try {
  const players = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players").catch(() => null))?.n ?? 0;
  console.log(`${players} joueur(s) dans la base.`);
  if (!apply) {
    console.log("Essai à blanc : rien n'est écrit. Relance avec --apply pour appliquer.");
    show(await migratePseudos(db, { dryRun: true }), "seraient renommés");
  } else {
    const upToDate = await ensureSchemaOn(db); // crée le schéma, calcule les clés, résout les doublons, pose l'index unique
    const stored = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'pseudo_migration'");
    if (upToDate) console.log("Le schéma était déjà à jour : la migration a déjà eu lieu (au démarrage du serveur ou par une exécution précédente).");
    if (stored) show(JSON.parse(stored.value) as PseudoMigration, "ont été renommés (rapport gardé dans la table meta)");
    const stragglers = await migratePseudos(db); // un joueur créé par l'ancienne révision pendant la bascule n'a pas de clé : on le rattrape
    if (stragglers.keyed > 0) show(stragglers, "rattrapés maintenant");
    const flagged = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE rename_required = 1"))?.n ?? 0;
    console.log(`\n${flagged} compte(s) attendent encore que leur propriétaire choisisse un nouveau pseudo.`);
  }
} finally {
  db.close();
}
