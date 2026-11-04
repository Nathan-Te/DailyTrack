// Lot K4f — un vrai serveur Node pour les tests de navigateur de « Cibles » (`apps/cibles/e2e`) : l'API de la plateforme **telle que le registre des fiches la monte** (aucun montage à la main : c'est la preuve
// qu'un jeu neuf n'a pas besoin de module d'aide dans `scripts/`), une base SQLite en mémoire, le refus des copies actif (comme en production), CORS ouvert. **Tests et essais locaux seulement** : ni production, ni Turso.
//
//   cd apps/api && npx esbuild scripts/cibles-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/cibles-serveur-essai.mjs --log-level=warning \
//     "--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" && PORT=8793 node dist/cibles-serveur-essai.mjs
//
// Variables : PORT (8793) · CIBLES_AUJOURDHUI=AAAA-MM-JJ (le jour de Paris du serveur : son horloge part de midi UTC de ce jour et avance en temps réel ; sinon l'heure réelle) · CIBLES_COPIES=1 (laisse passer
// les copies : essais seulement) · CIBLES_FERME=1 (le jeu reste `off`) · DB_PATH (défaut `:memory:`).
import { parseDay } from "@cdj/core";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { consoleLog } from "../src/log";
import { createNodeServer } from "../src/node-server";
import { openSqlite } from "../src/node-sqlite";

if (process.env.NODE_ENV === "production" || process.env.K_SERVICE) {
  console.error("cibles-serveur-essai : réservé aux tests et aux essais locaux");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 8793);
let now: (() => number) | undefined;
if (process.env.CIBLES_AUJOURDHUI) {
  const jour = parseDay(process.env.CIBLES_AUJOURDHUI);
  if (jour === null) {
    console.error("CIBLES_AUJOURDHUI : AAAA-MM-JJ attendu");
    process.exit(1);
  }
  const depart = jour * 86_400_000 + 12 * 3_600_000;
  const t0 = Date.now();
  now = () => depart + (Date.now() - t0);
}
const db = openSqlite(process.env.DB_PATH ?? ":memory:");
const api = createApi({ db, now, testClock: now !== undefined, environment: "local", allowOrigin: "*", allowCopies: process.env.CIBLES_COPIES === "1", log: consoleLog });
await ensureSchemaOn(db);
if (process.env.CIBLES_FERME !== "1") await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('cibles', 'on', 0, '[[0,null]]', 0)");
createNodeServer(api, {}).listen(port, () => consoleLog("INFO", "Serveur d'essai de Cibles prêt", { port, copies: process.env.CIBLES_COPIES === "1", ouvert: process.env.CIBLES_FERME !== "1" }));
