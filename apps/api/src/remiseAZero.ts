import { formatDay, parseDay } from "@cdj/core";
import { ensureSchemaOn, META_TABLE, SCHEMA, type SqlDb, type SqlValue } from "./db";
import { GENERATION_KEY } from "./platform";

// Lot R8 — la remise à zéro du lancement public : tout le monde repart de zéro (classements, temps, morts, fantômes, séries, pseudos, codes de
// transfert, Salon). Lancée **par Nathan seulement**, par le workflow « Lancement : remise à zéro » (`.github/workflows/lancement-remise-a-zero.yml`,
// script `apps/api/scripts/remise-a-zero.ts`) ; aucun test ni outil n'écrit dans la base de production.
//
// **La liste des tables est calculée depuis le schéma** (`SCHEMA` de `db.ts`, qui assemble la plateforme et chaque jeu du registre) : une table
// du schéma est ou bien **vidée** (elle tient une donnée liée à un joueur ou à une partie), ou bien **gardée** (planning, caches de niveaux, table de
// service), jamais ni l'une ni l'autre. Le test `test/remiseAZero.test.ts` échoue si une table du schéma n'est dans aucune des deux listes, ou si une
// table gardée a une colonne qui nomme un joueur : **toute nouvelle table liée à un joueur rejoint `TABLES_VIDEES` — et le crochet `erase` de son jeu
// (effacement d'un joueur, lot R5)** (règle du `CLAUDE.md` racine).

/** Les tables vidées : chacune avec ce qu'elle tient (affiché dans le résumé du workflow et relu par Nathan). */
export const TABLES_VIDEES: Readonly<Record<string, string>> = {
  players: "identités, pseudos réservés, comptes (tous les jeux)",
  revoked_codes: "codes de transfert révoqués (empreintes)",
  rate: "compteurs de débit (empreintes d'adresses et d'identifiants)",
  results: "DailyTrack : meilleurs temps, rediffusions (fantômes), places finales",
  salon_runs: "Salon : courses de la session en cours",
  salon_sessions: "Salon : versions de classement des sessions",
  salon_circuits: "Salon : circuits de session (cache, sessions du moment)",
  salon_presence: "Salon : présence (empreintes)",
  salon_throttle: "Salon : délai entre deux envois (empreintes)",
  jump_results: "DailyJump : meilleurs essais, rediffusions (fantômes), places finales",
  jump_lives: "DailyJump : vies de chaque joueur (morts)",
  jump_deaths: "DailyJump : cartes des morts et échantillons du carnage (aucun joueur n'y est nommé, mais ils viennent des vies)",
};

/** Les tables gardées : aucune donnée de joueur (planning de l'administration, caches de niveaux déterministes, table de service). */
export const TABLES_GARDEES: Readonly<Record<string, string>> = {
  planning: "DailyTrack : planning des circuits (administration)",
  circuits: "DailyTrack : cache des circuits du jour (déterministe)",
  jump_levels: "DailyJump : cache des niveaux du jour (déterministe)",
  meta: "table de service : empreinte du schéma (la génération de données y est écrite par la remise à zéro)",
};

/** Clés de `meta` effacées : le rapport de la migration des pseudos nomme d'anciens pseudos. */
export const CLES_META_EFFACEES = ["pseudo_migration"] as const;

/** Les noms de tables que crée une liste d'instructions (`CREATE TABLE [IF NOT EXISTS] nom (`), dans l'ordre. */
export function tablesCreees(statements: readonly string[]): string[] {
  const out: string[] = [];
  for (const sql of statements) {
    const m = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
    if (m) out.push(m[1]!);
  }
  return out;
}

/** Toutes les tables du schéma, `meta` comprise. */
export const tablesDuSchema = (): string[] => [...new Set([...tablesCreees(SCHEMA), ...tablesCreees([META_TABLE])])];

export interface PlanRemiseAZero {
  videes: string[];
  gardees: string[];
}

