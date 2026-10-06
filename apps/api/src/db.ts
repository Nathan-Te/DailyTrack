/** Accès SQL minimal, satisfait par SQLite (Node) et par D1 (Cloudflare) : le cœur ne connaît que ceci. */
export type SqlValue = string | number | null;

export interface SqlDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/** Tables de l'API. Créées au premier appel (`CREATE … IF NOT EXISTS`) : pas de migration manuelle. */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS players (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  // Cache des circuits du jour : calculés une fois (générateur + pilote de validation, coûteux), puis figés.
  `CREATE TABLE IF NOT EXISTS circuits (
     day INTEGER PRIMARY KEY,
     track_id TEXT NOT NULL,
     spec TEXT NOT NULL,
     author_ms INTEGER NOT NULL,
     attempt INTEGER NOT NULL,
     palette TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  // Meilleur temps de chaque joueur pour chaque jour, avec la rediffusion qui l'a produit (sert de fantôme).
  `CREATE TABLE IF NOT EXISTS results (
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     ms INTEGER NOT NULL,
     splits TEXT NOT NULL,
     replay TEXT NOT NULL,
     respawns INTEGER NOT NULL,
     submitted_at INTEGER NOT NULL,
     PRIMARY KEY (day, player_id)
   )`,
  `CREATE INDEX IF NOT EXISTS results_by_time ON results (day, ms, submitted_at)`,
  `CREATE TABLE IF NOT EXISTS rate (
     key TEXT NOT NULL,
     bucket INTEGER NOT NULL,
     count INTEGER NOT NULL,
     PRIMARY KEY (key, bucket)
   )`,
];
