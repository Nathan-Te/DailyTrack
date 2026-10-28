import { formatDay, parseDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  JumpReplayError,
  PREMIER_JOUR_JUMP,
  TICK_RATE,
  dailyLevel,
  decodeReplay,
  echantillonnerTrajectoire,
  encoderTrajectoire,
  jumpMedalFor,
  levelNumber,
  parseLevel,
  replayAttempt,
  textHash,
  thawLevel,
  type DailyLevel,
  type JumpMedal,
  type JumpMedals,
  type JumpReplay,
  type Level,
} from "@cdj/jump-sim";
import { inputsHash, jumpInputs } from "./copies";
import { WithHeaders, cacheHeaders } from "./cache";
import { replayUnits } from "./replayCost";
import { HttpError } from "./errors";
import type { AdminDuJeu, GameDefinition, GameInstance, MedaillePortail, Platform, PortailDuJeu, RequestInfo, Statement } from "./games";
import { JUMP_LIVES_SCHEMA, createJumpLives } from "./jumpLives";

// DailyJump (`jump`) au registre des jeux. Lot P0 de la plateforme : l'espace `/api/jump/` en lecture ; lot P1 : **le classement du jour
// prouvé par rejeu**.
//
//   GET  /api/jump/info                    versions de la simulation et du générateur, date du jour (Paris), jours figés de l'image, environnement
//   GET  /api/jump/day/<AAAA-MM-JJ>        le niveau de cette date tel que le serveur le calcule (identifiant, empreinte, temps de l'auteur,
//                                          médailles, thème ; jamais la grille)
//   POST /api/jump/submit                  (lot P1) un essai : la rediffusion est rejouée, le serveur garde **son** temps et ses morts
//   GET  /api/jump/day/<AAAA-MM-JJ>/board  (lot P1) le classement de ce jour : top 10, nombre de classés, la ligne du joueur (`X-Player-Id`)
//   GET  /api/jump/day/<AAAA-MM-JJ>/ghost/first  (lot P2) la rediffusion du premier de ce jour (son pseudo, son temps, les versions)
//   GET  /api/jump/me                      (lot P2) le profil DailyJump du joueur (`X-Player-Id`) : chaque jour classé (temps, morts, médaille)
//   POST /api/jump/lives                   (lot P3) un lot de vies du jour, chacune rejouée ; seules les morts rejouées comptent (`jumpLives.ts`)
//   GET  /api/jump/day/<AAAA-MM-JJ>/deaths (lot P3) la carte des morts du jour (comptes agrégés par tuile, cause dominante)
//   GET  /api/jump/day/<AAAA-MM-JJ>/carnage (lot P3) l'échantillon du carnage de tout le monde (≈ 150 vies d'autres joueurs)
//   GET  /api/jump/day/<AAAA-MM-JJ>/bundle (lot P4) **la lecture regroupée** : classement, fantôme du premier et carte des morts en une
//                                          réponse (+ le profil DailyJump du jour en cours avec `X-Player-Id`) ; l'échantillon reste à part
//
// **Lot P4 : moins de requêtes.** Un jeu lit au chargement et à l'arrivée le classement, le fantôme du premier et la carte des morts : la lecture
// regroupée les rend en une requête (Cloud Run facture les requêtes : 2 M par mois gratuites, partagées avec DailyTrack et son Salon). Les
// routes séparées restent (compatibilité, `smoke`). Les lectures portent un `Cache-Control` (`cache.ts`) : long pour un jour fermé, court pour
// le jour en cours, **jamais partagé** quand la réponse dépend de `X-Player-Id` (`private` + `Vary`). L'envoi d'un essai rend aussi le
// classement (`board`) : le jeu n'a pas à le relire après son envoi.
//
// **Lot P2 : un profil par jeu.** `GET /api/me` reste celui de DailyTrack (DailyJump ne fournit pas de crochet `profile` : la réponse de
// `/api/me` ne change pas) ; DailyJump a le sien, `/api/jump/me`, sous son préfixe. Toutes deux sont des lectures : débit **en mémoire**.
//
// **Le serveur calcule le niveau par la même règle que le jeu** (`apps/jump/src/dailyLoader.ts`) : d'abord le **fichier figé** de la date
// (`apps/jump/public/levels/AAAA-MM-JJ.json`, inclus dans l'image), accepté seulement si `thawLevel` (`@cdj/jump-sim`, **la fonction même du
// jeu** depuis le lot P1) le vérifie et rejoue sa preuve ; sinon `dailyLevel(jour)` du même code. Un test compare les deux, date par date
// (`apps/api/test/jump.test.ts`). Résultat gardé dans la table `jump_levels` avec son texte : **un seul calcul** même si deux requêtes arrivent
// ensemble (une promesse en cours par jour, comme les circuits de DailyTrack) ; la ligne porte la règle qui l'a produite (versions, fichier
// figé) et n'est relue que si elle est la même. Les dates futures sont refusées (comme sur le site publié), et celles d'avant le premier
// niveau. Lectures limitées **en mémoire** (une lecture n'écrit rien).
//
// **Un envoi (lot P1)** est validé dans cet ordre, du moins cher au plus cher : (1) **débit**, compté en base comme les envois de DailyTrack
// (par adresse, puis par joueur : l'identifiant est dans l'en-tête `X-Player-Id`, lisible avant le corps), **avant tout rejeu** ; (2) **taille
// du corps** (`readJson`, `MAX_BODY_BYTES`) ; (3) **le niveau du jour seulement** (date de Paris, grâce de 10 min après minuit comme DailyTrack ;
// archive, thème forcé `-t…`, date future : refusés) ; (4) **versions** (`JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION`, identifiant du niveau
// du serveur) : 409 `version` « Une nouvelle version du jeu est disponible » ; puis code révoqué et pseudo (bon marché, comme DailyTrack) ;
// (5) **rejeu** (`replayAttempt`) sur le niveau en cache : l'essai doit partir du départ et arriver ; le serveur garde **son** temps (en pas,
// morts et reprises comprises) et ses morts. Jamais un temps annoncé.
//
// **Égalités** (comme DailyTrack) : à temps égal (en pas), le premier **envoyé** passe devant (`submitted_at` du meilleur essai) ; au même
// instant (milliseconde), l'identifiant départage (ordre arbitraire mais stable : le rang de chacun et le top 10 sont toujours cohérents).
// Un jour passé (grâce comprise) est **figé** : son classement reste lisible, plus aucun envoi n'est accepté.

/** Un joueur qui arrive juste après minuit (heure de Paris) peut encore classer son essai de la veille : la même grâce que DailyTrack (`GRACE_MS`). */
export const JUMP_GRACE_MS = 10 * 60_000;
/** Le classement rend les 10 premiers. */
export const JUMP_BOARD_TOP = 10;
/** Lectures de `/api/jump/*` par adresse et par fenêtre de débit (10 minutes) : un jeu en fait quelques-unes par partie. */
export const JUMP_READS_PER_CLIENT = 120;
/** Lot G1 : lectures du fantôme Diamant (une trajectoire de ≈ 2,5 ko) par adresse et par joueur et par fenêtre. */
export const JUMP_DIAMOND_READS_PER_CLIENT = 60;
export const JUMP_DIAMOND_PER_PLAYER = 30;
/** Lot P2 : lectures du profil par joueur et par fenêtre (le jeu se synchronise au plus toutes les 30 s, et après chaque envoi accepté). */
export const JUMP_ME_PER_PLAYER = 60;
/** Lot P2 : fantômes du premier d'un jour passé gardés en mémoire (figés : le premier d'un jour fini ne change plus). */
const GHOST_CACHE_MAX = 64;
/** Lot I2 : durée de vie en mémoire du nombre de classés du jour montré par le portail (l'écart minimal entre deux relectures du jeu). */
export const JUMP_CLASSES_MEMO_MS = 30_000;
/** Lot R5 : durée de vie en mémoire du premier d'un jour fermé (un effacement fait sur une autre instance s'y voit au plus après ce délai). */
export const CLOSED_GHOST_TTL_MS = 10 * 60_000;

