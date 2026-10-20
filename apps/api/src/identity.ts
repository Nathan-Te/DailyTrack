import { HttpError } from "./errors";
import type { GameInstance, Platform, RequestInfo } from "./games";

// Les routes communes à tous les jeux (lot P0 de la plateforme) : une identité, un pseudo, un code, un profil pour tout le portail. Ce code
// vient d'`api.ts` (lot 30 de DailyTrack), déplacé tel quel ; les chemins et les réponses ne changent pas.
//
//   PUT  /api/player     { playerId, name }   change le pseudo d'un joueur connu (propriété du premier, refus 409 + suggestions libres)
//   GET  /api/name?name=                      le pseudo est-il libre ? (`X-Player-Id` facultatif ; rien d'autre n'est dit)
//   GET  /api/me                              le profil du joueur (`X-Player-Id`) ; son contenu vient du jeu qui le fournit (DailyTrack)
//   POST /api/me/code    { newId }            « Changer mon code » (`X-Player-Id` = l'ancien) : l'ancien est révoqué
//   POST /api/admin/effacer { code, confirmer? }  lot R5 — admin (jeton) : efface un joueur, à la demande écrite de son propriétaire, qui
//                                             donne son code de transfert (la preuve que le profil est à lui). Sans `confirmer: true` : un essai à
//                                             blanc (ce qui serait effacé). Procédure : docs/plateforme/effacement.md.
//
// L'identifiant secret est lu dans l'en-tête `X-Player-Id`, jamais dans l'adresse (qui finit dans les journaux de l'hébergeur).

/** Vérifications de pseudo par adresse et par fenêtre de débit : assez pour un formulaire, trop peu pour balayer des pseudos. */
const NAME_CHECKS_PER_WINDOW = 40;
/** Lectures du profil par joueur / par adresse et par fenêtre de débit (le jeu se synchronise au plus toutes les 30 s). */
const ME_PER_PLAYER = 60;
const ME_PER_CLIENT = 200;
/** Changements de code par joueur et par fenêtre de débit. */
const ROTATIONS_PER_WINDOW = 3;

