import { formatDay, parseDay } from "@cdj/core";
import { PREMIER_JOUR_DU_JOUR, numeroDeJournee } from "@cdj/core/lancement";
import { parisDayStart } from "@cdj/clock";
import { WithHeaders } from "./cache";
import { BAREME_POINTS, classerLaJournee, placer, pointsDe, sommeDesRangs, type ClassementDuJour, type LigneDuJour, type ResultatJeu } from "./classementDuJour";
import { HttpError } from "./errors";
import type { EtatPortail, JourPortail, Platform, PortailDuJeu, RequestInfo } from "./games";

// Le portail « Du Jour » (lot I2 de la plateforme, phase 3) : les lectures regroupées de la page d'accueil et du profil commun. Elles ne
// connaissent aucun jeu : chacun déclare au registre ce que le portail montre de lui (crochet `portail`, `games.ts`). Ajouter le jeu n° 3 ne
// change ni ce fichier ni le portail (test `portail.test.ts`, avec un faux jeu).
//
//   GET /api/portail/jour     les jeux du jour (numéro, thème, seuils), l'heure du serveur et le prochain minuit de Paris ; avec `X-Player-Id`,
//                             l'état du joueur dans chaque jeu, sa série tous jeux confondus et ses journées parfaites. **Une requête** au chargement.
//   GET /api/portail/profil   (`X-Player-Id`) le profil commun : pseudo, série, journées parfaites, et par jeu jours finis, médailles, meilleure place.
//   GET /api/portail/classement?date=   (lot I3) le classement du jour tous jeux confondus : les 50 premiers (pseudo, points, médaille par jeu) et,
//                             avec `X-Player-Id`, ta ligne. Jours passés lisibles ; jours futurs refusés (`unknown_day`).
//
// **Lot I3 — la journée partagée** : le numéro de journée commun (`journee` : la journée n° 1 est le lancement public, `config/lancement.json`, lot R8) ; les **points du
// jour** (barème : `classementDuJour.ts`) et le classement du jour tous jeux confondus. La route agrège sans connaître les jeux : chacun rend ses classés
// du jour (`portail.classes`). Le classement du jour est **calculé au plus une fois par fenêtre** (`CLASSEMENT_FENETRE_MS`) **et par instance**, jamais à
// chaque requête (une ligne lue par classé et par jeu) ; un jour fermé est figé, gardé plus longtemps. Ta propre ligne est exacte (tes états, lus à
// l'instant) même quand le classement gardé date de quelques secondes.
//
// **Série tous jeux confondus** : le nombre de jours de Paris consécutifs où le joueur a fini (été classé dans) **au moins un** jeu du jour. Si
// aujourd'hui n'est pas encore fini, la série court jusqu'à hier (`aProlonger` : joue aujourd'hui pour la garder). Une série cassée vaut 0.
// **Journée parfaite** : un jour où le joueur a fini **tous les jeux qui existaient ce jour-là** (premier jour de chaque jeu). Les jours sont des
// numéros de jours de Paris (`parisDay`) : un jour de 23 h ou de 25 h (changements d'heure) compte pour un, comme tous les autres.
//
// **Cache** (règle du lot P4, `cache.ts`) : sans joueur, la réponse est **publique**, gardée au plus `PORTAIL_PUBLIC_MAX_S` et jamais au-delà
// du prochain minuit de Paris ; avec `X-Player-Id`, **jamais publique** (`private, no-cache`). Les deux portent `Vary: X-Player-Id` : un cache
// partagé qui garde la réponse publique ne la sert pas à une requête qui porte un identifiant. Lectures comptées **en mémoire** (aucune écriture,
// sauf les places finales d'un jour fermé du profil commun, calculées une fois).

/** Au plus 60 s de cache pour la réponse publique (et jamais au-delà du prochain minuit de Paris). */
export const PORTAIL_PUBLIC_MAX_S = 60;
/** Lectures du portail par adresse et par fenêtre de débit (10 minutes) : un chargement, le minuit, le profil. */
export const PORTAIL_READS_PER_CLIENT = 120;
/** Lectures du portail par joueur et par fenêtre. */
export const PORTAIL_READS_PER_PLAYER = 60;

// Lot R8 : le premier jour de la journée commune (« Du Jour #1 », le lancement public) n'est plus une constante d'ici : il vient de
// `config/lancement.json` par `@cdj/core` (`PREMIER_JOUR_DU_JOUR`, `numeroDeJournee`). `createPortailRoutes(…, premierJour)` le reçoit (la
// recette peut le déplacer : `LANCEMENT_PREMIER_JOUR`, jamais en production). Avant ce jour : aucun numéro, et le classement du jour refuse
// les jours d'avant (`unknown_day`) : les archives commencent à la journée n° 1.
export { PREMIER_JOUR_DU_JOUR, numeroDeJournee };

