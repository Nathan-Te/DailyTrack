import type { SqlDb } from "./db";
import type { Statement } from "./games";

// Lot C1, partie C (plateforme) — ce qui arrive à un groupe quand un joueur en part (il quitte, il est retiré, son profil est effacé). Un fichier à part, sans dépendance : `players.ts` (effacement) et
// `groupes.ts` (le départ volontaire) l'utilisent tous les deux. Règle : si le **chef** part, le membre le plus ancien devient chef ; s'il n'y a personne d'autre, le groupe est dissous.

/** Les instructions qui effacent un groupe : sa ligne, ses membres, son emblème, les signalements de cet emblème et son interdiction d'envoi. */
export function dissoudreStatements(groupe: string): Statement[] {
  return [
    { sql: "DELETE FROM groupe_membres WHERE groupe = ?", params: [groupe] },
    { sql: "DELETE FROM avatars WHERE kind = 'groupe' AND owner = ?", params: [groupe] },
    { sql: "DELETE FROM avatar_signalements WHERE kind = 'groupe' AND owner = ?", params: [groupe] },
    { sql: "DELETE FROM avatar_interdits WHERE kind = 'groupe' AND owner = ?", params: [groupe] },
    { sql: "DELETE FROM groupes WHERE id = ?", params: [groupe] },
  ];
}

/** Le membre le plus ancien d'un groupe, hors `sauf` ; `null` s'il n'y en a pas. Une lecture indexée (`groupe_membres_by_groupe`). */
export async function plusAncien(db: SqlDb, groupe: string, sauf: string): Promise<string | null> {
  const r = await db.first<{ player_id: string }>("SELECT player_id FROM groupe_membres WHERE groupe = ? AND player_id <> ? ORDER BY rejoint_le, player_id LIMIT 1", [groupe, sauf]);
  return r?.player_id ?? null;
}

/**
 * Les instructions du départ d'un joueur : sa ligne de membre part ; s'il était chef, le plus ancien le devient, sinon le groupe est dissous. Vide s'il n'est dans aucun groupe.
 * Rend aussi le groupe quitté et le nouveau chef (le journal et la réponse).
 */
export async function departDuJoueur(db: SqlDb, id: string): Promise<{ statements: Statement[]; groupe: string | null; chef: string | null; dissous: boolean }> {
  const m = await db.first<{ groupe: string }>("SELECT groupe FROM groupe_membres WHERE player_id = ?", [id]);
  if (!m) return { statements: [], groupe: null, chef: null, dissous: false };
  const g = await db.first<{ chef: string }>("SELECT chef FROM groupes WHERE id = ?", [m.groupe]);
  if (!g || g.chef !== id) return { statements: [{ sql: "DELETE FROM groupe_membres WHERE player_id = ?", params: [id] }], groupe: m.groupe, chef: g?.chef ?? null, dissous: false };
  const suivant = await plusAncien(db, m.groupe, id);
  if (!suivant) return { statements: dissoudreStatements(m.groupe), groupe: m.groupe, chef: null, dissous: true };
  return {
    statements: [
      { sql: "UPDATE groupes SET chef = ? WHERE id = ?", params: [suivant, m.groupe] },
      { sql: "DELETE FROM groupe_membres WHERE player_id = ?", params: [id] },
    ],
    groupe: m.groupe,
    chef: suivant,
    dissous: false,
  };
}
