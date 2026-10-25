import { GENERATOR_VERSION, SIM_VERSION, formatDay } from "@cdj/sim";
import { parisClockSource } from "@cdj/clock";
import type { CdjInstance, CdjOptions } from "./cdj";
import { WithHeaders, mergeVary } from "./cache";
import type { SqlDb } from "./db";
import { CODES_ERREUR, ERREUR_INTERNE, corpsErreur } from "./codesErreur";
import { HttpError } from "./errors";
import type { GameDefinition, GameInstance, RequestInfo } from "./games";
import { createIdentityRoutes } from "./identity";
import { silentLog, type Logger } from "./log";
import { DEFAULT_LIMITS, createPlatform } from "./platform";
import { createPortailRoutes } from "./portail";
import { GAMES } from "./registry";
import { salonSessionMs, type SalonLimits } from "./salon";

// API de la plateforme (DailyTrack, DailyJump). Elle ne fait confiance à aucun temps annoncé : elle reçoit la rediffusion (la suite des
// commandes du joueur), la rejoue avec le même code de simulation que le jeu, et n'enregistre que le temps qu'elle a elle-même recalculé.
//
// Elle ne dépend que de l'API Web standard (Request/Response) et de `SqlDb` : elle tourne telle quelle sur
// Cloudflare Workers (+ D1) et sur Node (+ SQLite).
//
// Lot P0 (plateforme) : ce fichier ne fait plus qu'assembler. Ce qui est commun à tous les jeux est dans `platform.ts` (débit, entrées, joueurs,
// schéma) et `identity.ts` (pseudo, profil, code) ; chaque jeu est une définition du registre (`registry.ts` : DailyTrack dans `cdj.ts`,
// routes historiques inchangées ; DailyJump dans `jump.ts`, sous `/api/jump/`). `/api/health` ne change pas.

export { MAX_BODY_BYTES } from "./platform";
export { ADMIN_MAX_FAILURES, ADMIN_TOKEN_MIN, GRACE_MS, PLANNING_HORIZON } from "./cdj";
export type { RequestInfo } from "./games";

