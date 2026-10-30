import { PSEUDO_MIGRATION_ID, UNIQUE_NAME_INDEX, migratePseudos } from "./pseudos";
import { JEUX_PUBLICS } from "@cdj/core/jeux";
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
  // Lot N1 (panneau d'administration). **Réversible** : des colonnes et des index ajoutés, aucune donnée réécrite ; l'ancien code les ignore. Retour arrière :
  // `ALTER TABLE <table> DROP COLUMN <colonne>` et `DROP INDEX <index>` (SQLite 3.35+, libSQL), puis `DROP TABLE` des quatre tables de `PLATFORM_SCHEMA` (admin_sessions,
  // journal_admin, journal_erreurs, resultats_retires) — voir docs/plateforme/lots/lot-N1-admin-connexion-tableau-joueurs.md.
  //   `players.hidden` : 1 = masqué des classements (le joueur garde son profil) ; `results.hidden`, `jump_results.hidden`, `salon_runs.hidden` : la même marque, recopiée sur chaque
  //   résultat pour que les classements l'écartent sans jointure (une ligne lue par classé, comme avant). `players.ref` : référence publique (12 premiers hexadécimaux du SHA-256 de
  //   l'identifiant secret), seule façon de nommer un joueur dans le panneau — l'identifiant secret n'en sort jamais.
  "ALTER TABLE players ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE players ADD COLUMN ref TEXT",
  "ALTER TABLE results ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE jump_results ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE salon_runs ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
  // Les classements écartent `hidden = 1` : ces index les servent **sans lire la table** (jour, masqué, temps, envoi, joueur), comme avant le lot pour les
  // places et les nombres de classés (`results_by_time` et la clé primaire de `jump_results` ne portaient pas `hidden`).
  "CREATE INDEX IF NOT EXISTS results_by_visible ON results (day, hidden, ms, submitted_at, player_id)",
  "CREATE INDEX IF NOT EXISTS jump_results_by_visible ON jump_results (day, hidden, ticks, submitted_at, player_id)",
  "CREATE INDEX IF NOT EXISTS players_by_ref ON players (ref)",
  "CREATE INDEX IF NOT EXISTS players_by_created ON players (created_at)",
  "CREATE INDEX IF NOT EXISTS players_masques ON players (hidden, name_key)",
  // Lot P (l'interrupteur des jeux, `jeux.ts`). **Réversible** : une colonne ajoutée à deux tables (l'ancien code l'ignore) et une table nouvelle (`jeux`, dans `PLATFORM_SCHEMA`). Retour arrière :
  // `ALTER TABLE results DROP COLUMN apercu`, `ALTER TABLE jump_results DROP COLUMN apercu` et `DROP TABLE jeux`. `apercu` = 1 : un résultat envoyé pendant l'aperçu d'un jeu (clé d'aperçu ou aperçu
  // de PR) ; il est écrit `hidden = 1` (aucun classement public ne le lit) et effacé quand le jeu passe `on`.
  "ALTER TABLE results ADD COLUMN apercu INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE jump_results ADD COLUMN apercu INTEGER NOT NULL DEFAULT 0",
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
  // --- Lot N1 : le panneau d'administration (`admin.ts`) -----------------------------------------------------------------------------
  // Sessions : l'identifiant tiré au hasard et l'empreinte de l'administrateur (jamais son adresse) ; la déconnexion écrit `revoked_at`. Gardées un jour après leur fin.
  `CREATE TABLE IF NOT EXISTS admin_sessions (
     sid TEXT PRIMARY KEY,
     admin TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     revoked_at INTEGER
   )`,
  // Le journal des actions : heure, administrateur (empreinte), action, cible (le pseudo, et la référence publique du joueur), avant / après. **Jamais le contenu effacé** : pour
  // une suppression, seulement le pseudo. `AUTOINCREMENT` : l'ordre est celui des identifiants.
  `CREATE TABLE IF NOT EXISTS journal_admin (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at INTEGER NOT NULL,
     admin TEXT NOT NULL,
     action TEXT NOT NULL,
     cible TEXT NOT NULL,
     avant TEXT,
     apres TEXT
   )`,
  // Les erreurs serveur et les rediffusions refusées (code, route, heure ; ni joueur, ni corps de requête), bornées en écriture et gardées 14 jours.
  `CREATE TABLE IF NOT EXISTS journal_erreurs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at INTEGER NOT NULL,
     code TEXT NOT NULL,
     route TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS journal_erreurs_by_time ON journal_erreurs (at)`,
  // Les résultats retirés par l'administration (retrait doux) : la rediffusion est gardée 30 jours pour vérification, puis effacée (`replay` vidé, la ligne reste avec son motif).
  `CREATE TABLE IF NOT EXISTS resultats_retires (
     game TEXT NOT NULL,
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     temps_ms INTEGER NOT NULL,
     replay TEXT NOT NULL,
     inputs_hash TEXT,
     removed_at INTEGER NOT NULL,
     motif TEXT NOT NULL,
     admin TEXT NOT NULL,
     PRIMARY KEY (game, day, player_id)
   )`,
  `CREATE INDEX IF NOT EXISTS resultats_retires_by_player ON resultats_retires (player_id)`,
  `CREATE INDEX IF NOT EXISTS resultats_retires_by_inputs ON resultats_retires (game, day, inputs_hash)`,
  // --- Lot N2 : les nouveautés et le message en direct (`diffusion.ts`). **Réversible** : deux tables nouvelles, rien d'existant touché (l'ancien code les ignore) ; retour arrière :
  // `DROP TABLE nouveautes` et `DROP TABLE annonces` (les index partent avec). Aucune donnée de joueur : ce que Nathan écrit pour les joueurs.
  // Nouveauté : titre FR / EN, date affichée (AAAA-MM-JJ), lignes (JSON : zone, français, anglais, PR d'origine), statut (`brouillon` | `publiee`), dates.
  `CREATE TABLE IF NOT EXISTS nouveautes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     titre_fr TEXT NOT NULL,
     titre_en TEXT NOT NULL,
     date_affichee TEXT NOT NULL,
     lignes TEXT NOT NULL,
     statut TEXT NOT NULL,
     cree_le INTEGER NOT NULL,
     modifie_le INTEGER NOT NULL,
     publie_le INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS nouveautes_by_date ON nouveautes (statut, date_affichee, id)`,
  // Message en direct : textes FR / EN, où (`portail,track,jump`), ton, début, fin (il s'éteint seul), retrait (« Retirer maintenant » ou remplacé). Un seul actif : fin pas atteinte et pas retiré.
  `CREATE TABLE IF NOT EXISTS annonces (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     texte_fr TEXT NOT NULL,
     texte_en TEXT NOT NULL,
     ou TEXT NOT NULL,
     ton TEXT NOT NULL,
     debut INTEGER NOT NULL,
     fin INTEGER NOT NULL,
     retire_le INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS annonces_by_fin ON annonces (fin)`,
  // --- Lot P : l'interrupteur des jeux (`jeux.ts`). **Réversible** : une table nouvelle, rien d'existant touché ; retour arrière : `DROP TABLE jeux`. Une ligne par jeu (son dossier sur le site) : l'état (`off` |
  // `preview` | `on` ; **un jeu sans ligne vaut `off`**), `live_from` (le premier jour entier où le jeu compte dans la journée, jour de Paris en jours depuis 1970), les périodes (JSON `[[du, au|null], …]` : les
  // jours où il compte, pour que le désactiver ne casse aucune série), l'**empreinte** SHA-256 de la clé d'aperçu (jamais la clé) et sa date. Aucune donnée de joueur : gardée par la remise à zéro.
  `CREATE TABLE IF NOT EXISTS jeux (
     jeu TEXT PRIMARY KEY,
     etat TEXT NOT NULL,
     live_from INTEGER,
     periodes TEXT NOT NULL DEFAULT '[]',
     cle_hash TEXT,
     cle_creee_le INTEGER,
     modifie_le INTEGER NOT NULL
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
  await semerJeux(db);
  await db.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [version]);
  return false;
}

/**
 * Lot P (interrupteur des jeux) : Track et Jump étaient publics avant l'interrupteur, ils naissent `on` — **une seule fois** (`meta.jeux_semes`), jamais en écrasant un état choisi depuis
 * (`INSERT OR IGNORE`) ni après une remise à zéro (la table `jeux` est gardée). Un jeu d'un lot suivant n'est pas dans `JEUX_PUBLICS` : sans ligne, il vaut `off`. Écrit au schéma, pas à une lecture.
 */
export async function semerJeux(db: SqlDb): Promise<void> {
  // Pas de `try` : un échec ici doit empêcher de marquer le schéma à jour (la requête suivante réessaie) — sinon Track et Jump resteraient `off` en production.
  if (await db.first("SELECT 1 AS ok FROM meta WHERE key = 'jeux_semes'")) return;
  const t = Date.now();
  const instructions: { sql: string; params?: SqlValue[] }[] = [
    ...JEUX_PUBLICS.map((j) => ({ sql: "INSERT OR IGNORE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES (?, 'on', 0, '[[0,null]]', ?)", params: [j, t] as SqlValue[] })),
    { sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('jeux_semes', '1')" },
  ];
  if (db.batch) await db.batch(instructions);
  else for (const s of instructions) await db.run(s.sql, s.params);
}
