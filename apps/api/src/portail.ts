import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { EtatPortail, JourPortail, Platform, PortailDuJeu, RequestInfo } from "./games";

// Le portail « Du Jour » (lot I2 de la plateforme, phase 3) : les lectures regroupées de la page d'accueil et du profil commun. Elles ne
// connaissent aucun jeu : chacun déclare au registre ce que le portail montre de lui (crochet `portail`, `games.ts`). Ajouter le jeu n° 3 ne
// change ni ce fichier ni le portail (test `portail.test.ts`, avec un faux jeu).
//
//   GET /api/portail/jour     les jeux du jour (numéro, thème, seuils), l'heure du serveur et le prochain minuit de Paris ; avec `X-Player-Id`,
//                             l'état du joueur dans chaque jeu, sa série tous jeux confondus et ses journées parfaites. **Une requête** au chargement.
//   GET /api/portail/profil   (`X-Player-Id`) le profil commun : pseudo, série, journées parfaites, et par jeu jours finis, médailles, meilleure place.
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

/** Un jeu du registre vu par le portail : son code et son crochet. */
export interface JeuPortail {
  code: string;
  portail: PortailDuJeu;
}

/** Un jeu du jour dans la réponse publique. */
export interface JeuDuJour extends JourPortail {
  jeu: string;
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

export function createPortailRoutes(platform: Platform, jeux: readonly JeuPortail[]) {
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
        return { jeu: j.code, premierJour: formatDay(j.portail.premierJour), ...jour };
      }),
    );
  }

  /** La partie publique : les jeux du jour, l'heure du serveur, le prochain minuit de Paris (ISO, UTC). */
  async function partiePublique(day: number) {
    const t = now();
    return { date: formatDay(day), maintenant: new Date(t).toISOString(), prochainJour: new Date(parisDayStart(day + 1)).toISOString(), jeux: await jeuxDuJour(day) };
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
    const [etats, serie] = await Promise.all([
      Promise.all(jeux.filter((j) => j.portail.premierJour <= day).map(async (j) => [j.code, await j.portail.etat(id, day)] as const)),
      serieDe(id, day),
    ]);
    const etatDe = new Map<string, EtatPortail>(etats);
    const body = {
      ...publique,
      jeux: publique.jeux.map((j) => ({ ...j, etat: etatDe.get(j.jeu) ?? { statut: "pas_joue" } })),
      joueur: { pseudo: row.name, ...serie },
    };
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
    throw new HttpError(404, "not_found", "Route inconnue");
  }

  return { route };
}
