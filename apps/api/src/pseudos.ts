import type { SqlDb } from "./db";
import { NAME_MAX, cleanName } from "./validate";

// Pseudos réservés (lot 30) : un pseudo appartient à son premier propriétaire, sur toute la base. Deux pseudos sont « le même » quand leur
// forme normalisée (`nameKey` : minuscules, accents retirés, espaces réduits) est la même : « Nowy », « nowy » et « NÓWY » se confondent.
// L'unicité est garantie par la base (index unique sur `players.name_key`), pas seulement par une vérification avant l'écriture.

/** Forme normalisée d'un pseudo : sert de clé d'unicité (jamais affichée). */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // accents retirés
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Mots refusés, liste courte et modifiable (un mot par entrée, en minuscules sans accent). Un mot de 6 lettres ou plus est refusé où qu'il
 * soit dans le pseudo ; un mot plus court seulement s'il forme un mot entier (« Bite » oui, « Cabite »… non : pas de faux positif sur
 * « Technique » ou « Computer »).
 */
export const FORBIDDEN_WORDS: readonly string[] = [
  "connard", "connasse", "salope", "salaud", "encule", "enculer", "pedophile", "pedo", "nazi", "hitler", "fuck", "fucker", "shit", "bitch", "nigger",
  "nigga", "negre", "pute", "putain", "merde", "bite", "nique", "ntm", "fdp",
];

/** Noms réservés au jeu (usurpation) : refusés quand le pseudo entier, une fois normalisé, leur est égal. */
export const RESERVED_NAMES: readonly string[] = ["admin", "administrateur", "moderateur", "modo", "systeme", "system", "circuit du jour", "cdj", "anonyme"];

/** Le pseudo est-il refusé (mot interdit ou nom réservé) ? Ne dit pas lequel : la liste ne sort pas du serveur. */
export function isForbidden(name: string): boolean {
  const key = nameKey(name);
  if (RESERVED_NAMES.includes(key)) return true;
  const tokens = key.split(/[^a-z0-9]+/).filter(Boolean);
  const squashed = tokens.join("");
  return FORBIDDEN_WORDS.some((w) => (w.length >= 6 ? squashed.includes(w) : tokens.includes(w)));
}

const SUFFIXES = ["2", "_FR", "3", "_2", "42", "_X", "99", "_GO"];

