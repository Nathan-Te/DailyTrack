/**
 * Lot R12 — la sauvegarde de la base avant chaque mise en production : un texte SQL au format de `sqlite3 .dump` (`CREATE TABLE`, `INSERT`, index),
 * que `turso db create <nom> --from-dump <fichier>` ou `sqlite3 <fichier.db> < <fichier.sql>` restaurent. **Lecture seule** : une seule lecture de
 * la liste des tables, puis un seul lot de `SELECT *` en mode « read » (une transaction de lecture : un instantané cohérent, rien n'est écrit).
 * Pur (aucun accès réseau ici) : le lecteur est donné par l'appelant (`apps/api/scripts/sauvegarde.ts` : Turso ; les tests : SQLite).
 */

/** Durée de vie d'une sauvegarde dans le bucket (règle de suppression : `config/sauvegarde-cycle.json`, testée ; dite dans les mentions légales). */
export const SAUVEGARDE_JOURS = 30;

/** Une valeur lue : nombre, texte, octets, `null` (et `bigint` / booléen par prudence). */
export type ValeurLue = string | number | bigint | boolean | null | ArrayBuffer | Uint8Array;

export interface ResultatLu {
  columns: string[];
  rows: ArrayLike<ValeurLue>[];
}

/** Lit, d'un coup et dans une même transaction de lecture, le résultat de chaque requête. */
export type Lecteur = (requetes: string[]) => Promise<ResultatLu[]>;

export interface ObjetDuSchema {
  type: string;
  name: string;
  tbl_name: string;
  sql: string;
}

export interface Sauvegarde {
  texte: string;
  tables: { nom: string; lignes: number }[];
}

/** Les objets du schéma, dans l'ordre de `sqlite3 .dump` : les tables d'abord, puis index, déclencheurs et vues. */
export const REQUETE_SCHEMA =
  "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream%' " +
  "ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name";

export const identifiant = (nom: string): string => `"${nom.replace(/"/g, '""')}"`;

/** Une valeur en littéral SQL (celui de `.dump`) : `NULL`, nombre, `'texte'` (apostrophes doublées), `X'octets'`. */
export function litteral(v: ValeurLue): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "NULL";
    if (!Number.isFinite(v)) return v > 0 ? "9e999" : "-9e999";
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof ArrayBuffer || v instanceof Uint8Array) {
    const octets = v instanceof Uint8Array ? v : new Uint8Array(v);
    return `X'${Buffer.from(octets).toString("hex").toUpperCase()}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Le texte de la sauvegarde à partir du schéma et des lignes de chaque table (même ordre que `objets` filtré sur les tables). */
export function texteDeSauvegarde(objets: ObjetDuSchema[], lignes: Map<string, ResultatLu>): Sauvegarde {
  const out = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
  const tables: Sauvegarde["tables"] = [];
  for (const o of objets.filter((x) => x.type === "table")) {
    out.push(`${o.sql};`);
    const r = lignes.get(o.name) ?? { columns: [], rows: [] };
    for (const row of r.rows) out.push(`INSERT INTO ${identifiant(o.name)} VALUES(${Array.from(row, litteral).join(",")});`);
    tables.push({ nom: o.name, lignes: r.rows.length });
  }
  const sequence = lignes.get("sqlite_sequence");
  if (sequence?.rows.length) {
    out.push('DELETE FROM "sqlite_sequence";');
    for (const row of sequence.rows) out.push(`INSERT INTO "sqlite_sequence" VALUES(${Array.from(row, litteral).join(",")});`);
  }
  for (const o of objets.filter((x) => x.type !== "table")) out.push(`${o.sql};`);
  out.push("COMMIT;");
  return { texte: out.join("\n") + "\n", tables };
}

/** Lit toute la base (une lecture du schéma, puis un seul lot en lecture) et rend la sauvegarde. */
export async function sauvegarder(lire: Lecteur): Promise<Sauvegarde> {
  const [schema, aSequence] = await lire([REQUETE_SCHEMA, "SELECT count(*) FROM sqlite_master WHERE name = 'sqlite_sequence'"]);
  const objets = Array.from(schema!.rows, (r) => ({ type: String(r[0]), name: String(r[1]), tbl_name: String(r[2]), sql: String(r[3]) }));
  const tables = objets.filter((o) => o.type === "table").map((o) => o.name);
  const avecSequence = Number(aSequence!.rows[0]?.[0] ?? 0) > 0;
  const noms = avecSequence ? [...tables, "sqlite_sequence"] : tables;
  const resultats = noms.length ? await lire(noms.map((t) => `SELECT * FROM ${identifiant(t)}`)) : [];
  return texteDeSauvegarde(objets, new Map(noms.map((t, i) => [t, resultats[i]!])));
}
