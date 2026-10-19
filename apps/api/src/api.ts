import { GENERATOR_VERSION, SIM_VERSION, formatDay } from "@cdj/sim";
import { parisClockSource } from "@cdj/clock";
import type { CdjInstance, CdjOptions } from "./cdj";
import type { SqlDb } from "./db";
import { HttpError } from "./errors";
import type { GameInstance, RequestInfo } from "./games";
import { createIdentityRoutes } from "./identity";
import { silentLog, type Logger } from "./log";
import { DEFAULT_LIMITS, createPlatform } from "./platform";
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
    demoPlayers: options.demoPlayers === true,
    rotateStatements: (oldId, newId) => instances.flatMap((g) => g.instance.rotateStatements?.(oldId, newId) ?? []),
  });
  const ensureSchema = platform.ensureSchema;
  const gameOptions: Record<string, unknown> = {
    cdj: { adminToken: options.adminToken, salonMinutes: options.salonMinutes, salonLimits: options.salonLimits, demoPlayers: options.demoPlayers } satisfies CdjOptions,
    jump: { frozen: options.jumpFrozen },
  };
  for (const g of GAMES) instances.push({ code: g.code, prefix: g.prefix, instance: g.create(platform, gameOptions[g.code] as never) });
  const byPrefix = [...instances].sort((a, b) => b.prefix.length - a.prefix.length);
  const identity = createIdentityRoutes(platform, instances.map((g) => g.instance));
  const salon = (instances.find((g) => g.code === "cdj")!.instance as CdjInstance).salon;
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
    return (status: number, body: unknown, extra: Record<string, string> = {}) =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
      });
  };

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
      return reply(503, { ok: false, db: "error", ...body });
    }
  }

  async function handle(req: Request, info: RequestInfo = {}): Promise<Response> {
    const reply = replier(req);
    try {
      if (req.method === "OPTIONS") return reply(204, null);
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "");
      if (path === "/api/health" && req.method === "GET") return await health(reply);
      await ensureSchema();

      // Les routes communes (pseudo, profil, code), puis celles de chaque jeu du registre, du préfixe le plus long au plus court.
      const common = await identity.route(path, req, url, info);
      if (common !== undefined) return reply(200, common);
      for (const g of byPrefix) {
        if (path !== g.prefix && !path.startsWith(`${g.prefix}/`)) continue;
        const body = await g.instance.route(path, req, url, info);
        if (body !== undefined) return reply(200, body);
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 429 || e.status >= 500) log(e.status >= 500 ? "ERROR" : "WARNING", "refus", { status: e.status, code: e.code });
        return reply(e.status, { error: e.code, message: e.message, ...e.details }, e.headers);
      }
      log("ERROR", "erreur interne", { error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "inconnue" });
      return reply(500, { error: "internal", message: "Erreur interne" });
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
