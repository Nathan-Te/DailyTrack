import { HttpError } from "./errors";
import type { Platform, RequestInfo } from "./games";
import { nameKey } from "./pseudos";
import { refOfPlayer, sha256Hex, REF_LENGTH, type PlayerRow } from "./players";
import { rangEntreAmis, type ClassementDuJour, type LigneDuJour } from "./classementDuJour";
import { creerClassementAmis, type FormatClassement } from "./classementAmis";
import type { VuePartagee } from "./portail";

// Les amis (lot F2 de la plateforme) : `joueur` voit les temps de `ami`. README : `docs/plateforme/lots/lot-F2-amis.md` ; règles : `apps/api/CLAUDE.md`, « Amis (lot F2) ».
//
//   GET    /api/amis                        ta liste (masqués écartés, tri par pseudo), le compteur, la place du lien d'invitation
//   POST   /api/amis { ref } | { pseudo }   ajouter un joueur (sens unique : il n'est pas prévenu)
//   DELETE /api/amis/<ref>                  le retirer (sa ligne à toi seulement ; idempotent)
//   GET    /api/amis/suggestions?q=         jusqu'à 5 joueurs actifs dont le pseudo commence par `q` (3 lettres au moins)
//   POST   /api/amis/invitation             crée ou renouvelle ton lien (le jeton n'est rendu qu'ici ; le serveur n'en garde que l'empreinte)
//   POST   /api/amis/invitation/voir        { jeton } → le pseudo de l'invitant
//   POST   /api/amis/invitation/accepter    { jeton, pseudo? } → amitié réciproque (le profil est créé si besoin)
//   GET    /api/amis/fiche/<ref>?date=      la feuille d'un joueur (planche C) : ses temps du jour
//   (+ le filtre `filtre=amis` des quatre classements : `classementAmis.ts`)
//
// Une amitié relie deux **joueurs** (leurs identifiants internes), pas deux pseudos. La référence publique d'un joueur est `players.ref` (12 hexadécimaux de l'empreinte SHA-256 de son identifiant
// secret : à sens unique, déjà publique dans les classements) ; **l'identifiant secret ne sort jamais**, il n'est lu que dans l'en-tête `X-Player-Id`. Un joueur masqué (`players.hidden = 1`)
// a le même visage qu'un joueur inconnu. Rien de personnel dans les journaux.

/** Amis au plus par joueur (les lignes de la table, masqués compris). */
export const AMIS_MAX = 100;
export const SUGGESTIONS_MAX = 5;
/** Lettres au moins pour chercher un pseudo (moins : liste vide, sans rien lire). */
export const SUGGESTIONS_LETTRES_MIN = 3;
/** Un joueur actif = un résultat classé (Track, Jump ou Tower) dans les 30 derniers jours (aujourd'hui compris). */
export const SUGGESTIONS_JOURS = 30;
/** Pseudos lus au plus pour une recherche (borne le coût d'un début de pseudo très courant : le résultat est alors le début de l'ordre alphabétique). */
export const SUGGESTIONS_CANDIDATS = 300;
/** Octets aléatoires d'un jeton d'invitation (18 octets = 144 bits = 24 caractères en base64url). */
export const JETON_OCTETS = 18;
const FORMAT_JETON = /^[A-Za-z0-9_-]{24}$/;
const FORMAT_REF = new RegExp(`^[0-9a-f]{${REF_LENGTH}}$`, "i");

// Limites de débit (par fenêtre de 10 minutes, `platform.limits`) : par adresse (`hitAddress` / `readHitAddress` : l'adresse de connexion compte aussi) et par joueur.
export const AMIS_LECTURES_PAR_ADRESSE = 120;
export const AMIS_LECTURES_PAR_JOUEUR = 60;
export const AMIS_CLASSEMENTS_PAR_ADRESSE = 300;
export const AMIS_INVITATIONS_PAR_JOUEUR = 10;
/** Profils créés par une invitation acceptée, par adresse et par fenêtre (un profil sans résultat réserve un pseudo : plus strict qu'un envoi). */
export const AMIS_PROFILS_PAR_ADRESSE = 5;

