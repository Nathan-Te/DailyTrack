import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
import { ImageRefusee, controlerImage, octetsDeBase64 } from "./imagesAvatar";
import { ecrireJournal } from "./journaux";
import { REF_LENGTH, sha256Hex } from "./players";
import { parisDayStart } from "@cdj/clock";

// Lot C1, partie B (plateforme) — les avatars des joueurs (et, à la partie C, les emblèmes des groupes). README : `docs/plateforme/lots/lot-C1-retours-avatars-groupes.md` ; règles : `apps/api/CLAUDE.md`, « Avatars (lot C1) ».
//
//   POST   /api/avatar { image }                 (X-Player-Id) envoie une image (base64 : WebP ou JPEG, contrôlée octet par octet : `imagesAvatar.ts`) ; un changement par jour
//   DELETE /api/avatar                           (X-Player-Id) retire la sienne (retour aux initiales)
//   POST   /api/avatar/signaler { ref }          (X-Player-Id) signale l'image du joueur de cette référence publique (un signalement par signalant et par image) ; à 3 en attente, elle est masquée
//   GET    /api/avatars/<empreinte>              l'image, **en octets, adresse immuable** (cache long du navigateur, une heure chez Hosting) ; 404 si masquée, retirée ou inconnue
//   Administration : GET /api/admin/images (les signalées, puis les nouvelles), GET /api/admin/images/<kind>/<ref> (les octets), POST …/garder | retirer | interdire | autoriser
//
// **Rien n'est affiché sans les contrôles du serveur** : l'image est relue, ses en-têtes vérifiés, puis rangée en base (aucun fichier : pas d'étape manuelle, pas d'autre service). `players.avatar` garde l'empreinte de l'image
// **visible** de chaque joueur (NULL : initiales) : un classement l'obtient avec le pseudo, sans lire la table des images. Aucune lecture d'image pendant une partie (les écrans hors partie seuls en affichent).

export const AVATAR_PAR_ADRESSE = 20;
export const AVATAR_LECTURES_PAR_ADRESSE = 3000;
export const SIGNALEMENTS_MASQUAGE = 3;
export const SIGNALEMENTS_PAR_ADRESSE = 20;
export const IMAGES_ADMIN_PAR_LISTE = 60;
/** Cache de l'image : le navigateur la garde un an (l'adresse change avec l'image) ; Hosting une heure, le temps d'un retrait « sans délai » à l'échelle d'une heure pour une adresse déjà connue. */
export const AVATAR_CACHE = "public, max-age=31536000, s-maxage=3600, immutable";

export type GenreImage = "joueur" | "groupe";
const GENRES: readonly GenreImage[] = ["joueur", "groupe"];

interface LigneImage {
  kind: GenreImage;
  owner: string;
  hash: string;
  mime: string;
  data: string;
  statut: string;
  revu: number;
  jour: number;
  cree_le: number;
  maj_le: number;
}

/** Ce qui change selon le propriétaire : la copie de l'empreinte visible sur sa ligne, et son nom pour le journal. La partie C y ajoute les groupes. */
export interface ProprietaireImage {
  /** Existe-t-il, et sous quel nom (journal, panneau) et quelle référence publique ? */
  trouver(db: Platform["db"], cle: string): Promise<{ owner: string; nom: string; ref: string } | null>;
  /** Copie l'empreinte visible (ou NULL) là où les classements la lisent. */
  copier(owner: string, hash: string | null): Statement;
}