/**
 * Le plan, calculé du schéma. Lève une erreur si une table n'est classée nulle part (ou deux fois), ou si une liste cite une table qui n'existe
 * plus : la remise à zéro refuse de partir sur une liste qu'elle ne comprend pas.
 */
export function planDeRemiseAZero(tables: readonly string[] = tablesDuSchema()): PlanRemiseAZero {
  const videes = Object.keys(TABLES_VIDEES);
  const gardees = Object.keys(TABLES_GARDEES);
  const inconnues = tables.filter((t) => !videes.includes(t) && !gardees.includes(t));
  if (inconnues.length) {
    throw new Error(`Table(s) du schéma absente(s) de la remise à zéro : ${inconnues.join(", ")}. Ajoute-les à TABLES_VIDEES (donnée liée à un joueur ou à une partie) ou à TABLES_GARDEES (apps/api/src/remiseAZero.ts).`);
  }
  const doubles = videes.filter((t) => gardees.includes(t));
  if (doubles.length) throw new Error(`Table(s) à la fois vidée(s) et gardée(s) : ${doubles.join(", ")}`);
  const disparues = [...videes, ...gardees].filter((t) => !tables.includes(t));
  if (disparues.length) throw new Error(`La remise à zéro cite des tables qui ne sont plus au schéma : ${disparues.join(", ")}`);
  return { videes: tables.filter((t) => videes.includes(t)), gardees: tables.filter((t) => gardees.includes(t)) };
}

export interface LigneRapport {
  table: string;
  /** Lignes avant la remise à zéro. */
  avant: number;
  /** Lignes après (0 pour une table vidée ; inchangé pour une table gardée). */
  apres: number;
}

export interface RapportRemiseAZero {
  /** `false` : essai à blanc, rien n'a été écrit. */
  applique: boolean;
  videes: LigneRapport[];
  gardees: LigneRapport[];
  /** La génération de données écrite (rien en essai à blanc). */
  generation: number | null;
  /** La génération qu'avait la base avant (0 : jamais remise à zéro). */
  generationAvant: number;
}

