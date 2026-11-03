import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
import { ecrireJournal } from "./journaux";
import { refOfPlayer } from "./players";

// Lot C1, partie A (plateforme) — « Un bug ? Une idée ? » : les retours des joueurs et les réponses de l'éditeur, sans e-mail.
// README : `docs/plateforme/lots/lot-C1-retours-avatars-groupes.md` ; règles : `apps/api/CLAUDE.md`, « Retours (lot C1) ».
//
//   Joueur (identifiant en `X-Player-Id`, jamais dans l'adresse) :
//     GET  /api/retours/contexte            la version en production et le jour (ce que le dialogue montre avant l'envoi) ; avec un identifiant, aussi la référence publique ; `public, max-age=300` (`private` avec identifiant)
//     POST /api/retours                     { type, texte, contexte } → un nouveau fil ; sans identifiant : envoi anonyme (aucune réponse ne pourra lui parvenir)
//     GET  /api/retours                     mes fils (les 50 plus récents), avec le nombre de réponses non lues
//     GET  /api/retours/<id>                un fil : le contexte et les messages
//     POST /api/retours/<id>/messages       { texte } → répondre dans le fil
//     POST /api/retours/<id>/lu             marque les réponses lues (une lecture ne modifie jamais rien : le client le demande après avoir affiché)
//   Administration (session, `X-Cdj-Admin`, `confirmer: true` ; chaque action est inscrite au journal **dans la même transaction**) :
//     GET  /api/admin/retours?type=&jeu=&statut=&page=   la liste (50 par page) et le nombre de non lus
//     GET  /api/admin/retours/compte         le nombre de non lus (le menu)
//     GET  /api/admin/retours/<id>           le fil, le contexte, le joueur (sa référence publique)
//     POST /api/admin/retours/<id>/repondre  { texte }
//     POST /api/admin/retours/<id>/statut    { statut }
//     POST /api/admin/retours/<id>/lu        marque lu (nouveau → lu)
//
// Un texte est un texte : nettoyé (caractères de contrôle ôtés, 1 000 caractères au plus), gardé tel quel, **jamais interprété** ; les clients le posent en `textContent`.
// **Aucune donnée de joueur dans les journaux** (ni texte, ni identifiant, ni adresse). Le contexte joint est une liste fermée de champs vérifiés un à un.

export const TYPES_RETOUR = ["bug", "suggestion", "autre"] as const;
export type TypeRetour = (typeof TYPES_RETOUR)[number];
export const STATUTS_RETOUR = ["nouveau", "lu", "en_cours", "traite", "refuse"] as const;
export type StatutRetour = (typeof STATUTS_RETOUR)[number];

/** Caractères d'un message (les points de code : un émoji compte pour un). */
export const RETOUR_TEXTE_MAX = 1000;
/** Nouveaux fils par joueur et par jour de Paris. */
export const RETOURS_PAR_JOUR = 5;
/** Envois par adresse et par fenêtre de débit (10 minutes) ; un envoi sans profil, moins encore. */
export const RETOURS_PAR_ADRESSE = 10;
export const RETOURS_ANONYMES_PAR_ADRESSE = 3;
/** Messages au plus dans un fil (les deux côtés). */
export const RETOUR_MESSAGES_MAX = 100;
/** Fils montrés au joueur, et par page dans le panneau. */
export const RETOURS_DU_JOUEUR = 50;
export const RETOURS_PAR_PAGE = 50;
/** Un fil est effacé 12 mois après son dernier message (entretien horaire, `journaux.ts`). */
export const RETOURS_GARDE_JOURS = 365;
/** Lectures par adresse et par joueur et par fenêtre de débit. */
export const RETOURS_LECTURES_PAR_ADRESSE = 120;
export const RETOURS_LECTURES_PAR_JOUEUR = 60;
export const RETOURS_ECRITURES_PAR_JOUEUR = 30;

