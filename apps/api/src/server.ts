import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { formatDay } from "@cdj/core";
import { createApi } from "./api";
import { ConfigError, adminTokenWarning, readConfig } from "./config";
import { openLibsql } from "./libsql-open";
import { consoleLog } from "./log";
import { createNodeServer } from "./node-server";
import { openSqlite } from "./node-sqlite";
import { REPLAYS_PER_MINUTE } from "./platform";

// Point d'entrée du serveur Node : conteneur Cloud Run (Turso) ou Docker / poste local (SQLite). Variables : voir `config.ts`.
// **Aucune tâche de fond** n'est indispensable (Cloud Run éteint le conteneur sans requête, et n'alloue du calcul que pendant une requête) :
// le circuit du jour et celui d'une session du Salon sont générés par la première requête qui en a besoin, puis gardés en base.
// En local (hors production) la tâche périodique prépare tout de même le circuit du Salon à l'avance ; elle est facultative.
let config;
try {
  config = readConfig(process.env);
} catch (e) {
  if (e instanceof ConfigError) {
    consoleLog("ERROR", "configuration refusée", { error: e.message });
    process.exit(1);
  }
  throw e;
}

// Lot R7 : un `ADMIN_TOKEN` trop court désactive l'administration sans rien dire (404) ; moins de 32 caractères, il se devine plus facilement.
// Jamais la valeur dans le journal, seulement sa longueur.
const tokenWarning = adminTokenWarning(config.adminToken);
if (tokenWarning) consoleLog("WARNING", tokenWarning, { longueur: config.adminToken!.length });

// Lot N1 : le panneau d'administration. Jamais l'adresse, ni la clé, ni l'identifiant client : seulement s'il est configuré, et ce qui manque.
for (const a of config.admin.avertissements) consoleLog("WARNING", a);
if (config.admin.fakeVerifier) consoleLog("WARNING", "ADMIN_FAKE_VERIFIER : vérificateur factice du panneau d'administration (tests et CI seulement, jamais en ligne)");

if (config.salonMinutes !== undefined) {
  consoleLog("WARNING", "SALON_MINUTES : sessions du Salon raccourcies (tests et essais locaux seulement, jamais en production)", { salonMinutes: config.salonMinutes });
}

// Horloge de test (`TEST_CLOCK_OFFSET_MS`) : l'heure réelle plus un décalage constant, qui avance donc en temps réel. Les tests de navigateur
// décalent de la même valeur l'horloge des pages (`context.clock`), pour que le serveur et les pages s'accordent et qu'aucun test ne
// dépende du jour réel ni ne change de jour en route.
let now: (() => number) | undefined;
if (config.testClockOffsetMs !== undefined) {
  const offset = config.testClockOffsetMs;
  now = () => Date.now() + offset;
  consoleLog("WARNING", "TEST_CLOCK_OFFSET_MS : horloge du serveur décalée (tests seulement, jamais en production)", { offsetMs: offset, now: new Date(now()).toISOString() });
}

if (config.premierJourDuJour !== undefined) {
  consoleLog("WARNING", "LANCEMENT_PREMIER_JOUR : journée n° 1 déplacée (recette et essais locaux seulement, jamais en production)", { premierJour: formatDay(config.premierJourDuJour) });
}

let db;
if (config.db.kind === "turso") {
  db = await openLibsql({ url: config.db.url, authToken: config.db.authToken });
} else {
  if (config.db.path !== ":memory:") mkdirSync(dirname(config.db.path), { recursive: true });
  db = openSqlite(config.db.path);
}

/** Lot P0 : les niveaux figés de DailyJump, inclus dans le paquet par `scripts/build-node.mjs` (absents hors du paquet : aucun). */
declare const __JUMP_FROZEN_LEVELS__: Record<string, unknown> | undefined;
const jumpFrozen = typeof __JUMP_FROZEN_LEVELS__ === "undefined" ? {} : __JUMP_FROZEN_LEVELS__;

const api = createApi({
  db,
  environment: config.environment,
  jumpFrozen,
  allowOrigin: config.allowOrigin ?? "*",
  allowedOrigins: config.allowedOrigins,
  rateSalt: config.rateSalt,
  replaysPerMinute: REPLAYS_PER_MINUTE, // lot R5 : plafond global de rejeux de chaque instance (503 au-delà)
  peerFactor: config.peerFactor, // lot R5 : l'adresse de connexion dans chaque limite par adresse (PEER_FACTOR, 0 = coupé)
  adminToken: config.adminToken,
  salonMinutes: config.salonMinutes,
  premierJourDuJour: config.premierJourDuJour, // lot R8 : la journée n° 1 déplacée (recette et local seulement)
  now,
  testClock: now !== undefined,
  revision: config.revision,
  admin: config.admin,
  log: consoleLog,
});

if (!config.production) {
  void api.tick();
  setInterval(() => void api.tick(), 15_000).unref();
}

createNodeServer(api, { trustProxy: config.trustProxy }).listen(config.port, () => {
  consoleLog("INFO", "API du Circuit du Jour prête", {
    port: config.port,
    base: config.db.kind === "turso" ? "turso" : "sqlite",
    cors: config.allowedOrigins ? config.allowedOrigins.length : "*",
    admin: !!config.adminToken && config.adminToken.length >= 16,
    panneau: config.admin.emails.length > 0 && !!config.admin.sessionKey && (!!config.admin.clientId || config.admin.fakeVerifier),
    jeux: api.games.map((g) => g.code).join(","),
    figesJump: Object.keys(jumpFrozen).length,
    startupMs: Math.round(process.uptime() * 1000),
  });
});