/** Lot I3 : le classement du jour en cours est recalculé au plus une fois toutes les 45 s par instance (30 à 60 s : le compromis entre fraîcheur et lignes lues). */
export const CLASSEMENT_FENETRE_MS = 45_000;
/** Lot I3 : un jour fermé est figé ; gardé 10 min en mémoire (l'effacement d'un joueur vide aussi la mémoire de l'instance). */
export const CLASSEMENT_JOUR_FERME_MS = 10 * 60_000;
/** Lot I3 : combien de jours au plus l'instance garde en mémoire. */
export const CLASSEMENT_JOURS_GARDES = 16;
/** Lot I3 : les premiers de la page de classement. */
export const CLASSEMENT_TOP = 50;
/** Lot I3 : cache public de la page de classement du jour en cours (au plus, et jamais au-delà de minuit) ; un jour fermé : 24 h comme les autres lectures. */
export const CLASSEMENT_PUBLIC_MAX_S = 30;
export const CLASSEMENT_FERME_MAX_S = 86_400;
/** Lot I3 : la grâce après minuit pendant laquelle la veille accepte encore des temps (la même que `GRACE_MS` de DailyTrack et de DailyJump). */
export const CLASSEMENT_GRACE_MS = 10 * 60_000;

/** Un jeu du registre vu par le portail : son code et son crochet. */
export interface JeuPortail {
  code: string;
  portail: PortailDuJeu;
}

/** Un jeu du jour dans la réponse publique. */
export interface JeuDuJour extends JourPortail {
  jeu: string;
  /** Lot I3 : le dossier du jeu sur le site et son nom (« Jeu suivant du jour : Jump » sans connaître le jeu d'avance). */
  site: string;
  nom: string;
  /** Le premier jour du jeu (`AAAA-MM-JJ`). */
  premierJour: string;
}

/** Série et journées parfaites (voir l'en-tête du fichier). */
export interface Serie {
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
}

/**
 * La série tous jeux confondus et les journées parfaites, à partir des jours finis de chaque jeu (numéros de jours de Paris). Pure (testée sur
 * les changements d'heure : un numéro de jour est un jour, quelle que soit sa durée).
 */
export function serieEtParfaites(today: number, jeux: readonly { premierJour: number; finis: ReadonlySet<number> }[]): Serie {
  const fini = (d: number) => jeux.some((j) => j.finis.has(d));
  const parfaite = (d: number) => {
    const existants = jeux.filter((j) => j.premierJour <= d);
    return existants.length > 0 && existants.every((j) => j.finis.has(d));
  };
  const finiAujourdhui = fini(today);
  let serie = 0;
  for (let d = finiAujourdhui ? today : today - 1; fini(d); d--) serie++;
  const jours = new Set<number>();
  for (const j of jeux) for (const d of j.finis) if (d <= today) jours.add(d);
  let journeesParfaites = 0;
  for (const d of jours) if (parfaite(d)) journeesParfaites++;
  return { serie, aProlonger: !finiAujourdhui && serie > 0, journeesParfaites, aujourdhuiParfaite: parfaite(today) };
}

