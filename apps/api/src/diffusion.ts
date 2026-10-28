import {
  MESSAGE_MAX,
  nettoyerMessage,
  nettoyerNouveaute,
  messageActif,
  problemesDeMessage,
  problemesDePublication,
  type LigneNouveaute,
  type MessageContenu,
  type OuMessage,
  type TonMessage,
} from "@cdj/core/nouveautes";
import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
import { ecrireJournal } from "./journaux";

// Lot N2 (plateforme) — les **nouveautés** (ce que Nathan écrit pour les joueurs à chaque mise en production) et le **message en direct** (une phrase à tous les joueurs, tout de suite).
// Guide : apps/api/CLAUDE.md, « Nouveautés et message en direct (lot N2) ». Les règles pures (forme d'une ligne, 160 caractères, ni lien ni HTML) sont `@cdj/core/nouveautes`,
// appliquées ici à chaque enregistrement et par le panneau avant l'envoi.
//
//   Public (aucun identifiant, rien d'écrit) :
//     GET /api/annonce                       le message actif, **seul** : `public, max-age=0, s-maxage=30` (les pages ouvertes partagent le cache de Firebase Hosting)
//     GET /api/portail/nouveautes?avant=     les nouveautés publiées, la plus récente d'abord, 20 par page ; `avant` = `AAAA-MM-JJ.<id>` (le dernier de la page d'avant) ; `public, max-age=60`
//     (`GET /api/portail/jour` rend aussi `nouveaute`, la dernière publiée, et `annonce` : une seule requête au chargement du portail, règle du lot I3)
//   Administration (session, `X-Cdj-Admin`, `confirmer: true` ; chaque action est inscrite au journal **dans la même transaction**) :
//     GET  /api/admin/nouveautes             toutes (brouillons et publiées), 100 au plus
//     POST /api/admin/nouveautes             enregistre (`id` absent : une nouvelle) en brouillon, ou publie (`publier: true` : refusé s'il manque de l'anglais…)
//     POST /api/admin/nouveautes/<id>/depublier | supprimer
//     GET  /api/admin/message                le message actif et les 30 derniers messages
//     POST /api/admin/message                « Mettre à jour » : retire le message actif et en pose un nouveau (un seul message actif, jamais deux)
//     POST /api/admin/message/retirer        « Retirer maintenant »
//
// Ni l'une ni l'autre des tables ne tient une donnée de joueur : elles sont **gardées** par la remise à zéro du lancement (`TABLES_GARDEES`).

/** Nouveautés par page de la page `/nouveautes/`. */
export const NOUVEAUTES_PAR_PAGE = 20;
/** Nouveautés montrées dans le panneau. */
export const NOUVEAUTES_ADMIN = 100;
/** Messages passés montrés dans le panneau. */
export const MESSAGES_PASSES = 30;
/** Le cache de Hosting garde le message 30 s ; une page ouverte le relit toutes les 60 s, seulement visible. */
export const ANNONCE_S_MAXAGE = 30;
export const ANNONCE_RELECTURE_MS = 60_000;
/** Cache public de la page des nouveautés (et de ses pages suivantes). */
export const NOUVEAUTES_MAX_AGE_S = 60;
/** Lectures publiques par adresse et par fenêtre de débit (10 minutes) : une page ouverte relit toutes les minutes (10), un chargement, quelques pages. */
export const ANNONCE_LECTURES_PAR_ADRESSE = 120;
export const NOUVEAUTES_LECTURES_PAR_ADRESSE = 120;

export type StatutNouveaute = "brouillon" | "publiee";

/** Une ligne telle que le serveur la garde et la rend ; `pr` : le numéro de la PR d'où elle vient (facultatif, pour ne pas la proposer deux fois). */
export interface LigneGardee extends LigneNouveaute {
  pr?: number;
}

export interface NouveauteGardee {
  id: number;
  titre: { fr: string; en: string };
  date: string;
  lignes: LigneGardee[];
}

export interface NouveauteAdmin extends NouveauteGardee {
  statut: StatutNouveaute;
  creeLe: string;
  modifieLe: string;
  publieLe: string | null;
}

export interface AnnonceRendue {
  id: number;
  fr: string;
  en: string;
  ou: OuMessage[];
  ton: TonMessage;
  /** Fin (ms depuis 1970, UTC). */
  fin: number;
}