async function compter(db: SqlDb, table: string): Promise<number> {
  try {
    return (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
  } catch {
    return 0; // table pas encore créée (base neuve)
  }
}

/** La génération de données gardée dans `meta` (0 : jamais remise à zéro). */
export async function lireGeneration(db: SqlDb): Promise<number> {
  try {
    const row = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [GENERATION_KEY]);
    const n = row ? Number(row.value) : 0;
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Vide la base. `applique: false` : compte seulement (essai à blanc). Sinon, **en une transaction** (`SqlDb.batch`, ou instruction par
 * instruction faute de lot) : toutes les tables vidées, les clés de `meta` effacées, et une **nouvelle génération de données** (`now` en
 * millisecondes, toujours supérieure à la précédente : les navigateurs qui en gardent une plus ancienne effacent leurs données de jeu).
 * Les tables gardées ne sont pas touchées. Ne rend que des **nombres de lignes** : aucune donnée personnelle ne sort.
 */
export async function remiseAZero(db: SqlDb, o: { now: number; applique: boolean }): Promise<RapportRemiseAZero> {
  const plan = planDeRemiseAZero();
  const generationAvant = await lireGeneration(db);
  if (o.applique) await ensureSchemaOn(db); // une base neuve a son schéma ; le plan s'applique à des tables qui existent
  const avantVidees = await Promise.all(plan.videes.map(async (table) => ({ table, avant: await compter(db, table) })));
  const avantGardees = await Promise.all(plan.gardees.map(async (table) => ({ table, avant: await compter(db, table) })));
  if (!o.applique) {
    return {
      applique: false,
      videes: avantVidees.map((l) => ({ ...l, apres: l.avant })),
      gardees: avantGardees.map((l) => ({ ...l, apres: l.avant })),
      generation: null,
      generationAvant,
    };
  }
  const generation = Math.max(o.now, generationAvant + 1);
  const statements: { sql: string; params?: SqlValue[] }[] = [
    ...plan.videes.map((table) => ({ sql: `DELETE FROM ${table}` })),
    ...CLES_META_EFFACEES.map((key) => ({ sql: "DELETE FROM meta WHERE key = ?", params: [key] })),
    { sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", params: [GENERATION_KEY, String(generation)] },
  ];
  if (db.batch) await db.batch(statements);
  else for (const s of statements) await db.run(s.sql, s.params);
  const apresVidees = await Promise.all(avantVidees.map(async (l) => ({ ...l, apres: await compter(db, l.table) })));
  const apresGardees = await Promise.all(avantGardees.map(async (l) => ({ ...l, apres: await compter(db, l.table) })));
  return { applique: true, videes: apresVidees, gardees: apresGardees, generation, generationAvant };
}

// --- Les gardes (appliquées par le script `scripts/remise-a-zero.ts` ET vérifiées par le workflow) -----------------------------------------

/** La phrase que Nathan saisit pour confirmer. */
export const PHRASE_DE_CONFIRMATION = "tout le monde repart de zéro";

/**
 * La confirmation « le nom de la base » : celui que Nathan connaît dans Turso (`dailytrack-misterzcool`) ou le premier mot complet de l'adresse
 * (`dailytrack-misterzcool-<organisation>`, ce que `databaseName` lit). Un préfixe ne vaut que s'il s'arrête à un tiret et fait six caractères au moins.
 */
export function nomDeBaseCorrespond(saisi: string, visee: string): boolean {
  const a = saisi.trim().toLowerCase();
  const b = visee.trim().toLowerCase();
  if (a === "" || b === "") return false;
  return a === b || (a.length >= 6 && b.startsWith(`${a}-`));
}

export interface GardesEntree {
  cible: string;
  /** Le nom de la base que Nathan a saisi (voir `nomDeBaseCorrespond`). */
  baseSaisie: string;
  /** Le nom de la base réellement visée (`databaseName` de l'adresse). */
  baseVisee: string;
  phrase: string;
  /** « La sauvegarde de la base est faite » : exigé pour la production. */
  sauvegardeFaite: boolean;
}

/** Les raisons de refuser (vide : tout est en ordre). Pure et testée. */
export function refusDesGardes(e: GardesEntree): string[] {
  const refus: string[] = [];
  if (e.cible !== "recette" && e.cible !== "production") refus.push(`cible inconnue : « ${e.cible} » (recette ou production)`);
  if (!nomDeBaseCorrespond(e.baseSaisie, e.baseVisee)) {
    refus.push(`le nom de la base saisi (« ${e.baseSaisie} ») n'est pas celui de la base visée (« ${e.baseVisee} »)`);
  }
  if (e.phrase.trim() !== PHRASE_DE_CONFIRMATION) refus.push(`la phrase de confirmation n'est pas « ${PHRASE_DE_CONFIRMATION} »`);
  if (e.cible === "production" && !e.sauvegardeFaite) refus.push("la sauvegarde de la base de production n'est pas confirmée (docs/plateforme/lancement.md, étape 2)");
  return refus;
}

/**
 * La production ne se vide que le jour du lancement ou la veille : la date de lancement **servie** par la production (`lancement` de
 * `GET /api/portail/jour`) doit être aujourd'hui ou demain (date de Paris de la réponse, `date`). `null` : en ordre ; sinon la raison.
 */
export function refusDuLancement(corps: unknown): string | null {
  const o = corps as { date?: unknown; lancement?: unknown } | null;
  const date = typeof o?.date === "string" ? parseDay(o.date) : null;
  const lancement = typeof o?.lancement === "string" ? parseDay(o.lancement) : null;
  if (date === null || lancement === null) return "la production ne dit pas sa date de lancement (GET /api/portail/jour sans `lancement` : le serveur déployé est-il celui du lot R8 ?)";
  if (lancement === date || lancement === date + 1) return null;
  const quand = lancement > date ? "plus d'un jour trop tôt" : "après le lancement";
  return `la date de lancement servie par la production est le ${formatDay(lancement)} et nous sommes le ${formatDay(date)} : on ne vide pas la base ${quand}. Corrige config/lancement.json, « Mettre en production », puis relance.`;
}
