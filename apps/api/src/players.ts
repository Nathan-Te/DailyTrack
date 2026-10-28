import type { SqlDb } from "./db";
import { HttpError } from "./errors";
import type { Statement } from "./games";
import { isForbidden, isUniqueViolation, nameKey, suggestionCandidates } from "./pseudos";
import { cleanName } from "./validate";

// Joueurs (lot 30) : pseudos réservés, codes révoqués, changement d'identifiant secret. Tout ce qui touche à la table `players` passe ici,
// pour que le classement du jour et le Salon appliquent exactement les mêmes règles.

export const NAME_RULES = "1 à 20 caractères : lettres, chiffres, espace . _ ' -";
export const NAME_TAKEN_MESSAGE = "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.";

export interface PlayerRow {
  id: string;
  name: string;
  name_key: string | null;
  rename_required: number;
  /** Lot N1 : 1 = masqué des classements par l'administration (le joueur n'en voit aucune différence). */
  hidden: number;
}

/** Lot N1 : la référence publique d'un joueur (12 premiers hexadécimaux du SHA-256 de son identifiant secret) : la seule façon de le nommer dans le panneau d'administration. */
export const REF_LENGTH = 12;
export async function refOfPlayer(id: string): Promise<string> {
  return (await sha256Hex(id)).slice(0, REF_LENGTH);
}

/** Empreinte SHA-256 en hexadécimal (64 caractères) : un identifiant révoqué n'est gardé que sous cette forme. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PlayersOptions {
  db: SqlDb;
  now: () => number;
  /** Marque `demo` les joueurs créés (jamais réglé par le serveur de production). */
  demoPlayers: boolean;
  /**
   * Lot P0 (registre des jeux) : les lignes des jeux qui suivent un « Changer mon code » (DailyTrack : ses temps, ses courses du Salon en cours),
   * dans la même transaction que la révocation. Sans elle : rien d'autre que le joueur.
   */
  rotateStatements?: (oldId: string, newId: string) => Statement[];
}

export type Players = ReturnType<typeof createPlayers>;