const JOUR_MS = 86_400_000;
const FAMILLES_NAVIGATEUR = ["chrome", "firefox", "safari", "edge", "opera", "autre"] as const;
const FAMILLES_SYSTEME = ["windows", "macos", "linux", "android", "ios", "autre"] as const;

/** Le contexte joint à un retour : champs fermés, chacun vérifié (un champ inconnu est ignoré, un champ invalide est abandonné). Montré au joueur avant l'envoi. */
export interface ContexteRetour {
  /** `portail`, `track`, `jump`, `tower` : le dossier du site d'où part le retour. */
  jeu: string;
  /** Le chemin de la page (sans paramètres), `/track/`. */
  page: string;
  /** Le jour affiché (AAAA-MM-JJ). */
  jour: string;
  /** La version en production : ajoutée par le serveur. */
  version: string;
  navigateur: (typeof FAMILLES_NAVIGATEUR)[number];
  systeme: (typeof FAMILLES_SYSTEME)[number];
  /** Taille de l'écran en pixels, `390x844`. */
  ecran: string;
  langue: "fr" | "en";
}

/** Nettoie un texte libre : normalisé, sans caractère de contrôle (les retours à la ligne restent), les lignes vides en fin ôtées. `null` s'il est vide ou trop long. */
export function nettoyerTexte(brut: unknown, max = RETOUR_TEXTE_MAX): string | null {
  if (typeof brut !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const t = brut.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length === 0 || [...t].length > max) return null;
  return t;
}

/** Le contexte d'un envoi : tout champ qui n'est pas dans sa liste fermée est écarté ; `version` vient du serveur. */
export function nettoyerContexte(brut: unknown, version: string, aujourdhui: string): ContexteRetour {
  const c = brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  const texte = (x: unknown, re: RegExp): string | null => (typeof x === "string" && re.test(x) ? x : null);
  const parmi = <T extends string>(x: unknown, liste: readonly T[]): T => (typeof x === "string" && (liste as readonly string[]).includes(x) ? (x as T) : (liste[liste.length - 1] as T));
  return {
    jeu: texte(c.jeu, /^[a-z0-9-]{2,20}$/) ?? "portail",
    page: texte(c.page, /^\/[A-Za-z0-9/_-]{0,58}$/) ?? "/",
    jour: texte(c.jour, /^\d{4}-\d{2}-\d{2}$/) ?? aujourdhui,
    version,
    navigateur: parmi(c.navigateur, FAMILLES_NAVIGATEUR),
    systeme: parmi(c.systeme, FAMILLES_SYSTEME),
    ecran: texte(c.ecran, /^\d{2,5}x\d{2,5}$/) ?? "0x0",
    langue: c.langue === "en" ? "en" : "fr",
  };
}

export interface RetoursOptions {
  /** La version en production (`RELEASE_TAG`, sinon la révision) : ajoutée par le serveur au contexte. */
  version: string;
}

interface LigneFil {
  id: number;
  player_id: string | null;
  ref: string | null;
  type: string;
  jeu: string;
  statut: string;
  contexte: string;
  cree_le: number;
  maj_le: number;
  non_lu_joueur: number;
  non_lu_admin: number;
  nb_messages: number;
}
interface LigneMessage {
  auteur: string;
  texte: string;
  cree_le: number;
}

type Corps = Record<string, unknown>;