interface LigneSql {
  id: number;
  titre_fr: string;
  titre_en: string;
  date_affichee: string;
  lignes: string;
  statut: string;
  cree_le: number;
  modifie_le: number;
  publie_le: number | null;
}

interface AnnonceSql {
  id: number;
  texte_fr: string;
  texte_en: string;
  ou: string;
  ton: string;
  debut: number;
  fin: number;
  retire_le: number | null;
}

type Corps = Record<string, unknown>;

/** Les lignes gardées en JSON : relues avec prudence (une valeur abîmée ne casse jamais la page des joueurs). */
function lignesDe(brut: string): LigneGardee[] {
  try {
    const l = JSON.parse(brut) as unknown;
    if (!Array.isArray(l)) return [];
    return l.map((x): LigneGardee => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        zone: o.zone === "dujour" || o.zone === "track" || o.zone === "jump" ? o.zone : null,
        fr: typeof o.fr === "string" ? o.fr : "",
        en: typeof o.en === "string" ? o.en : "",
        ...(typeof o.pr === "number" && Number.isInteger(o.pr) && o.pr > 0 ? { pr: o.pr } : {}),
      };
    });
  } catch {
    return [];
  }
}

const jetonDeLigne = (n: { id: number; date_affichee: string }) => `${n.date_affichee}.${n.id}`;
const CURSEUR = /^(\d{4}-\d{2}-\d{2})\.(\d{1,12})$/;

const publique = (r: LigneSql): NouveauteGardee => ({ id: r.id, titre: { fr: r.titre_fr, en: r.titre_en }, date: r.date_affichee, lignes: lignesDe(r.lignes) });
const pourAdmin = (r: LigneSql): NouveauteAdmin => ({
  ...publique(r),
  statut: r.statut === "publiee" ? "publiee" : "brouillon",
  creeLe: new Date(r.cree_le).toISOString(),
  modifieLe: new Date(r.modifie_le).toISOString(),
  publieLe: r.publie_le === null ? null : new Date(r.publie_le).toISOString(),
});

const ouDe = (brut: string): OuMessage[] => brut.split(",").filter((x): x is OuMessage => x === "portail" || x === "track" || x === "jump");
const annonceDe = (r: AnnonceSql): AnnonceRendue => ({ id: r.id, fr: r.texte_fr, en: r.texte_en, ou: ouDe(r.ou), ton: r.ton === "important" ? "important" : "information", fin: r.fin });