export function createPlayers({ db, now, demoPlayers, rotateStatements }: PlayersOptions) {
  const find = (id: string) => db.first<PlayerRow>("SELECT id, name, name_key, rename_required, hidden FROM players WHERE id = ?", [id]);

  /** Ce code a-t-il été remplacé (« Changer mon code ») ? */
  async function isRevoked(id: string): Promise<boolean> {
    return !!(await db.first("SELECT 1 AS x FROM revoked_codes WHERE hash = ?", [await sha256Hex(id)]));
  }

  /** Refuse un identifiant dont le code a été remplacé : « Ce code n'est plus valide ». */
  async function assertActive(id: string): Promise<void> {
    if (await isRevoked(id)) throw new HttpError(410, "code_revoked", "Ce code n'est plus valide : il a été remplacé. Charge le nouveau code de ton profil.");
  }

  /** Pseudos proches de `base` qui sont libres (au plus trois). */
  async function suggest(base: string): Promise<string[]> {
    const candidates = suggestionCandidates(base);
    if (!candidates.length) return [];
    const keys = candidates.map(nameKey);
    const taken = new Set((await db.all<{ name_key: string }>(`SELECT name_key FROM players WHERE name_key IN (${keys.map(() => "?").join(",")})`, keys)).map((r) => r.name_key));
    return candidates.filter((_, i) => !taken.has(keys[i]!)).slice(0, 3);
  }

  async function taken(name: string): Promise<HttpError> {
    return new HttpError(409, "name_taken", NAME_TAKEN_MESSAGE, {}, { suggestions: await suggest(name) });
  }

  /** Forme et mots refusés : les erreurs que le pseudo peut avoir avant même qu'on regarde la base. */
  function checkForm(raw: unknown): string {
    const name = cleanName(raw);
    if (name === null) throw new HttpError(400, "invalid_name", `Pseudo invalide (${NAME_RULES})`);
    if (isForbidden(name)) throw new HttpError(400, "name_forbidden", "Ce pseudo n'est pas permis. Choisis-en un autre.");
    return name;
  }

  /** Le pseudo est-il à `playerId` ou libre ? Lève 409 `name_taken` (avec des suggestions libres) s'il appartient à un autre. */
  async function assertFree(name: string, playerId: string | null): Promise<void> {
    const owner = await db.first<{ id: string }>("SELECT id FROM players WHERE name_key = ?", [nameKey(name)]);
    if (owner && owner.id !== playerId) throw await taken(name);
  }

  /** Réponse de `GET /api/name` : `true` si le pseudo est libre (ou déjà à ce joueur). */
  async function check(raw: unknown, playerId: string | null): Promise<{ available: true } | { available: false; suggestions: string[] }> {
    const name = checkForm(raw);
    try {
      await assertFree(name, playerId);
      return { available: true };
    } catch (e) {
      if (e instanceof HttpError && e.code === "name_taken") return { available: false, suggestions: (e.details.suggestions as string[]) ?? [] };
      throw e;
    }
  }

  /**
   * Le pseudo d'un envoi : celui qui est fourni (validé, libre) ou, sans pseudo fourni, celui que le joueur a déjà. Un joueur connu qui
   * renvoie son propre pseudo tel quel passe sans rien vérifier (même un nom provisoire « Nowy·2 » de la migration).
   */
  async function resolveName(playerId: string, raw: unknown, known: PlayerRow | null): Promise<string> {
    if (raw === undefined) {
      if (!known) throw new HttpError(400, "name_required", "Choisis un pseudo pour entrer au classement");
      return known.name;
    }
    if (known && typeof raw === "string" && raw.normalize("NFC") === known.name) return known.name;
    const name = checkForm(raw);
    if (known && (known.name_key ?? nameKey(known.name)) === nameKey(name)) return name; // casse ou accents de son propre pseudo
    await assertFree(name, playerId);
    return name;
  }

  /** Crée le joueur (première course valide) ou change son pseudo. La base a le dernier mot : un doublon qui passe la vérification est refusé ici. */
  async function save(playerId: string, name: string, known: PlayerRow | null): Promise<void> {
    if (known && known.name === name) return;
    const t = now();
    try {
      if (known) {
        await db.run("UPDATE players SET name = ?, name_key = ?, rename_required = 0, updated_at = ? WHERE id = ?", [name, nameKey(name), t, playerId]);
      } else {
        await db.run(
          "INSERT INTO players (id, name, created_at, updated_at, demo, name_key, ref) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key, updated_at = excluded.updated_at",
          [playerId, name, t, t, demoPlayers ? 1 : 0, nameKey(name), await refOfPlayer(playerId)],
        );
      }
    } catch (e) {
      if (isUniqueViolation(e)) throw await taken(name);
      throw e;
    }
  }

  /**
   * « Changer mon code » : le profil passe à `newId`, `oldId` est révoqué. Pseudo et lignes des jeux suivent (DailyTrack : résultats ; les
   * courses du Salon en cours sont oubliées, une session dure dix minutes). Rejouable : si la réponse s'est perdue, la même demande (même ancien et même nouvel
   * identifiant) réussit encore. Une seule transaction quand la base le permet.
   */
  async function rotate(oldId: string, newId: string): Promise<{ replayed: boolean }> {
    const [oldHash, newHash] = await Promise.all([sha256Hex(oldId), sha256Hex(newId)]);
    const row = await find(oldId);
    if (!row) {
      const done = await db.first<{ successor: string }>("SELECT successor FROM revoked_codes WHERE hash = ?", [oldHash]);
      if (done?.successor === newHash) return { replayed: true };
      if (done) throw new HttpError(410, "code_revoked", "Ce code n'est plus valide : il a été remplacé.");
      throw new HttpError(404, "unknown_player", "Ce joueur n'a pas encore de temps enregistré");
    }
    const [other, used] = await Promise.all([find(newId), db.first("SELECT 1 AS x FROM revoked_codes WHERE hash = ?", [newHash])]);
    if (other || used) throw new HttpError(409, "id_taken", "Ce nouvel identifiant est déjà pris : recommence");
    const t = now();
    const statements = [
      { sql: "INSERT INTO revoked_codes (hash, successor, revoked_at) VALUES (?, ?, ?) ON CONFLICT (hash) DO UPDATE SET successor = excluded.successor, revoked_at = excluded.revoked_at", params: [oldHash, newHash, t] },
      ...(rotateStatements?.(oldId, newId) ?? []), // les lignes de chaque jeu (registre)
      { sql: "UPDATE resultats_retires SET player_id = ? WHERE player_id = ?", params: [newId, oldId] }, // lot N1 : les résultats retirés suivent le joueur
      { sql: "UPDATE players SET id = ?, ref = ?, updated_at = ? WHERE id = ?", params: [newId, newHash.slice(0, REF_LENGTH), t, oldId] },
    ];
    if (db.batch) await db.batch(statements);
    else for (const s of statements) await db.run(s.sql, s.params);
    return { replayed: false };
  }

  /**
   * Lot R5 — effacement : la ligne du joueur (son pseudo est libéré : `name_key` part avec elle) et la chaîne de ses anciens codes révoqués
   * (des empreintes, reliées à lui par `successor`). Les instructions sont exécutées par la plateforme, avec celles des jeux.
   */
  async function eraseStatements(id: string): Promise<Statement[]> {
    const out: Statement[] = [];
    let successors = [await sha256Hex(id)];
    for (let depth = 0; depth < 50 && successors.length; depth++) {
      const rows = await db.all<{ hash: string }>(`SELECT hash FROM revoked_codes WHERE successor IN (${successors.map(() => "?").join(", ")})`, successors);
      for (const r of rows) out.push({ sql: "DELETE FROM revoked_codes WHERE hash = ?", params: [r.hash] });
      successors = rows.map((r) => r.hash);
    }
    out.push({ sql: "DELETE FROM resultats_retires WHERE player_id = ?", params: [id] }); // lot N1 : ses résultats retirés (rediffusions gardées 30 jours) partent aussi
    out.push({ sql: "DELETE FROM players WHERE id = ?", params: [id] });
    return out;
  }

  return { find, isRevoked, assertActive, suggest, checkForm, assertFree, check, resolveName, save, rotate, eraseStatements };
}
