import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApi } from "./api";
import { ConfigError, readConfig } from "./config";
import { openLibsql } from "./libsql-open";
import { consoleLog } from "./log";
import { createNodeServer } from "./node-server";
import { openSqlite } from "./node-sqlite";

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

if (config.salonMinutes !== undefined) {
  consoleLog("WARNING", "SALON_MINUTES : sessions du Salon raccourcies (tests et essais locaux seulement, jamais en production)", { salonMinutes: config.salonMinutes });
}

let db;
if (config.db.kind === "turso") {
  db = await openLibsql({ url: config.db.url, authToken: config.db.authToken });
} else {
  if (config.db.path !== ":memory:") mkdirSync(dirname(config.db.path), { recursive: true });
  db = openSqlite(config.db.path);
}

const api = createApi({
  db,
  allowOrigin: config.allowOrigin ?? "*",
  allowedOrigins: config.allowedOrigins,
  rateSalt: config.rateSalt,
  adminToken: config.adminToken,
  salonMinutes: config.salonMinutes,
  revision: config.revision,
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
    startupMs: Math.round(process.uptime() * 1000),
  });
});
