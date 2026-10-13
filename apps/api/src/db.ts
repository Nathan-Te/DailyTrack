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
];

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
  // publique du joueur pour cette session (empreinte salée : l'identifiant secret ne sort jamais du serveur). Effacé à la fin de la session (+ minute de grâce : lot 27b).
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

/**
 * Table de service : empreinte du schéma appliqué. Au démarrage, une seule lecture suffit à savoir que la base est à jour (sur Turso,
 * chaque instruction est un aller-retour réseau : ne pas rejouer ~20 instructions à chaque réveil du conteneur).
 */
export const META_TABLE = "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)";

/** Empreinte (FNV-1a, 32 bits) du schéma et des migrations : change toute seule dès qu'on touche à l'un ou l'autre. */
export function schemaVersion(): string {
  let h = 0x811c9dc5;
  for (const ch of [...SCHEMA, ...MIGRATIONS].join("\n")) {
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
  await db.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [version]);
  return false;
}
