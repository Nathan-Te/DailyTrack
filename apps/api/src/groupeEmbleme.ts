import type { SqlDb } from "./db";

// Lot U4 — l'emblème du groupe d'un joueur à côté de son pseudo dans les classements du portail (`groupe: { id, nom, avatar? }` sur chaque ligne, `null` sans groupe).
// Une seule définition, trois lecteurs : le classement « Tous » (une jointure de plus dans la requête des pseudos), les classements « Amis » (une jointure de plus dans la liste des amis) et « Mon groupe »
// (une lecture de ton groupe). Les deux tables se lisent par leur clé primaire (`groupe_membres.player_id`, `groupes.id`) : aucun parcours.

/** Ce que la ligne d'un classement dit du groupe d'un joueur : l'identifiant public du groupe (12 hexadécimaux), son nom et l'empreinte de son emblème (absente : les initiales du nom). */
export interface EmblemeGroupe {
  id: string;
  nom: string;
  avatar?: string;
}

/** Les colonnes que les jointures ajoutent à une requête de joueurs. */
export interface ColonnesGroupe {
  groupe_id: string | null;
  groupe_nom: string | null;
  groupe_avatar: string | null;
}

/** La jointure à poser après `players p` : le groupe du joueur (s'il en a un), deux recherches par clé primaire. */
export const JOINTURE_GROUPE = "LEFT JOIN groupe_membres gm ON gm.player_id = p.id LEFT JOIN groupes g ON g.id = gm.groupe";
/** Les colonnes qui vont avec `JOINTURE_GROUPE`. */
export const COLONNES_GROUPE = "g.id AS groupe_id, g.name AS groupe_nom, g.avatar AS groupe_avatar";

/** L'emblème d'une ligne jointe (`null` : pas de groupe). */
export function emblemeDe(r: ColonnesGroupe): EmblemeGroupe | null {
  return r.groupe_id !== null && r.groupe_nom !== null ? { id: r.groupe_id, nom: r.groupe_nom, ...(r.groupe_avatar ? { avatar: r.groupe_avatar } : {}) } : null;
}

/** Le groupe d'un seul joueur (toi, dans un classement) : deux lectures par clé primaire, une seule requête. */
export async function monEmbleme(db: Pick<SqlDb, "first">, id: string): Promise<EmblemeGroupe | null> {
  const r = await db.first<ColonnesGroupe>(`SELECT ${COLONNES_GROUPE} FROM groupe_membres gm JOIN groupes g ON g.id = gm.groupe WHERE gm.player_id = ?`, [id]);
  return r ? emblemeDe(r) : null;
}
