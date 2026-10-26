import { parseDay } from "@cdj/core";

/**
 * Configuration du serveur Node d'après les variables d'environnement : pure et testée (`server.ts` ne fait que l'appliquer).
 *
 *   PORT (8787 ; Cloud Run le fournit) · NODE_ENV=production (image Docker)
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN : base libSQL / Turso ; sans elles, SQLite local (`DB_PATH`)
 *   ALLOWED_ORIGINS : origines CORS, séparées par des virgules ou des points-virgules (obligatoire en production)
 *   ADMIN_TOKEN (≥ 16 caractères) · RATE_SALT (≥ 16 caractères, obligatoire en production) · TRUST_PROXY (nombre de proxys de confiance ; 1 sur Cloud Run)
 *   ENVIRONMENT : `production` | `recette` | `local` (lot R1 de la plateforme) ; absente : `production` si NODE_ENV=production, sinon `local`
 *   SALON_MINUTES : tests, essais locaux et recette seulement, refusée en production
 *   TEST_CLOCK_OFFSET_MS : décalage (ms, entier) ajouté à l'heure réelle : l'horloge du serveur avance en temps réel mais à une date choisie ; tests et recette seulement, refusée en production
 *   LANCEMENT_PREMIER_JOUR : lot R8 — AAAA-MM-JJ, déplace la journée n° 1 de la recette (essayer « Journée n° 1 » un autre jour) ; recette et local seulement, refusée en production
 *   PEER_FACTOR : lot R5 — l'adresse de connexion compte dans chaque limite par adresse à `limite × PEER_FACTOR` (0 à 100, défaut 10 ; 0 = coupé)
 *   GIT_SHA, K_REVISION, K_SERVICE : posées par le déploiement / Cloud Run
 *
 * Règle des noms de base (lot R1) : en `recette`, le nom de la base doit contenir « recette » ; en `production`, il ne doit pas le contenir.
 * Une protection de base contre l'erreur de branchement (le service de recette sur la base des joueurs, ou l'inverse).
 */
export type Environment = "production" | "recette" | "local";

/** Le mot que le nom d'une base de recette contient toujours, et celui d'une base de production jamais. */
export const RECETTE_MARK = "recette";

