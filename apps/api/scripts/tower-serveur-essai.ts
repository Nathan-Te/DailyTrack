// Lot T4 — un vrai serveur Node pour les tests de navigateur du jeu Tower (`apps/tower/e2e`) : l'API de la plateforme avec Tower monté (le registre ne le contient pas encore : cahier des
// charges du lot T4), une base SQLite en mémoire, le refus des copies actif (comme en production), CORS ouvert. **Tests et essais locaux seulement** : ni production, ni Turso.
//
//   cd apps/api && npx esbuild scripts/tower-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/tower-serveur-essai.mjs --log-level=warning \
//     "--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" && PORT=8791 node dist/tower-serveur-essai.mjs
//
// Variables : PORT (8791) · TOWER_AUJOURDHUI=AAAA-MM-JJ (le jour de Paris du serveur : son horloge part de midi UTC de ce jour et avance en temps réel ; sinon l'heure réelle) ·
// TOWER_JOURS=<dossier> (les fichiers du jour préparés, `AAAA-MM-JJ.json` ; par défaut aucun : tirage 0 et médailles provisoires) · TOWER_COPIES=1 (laisse passer les copies : essais seulement) ·
// TOWER_FERME=1 (Tower reste `off`, comme en production aujourd'hui) · DB_PATH (défaut `:memory:`) · ADMIN_TOKEN (≥ 16 caractères : active `POST /api/admin/effacer`).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { consoleLog } from "../src/log";
import { createNodeServer } from "../src/node-server";
import { openSqlite } from "../src/node-sqlite";
import { creerTablesTower, gamesAvecTower } from "./tower-aide";

if (process.env.NODE_ENV === "production" || process.env.K_SERVICE) {
  console.error("tower-serveur-essai : réservé aux tests et aux essais locaux");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 8791);
const frozen: Record<string, unknown> = {};
if (process.env.TOWER_JOURS) {
  for (const f of readdirSync(process.env.TOWER_JOURS)) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
    if (date) frozen[date] = JSON.parse(readFileSync(join(process.env.TOWER_JOURS, f), "utf8"));
  }
}
let now: (() => number) | undefined;
if (process.env.TOWER_AUJOURDHUI) {
  const jour = parseDay(process.env.TOWER_AUJOURDHUI);
  if (jour === null) {
    console.error("TOWER_AUJOURDHUI : AAAA-MM-JJ attendu");
    process.exit(1);
  }
  const depart = jour * 86_400_000 + 12 * 3_600_000;
  const t0 = Date.now();
  now = () => depart + (Date.now() - t0);
}

const db = openSqlite(process.env.DB_PATH ?? ":memory:");
const api = createApi({
  db,
  now,
  testClock: now !== undefined,
  environment: "local",
  allowOrigin: "*",
  allowCopies: process.env.TOWER_COPIES === "1",
  adminToken: process.env.ADMIN_TOKEN,
  games: gamesAvecTower({ frozen }),
  log: consoleLog,
});
await ensureSchemaOn(db);
await creerTablesTower(db);
if (process.env.TOWER_FERME !== "1") await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('tower', 'on', 0, '[[0,null]]', 0)");

createNodeServer(api, {}).listen(port, () => {
  consoleLog("INFO", "Serveur d'essai de Tower prêt", { port, joursFiges: Object.keys(frozen).length, copies: process.env.TOWER_COPIES === "1", ouvert: process.env.TOWER_FERME !== "1" });
});
