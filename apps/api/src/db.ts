import { PSEUDO_MIGRATION_ID, UNIQUE_NAME_INDEX, migratePseudos } from "./pseudos";
import { GAMES } from "./registry";

/** Accès SQL minimal, satisfait par SQLite (Node) et par D1 (Cloudflare) : le cœur ne connaît que ceci. */
export type SqlValue = string | number | null;

export interface SqlDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /**
   * Facultatif : plusieurs instructions d'écriture en un seul aller-retour réseau, dans une transaction (libSQL / Turso : chaque
   * instruction seule coûte un aller-retour, ~15 au démarrage pour le schéma). Les bases locales s'en passent.
   */
  batch?(statements: { sql: string; params?: SqlValue[] }[]): Promise<void>;
}

/**
 * Ajouts de colonnes pour les bases créées avant : chaque requête est tentée, et refusée sans conséquence si la colonne
 * existe déjà. `players.demo` : 1 pour les pilotes fictifs de l'historique (lot 11) ; un serveur de production n'en crée jamais.
 */
export const MIGRATIONS: string[] = [
  "ALTER TABLE players ADD COLUMN demo INTEGER NOT NULL DEFAULT 0",
  // Lot 27b : le Salon n'a plus de podiums gardés (une session finie est oubliée).
  "DROP TABLE IF EXISTS salon_podiums",
  // Lot 30 : pseudos réservés. `name_key` : forme normalisée du pseudo (unique : index posé par `migratePseudos` après avoir résolu les
  // doublons existants) ; `rename_required` : 1 pour un compte renommé par la migration, jusqu'à ce que son propriétaire choisisse un pseudo.
  "ALTER TABLE players ADD COLUMN name_key TEXT",
  "ALTER TABLE players ADD COLUMN rename_required INTEGER NOT NULL DEFAULT 0",
  // Lot 30 : place finale et nombre de participants d'un jour terminé, calculés une fois (à la première lecture du profil) puis gardés : un jour
  // fermé est figé, relire son classement à chaque synchronisation coûterait une lecture par concurrent et par jour.
  "ALTER TABLE results ADD COLUMN final_rank INTEGER",
  "ALTER TABLE results ADD COLUMN final_total INTEGER",
  // Lot I2 : la même chose pour DailyJump (meilleure place du profil commun du portail).
  "ALTER TABLE jump_results ADD COLUMN final_rank INTEGER",
  "ALTER TABLE jump_results ADD COLUMN final_total INTEGER",
  // Lot R9 : le refus des copies (`copies.ts`). `inputs_hash` : l'empreinte des entrées de la rediffusion classée de chaque joueur (une course dont les entrées
  // sont celles d'un autre joueur du jour est refusée, 409 `replay_copy`) ; `author_hash` : celle de l'auteur du niveau du jour (le pilote de Track, la preuve
  // de Jump), calculée avec le niveau. NULL pour une ligne d'avant : un niveau sans empreinte d'auteur est recalculé, une course sans empreinte ne bloque personne.
  // Les index viennent **après** les colonnes (une base d'avant n'a pas encore la colonne quand le schéma est appliqué).
  "ALTER TABLE results ADD COLUMN inputs_hash TEXT",
  "ALTER TABLE circuits ADD COLUMN author_hash TEXT",
  "ALTER TABLE jump_results ADD COLUMN inputs_hash TEXT",
  "ALTER TABLE jump_levels ADD COLUMN author_hash TEXT",
  // Lot 51 : la voiture de chaque course classée (circuit du jour, Salon), à part de la rediffusion : `id.couleur.motif.teinte` (`coderVoiture`, packages/sim/src/garage.ts).
  // NULL pour une ligne d'avant : le jeu y voit la Sparrow en orange. (La table `garage_choices` — le choix du Garage de chaque joueur — est nouvelle : `CDJ_SCHEMA`.)
  "ALTER TABLE results ADD COLUMN car TEXT",
  "ALTER TABLE salon_runs ADD COLUMN car TEXT",
  "CREATE INDEX IF NOT EXISTS results_by_inputs ON results (day, inputs_hash)",
  "CREATE INDEX IF NOT EXISTS jump_results_by_inputs ON jump_results (day, inputs_hash)",
];

