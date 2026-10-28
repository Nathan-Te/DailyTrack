import { formatDay, parseDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { RefusGoogle, createGoogleVerifier, empreinte, lireListeAdresses, verificateurFactice, type Verificateur } from "./adminGoogle";
import { SESSION_MS, cookieDe, cookieEfface, cookieOuvert, createSessions, type Session } from "./adminSession";
import { WithHeaders } from "./cache";
import type { Diffusion } from "./diffusion";
import { HttpError } from "./errors";
import type { GameInstance, Platform, RequestInfo, Statement } from "./games";
import { ecrireJournal, createJournaux, JOURNAL_ADMIN_LIGNES, RETRAIT_REDIFFUSION_JOURS } from "./journaux";
import { REF_LENGTH, refOfPlayer } from "./players";
import { isUniqueViolation, nameKey } from "./pseudos";

// Lot N1 (plateforme) — le panneau d'administration de la plateforme (`/admin/`) : connexion avec le compte Google de l'éditeur, tableau de bord, joueurs, journal.
// Guide pas à pas de Nathan : docs/plateforme/admin.md ; règles : apps/api/CLAUDE.md, « Administration (lot N1) ».
//
//   GET    /api/admin/config                  public : le panneau est-il configuré ? l'identifiant client Google (public), le vérificateur factice (local et CI seulement)
//   POST   /api/admin/session { credential }  vérifie le jeton d'identité Google, ouvre la session (cookie `__session`)
//   GET    /api/admin/session                 la session en cours (empreinte de l'administrateur, fin de validité)
//   DELETE /api/admin/session                 déconnexion : cookie effacé, session révoquée côté serveur
//   GET    /api/admin/tableau                 les chiffres du jour, 14 jours de joueurs, l'état du site, les 3 dernières actions
//   GET    /api/admin/joueurs?q=&filtre=&page=   recherche (début de pseudo ou de référence), 50 par page ; filtre `tous` | `masques`
//   GET    /api/admin/joueurs/<ref>           la fiche d'un joueur
//   POST   /api/admin/joueurs/<ref>/renommer | masquer | retirer | supprimer   les actions (chacune confirmée, inscrite au journal)
//   GET    /api/admin/journal                 les 200 dernières actions
//   Lot N2 : /api/admin/nouveautes (GET, POST, …/<id>/depublier | supprimer) et /api/admin/message (GET, POST, …/retirer) — `diffusion.ts`
//
// Les routes d'administration de DailyTrack (`/api/admin/overview`, `planning`, `medailles`, `effacer`) restent à `cdj.ts` ; elles acceptent la session ou le jeton.
//
// **Protections** : les requêtes qui modifient quelque chose exigent `X-Cdj-Admin: 1` et une `Origin` égale au site (`verifierEcriture`) ; toutes les réponses sont `no-store` (`api.ts`) ;
// la connexion est limitée en débit ; un refus ne dit jamais si c'est l'adresse ou le jeton qui ne va pas (401 `unauthorized`, un seul visage).

/** Joueurs par page de recherche. */
export const JOUEURS_PAR_PAGE = 50;
/** Jours de résultats montrés sur une fiche. */
export const FICHE_JOURS = 30;
/** Jours de la courbe du tableau de bord. */
export const SERIE_JOURS = 14;
/** Le tableau de bord est calculé au plus une fois par minute et par instance. */
export const TABLEAU_MEMO_MS = 60_000;
/** Tentatives de connexion par adresse et par fenêtre de débit (10 minutes). */
export const CONNEXIONS_PAR_FENETRE = 10;
/** Lectures du panneau par session et par fenêtre de débit. */
export const LECTURES_PAR_SESSION = 600;
/** Actions par session et par fenêtre de débit. */
export const ACTIONS_PAR_SESSION = 120;
export const MOTIF_MAX = 200;

export interface AdminOptions {
  /** L'identifiant client OAuth de Google : public (il va dans la configuration), vérifié comme `aud` du jeton. */
  clientId?: string;
  /** La liste du secret `cdj-admin-emails` (déjà lue : `lireListeAdresses`). L'adresse de l'éditeur n'est jamais dans le dépôt. */
  emails: readonly string[];
  /** Le secret `cdj-admin-session-key` (32 caractères au moins). */
  sessionKey?: string;
  /** Vérificateur factice (tests et CI) : refusé au démarrage en production et en recette (`config.ts`). */
  fakeVerifier?: boolean;
  /** L'étiquette `prod-…` de la mise en production, et le commit : fournis au déploiement. */
  releaseTag?: string;
  commit?: string;
  /** Tests : un vérificateur à soi, ou les clés de Google servies par `fetchFn`. */
  verifier?: Verificateur;
  fetchFn?: typeof fetch;
  certsUrl?: string;
}

export interface JeuAdmin {
  code: string;
  name: string;
  instance: GameInstance;
}

export interface AdminDeps {
  platform: Platform;
  options: AdminOptions;
  jeux: readonly JeuAdmin[];
  /** Les origines permises (`ALLOWED_ORIGINS`) : l'`Origin` d'une écriture doit y figurer ; sans liste (local, tests), celle de la requête. */
  allowedOrigins?: readonly string[];
  /** La révision déployée (Cloud Run). */
  revision?: string;
  /** Vide la mémoire de l'instance après une action (classements gardés du portail). */
  oublier: () => void;
  /** Lot N2 : les nouveautés et le message en direct (leurs routes d'administration). */
  diffusion: Diffusion;
}

type Corps = Record<string, unknown>;

export function createAdmin(deps: AdminDeps) {
  const { platform, options, jeux } = deps;
  const { db, now, log } = platform;
  const journaux = createJournaux({ db, now, log });

  const cle = options.sessionKey && options.sessionKey.length >= 32 ? options.sessionKey : null;
  const verifier: Verificateur | null = options.verifier ?? (options.fakeVerifier ? verificateurFactice : options.clientId ? createGoogleVerifier({ clientId: options.clientId, now, fetchFn: options.fetchFn, certsUrl: options.certsUrl }) : null);
  /** Configuré : une liste d'adresses, un secret de session et un vérificateur. Sinon les routes du panneau n'existent pas (404), comme l'administration par jeton sans jeton. */
  const actif = options.emails.length > 0 && cle !== null && verifier !== null;
  const sessions = cle ? createSessions({ db, now, cle }) : null;
  let listePromise: Promise<Set<string>> | null = null;
  const liste = () => (listePromise ??= Promise.all(options.emails.map((e) => empreinte(e))).then((h) => new Set(h)));
  const origines = deps.allowedOrigins?.map((o) => o.trim().replace(/\/+$/, "").toLowerCase()).filter(Boolean);

  // --- Garde ------------------------------------------------------------------------------------------------------------------
  /** Une requête qui modifie quelque chose : l'en-tête `X-Cdj-Admin: 1` (qu'un formulaire d'un autre site ne peut pas poser) et une `Origin` égale au site. */
  function verifierEcriture(req: Request): void {
    if (req.method === "GET" || req.method === "HEAD") return;
    const origine = req.headers.get("origin")?.trim().replace(/\/+$/, "").toLowerCase();
    const permises = origines && !origines.includes("*") ? origines : [new URL(req.url).origin.toLowerCase()];
    if (req.headers.get("x-cdj-admin") !== "1" || !origine || !permises.includes(origine)) throw new HttpError(403, "forbidden", "En-tête X-Cdj-Admin ou Origin manquant ou incorrect");
  }

  /** La session de la requête, ou `null` (sans dire pourquoi : absente, falsifiée, expirée, révoquée). */
  async function sessionDe(req: Request): Promise<Session | null> {
    if (!sessions) return null;
    return sessions.lire(cookieDe(req));
  }

  async function exiger(req: Request): Promise<Session> {
    const s = await sessionDe(req);
    if (!s) throw new HttpError(401, "unauthorized", "Session d'administration absente ou expirée");
    verifierEcriture(req);
    return s;
  }

  /** Pour les outils de DailyTrack (`cdj.ts`, `requireAdmin`) : la requête porte-t-elle une session d'administration valide (et, si elle écrit, les en-têtes d'une écriture) ? */
  async function sessionValide(req: Request): Promise<boolean> {
    const s = await sessionDe(req);
    if (!s) return false;
    try {
      verifierEcriture(req);
    } catch {
      return false; // une écriture sans les en-têtes n'est pas authentifiée par le cookie (le jeton, s'il est donné, reste examiné)
    }
    return true;
  }

  // --- Connexion --------------------------------------------------------------------------------------------------------------
  const refuser = (raison: string): never => {
    log("WARNING", "admin : connexion refusée", { raison }); // la raison technique seulement : jamais l'adresse, ni le jeton
    throw new HttpError(401, "unauthorized", "Connexion refusée");
  };

  async function connecter(req: Request, info: RequestInfo): Promise<WithHeaders> {
    verifierEcriture(req);
    await platform.hitAddress(info, "adms", CONNEXIONS_PAR_FENETRE);
    const corps = await platform.readJson(req);
    let email: string;
    try {
      email = (await verifier!(typeof corps.credential === "string" ? corps.credential : "")).email;
    } catch (e) {
      return refuser(e instanceof RefusGoogle ? e.raison : "verification");
    }
    if (!(await liste()).has(await empreinte(email))) return refuser("hors_liste");
    const { cookie, session } = await sessions!.ouvrir(await sessions!.empreinteAdmin(email));
    log("INFO", "admin : connexion acceptée");
    return new WithHeaders({ admin: session.admin, expire: new Date(session.expire).toISOString() }, { "Set-Cookie": cookieOuvert(cookie) });
  }

  async function deconnecter(req: Request): Promise<WithHeaders> {
    verifierEcriture(req);
    const s = await sessionDe(req);
    if (s) await sessions!.revoquer(s.id);
    return new WithHeaders({ deconnecte: true }, { "Set-Cookie": cookieEfface });
  }

  // --- Joueurs ----------------------------------------------------------------------------------------------------------------
  interface LigneJoueur {
    id: string;
    name: string;
    name_key: string | null;
    ref: string | null;
    hidden: number;
    created_at: number;
    rename_required: number;
  }

  /** Les références des joueurs d'avant le lot (ou insérés sans elle) : calculées au passage, avant toute recherche. */
  async function reparerRefs(): Promise<void> {
    for (;;) {
      const lignes = await db.all<{ id: string }>("SELECT id FROM players WHERE ref IS NULL LIMIT 200");
      if (lignes.length === 0) return;
      const statements: Statement[] = [];
      for (const l of lignes) statements.push({ sql: "UPDATE players SET ref = ? WHERE id = ? AND ref IS NULL", params: [await refOfPlayer(l.id), l.id] });
      if (db.batch) await db.batch(statements);
      else for (const s of statements) await db.run(s.sql, s.params);
    }
  }

  function refDe(brut: string): string {
    const ref = brut.toLowerCase();
    if (!new RegExp(`^[0-9a-f]{${REF_LENGTH}}$`).test(ref)) throw new HttpError(404, "unknown_player", "Référence inconnue");
    return ref;
  }

  async function trouver(brut: string): Promise<LigneJoueur> {
    const ref = refDe(brut);
    await reparerRefs();
    const lignes = await db.all<LigneJoueur>("SELECT id, name, name_key, ref, hidden, created_at, rename_required FROM players WHERE ref = ? LIMIT 2", [ref]);
    if (lignes.length !== 1) throw new HttpError(404, "unknown_player", "Aucun joueur pour cette référence");
    return lignes[0]!;
  }

  async function chercher(url: URL): Promise<unknown> {
    await reparerRefs();
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
    const masques = url.searchParams.get("filtre") === "masques";
    const page = Math.min(1000, Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? 1)) || 1));
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (q) {
      const cle = nameKey(q);
      const ref = q.toLowerCase();
      if (/^[0-9a-f]{3,12}$/.test(ref)) {
        conditions.push("((name_key >= ? AND name_key < ?) OR (ref >= ? AND ref < ?))");
        params.push(cle, `${cle}￿`, ref, `${ref}g`); // « g » suit tous les hexadécimaux : le début de référence
      } else {
        conditions.push("(name_key >= ? AND name_key < ?)");
        params.push(cle, `${cle}￿`);
      }
    }
    if (masques) conditions.push("hidden = 1");
    const lignes = await db.all<{ name: string; ref: string; hidden: number; created_at: number }>(
      `SELECT name, ref, hidden, created_at FROM players${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY name_key LIMIT ? OFFSET ?`,
      [...params, JOUEURS_PAR_PAGE + 1, (page - 1) * JOUEURS_PAR_PAGE],
    );
    return {
      page,
      parPage: JOUEURS_PAR_PAGE,
      suivante: lignes.length > JOUEURS_PAR_PAGE,
      joueurs: lignes.slice(0, JOUEURS_PAR_PAGE).map((l) => ({ ref: l.ref, pseudo: l.name, masque: l.hidden === 1, creeLe: new Date(l.created_at).toISOString() })),
    };
  }

  async function fiche(brut: string): Promise<unknown> {
    const j = await trouver(brut);
    const hooks = jeux.filter((g) => g.instance.admin);
    const activite = hooks.flatMap((g) => g.instance.admin!.activite);
    const [parJeu, jours, retires] = await Promise.all([
      Promise.all(hooks.map(async (g) => ({ g, r: await g.instance.admin!.resultats(j.id, FICHE_JOURS) }))),
      activite.length
        ? db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM (${activite.map((a) => `SELECT ${a.jour} AS jour FROM ${a.table} WHERE ${a.joueur} = ?`).join(" UNION ")})`, activite.map(() => j.id))
        : Promise.resolve(null),
      db.all<{ game: string; day: number; temps_ms: number; removed_at: number; motif: string; gardee: number }>(
        "SELECT game, day, temps_ms, removed_at, motif, replay <> '' AS gardee FROM resultats_retires WHERE player_id = ? ORDER BY removed_at DESC LIMIT 100",
        [j.id],
      ),
    ]);
    let derniere = 0;
    const resultats = parJeu.map(({ g, r }) => ({
      jeu: g.code,
      nom: g.name,
      jours: r.jours,
      resultats: r.liste.map((x) => {
        derniere = Math.max(derniere, x.envoyeA);
        const date = formatDay(x.day);
        return { date, tempsMs: x.tempsMs, morts: x.morts ?? null, medaille: x.medaille, rang: x.rang, classes: x.classes, envoyeA: new Date(x.envoyeA).toISOString(), rediffusion: g.instance.admin!.lienRediffusion(date, x.rang) };
      }),
    }));
    return {
      ref: j.ref,
      pseudo: j.name,
      masque: j.hidden === 1,
      creeLe: new Date(j.created_at).toISOString(),
      dernierePartie: derniere > 0 ? new Date(derniere).toISOString() : null,
      joursJoues: jours?.n ?? 0,
      resultats,
      retires: retires.map((r) => ({ jeu: r.game, date: formatDay(r.day), tempsMs: r.temps_ms, motif: r.motif, retireLe: new Date(r.removed_at).toISOString(), rediffusionGardee: r.gardee === 1 })),
      /** Les rediffusions des résultats retirés sont gardées 30 jours puis effacées. */
      gardeJours: RETRAIT_REDIFFUSION_JOURS,
    };
  }

  // --- Les cinq actions -------------------------------------------------------------------------------------------------------
  /** Exécute les instructions d'une action **dans une seule transaction** (le journal compris), puis oublie la mémoire de l'instance : les classements gardés se recalculent à la fenêtre suivante. */
  async function appliquer(statements: Statement[]): Promise<void> {
    if (db.batch) await db.batch(statements);
    else for (const s of statements) await db.run(s.sql, s.params);
    joursFermes.clear(); // supprimer un profil ou retirer un résultat change des jours déjà fermés
    tableauMemo = null;
    for (const g of jeux) g.instance.onErased?.();
    deps.oublier();
  }

  const confirme = (corps: Corps) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };
  const cibleDe = (j: { name: string; ref: string | null }) => `${j.name} · ${j.ref}`;

  async function renommer(brut: string, s: Session, corps: Corps): Promise<unknown> {
    confirme(corps);
    const j = await trouver(brut);
    const nom = platform.players.checkForm(corps.pseudo); // mêmes règles qu'à la création : forme et mots refusés
    if (nom === j.name) throw new HttpError(400, "invalid_action", "Le pseudo est déjà celui-là");
    await platform.players.assertFree(nom, j.id);
    try {
      await appliquer([
        { sql: "UPDATE players SET name = ?, name_key = ?, rename_required = 0, updated_at = ? WHERE id = ?", params: [nom, nameKey(nom), now(), j.id] },
        ecrireJournal({ at: now(), admin: s.admin, action: "renommer", cible: cibleDe(j), avant: { pseudo: j.name }, apres: { pseudo: nom } }),
      ]);
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, "name_taken", "Pseudo déjà pris", {}, { suggestions: await platform.players.suggest(nom) });
      throw e;
    }
    for (const g of jeux) await g.instance.onRename?.(j.id, nom); // ce que chaque jeu montre déjà du joueur (Salon en cours, premier gardé) suit
    return { pseudo: nom };
  }

  async function masquer(brut: string, s: Session, corps: Corps): Promise<unknown> {
    confirme(corps);
    if (typeof corps.masque !== "boolean") throw new HttpError(400, "invalid_action", "masque (vrai ou faux) attendu");
    const j = await trouver(brut);
    const masque = corps.masque;
    if ((j.hidden === 1) === masque) throw new HttpError(400, "invalid_action", "Rien à changer");
    await appliquer([
      { sql: "UPDATE players SET hidden = ?, updated_at = ? WHERE id = ?", params: [masque ? 1 : 0, now(), j.id] },
      ...jeux.flatMap((g) => g.instance.admin?.masquer(j.id, masque) ?? []),
      ecrireJournal({ at: now(), admin: s.admin, action: masque ? "masquer" : "démasquer", cible: cibleDe(j), avant: { masque: !masque }, apres: { masque } }),
    ]);
    return { masque };
  }

  async function retirer(brut: string, s: Session, corps: Corps): Promise<unknown> {
    confirme(corps);
    const motif = typeof corps.motif === "string" ? corps.motif.replace(/\s+/g, " ").trim() : "";
    if (motif.length < 3 || motif.length > MOTIF_MAX) throw new HttpError(400, "invalid_action", `Motif de 3 à ${MOTIF_MAX} caractères attendu`);
    const jeu = jeux.find((g) => g.code === corps.jeu && g.instance.admin);
    const jour = typeof corps.date === "string" ? parseDay(corps.date) : null;
    if (!jeu || jour === null) throw new HttpError(400, "invalid_action", "Jeu et jour attendus");
    const j = await trouver(brut);
    const retrait = await jeu.instance.admin!.retirer(j.id, jour);
    if (!retrait) throw new HttpError(404, "unknown_result", "Pas de résultat ce jour-là");
    const t = now();
    await appliquer([
      {
        sql: "INSERT INTO resultats_retires (game, day, player_id, temps_ms, replay, inputs_hash, removed_at, motif, admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (game, day, player_id) DO UPDATE SET temps_ms = excluded.temps_ms, replay = excluded.replay, inputs_hash = excluded.inputs_hash, removed_at = excluded.removed_at, motif = excluded.motif, admin = excluded.admin",
        params: [jeu.code, jour, j.id, retrait.tempsMs, retrait.replay, retrait.inputsHash, t, motif, s.admin],
      },
      ...retrait.statements,
      ecrireJournal({ at: t, admin: s.admin, action: "retirer un résultat", cible: cibleDe(j), avant: { jeu: jeu.name, jour: formatDay(jour), tempsMs: retrait.tempsMs }, apres: { retire: true, motif } }),
    ]);
    return { retire: true, rediffusionGardeeJours: RETRAIT_REDIFFUSION_JOURS };
  }

  async function supprimer(brut: string, s: Session, corps: Corps): Promise<unknown> {
    confirme(corps);
    const j = await trouver(brut);
    // Irréversible : il faut retaper le pseudo (sa forme normalisée, comme l'unicité).
    if (typeof corps.pseudo !== "string" || nameKey(corps.pseudo) !== (j.name_key ?? nameKey(j.name))) throw new HttpError(400, "invalid_action", "Le pseudo retapé ne correspond pas");
    const parts = await Promise.all(jeux.map((g) => g.instance.erase?.(j.id)));
    const counts: Record<string, number> = {};
    for (const p of parts) if (p) Object.assign(counts, p.counts);
    await appliquer([
      // Jamais le contenu effacé : le pseudo et des nombres de lignes, pour retrouver la trace.
      ecrireJournal({ at: now(), admin: s.admin, action: "supprimer le profil", cible: cibleDe(j), apres: { supprime: true, ...counts } }),
      ...parts.flatMap((p) => p?.statements ?? []),
      ...(await platform.players.eraseStatements(j.id)),
    ]);
    log("INFO", "admin : joueur supprimé", counts);
    return { supprime: true, ...counts };
  }

  // --- Tableau de bord --------------------------------------------------------------------------------------------------------
  let tableauMemo: { at: number; valeur: Promise<Record<string, unknown>> } | null = null;
  /**
   * Les joueurs d'un jour **fermé** ne changent plus (sauf une action de l'administrateur ou une remise à zéro, qui vident cette mémoire) : le compte de chaque jour des
   * 14 est gardé, et un recalcul ne relit qu'aujourd'hui et hier (la grâce de minuit). C'est ce qui rend le tableau 7 fois moins cher à recalculer (`measure:admin`).
   */
  const joursFermes = new Map<number, number>();
  platform.onGenerationChange(() => joursFermes.clear());

  async function calculerTableau(): Promise<Record<string, unknown>> {
    const debut = performance.now();
    const t = platform.today();
    const depart = t - (SERIE_JOURS - 1);
    const hooks = jeux.filter((g) => g.instance.admin);
    const activite = hooks.flatMap((g) => g.instance.admin!.activite);

    const sonde = performance.now();
    await db.first("SELECT 1 AS ok");
    const baseMs = Math.round(performance.now() - sonde);

    const [serie, nouveaux, compteurs, prets, erreurs] = await Promise.all([
      // Un joueur compte une fois par jour même s'il a fini les deux jeux : l'union des (jour, joueur) de chaque jeu. Les jours fermés déjà comptés ne sont pas relus.
      activite.length
        ? (() => {
            let premier = depart;
            while (premier < t - 1 && joursFermes.has(premier)) premier++;
            return db.all<{ jour: number; n: number }>(
              `SELECT jour, COUNT(*) AS n FROM (${activite.map((a) => `SELECT ${a.jour} AS jour, ${a.joueur} AS joueur FROM ${a.table} WHERE ${a.jour} >= ? AND ${a.jour} <= ?`).join(" UNION ")}) GROUP BY jour`,
              activite.flatMap(() => [premier, t]),
            );
          })()
        : Promise.resolve([]),
      db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE created_at >= ? AND created_at < ?", [parisDayStart(t), parisDayStart(t + 1)]),
      Promise.all(hooks.map(async (g) => ({ code: g.code, ...(await g.instance.admin!.compteurs(t)) }))),
      Promise.all(hooks.map(async (g) => ({ jeu: g.code, nom: g.name, ...(await g.instance.admin!.joursPrets()) }))),
      journaux.erreurs24h(),
    ]);
    for (const r of serie) if (r.jour < t - 1) joursFermes.set(r.jour, r.n);
    for (let d = depart; d < t - 1; d++) if (!joursFermes.has(d) && !serie.some((r) => r.jour === d)) joursFermes.set(d, 0); // un jour sans joueur est compté aussi (0)
    const parJour = new Map([...[...joursFermes].filter(([d]) => d >= depart && d < t - 1), ...serie.map((r) => [r.jour, r.n] as [number, number])]);
    const courbe = Array.from({ length: SERIE_JOURS }, (_, i) => ({ date: formatDay(depart + i), joueurs: parJour.get(depart + i) ?? 0 }));
    const compte = (code: string) => compteurs.find((c) => c.code === code);
    return {
      calculeA: new Date(now()).toISOString(),
      date: formatDay(t),
      chiffres: {
        joueursAujourdhui: parJour.get(t) ?? 0,
        joueursHier: parJour.get(t - 1) ?? 0,
        nouveauxProfils: nouveaux?.n ?? 0,
        track: { finis: compte("cdj")?.finis ?? 0 },
        jump: { finis: compte("jump")?.finis ?? 0, morts: compte("jump")?.morts ?? 0 },
      },
      courbe,
      etat: {
        environnement: platform.environment,
        api: { ok: true, ms: Math.round(performance.now() - debut) },
        base: { ok: true, ms: baseMs },
        version: { etiquette: options.releaseTag ?? null, commit: options.commit ? options.commit.slice(0, 7) : null, revision: deps.revision ?? null },
        joursPrets: prets,
        erreurs24h: { serveur: erreurs.serveur, rediffusions: erreurs.rediffusions },
        /** La place des « PR depuis la dernière mise en production » (lot N2) : pas de chiffre ici. */
        prDepuisMiseEnProduction: null,
      },
    };
  }

  /** Les chiffres, gardés `TABLEAU_MEMO_MS` par instance (un seul calcul même si deux requêtes arrivent ensemble) ; un échec n'est pas gardé. Les dernières actions, elles, sont toujours fraîches. */
  async function tableau(): Promise<unknown> {
    if (!tableauMemo || now() - tableauMemo.at >= TABLEAU_MEMO_MS) {
      const neuf = { at: now(), valeur: calculerTableau() };
      tableauMemo = neuf;
      neuf.valeur.catch(() => {
        if (tableauMemo === neuf) tableauMemo = null;
      });
    }
    return { ...(await tableauMemo.valeur), journal: await journaux.dernieres(3) };
  }

  // --- Routes -----------------------------------------------------------------------------------------------------------------
  const nonPermise = (attendu: string): never => {
    throw new HttpError(405, "method_not_allowed", `${attendu} attendu`);
  };

  async function route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (!path.startsWith("/api/admin/")) return undefined;
    const reste = path.slice("/api/admin/".length);
    const joueur = /^joueurs\/([^/]+)(?:\/(renommer|masquer|retirer|supprimer))?$/.exec(reste);
    const miennes = ["config", "session", "tableau", "joueurs", "journal"];
    const diffuse = /^(?:nouveautes(?:\/[^/]+\/(?:depublier|supprimer))?|message(?:\/retirer)?)$/.test(reste);
    if (!miennes.includes(reste) && !joueur && !diffuse) return undefined; // les outils de DailyTrack (overview, planning, medailles, effacer)
    if (reste === "config") {
      if (req.method !== "GET") return nonPermise("GET");
      await platform.readHitAddress(info, "admc", 120);
      return { actif, clientId: actif ? (options.clientId ?? null) : null, factice: actif && options.fakeVerifier === true };
    }
    if (!actif) throw new HttpError(404, "not_found", "Route inconnue"); // non configuré : le panneau n'existe pas
    if (reste === "session") {
      if (req.method === "POST") return await connecter(req, info);
      if (req.method === "DELETE") return await deconnecter(req);
      if (req.method !== "GET") return nonPermise("GET, POST ou DELETE");
      const s = await sessionDe(req);
      if (!s) throw new HttpError(401, "unauthorized", "Session absente ou expirée");
      return { admin: s.admin, expire: new Date(s.expire).toISOString(), dureeMs: SESSION_MS };
    }
    const s = await exiger(req);
    await journaux.entretien(); // un administrateur connecté : l'occasion d'effacer ce qui a passé sa durée (aussi faite à chaque envoi d'un joueur, `api.ts`)
    const lecture = req.method === "GET";
    if (lecture) platform.readHit(await platform.hashKey("admr", s.id), LECTURES_PAR_SESSION);
    else await platform.hit(await platform.hashKey("admw", s.id), ACTIONS_PAR_SESSION);
    if (diffuse) {
      return await deps.diffusion.routeAdmin(reste, req, s.admin, () => platform.readJson(req));
    }
    if (reste === "tableau") return lecture ? await tableau() : nonPermise("GET");
    if (reste === "journal") return lecture ? { lignes: await journaux.dernieres(JOURNAL_ADMIN_LIGNES), max: JOURNAL_ADMIN_LIGNES } : nonPermise("GET");
    if (reste === "joueurs") return lecture ? await chercher(url) : nonPermise("GET");
    const [, ref, action] = joueur!;
    if (!action) return lecture ? await fiche(ref!) : nonPermise("GET");
    if (req.method !== "POST") return nonPermise("POST");
    const corps = await platform.readJson(req);
    if (action === "renommer") return await renommer(ref!, s, corps);
    if (action === "masquer") return await masquer(ref!, s, corps);
    if (action === "retirer") return await retirer(ref!, s, corps);
    return await supprimer(ref!, s, corps);
  }

  return { route, sessionValide, actif, journaux, entretien: journaux.entretien };
}

export type Admin = ReturnType<typeof createAdmin>;