export function createRetours(platform: Platform, options: RetoursOptions) {
  const { db, now, log, limits, players, hashKey, hit, readHit, hitAddress, readHitAddress, readJson, playerIdOf } = platform;
  const idOptionnel = (req: Request): string | null => {
    const brut = req.headers.get("x-player-id");
    return brut === null || brut === "" ? null : playerIdOf(brut);
  };
  const idDe = (req: Request): string => playerIdOf(req.headers.get("x-player-id"));
  const iso = (t: number) => new Date(t).toISOString();
  const jsonDe = (v: string): unknown => {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  function identifiantDuFil(brut: string): number {
    if (!/^\d{1,9}$/.test(brut)) throw new HttpError(404, "unknown_feedback", "Ce fil n'existe pas");
    return Number(brut);
  }

  function typeValide(x: unknown): TypeRetour {
    if (typeof x !== "string" || !(TYPES_RETOUR as readonly string[]).includes(x)) throw new HttpError(400, "invalid_feedback", "Type attendu : bug, suggestion ou autre");
    return x as TypeRetour;
  }
  function texteValide(x: unknown): string {
    const t = nettoyerTexte(x);
    if (t === null) throw new HttpError(400, "invalid_feedback", `Message de 1 à ${RETOUR_TEXTE_MAX} caractères attendu`);
    return t;
  }

  async function limiterLecture(info: RequestInfo, id: string | null): Promise<void> {
    await readHitAddress(info, "rtlip", RETOURS_LECTURES_PAR_ADRESSE);
    if (id) readHit(await hashKey("rtl", id), RETOURS_LECTURES_PAR_JOUEUR);
  }

  // --- Côté joueur ---------------------------------------------------------------------------------------------------------------
  /** Un fil du joueur : le sien seulement (un autre joueur, ou un envoi anonyme : un seul visage, `unknown_feedback`). */
  async function filDuJoueur(id: string, brut: string): Promise<LigneFil> {
    const n = identifiantDuFil(brut);
    const f = await db.first<LigneFil>("SELECT * FROM retours WHERE id = ?", [n]);
    if (!f || f.player_id !== id) throw new HttpError(404, "unknown_feedback", "Ce fil n'existe pas");
    return f;
  }

  /** Sans identifiant : la version et le jour, cache public. Avec : et la **référence publique** du joueur (ce que le dialogue montre), cache du navigateur seulement (`Vary`). */
  async function contexte(req: Request): Promise<WithHeaders> {
    const id = idOptionnel(req);
    const corps = { version: options.version, jour: formatDay(platform.today()) };
    if (id === null) return new WithHeaders(corps, { "Cache-Control": "public, max-age=300" });
    await players.assertActive(id);
    return new WithHeaders({ ...corps, reference: await refOfPlayer(id) }, { "Cache-Control": "private, max-age=300", Vary: "X-Player-Id" });
  }

  async function envoyer(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idOptionnel(req);
    await hitAddress(info, "rtip", RETOURS_PAR_ADRESSE);
    if (id === null) await hitAddress(info, "rtanip", RETOURS_ANONYMES_PAR_ADRESSE);
    else {
      await players.assertActive(id);
      await hit(await hashKey("rtw", id), limits.perPlayer);
    }
    const corps = await readJson(req);
    const type = typeValide(corps.type);
    const texte = texteValide(corps.texte);
    const ctx = nettoyerContexte(corps.contexte, options.version, formatDay(platform.today()));
    const t = now();
    const debutDuJour = parisDayStart(platform.today());
    let ligne: { id: number } | null;
    if (id === null) {
      ligne = await db.first<{ id: number }>(
        "INSERT INTO retours (player_id, ref, type, jeu, statut, contexte, cree_le, maj_le, non_lu_joueur, non_lu_admin, nb_messages) VALUES (NULL, NULL, ?, ?, 'nouveau', ?, ?, ?, 0, 1, 1) RETURNING id",
        [type, ctx.jeu, JSON.stringify(ctx), t, t],
      );
    } else {
      // Au plus `RETOURS_PAR_JOUR` nouveaux fils par joueur et par jour de Paris : la limite est vérifiée **au moment d'écrire** (deux envois simultanés ne la dépassent pas).
      ligne = await db.first<{ id: number }>(
        "INSERT INTO retours (player_id, ref, type, jeu, statut, contexte, cree_le, maj_le, non_lu_joueur, non_lu_admin, nb_messages) SELECT ?, ?, ?, ?, 'nouveau', ?, ?, ?, 0, 1, 1 WHERE (SELECT COUNT(*) FROM retours WHERE player_id = ? AND cree_le >= ?) < ? RETURNING id",
        [id, await refOfPlayer(id), type, ctx.jeu, JSON.stringify(ctx), t, t, id, debutDuJour, RETOURS_PAR_JOUR],
      );
      if (!ligne) throw new HttpError(429, "feedback_limit", "Tu as déjà envoyé 5 retours aujourd'hui", { "Retry-After": String(Math.max(1, Math.ceil((parisDayStart(platform.today() + 1) - t) / 1000))) });
    }
    if (!ligne) throw new HttpError(500, "internal", "Insertion sans identifiant");
    await db.run("INSERT INTO retours_messages (retour_id, auteur, texte, cree_le) VALUES (?, 'joueur', ?, ?)", [ligne.id, texte, t]);
    log("INFO", "retours : retour reçu", { type, anonyme: id === null }); // ni texte, ni identifiant, ni adresse
    return { id: ligne.id, reponsePossible: id !== null };
  }

  async function mesFils(req: Request, info: RequestInfo): Promise<unknown> {
    const id = idDe(req);
    await limiterLecture(info, id);
    await players.assertActive(id);
    const rows = await db.all<LigneFil & { apercu: string }>(
      `SELECT f.*, (SELECT texte FROM retours_messages m WHERE m.retour_id = f.id ORDER BY m.id DESC LIMIT 1) AS apercu
         FROM retours f WHERE f.player_id = ? ORDER BY f.maj_le DESC LIMIT ?`,
      [id, RETOURS_DU_JOUEUR],
    );
    return {
      fils: rows.map((f) => ({ id: f.id, type: f.type, jeu: f.jeu, statut: f.statut, creeLe: iso(f.cree_le), majLe: iso(f.maj_le), nonLu: f.non_lu_joueur === 1, messages: f.nb_messages, apercu: [...(f.apercu ?? "")].slice(0, 120).join("") })),
      nonLus: rows.filter((f) => f.non_lu_joueur === 1).length,
    };
  }

  async function unFil(req: Request, info: RequestInfo, brut: string): Promise<unknown> {
    const id = idDe(req);
    await limiterLecture(info, id);
    await players.assertActive(id);
    const f = await filDuJoueur(id, brut);
    const messages = await db.all<LigneMessage>("SELECT auteur, texte, cree_le FROM retours_messages WHERE retour_id = ? ORDER BY id LIMIT ?", [f.id, RETOUR_MESSAGES_MAX]);
    return {
      id: f.id,
      type: f.type,
      jeu: f.jeu,
      statut: f.statut,
      creeLe: iso(f.cree_le),
      contexte: jsonDe(f.contexte),
      nonLu: f.non_lu_joueur === 1,
      peutRepondre: f.nb_messages < RETOUR_MESSAGES_MAX,
      messages: messages.map((m) => ({ auteur: m.auteur === "admin" ? "admin" : "joueur", texte: m.texte, creeLe: iso(m.cree_le) })),
    };
  }

  async function repondre(req: Request, info: RequestInfo, brut: string): Promise<unknown> {
    const id = idDe(req);
    await hitAddress(info, "rtrip", RETOURS_PAR_ADRESSE * 3);
    await hit(await hashKey("rtw", id), limits.perPlayer);
    await players.assertActive(id);
    const texte = texteValide((await readJson(req)).texte);
    const f = await filDuJoueur(id, brut);
    if (f.nb_messages >= RETOUR_MESSAGES_MAX) throw new HttpError(409, "feedback_full", "Ce fil est complet");
    const t = now();
    // Le message et le fil ensemble ; un fil traité ou refusé repart « nouveau » quand le joueur répond (il y a quelque chose à lire).
    const instructions: Statement[] = [
      { sql: "INSERT INTO retours_messages (retour_id, auteur, texte, cree_le) VALUES (?, 'joueur', ?, ?)", params: [f.id, texte, t] },
      { sql: "UPDATE retours SET maj_le = ?, nb_messages = nb_messages + 1, non_lu_admin = 1, statut = CASE WHEN statut IN ('traite', 'refuse') THEN 'nouveau' ELSE statut END WHERE id = ?", params: [t, f.id] },
    ];
    if (db.batch) await db.batch(instructions);
    else for (const s of instructions) await db.run(s.sql, s.params);
    return { ok: true };
  }

  async function marquerLu(req: Request, info: RequestInfo, brut: string): Promise<unknown> {
    const id = idDe(req);
    await hitAddress(info, "rtrip", RETOURS_PAR_ADRESSE * 3);
    await hit(await hashKey("rtw", id), limits.perPlayer);
    await players.assertActive(id);
    const f = await filDuJoueur(id, brut);
    if (f.non_lu_joueur === 1) await db.run("UPDATE retours SET non_lu_joueur = 0 WHERE id = ?", [f.id]);
    return { ok: true };
  }

  /** Réponses non lues d'un joueur : **une lecture indexée** (index partiel), le champ `messagesNonLus` de `GET /api/portail/jour`. */
  async function nonLus(id: string): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours WHERE player_id = ? AND non_lu_joueur = 1", [id]))?.n ?? 0;
  }

  // --- Côté administration -------------------------------------------------------------------------------------------------------
  const confirme = (corps: Corps) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };

  async function compteNonLus(): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours WHERE non_lu_admin = 1"))?.n ?? 0;
  }

  async function pseudoDe(playerId: string | null): Promise<string | null> {
    if (playerId === null) return null;
    return (await db.first<{ name: string }>("SELECT name FROM players WHERE id = ?", [playerId]))?.name ?? null;
  }

  async function lister(url: URL): Promise<unknown> {
    const type = url.searchParams.get("type");
    const jeu = url.searchParams.get("jeu");
    const statut = url.searchParams.get("statut");
    const page = Math.min(1000, Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? 1)) || 1));
    if (type && !(TYPES_RETOUR as readonly string[]).includes(type)) throw new HttpError(400, "invalid_action", "Type inconnu");
    if (statut && !(STATUTS_RETOUR as readonly string[]).includes(statut)) throw new HttpError(400, "invalid_action", "Statut inconnu");
    if (jeu && !/^[a-z0-9-]{2,20}$/.test(jeu)) throw new HttpError(400, "invalid_action", "Jeu inconnu");
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (statut) {
      conditions.push("statut = ?");
      params.push(statut);
    }
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }
    if (jeu) {
      conditions.push("jeu = ?");
      params.push(jeu);
    }
    const lignes = await db.all<LigneFil & { apercu: string; pseudo: string | null }>(
      `SELECT f.*, (SELECT texte FROM retours_messages m WHERE m.retour_id = f.id ORDER BY m.id LIMIT 1) AS apercu,
              (SELECT name FROM players p WHERE p.id = f.player_id) AS pseudo
         FROM retours f${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY f.maj_le DESC LIMIT ? OFFSET ?`,
      [...params, RETOURS_PAR_PAGE + 1, (page - 1) * RETOURS_PAR_PAGE],
    );
    return {
      page,
      parPage: RETOURS_PAR_PAGE,
      suivante: lignes.length > RETOURS_PAR_PAGE,
      nonLus: await compteNonLus(),
      retours: lignes.slice(0, RETOURS_PAR_PAGE).map((f) => ({
        id: f.id,
        type: f.type,
        jeu: f.jeu,
        statut: f.statut,
        creeLe: iso(f.cree_le),
        majLe: iso(f.maj_le),
        nonLu: f.non_lu_admin === 1,
        messages: f.nb_messages,
        ref: f.ref,
        pseudo: f.pseudo,
        apercu: [...(f.apercu ?? "")].slice(0, 120).join(""),
      })),
    };
  }

  async function filAdmin(brut: string): Promise<LigneFil> {
    const f = await db.first<LigneFil>("SELECT * FROM retours WHERE id = ?", [identifiantDuFil(brut)]);
    if (!f) throw new HttpError(404, "unknown_feedback", "Ce fil n'existe pas");
    return f;
  }
  const cibleDe = async (f: LigneFil) => `retour n° ${f.id} · ${(await pseudoDe(f.player_id)) ?? "sans profil"}${f.ref ? ` · ${f.ref}` : ""}`;

  async function detail(brut: string): Promise<unknown> {
    const f = await filAdmin(brut);
    const messages = await db.all<LigneMessage>("SELECT auteur, texte, cree_le FROM retours_messages WHERE retour_id = ? ORDER BY id LIMIT ?", [f.id, RETOUR_MESSAGES_MAX]);
    return {
      id: f.id,
      type: f.type,
      jeu: f.jeu,
      statut: f.statut,
      creeLe: iso(f.cree_le),
      majLe: iso(f.maj_le),
      nonLu: f.non_lu_admin === 1,
      contexte: jsonDe(f.contexte),
      ref: f.ref,
      pseudo: await pseudoDe(f.player_id),
      reponsePossible: f.player_id !== null,
      messages: messages.map((m) => ({ auteur: m.auteur === "admin" ? "admin" : "joueur", texte: m.texte, creeLe: iso(m.cree_le) })),
    };
  }

  async function ecrire(instructions: Statement[]): Promise<void> {
    if (db.batch) await db.batch(instructions);
    else for (const s of instructions) await db.run(s.sql, s.params);
  }

  async function repondreAdmin(admin: string, brut: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const texte = texteValide(corps.texte);
    const f = await filAdmin(brut);
    if (f.player_id === null) throw new HttpError(400, "invalid_action", "Ce retour vient d'un visiteur sans profil : aucune réponse ne peut lui parvenir");
    if (f.nb_messages >= RETOUR_MESSAGES_MAX) throw new HttpError(409, "feedback_full", "Ce fil est complet");
    const t = now();
    const statut = f.statut === "nouveau" ? "lu" : f.statut;
    await ecrire([
      { sql: "INSERT INTO retours_messages (retour_id, auteur, texte, cree_le) VALUES (?, 'admin', ?, ?)", params: [f.id, texte, t] },
      { sql: "UPDATE retours SET maj_le = ?, nb_messages = nb_messages + 1, non_lu_joueur = 1, non_lu_admin = 0, statut = ? WHERE id = ?", params: [t, statut, f.id] },
      // Le journal ne garde jamais le texte de la réponse : seulement sa longueur.
      ecrireJournal({ at: t, admin, action: "répondre à un retour", cible: await cibleDe(f), avant: { statut: f.statut }, apres: { statut, caracteres: [...texte].length } }),
    ]);
    return { ok: true, statut };
  }

  async function changerStatut(admin: string, brut: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    if (typeof corps.statut !== "string" || !(STATUTS_RETOUR as readonly string[]).includes(corps.statut)) throw new HttpError(400, "invalid_action", "Statut attendu : nouveau, lu, en_cours, traite ou refuse");
    const f = await filAdmin(brut);
    if (f.statut === corps.statut) throw new HttpError(400, "invalid_action", "Rien à changer");
    const t = now();
    await ecrire([
      { sql: "UPDATE retours SET statut = ?, non_lu_admin = 0 WHERE id = ?", params: [corps.statut, f.id] },
      ecrireJournal({ at: t, admin, action: "changer le statut d'un retour", cible: await cibleDe(f), avant: { statut: f.statut }, apres: { statut: corps.statut } }),
    ]);
    return { statut: corps.statut };
  }

  async function marquerLuAdmin(admin: string, brut: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const f = await filAdmin(brut);
    if (f.non_lu_admin === 0 && f.statut !== "nouveau") return { statut: f.statut };
    const t = now();
    const statut = f.statut === "nouveau" ? "lu" : f.statut;
    await ecrire([
      { sql: "UPDATE retours SET non_lu_admin = 0, statut = ? WHERE id = ?", params: [statut, f.id] },
      ecrireJournal({ at: t, admin, action: "lire un retour", cible: await cibleDe(f), avant: { statut: f.statut }, apres: { statut } }),
    ]);
    return { statut };
  }

  const methode = (req: Request, attendu: string) => {
    if (req.method !== attendu) throw new HttpError(405, "method_not_allowed", `${attendu} attendu`);
  };

  /** Les routes d'administration (`reste` : ce qui suit `/api/admin/`) ; `undefined` : ce n'est pas aux retours. */
  async function routeAdmin(reste: string, req: Request, url: URL, admin: string, lire: () => Promise<Corps>): Promise<unknown> {
    if (reste === "retours") {
      methode(req, "GET");
      return await lister(url);
    }
    if (reste === "retours/compte") {
      methode(req, "GET");
      return { nonLus: await compteNonLus() };
    }
    const m = /^retours\/([^/]+?)(?:\/(repondre|statut|lu))?$/.exec(reste);
    if (!m) return undefined;
    if (!m[2]) {
      methode(req, "GET");
      return await detail(m[1]!);
    }
    methode(req, "POST");
    const corps = await lire();
    if (m[2] === "repondre") return await repondreAdmin(admin, m[1]!, corps);
    if (m[2] === "statut") return await changerStatut(admin, m[1]!, corps);
    return await marquerLuAdmin(admin, m[1]!, corps);
  }

  // --- Aiguillage joueur ---------------------------------------------------------------------------------------------------------
  /** Les routes `/api/retours…` ; `undefined` : ce chemin n'est pas aux retours. */
  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path !== "/api/retours" && !path.startsWith("/api/retours/")) return undefined;
    if (path === "/api/retours") {
      if (req.method === "POST") return await envoyer(req, info);
      methode(req, "GET");
      return await mesFils(req, info);
    }
    if (path === "/api/retours/contexte") {
      methode(req, "GET");
      await readHitAddress(info, "rtcip", RETOURS_LECTURES_PAR_ADRESSE);
      return await contexte(req);
    }
    const m = /^\/api\/retours\/([^/]+?)(?:\/(messages|lu))?$/.exec(path);
    if (!m) throw new HttpError(404, "not_found", "Route inconnue");
    if (!m[2]) {
      methode(req, "GET");
      return await unFil(req, info, m[1]!);
    }
    methode(req, "POST");
    return m[2] === "messages" ? await repondre(req, info, m[1]!) : await marquerLu(req, info, m[1]!);
  }

  return { route, routeAdmin, nonLus, compteNonLus, pourPortail: { nonLus } };
}