/** Opérations du schéma qui ne sont pas des instructions SQL fixes (migration des pseudos) : leur identifiant fait partie de l'empreinte. */
const MIGRATION_MARKS = [PSEUDO_MIGRATION_ID, UNIQUE_NAME_INDEX];

/**
 * Tables de la plateforme (lot P0), communes à tous les jeux : joueurs (pseudo réservé), codes révoqués, compteurs de débit. Créées au premier
 * appel (`CREATE … IF NOT EXISTS`) : pas de migration manuelle.
 */
export const PLATFORM_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS players (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     demo INTEGER NOT NULL DEFAULT 0,
     name_key TEXT,
     rename_required INTEGER NOT NULL DEFAULT 0
   )`,
  // Lot 30 : codes révoqués (« Changer mon code »). Empreintes SHA-256 seulement : l'ancien identifiant (un secret) n'est pas gardé.
  // `successor` : empreinte du nouvel identifiant (permet de rejouer sans danger une demande dont la réponse s'est perdue).
  `CREATE TABLE IF NOT EXISTS revoked_codes (
     hash TEXT PRIMARY KEY,
     successor TEXT NOT NULL,
     revoked_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS rate (
     key TEXT NOT NULL,
     bucket INTEGER NOT NULL,
     count INTEGER NOT NULL,
     PRIMARY KEY (key, bucket)
   )`,
];

/** Tout le schéma : la plateforme, puis les tables de chaque jeu du registre (`registry.ts`), dans l'ordre. Son texte fait l'empreinte. */
export const SCHEMA: string[] = [...PLATFORM_SCHEMA, ...GAMES.flatMap((g) => g.schema)];

/**
 * Table de service : empreinte du schéma appliqué. Au démarrage, une seule lecture suffit à savoir que la base est à jour (sur Turso,
 * chaque instruction est un aller-retour réseau : ne pas rejouer ~20 instructions à chaque réveil du conteneur).
 */
export const META_TABLE = "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)";

/** Empreinte (FNV-1a, 32 bits) du schéma et des migrations : change toute seule dès qu'on touche à l'un ou l'autre. */
export function schemaVersion(): string {
  let h = 0x811c9dc5;
  for (const ch of [...SCHEMA, ...MIGRATIONS, ...MIGRATION_MARKS].join("\n")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Crée ou met à jour le schéma. Idempotent et sans danger si deux instances démarrent ensemble (`IF NOT EXISTS`, ajouts de colonnes
 * tentés et ignorés s'ils existent déjà). Rend `true` si la base était déjà à jour (rien n'a été écrit).
 */
export async function ensureSchemaOn(db: SqlDb): Promise<boolean> {
  const version = schemaVersion();
  try {
    const row = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'");
    if (row?.value === version) return true;
  } catch {
    /* pas encore de table `meta` : base neuve ou d'avant ce lot */
  }
  if (db.batch) await db.batch([{ sql: META_TABLE }, ...SCHEMA.map((sql) => ({ sql }))]);
  else for (const sql of [META_TABLE, ...SCHEMA]) await db.run(sql);
  for (const sql of MIGRATIONS) {
    try {
      await db.run(sql);
    } catch {
      /* colonne déjà là */
    }
  }
  // Lot 30 : clés de pseudo calculées, doublons résolus (le plus ancien garde son pseudo), puis index unique. Le rapport est gardé dans `meta`.
  const migration = await migratePseudos(db);
  if (migration.renamed.length) {
    await db.run("INSERT INTO meta (key, value) VALUES ('pseudo_migration', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [JSON.stringify(migration)]);
  }
  await db.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [version]);
  return false;
}
