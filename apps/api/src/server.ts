import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApi } from "./api";
import { createNodeServer } from "./node-server";
import { openSqlite } from "./node-sqlite";

// Point d'entrée du serveur Node (conteneur Docker). Configuration par variables d'environnement :
//   PORT (8787) · DB_PATH (./data/cdj.sqlite) · ALLOW_ORIGIN (*) · TRUST_PROXY (1 derrière un proxy) · RATE_SALT
//   ADMIN_TOKEN (≥ 16 caractères : active le panneau /admin/ ; absent = admin désactivé)
const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DB_PATH ?? "./data/cdj.sqlite";
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });

const api = createApi({
  db: openSqlite(dbPath),
  allowOrigin: process.env.ALLOW_ORIGIN ?? "*",
  rateSalt: process.env.RATE_SALT ?? "",
  adminToken: process.env.ADMIN_TOKEN,
});
createNodeServer(api, { trustProxy: process.env.TRUST_PROXY === "1" }).listen(port, () => {
  console.log(`API du Circuit du Jour : http://localhost:${port}/api/health (base : ${dbPath})`);
});
