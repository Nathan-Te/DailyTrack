import type { SqlDb, SqlValue } from "./db";
import type { Logger } from "./log";
import type { Players } from "./players";

// Le registre des jeux (lot P0 de la plateforme) : **une définition par jeu**. Ce fichier ne contient que des types (aucune dépendance à
// l'exécution) ; la liste est dans `registry.ts`. Ce qui est commun à tous les jeux est écrit une fois dans la plateforme (`platform.ts` :
// identité, pseudo, profil, limitation de débit ; `config.ts` : configuration ; `log.ts` : journaux) et passé à chaque jeu.
// Recette pour ajouter un jeu : `apps/api/CLAUDE.md`, rubrique « Plateforme (lot P0) ».

/** Une instruction SQL d'une transaction (`SqlDb.batch`). */
export interface Statement {
  sql: string;
  params?: SqlValue[];
}

/** Ce que l'hébergeur dit d'une requête. */
export interface RequestInfo {
  /**
   * Identifie l'appelant pour la limitation de débit (adresse IP) ; fournie par l'hébergeur. Derrière Firebase : l'adresse du joueur, lue à
   * la position `TRUST_PROXY` de `X-Forwarded-For` — **falsifiable par un appel direct** à l'adresse `run.app` (lot R5).
   */
  clientKey?: string;
  /**
   * Lot R5 : l'**adresse de connexion**, la dernière entrée de `X-Forwarded-For`, écrite par le frontal de Google qui a reçu la connexion (jamais
   * par le client) : l'appelant lui-même pour un appel direct, un relais de Firebase sinon. Absente sans proxy de confiance (local, tests).
   * Chaque limite par adresse la compte aussi, plus largement (`PEER_FACTOR`) : un appel direct ne contourne plus la limite en changeant
   * d'adresse inventée.
   */
  peerKey?: string;
}

/** La plateforme, telle qu'un jeu la voit : écrite une fois pour tous les jeux. */
export interface Platform {
  db: SqlDb;
  now: () => number;
  log: Logger;
  /** `production`, `recette` ou `local` (`ENVIRONMENT`). */
  environment: string;
  /** La date de Paris d'aujourd'hui (numéro de jour) et le temps écoulé depuis minuit de Paris. */
  today(): number;
  sinceMidnight(): number;
  /** Joueurs, pseudos réservés, codes révoqués (table `players`, commune à tous les jeux). */
  players: Players;
  /** Empreinte salée d'une valeur (adresse, identifiant) pour un compteur : jamais la valeur en clair. */
  hashKey(prefix: string, value: string): Promise<string>;
  /** Compteur de débit **en base** (exact quelle que soit l'instance) : lève 429 au-delà de `limit` dans la fenêtre. */
  hit(key: string, limit: number): Promise<void>;
  /** Compteur de débit **en mémoire** (par instance, aucune écriture) pour les lectures : lève 429 au-delà de `limit` dans la fenêtre. */
  readHit(key: string, limit: number): void;
  /**
   * Lot R5 : la limite **par adresse** d'un envoi — l'adresse du joueur comptée **en base** à `limit` (`hit`), puis l'adresse de connexion
   * comptée **en mémoire** à `limit × PEER_FACTOR` (`peerHit`). À utiliser pour toute limite par adresse (jamais `hit` sur `clientKey` seul).
   */
  hitAddress(info: RequestInfo, prefix: string, limit: number): Promise<void>;
  /** Lot R5 : la limite par adresse d'une lecture (tout en mémoire) : l'adresse du joueur à `limit`, l'adresse de connexion à `limit × PEER_FACTOR`. */
  readHitAddress(info: RequestInfo, prefix: string, limit: number): Promise<void>;
  /** Lot R5 : l'adresse de connexion seule, en mémoire, à `limit × PEER_FACTOR` (rien si elle est absente ou égale à l'adresse du joueur). */
  peerHit(info: RequestInfo, prefix: string, limit: number): Promise<void>;
  /**
   * Lot R5 : le plafond global de rejeux de **cette instance** (par minute) — à appeler juste avant tout rejeu, après les vérifications bon
   * marché. `units` : le poids du rejeu (1 pour un essai ; un lot de vies compte une unité par 10 vies). Au-delà : 503 `busy` propre.
   */
  spendReplays(units?: number): void;
  /** Fenêtre et limites des compteurs de la plateforme. */
  limits: { windowMs: number; perClient: number; perPlayer: number };
  readJson(req: Request): Promise<Record<string, unknown>>;
  playerIdOf(value: unknown): string;
}