export type Retours = ReturnType<typeof createRetours>;
export type RetoursPourPortail = { nonLus(id: string): Promise<number> };

/** Les instructions d'effacement d'un joueur (ses fils et leurs messages). */
export function effacerRetours(id: string): Statement[] {
  return [
    { sql: "DELETE FROM retours_messages WHERE retour_id IN (SELECT id FROM retours WHERE player_id = ?)", params: [id] },
    { sql: "DELETE FROM retours WHERE player_id = ?", params: [id] },
  ];
}

/** La durée de garde d'un fil, en millisecondes. */
export const RETOURS_GARDE_MS = RETOURS_GARDE_JOURS * JOUR_MS;

/**
 * `recette:seed` seulement : la réponse de l'éditeur à un retour, écrite directement (la recette n'a pas de session d'administration à rejouer). Même effet qu'une réponse du panneau — le fil passe « lu », la réponse
 * attend le joueur (`non_lu_joueur`) — sans écrire au journal (aucun administrateur n'a agi).
 */
export async function semerReponse(db: Platform["db"], retourId: number, texte: string, t: number): Promise<void> {
  const instructions: Statement[] = [
    { sql: "INSERT INTO retours_messages (retour_id, auteur, texte, cree_le) VALUES (?, 'admin', ?, ?)", params: [retourId, texte, t] },
    { sql: "UPDATE retours SET maj_le = ?, nb_messages = nb_messages + 1, non_lu_joueur = 1, non_lu_admin = 0, statut = CASE WHEN statut = 'nouveau' THEN 'lu' ELSE statut END WHERE id = ?", params: [t, retourId] },
  ];
  if (db.batch) await db.batch(instructions);
  else for (const s of instructions) await db.run(s.sql, s.params);
}
