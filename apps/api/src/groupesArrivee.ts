import { parisDay } from "@cdj/clock";
import type { SqlDb } from "./db";

/** Identifiant de la migration (il entre dans l'empreinte du schéma : `db.ts`, `MIGRATION_MARKS`). */
export const ARRIVEES_GROUPES_MIGRATION_ID = "groupes-arrivee-jour-meme-v1";

/**
 * Lot C1d : un membre compte dès le jour de son arrivée. Les lignes écrites avant le lot portent l'arrivée de l'ancienne règle (le jour suivant) : on la ramène au jour de Paris de `rejoint_le`.
 * **Idempotente** (seules les lignes dont `arrivee` dépasse ce jour sont touchées : deux instances qui démarrent ensemble, ou un second passage, ne changent rien de plus) ;
 * l'ensemble tient dans la table des groupes, quelques dizaines de lignes. **Réversible** : `UPDATE groupe_membres SET arrivee = arrivee + 1` redonne la règle d'avant (le code d'avant ne lit que `arrivee`).
 * Rend le nombre de lignes remises.
 */
export async function migrerArriveesDesGroupes(db: SqlDb): Promise<number> {
  const rows = await db.all<{ player_id: string; rejoint_le: number; arrivee: number }>("SELECT player_id, rejoint_le, arrivee FROM groupe_membres");
  const aRemettre = rows.filter((r) => r.arrivee > parisDay(r.rejoint_le));
  const instructions = aRemettre.map((r) => ({ sql: "UPDATE groupe_membres SET arrivee = ? WHERE player_id = ? AND arrivee > ?", params: [parisDay(r.rejoint_le), r.player_id, parisDay(r.rejoint_le)] }));
  if (db.batch && instructions.length) await db.batch(instructions);
  else for (const i of instructions) await db.run(i.sql, i.params);
  return aRemettre.length;
}