export function createDiffusion(platform: Platform) {
  const { db, now, log } = platform;

  const executer = async (statements: Statement[]): Promise<void> => {
    if (db.batch) await db.batch(statements);
    else for (const s of statements) await db.run(s.sql, s.params);
  };
  const confirme = (corps: Corps) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };

  // --- Lectures publiques ------------------------------------------------------------------------------------------------------------
  /** Le message actif à cet instant (au plus un), ou `null`. Une ligne lue par l'index de `fin`. */
  async function active(): Promise<AnnonceRendue | null> {
    const r = await db.first<AnnonceSql>("SELECT id, texte_fr, texte_en, ou, ton, debut, fin, retire_le FROM annonces WHERE fin > ? AND retire_le IS NULL ORDER BY fin DESC LIMIT 1", [now()]);
    return r ? messageActif(annonceDe(r), now()) : null;
  }

  /** La dernière nouveauté publiée (la ligne de l'accueil) : son titre, sa date et l'instant de publication (« lue sur cet appareil » se compare à lui). */
  async function derniere(): Promise<{ id: number; date: string; titre: { fr: string; en: string }; publieLe: number } | null> {
    const r = await db.first<LigneSql>("SELECT id, titre_fr, titre_en, date_affichee, lignes, statut, cree_le, modifie_le, publie_le FROM nouveautes WHERE statut = 'publiee' ORDER BY date_affichee DESC, id DESC LIMIT 1");
    return r ? { id: r.id, date: r.date_affichee, titre: { fr: r.titre_fr, en: r.titre_en }, publieLe: r.publie_le ?? r.modifie_le } : null;
  }

  /** Le contenu que la réponse publique de l'accueil porte (`GET /api/portail/jour`) : jamais une erreur de plus pour l'accueil. */
  async function pourLAccueil(): Promise<{ nouveaute: Awaited<ReturnType<typeof derniere>>; annonce: AnnonceRendue | null }> {
    try {
      const [nouveaute, annonce] = await Promise.all([derniere(), active()]);
      return { nouveaute, annonce };
    } catch (e) {
      log("WARNING", "diffusion : nouveauté ou message indisponible", { error: e instanceof Error ? e.message.slice(0, 120) : "inconnue" });
      return { nouveaute: null, annonce: null };
    }
  }

  async function page(url: URL, info: RequestInfo): Promise<WithHeaders> {
    await platform.readHitAddress(info, "nvt", NOUVEAUTES_LECTURES_PAR_ADRESSE);
    const brut = url.searchParams.get("avant");
    const m = brut === null ? null : CURSEUR.exec(brut);
    if (brut !== null && !m) throw new HttpError(400, "invalid_cursor", "`avant` attendu au format AAAA-MM-JJ.<n>");
    // Ordre (date affichée, identifiant) décroissant ; la suivante = tout ce qui vient strictement après le curseur.
    const lignes = await db.all<LigneSql>(
      `SELECT id, titre_fr, titre_en, date_affichee, lignes, statut, cree_le, modifie_le, publie_le FROM nouveautes WHERE statut = 'publiee'${m ? " AND (date_affichee < ? OR (date_affichee = ? AND id < ?))" : ""} ORDER BY date_affichee DESC, id DESC LIMIT ?`,
      m ? [m[1]!, m[1]!, Number(m[2]), NOUVEAUTES_PAR_PAGE + 1] : [NOUVEAUTES_PAR_PAGE + 1],
    );
    const gardees = lignes.slice(0, NOUVEAUTES_PAR_PAGE);
    // Le public ne voit pas d'où venait une ligne (`pr`) : rien à lui dire.
    const corps = {
      nouveautes: gardees.map((r) => {
        const n = publique(r);
        // `publieLe` : l'instant de publication (ms) — la page des nouveautés s'en sert pour noter « lu » sur cet appareil.
        return { ...n, publieLe: r.publie_le ?? r.modifie_le, lignes: n.lignes.map(({ zone, fr, en }) => ({ zone, fr, en })) };
      }),
      suivante: lignes.length > NOUVEAUTES_PAR_PAGE ? jetonDeLigne(gardees.at(-1)!) : null,
    };
    return new WithHeaders(corps, { "Cache-Control": `public, max-age=${NOUVEAUTES_MAX_AGE_S}` });
  }

  async function annonce(info: RequestInfo): Promise<WithHeaders> {
    await platform.readHitAddress(info, "ann", ANNONCE_LECTURES_PAR_ADRESSE);
    // `max-age=0` : le navigateur revalide à chaque relecture ; `s-maxage=30` : le cache de Firebase Hosting, partagé par toutes les pages ouvertes, garde la réponse 30 s.
    return new WithHeaders({ annonce: await active(), maintenant: new Date(now()).toISOString() }, { "Cache-Control": `public, max-age=0, s-maxage=${ANNONCE_S_MAXAGE}` });
  }

  // --- Les nouveautés : l'administrateur ---------------------------------------------------------------------------------------------
  const SELECT_NOUVEAUTE = "SELECT id, titre_fr, titre_en, date_affichee, lignes, statut, cree_le, modifie_le, publie_le FROM nouveautes";

  async function listerNouveautes(): Promise<unknown> {
    const lignes = await db.all<LigneSql>(`${SELECT_NOUVEAUTE} ORDER BY id DESC LIMIT ?`, [NOUVEAUTES_ADMIN]);
    return { nouveautes: lignes.map(pourAdmin), max: NOUVEAUTES_ADMIN };
  }

  const resume = (n: { titre: { fr: string }; date: string }, id: number | string) => `${n.titre.fr.slice(0, 60) || "(sans titre)"} · ${n.date} · n° ${id}`;

  /** `pr` n'est pas dans `nettoyerNouveaute` (c'est le panneau qui s'en sert) : rattaché ici, entier positif seulement. */
  function avecPr(brut: unknown, lignes: LigneNouveaute[]): LigneGardee[] {
    const source = Array.isArray((brut as { lignes?: unknown } | null)?.lignes) ? ((brut as { lignes: unknown[] }).lignes as unknown[]) : [];
    return lignes.map((l, i) => {
      const pr = (source[i] as { pr?: unknown } | undefined)?.pr;
      return typeof pr === "number" && Number.isInteger(pr) && pr > 0 && pr < 1e9 ? { ...l, pr } : l;
    });
  }

  async function enregistrerNouveaute(admin: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    if (typeof corps.publier !== "boolean") throw new HttpError(400, "invalid_action", "`publier` (vrai ou faux) attendu");
    const contenu = nettoyerNouveaute(corps);
    const lignes = avecPr(corps, contenu.lignes);
    const publier = corps.publier;
    // Un brouillon n'a pas à être complet (titre et date au moins, pour le retrouver) ; la publication exige tout : zones, français, **anglais**.
    const problemes = publier ? problemesDePublication(contenu) : problemesDePublication(contenu).filter((p) => p.code === "date" || p.code === "titre_long" || p.code === "trop_de_lignes" || p.code === "ligne_longue");
    if (problemes.length) throw new HttpError(400, "invalid_news", "Nouveauté incomplète", {}, { problemes });
    const t = now();
    const id = corps.id === undefined || corps.id === null ? null : Number(corps.id);
    if (id !== null && !(Number.isInteger(id) && id > 0)) throw new HttpError(400, "invalid_action", "Identifiant illisible");
    const json = JSON.stringify(lignes);
    if (id === null) {
      // La nouveauté et sa ligne de journal dans **la même transaction** ; la cible du journal porte le numéro que la base vient de donner (`last_insert_rowid()`).
      const action = publier ? "publier une nouveauté" : "enregistrer un brouillon";
      const cible = `${contenu.titre.fr.slice(0, 60) || "(sans titre)"} · ${contenu.date} · n° `;
      await executer([
        { sql: "INSERT INTO nouveautes (titre_fr, titre_en, date_affichee, lignes, statut, cree_le, modifie_le, publie_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params: [contenu.titre.fr, contenu.titre.en, contenu.date, json, publier ? "publiee" : "brouillon", t, t, publier ? t : null] },
        { sql: "INSERT INTO journal_admin (at, admin, action, cible, avant, apres) VALUES (?, ?, ?, ? || last_insert_rowid(), NULL, ?)", params: [t, admin, action, cible, JSON.stringify({ statut: publier ? "publiee" : "brouillon", lignes: lignes.length })] },
      ]);
      const nouveau = await db.first<LigneSql>(`${SELECT_NOUVEAUTE} WHERE cree_le = ? AND titre_fr = ? ORDER BY id DESC LIMIT 1`, [t, contenu.titre.fr]);
      return { nouveaute: pourAdmin(nouveau!) };
    }
    const avant = await db.first<LigneSql>(`${SELECT_NOUVEAUTE} WHERE id = ?`, [id]);
    if (!avant) throw new HttpError(404, "unknown_news", "Nouveauté inconnue");
    const etaitPubliee = avant.statut === "publiee";
    // « Publiée depuis » : l'instant de la première publication (un brouillon qui devient publié, ou une nouveauté dépubliée puis republiée) ; une modification n'en fait pas une nouveauté « non lue ».
    const publieLe = publier ? (etaitPubliee ? (avant.publie_le ?? t) : t) : avant.publie_le;
    await executer([
      { sql: "UPDATE nouveautes SET titre_fr = ?, titre_en = ?, date_affichee = ?, lignes = ?, statut = ?, modifie_le = ?, publie_le = ? WHERE id = ?", params: [contenu.titre.fr, contenu.titre.en, contenu.date, json, publier ? "publiee" : "brouillon", t, publieLe, id] },
      ecrireJournal({
        at: t,
        admin,
        action: publier ? (etaitPubliee ? "modifier une nouveauté" : "publier une nouveauté") : etaitPubliee ? "dépublier une nouveauté" : "enregistrer un brouillon",
        cible: resume(contenu, id),
        avant: { statut: avant.statut, titre: avant.titre_fr, lignes: lignesDe(avant.lignes).length },
        apres: { statut: publier ? "publiee" : "brouillon", titre: contenu.titre.fr, lignes: lignes.length },
      }),
    ]);
    return { nouveaute: pourAdmin((await db.first<LigneSql>(`${SELECT_NOUVEAUTE} WHERE id = ?`, [id]))!) };
  }

  async function changerStatut(admin: string, brut: string, action: "depublier" | "supprimer", corps: Corps): Promise<unknown> {
    confirme(corps);
    const id = Number(brut);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "unknown_news", "Nouveauté inconnue");
    const avant = await db.first<LigneSql>(`${SELECT_NOUVEAUTE} WHERE id = ?`, [id]);
    if (!avant) throw new HttpError(404, "unknown_news", "Nouveauté inconnue");
    const t = now();
    const cible = resume({ titre: { fr: avant.titre_fr }, date: avant.date_affichee }, id);
    if (action === "supprimer") {
      await executer([{ sql: "DELETE FROM nouveautes WHERE id = ?", params: [id] }, ecrireJournal({ at: t, admin, action: "supprimer une nouveauté", cible, avant: { statut: avant.statut } })]);
      return { supprimee: true };
    }
    if (avant.statut !== "publiee") throw new HttpError(400, "invalid_action", "Cette nouveauté n'est pas publiée");
    await executer([
      { sql: "UPDATE nouveautes SET statut = 'brouillon', modifie_le = ? WHERE id = ?", params: [t, id] },
      ecrireJournal({ at: t, admin, action: "dépublier une nouveauté", cible, avant: { statut: "publiee" }, apres: { statut: "brouillon" } }),
    ]);
    return { nouveaute: pourAdmin((await db.first<LigneSql>(`${SELECT_NOUVEAUTE} WHERE id = ?`, [id]))!) };
  }

  // --- Le message en direct : l'administrateur ----------------------------------------------------------------------------------------
  async function lireMessages(): Promise<unknown> {
    const [actif, passes] = await Promise.all([
      active(),
      db.all<AnnonceSql>("SELECT id, texte_fr, texte_en, ou, ton, debut, fin, retire_le FROM annonces ORDER BY id DESC LIMIT ?", [MESSAGES_PASSES + 1]),
    ]);
    return {
      actif,
      maintenant: now(),
      max: MESSAGE_MAX,
      passes: passes.filter((r) => r.id !== actif?.id).slice(0, MESSAGES_PASSES).map((r) => ({ ...annonceDe(r), debut: r.debut, retireLe: r.retire_le })),
    };
  }

  async function mettreAJour(admin: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const t = now();
    const m: MessageContenu = nettoyerMessage(corps);
    const problemes = problemesDeMessage(m, t);
    if (problemes.length) throw new HttpError(400, "invalid_message", "Message refusé", {}, { problemes });
    const avant = await active();
    // Un seul message actif : le précédent est retiré **dans la même transaction** que le nouveau. Un message modifié est un nouveau message (un autre identifiant : les pages qui avaient fermé l'ancien le revoient).
    await executer([
      { sql: "UPDATE annonces SET retire_le = ? WHERE retire_le IS NULL AND fin > ?", params: [t, t] },
      { sql: "INSERT INTO annonces (texte_fr, texte_en, ou, ton, debut, fin, retire_le) VALUES (?, ?, ?, ?, ?, ?, NULL)", params: [m.fr, m.en, m.ou.join(","), m.ton, t, m.fin] },
      ecrireJournal({
        at: t,
        admin,
        action: avant ? "mettre à jour le message en direct" : "publier un message en direct",
        cible: `${m.fr.slice(0, 60)} · ${m.ou.join(", ")} · ${m.ton}`,
        avant: avant ? { fr: avant.fr, fin: new Date(avant.fin).toISOString() } : undefined,
        apres: { fr: m.fr, en: m.en, ou: m.ou, ton: m.ton, fin: new Date(m.fin).toISOString() },
      }),
    ]);
    return { actif: await active() };
  }

  async function retirerMessage(admin: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const t = now();
    const avant = await active();
    if (!avant) throw new HttpError(400, "invalid_action", "Aucun message actif");
    await executer([
      { sql: "UPDATE annonces SET retire_le = ? WHERE retire_le IS NULL AND fin > ?", params: [t, t] },
      ecrireJournal({ at: t, admin, action: "retirer le message en direct", cible: `${avant.fr.slice(0, 60)} · ${avant.ou.join(", ")} · ${avant.ton}`, avant: { fr: avant.fr, fin: new Date(avant.fin).toISOString() } }),
    ]);
    return { actif: null };
  }

  // --- Routes ------------------------------------------------------------------------------------------------------------------------
  const methode = (req: Request, attendu: "GET" | "POST"): void => {
    if (req.method !== attendu) throw new HttpError(405, "method_not_allowed", `${attendu} attendu`);
  };

  /** Les routes **publiques** ; `undefined` : ce chemin n'est pas d'ici. */
  async function routePublique(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/annonce") {
      methode(req, "GET");
      return await annonce(info);
    }
    if (path === "/api/portail/nouveautes") {
      methode(req, "GET");
      return await page(url, info);
    }
    return undefined;
  }

  /** Les routes d'**administration** (`reste` : ce qui suit `/api/admin/`), appelées par `admin.ts` une fois la session vérifiée ; `undefined` : ce n'est pas d'ici. */
  async function routeAdmin(reste: string, req: Request, admin: string, lire: () => Promise<Corps>): Promise<unknown> {
    if (reste === "nouveautes") {
      if (req.method === "GET") return await listerNouveautes();
      methode(req, "POST");
      return await enregistrerNouveaute(admin, await lire());
    }
    const n = /^nouveautes\/([^/]+)\/(depublier|supprimer)$/.exec(reste);
    if (n) {
      methode(req, "POST");
      return await changerStatut(admin, n[1]!, n[2] as "depublier" | "supprimer", await lire());
    }
    if (reste === "message") {
      if (req.method === "GET") return await lireMessages();
      methode(req, "POST");
      return await mettreAJour(admin, await lire());
    }
    if (reste === "message/retirer") {
      methode(req, "POST");
      return await retirerMessage(admin, await lire());
    }
    return undefined;
  }

  return { routePublique, routeAdmin, pourLAccueil, active, derniere };
}