/** Les tables de DailyJump : le cache des niveaux du jour (aucune donnée de joueur) et les meilleurs essais (lot P1). */
export const JUMP_SCHEMA: string[] = [
  // Niveau du jour de chaque date, tel que le serveur le calcule (figé d'abord, sinon généré). `rule` : la règle qui l'a produit (versions de la
  // simulation et du générateur, empreinte du fichier figé de l'image) ; une autre règle = recalcul. `ascii` : le texte du niveau (le rejeu
  // d'un envoi s'en sert sans le régénérer) ; jamais rendu par l'API.
  `CREATE TABLE IF NOT EXISTS jump_levels (
     day INTEGER PRIMARY KEY,
     rule TEXT NOT NULL,
     level_id TEXT NOT NULL,
     hash TEXT NOT NULL,
     author_ticks INTEGER NOT NULL,
     medals TEXT NOT NULL,
     theme TEXT NOT NULL,
     source TEXT NOT NULL,
     ascii TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     author_hash TEXT
   )`,
  // Lot P1 : meilleur essai de chaque joueur pour chaque jour, **rejoué par le serveur** : sa rediffusion (le fantôme du premier, lot P2), son
  // temps en pas et ses morts (ceux du rejeu), les versions qui l'ont rejoué, le premier envoi valide du jour et l'envoi du meilleur (qui
  // départage les égalités). Remplacé seulement par un temps strictement meilleur. Lot I2 : `final_rank` / `final_total`, la place et le nombre
  // de classés d'un jour fermé, calculés une fois (au premier profil commun lu après la grâce) puis gardés, comme `results` de DailyTrack.
  `CREATE TABLE IF NOT EXISTS jump_results (
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     level_id TEXT NOT NULL,
     ticks INTEGER NOT NULL,
     deaths INTEGER NOT NULL,
     replay TEXT NOT NULL,
     sim_version INTEGER NOT NULL,
     generator_version INTEGER NOT NULL,
     first_at INTEGER NOT NULL,
     submitted_at INTEGER NOT NULL,
     final_rank INTEGER,
     final_total INTEGER,
     inputs_hash TEXT,
     PRIMARY KEY (day, player_id)
   )`,
  `CREATE INDEX IF NOT EXISTS jump_results_by_time ON jump_results (day, ticks, submitted_at, player_id)`,
  `CREATE INDEX IF NOT EXISTS jump_results_by_player ON jump_results (player_id, day)`,
  // Lot P3 : les vies du jour (une ligne par joueur et par jour) et la carte des morts et l'échantillon du carnage (une ligne par jour).
  ...JUMP_LIVES_SCHEMA,
];

export interface JumpOptions {
  /** Les fichiers figés de l'image (date → contenu JSON), lus à la construction (`scripts/build-node.mjs`) ; vide sans eux. */
  frozen?: Readonly<Record<string, unknown>>;
}

/** Le niveau d'une date tel que `/api/jump/day` le rend. */
export interface JumpDayInfo {
  date: string;
  number: number;
  id: string;
  hash: string;
  authorTicks: number;
  medals: JumpMedals;
  theme: string;
  /** `fige` : le fichier figé de l'image, preuve rejouée ; `genere` : `dailyLevel(jour)`. */
  source: "fige" | "genere";
  simVersion: number;
  generatorVersion: number;
}

interface Computed {
  info: JumpDayInfo;
  ascii: string;
  /** Lot R9 : les entrées de la preuve de l'auteur (`copies.ts`, `jumpInputs`) : le serveur en garde l'empreinte, jamais la preuve ailleurs que dans son image. */
  authorInputs: string;
}

/** Une ligne du classement. */
export interface JumpBoardRow {
  rank: number;
  name: string;
  ticks: number;
  deaths: number;
  medal: JumpMedal | null;
}

/** Ce que l'essai rejoué a donné (la réponse de `POST /api/jump/submit`). */
export interface JumpSubmitResult {
  accepted: true;
  date: string;
  levelId: string;
  /** Le temps et les morts **du rejeu** de cet envoi. */
  ticks: number;
  deaths: number;
  /** Vrai si cet envoi devient le meilleur essai du joueur pour ce jour. */
  improved: boolean;
  /** Le meilleur essai gardé (celui-ci ou un précédent), sa médaille, son rang et le nombre de classés. */
  bestTicks: number;
  bestDeaths: number;
  medal: JumpMedal | null;
  rank: number;
  participants: number;
  /** Lot P4 : le classement du jour juste après cet envoi (celui de `/board`, ta ligne comprise) : le jeu ne le relit pas. */
  board: JumpBoard;
}

/** `GET /api/jump/day/<date>/board` : top 10, nombre de classés, ta ligne (`X-Player-Id`). */
export interface JumpBoard {
  date: string;
  open: boolean;
  participants: number;
  levelId: string | null;
  top: JumpBoardRow[];
  me: JumpBoardRow | null;
}

/** `GET /api/jump/day/<date>/ghost/first` (lot P2) : le meilleur essai du jour, tel que le serveur l'a rejoué et classé premier. */
/** Lot G1 : ce que rend `GET /api/jump/fantome-diamant` — une trajectoire (positions échantillonnées, `jump-sim` : `decoderTrajectoire`), jamais des entrées. */
export interface JumpDiamond {
  date: string;
  levelId: string;
  /** Le temps de l'auteur du niveau, en pas (le temps du Diamant : la trajectoire dure autant). */
  ticks: number;
  simVersion: number;
  generatorVersion: number;
  trajectoire: string;
}

export interface JumpFirstGhost {
  date: string;
  levelId: string;
  name: string;
  /** Temps (pas) et morts **du rejeu du serveur**. */
  ticks: number;
  deaths: number;
  /** La rediffusion (base64url) et les versions qui l'ont rejouée : le jeu ignore une rediffusion d'une autre version. */
  replay: string;
  simVersion: number;
  generatorVersion: number;
  /** Le premier, c'est toi (en-tête `X-Player-Id`) : pas de doublon de fantôme. */
  mine: boolean;
}

/** Un jour du profil DailyJump (`GET /api/jump/me`, lot P2). */
export interface JumpMeDay {
  date: string;
  levelId: string;
  /** Meilleur temps (pas) **rejoué par le serveur**, ses morts, sa médaille (celle du niveau de ce jour-là ; `null` sans médaille). */
  ticks: number;
  deaths: number;
  medal: JumpMedal | null;
}

/** `GET /api/jump/me` (lot P2) : le profil DailyJump du joueur, tel que le serveur le connaît. */
export interface JumpMe {
  name: string;
  renameRequired: boolean;
  today: string;
  simVersion: number;
  generatorVersion: number;
  days: JumpMeDay[];
  stats: { days: number; medals: { author: number; gold: number; silver: number; bronze: number }; streak: number };
}

/**
 * `GET /api/jump/day/<date>/bundle` (lot P4) : ce que le jeu lit au chargement et à l'arrivée, en une réponse. `ghost` vaut `null` si personne
 * n'est classé (la route séparée répond 404 `no_ghost`). Avec `X-Player-Id`, pour le jour en cours : le profil DailyJump (`/api/jump/me`), ou
 * `null` et la raison (`profileError` : `unknown_player`, `code_revoked`) ; jamais pour un jour passé. **Une seule adresse par jour** pour toutes
 * les lectures personnelles : le navigateur ne fait qu'un pré-vol CORS (OPTIONS, facturé comme une requête) par adresse et par 2 heures.
 */
export interface JumpBundle {
  date: string;
  open: boolean;
  board: JumpBoard;
  ghost: JumpFirstGhost | null;
  deaths: unknown;
  /** Lot R8 : la génération de données (remise à zéro du lancement), `Platform.generation`. */
  generation: number;
  profile?: JumpMe | null;
  profileError?: string;
}

const LEVEL_ID = /^jour-(\d{4}-\d{2}-\d{2})-g(\d{1,4})(-t[a-z]+)?$/;