export interface ServerConfig {
  port: number;
  /** Règles d'un serveur en ligne (NODE_ENV=production, posée par l'image Docker, ou ENVIRONMENT=production) : vrai aussi en recette. */
  production: boolean;
  /** `production`, `recette` (serveur de recette : horloge de test et Salon court permis) ou `local`. */
  environment: Environment;
  /** Base : Turso / libSQL (`turso`) ou SQLite local (`sqlite`). */
  db: { kind: "turso"; url: string; authToken?: string } | { kind: "sqlite"; path: string };
  allowedOrigins?: string[];
  /** Ancien réglage à origine unique (`ALLOW_ORIGIN`), gardé pour les installations existantes. */
  allowOrigin?: string;
  rateSalt: string;
  adminToken?: string;
  trustProxy: number;
  /** Lot R5 : multiple de chaque limite par adresse appliqué à l'adresse de connexion (`PEER_FACTOR`, 0 = coupé). */
  peerFactor: number;
  salonMinutes?: number;
  /** Décalage (ms) de l'horloge de test du serveur (`TEST_CLOCK_OFFSET_MS`) ; absent : heure réelle. */
  testClockOffsetMs?: number;
  revision?: string;
  /** Lot R8 : la journée n° 1 réglée par `LANCEMENT_PREMIER_JOUR` (jours depuis 1970) ; absent : la date de `config/lancement.json`. */
  premierJourDuJour?: number;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

/**
 * Nom de la base visée : premier élément du nom d'hôte pour une base distante (Turso : `<base>-<organisation>.turso.io`), nom du fichier
 * pour une base locale (`file:…`, `DB_PATH`). En minuscules.
 */
export function databaseName(location: string): string {
  const loc = location.trim();
  if (loc === ":memory:") return loc;
  const remote = /^(?:libsql|https?|wss?):\/\/([^/:?#]+)/i.exec(loc);
  if (remote) return remote[1]!.split(".")[0]!.toLowerCase();
  const path = loc.replace(/^file:/i, "").replace(/[?#].*$/, "");
  return (path.split(/[\\/]/).pop() ?? path).toLowerCase();
}

/** Où pointe la base d'après l'environnement : Turso / libSQL, sinon le fichier SQLite local (même règle que `readConfig`). */
function databaseLocation(env: Env): string {
  return env.TURSO_DATABASE_URL?.trim() || (env.DB_PATH ?? "./data/cdj.sqlite");
}

/** L'environnement déclaré (`ENVIRONMENT`), ou déduit de `NODE_ENV` quand il est absent (les déploiements d'avant le lot R1). */
export function readEnvironment(env: Env): Environment {
  const raw = env.ENVIRONMENT?.trim();
  if (!raw) return env.NODE_ENV === "production" ? "production" : "local";
  if (raw === "production" || raw === "recette" || raw === "local") return raw;
  throw new ConfigError(`ENVIRONMENT : « production », « recette » ou « local » attendu, reçu « ${raw} ».`);
}

/**
 * La règle des noms de base : en recette, la base doit s'appeler « …recette… » ; en production, jamais. Lève `ConfigError` sinon.
 * Le serveur (`readConfig`) et `npm run recette:seed` l'appliquent.
 */
export function assertDatabaseMatches(environment: Environment, location: string): void {
  const name = databaseName(location);
  if (environment === "recette" && !name.includes(RECETTE_MARK)) {
    throw new ConfigError(`ENVIRONMENT=recette, mais le nom de la base (« ${name} ») ne contient pas « ${RECETTE_MARK} » : le serveur de recette ne doit jamais toucher la base des joueurs. Vérifie TURSO_DATABASE_URL.`);
  }
  if (environment === "production" && name.includes(RECETTE_MARK)) {
    throw new ConfigError(`Production, mais le nom de la base (« ${name} ») contient « ${RECETTE_MARK} » : c'est la base de recette. Vérifie TURSO_DATABASE_URL (et ENVIRONMENT).`);
  }
}

/**
 * `npm run recette:seed` : la base visée, seulement si `ENVIRONMENT=recette` et que son nom contient « recette ». Lève `ConfigError` sinon
 * (jamais de joueurs fictifs dans la base des joueurs).
 */
export function recetteSeedTarget(env: Env): { kind: "turso"; url: string; authToken?: string } | { kind: "sqlite"; path: string } {
  if (env.ENVIRONMENT?.trim() !== "recette") {
    throw new ConfigError("recette:seed ne tourne qu'avec ENVIRONMENT=recette (et la base de recette) : il écrit des joueurs fictifs, jamais dans la production.");
  }
  assertDatabaseMatches("recette", databaseLocation(env));
  const turso = env.TURSO_DATABASE_URL?.trim();
  return turso ? { kind: "turso", url: turso, authToken: env.TURSO_AUTH_TOKEN?.trim() || undefined } : { kind: "sqlite", path: env.DB_PATH ?? "./data/cdj.sqlite" };
}

export function readConfig(env: Env): ServerConfig {
  const environment = readEnvironment(env);
  const recette = environment === "recette";
  // ENVIRONMENT=production applique les règles de la production même sans NODE_ENV (l'image Docker pose NODE_ENV=production, recette comprise).
  const production = env.NODE_ENV === "production" || environment === "production";
  const onCloudRun = !!env.K_SERVICE;
  const turso = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;

  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`PORT invalide : ${env.PORT}`);

  if (env.ENVIRONMENT?.trim() === "local" && onCloudRun) {
    throw new ConfigError("ENVIRONMENT=local sur Cloud Run : un service déployé est « production » ou « recette ».");
  }

  let salonMinutes: number | undefined;
  if (env.SALON_MINUTES) {
    if (production && !recette) {
      throw new ConfigError("SALON_MINUTES est réglée alors que le serveur tourne en production (NODE_ENV=production) : elle sert aux essais locaux, aux tests et à la recette, jamais en ligne. Supprime la variable.");
    }
    salonMinutes = Number(env.SALON_MINUTES);
  }

  let testClockOffsetMs: number | undefined;
  if (env.TEST_CLOCK_OFFSET_MS) {
    if ((production || onCloudRun) && !recette) {
      throw new ConfigError("TEST_CLOCK_OFFSET_MS est réglée alors que le serveur tourne en production : elle décale le jour des tests et de la recette, jamais en ligne. Supprime la variable.");
    }
    testClockOffsetMs = Number(env.TEST_CLOCK_OFFSET_MS);
    if (!Number.isSafeInteger(testClockOffsetMs)) throw new ConfigError(`TEST_CLOCK_OFFSET_MS : un nombre entier de millisecondes attendu, reçu : ${env.TEST_CLOCK_OFFSET_MS}`);
  }

  let premierJourDuJour: number | undefined;
  if (env.LANCEMENT_PREMIER_JOUR?.trim()) {
    if (environment === "production" || (production && !recette)) {
      throw new ConfigError("LANCEMENT_PREMIER_JOUR est réglée alors que le serveur tourne en production : la date du lancement est celle de config/lancement.json, jamais une variable. Supprime la variable.");
    }
    const jour = parseDay(env.LANCEMENT_PREMIER_JOUR.trim());
    if (jour === null) throw new ConfigError(`LANCEMENT_PREMIER_JOUR : une date AAAA-MM-JJ attendue, reçu : ${env.LANCEMENT_PREMIER_JOUR}`);
    premierJourDuJour = jour;
  }

  if (!turso && onCloudRun) {
    throw new ConfigError("TURSO_DATABASE_URL manque : sur Cloud Run le disque est effacé à chaque redémarrage, une base locale perdrait tous les temps.");
  }
  if (turso && !/^(libsql|https?|file|wss?):/.test(turso) && turso !== ":memory:") {
    throw new ConfigError("TURSO_DATABASE_URL doit commencer par libsql://, https:// (ou file: en local).");
  }
  if (environment !== "local") assertDatabaseMatches(environment, databaseLocation(env));

  // Virgule, point-virgule ou espace : le déploiement passe la liste par une variable où la virgule gêne.
  const origins = env.ALLOWED_ORIGINS?.split(/[,;\s]+/).filter(Boolean);
  if (production && !origins?.length && !env.ALLOW_ORIGIN) {
    throw new ConfigError("ALLOWED_ORIGINS manque : en production, donne l'adresse du jeu (https://<compte>.github.io), ou * pour tout autoriser.");
  }
  for (const o of origins ?? []) {
    if (o !== "*" && !/^https?:\/\/[^/\s]+$/.test(o.replace(/\/+$/, ""))) {
      throw new ConfigError(`ALLOWED_ORIGINS : « ${o} » n'est pas une origine (https://hôte, sans chemin).`);
    }
  }

  if (production && (env.RATE_SALT ?? "").length < 16) {
    throw new ConfigError("RATE_SALT manque (16 caractères au moins) : sans sel, les adresses hachées du limiteur de débit se retrouveraient par essais. Secret Cloud Run, jamais dans le dépôt.");
  }

  const trust = env.TRUST_PROXY === undefined || env.TRUST_PROXY === "" ? 0 : Number(env.TRUST_PROXY);
  if (!Number.isInteger(trust) || trust < 0 || trust > 5) throw new ConfigError(`TRUST_PROXY : un nombre de proxys entre 0 et 5 (reçu : ${env.TRUST_PROXY})`);

  const peer = env.PEER_FACTOR === undefined || env.PEER_FACTOR === "" ? 10 : Number(env.PEER_FACTOR);
  if (!Number.isInteger(peer) || peer < 0 || peer > 100) throw new ConfigError(`PEER_FACTOR : un entier de 0 (coupé) à 100 (reçu : ${env.PEER_FACTOR})`);

  return {
    port,
    production,
    environment,
    db: turso ? { kind: "turso", url: turso, authToken } : { kind: "sqlite", path: env.DB_PATH ?? "./data/cdj.sqlite" },
    allowedOrigins: origins?.length ? origins : undefined,
    allowOrigin: env.ALLOW_ORIGIN,
    rateSalt: env.RATE_SALT ?? "",
    adminToken: env.ADMIN_TOKEN,
    trustProxy: trust,
    peerFactor: peer,
    salonMinutes,
    testClockOffsetMs,
    revision: env.K_REVISION ?? env.GIT_SHA,
    premierJourDuJour,
  };
}