export function createPortailRoutes(platform: Platform, jeux: readonly JeuPortail[], premierJour: number = PREMIER_JOUR_DU_JOUR) {
  const { now, log, today, players, hashKey, readHit, playerIdOf } = platform;

  /** L'identifiant de l'en-tête `X-Player-Id` (jamais dans l'adresse), ou `null` sans en-tête. */
  function joueurDe(req: Request): string | null {
    const raw = req.headers.get("x-player-id");
    return raw === null || raw === "" ? null : playerIdOf(raw);
  }

  async function limiter(info: RequestInfo, id: string | null): Promise<void> {
    await platform.readHitAddress(info, "ptl", PORTAIL_READS_PER_CLIENT);
    if (id) readHit(await hashKey("ptlp", id), PORTAIL_READS_PER_PLAYER);
  }

  /** Les jeux qui existent ce jour-là. Un jeu dont le niveau du jour est indisponible garde son numéro, sans thème ni seuils (rien de bloquant). */
  async function jeuxDuJour(day: number): Promise<JeuDuJour[]> {
    const ouverts = jeux.filter((j) => j.portail.premierJour <= day);
    return Promise.all(
      ouverts.map(async (j) => {
        let jour: JourPortail;
        try {
          jour = await j.portail.jour(day);
        } catch (e) {
          log("WARNING", "portail : jour d'un jeu indisponible", { jeu: j.code, error: e instanceof HttpError ? e.code : "inconnue" });
          jour = { numero: day - j.portail.premierJour + 1, theme: null, seuils: null };
        }
        return { jeu: j.code, site: j.portail.site, nom: j.portail.nom, premierJour: formatDay(j.portail.premierJour), ...jour };
      }),
    );
  }

  /** La partie publique : les jeux du jour, l'heure du serveur, le prochain minuit de Paris (ISO, UTC). */
  async function partiePublique(day: number) {
    const t = now();
    return {
      date: formatDay(day),
      journee: numeroDeJournee(day, premierJour),
      /** Lot R8 : le jour de la journée n° 1 (AAAA-MM-JJ) : la source unique, vérifiée par le workflow de remise à zéro de la production. */
      lancement: formatDay(premierJour),
      /** Lot R8 : la génération de données (remise à zéro du lancement) : un navigateur qui en garde une plus ancienne efface ses données de jeu. */
      generation: await platform.generation(),
      maintenant: new Date(t).toISOString(),
      prochainJour: new Date(parisDayStart(day + 1)).toISOString(),
      jeux: await jeuxDuJour(day),
    };
  }

  async function serieDe(id: string, day: number): Promise<Serie> {
    const finis = await Promise.all(jeux.map(async (j) => ({ premierJour: j.portail.premierJour, finis: new Set(await j.portail.joursFinis(id)) })));
    return serieEtParfaites(day, finis);
  }

  /**
   * Le joueur doit exister (un résultat classé dans un jeu) et son code être valide ; sinon le refus porte quand même la partie publique (`jour`)
   * : le portail n'a qu'une requête au chargement, il affiche le jour même pour un joueur que le serveur ne connaît pas.
   */
  async function joueurConnu(id: string, publique?: Record<string, unknown>): Promise<{ name: string; rename_required: number }> {
    try {
      await players.assertActive(id);
    } catch (e) {
      if (e instanceof HttpError && e.code === "code_revoked" && publique) throw new HttpError(410, "code_revoked", e.message, {}, publique);
      throw e;
    }
    const row = await players.find(id);
    if (!row) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir", {}, publique ?? {});
    return row;
  }

  // --- Lot I3 : les points et le classement du jour ---------------------------------------------------------------------------
  /** Le jour accepte-t-il encore des temps (aujourd'hui, ou hier pendant la grâce) ? Sinon son classement est figé. */
  const jourOuvert = (day: number): boolean => day >= today() || (day === today() - 1 && platform.sinceMidnight() < CLASSEMENT_GRACE_MS);

  /** Une entrée gardée : le classement, et les pseudos de son haut (lus au premier besoin, gardés avec lui : la page ne relit rien tant que la fenêtre dure). */
  interface Gardee {
    at: number;
    pending: Promise<ClassementDuJour>;
    noms: Promise<Map<string, string>> | null;
  }
  const classements = new Map<number, Gardee>();
  let calculs = 0;

  /**
   * Le classement du jour, calculé **au plus une fois par fenêtre et par instance** (un seul calcul même si deux requêtes arrivent ensemble) : une
   * ligne lue par classé et par jeu. Un jour fermé est figé : gardé `CLASSEMENT_JOUR_FERME_MS`.
   */
  function gardeeDe(day: number): Gardee {
    const kept = classements.get(day);
    const duree = jourOuvert(day) ? CLASSEMENT_FENETRE_MS : CLASSEMENT_JOUR_FERME_MS;
    if (kept && now() - kept.at < duree) return kept;
    calculs++;
    const ouverts = jeux.filter((j) => j.portail.premierJour <= day);
    const pending = Promise.all(ouverts.map(async (j) => ({ jeu: j.code, classes: await j.portail.classes(day) }))).then(classerLaJournee);
    if (classements.size >= CLASSEMENT_JOURS_GARDES) for (const [d] of classements) if (d !== day) { classements.delete(d); break; }
    const neuve: Gardee = { at: now(), pending, noms: null };
    classements.set(day, neuve);
    // Un calcul qui échoue n'est pas gardé : la requête suivante réessaie.
    pending.catch(() => {
      if (classements.get(day) === neuve) classements.delete(day);
    });
    return neuve;
  }
  const classementDe = (day: number): Promise<ClassementDuJour> => gardeeDe(day).pending;

  /** Le bilan exact d'un joueur ce jour-là, à partir de ses états dans chaque jeu du jour (`ouverts`, dans l'ordre du classement). */
  function bilanDe(etats: readonly EtatPortail[], classesParJeu: readonly number[]): { points: number; sommeRangs: number; resultats: (ResultatJeu | null)[]; fini: boolean } {
    const resultats = etats.map<ResultatJeu | null>((e) => (e.statut === "fini" ? { rang: e.rang, medaille: e.medaille } : null));
    return { points: resultats.reduce((s, r) => s + (r ? pointsDe(r.medaille) : 0), 0), sommeRangs: sommeDesRangs(resultats, classesParJeu), resultats, fini: resultats.some((r) => r !== null) };
  }

  /**
   * Les états d'un joueur dans chaque jeu du jour. Lot I3 : avec le classement du jour gardé (`c`), un jeu déjà fini par ce joueur dans ce classement donne sa
   * place et ses classés sans les recompter (le coût d'une visite ne croît plus avec le nombre de joueurs) ; absent du classement (il vient de finir) : le jeu compte.
   */
  const etatsDe = (id: string, day: number, ouverts: readonly JeuPortail[], c?: ClassementDuJour) => {
    const ligne = c && c.index.has(id) ? c.lignes[c.index.get(id)!]! : null;
    return Promise.all(ouverts.map((j, g) => j.portail.etat(id, day, ligne?.resultats[g] ? { rang: ligne.resultats[g]!.rang, classes: c!.classesParJeu[g]! } : undefined)));
  };

  /** `{ jeu: { rang, medaille } | null }` : la médaille de chaque jeu du jour (`null` : pas fini). */
  const resultatsCorps = (jeuxDuJour: readonly string[], resultats: readonly (ResultatJeu | null)[]) =>
    Object.fromEntries(jeuxDuJour.map((code, g) => [code, resultats[g] ? { rang: resultats[g]!.rang, medaille: resultats[g]!.medaille } : null]));

  async function jour(req: Request, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    await limiter(info, id);
    const day = today();
    const publique = await partiePublique(day);
    if (!id) {
      // Publique : au plus 60 s, jamais au-delà du prochain minuit de Paris (le jour suivant n'est pas servi d'avance, l'ancien pas après).
      const restant = Math.floor((parisDayStart(day + 1) - now()) / 1000);
      const maxAge = Math.max(0, Math.min(PORTAIL_PUBLIC_MAX_S, restant));
      return new WithHeaders(publique, { "Cache-Control": `public, max-age=${maxAge}`, Vary: "X-Player-Id" });
    }
    const row = await joueurConnu(id, publique);
    const ouverts = jeux.filter((j) => j.portail.premierJour <= day);
    // Lot I3 : le classement du jour gardé (calculé au plus une fois par fenêtre et par instance : jamais à chaque visite) donne sa place et ses classés ;
    // ses points sont exacts (ses états à l'instant). Aucun jeu fini aujourd'hui : pas de rang.
    const c = await classementDe(day);
    const [etats, serie] = await Promise.all([etatsDe(id, day, ouverts, c), serieDe(id, day)]);
    const etatDe = new Map<string, EtatPortail>(ouverts.map((j, i) => [j.code, etats[i]!] as const));
    let points = 0;
    let rangDuJour: number | null = null;
    let classesDuJour: number | null = null;
    if (etats.some((e) => e.statut === "fini")) {
      const bilan = bilanDe(etats, c.classesParJeu);
      points = bilan.points;
      ({ rang: rangDuJour, classes: classesDuJour } = placer(c, { id, points: bilan.points, sommeRangs: bilan.sommeRangs }));
    }
    const body = {
      ...publique,
      jeux: publique.jeux.map((j) => ({ ...j, etat: etatDe.get(j.jeu) ?? { statut: "pas_joue" } })),
      joueur: { pseudo: row.name, ...serie, points, rangDuJour, classesDuJour },
    };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  /** Les pseudos des joueurs (une requête, jamais l'identifiant dans la réponse). */
  async function pseudosDe(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await platform.db.all<{ id: string; name: string }>(`SELECT id, name FROM players WHERE id IN (${ids.map(() => "?").join(",")})`, [...ids]);
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** `GET /api/portail/classement?date=` : les 50 premiers et, avec `X-Player-Id`, ta ligne (exacte). */
  async function classement(req: Request, url: URL, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    await limiter(info, id);
    const aujourdhui = today();
    const brut = url.searchParams.get("date");
    const day = brut === null ? aujourdhui : parseDay(brut);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    const ouverts = jeux.filter((j) => j.portail.premierJour <= day);
    // Lot R8 : depuis le lancement, les jours d'avant la journée n° 1 ne sont plus lisibles ; avant lui, rien n'est refusé (période d'essai).
    const avantLancement = premierJour <= aujourdhui && day < premierJour;
    if (day > aujourdhui || avantLancement || ouverts.length === 0) throw new HttpError(404, "unknown_day", "Ce classement n'existe pas (encore)");
    const gardee = gardeeDe(day);
    const c = await gardee.pending;
    const gardes = c.lignes.slice(0, CLASSEMENT_TOP);
    // Les pseudos du haut sont lus une fois avec le classement (un changement de pseudo se voit à la fenêtre suivante, 45 s au plus).
    const noms = await (gardee.noms ??= pseudosDe(gardes.map((l) => l.id)).catch((e) => {
      gardee.noms = null;
      throw e;
    }));
    const ligneCorps = (l: LigneDuJour, rang: number, pseudo: string) => ({ rang, pseudo, points: l.points, resultats: resultatsCorps(c.jeux, l.resultats) });
    const ouvert = jourOuvert(day);
    const publique = {
      date: formatDay(day),
      journee: numeroDeJournee(day, premierJour),
      ouvert,
      bareme: BAREME_POINTS,
      jeux: ouverts.map((j) => ({ jeu: j.code, site: j.portail.site, nom: j.portail.nom })),
      classes: c.lignes.length,
      top: gardes.map((l, i) => ligneCorps(l, i + 1, noms.get(l.id) ?? "?")),
    };
    if (!id) {
      const restant = Math.floor((parisDayStart(aujourdhui + 1) - now()) / 1000);
      const maxAge = ouvert ? Math.max(0, Math.min(CLASSEMENT_PUBLIC_MAX_S, restant)) : CLASSEMENT_FERME_MAX_S;
      return new WithHeaders(publique, { "Cache-Control": `public, max-age=${maxAge}`, Vary: "X-Player-Id" });
    }
    const row = await joueurConnu(id, publique);
    let moi: (ReturnType<typeof ligneCorps> & { classes: number }) | null = null;
    const gardeeIndex = c.index.get(id);
    if (gardeeIndex !== undefined) {
      // Dans le classement gardé : sa ligne en vient (rien à relire ; au plus quelques secondes de retard, comme tout le classement).
      moi = { ...ligneCorps(c.lignes[gardeeIndex]!, gardeeIndex + 1, row.name), classes: c.lignes.length };
    } else {
      // Absent (il vient de finir, ou n'a rien fini) : ses états, lus à l'instant, donnent sa ligne exacte et sa place d'insertion.
      const bilan = bilanDe(await etatsDe(id, day, ouverts, c), c.classesParJeu);
      if (bilan.fini) {
        const place = placer(c, { id, points: bilan.points, sommeRangs: bilan.sommeRangs });
        moi = { ...ligneCorps({ id, points: bilan.points, sommeRangs: bilan.sommeRangs, at: 0, resultats: bilan.resultats }, place.rang, row.name), classes: place.classes };
      }
    }
    const body = { ...publique, top: publique.top.map((r, i) => (gardes[i]!.id === id ? { ...r, moi: true } : r)), moi };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  async function profil(req: Request, info: RequestInfo): Promise<WithHeaders> {
    const id = joueurDe(req);
    if (!id) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
    await limiter(info, id);
    const row = await joueurConnu(id);
    const day = today();
    const [serie, parJeu] = await Promise.all([serieDe(id, day), Promise.all(jeux.map(async (j) => ({ jeu: j.code, ...(await j.portail.profil(id)) })))]);
    const body = { pseudo: row.name, renameRequired: row.rename_required === 1, date: formatDay(day), ...serie, jeux: parJeu };
    return new WithHeaders(body, { "Cache-Control": "private, no-cache", Vary: "X-Player-Id" });
  }

  /** Les routes du portail ; `undefined` : ce chemin n'est pas au portail. */
  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path !== "/api/portail" && !path.startsWith("/api/portail/")) return undefined;
    if (path === "/api/portail/jour") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await jour(req, info);
    }
    if (path === "/api/portail/profil") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await profil(req, info);
    }
    if (path === "/api/portail/classement") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await classement(req, _url, info);
    }
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  return {
    route,
    /** Vide la mémoire de l'instance (effacement d'un joueur : il ne doit plus figurer dans un classement gardé). */
    oublier: () => classements.clear(),
    /** Combien de classements du jour cette instance a calculés (mesures et tests). */
    calculs: () => calculs,
  };
}