/** Ce que rend `validateJump` : l'essai rejoué par le serveur sur le niveau du jour. */
export interface JumpValidated {
  day: number;
  info: JumpDayInfo;
  replay: JumpReplay;
  ticks: number;
  deaths: number;
  /** Lot R9 : l'empreinte des entrées de l'essai, et celle de l'auteur du niveau (`null` : pas calculée, jour fermé) : la base du refus des copies. */
  inputsHash: string;
  authorHash: string | null;
}

// ——— La règle des niveaux figés : celle du jeu, importée de `@cdj/jump-sim` (lot P1 ; avant, une copie gardée égale par un test) ———

/**
 * Le niveau d'un fichier figé pour `day`, ou la raison du refus : **`thawLevel` de `@cdj/jump-sim`**, la fonction même du jeu (forme, date,
 * versions, identifiant, médailles, empreinte du texte, puis la preuve rejouée), mise à la forme de `/api/jump/day`.
 */
export function thawFrozen(raw: unknown, day: number): Computed | string {
  const d = thawLevel(raw, day);
  if (typeof d === "string") return d;
  const info: JumpDayInfo = {
    date: d.date,
    number: d.number,
    id: d.id,
    hash: d.hash,
    authorTicks: d.authorTicks,
    medals: { author: d.medals.author, gold: d.medals.gold, silver: d.medals.silver, bronze: d.medals.bronze },
    theme: d.theme,
    source: "fige",
    // Lot 15 : la version de la simulation du niveau (un jour figé en v3 le reste).
    simVersion: d.level.simVersion,
    generatorVersion: Number(/-g(\d+)$/.exec(d.id)?.[1] ?? JUMP_GENERATOR_VERSION),
  };
  return { info, ascii: d.ascii, authorInputs: jumpInputs(d.replay.runs) };
}

/** Le niveau d'une date par la règle du jeu : le fichier figé s'il se vérifie, sinon `dailyLevel(jour)`. `frozenMiss` : pourquoi le figé a été refusé. */
export function computeJumpDay(day: number, frozen: unknown): Computed & { frozenMiss: string } {
  let frozenMiss = "";
  if (frozen !== undefined) {
    const thawed = thawFrozen(frozen, day);
    if (typeof thawed !== "string") return { ...thawed, frozenMiss };
    frozenMiss = thawed;
  }
  const d = dailyLevel(day);
  const info: JumpDayInfo = {
    date: d.date,
    number: d.number,
    id: d.id,
    hash: d.hash,
    authorTicks: d.authorTicks,
    medals: { author: d.medals.author, gold: d.medals.gold, silver: d.medals.silver, bronze: d.medals.bronze },
    theme: d.theme,
    source: "genere",
    simVersion: d.level.simVersion,
    generatorVersion: JUMP_GENERATOR_VERSION,
  };
  return { info, ascii: d.ascii, authorInputs: jumpInputs(d.replay.runs), frozenMiss };
}

/** Le niveau d'une date par la règle du jeu et du serveur : le fichier figé s'il se vérifie (`thawLevel`), sinon `dailyLevel`. */
export function jumpDailyOf(day: number, frozen: Readonly<Record<string, unknown>>): DailyLevel {
  const raw = frozen[formatDay(day)];
  if (raw !== undefined) {
    const thawed = thawLevel(raw, day);
    if (typeof thawed !== "string") return thawed;
  }
  return dailyLevel(day);
}

/** Rang d'un résultat : ceux qui ont un meilleur temps, puis à temps égal ceux qui l'ont envoyé avant, puis au même instant l'identifiant. */
const RANK_SQL =
  "SELECT COUNT(*) AS n FROM jump_results WHERE day = ? AND hidden = 0 AND (ticks < ? OR (ticks = ? AND (submitted_at < ? OR (submitted_at = ? AND player_id < ?))))";