/** Lot R5 : un code de transfert `CDJ2.<identifiant>.<CRC-32>` (la forme de `@cdj/profile`, `transfer.ts`) → l'identifiant, ou 400. */
export function playerIdFromCode(code: unknown): string {
  const m = typeof code === "string" ? /^CDJ2\.([0-9a-f]{32})\.([0-9a-f]{8})$/i.exec(code.trim()) : null;
  if (!m) throw new HttpError(400, "invalid_code", "Code de transfert attendu : CDJ2.<32 caractères>.<8 caractères> (Réglages › Profil)");
  const id = m[1]!.toLowerCase();
  if (crc32Hex(new TextEncoder().encode(id)) !== m[2]!.toLowerCase()) throw new HttpError(400, "invalid_code", "Code de transfert abîmé (la somme de contrôle ne correspond pas)");
  return id;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (zlib), sur 8 hexadécimaux : la somme de contrôle du code de transfert (la même que `crc32` de `@cdj/profile`, testé). */
export function crc32Hex(bytes: Uint8Array): string {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

export function createIdentityRoutes(platform: Platform, games: readonly GameInstance[], requireAdmin?: (req: Request, info: RequestInfo) => Promise<void>, onErased?: () => void) {
  const { db, log, limits, players, hashKey, hit, readJson, playerIdOf } = platform;

  /** L'identifiant secret du joueur, lu dans l'en-tête `X-Player-Id` (jamais dans l'adresse, qui finit dans les journaux de l'hébergeur). */
  function secretOf(req: Request): string {
    return playerIdOf(req.headers.get("x-player-id"));
  }

  async function renamePlayer(req: Request, info: RequestInfo): Promise<unknown> {
    const body = await readJson(req);
    const playerId = playerIdOf(body.playerId);
    players.checkForm(body.name); // forme et mots refusés d'abord : aucune base ni débit consommé pour un pseudo qui ne passera jamais
    await platform.hitAddress(info, "ip", limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);
    await players.assertActive(playerId);
    // On ne crée jamais de joueur ici : un joueur n'existe qu'après avoir envoyé une course valide (sinon, n'importe
    // qui pourrait remplir la base de pseudos sans jouer).
    const known = await players.find(playerId);
    if (!known) throw new HttpError(404, "unknown_player", "Ce joueur n'a pas encore de temps enregistré");
    const name = await players.resolveName(playerId, body.name, known);
    await players.save(playerId, name, known);
    for (const g of games) await g.onRename?.(playerId, name); // ce que chaque jeu montre déjà du joueur suit
    return { name };
  }

  async function nameCheck(req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    await platform.hitAddress(info, "nm", NAME_CHECKS_PER_WINDOW);
    const header = req.headers.get("x-player-id");
    return players.check(url.searchParams.get("name"), header === null ? null : playerIdOf(header));
  }

  /** Le profil du joueur, tel que le serveur le connaît : le jeu s'y synchronise, son stockage local n'en est qu'un cache. */
  async function myProfile(req: Request, info: RequestInfo): Promise<unknown> {
    const id = secretOf(req);
    await platform.hitAddress(info, "meip", ME_PER_CLIENT);
    await hit(await hashKey("me", id), ME_PER_PLAYER);
    await players.assertActive(id);
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue un tour pour l'ouvrir");
    // Le contenu (temps, médailles, série) vient du jeu qui le fournit : DailyTrack jusqu'au lot P2 (profil par jeu).
    let content: Record<string, unknown> = {};
    for (const g of games) if (g.profile) content = { ...content, ...(await g.profile(id)) };
    return { name: row.name, renameRequired: row.rename_required === 1, ...content };
  }

  /** « Changer mon code » : le serveur associe le profil au nouvel identifiant `newId` (tiré par le jeu), l'ancien ne vaut plus rien. */
  async function rotateCode(req: Request, info: RequestInfo): Promise<unknown> {
    const oldId = secretOf(req);
    const body = await readJson(req);
    const newId = playerIdOf(body.newId);
    if (newId === oldId) throw new HttpError(400, "invalid_player", "Le nouvel identifiant doit être différent de l'ancien");
    await platform.hitAddress(info, "ip", limits.perClient);
    await hit(await hashKey("rot", oldId), ROTATIONS_PER_WINDOW);
    const { replayed } = await players.rotate(oldId, newId);
    log("INFO", "code de joueur remplacé", { replayed });
    return { rotated: true };
  }

  /**
   * Lot R5 — `POST /api/admin/effacer` (jeton d'admin) : efface le joueur du code donné, ses temps et essais dans chaque jeu, ses vies, ses
   * courses du Salon, et libère son pseudo, en une transaction. Les classements des jours passés sont recalculés sans lui (sa ligne disparaît,
   * le suivant monte) ; son fantôme de premier n'est plus servi. Un code remplacé (« Changer mon code ») est refusé : il faut le code actuel.
   * Rien d'identifiant n'est journalisé (ni pseudo, ni identifiant : seulement les nombres de lignes).
   */
  async function erasePlayer(req: Request, info: RequestInfo): Promise<unknown> {
    if (!requireAdmin) throw new HttpError(404, "not_found", "Route inconnue");
    await requireAdmin(req, info);
    const body = await readJson(req);
    const id = playerIdFromCode(body.code);
    if (await players.isRevoked(id)) {
      throw new HttpError(410, "code_revoked", "Ce code a été remplacé (« Changer mon code ») : demande le code actuel, affiché dans Réglages › Profil.");
    }
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Aucun profil sur le serveur pour ce code : rien à effacer (le stockage du navigateur s'efface depuis le navigateur).");
    const parts = await Promise.all(games.map((g) => g.erase?.(id)));
    const counts: Record<string, number> = {};
    for (const p of parts) if (p) Object.assign(counts, p.counts);
    if (body.confirmer !== true) return { essai: true, pseudo: row.name, ...counts };
    const statements = [...parts.flatMap((p) => p?.statements ?? []), ...(await players.eraseStatements(id))];
    if (db.batch) await db.batch(statements);
    else for (const s of statements) await db.run(s.sql, s.params);
    for (const g of games) g.onErased?.();
    onErased?.(); // lot I3 : la mémoire du portail (classement du jour) aussi
    log("INFO", "joueur effacé", counts);
    return { efface: true, pseudo: row.name, ...counts };
  }

  /** Les routes communes ; `undefined` : ce chemin n'est pas une route de la plateforme. */
  async function route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/player") {
      if (req.method !== "PUT") throw new HttpError(405, "method_not_allowed", "PUT attendu");
      return await renamePlayer(req, info);
    }
    if (path === "/api/name") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await nameCheck(req, url, info);
    }
    if (path === "/api/me") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await myProfile(req, info);
    }
    if (path === "/api/admin/effacer") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await erasePlayer(req, info);
    }
    if (path === "/api/me/code") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await rotateCode(req, info);
    }
    return undefined;
  }

  return { route };
}
