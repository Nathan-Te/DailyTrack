/**
 * Lot R14 — lire un plan `EXPLAIN QUERY PLAN` : quelles tables une requête **parcourt en entier** (`SCAN`), et lesquels de ces parcours sont justifiés.
 *
 * Pourquoi : Turso compte les lignes **parcourues**, pas les lignes renvoyées. `SEARCH t USING INDEX …` ne lit que les lignes de l'index qui répondent ;
 * `SCAN t` lit toute la table, à chaque appel. Sur l'offre gratuite le quota de lignes lues est commun à toutes les bases : un parcours oublié sur une grande
 * table de la recette a suffi à bloquer la production (docs/plateforme/lots/lot-R14-recette-sobre.md).
 *
 * Code de lecture seule, pur : le serveur ne l'importe pas.
 */

/** Grandes tables : leur taille croît avec les joueurs ou les jours. Un parcours complet de l'une d'elles est refusé sauf justification. */
export const GRANDES_TABLES = ["players", "results", "jump_results", "tower_results", "salon_runs", "jump_lives", "rate", "journal_admin", "journal_erreurs", "resultats_retires", "revoked_codes", "admin_sessions", "garage_choices"];

/**
 * Parcours complets acceptés, un par (table, motif du texte de la requête), chacun avec sa raison. Tout autre `SCAN` d'une grande table échoue
 * (`apps/api/test/plans.test.ts`). Une table qui reste petite à vie (planning, nouveautés, annonces, circuits, meta) n'a pas besoin de ligne ici.
 */