/** Pseudos proches de `base` (« Nowy » → « Nowy2 », « Nowy_FR »…), tous valides ; le serveur ne garde que ceux qui sont libres. */
export function suggestionCandidates(base: string): string[] {
  const out: string[] = [];
  for (const suffix of SUFFIXES) {
    const room = NAME_MAX - [...suffix].length;
    const stem = [...base].slice(0, room).join("").replace(/[ ._'’-]+$/u, "");
    const candidate = cleanName(stem + suffix);
    if (candidate && !isForbidden(candidate) && !out.includes(candidate)) out.push(candidate);
  }
  return out;
}

/** Nom provisoire d'un compte migré : « Nowy·2 » (le premier propriétaire garde « Nowy »). Tient en 20 caractères. */
export function provisionalName(base: string, n: number): string {
  const suffix = `·${n}`;
  return [...base].slice(0, NAME_MAX - [...suffix].length).join("").trimEnd() + suffix;
}

/** Une erreur de contrainte d'unicité (SQLite, libSQL et D1 la disent en toutes lettres). */
export function isUniqueViolation(e: unknown): boolean {
  const text = `${(e as Error)?.message ?? ""} ${((e as Error)?.cause as Error | undefined)?.message ?? ""}`;
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(text);
}

// --- Migration des doublons existants ----------------------------------------------------------------------------------------------

export const UNIQUE_NAME_INDEX = "CREATE UNIQUE INDEX IF NOT EXISTS players_by_name_key ON players (name_key)";
/** Change quand la logique de migration change : fait partie de l'empreinte du schéma (voir `schemaVersion`). */
export const PSEUDO_MIGRATION_ID = "pseudos-v1";

export interface RenamedPlayer {
  /** Pseudo gardé par le joueur le plus ancien. */
  kept: string;
  /** Ancien pseudo du joueur renommé (même forme normalisée que `kept`, casse et accents près). */
  from: string;
  /** Nouveau pseudo provisoire. */
  to: string;
  /** Début de l'identifiant du joueur renommé… jamais l'identifiant entier (c'est un secret). */
  idPrefix: string;
}

export interface PseudoMigration {
  /** Joueurs dont la clé de pseudo vient d'être calculée. */
  keyed: number;
  renamed: RenamedPlayer[];
}

interface Row {
  id: string;
  name: string;
  name_key: string | null;
  created_at: number;
}

/**
 * Calcule les clés manquantes et résout les doublons : le joueur le plus ancien (première course, `created_at`) garde son pseudo, les autres
 * reçoivent « Nom·2 », « Nom·3 »… et un drapeau (`rename_required`) qui leur fait proposer, à leur prochaine visite, de choisir un nouveau
 * pseudo. Aucun temps n'est touché. Puis l'index unique est posé. Idempotent : sans rien à faire, une lecture et la création (sans effet) de l'index.
 * `dryRun` : calcule et rend le rapport sans rien écrire (l'index non plus).
 */
export async function migratePseudos(db: SqlDb, options: { dryRun?: boolean; now?: () => number } = {}): Promise<PseudoMigration> {
  const now = options.now ?? Date.now;
  let rows: Row[];
  try {
    rows = await db.all<Row>("SELECT id, name, name_key, created_at FROM players ORDER BY created_at ASC, id ASC");
  } catch (e) {
    // Base d'avant le lot 30 (pas encore de colonne `name_key`) : possible seulement pour un essai à blanc, qui ne modifie rien.
    if (!options.dryRun) throw e;
    rows = (await db.all<Omit<Row, "name_key">>("SELECT id, name, created_at FROM players ORDER BY created_at ASC, id ASC")).map((r) => ({ ...r, name_key: null }));
  }
  const taken = new Set<string>();
  const pending: Row[] = [];
  for (const r of rows) {
    if (r.name_key) taken.add(r.name_key);
    else pending.push(r);
  }
  const writes: { sql: string; params: (string | number | null)[] }[] = [];
  const renamed: RenamedPlayer[] = [];
  const owner = new Map<string, string>(); // clé → pseudo du propriétaire (pour le rapport)
  for (const r of rows) if (r.name_key) owner.set(r.name_key, r.name);
  // `pending` est déjà du plus ancien au plus récent : le premier à réclamer une clé la garde.
  for (const r of pending) {
    const key = nameKey(r.name);
    if (!taken.has(key)) {
      taken.add(key);
      owner.set(key, r.name);
      writes.push({ sql: "UPDATE players SET name_key = ? WHERE id = ?", params: [key, r.id] });
      continue;
    }
    let n = 2;
    let name = provisionalName(r.name, n);
    while (taken.has(nameKey(name))) name = provisionalName(r.name, ++n);
    taken.add(nameKey(name));
    renamed.push({ kept: owner.get(key) ?? r.name, from: r.name, to: name, idPrefix: r.id.slice(0, 6) });
    writes.push({ sql: "UPDATE players SET name = ?, name_key = ?, rename_required = 1, updated_at = ? WHERE id = ?", params: [name, nameKey(name), now(), r.id] });
    // Les classements du Salon en cours montrent ce pseudo : même nom partout.
    writes.push({ sql: "UPDATE salon_runs SET name = ? WHERE player_id = ?", params: [name, r.id] });
  }
  if (!options.dryRun) {
    if (writes.length) {
      if (db.batch) await db.batch(writes);
      else for (const w of writes) await db.run(w.sql, w.params);
    }
    await db.run(UNIQUE_NAME_INDEX);
  }
  return { keyed: pending.length, renamed };
}