/** Un jeu en marche, créé par la plateforme. */
export interface GameInstance {
  /** Répond à une route du jeu (le corps d'une réponse 200), ou `undefined` si ce chemin n'est pas à lui. Lève `HttpError` pour un refus. */
  route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown>;
  /** Le niveau (ou circuit) du jour d'une date, tel que le serveur le calcule. */
  dailyLevel(day: number): Promise<unknown>;
  /**
   * La validation d'un essai envoyé : le serveur **rejoue** la rediffusion sur le niveau du jour (seule source d'un temps) et rend son propre
   * résultat, ou lève `HttpError`. DailyTrack : `replayRace` sur le circuit du jour ; DailyJump (lot P1) : `replayAttempt` sur le niveau du jour
   * (son temps en pas et ses morts, en plus du temps en ms).
   */
  validate?(day: number, replay: string): Promise<{ ms: number; ticks?: number; deaths?: number }>;
  /** Pseudo changé (`PUT /api/player`) : ce que le jeu montre déjà du joueur suit. */
  onRename?(playerId: string, name: string): Promise<void>;
  /** « Changer mon code » : les lignes du jeu passent au nouvel identifiant (dans la transaction de la plateforme). */
  rotateStatements?(oldId: string, newId: string): Statement[];
  /**
   * Lot R5 — effacement d'un joueur (`POST /api/admin/effacer`) : ce que le jeu garde de lui (`counts`, pour la réponse) et les instructions
   * qui l'effacent (`statements`, exécutées dans la transaction de la plateforme, avant la ligne `players`). Un jeu qui garde une nouvelle
   * donnée d'un joueur l'efface ici (et la page de confidentialité le dit).
   */
  erase?(playerId: string): Promise<{ counts: Record<string, number>; statements: Statement[] }>;
  /** Lot R5 : après un effacement, oublier ce que l'instance garde en mémoire (fantôme du premier d'un jour passé…). */
  onErased?(): void;
  /** Le contenu du profil du joueur (`GET /api/me`), pour le jeu qui le fournit (DailyTrack jusqu'au lot P2). */
  profile?(playerId: string): Promise<Record<string, unknown>>;
  /** Tâche facultative (hors production), toutes les 15 s sous Node. */
  tick?(): Promise<void>;
}

export interface GameDefinition<O = unknown> {
  /** Code court du jeu : `cdj` (DailyTrack), `jump` (DailyJump). */
  code: string;
  /** Nom affiché (journaux, documentation). */
  name: string;
  /**
   * Préfixe de ses routes. DailyTrack garde ses routes historiques (`/api/day`, `/api/submit`, `/api/salon`…) : son préfixe est `/api`, et il
   * passe après les jeux au préfixe plus long. Un nouveau jeu prend `/api/<code>`.
   */
  prefix: string;
  /** Ses tables (noms), pour la documentation et les mesures. */
  tables: readonly string[];
  /** Les instructions de création de ses tables : elles entrent dans le schéma et dans son empreinte (`meta`). */
  schema: readonly string[];
  /** Ses versions (simulation, générateur…), telles que ses routes les rendent. */
  versions(): Record<string, number>;
  /** Crée le jeu sur la plateforme. `options` : ce que `createApi` lui transmet (fichiers figés, réglages). */
  create(platform: Platform, options: O): GameInstance;
}