export function createAvatars(platform: Platform, extra: Partial<Record<GenreImage, ProprietaireImage>> = {}) {
  const { db, now, log, players, hashKey, hit, hitAddress, readHitAddress, readJson, playerIdOf } = platform;
  const FORMAT_HASH = /^[0-9a-f]{16}$/;

  const proprietaires: Partial<Record<GenreImage, ProprietaireImage>> = {
    joueur: {
      async trouver(base, ref) {
        const r = await base.first<{ id: string; name: string; ref: string }>("SELECT id, name, ref FROM players WHERE ref = ?", [ref.toLowerCase()]);
        return r ? { owner: r.id, nom: r.name, ref: r.ref } : null;
      },
      copier: (owner, hash) => ({ sql: "UPDATE players SET avatar = ? WHERE id = ?", params: [hash, owner] }),
    },
    ...extra,
  };
  const ecrire = async (instructions: Statement[]) => {
    if (db.batch) await db.batch(instructions);
    else for (const s of instructions) await db.run(s.sql, s.params);
  };
  const genre = (x: string): GenreImage => {
    if (!(GENRES as readonly string[]).includes(x) || !proprietaires[x as GenreImage]) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    return x as GenreImage;
  };
  const refValide = (x: unknown): string => {
    if (typeof x !== "string" || !new RegExp(`^[0-9a-f]{${REF_LENGTH}}$`, "i").test(x)) throw new HttpError(400, "invalid_report", "Référence invalide");
    return x.toLowerCase();
  };
  const idDe = (req: Request): string => playerIdOf(req.headers.get("x-player-id"));

  /** L'empreinte d'une image : 16 premiers hexadécimaux de son SHA-256 (l'adresse immuable). */
  async function empreinte(octets: Uint8Array): Promise<string> {
    const d = await crypto.subtle.digest("SHA-256", octets as BufferSource);
    return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // --- Poser, retirer, signaler (joueur) ---------------------------------------------------------------------------------------
  /** Range une image **déjà contrôlée** pour un propriétaire (le joueur, ou le groupe de la partie C) : un changement par jour, l'interdiction d'envoi respectée. Rend l'empreinte. */
  async function poser(kind: GenreImage, owner: string, octets: Uint8Array, mime: string): Promise<string> {
    if (await db.first("SELECT 1 AS x FROM avatar_interdits WHERE kind = ? AND owner = ?", [kind, owner])) throw new HttpError(403, "avatar_banned", "Envoi d'images interdit");
    const aujourdhui = platform.today();
    const actuelle = await db.first<{ jour: number }>("SELECT jour FROM avatars WHERE kind = ? AND owner = ?", [kind, owner]);
    if (actuelle && actuelle.jour === aujourdhui) {
      throw new HttpError(429, "avatar_limit", "Un changement d'image par jour", { "Retry-After": String(Math.max(1, Math.ceil((parisDayStart(aujourdhui + 1) - now()) / 1000))) });
    }
    const hash = await empreinte(octets);
    let binaire = "";
    for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
    const t = now();
    await ecrire([
      {
        sql: "INSERT INTO avatars (kind, owner, hash, mime, data, statut, revu, jour, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, 'visible', 0, ?, ?, ?) ON CONFLICT (kind, owner) DO UPDATE SET hash = excluded.hash, mime = excluded.mime, data = excluded.data, statut = 'visible', revu = 0, jour = excluded.jour, maj_le = excluded.maj_le",
        params: [kind, owner, hash, mime, btoa(binaire), aujourdhui, t, t],
      },
      proprietaires[kind]!.copier(owner, hash),
    ]);
    return hash;
  }

  async function envoyer(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await hitAddress(info, "avip", AVATAR_PAR_ADRESSE);
    await hit(await hashKey("avw", id), platform.limits.perPlayer);
    await players.assertActive(id);
    if (!(await players.find(id))) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    const octets = octetsDeBase64((await readJson(req)).image);
    let controle;
    try {
      if (!octets) throw new ImageRefusee("format");
      controle = controlerImage(octets);
    } catch (e) {
      if (e instanceof ImageRefusee) throw new HttpError(400, "invalid_image", e.message, {}, { raison: e.raison });
      throw e;
    }
    const hash = await poser("joueur", id, octets!, controle.mime);
    log("INFO", "avatars : image reçue", { mime: controle.mime }); // ni empreinte, ni joueur
    return { avatar: hash };
  }

  async function retirerLaSienne(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await hitAddress(info, "avip", AVATAR_PAR_ADRESSE);
    await hit(await hashKey("avw", id), platform.limits.perPlayer);
    await players.assertActive(id);
    await ecrire([{ sql: "DELETE FROM avatars WHERE kind = 'joueur' AND owner = ?", params: [id] }, proprietaires.joueur!.copier(id, null)]);
    return { avatar: null };
  }

  /** Masque l'image à `SIGNALEMENTS_MASQUAGE` signalements distincts en attente : on revient aux initiales jusqu'à la décision de l'éditeur. */
  async function signalerUne(kind: GenreImage, owner: string, hash: string, signalant: string): Promise<{ masque: boolean }> {
    await db.run("INSERT INTO avatar_signalements (kind, owner, hash, reporter, traite, cree_le) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT DO NOTHING", [kind, owner, hash, signalant, now()]);
    const n = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatar_signalements WHERE kind = ? AND owner = ? AND hash = ? AND traite = 0", [kind, owner, hash]))?.n ?? 0;
    if (n < SIGNALEMENTS_MASQUAGE) return { masque: false };
    await ecrire([
      { sql: "UPDATE avatars SET statut = 'masque', maj_le = ? WHERE kind = ? AND owner = ? AND hash = ? AND statut = 'visible'", params: [now(), kind, owner, hash] },
      proprietaires[kind]!.copier(owner, null),
    ]);
    return { masque: true };
  }

  async function signaler(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await hitAddress(info, "avsip", SIGNALEMENTS_PAR_ADRESSE);
    await hit(await hashKey("avs", id), platform.limits.perPlayer);
    await players.assertActive(id);
    if (!(await players.find(id))) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    const corps = await readJson(req);
    const kind: GenreImage = corps.groupe !== undefined ? "groupe" : "joueur";
    const cible = await proprietaires[genre(kind)]!.trouver(db, String(kind === "groupe" ? corps.groupe : refValide(corps.ref)));
    if (!cible) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    if (kind === "joueur" && cible.owner === id) throw new HttpError(400, "invalid_report", "On ne se signale pas soi-même");
    const image = await db.first<{ hash: string }>("SELECT hash FROM avatars WHERE kind = ? AND owner = ? AND statut = 'visible'", [kind, cible.owner]);
    if (!image) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    await signalerUne(kind, cible.owner, image.hash, id);
    return { ok: true }; // le signalant ne sait pas si l'image a été masquée
  }

  /** `GET /api/avatars/<empreinte>` : les octets de l'image visible, adresse immuable. */
  async function lire(req: Request, info: RequestInfo, hash: string): Promise<WithHeaders> {
    await readHitAddress(info, "avlip", AVATAR_LECTURES_PAR_ADRESSE);
    if (!FORMAT_HASH.test(hash)) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    const r = await db.first<{ mime: string; data: string }>("SELECT mime, data FROM avatars WHERE hash = ? AND statut = 'visible' LIMIT 1", [hash]);
    if (!r) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    const binaire = atob(r.data);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return new WithHeaders(octets, { "Content-Type": r.mime, "Cache-Control": AVATAR_CACHE, "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "cross-origin" });
  }

  // --- Administration -------------------------------------------------------------------------------------------------------------
  const confirme = (corps: Record<string, unknown>) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };
  const iso = (t: number) => new Date(t).toISOString();

  async function nomDe(kind: GenreImage, owner: string): Promise<{ nom: string; ref: string } | null> {
    if (kind === "joueur") {
      const r = await db.first<{ name: string; ref: string | null }>("SELECT name, ref FROM players WHERE id = ?", [owner]);
      return r ? { nom: r.name, ref: r.ref ?? "" } : null;
    }
    const g = await proprietaires[kind]?.trouver(db, owner); // un groupe : sa référence publique est son identifiant
    return g ? { nom: g.nom, ref: g.ref } : null;
  }

  async function listerAdmin(): Promise<unknown> {
    const colonnes = "a.kind AS kind, a.owner AS owner, a.hash AS hash, a.statut AS statut, a.revu AS revu, a.maj_le AS maj_le, (SELECT COUNT(*) FROM avatar_signalements s WHERE s.kind = a.kind AND s.owner = a.owner AND s.hash = a.hash AND s.traite = 0) AS signalements, EXISTS (SELECT 1 FROM avatar_interdits i WHERE i.kind = a.kind AND i.owner = a.owner) AS interdit";
    type Ligne = { kind: GenreImage; owner: string; hash: string; statut: string; revu: number; maj_le: number; signalements: number; interdit: number };
    // Les masquées d'abord (index partiel), puis les visibles qui ont des signalements (en attente), puis les nouvelles à regarder (index partiel).
    const masquees = await db.all<Ligne>(`SELECT ${colonnes} FROM avatars a WHERE a.statut = 'masque' ORDER BY a.maj_le DESC LIMIT ?`, [IMAGES_ADMIN_PAR_LISTE]);
    const nouvelles = await db.all<Ligne>(`SELECT ${colonnes} FROM avatars a WHERE a.statut = 'visible' AND a.revu = 0 ORDER BY a.maj_le DESC LIMIT ?`, [IMAGES_ADMIN_PAR_LISTE]);
    const vers = async (l: Ligne) => {
      const n = await nomDe(l.kind, l.owner);
      return { kind: l.kind, ref: l.kind === "joueur" ? (n?.ref ?? "") : l.owner, nom: n?.nom ?? null, hash: l.hash, statut: l.statut, signalements: l.signalements, interdit: l.interdit === 1, majLe: iso(l.maj_le) };
    };
    const signalees = [...masquees, ...nouvelles.filter((l) => l.signalements > 0)];
    return {
      signalees: await Promise.all(signalees.map(vers)),
      nouvelles: await Promise.all(nouvelles.filter((l) => l.signalements === 0).map(vers)),
      max: IMAGES_ADMIN_PAR_LISTE,
    };
  }

  async function octetsAdmin(kind: GenreImage, ref: string): Promise<WithHeaders> {
    const cible = await proprietaires[kind]!.trouver(db, ref);
    const r = cible ? await db.first<{ mime: string; data: string }>("SELECT mime, data FROM avatars WHERE kind = ? AND owner = ? AND statut <> 'retire'", [kind, cible.owner]) : null;
    if (!r) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    const binaire = atob(r.data);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return new WithHeaders(octets, { "Content-Type": r.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  }

  async function agir(action: "garder" | "retirer" | "interdire" | "autoriser", kind: GenreImage, ref: string, admin: string, corps: Record<string, unknown>): Promise<unknown> {
    confirme(corps);
    const cible = await proprietaires[kind]!.trouver(db, ref);
    if (!cible) throw new HttpError(404, "unknown_avatar", "Pas d'image");
    const image = await db.first<LigneImage>("SELECT * FROM avatars WHERE kind = ? AND owner = ?", [kind, cible.owner]);
    const t = now();
    const quoi = `image ${kind} · ${cible.nom} · ${cible.ref}`;
    if (action === "interdire" || action === "autoriser") {
      const deja = !!(await db.first("SELECT 1 AS x FROM avatar_interdits WHERE kind = ? AND owner = ?", [kind, cible.owner]));
      if (deja === (action === "interdire")) throw new HttpError(400, "invalid_action", "Rien à changer");
      await ecrire([
        action === "interdire" ? { sql: "INSERT INTO avatar_interdits (kind, owner, cree_le) VALUES (?, ?, ?)", params: [kind, cible.owner, t] } : { sql: "DELETE FROM avatar_interdits WHERE kind = ? AND owner = ?", params: [kind, cible.owner] },
        ecrireJournal({ at: t, admin, action: action === "interdire" ? "interdire l'envoi d'images" : "lever l'interdiction d'images", cible: quoi }),
      ]);
      return { interdit: action === "interdire" };
    }
    if (!image || image.statut === "retire") throw new HttpError(404, "unknown_avatar", "Pas d'image");
    if (action === "garder") {
      // Elle reste (ou redevient) visible ; ses signalements ne comptent plus (ils restent, traités : le même signalant ne peut pas la resignaler).
      await ecrire([
        { sql: "UPDATE avatars SET statut = 'visible', revu = 1, maj_le = maj_le WHERE kind = ? AND owner = ?", params: [kind, cible.owner] },
        { sql: "UPDATE avatar_signalements SET traite = 1 WHERE kind = ? AND owner = ? AND hash = ?", params: [kind, cible.owner, image.hash] },
        proprietaires[kind]!.copier(cible.owner, image.hash),
        ecrireJournal({ at: t, admin, action: "garder une image", cible: quoi, avant: { statut: image.statut }, apres: { statut: "visible" } }),
      ]);
      return { statut: "visible" };
    }
    // Retirer : retour aux initiales, les octets sont effacés (la ligne reste, avec le jour : le changement du jour est compté).
    await ecrire([
      { sql: "UPDATE avatars SET statut = 'retire', data = '', revu = 1, maj_le = ? WHERE kind = ? AND owner = ?", params: [t, kind, cible.owner] },
      { sql: "UPDATE avatar_signalements SET traite = 1 WHERE kind = ? AND owner = ? AND hash = ?", params: [kind, cible.owner, image.hash] },
      proprietaires[kind]!.copier(cible.owner, null),
      ecrireJournal({ at: t, admin, action: "retirer une image", cible: quoi, avant: { statut: image.statut }, apres: { statut: "retire" } }),
    ]);
    return { statut: "retire" };
  }

  /** `reste` : ce qui suit `/api/admin/` ; `undefined` : pas aux images. */
  async function routeAdmin(reste: string, req: Request, _admin: string, lire: () => Promise<Record<string, unknown>>): Promise<unknown> {
    const admin = _admin;
    if (reste === "images") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await listerAdmin();
    }
    const m = /^images\/([a-z]+)\/([^/]+)(?:\/(garder|retirer|interdire|autoriser))?$/.exec(reste);
    if (!m) return undefined;
    const kind = genre(m[1]!);
    if (!m[3]) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await octetsAdmin(kind, m[2]!);
    }
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
    return await agir(m[3] as "garder" | "retirer" | "interdire" | "autoriser", kind, m[2]!, admin, await lire());
  }

  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/avatar") {
      if (req.method === "POST") return await envoyer(req, info);
      if (req.method === "DELETE") return await retirerLaSienne(req, info);
      throw new HttpError(405, "method_not_allowed", "POST ou DELETE attendu");
    }
    if (path === "/api/avatar/signaler") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await signaler(req, info);
    }
    const m = /^\/api\/avatars\/([^/]+)$/.exec(path);
    if (m) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await lire(req, info, m[1]!);
    }
    if (path.startsWith("/api/avatar/") || path.startsWith("/api/avatars/")) throw new HttpError(404, "not_found", "Route inconnue");
    return undefined;
  }

  return { route, routeAdmin, poser, signalerUne, empreinte, sha256Hex };
}

export type Avatars = ReturnType<typeof createAvatars>;