export interface ApiOptions {
  db: SqlDb;
  now?: () => number;
  /** Valeur de `Access-Control-Allow-Origin` (« * » par défaut : aucune session, l'identité est dans le corps). */
  allowOrigin?: string;
  /**
   * Origines autorisées (CORS), variable d'environnement `ALLOWED_ORIGINS` : l'adresse du jeu (`https://<compte>.github.io`, sans chemin :
   * les aperçus de branche en font partie). Remplace `allowOrigin` : l'origine de la requête est répétée si elle figure dans la liste,
   * sinon aucun en-tête CORS n'est envoyé (le navigateur refuse). `*` autorise tout le monde.
   */
  allowedOrigins?: string[];
  /** Journal structuré (voir `log.ts`) ; silencieux par défaut (tests). */
  log?: Logger;
  /** Identifiant de la version déployée (`GIT_SHA`, `K_REVISION`), répété dans `/api/health`. */
  revision?: string;
  /** Sel pour hacher les adresses IP avant de les compter (on ne stocke jamais d'IP en clair). */
  rateSalt?: string;
  limits?: { windowMs: number; perClient: number; perPlayer: number };
  /**
   * Lot R5 : plafond global de rejeux par minute de cette instance (503 `busy` au-delà). `server.ts` pose `REPLAYS_PER_MINUTE` ; absent :
   * aucun plafond (outils qui rejouent en masse en mémoire, tests).
   */
  replaysPerMinute?: number;
  /** Lot R5 : multiple des limites par adresse pour l'adresse de connexion (`PEER_FACTOR`, défaut 10 ; 0 : coupé). */
  peerFactor?: number;
  /**
   * Marque `demo` les joueurs créés par cette instance : réservé au script `history:seed` (lot 11), qui fait courir des
   * pilotes fictifs par le même chemin de validation que les vrais. Le serveur de production ne le règle jamais.
   */
  demoPlayers?: boolean;
  /**
   * Jeton de l'admin (lot 14) : donne accès à `/api/admin/*` (planning des circuits). Variable d'environnement `ADMIN_TOKEN`,
   * jamais dans le dépôt. Absent ou de moins de `ADMIN_TOKEN_MIN` caractères : l'admin est désactivé (les routes n'existent pas).
   */
  adminToken?: string;
  /**
   * Durée d'une session du Salon en minutes (0,5 à 60 ; 10 par défaut). Variable d'environnement `SALON_MINUTES` : **tests et
   * essais locaux seulement**, absente en production (une session n'a pas la même durée pour tous si elle change).
   */
  salonMinutes?: number;
  /** Vrai quand `now` vient de `TEST_CLOCK` (tests seulement) : signalé par /api/health, toujours absent en production. */
  testClock?: boolean;
  /** Limites de débit du Salon (voir `DEFAULT_SALON_LIMITS`). */
  salonLimits?: Partial<SalonLimits>;
  /** Lot P0 : `production`, `recette` ou `local` (`ENVIRONMENT`, `config.ts`), rendu par `/api/jump/info` ; `local` par défaut. */
  environment?: string;
  /** Lot P0 : les niveaux figés de DailyJump inclus dans l'image (date → contenu du fichier), lus à la construction. */
  jumpFrozen?: Readonly<Record<string, unknown>>;
  /**
   * Lot I2 : le registre des jeux (`GAMES` par défaut). **Tests seulement** (un faux jeu n° 3 prouve que le portail ne change pas) : `server.ts`
   * ne le règle jamais. Un faux jeu n'a pas de tables (le schéma est celui de `GAMES`).
   */
  games?: readonly GameDefinition<never>[];
  /**
   * Lot R8 : le jour de la journée n° 1 (jours depuis 1970) ; défaut : celui de `config/lancement.json` (`@cdj/core`). `LANCEMENT_PREMIER_JOUR`
   * (`config.ts`) le déplace sur la recette et en local ; la production le refuse.
   */
  premierJourDuJour?: number;
}

