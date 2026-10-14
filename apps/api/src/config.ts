/**
 * Configuration du serveur Node d'après les variables d'environnement : pure et testée (`server.ts` ne fait que l'appliquer).
 *
 *   PORT (8787 ; Cloud Run le fournit) · NODE_ENV=production (image Docker)
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN : base libSQL / Turso ; sans elles, SQLite local (`DB_PATH`)
 *   ALLOWED_ORIGINS : origines CORS, séparées par des virgules ou des points-virgules (obligatoire en production)
 *   ADMIN_TOKEN (≥ 16 caractères) · RATE_SALT (≥ 16 caractères, obligatoire en production) · TRUST_PROXY (nombre de proxys de confiance ; 1 sur Cloud Run)
 *   SALON_MINUTES : tests et essais locaux seulement, refusée en production
 *   TEST_CLOCK_OFFSET_MS : décalage (ms, entier) ajouté à l'heure réelle : l'horloge du serveur avance en temps réel mais à une date choisie ; tests seulement, refusée en production
 *   GIT_SHA, K_REVISION, K_SERVICE : posées par le déploiement / Cloud Run
 */
export interface ServerConfig {
  port: number;
  production: boolean;
  /** Base : Turso / libSQL (`turso`) ou SQLite local (`sqlite`). */
  db: { kind: "turso"; url: string; authToken?: string } | { kind: "sqlite"; path: string };
  allowedOrigins?: string[];
  /** Ancien réglage à origine unique (`ALLOW_ORIGIN`), gardé pour les installations existantes. */
  allowOrigin?: string;
  rateSalt: string;
  adminToken?: string;
  trustProxy: number;
  salonMinutes?: number;
  /** Décalage (ms) de l'horloge de test du serveur (`TEST_CLOCK_OFFSET_MS`) ; absent : heure réelle. */
  testClockOffsetMs?: number;
  revision?: string;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

export function readConfig(env: Env): ServerConfig {
  const production = env.NODE_ENV === "production";
  const onCloudRun = !!env.K_SERVICE;
  const turso = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;

  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`PORT invalide : ${env.PORT}`);

  let salonMinutes: number | undefined;
  if (env.SALON_MINUTES) {
    if (production) {
      throw new ConfigError("SALON_MINUTES est réglée alors que le serveur tourne en production (NODE_ENV=production) : elle sert aux essais locaux et aux tests, jamais en ligne. Supprime la variable.");
    }
    salonMinutes = Number(env.SALON_MINUTES);
  }

  let testClockOffsetMs: number | undefined;
  if (env.TEST_CLOCK_OFFSET_MS) {
    if (production || onCloudRun) {
      throw new ConfigError("TEST_CLOCK_OFFSET_MS est réglée alors que le serveur tourne en production : elle décale le jour des tests, jamais en ligne. Supprime la variable.");
    }
    testClockOffsetMs = Number(env.TEST_CLOCK_OFFSET_MS);
    if (!Number.isSafeInteger(testClockOffsetMs)) throw new ConfigError(`TEST_CLOCK_OFFSET_MS : un nombre entier de millisecondes attendu, reçu : ${env.TEST_CLOCK_OFFSET_MS}`);
  }

  if (!turso && onCloudRun) {
    throw new ConfigError("TURSO_DATABASE_URL manque : sur Cloud Run le disque est effacé à chaque redémarrage, une base locale perdrait tous les temps.");
  }
  if (turso && !/^(libsql|https?|file|wss?):/.test(turso) && turso !== ":memory:") {
    throw new ConfigError("TURSO_DATABASE_URL doit commencer par libsql://, https:// (ou file: en local).");
  }

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

  return {
    port,
    production,
    db: turso ? { kind: "turso", url: turso, authToken } : { kind: "sqlite", path: env.DB_PATH ?? "./data/cdj.sqlite" },
    allowedOrigins: origins?.length ? origins : undefined,
    allowOrigin: env.ALLOW_ORIGIN,
    rateSalt: env.RATE_SALT ?? "",
    adminToken: env.ADMIN_TOKEN,
    trustProxy: trust,
    salonMinutes,
    testClockOffsetMs,
    revision: env.K_REVISION ?? env.GIT_SHA,
  };
}