export function createJump(platform: Platform, options: JumpOptions): GameInstance {
  const { db, now, log, today, sinceMidnight, hashKey, hit, readHit, readJson, playerIdOf, players, limits } = platform;
  const frozen = options.frozen ?? {};
  const frozenDays = Object.keys(frozen).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  /** Niveaux connus de cette instance : la règle, ce que rend `/api/jump/day`, le texte, et le niveau lu (au premier rejeu). */
  const levels = new Map<number, { rule: string; info: JumpDayInfo; ascii: string; level: Level | null; authorHash: string | null }>();
  /** Niveaux en cours de calcul : deux requêtes simultanées n'en font qu'un (≈ 0,2 s de génération). */
  const computing = new Map<number, Promise<JumpDayInfo>>();

  /** La règle d'une date : versions et empreinte du fichier figé de l'image (sans le rejouer : le rejeu ne se fait qu'au calcul). */
  function ruleOf(day: number): string {
    const f = frozen[formatDay(day)] as { hash?: unknown } | undefined;
    const tag = f === undefined ? "-" : `f${typeof f.hash === "string" ? f.hash : "?"}`;
    return `s${JUMP_SIM_VERSION}-g${JUMP_GENERATOR_VERSION}-${tag}`;
  }

  async function getLevel(day: number): Promise<JumpDayInfo> {
    const rule = ruleOf(day);
    const memo = levels.get(day);
    if (memo && memo.rule === rule) return memo.info;
    let pending = computing.get(day);
    if (!pending) {
      pending = loadLevel(day, rule).finally(() => computing.delete(day));
      computing.set(day, pending);
    }
    return pending;
  }

  /** Le niveau jouable d'une date (pour le rejeu d'un envoi) : celui de `getLevel`, lu une fois par instance. */
  async function playable(day: number): Promise<{ info: JumpDayInfo; level: Level; authorHash: string | null }> {
    const info = await getLevel(day);
    const memo = levels.get(day)!;
    if (!memo.level) {
      // Le texte vient de la base : on vérifie son empreinte avant de s'en servir (une ligne abîmée ne doit jamais classer un essai).
      if (textHash(memo.ascii) !== info.hash) throw new HttpError(503, "level_unavailable", "Niveau du jour indisponible, réessaie plus tard");
      memo.level = parseLevel(memo.ascii);
    }
    return { info, level: memo.level, authorHash: memo.authorHash };
  }

  /** Lu en base si la règle est la même, sinon calculé et gardé. Deux instances peuvent le calculer ensemble : même résultat, même écriture. */
  async function loadLevel(day: number, rule: string): Promise<JumpDayInfo> {
    const row = await db.first<{ rule: string; level_id: string; hash: string; author_ticks: number; medals: string; theme: string; source: string; ascii: string; author_hash: string | null }>(
      "SELECT rule, level_id, hash, author_ticks, medals, theme, source, ascii, author_hash FROM jump_levels WHERE day = ?",
      [day],
    );
    let info: JumpDayInfo;
    let ascii: string;
    let authorHash: string | null;
    // Lot R9 : un niveau gardé sans l'empreinte de son auteur (écrit avant le lot) est recalculé tant que son jour accepte des essais ; un jour fermé ne sert plus à rien.
    if (row && row.rule === rule && (row.author_hash !== null || day < today() - 1)) {
      const generatorVersion = Number(/-g(\d+)$/.exec(row.level_id)?.[1] ?? JUMP_GENERATOR_VERSION);
      info = {
        date: formatDay(day),
        number: levelNumber(day),
        id: row.level_id,
        hash: row.hash,
        authorTicks: row.author_ticks,
        medals: JSON.parse(row.medals) as JumpMedals,
        theme: row.theme,
        source: row.source === "fige" ? "fige" : "genere",
        simVersion: JUMP_SIM_VERSION,
        generatorVersion,
      };
      ascii = row.ascii;
      authorHash = row.author_hash;
    } else {
      const started = performance.now();
      const c = computeJumpDay(day, frozen[formatDay(day)]);
      info = c.info;
      ascii = c.ascii;
      authorHash = await inputsHash(c.authorInputs);
      await db.run(
        "INSERT OR REPLACE INTO jump_levels (day, rule, level_id, hash, author_ticks, medals, theme, source, ascii, created_at, author_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [day, rule, info.id, info.hash, info.authorTicks, JSON.stringify(info.medals), info.theme, info.source, c.ascii, now(), authorHash],
      );
      if (c.frozenMiss) log("WARNING", "DailyJump : niveau figé refusé, niveau généré", { day: info.date, reason: c.frozenMiss.slice(0, 120) });
      log("INFO", "DailyJump : niveau du jour calculé", { day: info.date, id: info.id, source: info.source, ms: Math.round(performance.now() - started) });
    }
    levels.set(day, { rule, info, ascii, level: null, authorHash });
    return info;
  }

  function dayOf(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day > today()) throw new HttpError(404, "unknown_day", "Ce niveau n'est pas encore sorti");
    if (day < PREMIER_JOUR_JUMP) throw new HttpError(404, "unknown_day", "Ce jour n'a pas de niveau DailyJump");
    return day;
  }

  /** Le jour accepte-t-il encore des envois ? Aujourd'hui (Paris), et hier pendant la grâce qui suit minuit. Sinon il est figé. */
  const isOpen = (day: number): boolean => day === today() || (day === today() - 1 && sinceMidnight() < JUMP_GRACE_MS);

  async function limitReads(info: RequestInfo): Promise<void> {
    await platform.readHitAddress(info, "jrd", JUMP_READS_PER_CLIENT);
  }

  /** L'identifiant secret de l'en-tête `X-Player-Id` (jamais dans l'adresse : elle finit dans les journaux de l'hébergeur). */
  function headerPlayer(req: Request, required: boolean): string | null {
    const raw = req.headers.get("x-player-id");
    if (raw === null || raw === "") {
      if (required) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
      return null;
    }
    return playerIdOf(raw);
  }

  const versionError = (detail: string) => new HttpError(409, "version", `Une nouvelle version du jeu est disponible : recharge la page (${detail})`);

  /**
   * Étapes 3 à 5 de la validation d'un envoi (le débit et la taille sont vérifiés avant, par la route) : le niveau du jour seulement, les
   * versions, puis **le rejeu**. Rend le temps et les morts **du serveur**. Sert aussi au registre (`validate`).
   */
  /** Étape 3 d'un envoi (essai ou vies) : le niveau du jour seulement. Rend le numéro du jour ; archive, thème forcé, futur : refusés. */
  function dailyDayOf(levelId: unknown): number {
    const m = typeof levelId === "string" ? LEVEL_ID.exec(levelId) : null;
    if (!m) throw new HttpError(400, "invalid_level", "Identifiant de niveau attendu : jour-AAAA-MM-JJ-g<N>");
    if (m[3]) throw new HttpError(409, "not_daily", "Un thème forcé est un essai : il n'est jamais classé");
    const day = parseDay(m[1]!);
    if (day === null) throw new HttpError(400, "invalid_level", "Date du niveau illisible");
    if (day > today()) throw new HttpError(409, "not_daily", "Ce niveau n'est pas encore sorti");
    if (day < PREMIER_JOUR_JUMP) throw new HttpError(409, "not_daily", "Ce jour n'a pas de niveau DailyJump");
    if (!isOpen(day)) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé : seul le niveau du jour se classe");
    return day;
  }

  async function validateJump(body: Record<string, unknown>, beforeReplay?: () => Promise<void>): Promise<JumpValidated> {
    // 3. Le niveau du jour seulement.
    const levelId = body.levelId;
    const day = dailyDayOf(levelId);
    // 4. Les versions : celles du code du jeu, puis le niveau que le serveur calcule pour ce jour (figé ou généré).
    //    Lot R6 : un onglet resté ouvert pendant une mise en production envoie les versions de SON code. Pour un jour d'avant la bascule, le niveau n'a pas changé
    //    (fichier figé, même identifiant) : ses versions sont celles du niveau, et l'envoi est accepté ; pour un jour régénéré, ce sont celles du serveur, et un vieil
    //    onglet reçoit 409 `version` (« recharge la page »), jamais une perte silencieuse.
    if (typeof body.simVersion !== "number" || typeof body.generatorVersion !== "number") throw versionError(`simulation v${String(body.simVersion)}, générateur v${String(body.generatorVersion)}`);
    if (body.simVersion > JUMP_SIM_VERSION) throw versionError(`simulation v${String(body.simVersion)}, serveur v${JUMP_SIM_VERSION}`);
    if (typeof body.replay !== "string" || body.replay.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");
    let replay: JumpReplay;
    try {
      replay = decodeReplay(body.replay);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof JumpReplayError ? e.message : "Rediffusion illisible");
    }
    if (replay.simVersion > JUMP_SIM_VERSION) throw versionError(`rediffusion v${replay.simVersion}, serveur v${JUMP_SIM_VERSION}`);
    const { info, level, authorHash } = await playable(day);
    // Lot R6 : les versions annoncées par le jeu sont celles du serveur, ou celles du niveau de ce jour (un onglet d'avant la mise en production, sur un jour conservé).
    if (body.simVersion !== JUMP_SIM_VERSION && body.simVersion !== level.simVersion) throw versionError(`simulation v${body.simVersion}, serveur v${JUMP_SIM_VERSION}, niveau en v${level.simVersion}`);
    if (body.generatorVersion !== JUMP_GENERATOR_VERSION && body.generatorVersion !== info.generatorVersion) throw versionError(`générateur v${body.generatorVersion}, serveur v${JUMP_GENERATOR_VERSION}, niveau en g${info.generatorVersion}`);
    // Lot 15 : une rediffusion porte la version de son niveau (3 pour un jour figé en v3, 4 ensuite).
    if (replay.simVersion !== level.simVersion) throw versionError(`rediffusion v${replay.simVersion}, niveau en v${level.simVersion}`);
    if (levelId !== info.id) throw versionError(`niveau ${levelId}, le serveur joue ${info.id}`);
    if (replay.levelId !== info.id) throw new HttpError(400, "invalid_replay", "Cette rediffusion n'est pas celle de ce niveau");
    // Un essai part du départ, à l'arrêt, chrono à zéro : une « vie » qui repartirait d'un point de passage avec un chrono choisi n'est pas un essai.
    if (replay.start.checkpoint !== -1 || replay.start.time !== 0 || replay.start.elan !== 0 || replay.start.sections.length !== 0) {
      throw new HttpError(400, "invalid_replay", "Un essai part du départ du niveau");
    }
    await beforeReplay?.();
    platform.spendReplays(replayUnits(replay.runs)); // lots R5 et R7 : plafond global de rejeux de l'instance, proportionnel à la durée (503 au-delà)
    // 5. Le rejeu : la seule source du temps et des morts.
    let r;
    try {
      r = replayAttempt(level, replay, info.id);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof JumpReplayError ? e.message : "Rediffusion illisible");
    }
    if (!r.finished) throw new HttpError(422, "not_finished", "Cet essai n'arrive pas au bout du niveau");
    return { day, info, replay, ticks: r.time, deaths: r.deaths.length, inputsHash: await inputsHash(jumpInputs(replay.runs)), authorHash };
  }

  // Lot P3 : les vies de tout le monde (envoi, carte des morts, échantillon du carnage, oubli à la fin du jour).
  const lives = createJumpLives({
    platform,
    playable,
    dailyDayOf,
    dayOf,
    isOpen,
    lastClosed: () => (isOpen(today() - 1) ? today() - 2 : today() - 1),
    headerPlayer,
    versionError,
  });

  async function rankOf(day: number, ticks: number, submittedAt: number, playerId: string): Promise<number> {
    const row = await db.first<{ n: number }>(RANK_SQL, [day, ticks, ticks, submittedAt, submittedAt, playerId]);
    return (row?.n ?? 0) + 1;
  }

  async function participants(day: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results WHERE day = ? AND hidden = 0", [day]))?.n ?? 0;
  }

  /** Tous les essais classés d'un jour, masqués compris (le panneau d'administration compte l'activité réelle). */
  async function participantsTous(day: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results WHERE day = ?", [day]))?.n ?? 0;
  }

  async function submit(req: Request, info: RequestInfo): Promise<JumpSubmitResult> {
    // 1. Débit, compté en base (exact quelle que soit l'instance), avant de lire le corps et avant tout rejeu. Compteurs propres à DailyJump :
    // ceux de DailyTrack (`ip`, `p`) ne bougent pas.
    await platform.hitAddress(info, "jip", limits.perClient);
    const playerId = headerPlayer(req, true)!;
    await hit(await hashKey("jp", playerId), limits.perPlayer);
    // 2. Taille du corps (413 au-delà de `MAX_BODY_BYTES`, lu sans tout charger).
    const body = await readJson(req);
    // 3 à 5. Le jour, les versions, puis (après le code révoqué et le pseudo, bon marché) le rejeu.
    let known: Awaited<ReturnType<typeof players.find>> = null;
    let name = "";
    const v = await validateJump(body, async () => {
      // Pseudo (lot 30, règle de la plateforme) : réservé à son premier propriétaire, vérifié avant le rejeu et garanti par la base à l'écriture.
      await players.assertActive(playerId);
      known = await players.find(playerId);
      name = await players.resolveName(playerId, body.name, known);
    });

    // Lot R9 : une copie (les entrées de la preuve de l'auteur, ou d'un essai déjà classé d'un autre joueur ce jour-là) est refusée avant d'écrire quoi que ce soit (pas
    // même le joueur). Le même joueur qui renvoie son propre essai n'est pas concerné ; l'ordre d'arrivée ne change rien (le premier essai classé garde sa place).
    if (!platform.allowCopies) {
      if (v.inputsHash === v.authorHash) throw new HttpError(409, "replay_copy", "Cet essai est la copie de la preuve de l'auteur du niveau");
      const copy = await db.first<{ n: number }>("SELECT 1 AS n FROM jump_results WHERE day = ? AND inputs_hash = ? AND player_id <> ? LIMIT 1", [v.day, v.inputsHash, playerId]);
      if (copy) throw new HttpError(409, "replay_copy", "Cet essai est la copie d'un autre");
      // Lot N1 : un essai que l'administration a retiré ne revient pas tel quel.
      if (await db.first("SELECT 1 AS n FROM resultats_retires WHERE game = 'jump' AND day = ? AND inputs_hash = ? LIMIT 1", [v.day, v.inputsHash])) throw new HttpError(409, "replay_copy", "Cet essai a été retiré par l'administration");
    }

    const t = now();
    // Le joueur n'existe qu'après un essai valide (table `players` de la plateforme, comme DailyTrack).
    await players.save(playerId, name, known);
    const previous = await db.first<{ ticks: number; deaths: number; submitted_at: number }>("SELECT ticks, deaths, submitted_at FROM jump_results WHERE day = ? AND player_id = ?", [
      v.day,
      playerId,
    ]);
    const improved = !previous || v.ticks < previous.ticks;
    if (improved) {
      await db.run(
        `INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (day, player_id) DO UPDATE SET level_id = excluded.level_id, ticks = excluded.ticks, deaths = excluded.deaths, replay = excluded.replay,
           sim_version = excluded.sim_version, generator_version = excluded.generator_version, submitted_at = excluded.submitted_at, inputs_hash = excluded.inputs_hash
         WHERE excluded.ticks < jump_results.ticks`,
        [v.day, playerId, v.info.id, v.ticks, v.deaths, body.replay as string, JUMP_SIM_VERSION, JUMP_GENERATOR_VERSION, t, t, v.inputsHash, (known as { hidden: number } | null)?.hidden === 1 ? 1 : 0], // lot N1 : un joueur masqué reste masqué
      );
    }
    log("INFO", "DailyJump : essai du jour", { day: v.info.date, ticks: v.ticks, deaths: v.deaths, improved });
    const bestTicks = improved ? v.ticks : previous!.ticks;
    const bestDeaths = improved ? v.deaths : previous!.deaths;
    const bestAt = improved ? t : previous!.submitted_at;
    const [rank, total, rows] = await Promise.all([rankOf(v.day, bestTicks, bestAt, playerId), participants(v.day), topOf(v.day)]);
    const medal = jumpMedalFor(bestTicks, v.info.medals);
    // Lot P4 : le classement d'après l'envoi (le top 10 et ta ligne) : le jeu n'a pas à relire `/board`.
    const board: JumpBoard = {
      date: v.info.date,
      open: isOpen(v.day),
      participants: total,
      levelId: v.info.id,
      top: rows.map((r, i) => ({ rank: i + 1, name: r.name, ticks: r.ticks, deaths: r.deaths, medal: jumpMedalFor(r.ticks, v.info.medals) })),
      me: { rank, name, ticks: bestTicks, deaths: bestDeaths, medal },
    };
    return {
      accepted: true,
      date: v.info.date,
      levelId: v.info.id,
      ticks: v.ticks,
      deaths: v.deaths,
      improved,
      bestTicks,
      bestDeaths,
      medal,
      rank,
      participants: total,
      board,
    };
  }

  /** Les 10 premiers d'un jour (la règle des égalités). */
  function topOf(day: number): Promise<{ ticks: number; deaths: number; name: string }[]> {
    return db.all<{ ticks: number; deaths: number; name: string }>(
      "SELECT r.ticks AS ticks, r.deaths AS deaths, p.name AS name FROM jump_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.hidden = 0 ORDER BY r.ticks ASC, r.submitted_at ASC, r.player_id ASC LIMIT ?",
      [day, JUMP_BOARD_TOP],
    );
  }

  /** Le classement d'un jour : top 10, nombre de classés, la ligne du joueur (en-tête `X-Player-Id`). Un jour passé est figé, toujours lisible. */
  async function board(day: number, me: string | null): Promise<JumpBoard> {
    const [count, rows, own] = await Promise.all([
      participants(day),
      topOf(day),
      me
        ? db.first<{ ticks: number; deaths: number; submitted_at: number; name: string }>(
            "SELECT r.ticks AS ticks, r.deaths AS deaths, r.submitted_at AS submitted_at, p.name AS name FROM jump_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.player_id = ?",
            [day, me],
          )
        : Promise.resolve(null),
    ]);
    const base = { date: formatDay(day), open: isOpen(day), participants: count };
    if (count === 0) return { ...base, levelId: null, top: [], me: null };
    const level = await getLevel(day);
    const top: JumpBoardRow[] = rows.map((r, i) => ({ rank: i + 1, name: r.name, ticks: r.ticks, deaths: r.deaths, medal: jumpMedalFor(r.ticks, level.medals) }));
    const mine: JumpBoardRow | null = own && me ? { rank: await rankOf(day, own.ticks, own.submitted_at, me), name: own.name, ticks: own.ticks, deaths: own.deaths, medal: jumpMedalFor(own.ticks, level.medals) } : null;
    return { ...base, levelId: level.id, top, me: mine };
  }

  /**
   * Fantômes du premier des jours **fermés** (figés) : une lecture par jour et par instance et par `CLOSED_GHOST_TTL_MS`. Le jour en cours est
   * relu à chaque fois. Lot R5 : la mémoire expire (10 min) — un joueur effacé sur une autre instance n'y reste pas plus longtemps.
   */
  const firstOfClosed = new Map<number, { at: number; first: (Omit<JumpFirstGhost, "mine"> & { playerId: string }) | null }>();

  /**
   * Lot P2 : la rediffusion du premier d'un jour (la règle du classement : temps, puis premier envoyé, puis identifiant). Un jour passé est figé
   * (plus aucun envoi après la grâce) : son premier est gardé en mémoire. 404 `no_ghost` si personne n'est classé.
   */
  async function firstGhost(day: number, me: string | null): Promise<JumpFirstGhost> {
    const kept = firstOfClosed.get(day);
    let first = kept && now() - kept.at < CLOSED_GHOST_TTL_MS ? kept.first : undefined;
    if (first === undefined) {
      const row = await db.first<{ player_id: string; name: string; level_id: string; ticks: number; deaths: number; replay: string; sim_version: number; generator_version: number }>(
        "SELECT r.player_id AS player_id, p.name AS name, r.level_id AS level_id, r.ticks AS ticks, r.deaths AS deaths, r.replay AS replay, r.sim_version AS sim_version, r.generator_version AS generator_version FROM jump_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.hidden = 0 ORDER BY r.ticks ASC, r.submitted_at ASC, r.player_id ASC LIMIT 1",
        [day],
      );
      // Lot 15 : les versions rendues sont celles du serveur qui sert le fantôme (comme `/carnage` et `/me`) : le code v4 rejoue à l'identique
      // une rediffusion d'un jour v3 ; la version propre de la rediffusion (dans ses octets) est vérifiée par le jeu contre celle du niveau.
      first = row
        ? { playerId: row.player_id, date: formatDay(day), levelId: row.level_id, name: row.name, ticks: row.ticks, deaths: row.deaths, replay: row.replay, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION }
        : null;
      if (!isOpen(day) && first) {
        if (firstOfClosed.size >= GHOST_CACHE_MAX && !firstOfClosed.has(day)) firstOfClosed.delete(firstOfClosed.keys().next().value!);
        firstOfClosed.set(day, { at: now(), first });
      }
    }
    if (!first) throw new HttpError(404, "no_ghost", "Personne n'est encore classé ce jour-là");
    const { playerId, ...ghost } = first;
    return { ...ghost, mine: me !== null && me === playerId };
  }

  /**
   * Lot P2 : le profil DailyJump du joueur (`X-Player-Id`) : chaque jour classé, son meilleur temps rejoué, ses morts, sa médaille (celle du
   * niveau que le serveur a gardé pour ce jour, s'il est bien celui de l'essai), plus le nombre de jours, les médailles et la série. 404
   * `unknown_player` (jamais classé, dans aucun jeu), 410 `code_revoked`. Débit en mémoire (une lecture n'écrit rien).
   */
  async function myProfile(id: string, info: RequestInfo): Promise<JumpMe> {
    await platform.readHitAddress(info, "jmeip", JUMP_READS_PER_CLIENT);
    readHit(await hashKey("jme", id), JUMP_ME_PER_PLAYER);
    await players.assertActive(id);
    const [player, rows] = await Promise.all([
      players.find(id),
      db.all<{ day: number; level_id: string; ticks: number; deaths: number; l_id: string | null; medals: string | null }>(
        "SELECT r.day AS day, r.level_id AS level_id, r.ticks AS ticks, r.deaths AS deaths, l.level_id AS l_id, l.medals AS medals FROM jump_results r LEFT JOIN jump_levels l ON l.day = r.day WHERE r.player_id = ? ORDER BY r.day ASC",
        [id],
      ),
    ]);
    if (!player) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    const medals = { author: 0, gold: 0, silver: 0, bronze: 0 };
    const days: JumpMeDay[] = rows.map((r) => {
      let medal: JumpMedal | null = null;
      if (r.medals !== null && r.l_id === r.level_id) {
        try {
          medal = jumpMedalFor(r.ticks, JSON.parse(r.medals) as JumpMedals);
        } catch {
          medal = null;
        }
      }
      if (medal) medals[medal]++;
      return { date: formatDay(r.day), levelId: r.level_id, ticks: r.ticks, deaths: r.deaths, medal };
    });
    const played = new Set(rows.map((r) => r.day));
    const t = today();
    let streak = 0;
    for (let d = played.has(t) ? t : t - 1; played.has(d); d--) streak++;
    return {
      name: player.name,
      renameRequired: player.rename_required === 1,
      today: formatDay(t),
      simVersion: JUMP_SIM_VERSION,
      generatorVersion: JUMP_GENERATOR_VERSION,
      days,
      stats: { days: days.length, medals, streak },
    };
  }

  /**
   * Lot P4 : la lecture regroupée d'un jour — le classement (ta ligne avec `X-Player-Id`), le fantôme du premier (`null` sans classé) et la carte
   * des morts, en **une** requête ; avec `X-Player-Id` et pour le jour en cours, le profil DailyJump aussi (ses limites de débit, ses refus
   * rendus comme une valeur : `profileError`). Les mêmes fonctions que les routes séparées : mêmes réponses, mêmes lignes lues.
   */
  /**
   * Lot G1 : **le fantôme Diamant** (`GET /api/jump/fantome-diamant?date=`) : où était le personnage de l'auteur du niveau, 30 fois par seconde,
   * **jamais ses commandes** : la preuve de l'auteur ne quitte pas le serveur (lot R9), la rendre donnerait le temps du Diamant. Le serveur la
   * rejoue (`echantillonnerTrajectoire`, `@cdj/jump-sim`) et ne rend que des positions arrondies. **Déblocage** : un jour passé est libre ; le
   * jour même (et la grâce qui suit minuit : le jour est encore ouvert), il faut avoir un résultat classé ce jour-là (n'importe quelle médaille) —
   * sinon 403 `ghost_locked`. Gardé en mémoire par instance, par jour et par règle (versions et fichier figé).
   */
  const diamants = new Map<number, { rule: string; body: JumpDiamond }>();
  const diamantsEnCours = new Map<number, Promise<JumpDiamond>>();
  async function diamond(day: number): Promise<JumpDiamond> {
    const rule = ruleOf(day);
    const memo = diamants.get(day);
    if (memo && memo.rule === rule) return memo.body;
    let pending = diamantsEnCours.get(day);
    if (!pending) {
      pending = (async () => {
        const d = jumpDailyOf(day, frozen);
        const body: JumpDiamond = {
          date: d.date,
          levelId: d.id,
          // Lot G1 : le Diamant est le seuil de la médaille (le temps de l'auteur jusqu'à la bascule du lot G1, 105 % après) ; la trajectoire de l'auteur y est étirée.
          ticks: d.medals.author,
          simVersion: JUMP_SIM_VERSION,
          generatorVersion: JUMP_GENERATOR_VERSION,
          trajectoire: encoderTrajectoire(echantillonnerTrajectoire(d.level, d.replay, d.medals.author)),
        };
        if (diamants.size >= GHOST_CACHE_MAX && !diamants.has(day)) diamants.delete(diamants.keys().next().value!);
        diamants.set(day, { rule, body });
        return body;
      })().finally(() => diamantsEnCours.delete(day));
      diamantsEnCours.set(day, pending);
    }
    return pending;
  }

  async function diamondGhost(day: number, me: string | null, info: RequestInfo): Promise<JumpDiamond> {
    await platform.readHitAddress(info, "jdm", JUMP_DIAMOND_READS_PER_CLIENT);
    if (isOpen(day)) {
      if (me === null) throw new HttpError(403, "ghost_locked", "Finis le niveau pour débloquer le fantôme Diamant");
      readHit(await hashKey("jdmp", me), JUMP_DIAMOND_PER_PLAYER);
      await players.assertActive(me);
      const row = await db.first<{ n: number }>("SELECT 1 AS n FROM jump_results WHERE day = ? AND player_id = ?", [day, me]);
      if (!row) throw new HttpError(403, "ghost_locked", "Finis le niveau pour débloquer le fantôme Diamant");
    }
    return await diamond(day);
  }

  async function bundle(day: number, req: Request, info: RequestInfo): Promise<WithHeaders> {
    const me = headerPlayer(req, false);
    const open = isOpen(day);
    const date = formatDay(day);
    const wantProfile = me !== null && day === today();
    const profile = wantProfile
      ? myProfile(me, info).then(
          (p): { profile: JumpMe | null; profileError?: string } => ({ profile: p }),
          (e: unknown) => {
            if (e instanceof HttpError && (e.code === "unknown_player" || e.code === "code_revoked")) return { profile: null, profileError: e.code };
            throw e;
          },
        )
      : Promise.resolve(null);
    const [b, ghost, deaths, p, generation] = await Promise.all([
      board(day, me),
      firstGhost(day, me).catch((e: unknown) => {
        if (e instanceof HttpError && e.code === "no_ghost") return null;
        throw e;
      }),
      lives.deathMap(date),
      profile,
      platform.generation(),
    ]);
    const body: JumpBundle = { date, open, board: b, ghost, deaths, generation, ...(p ?? {}) };
    // Le profil change avec le joueur et ailleurs (un code changé sur un autre appareil) : revalidé à chaque fois. Le reste : la règle commune.
    return new WithHeaders(body, cacheHeaders({ open, perPlayer: true, noCache: wantProfile }));
  }

  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    // Lot P3 : la première requête qui voit un jour terminé fige sa carte et son échantillon et oublie ses vies brutes (une comparaison
    // d'entiers ensuite, par instance).
    if (path.startsWith("/api/jump/")) await lives.forget();
    if (path === "/api/jump/info") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await limitReads(info);
      return { game: "jump", simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, today: formatDay(today()), frozenDays, environment: platform.environment };
    }
    if (path === "/api/jump/submit") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await submit(req, info);
    }
    if (path === "/api/jump/lives") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await lives.receive(req, info);
    }
    if (path === "/api/jump/me") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await myProfile(headerPlayer(req, true)!, info);
    }
    if (path === "/api/jump/fantome-diamant") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      const date = _url.searchParams.get("date");
      if (date === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
      const day = dayOf(date);
      // Jamais en cache partagé : la réponse d'un jour ouvert n'est donnée qu'à qui a fini le niveau (`private` et `Vary: X-Player-Id`).
      return new WithHeaders(await diamondGhost(day, headerPlayer(req, false), info), cacheHeaders({ open: isOpen(day), perPlayer: true }));
    }
    const m = /^\/api\/jump\/day\/([^/]+)(\/board|\/ghost\/first|\/deaths|\/carnage|\/bundle)?$/.exec(path);
    if (m) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await limitReads(info);
      let date: string;
      try {
        date = decodeURIComponent(m[1]!);
      } catch {
        throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
      }
      const day = dayOf(date);
      // Lot P4 : chaque lecture porte son cache (`cache.ts`) ; celles qui dépendent de `X-Player-Id` ne sont jamais partagées.
      const open = isOpen(day);
      const personal = (body: unknown) => new WithHeaders(body, cacheHeaders({ open, perPlayer: true }));
      const common = (body: unknown) => new WithHeaders(body, cacheHeaders({ open, perPlayer: false }));
      if (m[2] === "/board") return personal(await board(day, headerPlayer(req, false)));
      if (m[2] === "/ghost/first") return personal(await firstGhost(day, headerPlayer(req, false)));
      if (m[2] === "/deaths") return common(await lives.deathMap(date));
      if (m[2] === "/carnage") return common(await lives.carnage(date));
      if (m[2] === "/bundle") return await bundle(day, req, info);
      return common(await getLevel(day));
    }
    if (path === "/api/jump" || path.startsWith("/api/jump/")) throw new HttpError(404, "not_found", "Route inconnue");
    return undefined;
  }

  // --- Lot I2 : ce que le portail montre de DailyJump (`portail.ts`) -----------------------------------------------------------
  // Le niveau du jour (`getLevel` : figé ou généré, gardé) donne le numéro, le thème et les seuils (en pas, rendus en ms) ; l'état du joueur vient
  // de `jump_results` (classement prouvé) puis, sans essai classé, de `jump_lives` (des morts envoyées ce jour-là : `en_cours`).
  const msOfTicks = (ticks: number) => Math.round((ticks * 1000) / TICK_RATE);
  const classesMemo = new Map<number, { at: number; n: number }>();
  async function classesDuJour(day: number): Promise<number> {
    const kept = classesMemo.get(day);
    if (kept && now() - kept.at < JUMP_CLASSES_MEMO_MS) return kept.n;
    const n = await participants(day);
    if (classesMemo.size > 8) classesMemo.clear();
    classesMemo.set(day, { at: now(), n });
    return n;
  }

  /**
   * Le profil commun : jours classés, médailles, meilleure place. La place d'un jour fermé est calculée une fois (`final_rank`, `final_total`)
   * puis gardée (un jour fermé est figé : la relire coûterait une ligne par classé et par jour) ; aujourd'hui (et hier pendant la grâce) : la
   * place du moment.
   */
  async function profilPortail(id: string): Promise<{ joursFinis: number; medailles: Record<MedaillePortail, number>; meilleurRang: { date: string; rang: number; classes: number } | null }> {
    const rows = await db.all<{ day: number; level_id: string; ticks: number; submitted_at: number; final_rank: number | null; final_total: number | null; l_id: string | null; medals: string | null }>(
      "SELECT r.day AS day, r.level_id AS level_id, r.ticks AS ticks, r.submitted_at AS submitted_at, r.final_rank AS final_rank, r.final_total AS final_total, l.level_id AS l_id, l.medals AS medals FROM jump_results r LEFT JOIN jump_levels l ON l.day = r.day WHERE r.player_id = ?",
      [id],
    );
    const closedBefore = isOpen(today() - 1) ? today() - 1 : today();
    if (rows.some((r) => r.final_rank === null && r.day < closedBefore)) {
      const done = await db.all<{ day: number; final_rank: number; final_total: number }>(
        `UPDATE jump_results SET
           final_rank = (SELECT COUNT(*) FROM jump_results x WHERE x.day = jump_results.day AND x.hidden = 0 AND (x.ticks < jump_results.ticks OR (x.ticks = jump_results.ticks
             AND (x.submitted_at < jump_results.submitted_at OR (x.submitted_at = jump_results.submitted_at AND x.player_id < jump_results.player_id))))) + 1,
           final_total = (SELECT COUNT(*) FROM jump_results x WHERE x.day = jump_results.day AND x.hidden = 0) + jump_results.hidden
         WHERE player_id = ? AND final_rank IS NULL AND day < ? RETURNING day, final_rank, final_total`,
        [id, closedBefore],
      );
      const byDay = new Map(done.map((d) => [d.day, d]));
      for (const r of rows) {
        const d = byDay.get(r.day);
        if (d) {
          r.final_rank = d.final_rank;
          r.final_total = d.final_total;
        }
      }
    }
    const medailles: Record<MedaillePortail, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    let meilleurRang: { date: string; rang: number; classes: number } | null = null;
    for (const r of rows) {
      if (r.medals !== null && r.l_id === r.level_id) {
        try {
          const m = jumpMedalFor(r.ticks, JSON.parse(r.medals) as JumpMedals);
          if (m) medailles[m]++;
        } catch {
          /* médailles illisibles : le jour compte, pas sa médaille */
        }
      }
      const rang = r.final_rank ?? (await rankOf(r.day, r.ticks, r.submitted_at, id));
      const classes = r.final_total ?? (await participants(r.day));
      if (!meilleurRang || rang < meilleurRang.rang || (rang === meilleurRang.rang && classes > meilleurRang.classes)) meilleurRang = { date: formatDay(r.day), rang, classes };
    }
    return { joursFinis: rows.length, medailles, meilleurRang };
  }

  const portail: PortailDuJeu = {
    site: "jump",
    nom: "Jump",
    premierJour: PREMIER_JOUR_JUMP,
    async jour(day) {
      const l = await getLevel(day);
      return {
        numero: l.number,
        theme: l.theme,
        seuils: { author: msOfTicks(l.medals.author), gold: msOfTicks(l.medals.gold), silver: msOfTicks(l.medals.silver), bronze: msOfTicks(l.medals.bronze) },
      };
    },
    async etat(id, day, connu) {
      const own = await db.first<{ ticks: number; submitted_at: number }>("SELECT ticks, submitted_at FROM jump_results WHERE day = ? AND player_id = ?", [day, id]);
      if (own) {
        // Lot I3 : la place et les classés du classement du jour gardé par le portail, quand il les a ; sinon on les compte (une ligne lue par classé).
        const [rang, classes, level] = await Promise.all([connu ? connu.rang : rankOf(day, own.ticks, own.submitted_at, id), connu ? connu.classes : classesDuJour(day), getLevel(day)]);
        return { statut: "fini", tempsMs: msOfTicks(own.ticks), medaille: jumpMedalFor(own.ticks, level.medals), rang, classes: Math.max(classes, rang) };
      }
      // Pas d'essai classé : des morts envoyées ce jour-là (les vies du jour, oubliées à la fin du jour) disent que le joueur a commencé.
      const vies = await db.first<{ count: number }>("SELECT count FROM jump_lives WHERE day = ? AND player_id = ?", [day, id]);
      return vies && vies.count > 0 ? { statut: "en_cours", morts: vies.count } : { statut: "pas_joue" };
    },
    joursFinis: async (id) => (await db.all<{ day: number }>("SELECT day FROM jump_results WHERE player_id = ?", [id])).map((r) => r.day),
    profil: profilPortail,
    // Lot I3 : tous les classés du jour, dans l'ordre du classement du jeu (temps en pas, premier envoyé, identifiant : `RANK_SQL`), médaille lue
    // sur les seuils du niveau du jour (comme `etat`). Aucun calcul de niveau pour un jour sans classé.
    async classes(day) {
      const rows = await db.all<{ player_id: string; ticks: number; submitted_at: number }>(
        "SELECT player_id, ticks, submitted_at FROM jump_results WHERE day = ? AND hidden = 0 ORDER BY ticks ASC, submitted_at ASC, player_id ASC",
        [day],
      );
      if (rows.length === 0) return [];
      const level = await getLevel(day);
      return rows.map((r) => ({ playerId: r.player_id, tempsMs: msOfTicks(r.ticks), medaille: jumpMedalFor(r.ticks, level.medals), at: r.submitted_at }));
    },
  };

  // --- Lot N1 : ce que le panneau d'administration fait de DailyJump (`admin.ts`) -----------------------------------------------------
  // Même principe que DailyTrack : « masquer » recopie `hidden` sur chaque essai classé du joueur, « retirer » sort la ligne de `jump_results` (la rediffusion va dans
  // `resultats_retires`). Les places finales gardées des jours concernés sont oubliées. Le premier d'un jour fermé gardé en mémoire (`firstOfClosed`) est oublié par `onErased`.
  const admin: AdminDuJeu = {
    activite: [{ table: "jump_results", jour: "day", joueur: "player_id" }],
    compteurs: async (day) => {
      const [finis, vies] = await Promise.all([
        participantsTous(day),
        db.first<{ n: number }>("SELECT COALESCE(SUM(count), 0) AS n FROM jump_lives WHERE day = ?", [day]),
      ]);
      let morts = vies?.n ?? 0;
      if (morts === 0) morts = (await db.first<{ n: number }>("SELECT deaths AS n FROM jump_deaths WHERE day = ?", [day]))?.n ?? 0; // un jour fini : les vies brutes sont oubliées, il reste le total figé
      return { finis, morts };
    },
    joursPrets: async () => ({ figes: frozenDays.length }),
    resultats: async (id, limite) => {
      const [jours, rows] = await Promise.all([
        db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results WHERE player_id = ?", [id]),
        db.all<{ day: number; level_id: string; ticks: number; deaths: number; submitted_at: number; hidden: number; final_rank: number | null; final_total: number | null; l_id: string | null; medals: string | null }>(
          "SELECT r.day AS day, r.level_id AS level_id, r.ticks AS ticks, r.deaths AS deaths, r.submitted_at AS submitted_at, r.hidden AS hidden, r.final_rank AS final_rank, r.final_total AS final_total, l.level_id AS l_id, l.medals AS medals FROM jump_results r LEFT JOIN jump_levels l ON l.day = r.day WHERE r.player_id = ? ORDER BY r.day DESC LIMIT ?",
          [id, limite],
        ),
      ]);
      const liste = [];
      for (const r of rows) {
        let medaille: MedaillePortail | null = null;
        if (r.medals !== null && r.l_id === r.level_id) {
          try {
            medaille = jumpMedalFor(r.ticks, JSON.parse(r.medals) as JumpMedals);
          } catch {
            medaille = null;
          }
        }
        const rang = r.final_rank ?? (await rankOf(r.day, r.ticks, r.submitted_at, id)); // un jour fermé a sa place gardée
        const classes = r.final_total ?? (await participants(r.day));
        liste.push({ day: r.day, tempsMs: msOfTicks(r.ticks), morts: r.deaths, medaille, rang, classes: Math.max(classes + r.hidden, rang), envoyeA: r.submitted_at });
      }
      return { jours: jours?.n ?? 0, liste };
    },
    retirer: async (id, day) => {
      const row = await db.first<{ ticks: number; replay: string; inputs_hash: string | null }>("SELECT ticks, replay, inputs_hash FROM jump_results WHERE day = ? AND player_id = ?", [day, id]);
      if (!row) return null;
      return {
        tempsMs: msOfTicks(row.ticks),
        replay: row.replay,
        inputsHash: row.inputs_hash,
        statements: [
          { sql: "UPDATE jump_results SET final_rank = NULL, final_total = NULL WHERE day = ?", params: [day] },
          { sql: "DELETE FROM jump_results WHERE day = ? AND player_id = ?", params: [day, id] },
        ],
      };
    },
    masquer: (id, masque): Statement[] => [
      { sql: "UPDATE jump_results SET final_rank = NULL, final_total = NULL WHERE day IN (SELECT day FROM jump_results WHERE player_id = ?)", params: [id] },
      { sql: "UPDATE jump_results SET hidden = ? WHERE player_id = ?", params: [masque ? 1 : 0, id] },
    ],
    // Le lecteur existant (`?watch=first`, lot P2) ne montre que l'essai du premier du jour.
    lienRediffusion: (date, rang) => (rang === 1 ? `/jump/?watch=first&seed=${date}` : null),
  };

  return {
    route,
    portail,
    admin,
    dailyLevel: getLevel,
    // Le registre : la validation d'un essai (le niveau du jour, les versions du code, le rejeu). Le temps rendu est celui du rejeu, en ms.
    validate: async (day, code) => {
      const level = await getLevel(day);
      const v = await validateJump({ levelId: level.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code });
      return { ms: Math.round((v.ticks * 1000) / TICK_RATE), ticks: v.ticks, deaths: v.deaths };
    },
    // « Changer mon code » : les essais classés suivent le joueur (les premiers gardés en mémoire sont oubliés : leur identifiant a changé).
    rotateStatements: (oldId, newId): Statement[] => {
      firstOfClosed.clear();
      return [{ sql: "UPDATE jump_results SET player_id = ? WHERE player_id = ?", params: [newId, oldId] }, ...lives.rotateStatements(oldId, newId)];
    },
    // Un pseudo changé : le premier d'un jour passé gardé en mémoire le reprend à la prochaine lecture.
    onRename: async () => {
      firstOfClosed.clear();
    },
    // Lot R5 — effacement d'un joueur : ses essais classés (un premier effacé n'est plus servi : le suivant devient le premier) et ses vies du
    // jour en cours (`jumpLives.ts`). La carte et l'échantillon figés des jours passés n'ont plus aucun lien avec lui (vies brutes oubliées).
    erase: async (playerId) => {
      const n = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results WHERE player_id = ?", [playerId]);
      const l = await lives.erase(playerId);
      return {
        counts: { essaisDailyJump: n?.n ?? 0, ...l.counts },
        statements: [
          // Lot I2 : les places finales des jours concernés sont recalculées sans lui (à la prochaine lecture du profil commun des autres).
          { sql: "UPDATE jump_results SET final_rank = NULL, final_total = NULL WHERE day IN (SELECT day FROM jump_results WHERE player_id = ?)", params: [playerId] },
          { sql: "DELETE FROM jump_results WHERE player_id = ?", params: [playerId] },
          ...l.statements,
        ],
      };
    },
    onErased: () => {
      firstOfClosed.clear();
      lives.onErased();
    },
  };
}

/** DailyJump au registre : routes sous `/api/jump`. */
export const JUMP_GAME: GameDefinition<JumpOptions> = {
  code: "jump",
  name: "DailyJump",
  prefix: "/api/jump",
  tables: ["jump_levels", "jump_results", "jump_lives", "jump_deaths"],
  schema: JUMP_SCHEMA,
  versions: () => ({ simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION }),
  create: createJump,
};