/** Un ami tel que les listes le montrent. */
export interface AmiVu {
  ref: string;
  pseudo: string;
  /** Lot C1 : l'empreinte de son image (absente : ses initiales). */
  avatar?: string;
  /** Lui aussi t'a pour ami (invitation acceptée, ou il t'a ajouté de son côté). */
  reciproque: boolean;
  origine: "ajout" | "invitation";
}

/** Un ami lu en base (l'identifiant interne ne sort jamais de ce module et du classement filtré). */
export interface AmiLu {
  id: string;
  name: string;
  ref: string;
  avatar?: string | null;
}

/** Ce que le classement filtré lit des amitiés. */
export interface AmisLecture {
  /** Les amis non masqués d'un joueur, par ordre de pseudo, avec leur pseudo et leur référence. Une requête. */
  liste(id: string): Promise<AmiLu[]>;
}

/** Ce que le portail demande aux amis (« 3e entre amis » de la tuile d'accueil). */
export interface AmisPourPortail {
  rangCumul(id: string, c: ClassementDuJour, bilan: LigneDuJour): Promise<{ rang: number; sur: number } | null>;
}

const base64url = (octets: Uint8Array): string => btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function createAmis(platform: Platform, vue: () => VuePartagee) {
  const { db, now, log, limits, players, hashKey, hit, readHit, hitAddress, readHitAddress, readJson, playerIdOf } = platform;

  // --- Aides ---------------------------------------------------------------------------------------------------------------------
  /** L'identifiant secret du joueur, lu dans l'en-tête `X-Player-Id` (jamais dans l'adresse). */
  const idDe = (req: Request): string => playerIdOf(req.headers.get("x-player-id"));

  /** Le joueur existe sur le serveur et son code est valide (410 `code_revoked`, 404 `unknown_player`). */
  async function joueurActif(id: string): Promise<PlayerRow> {
    await players.assertActive(id);
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    return row;
  }

  async function limiterEcriture(info: RequestInfo, id: string, ip: string, joueur: string, parJoueur = limits.perPlayer): Promise<void> {
    await hitAddress(info, ip, limits.perClient);
    await hit(await hashKey(joueur, id), parJoueur);
  }
  async function limiterLecture(info: RequestInfo, id: string | null, ip: string, joueur: string, parAdresse: number, parJoueur: number): Promise<void> {
    await readHitAddress(info, ip, parAdresse);
    if (id) readHit(await hashKey(joueur, id), parJoueur);
  }

  const refDe = async (id: string, ref: string | null): Promise<string> => ref ?? (await refOfPlayer(id));

  /** Les amis d'un joueur (masqués écartés), avec la réciprocité. Une requête ; tri par pseudo (sans accents ni casse). */
  async function listeComplete(id: string): Promise<(AmiLu & { origine: "ajout" | "invitation"; reciproque: boolean })[]> {
    const rows = await db.all<{ id: string; name: string; ref: string | null; avatar: string | null; origine: string; reciproque: number }>(
      `SELECT a.ami AS id, p.name AS name, p.ref AS ref, p.avatar AS avatar, a.origine AS origine,
              EXISTS (SELECT 1 FROM amities b WHERE b.joueur = a.ami AND b.ami = a.joueur) AS reciproque
         FROM amities a JOIN players p ON p.id = a.ami
        WHERE a.joueur = ? AND p.hidden = 0
        ORDER BY p.name_key`,
      [id],
    );
    return Promise.all(rows.map(async (r) => ({ id: r.id, name: r.name, ref: await refDe(r.id, r.ref), avatar: r.avatar, origine: r.origine === "invitation" ? ("invitation" as const) : ("ajout" as const), reciproque: r.reciproque === 1 })));
  }

  const lecture: AmisLecture = {
    async liste(id) {
      const rows = await db.all<{ id: string; name: string; ref: string | null }>(
        "SELECT a.ami AS id, p.name AS name, p.ref AS ref FROM amities a JOIN players p ON p.id = a.ami WHERE a.joueur = ? AND p.hidden = 0 ORDER BY p.name_key",
        [id],
      );
      return Promise.all(rows.map(async (r) => ({ id: r.id, name: r.name, ref: await refDe(r.id, r.ref) })));
    },
  };

  /** Combien d'amis voit-on dans sa liste (les masqués n'y figurent pas). */
  async function totalVisible(id: string): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM amities a JOIN players p ON p.id = a.ami WHERE a.joueur = ? AND p.hidden = 0", [id]))?.n ?? 0;
  }

  /** Les lignes d'une liste (masqués compris) : ce qui borne à `AMIS_MAX`. */
  async function lignes(id: string): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM amities WHERE joueur = ?", [id]))?.n ?? 0;
  }

  /** L'origine de la ligne `joueur → ami`, ou `null` si elle n'existe pas. */
  async function origineDe(joueur: string, ami: string): Promise<"ajout" | "invitation" | null> {
    const r = await db.first<{ origine: string }>("SELECT origine FROM amities WHERE joueur = ? AND ami = ?", [joueur, ami]);
    return r ? (r.origine === "invitation" ? "invitation" : "ajout") : null;
  }

  /**
   * L'ajout d'une ligne, **sous la limite** : le plafond est vérifié au moment d'écrire (la ligne n'est insérée que si `joueur` a moins de `AMIS_MAX` lignes), pas seulement avant — deux ajouts
   * simultanés ne dépassent donc jamais 100. `ON CONFLICT DO NOTHING` : une ligne qui existe déjà garde son origine et sa date.
   */
  const AJOUT_SOUS_LA_LIMITE = "INSERT INTO amities (joueur, ami, origine, cree_le) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM amities WHERE joueur = ?) < ? ON CONFLICT (joueur, ami) DO NOTHING";

  /** Un joueur par sa référence publique (12 hexadécimaux) : `null` s'il est inconnu **ou masqué** (un seul visage). */
  async function parRef(ref: string): Promise<{ id: string; name: string; ref: string; avatar: string | null } | null> {
    const r = await db.first<{ id: string; name: string; hidden: number; avatar: string | null }>("SELECT id, name, hidden, avatar FROM players WHERE ref = ?", [ref.toLowerCase()]);
    return r && r.hidden === 0 ? { id: r.id, name: r.name, ref: ref.toLowerCase(), avatar: r.avatar } : null;
  }

  function refValide(x: unknown): string {
    if (typeof x !== "string" || !FORMAT_REF.test(x)) throw new HttpError(400, "invalid_friend", "Référence d'ami invalide");
    return x.toLowerCase();
  }

  /** La cible d'un ajout : `{ ref }` **ou** `{ pseudo }` (exact, sans casse ni accents). Inconnu ou masqué : 404 `unknown_friend`. */
  async function cible(body: Record<string, unknown>): Promise<{ id: string; name: string; ref: string }> {
    const parRefDemandee = body.ref !== undefined;
    const parPseudoDemande = body.pseudo !== undefined;
    if (parRefDemandee === parPseudoDemande) throw new HttpError(400, "invalid_friend", "Donne une référence ou un pseudo, pas les deux");
    let trouve: { id: string; name: string; ref: string } | null;
    if (parRefDemandee) trouve = await parRef(refValide(body.ref));
    else {
      if (typeof body.pseudo !== "string" || body.pseudo.length > 64) throw new HttpError(400, "invalid_friend", "Pseudo d'ami invalide");
      const cle = nameKey(body.pseudo);
      if (!cle) throw new HttpError(400, "invalid_friend", "Pseudo d'ami invalide");
      const r = await db.first<{ id: string; name: string; ref: string | null; hidden: number }>("SELECT id, name, ref, hidden FROM players WHERE name_key = ?", [cle]);
      trouve = r && r.hidden === 0 ? { id: r.id, name: r.name, ref: await refDe(r.id, r.ref) } : null;
    }
    if (!trouve) throw new HttpError(404, "unknown_friend", "Aucun joueur pour cette référence ou ce pseudo");
    return trouve;
  }

  // --- Les routes ----------------------------------------------------------------------------------------------------------------
  async function liste(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterLecture(info, id, "amlip", "aml", AMIS_LECTURES_PAR_ADRESSE, AMIS_LECTURES_PAR_JOUEUR);
    await joueurActif(id);
    const [amis, invitation] = await Promise.all([listeComplete(id), db.first("SELECT 1 AS x FROM invitations_amis WHERE joueur = ?", [id])]);
    const vus: AmiVu[] = amis.map((a) => ({ ref: a.ref, pseudo: a.name, ...(a.avatar ? { avatar: a.avatar } : {}), reciproque: a.reciproque, origine: a.origine }));
    return { amis: vus, total: vus.length, max: AMIS_MAX, invitation: { active: invitation !== null } };
  }

  async function ajouter(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterEcriture(info, id, "amwip", "amw");
    const body = await readJson(req);
    await joueurActif(id);
    const ami = await cible(body);
    if (ami.id === id) throw new HttpError(400, "friend_self", "On ne s'ajoute pas soi-même");
    const t = now();
    const ajoute = await db.first<{ ami: string }>(`${AJOUT_SOUS_LA_LIMITE} RETURNING ami`, [id, ami.id, "ajout", t, id, AMIS_MAX]);
    if (!ajoute) {
      // Rien d'écrit : ou bien la ligne existait déjà, ou bien la liste est pleine (l'ordre compte : une liste pleine qui contient déjà cet ami dit « déjà »).
      if (await origineDe(id, ami.id)) throw new HttpError(409, "friend_exists", "Déjà dans ta liste");
      throw new HttpError(409, "friends_full", "Ta liste d'amis est pleine");
    }
    const [reciproque, total] = await Promise.all([origineDe(ami.id, id), totalVisible(id)]);
    const vu: AmiVu = { ref: ami.ref, pseudo: ami.name, reciproque: reciproque !== null, origine: "ajout" };
    return { ami: vu, total };
  }

  async function retirer(req: Request, info: RequestInfo, refBrute: string): Promise<unknown> {
    const id = idDe(req);
    await limiterEcriture(info, id, "amwip", "amw");
    const ref = refValide(refBrute);
    await joueurActif(id);
    // Sa ligne à toi seulement ; une référence inconnue (ou d'un joueur qui n'est pas ton ami) ne change rien : idempotent, et rien n'est appris sur les autres joueurs.
    await db.run("DELETE FROM amities WHERE joueur = ? AND ami = (SELECT id FROM players WHERE ref = ?)", [id, ref]);
    return { total: await totalVisible(id) };
  }

  async function suggestions(req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterLecture(info, id, "amsip", "ams", AMIS_LECTURES_PAR_ADRESSE, AMIS_LECTURES_PAR_JOUEUR);
    const cle = nameKey(url.searchParams.get("q") ?? "");
    if ([...cle].length < SUGGESTIONS_LETTRES_MIN || cle.length > 64) return { suggestions: [] };
    await joueurActif(id);
    const depuis = platform.today() - SUGGESTIONS_JOURS + 1;
    const rows = await db.all<{ id: string; name: string; ref: string | null }>(
      `SELECT c.id AS id, c.name AS name, c.ref AS ref FROM (
         SELECT id, name, ref, name_key FROM players WHERE name_key >= ? AND name_key < ? AND hidden = 0 AND id <> ? ORDER BY name_key LIMIT ?
       ) c
       WHERE NOT EXISTS (SELECT 1 FROM amities a WHERE a.joueur = ? AND a.ami = c.id)
         AND (EXISTS (SELECT 1 FROM results r WHERE r.player_id = c.id AND r.day >= ? AND r.hidden = 0)
           OR EXISTS (SELECT 1 FROM jump_results j WHERE j.player_id = c.id AND j.day >= ? AND j.hidden = 0)
           OR EXISTS (SELECT 1 FROM tower_results t WHERE t.player_id = c.id AND t.day >= ? AND t.hidden = 0))
       ORDER BY c.name_key LIMIT ?`,
      [cle, `${cle}￿`, id, SUGGESTIONS_CANDIDATS, id, depuis, depuis, depuis, SUGGESTIONS_MAX],
    );
    return { suggestions: await Promise.all(rows.map(async (r) => ({ ref: await refDe(r.id, r.ref), pseudo: r.name }))) };
  }

  // --- Le lien d'invitation ------------------------------------------------------------------------------------------------------
  function jetonValide(x: unknown): string {
    if (typeof x !== "string" || !FORMAT_JETON.test(x)) throw new HttpError(404, "invalid_invitation", "Lien d'invitation invalide");
    return x;
  }

  /** L'invitant d'un jeton : inconnu, renouvelé ou masqué → 404 `invalid_invitation` (un seul visage). */
  async function invitant(jeton: string): Promise<{ id: string; name: string; ref: string }> {
    const r = await db.first<{ id: string; name: string; ref: string | null; hidden: number }>(
      "SELECT p.id AS id, p.name AS name, p.ref AS ref, p.hidden AS hidden FROM invitations_amis i JOIN players p ON p.id = i.joueur WHERE i.empreinte = ?",
      [await sha256Hex(jeton)],
    );
    if (!r || r.hidden === 1) throw new HttpError(404, "invalid_invitation", "Lien d'invitation invalide");
    return { id: r.id, name: r.name, ref: await refDe(r.id, r.ref) };
  }

  async function creerLien(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterEcriture(info, id, "amnip", "amn", AMIS_INVITATIONS_PAR_JOUEUR);
    await joueurActif(id);
    const jeton = base64url(crypto.getRandomValues(new Uint8Array(JETON_OCTETS)));
    // Un seul lien actif par joueur : « Nouveau lien » remplace l'ancien, qui ne sert plus. Le serveur ne garde que l'empreinte.
    await db.run(
      "INSERT INTO invitations_amis (joueur, empreinte, cree_le) VALUES (?, ?, ?) ON CONFLICT (joueur) DO UPDATE SET empreinte = excluded.empreinte, cree_le = excluded.cree_le",
      [id, await sha256Hex(jeton), now()],
    );
    log("INFO", "amis : lien d'invitation créé");
    return { jeton };
  }

  async function voirLien(req: Request, info: RequestInfo): Promise<unknown> {
    // Une lecture, sans identité (la personne invitée n'a peut-être pas encore de profil) : par adresse seulement.
    await readHitAddress(info, "amvip", AMIS_LECTURES_PAR_ADRESSE);
    const body = await readJson(req);
    const invite = await invitant(jetonValide(body.jeton));
    return { pseudo: invite.name };
  }

  async function accepterLien(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterEcriture(info, id, "amaip", "ama");
    const body = await readJson(req);
    const jeton = jetonValide(body.jeton);
    await players.assertActive(id);
    const invite = await invitant(jeton);
    if (invite.id === id) throw new HttpError(400, "friend_self", "C'est ton propre lien");
    const moi = await players.find(id);
    let pseudo: string | null = null;
    if (!moi) {
      // Sans profil sur le serveur : le pseudo est obligatoire (mêmes règles que partout : `name_required`, `invalid_name`, `name_taken` + suggestions). Rien n'est écrit avant d'avoir vérifié les listes.
      await hitAddress(info, "amkip", AMIS_PROFILS_PAR_ADRESSE);
      pseudo = await players.resolveName(id, body.pseudo, null);
    }
    // Les deux listes sont vérifiées **avant** d'écrire : si l'une est pleine, rien n'est créé (pas même le profil).
    const [monLien, sonLien] = await Promise.all([origineDe(id, invite.id), origineDe(invite.id, id)]);
    if (monLien && sonLien) throw new HttpError(409, "friend_exists", "Vous êtes déjà amis");
    const [mesLignes, sesLignes] = await Promise.all([monLien ? 0 : lignes(id), sonLien ? 0 : lignes(invite.id)]);
    if (!monLien && mesLignes >= AMIS_MAX) throw new HttpError(409, "friends_full", "Ta liste d'amis est pleine");
    if (!sonLien && sesLignes >= AMIS_MAX) throw new HttpError(409, "their_friends_full", "Sa liste d'amis est pleine");
    if (pseudo !== null) await players.save(id, pseudo, null);
    const t = now();
    const instructions = [
      ...(monLien ? [] : [{ sql: AJOUT_SOUS_LA_LIMITE, params: [id, invite.id, "invitation", t, id, AMIS_MAX] }]),
      ...(sonLien ? [] : [{ sql: AJOUT_SOUS_LA_LIMITE, params: [invite.id, id, "invitation", t, invite.id, AMIS_MAX] }]),
    ];
    if (db.batch) await db.batch(instructions);
    else for (const s of instructions) await db.run(s.sql, s.params);
    log("INFO", "amis : invitation acceptée", { profilCree: pseudo !== null });
    const vu: AmiVu = { ref: invite.ref, pseudo: invite.name, reciproque: true, origine: monLien ?? "invitation" };
    return { ami: vu, total: await totalVisible(id) };
  }

  // --- Les classements filtrés et la feuille d'un joueur -------------------------------------------------------------------------
  const classements = creerClassementAmis({
    platform,
    vue,
    amis: lecture,
    joueurActif,
    idDe,
    limiter: (info, id) => limiterLecture(info, id, "amcip", "amc", AMIS_CLASSEMENTS_PAR_ADRESSE, AMIS_LECTURES_PAR_JOUEUR),
    limiterFiche: (info, id) => limiterLecture(info, id, "amfip", "amf", AMIS_LECTURES_PAR_ADRESSE, AMIS_LECTURES_PAR_JOUEUR),
    parRef,
    refValide,
    origineDe,
  });

  /** Valide `filtre` : `amis` ou rien ; toute autre valeur est refusée. */
  function filtreDemande(url: URL): boolean {
    const f = url.searchParams.get("filtre");
    if (f === null) return false;
    if (f !== "amis") throw new HttpError(400, "invalid_filter", "Filtre inconnu : amis attendu");
    return true;
  }

  /** `GET /api/portail/classement?filtre=amis` (les trois vues) ; `undefined` : pas de filtre, c'est le classement « Tous » du portail. */
  async function classementPortail(req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (!filtreDemande(url)) return undefined;
    return classements.classement("portail", req, url, info);
  }

  const MOTIFS_JEUX: Record<string, { format: FormatClassement; motif: RegExp }> = {
    cdj: { format: "cdj", motif: /^\/api\/day\/([^/]+)\/leaderboard$/ },
    jump: { format: "jump", motif: /^\/api\/jump\/day\/([^/]+)\/board$/ },
    tower: { format: "tower", motif: /^\/api\/tower\/day\/([^/]+)\/board$/ },
  };

  /** Le classement d'un jeu avec `filtre=amis` (`api.ts` l'appelle après la garde de l'interrupteur) ; `undefined` : ce n'est pas un classement filtré. Un nouveau jeu ajoute sa ligne à `MOTIFS_JEUX`. */
  async function classementJeu(code: string, path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    const jeu = MOTIFS_JEUX[code];
    const m = jeu?.motif.exec(path);
    if (!jeu || !m || req.method !== "GET" || !url.searchParams.has("filtre")) return undefined;
    filtreDemande(url);
    let date: string;
    try {
      date = decodeURIComponent(m[1]!);
    } catch {
      throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    }
    return classements.classement(jeu.format, req, url, info, { code, date });
  }

  // --- Aiguillage ----------------------------------------------------------------------------------------------------------------
  const GET = (req: Request) => {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
  };
  const POST = (req: Request) => {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
  };

  /** Les routes `/api/amis…` et le classement filtré du portail ; `undefined` : ce chemin n'est pas aux amis. */
  async function route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/portail/classement" && req.method === "GET") return classementPortail(req, url, info);
    if (path !== "/api/amis" && !path.startsWith("/api/amis/")) return undefined;
    if (path === "/api/amis") {
      if (req.method === "GET") return liste(req, info);
      if (req.method === "POST") return ajouter(req, info);
      throw new HttpError(405, "method_not_allowed", "GET ou POST attendu");
    }
    if (path === "/api/amis/suggestions") {
      GET(req);
      return suggestions(req, url, info);
    }
    if (path === "/api/amis/invitation") {
      POST(req);
      return creerLien(req, info);
    }
    if (path === "/api/amis/invitation/voir") {
      POST(req);
      return voirLien(req, info);
    }
    if (path === "/api/amis/invitation/accepter") {
      POST(req);
      return accepterLien(req, info);
    }
    const fiche = /^\/api\/amis\/fiche\/([^/]+)$/.exec(path);
    if (fiche) {
      GET(req);
      return classements.fiche(req, fiche[1]!, url, info);
    }
    const un = /^\/api\/amis\/([^/]+)$/.exec(path);
    if (un && !["invitation", "fiche"].includes(un[1]!)) {
      if (req.method !== "DELETE") throw new HttpError(405, "method_not_allowed", "DELETE attendu");
      return retirer(req, info, un[1]!);
    }
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  const pourPortail: AmisPourPortail = {
    async rangCumul(id, c, bilan) {
      const amis = await db.all<{ ami: string }>("SELECT ami FROM amities WHERE joueur = ?", [id]);
      return amis.length === 0 ? null : rangEntreAmis(c, bilan, amis.map((a) => a.ami));
    },
  };

  return { route, classementJeu, pourPortail, lecture };
}

export type Amis = ReturnType<typeof createAmis>;