export const PARCOURS_PERMIS: { table: string; motif: RegExp; raison: string }[] = [
  // --- Ménages bornés : au plus une fois par fenêtre ou par heure et par instance, sur une table qui ne garde que peu de lignes ---
  {
    table: "rate",
    motif: /^DELETE FROM rate WHERE bucket/,
    raison: "ménage une fois par fenêtre de 10 min et par instance (platform.ts) ; la table ne garde que RATE_KEEP_WINDOWS fenêtres (≈ 1 000 lignes par fenêtre pour 500 joueurs actifs, soit ≈ 1 M de lignes lues par jour pour 2 instances) ; un index sur `bucket` coûterait une écriture de plus à chaque nouvelle clé de débit, et les écritures sont le quota le plus serré",
  },
  { table: "admin_sessions", motif: /^DELETE FROM admin_sessions WHERE expires_at/, raison: "ménage au plus une fois par heure et par instance ; la table ne porte que les sessions de l'éditeur (quelques lignes)" },
  { table: "journal_admin", motif: /^DELETE FROM journal_admin WHERE at /, raison: "ménage au plus une fois par heure et par instance (365 jours gardés) ; une ligne par action de l'éditeur" },
  { table: "journal_admin", motif: /^SELECT .* FROM journal_admin ORDER BY id DESC LIMIT/, raison: "parcours de la clé dans l'ordre inverse, arrêté par LIMIT : ne lit que les lignes rendues" },
  { table: "resultats_retires", motif: /^UPDATE resultats_retires SET replay = ''/, raison: "ménage au plus une fois par heure et par instance ; la table ne contient que les retraits faits à la main par l'éditeur" },
  // --- Opérations rares sur un joueur (changer de pseudo, de code, masquer, effacer) : tables à durée de vie courte ou parcours assumé ---
  { table: "salon_runs", motif: /player_id = \?/, raison: "renommer, masquer, changer de code ou effacer un joueur (rares) ; `salon_runs` est oubliée dix secondes après la fin de chaque session (lot 27b) : elle ne contient que la session en cours ; un index coûterait une écriture à chaque course du Salon" },
  { table: "jump_lives", motif: /player_id = \?/, raison: "changer de code ou effacer un joueur (rares) ; `jump_lives` est oubliée à la fin de chaque jour (une ligne par joueur du jour) ; un index coûterait une écriture à chaque premier lot de vies d'un joueur" },
  { table: "revoked_codes", motif: /successor IN/, raison: "effacement d'un joueur (route d'administration), pour retrouver la chaîne de ses codes révoqués ; table de quelques lignes (un code changé = une ligne)" },
  // --- Lot P (interrupteur des jeux) : l'effacement des résultats d'aperçu, quand un jeu passe `on` (une action de l'éditeur, quelques fois dans la vie d'un jeu) ---
  { table: "results", motif: /^DELETE FROM results WHERE apercu = 1/, raison: "un jeu passe `on` (action rare de l'éditeur) : efface les résultats rangés à part pendant l'aperçu ; un index sur `apercu` coûterait une écriture de plus à chaque course de chaque joueur pour une opération qui n'a lieu que quelques fois" },
  { table: "jump_results", motif: /^DELETE FROM jump_results WHERE apercu = 1/, raison: "un jeu passe `on` (action rare de l'éditeur) : efface les essais rangés à part pendant l'aperçu ; un index coûterait une écriture de plus à chaque essai pour une opération qui n'a lieu que quelques fois" },
  // --- Outils lancés à la main ou une fois par version du schéma ---
  { table: "players", motif: /^SELECT id, name, name_key, created_at FROM players ORDER BY created_at/, raison: "migration des pseudos (migratePseudos), une seule fois par changement de schéma au premier démarrage d'une instance" },
  { table: "players", motif: /^SELECT name, ref, hidden, created_at FROM players ORDER BY name_key LIMIT/, raison: "liste de l'administration sans filtre : parcours de l'index dans l'ordre, arrêté par LIMIT 50 + OFFSET" },
  { table: "players", motif: /^SELECT COUNT\(\*\) AS n FROM players WHERE demo = 0/, raison: "`history:seed` en local (refuse toute base qui contient de vrais joueurs)" },
  { table: "players", motif: /^SELECT COUNT\(\*\) AS n FROM players$/, raison: "remise à zéro du lancement et sauvegarde : comptent les lignes de chaque table, à la main, une fois (`--distant` exigé)" },
  { table: "*", motif: /^SELECT COUNT\(\*\) AS n FROM [a-z_]+$/, raison: "remise à zéro du lancement (`compter`) : compte les lignes de chaque table, à la main, une fois, `--distant` exigé contre Turso" },
  { table: "jump_lives", motif: /^UPDATE jump_deaths SET version = version \+ 1 WHERE frozen = 0 AND day IN/, raison: "changer de code ou effacer un joueur (rares) ; `jump_lives` ne contient que les joueurs du jour" },
  { table: "salon_runs", motif: /^(UPDATE salon_sessions|INSERT INTO salon_sessions)/, raison: "changer de code ou effacer un joueur (rares) ; `salon_runs` ne contient que la session en cours" },
];

export interface ParcoursTrouve {
  table: string;
  /** La raison du parcours si `PARCOURS_PERMIS` le justifie. */
  raison?: string;
}
export interface Verdict {
  parcours: ParcoursTrouve[];
  injustifies: ParcoursTrouve[];
}

/** Texte d'une requête réduit à l'essentiel pour la comparer (espaces, casse des mots-clés non touchée). */
export function normaliser(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/** Les parcours complets d'un plan : `SCAN <table>` (et `SCAN <table> USING … INDEX` : un index parcouru en entier lit autant de lignes). */
export function parcoursDuPlan(plan: string[]): string[] {
  const tables: string[] = [];
  for (const d of plan) {
    const m = /^SCAN (?:TABLE )?([A-Za-z_][A-Za-z0-9_]*)/.exec(d.trim());
    if (m) tables.push(m[1]!);
  }
  return tables;
}

export function analyserPlan(sql: string, plan: string[]): Verdict {
  const parcours: ParcoursTrouve[] = [];
  for (const table of parcoursDuPlan(plan)) {
    const permis = PARCOURS_PERMIS.find((p) => (p.table === table || p.table === "*") && p.motif.test(sql));
    parcours.push({ table, raison: permis?.raison });
  }
  const injustifies = parcours.filter((p) => !p.raison && GRANDES_TABLES.includes(p.table));
  return { parcours: parcours.filter((p) => GRANDES_TABLES.includes(p.table) || p.raison), injustifies };
}
