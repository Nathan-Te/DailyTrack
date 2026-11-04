import { GENERATOR_VERSION, SIM_VERSION, formatDay } from "@cdj/sim";
import { msUntilNextParisDay, parisClockSource } from "@cdj/clock";
import { createAdmin, type Admin, type AdminOptions } from "./admin";
import { createAmis } from "./amis";
import type { CdjInstance, CdjOptions } from "./cdj";
import type { JumpOptions } from "./jump";
import { WithHeaders, mergeVary } from "./cache";
import type { SqlDb } from "./db";
import type { Mesures } from "./mesures";
import { routeDe } from "./journaux";
import { CODES_ERREUR, ERREUR_INTERNE, corpsErreur } from "./codesErreur";
import { HttpError } from "./errors";
import type { GameDefinition, GameInstance, RequestInfo } from "./games";
import { createDiffusion } from "./diffusion";
import { createJeux } from "./jeux";
import { createIdentityRoutes } from "./identity";
import { createRetours } from "./retours";
import { createAvatars } from "./avatars";
import { createGroupes, proprietaireGroupe } from "./groupes";
import { aNoter } from "./journaux";
import { silentLog, type Logger } from "./log";
import { DEFAULT_LIMITS, createPlatform } from "./platform";
import { createPortailRoutes } from "./portail";
import type { TowerOptions } from "./tower";
import type { ExecuteurRejeu } from "./towerRejeu";
import type { ExecuteurNiveaux } from "./niveauxFil";
import { jeuxPourEnvironnement } from "./registry";
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

/**
 * Lot R7 : en-têtes de toute réponse de l'API (du JSON, jamais une page) : le navigateur ne doit ni deviner un autre type (`nosniff`), ni
 * afficher une réponse dans un cadre, ni charger quoi que ce soit si elle était ouverte comme une page.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
};

export interface ApiOptions {
  db: SqlDb;
  /**
   * Lot D3 : les mesures de l'instance (retard de la boucle d'événements, étapes d'un envoi, ramasse-miettes : `mesures.ts`), créées par `server.ts`. Absentes : rien n'est mesuré (tests, outils).
   * Elles ne changent aucune réponse : seulement des lignes de journal.
   */
  mesures?: Mesures;
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
   * Lot R9 : **les classements du jour refusent les copies** (409 `replay_copy` : `copies.ts`) ; `true` les laisse passer. Réservé aux outils qui fabriquent des
   * données fictives (`history:seed`, `jump:seed`, `recette:seed`, le joueur de démonstration : des « Démo » dont l'un a la preuve de l'auteur) et aux tests de
   * classement qui rejouent une même course pour plusieurs joueurs. Le serveur de production ne le règle jamais, `readConfig` ne le connaît pas (test `copies.test.ts`).
   */
  allowCopies?: boolean;
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
  /** Lot TP : les jours de Tower (préparés ou figés) inclus dans l'image (date → contenu du fichier, preuve comprise : elle reste dans l'image), lus à la construction. */
  towerFrozen?: Readonly<Record<string, unknown>>;
  /** Lot TP : ce qui exécute les rejeux de Tower (le fil de calcul, `executeurFil`) ; absent : le fil principal (repli). */
  towerExecuteur?: ExecuteurRejeu;
  /** Lot K4f : les jours figés de l'image de **tout autre jeu** (code du jeu → date → contenu du fichier), lus à la construction d'après les fiches (`jours.dossier`) ; le jeu les reçoit en option `frozen`. */
  joursFiges?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /**
   * Lot D3 : ce qui calcule le niveau de Jump et le circuit de Track d'un jour (le fil de calcul `niveaux-fil.mjs`, `server.ts`) ; absent : sur place dans le fil principal (tests, outils, développement),
   * comme avant le lot D3. Le niveau est le même ; seul le fil qui le calcule change.
   */
  niveauxExecuteur?: ExecuteurNiveaux;
  /**
   * Lot I2 : le registre des jeux (les jeux des fiches par défaut, `jeuxPourEnvironnement`). **Tests seulement** (un faux jeu n° 3 prouve que le portail ne change pas) : `server.ts`
   * ne le règle jamais. Un faux jeu n'a pas de tables (le schéma est celui de `GAMES`).
   */
  games?: readonly GameDefinition<never>[];
  /**
   * Lot R8 : le jour de la journée n° 1 (jours depuis 1970) ; défaut : celui de `config/lancement.json` (`@cdj/core`). `LANCEMENT_PREMIER_JOUR`
   * (`config.ts`) le déplace sur la recette et en local ; la production le refuse.
   */
  premierJourDuJour?: number;
  /**
   * Lot N1 : le panneau d'administration de la plateforme (`/admin/`, `admin.ts`) : liste d'adresses (secret `cdj-admin-emails`), clé de session (secret
   * `cdj-admin-session-key`), identifiant client Google (public), étiquette et commit de la mise en production. Absent ou incomplet : le panneau n'existe pas (404).
   * `fakeVerifier` (tests et CI) est refusé au démarrage en production et en recette (`config.ts`).
   */
  admin?: AdminOptions;
}