export type Diffusion = ReturnType<typeof createDiffusion>;

/** Les deux nouveautés que la recette montre tout de suite (`recette:seed`) : des dates d'avant tout vrai contenu, pour ne jamais masquer une vraie nouveauté. Repères : « Recette : » au début du titre. */
export const NOUVEAUTES_DE_RECETTE: readonly { id: string; date: string; titre: { fr: string; en: string }; lignes: LigneNouveaute[] }[] = [
  {
    id: "recette-1",
    date: "2026-10-20",
    titre: { fr: "Recette : le classement du jour au chrono", en: "Staging: the daily leaderboard by time" },
    lignes: [
      { zone: "dujour", fr: "Le classement du jour se lit désormais au chrono.", en: "The daily leaderboard is now ranked by time." },
      { zone: "track", fr: "Les médailles se gagnent sur les temps du jour.", en: "Medals are earned on the day's times." },
    ],
  },
  {
    id: "recette-2",
    date: "2026-10-21",
    titre: { fr: "Recette : Jump et la nuit", en: "Staging: Jump and the night" },
    lignes: [
      { zone: "jump", fr: "Le thème Nuit arrive dans Jump.", en: "The Night theme arrives in Jump." },
      { zone: "dujour", fr: "Le portail montre ta série.", en: "The portal shows your streak." },
    ],
  },
];

/**
 * `recette:seed` : **deux nouveautés publiées et aucun message actif** sur la recette. Écrit directement dans la table (rien de personnel, rien à rejouer) ; relancer
 * ne crée aucun doublon (le titre sert de repère) et ne touche à rien d'autre : une vraie nouveauté publiée par Nathan reste. Ne retire pas un message actif : un
 * message de recette s'éteint tout seul.
 */
export async function semerNouveautes(db: Platform["db"], t: number): Promise<{ creees: number }> {
  let creees = 0;
  for (const n of NOUVEAUTES_DE_RECETTE) {
    const deja = await db.first<{ id: number }>("SELECT id FROM nouveautes WHERE titre_fr = ? AND date_affichee = ?", [n.titre.fr, n.date]);
    if (deja) continue;
    await db.run("INSERT INTO nouveautes (titre_fr, titre_en, date_affichee, lignes, statut, cree_le, modifie_le, publie_le) VALUES (?, ?, ?, ?, 'publiee', ?, ?, ?)", [n.titre.fr, n.titre.en, n.date, JSON.stringify(n.lignes), t, t, t]);
    creees++;
  }
  return { creees };
}