export function createApi(options: ApiOptions) {
  const { db } = options;
  const now = options.now ?? Date.now;
  const allowOrigin = options.allowOrigin ?? "*";
  const allowedOrigins = options.allowedOrigins?.map((o) => o.trim().replace(/\/+$/, "").toLowerCase()).filter(Boolean);
  const log = options.log ?? silentLog;
  const sessionMs = salonSessionMs(options.salonMinutes) ?? 600_000;

  // La plateforme, puis chaque jeu du registre. « Changer mon code » : les lignes de chaque jeu suivent, dans la même transaction.
  const instances: { code: string; prefix: string; instance: GameInstance }[] = [];
  const platform = createPlatform({
    db,
    now,
    log,
    environment: options.environment ?? "local",
    limits: options.limits ?? DEFAULT_LIMITS,
    rateSalt: options.rateSalt,
    replaysPerMinute: options.replaysPerMinute,
    peerFactor: options.peerFactor,
    demoPlayers: options.demoPlayers === true,
    rotateStatements: (oldId, newId) => instances.flatMap((g) => g.instance.rotateStatements?.(oldId, newId) ?? []),
  });
  const ensureSchema = platform.ensureSchema;
  const gameOptions: Record<string, unknown> = {
    cdj: { adminToken: options.adminToken, salonMinutes: options.salonMinutes, salonLimits: options.salonLimits, demoPlayers: options.demoPlayers } satisfies CdjOptions,
    jump: { frozen: options.jumpFrozen },
  };
  for (const g of options.games ?? GAMES) instances.push({ code: g.code, prefix: g.prefix, instance: g.create(platform, gameOptions[g.code] as never) });
  const byPrefix = [...instances].sort((a, b) => b.prefix.length - a.prefix.length);
  const cdj = instances.find((g) => g.code === "cdj")!.instance as CdjInstance; // DailyTrack est toujours au registre (admin, Salon)
  // Lot R5 : les routes d'admin de la plateforme (effacement d'un joueur) gardées par le jeton de l'admin de DailyTrack (`ADMIN_TOKEN`).
  // Lot I3 : l'effacement d'un joueur vide aussi la mémoire du portail (`portail.oublier`, défini juste après).
  const identity = createIdentityRoutes(
    platform,
    instances.map((g) => g.instance),
    (req, info) => cdj.requireAdmin(req, info),
    () => portail.oublier(),
  );
  // Lot I2 : le portail (accueil et profil commun), à partir de ce que chaque jeu déclare (crochet `portail`).
  const portail = createPortailRoutes(
    platform,
    instances.flatMap((g) => (g.instance.portail ? [{ code: g.code, portail: g.instance.portail }] : [])),
    options.premierJourDuJour,
  );
  // Lot R8 : la remise à zéro du lancement vide la base ; une instance qui voit la génération changer oublie sa mémoire (comme après un effacement).
  platform.onGenerationChange(() => {
    for (const g of instances) g.instance.onErased?.();
    portail.oublier();
  });
  const salon = cdj.salon;
  const today = platform.today;

  // --- Entrée -----------------------------------------------------------------------------------------------
  /** En-têtes CORS d'une requête : liste d'origines (`ALLOWED_ORIGINS`) ou, à défaut, la valeur unique `allowOrigin`. */
  function corsFor(req: Request): Record<string, string> {
    const common = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Player-Id",
      "Access-Control-Max-Age": "86400",
    };
    if (!allowedOrigins) return { "Access-Control-Allow-Origin": allowOrigin, ...common };
    if (allowedOrigins.includes("*")) return { "Access-Control-Allow-Origin": "*", ...common };
    const origin = req.headers.get("origin");
    const ok = origin !== null && allowedOrigins.includes(origin.trim().replace(/\/+$/, "").toLowerCase());
    return { ...(ok ? { "Access-Control-Allow-Origin": origin } : {}), Vary: "Origin", ...common };
  }
  const replier = (req: Request) => {
    const cors = corsFor(req);
    return (status: number, body: unknown, extra: Record<string, string> = {}) => {
      // Lot P4 : une lecture d'un jeu peut porter son `Cache-Control` et son `Vary` (`cache.ts`) ; `Vary: Origin` de CORS est gardé.
      const vary = mergeVary(cors.Vary, extra.Vary);
      return new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra, ...(vary ? { Vary: vary } : {}) },
      });
    };
  };
  /** Le corps d'une route : tel quel, ou avec ses en-têtes (`WithHeaders`, lot P4). */
  const answer = (reply: ReturnType<typeof replier>, body: unknown) => (body instanceof WithHeaders ? reply(200, body.body, body.headers) : reply(200, body));

  /** Santé : version, base joignable, durée du Salon. Toujours en 200 si la base répond, en 503 sinon (la sonde de Cloud Run et la CI s'y fient). */
  async function health(reply: ReturnType<typeof replier>): Promise<Response> {
    const body = {
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      today: formatDay(today()),
      /** Comment « aujourd'hui » est lu à Paris : `intl` (fuseaux de l'environnement) ou `table` (règle d'heure d'été). */
      clock: parisClockSource,
      salonMinutes: sessionMs / 60_000,
      /** Vrai si `SALON_MINUTES` est réglée (essais locaux seulement) : doit toujours être faux en production. */
      salonOverride: options.salonMinutes !== undefined,
      ...(options.testClock ? { testClock: true } : {}),
      ...(options.revision ? { revision: options.revision } : {}),
    };
    try {
      await ensureSchema();
      await db.first("SELECT 1 AS ok");
      return reply(200, { ok: true, db: "ok", ...body });
    } catch (e) {
      log("ERROR", "santé : base injoignable", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" });
      // Lot I1 : le code des autres erreurs, en plus de `ok` et `db` (que la sonde, `smoke` et la CI lisent). Lot I6 : plus de `message`.
      return reply(CODES_ERREUR.db_unavailable.status, { ok: false, db: "error", ...corpsErreur("db_unavailable"), ...body });
    }
  }

  /**
   * Lot R5 — **recette seulement** (`ENVIRONMENT=recette` ; 404 ailleurs) : ce qu'un appel porte jusqu'au serveur, pour comparer un appel passé
   * par Firebase et un appel direct à `run.app` (`node scripts/sonde-proxy.mjs entetes …`). Rien n'est écrit ni journalisé. Rend les **noms**
   * des en-têtes (jamais leurs valeurs, sauf les hôtes), le nombre d'entrées de `X-Forwarded-For` et l'adresse de connexion (`peerKey` :
   * l'appelant lui-même pour un appel direct, un relais de Firebase sinon).
   */
  function probeHeaders(req: Request, info: RequestInfo): Record<string, unknown> {
    const xff = req.headers.get("x-forwarded-for");
    return {
      hote: req.headers.get("host"),
      hoteTransmis: req.headers.get("x-forwarded-host"),
      hoteFirebase: req.headers.get("x-fh-requested-host"),
      entetes: [...req.headers.keys()].sort(),
      relais: xff ? xff.split(",").filter((p) => p.trim()).length : 0,
      // L'appelant lit ce qu'il a lui-même envoyé, plus ce que Google y a ajouté (son adresse, ou celle d'un relais de Firebase) : recette seulement.
      xForwardedFor: xff,
      forwarded: req.headers.get("forwarded"),
      connexion: info.peerKey ?? null,
      adresseLueEgaleConnexion: info.clientKey !== undefined && info.clientKey === info.peerKey,
    };
  }

  async function handle(req: Request, info: RequestInfo = {}): Promise<Response> {
    const reply = replier(req);
    try {
      if (req.method === "OPTIONS") return reply(204, null);
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "");
      if (path === "/api/health" && req.method === "GET") return await health(reply);
      if (path === "/api/sonde/entetes" && req.method === "GET" && options.environment === "recette") return reply(200, probeHeaders(req, info));
      await ensureSchema();
      await platform.generation(); // lot R8 : une ligne par instance et par 30 s ; une génération changée vide la mémoire de l'instance

      // Les routes communes (pseudo, profil, code), puis celles de chaque jeu du registre, du préfixe le plus long au plus court.
      const common = (await identity.route(path, req, url, info)) ?? (await portail.route(path, req, url, info));
      if (common !== undefined) return answer(reply, common);
      for (const g of byPrefix) {
        if (path !== g.prefix && !path.startsWith(`${g.prefix}/`)) continue;
        const body = await g.instance.route(path, req, url, info);
        if (body !== undefined) return answer(reply, body);
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 429 || e.status >= 500) log(e.status >= 500 ? "ERROR" : "WARNING", "refus", { status: e.status, code: e.code });
        // Lot I6 : le code et les détails seulement ; le texte de `HttpError` reste dans le code (pour qui le lit), jamais dans la réponse.
        return reply(e.status, { error: e.code, ...e.details }, e.headers);
      }
      log("ERROR", "erreur interne", { error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "inconnue" });
      return reply(CODES_ERREUR.internal.status, ERREUR_INTERNE);
    }
  }

  /**
   * Tâche périodique du serveur (Node : toutes les 15 s) : prépare à l'avance le circuit du Salon. Facultative : sans elle, le
   * circuit se génère à la première requête qui en a besoin (l'oubli des sessions finies se fait de toute façon à la demande).
   */
  async function tick(): Promise<void> {
    try {
      await ensureSchema();
      for (const g of instances) await g.instance.tick?.();
    } catch (e) {
      log("ERROR", "tâche périodique du Salon", { error: e instanceof Error ? e.message.slice(0, 200) : "inconnue" }); // réessayée au prochain passage ; ne doit jamais arrêter le serveur
    }
  }

  /** Le registre en marche : code et préfixe de chaque jeu (documentation, tests). */
  const games = instances.map((g) => ({ code: g.code, prefix: g.prefix }));

  return { handle, tick, salon, games };
}