export function createApi(options: ApiOptions) {
  const mesures = options.mesures;
  const db = mesures ? mesures.envelopper(options.db) : options.db; // lot D3 : la base chronométrée (temps passé en SQL de chaque requête)
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
    etape: mesures ? (e) => mesures.marquer(e) : undefined,
    allowCopies: options.allowCopies === true,
    rotateStatements: (oldId, newId) => instances.flatMap((g) => g.instance.rotateStatements?.(oldId, newId) ?? []),
  });
  const ensureSchema = platform.ensureSchema;
  let adminRef: Admin | null = null;
  const gameOptions: Record<string, unknown> = {
    cdj: {
      adminToken: options.adminToken,
      // Lot N1 : les outils de DailyTrack acceptent aussi la session du panneau (liée plus bas, une fois `admin` créé).
      adminSession: (req) => (adminRef ? adminRef.sessionValide(req) : Promise.resolve(false)),
      salonMinutes: options.salonMinutes,
      salonLimits: options.salonLimits,
      demoPlayers: options.demoPlayers,
      niveaux: options.niveauxExecuteur,
    } satisfies CdjOptions,
    jump: { frozen: options.jumpFrozen, niveaux: options.niveauxExecuteur } satisfies JumpOptions,
    tower: { frozen: options.towerFrozen, executeur: options.towerExecuteur } satisfies TowerOptions,
  };
  // Lot K4f : un jeu neuf reçoit ses jours figés (`frozen`) sans que le serveur ne le nomme ; les trois premiers jeux gardent leurs options propres ci-dessus.
  for (const [code, frozen] of Object.entries(options.joursFiges ?? {})) if (!(code in gameOptions)) gameOptions[code] = { frozen };
  // Lot K4e : le registre vient des fiches ; un jeu témoin n'est jamais dans celui d'un serveur de production.
  const jeux = options.games ?? jeuxPourEnvironnement(options.environment === "production" ? "production" : options.environment === "recette" ? "recette" : "local");
  for (const g of jeux) instances.push({ code: g.code, prefix: g.prefix, instance: g.create(platform, gameOptions[g.code] as never) });
  const byPrefix = [...instances].sort((a, b) => b.prefix.length - a.prefix.length);
  const cdj = instances.find((g) => g.code === "cdj")!.instance as CdjInstance; // DailyTrack est toujours au registre (admin, Salon)
  // Lot R5 : les routes d'admin de la plateforme (effacement d'un joueur) gardées par le jeton de l'admin de DailyTrack (`ADMIN_TOKEN`).
  // Lot I3 : l'effacement d'un joueur vide aussi la mémoire du portail (`portail.oublier`, défini juste après).
  const identity = createIdentityRoutes(
    platform,
    instances.map((g) => g.instance),
    (req, info) => cdj.requireAdmin(req, info),
    () => {
      portail.oublier();
      groupes.oublier();
    },
  );
  // Lot N2 : les nouveautés et le message en direct (lectures publiques, routes d'administration).
  const diffusion = createDiffusion(platform);
  // Lot P : l'interrupteur des jeux (état de chaque jeu, clé d'aperçu). Un jeu sans crochet `portail` est nommé par son code ; le portail et la garde lisent le même état.
  const interrupteur = createJeux(
    platform,
    instances.map((g) => ({ code: g.code, site: g.instance.portail?.site ?? g.code, nom: g.instance.portail?.nom ?? g.code, viderApercu: g.instance.viderApercu?.bind(g.instance) })),
  );
  // Lot C1 : les retours des joueurs (`/api/retours…`), « Un bug ? Une idée ? ». Leur nombre de réponses non lues entre dans `GET /api/portail/jour` (`messagesNonLus`).
  const retours = createRetours(platform, { version: options.admin?.releaseTag ?? options.revision?.slice(0, 12) ?? "local" });
  // Lot C1, partie B : les avatars (`/api/avatar…`, `/api/avatars/<empreinte>`) : l'envoi, le signalement, l'image servie en cache long.
  const avatars = createAvatars(platform, { groupe: proprietaireGroupe });
  // Lot F2 : les amis (`/api/amis…`, le filtre `filtre=amis` des classements). Ils lisent le classement du jour que le portail garde par fenêtre (créé juste après : d'où la lecture paresseuse).
  let portailPartage: ReturnType<typeof createPortailRoutes> | null = null;
  // Lot C1, partie C : les groupes (`/api/groupes…`, le filtre `filtre=groupe` des classements, le classement des groupes). Ils lisent le même classement du jour gardé par le portail.
  const groupes = createGroupes(platform, () => portailPartage!.vue, avatars);
  const amis = createAmis(platform, () => portailPartage!.vue, groupes.membresPourClassement, groupes.tailleDuGroupe, () => instances);
  // Lot I2 : le portail (accueil et profil commun), à partir de ce que chaque jeu déclare (crochet `portail`).
  const portail = createPortailRoutes(
    platform,
    instances.flatMap((g) => (g.instance.portail ? [{ code: g.code, portail: g.instance.portail }] : [])),
    options.premierJourDuJour,
    diffusion,
    interrupteur,
    amis.pourPortail,
    retours.pourPortail,
  );
  portailPartage = portail;
  // Lot R8 : la remise à zéro du lancement vide la base ; une instance qui voit la génération changer oublie sa mémoire (comme après un effacement).
  platform.onGenerationChange(() => {
    for (const g of instances) g.instance.onErased?.();
    portail.oublier();
    groupes.oublier();
  });
  // Lot N1 : le panneau d'administration (connexion Google, tableau de bord, joueurs, journal). Il existe toujours (le journal des erreurs et l'entretien servent
  // même sans lui) ; sans configuration complète, ses routes répondent 404.
  const admin = createAdmin({
    platform,
    options: options.admin ?? { emails: [] },
    jeux: instances.flatMap((g) => {
      const def = jeux.find((d) => d.code === g.code);
      return def ? [{ code: g.code, name: def.name, prefixe: def.prefix, instance: g.instance }] : [];
    }),
    allowedOrigins,
    revision: options.revision,
    mesures,
    oublier: () => {
      portail.oublier();
      groupes.oublier();
    },
    diffusion,
    interrupteur,
    retours,
    avatars,
    groupes,
  });
  adminRef = admin;
  const salon = cdj.salon;
  const today = platform.today;

  // --- Entrée -----------------------------------------------------------------------------------------------
  /** En-têtes CORS d'une requête : liste d'origines (`ALLOWED_ORIGINS`) ou, à défaut, la valeur unique `allowOrigin`. */
  function corsFor(req: Request): Record<string, string> {
    const common = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Player-Id, X-Preview-Key",
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
      // Lot C1 : une image d'avatar est rendue en octets (`WithHeaders` avec un `Uint8Array` et son `Content-Type`) ; tout le reste est du JSON.
      const octets = body instanceof Uint8Array;
      return new Response(status === 204 ? null : octets ? (body as BodyInit) : JSON.stringify(body), {
        status,
        headers: { ...cors, ...SECURITY_HEADERS, "Content-Type": octets ? "application/octet-stream" : "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra, ...(vary ? { Vary: vary } : {}) },
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

  /**
   * Lot D3 (C9) — **le niveau du lendemain, calculé avant minuit.** À minuit tous les onglets se rechargent et la première requête du jour calculait le niveau de Jump (1,9 s) et le circuit de Track (0,4 s) :
   * 5 à 10 s sur Cloud Run (D1 § 6 bis). Dans la **demi-heure qui précède minuit de Paris**, la première requête qui arrive sur une instance lance, **sans l'attendre**, le calcul du niveau du lendemain de chaque
   * jeu ouvert (`dailyLevel(demain)` : le calcul et l'écriture en base sont ceux de minuit, par le fil de calcul quand il y en a un) : après minuit, **toute instance le lit en base** et ne calcule plus rien.
   * Aucun niveau ne change (même calcul, fait plus tôt ; la règle de chaque niveau — versions, fichier figé — est vérifiée à la lecture comme avant). Pas de tâche de fond (Cloud Run ne donne du calcul que pendant
   * une requête) : une instance qui ne reçoit aucune requête dans la demi-heure ne prépare rien, et le premier joueur d'après minuit calcule, dans le fil de calcul, sans bloquer les autres.
   */
  const AVANCE_PREPARATION_MS = 30 * 60_000;
  const REPRISE_PREPARATION_MS = 2 * 60_000;
  let preparation: { jour: number; en: Promise<void> | null; reussie: boolean; echecA: number } = { jour: -1, en: null, reussie: false, echecA: -Infinity };
  let controleA = -Infinity;
  /** Prépare le niveau de demain (ou, avec `force`, sans attendre la demi-heure d'avance : tests et mesures). Rend la promesse du travail en cours, que `handle` n'attend jamais. */
  function preparerLeLendemain(force = false): Promise<void> | null {
    const t = now();
    if (!force && t - controleA < 5_000) return preparation.en;
    controleA = t;
    if (!force && msUntilNextParisDay(t) > AVANCE_PREPARATION_MS) return preparation.en;
    const demain = platform.today() + 1;
    if (preparation.jour === demain && (preparation.en || preparation.reussie || t - preparation.echecA < REPRISE_PREPARATION_MS)) return preparation.en;
    preparation = {
      jour: demain,
      reussie: false,
      echecA: -Infinity,
      en: (async () => {
        try {
          await interrupteur.charger();
          let echec = false;
          for (const g of instances) {
            const site = interrupteur.siteDe(g.code);
            if (!site || interrupteur.etat(site) === "off") continue; // un jeu éteint n'a rien à préparer
            if (g.instance.portail && demain < g.instance.portail.premierJour) continue;
            const debut = performance.now();
            try {
              await g.instance.dailyLevel(demain);
              log("INFO", "niveau du lendemain prêt", { jeu: g.code, jour: formatDay(demain), ms: Math.round(performance.now() - debut) });
            } catch (e) {
              echec = true;
              log("WARNING", "niveau du lendemain : calcul impossible, il se fera à minuit", { jeu: g.code, jour: formatDay(demain), code: e instanceof HttpError ? e.code : "inconnu" });
            }
          }
          if (echec) preparation.echecA = now();
          else preparation.reussie = true;
        } catch {
          preparation.echecA = now(); // la base ne répond pas : on réessaie dans 2 minutes
        } finally {
          preparation.en = null;
        }
      })(),
    };
    return preparation.en;
  }

  /** Lot D3 : chaque requête est suivie (route, étapes, temps en SQL) quand l'instance est mesurée ; la réponse ne change pas. */
  const handle = (req: Request, info: RequestInfo = {}): Promise<Response> =>
    mesures && req.method !== "OPTIONS" ? mesures.suivre(routeDe(new URL(req.url).pathname.replace(/\/+$/, "")), () => traiter(req, info)) : traiter(req, info);

  async function traiter(req: Request, info: RequestInfo = {}): Promise<Response> {
    const reply = replier(req);
    let path = "";
    try {
      if (req.method === "OPTIONS") return reply(204, null);
      const url = new URL(req.url);
      path = url.pathname.replace(/\/+$/, "");
      if (path === "/api/health" && req.method === "GET") return await health(reply);
      if (path === "/api/sonde/entetes" && req.method === "GET" && options.environment === "recette") return reply(200, probeHeaders(req, info));
      await ensureSchema();
      void preparerLeLendemain(); // lot D3 : dans la demi-heure d'avant minuit, le niveau du lendemain se prépare sans que cette requête l'attende
      await platform.generation(); // lot R8 : une ligne par instance et par 30 s ; une génération changée vide la mémoire de l'instance
      // Lot N1 : les journaux et les rediffusions retirées passent leur durée (au plus une fois par heure et par instance). Jamais pendant une lecture : une lecture
      // n'écrit rien (la vérification de la production, `smoke --lecture-seule`, le prouve).
      if (req.method !== "GET" && req.method !== "HEAD") await admin.entretien();

      // Les routes communes (pseudo, profil, code), puis celles de chaque jeu du registre, du préfixe le plus long au plus court.
      const common = (await admin.route(path, req, url, info)) ?? (await identity.route(path, req, url, info)) ?? (await diffusion.routePublique(path, req, url, info)) ?? (await interrupteur.routePublique(path, req, info)) ?? (await amis.route(path, req, url, info)) ?? (await retours.route(path, req, url, info)) ?? (await avatars.route(path, req, url, info)) ?? (await groupes.route(path, req, url, info)) ?? (await portail.route(path, req, url, info));
      if (common !== undefined) return answer(reply, common);
      for (const g of byPrefix) {
        if (path !== g.prefix && !path.startsWith(`${g.prefix}/`)) continue;
        // Lot P : l'interrupteur des jeux. Les outils d'administration de DailyTrack (`/api/admin/…`, leur propre porte) ne sont pas « le jeu » ; tout le reste l'est : un jeu `off` refuse
        // (404 `game_unavailable`), un jeu en `preview` n'accepte que la clé d'aperçu et ne laisse écrire que ce qu'il range à part (`ecrituresApercu`).
        let infoJeu = info;
        if (!path.startsWith("/api/admin/")) {
          const site = interrupteur.siteDe(g.code)!;
          if ((await interrupteur.garde(site, req)) === "preview") {
            const ecriture = req.method !== "GET" && req.method !== "HEAD";
            if (ecriture && !g.instance.ecrituresApercu?.includes(path)) throw new HttpError(404, "game_unavailable", "Ce jeu n'accepte pas cette écriture pendant l'aperçu");
            infoJeu = { ...info, apercu: true };
          }
        }
        // Lot F2 : le classement du jeu filtré aux amis (`?filtre=amis`), après la garde de l'interrupteur ; sans `filtre`, le classement « Tous » du jeu, inchangé.
        if (url.searchParams.has("filtre")) {
          const filtre = await amis.classementJeu(g.code, path, req, url, infoJeu);
          if (filtre !== undefined) return answer(reply, filtre);
        }
        const body = await g.instance.route(path, req, url, infoJeu);
        if (body !== undefined) return answer(reply, body);
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 429 || e.status >= 500) log(e.status >= 500 ? "ERROR" : "WARNING", "refus", { status: e.status, code: e.code });
        if (aNoter(e.status, e.code, path)) await admin.journaux.noter(e.code, path); // lot N1 : le tableau de bord compte les erreurs serveur et les rediffusions refusées
        // Lot I6 : le code et les détails seulement ; le texte de `HttpError` reste dans le code (pour qui le lit), jamais dans la réponse.
        return reply(e.status, { error: e.code, ...e.details }, e.headers);
      }
      log("ERROR", "erreur interne", { error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "inconnue" });
      await admin.journaux.noter("internal", path);
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

  return { handle, tick, salon, games, preparerLeLendemain };
}
