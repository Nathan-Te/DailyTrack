import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { formatDay } from "@cdj/core";
import { createApi } from "./api";
import { ConfigError, adminTokenWarning, readConfig } from "./config";
import { openLibsql } from "./libsql-open";
import { consoleLog } from "./log";
import { creerMesures } from "./mesures";
import { DELAI_NIVEAU_MS, type DemandeNiveau, type ReponseNiveau } from "./niveauxFil";
import { createNodeServer } from "./node-server";
import { openSqlite } from "./node-sqlite";
import { REPLAYS_PER_MINUTE } from "./platform";
import { executeurFil } from "./jeux/fil";
import type { DemandeTower, ReponseTower } from "./towerRejeu";

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

/**
 * Lots P0, TP et K4e : les jours figés de chaque jeu (`{ <jeu>: { <date>: contenu } }`), inclus dans le paquet par `scripts/build-node.mjs` d'après les fiches (absents hors du paquet : aucun). Jump lit ses
 * niveaux, Tower ses jours (preuve comprise : elle reste dans l'image du serveur, qui la rejoue, jamais publiée) ; ce sont les options propres de ces deux jeux (`createApi`).
 */
declare const __JOURS_FIGES__: Record<string, Record<string, unknown>> | undefined;
const joursFiges = typeof __JOURS_FIGES__ === "undefined" ? {} : __JOURS_FIGES__;
const jumpFrozen = joursFiges.jump ?? {};
const towerFrozen = joursFiges.tower ?? {};

/**
 * Lot TP : les rejeux de Tower passent par **un fil de calcul** (`tower-fil.mjs`, la seconde entrée de `build-node.mjs`, posée à côté de `server.mjs` dans l'image) ; sans ce fichier (développement,
 * tests) le fil principal rejoue (repli). Une ligne de journal au démarrage dit lequel : sans donnée personnelle.
 */
const towerFilFichier = new URL("./tower-fil.mjs", import.meta.url);
const towerFil = existsSync(towerFilFichier);
const towerExecuteur = towerFil ? executeurFil<DemandeTower, ReponseTower>(towerFilFichier) : undefined;
consoleLog("INFO", towerFil ? "Tower : les rejeux passent par le fil de calcul" : "Tower : les rejeux passent par le fil principal (repli, pas de tower-fil.mjs)", { fil: towerFil });

// Lot D3 : les mesures de l'instance (retard de la boucle d'événements, étapes d'un envoi lent, ramasse-miettes) — des lignes de journal sans donnée personnelle.
const mesures = creerMesures({ log: consoleLog });
mesures.demarrer();

/**
 * Lot D3 (C9) : le niveau de Jump et le circuit de Track se calculent dans **un fil de calcul** (`niveaux-fil.mjs`, posé à côté de `server.mjs`) : 2 s de calcul qui ne bloquent plus le fil des joueurs. Sans le fichier
 * (développement, tests) le calcul se fait sur place, comme avant. Une ligne de journal au démarrage dit lequel.
 */
const niveauxFilFichier = new URL("./niveaux-fil.mjs", import.meta.url);
const niveauxFil = existsSync(niveauxFilFichier);
const niveauxExecuteur = niveauxFil ? executeurFil<DemandeNiveau, ReponseNiveau>(niveauxFilFichier, { delaiMs: DELAI_NIVEAU_MS }) : undefined;
consoleLog("INFO", niveauxFil ? "Niveaux du jour : le calcul passe par le fil de calcul" : "Niveaux du jour : le calcul se fait dans le fil principal (repli, pas de niveaux-fil.mjs)", { fil: niveauxFil });

const api = createApi({
  db,
  mesures,
  niveauxExecuteur,
  environment: config.environment,
  jumpFrozen,
  towerFrozen,
  towerExecuteur,
  joursFiges, // lot K4f : les jours figés des jeux neufs (les fiches)
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
    joursTower: Object.keys(towerFrozen).length,
    startupMs: Math.round(process.uptime() * 1000),
  });
});
