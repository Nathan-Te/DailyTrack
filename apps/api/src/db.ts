/** Accès SQL minimal, satisfait par SQLite (Node) et par D1 (Cloudflare) : le cœur ne connaît que ceci. */
export type SqlValue = string | number | null;

export interface SqlDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/**
 * Ajouts de colonnes pour les bases créées avant : chaque requête est tentée, et refusée sans conséquence si la colonne
 * existe déjà. `players.demo` : 1 pour les pilotes fictifs de l'historique (lot 11) ; un serveur de production n'en crée jamais.
 */
export const MIGRATIONS: string[] = ["ALTER TABLE players ADD COLUMN demo INTEGER NOT NULL DEFAULT 0"];

/** Tables de l'API. Créées au premier appel (`CREATE … IF NOT EXISTS`) : pas de migration manuelle. */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS players (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     demo INTEGER NOT NULL DEFAULT 0
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
  // Planning (lot 14) : les jours dont le circuit a été remplacé à l'avance par l'admin. Pas de ligne = circuit d'origine
  // (variante 0, thème de la date). `theme` : thème imposé, ou NULL pour celui de la date.
  `CREATE TABLE IF NOT EXISTS planning (
     day INTEGER PRIMARY KEY,
     variant INTEGER NOT NULL,
     theme TEXT,
     chosen_at INTEGER NOT NULL
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
  // --- Le Salon (lot 27) ---
  // Meilleur temps de chaque joueur pour chaque session, avec la rediffusion qui l'a produit (sert de fantôme). `ref` : référence
  // publique du joueur pour cette session (empreinte salée : l'identifiant secret ne sort jamais du serveur). Purgé après 48 h.
  `CREATE TABLE IF NOT EXISTS salon_runs (
     session INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     ref TEXT NOT NULL,
     name TEXT NOT NULL,
     ms INTEGER NOT NULL,
     splits TEXT NOT NULL,
     replay TEXT NOT NULL,
     submitted_at INTEGER NOT NULL,
     PRIMARY KEY (session, player_id)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS salon_runs_by_ref ON salon_runs (session, ref)`,
  `CREATE INDEX IF NOT EXISTS salon_runs_by_time ON salon_runs (session, ms, submitted_at)`,
  `CREATE INDEX IF NOT EXISTS salon_runs_by_date ON salon_runs (submitted_at)`,
  // Les trois premiers de chaque session terminée, gardés après la purge des courses.
  `CREATE TABLE IF NOT EXISTS salon_podiums (
     session INTEGER NOT NULL,
     rank INTEGER NOT NULL,
     name TEXT NOT NULL,
     ms INTEGER NOT NULL,
     participants INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (session, rank)
   )`,
  // Version du classement d'une session : augmente à chaque temps amélioré ou pseudo changé (le jeu ne recharge que si elle change).
  `CREATE TABLE IF NOT EXISTS salon_sessions (
     session INTEGER PRIMARY KEY,
     version INTEGER NOT NULL
   )`,
  // Cache des circuits de session : générés à l'avance (deux minutes avant la fin de la session précédente), puis figés.
  `CREATE TABLE IF NOT EXISTS salon_circuits (
     session INTEGER PRIMARY KEY,
     track_id TEXT NOT NULL,
     spec TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  // Présence : empreinte du joueur et dernier passage. Rien d'autre n'est conservé (ni identifiant, ni adresse).
  `CREATE TABLE IF NOT EXISTS salon_presence (
     key TEXT PRIMARY KEY,
     seen_at INTEGER NOT NULL
   )`,
  // Dernier envoi de chaque joueur (empreinte) : au plus un envoi toutes les 5 s.
  `CREATE TABLE IF NOT EXISTS salon_throttle (
     key TEXT PRIMARY KEY,
     at INTEGER NOT NULL
   )`,
];
