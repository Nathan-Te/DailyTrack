import { formatDay, parseDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  JumpReplayError,
  PREMIER_JOUR_JUMP,
  TICK_RATE,
  dailyLevel,
  declareFrozenGenerators,
  decodeReplay,
  jumpMedalFor,
  levelNumber,
  parseLevel,
  replayAttempt,
  textHash,
  thawLevel,
  verifierGenerateurDuJour,
  type DailyLevel,
  type JumpMedal,
  type JumpMedals,
  type JumpReplay,
  type Level,
} from "@cdj/jump-sim";
import { inputsHash, jumpInputs } from "./copies";
import type { ExecuteurNiveaux } from "./niveauxFil";
import { WithHeaders, cacheHeaders } from "./cache";
import { replayUnits } from "./replayCost";
import { HttpError } from "./errors";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition, GameInstance, MedaillePortail, Platform, RequestInfo } from "./games";
import { type AdaptateurTable, type ContratJeu, creerJeu, type LigneBrute, type LigneNiveau, type OutilsModule, RefusJeu } from "./jeux/index";
import { JUMP_LIVES_SCHEMA, createJumpLives } from "./jumpLives";

// **Lot K2b : le serveur de Jump = son contrat (`contratJump`), son adaptateur de table (`ADAPTATEUR_JUMP`) et ses routes propres** (vies, carte des morts, carnage, fantôme du premier, lecture regroupée) ; les
// routes `info`, `day`, `submit`, `board`, `me`, le classement, les copies, l'aperçu, l'effacement et les crochets du portail et de l'administration sont ceux du module des jeux (`jeux/module.ts`,
// `apps/api/CLAUDE.md`, « Module des jeux »). Ce qui suit décrit ce que fait le serveur de Jump, quel que soit l'endroit du code.
//
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
  /** Lot D3 : ce qui calcule le niveau d'un jour (le fil de calcul `niveaux-fil.mjs`, ou le fil principal en repli) ; absent : le calcul se fait sur place, comme avant. */
  niveaux?: ExecuteurNiveaux;
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
  /** Lot F2 : la référence publique du joueur (`players.ref`). */
  ref?: string;
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

const msOfTicks = (ticks: number) => Math.round((ticks * 1000) / TICK_RATE);
const n = (v: unknown): number => Number(v);

/** Le niveau du jour tel que le module le garde : ce que rend `/api/jump/day`, le texte (jamais rendu) et l'empreinte des entrées de l'auteur ; la grille jouable se lit une fois, au premier rejeu. */
export interface NiveauJump {
  info: JumpDayInfo;
  ascii: string;
  authorHash: string | null;
  level: Level | null;
}

/** Ce qu'un rejeu a donné : le temps (pas) et les morts du serveur. */
export interface MesureJump {
  ticks: number;
  deaths: number;
}

/**
 * **L'adaptateur de table de Jump** (lot K2b) : `jump_results`, classée au temps (pas) croissant (puis envoi ↑, identifiant ↑ : les départages ultimes de toute table) ; la table n'a pas de colonne
 * `medal` (la médaille se lit sur le niveau du jour) et le classement lit aussi les morts de l'essai ; `jump_levels` garde le niveau du jour.
 */
export const ADAPTATEUR_JUMP: AdaptateurTable = {
  table: "jump_results",
  colonnes: [{ nom: "ticks", colonne: "ticks", sens: "asc" }],
  sansMedaille: true,
  lecturesPlus: ["deaths"],
  colonnesEcrites: ["level_id", "ticks", "deaths", "replay", "sim_version", "generator_version", "first_at", "submitted_at", "inputs_hash", "hidden", "apercu"],
  colonnesGardees: ["first_at", "hidden", "apercu"],
  niveaux: { table: "jump_levels", colonnes: ["level_id", "hash", "author_ticks", "medals", "theme", "source", "ascii", "author_hash"] },
};

/** Lot 33 : le refus d'un niveau que le code ne peut pas rendre (générateur plus récent que celui de la date) ; le détail est journalisé, jamais rendu. */
function refusGenerateur(e: unknown, day: number, log: Platform["log"]): RefusJeu {
  log("ERROR", "DailyJump : niveau sans fichier figé d'un générateur que ce code ne rend pas, refusé", { day: formatDay(day), reason: (e instanceof Error ? e.message : String(e)).slice(0, 160) });
  return new RefusJeu("level_unavailable", "Niveau du jour indisponible : le générateur de cette date n'est pas celui de ce code et le jour n'est pas figé");
}

const versionRefus = (detail: string) => new RefusJeu("version", `Une nouvelle version du jeu est disponible : recharge la page (${detail})`);

/**
 * **Le contrat de Jump** (lot K2b) : le niveau du jour (le fichier figé qui se vérifie, sinon le générateur), la validation d'un essai **dans l'ordre de Jump** (`valider` : le niveau du jour seulement, les
 * versions, la rediffusion, un essai qui part du départ, puis le rejeu), les médailles lues sur le niveau, le format des réponses. Il ne lit ni n'écrit aucune table (la ligne du niveau est gardée par le
 * module) et ne construit aucune réponse HTTP (il lève `RefusJeu`).
 */
export function contratJump(platform: Platform, options: JumpOptions): ContratJeu<NiveauJump, JumpReplay, MesureJump> {
  const { log, today } = platform;
  const frozen = options.frozen ?? {};
  const niveaux = options.niveaux;
  const frozenDays = Object.keys(frozen).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  // Lot V1 : le générateur de chaque fichier figé dit si le jour garde l'ancienne règle des thèmes (g22 et avant) et si le premier jour du sac doit éviter le thème de la veille.
  const generateurs: Record<string, number> = Object.fromEntries(frozenDays.map((d) => [d, (frozen[d] as { generatorVersion?: unknown } | undefined)?.generatorVersion as number]));
  declareFrozenGenerators(generateurs);

  /** Le niveau jouable : le texte vient de la base, on vérifie son empreinte avant de s'en servir (une ligne abîmée ne doit jamais classer un essai). */
  function jouable(niveau: NiveauJump): Level {
    if (!niveau.level) {
      if (textHash(niveau.ascii) !== niveau.info.hash) throw new RefusJeu("level_unavailable", "Niveau du jour indisponible, réessaie plus tard");
      niveau.level = parseLevel(niveau.ascii);
    }
    return niveau.level;
  }

  /** Étape 3 d'un envoi (essai ou vies) : le niveau du jour seulement. Rend le numéro du jour ; archive, thème forcé, futur : refusés. */
  function jourDuNiveau(levelId: unknown, ouvert: (jour: number) => boolean): number {
    const m = typeof levelId === "string" ? LEVEL_ID.exec(levelId) : null;
    if (!m) throw new RefusJeu("invalid_level", "Identifiant de niveau attendu : jour-AAAA-MM-JJ-g<N>");
    if (m[3]) throw new RefusJeu("not_daily", "Un thème forcé est un essai : il n'est jamais classé");
    const day = parseDay(m[1]!);
    if (day === null) throw new RefusJeu("invalid_level", "Date du niveau illisible");
    if (day > today()) throw new RefusJeu("not_daily", "Ce niveau n'est pas encore sorti");
    if (day < PREMIER_JOUR_JUMP) throw new RefusJeu("not_daily", "Ce jour n'a pas de niveau DailyJump");
    if (!ouvert(day)) throw new RefusJeu("day_closed", "Le classement de ce jour est figé : seul le niveau du jour se classe");
    return day;
  }

  const contrat: ContratJeu<NiveauJump, JumpReplay, MesureJump> & { jourDuNiveau: typeof jourDuNiveau; jouable: typeof jouable } = {
    jourDuNiveau,
    jouable,
    nomJournal: "DailyJump",
    compteEffacement: "essaisDailyJump",
    messagesJournal: { jour: "DailyJump : niveau du jour calculé", partie: "DailyJump : essai du jour" },
    jourMin: PREMIER_JOUR_JUMP,
    versions: () => ({ simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION }),
    joursFiges: frozenDays,

    /** La règle d'une date : versions et empreinte du fichier figé de l'image (sans le rejouer : le rejeu ne se fait qu'au calcul). */
    async regle(day) {
      const f = frozen[formatDay(day)] as { hash?: unknown } | undefined;
      const tag = f === undefined ? "-" : `f${typeof f.hash === "string" ? f.hash : "?"}`;
      return `s${JUMP_SIM_VERSION}-g${JUMP_GENERATOR_VERSION}-${tag}`;
    },

    async calculer(day) {
      // Lot D3 : par le fil de calcul quand il y en a un (le fil principal reste libre pendant les 2 s du niveau), sinon sur place.
      const fige = frozen[formatDay(day)];
      // Lot 33 (incident du 06/11/2026) : un jour sans fichier figé ne se génère qu'avec le générateur en vigueur à sa date (calendrier des bascules). Sinon le serveur REFUSE (503
      // `level_unavailable`, journalisé) au lieu de servir en silence un autre niveau que celui que les joueurs ont vu ; la mise en production refuse de déployer dans ce cas (jours figés avant).
      if (fige === undefined) {
        try {
          verifierGenerateurDuJour(day);
        } catch (e) {
          throw refusGenerateur(e, day, log);
        }
      }
      let c: ReturnType<typeof computeJumpDay>;
      try {
        c = niveaux ? ((await niveaux.rejouer({ jeu: "jump", day, fige, generateurs })) as ReturnType<typeof computeJumpDay>) : computeJumpDay(day, fige);
      } catch (e) {
        if (e instanceof Error && e.name === "GenerateurDuJourError") throw refusGenerateur(e, day, log);
        throw e;
      }
      const authorHash = await inputsHash(c.authorInputs);
      if (c.frozenMiss) log("WARNING", "DailyJump : niveau figé refusé, niveau généré", { day: c.info.date, reason: c.frozenMiss.slice(0, 120) });
      const niveau: NiveauJump = { info: c.info, ascii: c.ascii, authorHash, level: null };
      const ligne: LigneNiveau = {
        level_id: c.info.id,
        hash: c.info.hash,
        author_ticks: c.info.authorTicks,
        medals: JSON.stringify(c.info.medals),
        theme: c.info.theme,
        source: c.info.source,
        ascii: c.ascii,
        author_hash: authorHash,
      };
      return { niveau, ligne };
    },

    restaurer(day, ligne) {
      // Lot R9 : un niveau gardé sans l'empreinte de son auteur (écrit avant le lot) est recalculé tant que son jour accepte des essais ; un jour fermé ne sert plus à rien.
      const authorHash = (ligne.author_hash as string | null) ?? null;
      if (authorHash === null && !(day < today() - 1)) throw new Error("niveau gardé sans l'empreinte de son auteur");
      const levelId = String(ligne.level_id);
      const info: JumpDayInfo = {
        date: formatDay(day),
        number: levelNumber(day),
        id: levelId,
        hash: String(ligne.hash),
        authorTicks: n(ligne.author_ticks),
        medals: JSON.parse(String(ligne.medals)) as JumpMedals,
        theme: String(ligne.theme),
        source: ligne.source === "fige" ? "fige" : "genere",
        simVersion: JUMP_SIM_VERSION,
        generatorVersion: Number(/-g(\d+)$/.exec(levelId)?.[1] ?? JUMP_GENERATOR_VERSION),
      };
      return { info, ascii: String(ligne.ascii), authorHash, level: null };
    },

    champsJournalJour: (niveau) => ({ id: niveau.info.id, source: niveau.info.source }),
    infoJour: (niveau) => niveau.info,
    portailJour: (niveau) => {
      const l = niveau.info;
      return { numero: l.number, theme: l.theme, seuils: { author: msOfTicks(l.medals.author), gold: msOfTicks(l.medals.gold), silver: msOfTicks(l.medals.silver), bronze: msOfTicks(l.medals.bronze) } };
    },
    empreinteAuteur: (niveau) => niveau.authorHash,

    /**
     * La validation d'un envoi, dans l'ordre de Jump : le niveau du jour seulement ; les versions annoncées ; la rediffusion (lot R6 : un onglet resté ouvert pendant une mise en production envoie les versions
     * de SON code — pour un jour conservé, celles du niveau suffisent) ; le niveau que le serveur joue ; un essai qui part du départ ; le joueur (bon marché) ; le plafond de rejeux, proportionnel à la durée ;
     * le rejeu, la seule source du temps et des morts.
     */
    async valider(body, ctx) {
      const levelId = body.levelId;
      const day = jourDuNiveau(levelId, ctx.ouvert);
      if (typeof body.simVersion !== "number" || typeof body.generatorVersion !== "number") throw versionRefus(`simulation v${String(body.simVersion)}, générateur v${String(body.generatorVersion)}`);
      if (body.simVersion > JUMP_SIM_VERSION) throw versionRefus(`simulation v${String(body.simVersion)}, serveur v${JUMP_SIM_VERSION}`);
      if (typeof body.replay !== "string" || body.replay.length === 0) throw new RefusJeu("invalid_replay", "Rediffusion manquante");
      let replay: JumpReplay;
      try {
        replay = decodeReplay(body.replay);
      } catch (e) {
        throw new RefusJeu("invalid_replay", e instanceof JumpReplayError ? e.message : "Rediffusion illisible");
      }
      if (replay.simVersion > JUMP_SIM_VERSION) throw versionRefus(`rediffusion v${replay.simVersion}, serveur v${JUMP_SIM_VERSION}`);
      const niveau = await ctx.niveau(day);
      const level = jouable(niveau);
      const info = niveau.info;
      if (body.simVersion !== JUMP_SIM_VERSION && body.simVersion !== level.simVersion) throw versionRefus(`simulation v${body.simVersion}, serveur v${JUMP_SIM_VERSION}, niveau en v${level.simVersion}`);
      if (body.generatorVersion !== JUMP_GENERATOR_VERSION && body.generatorVersion !== info.generatorVersion) throw versionRefus(`générateur v${body.generatorVersion}, serveur v${JUMP_GENERATOR_VERSION}, niveau en g${info.generatorVersion}`);
      // Lot 15 : une rediffusion porte la version de son niveau (3 pour un jour figé en v3, 4 ensuite).
      if (replay.simVersion !== level.simVersion) throw versionRefus(`rediffusion v${replay.simVersion}, niveau en v${level.simVersion}`);
      if (levelId !== info.id) throw versionRefus(`niveau ${String(levelId)}, le serveur joue ${info.id}`);
      if (replay.levelId !== info.id) throw new RefusJeu("invalid_replay", "Cette rediffusion n'est pas celle de ce niveau");
      // Un essai part du départ, à l'arrêt, chrono à zéro : une « vie » qui repartirait d'un point de passage avec un chrono choisi n'est pas un essai.
      if (replay.start.checkpoint !== -1 || replay.start.time !== 0 || replay.start.elan !== 0 || replay.start.sections.length !== 0) throw new RefusJeu("invalid_replay", "Un essai part du départ du niveau");
      // Lot D2 (C5) : un renvoi déjà accepté (même joueur, même jour, même rediffusion) répond ici, **après** les contrôles de version et de forme (une autre version reste refusée) et **avant** le plafond de rejeux et le rejeu.
      const deja = await ctx.dejaAccepte(day, body.replay);
      if (deja) return { jour: day, niveau, rejeu: replay, mesure: { ticks: n(deja.ticks), deaths: n(deja.deaths) }, empreinte: "", empreinteAuteur: null, deja };
      await ctx.avantRejeu();
      platform.spendReplays(replayUnits(replay.runs)); // lots R5 et R7 : plafond global de rejeux de l'instance, proportionnel à la durée (503 au-delà)
      let r;
      try {
        r = replayAttempt(level, replay, info.id);
      } catch (e) {
        throw new RefusJeu("invalid_replay", e instanceof JumpReplayError ? e.message : "Rediffusion illisible");
      }
      if (!r.finished) throw new RefusJeu("not_finished", "Cet essai n'arrive pas au bout du niveau");
      return { jour: day, niveau, rejeu: replay, mesure: { ticks: r.time, deaths: r.deaths.length }, empreinte: await inputsHash(jumpInputs(replay.runs)), empreinteAuteur: niveau.authorHash };
    },
    corpsDeRegistre: (niveau, code) => ({ levelId: niveau.info.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code }),

    mesureDeLigne: (l) => ({ ticks: n(l.ticks), deaths: n(l.deaths) }),
    rejouee: (niveau, _r, m) => ({
      score: { ticks: m.ticks },
      autres: { level_id: niveau.info.id, deaths: m.deaths, sim_version: JUMP_SIM_VERSION, generator_version: JUMP_GENERATOR_VERSION },
    }),
    medaille: (niveau, score) => jumpMedalFor(score.ticks!, niveau.info.medals),
    medailleDeLigne: (niveau, b) => jumpMedalFor(n(b.ticks), niveau.info.medals),
    champsJournalPartie: (m, improved) => ({ ticks: m.ticks, deaths: m.deaths, improved }),
    validation: (m) => ({ ms: msOfTicks(m.ticks), ticks: m.ticks, deaths: m.deaths }),

    /** Le classement : top 10 (rang, pseudo, temps en pas, morts, médaille), ta ligne ; un jour sans classé ne lit pas le niveau. Même mise en forme pour la réponse d'un envoi. */
    async tableau(c) {
      const base = { date: c.date, open: c.ouvert, participants: c.participants };
      if (!c.apresEnvoi && c.participants === 0) return { ...base, levelId: null, top: [], me: null };
      const niveau = await c.niveau();
      // Lot F2 : `ref` = la référence publique du joueur (`players.ref`, jamais l'identifiant secret), pour l'ajouter en ami depuis le classement.
      const ligne = (rank: number, b: LigneBrute): JumpBoardRow => ({
        rank,
        name: String(b.name),
        ticks: n(b.ticks),
        deaths: n(b.deaths),
        medal: jumpMedalFor(n(b.ticks), niveau.info.medals),
        ...(b.ref ? { ref: String(b.ref) } : {}),
      });
      const top = c.top.map((r, i) => ligne(i + 1, r));
      const me = c.moi ? ligne(await c.rangMoi(), c.moi) : null;
      return { ...base, levelId: niveau.info.id, top, me };
    },
    reponseEnvoi: (c): JumpSubmitResult => {
      const m = c.mesure as MesureJump;
      return {
        accepted: true,
        date: c.date,
        levelId: c.niveau.info.id,
        ticks: m.ticks,
        deaths: m.deaths,
        improved: c.improved,
        bestTicks: n(c.meilleur.ticks),
        bestDeaths: n(c.meilleur.deaths),
        medal: (c.meilleur.medal as JumpMedal | null) ?? null,
        rank: c.rang,
        participants: c.participants,
        board: c.board as JumpBoard,
      };
    },
    versPortail: (b) => ({ tempsMs: msOfTicks(n(b.ticks)), ticks: n(b.ticks) }),
    // Pas d'essai classé : des morts envoyées ce jour-là (les vies du jour, oubliées à la fin du jour) disent que le joueur a commencé.
    async etatSansEssai(id, day) {
      const vies = await platform.db.first<{ count: number }>("SELECT count FROM jump_lives WHERE day = ? AND player_id = ?", [day, id]);
      return vies && vies.count > 0 ? { statut: "en_cours", morts: vies.count } : { statut: "pas_joue" };
    },
  };
  return contrat;
}

/** La fiche de Jump (`config/jeux/jump.json`), telle que le serveur la lit. */
const FICHE_JUMP = FICHES_SERVEUR.find((f) => f.code === "jump")!;

export function createJump(platform: Platform, options: JumpOptions): GameInstance {
  const { db, now, today, hashKey, readHit, players } = platform;
  const contrat = contratJump(platform, options) as ReturnType<typeof contratJump> & { jourDuNiveau: (levelId: unknown, ouvert: (jour: number) => boolean) => number; jouable: (n: NiveauJump) => Level };
  /** Les outils du module (le niveau d'un jour, le classement, la place…), reçus à la création. */
  let o!: OutilsModule<NiveauJump>;
  /** Lot P3 : les vies de tout le monde (envoi, carte des morts, échantillon du carnage, oubli à la fin du jour). */
  let lives!: ReturnType<typeof createJumpLives>;

  /** Le niveau jouable d'un jour pour les vies (le même que pour le classement) ; son refus est celui du contrat. */
  async function playable(day: number): Promise<{ info: JumpDayInfo; level: Level; authorHash: string | null }> {
    const niveau = await o.niveau(day);
    return { info: niveau.info, level: contrat.jouable(niveau), authorHash: niveau.authorHash };
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
      if (!o.ouvert(day) && first) {
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
  async function bundle(day: number, req: Request, info: RequestInfo): Promise<WithHeaders> {
    const me = o.joueurEntete(req, false);
    const open = o.ouvert(day);
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
      o.classement(day, me) as Promise<JumpBoard>,
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

  /** Les routes que seul Jump a : les vies (lot P3) et les lectures du jour qui ne sont pas celles du module (fantôme du premier, carte des morts, carnage, lecture regroupée). */
  const routesPropres = [
    async (path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> => {
      if (path === "/api/jump/lives") {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return await lives.receive(req, info);
      }
      const m = /^\/api\/jump\/day\/([^/]+)(\/ghost\/first|\/deaths|\/carnage|\/bundle)$/.exec(path);
      if (!m) return undefined;
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await o.limiterLectures(info);
      let date: string;
      try {
        date = decodeURIComponent(m[1]!);
      } catch {
        throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
      }
      const day = o.dayOf(date);
      // Lot P4 : chaque lecture porte son cache (`cache.ts`) ; celles qui dépendent de `X-Player-Id` ne sont jamais partagées.
      const open = o.ouvert(day);
      if (m[2] === "/ghost/first") return new WithHeaders(await firstGhost(day, o.joueurEntete(req, false)), cacheHeaders({ open, perPlayer: true }));
      if (m[2] === "/deaths") return new WithHeaders(await lives.deathMap(date), cacheHeaders({ open, perPlayer: false }));
      if (m[2] === "/carnage") return new WithHeaders(await lives.carnage(date), cacheHeaders({ open, perPlayer: false }));
      return await bundle(day, req, info);
    },
  ];

  return creerJeu(platform, {
    fiche: FICHE_JUMP,
    contrat,
    adaptateur: ADAPTATEUR_JUMP,
    nom: "Jump",
    prefixe: "/api/jump",
    graceMs: JUMP_GRACE_MS,
    top: JUMP_BOARD_TOP,
    lecturesParAdresse: JUMP_READS_PER_CLIENT,
    lecturesProfilParJoueur: JUMP_ME_PER_PLAYER,
    debit: { adresse: "jip", joueur: "jp", lectures: "jrd", profilAdresse: "jmeip", profilJoueur: "jme" },
    memoClasses: JUMP_CLASSES_MEMO_MS,
    // Le lecteur existant (`?watch=first`, lot P2) ne montre que l'essai du premier du jour.
    lienRediffusion: (date, rang) => (rang === 1 ? `/jump/?watch=first&seed=${date}` : null),
    // Lot P3 : la première requête qui voit un jour terminé fige sa carte et son échantillon et oublie ses vies brutes (une comparaison d'entiers ensuite, par instance).
    avantRoute: async (path) => {
      if (path.startsWith("/api/jump/")) await lives.forget();
    },
    recevoirOutils: (outils) => {
      o = outils;
      lives = createJumpLives({
        platform,
        playable,
        dailyDayOf: (levelId) => contrat.jourDuNiveau(levelId, o.ouvert),
        dayOf: o.dayOf,
        isOpen: o.ouvert,
        lastClosed: () => (o.ouvert(today() - 1) ? today() - 2 : today() - 1),
        headerPlayer: o.joueurEntete,
        versionError: (detail) => new HttpError(409, "version", `Une nouvelle version du jeu est disponible : recharge la page (${detail})`),
      });
    },
    // Lot P2 : un profil par jeu, sous son préfixe (`/api/me` de DailyTrack ne change pas).
    profil: myProfile,
    routesPropres,
    surcharges: {
      // Lot P2 / I2 : le profil commun lit la place gardée d'un jour fermé (`final_rank`) ; lot N1 : les actions de l'administration oublient les places gardées des jours concernés.
      portail: (base) => ({ ...base, profil: profilPortail }),
      admin: (base) => ({
        ...base,
        compteurs: async (day) => {
          const [finis, vies] = await Promise.all([base.compteurs(day), db.first<{ n: number }>("SELECT COALESCE(SUM(count), 0) AS n FROM jump_lives WHERE day = ?", [day])]);
          let morts = vies?.n ?? 0;
          if (morts === 0) morts = (await db.first<{ n: number }>("SELECT deaths AS n FROM jump_deaths WHERE day = ?", [day]))?.n ?? 0; // un jour fini : les vies brutes sont oubliées, il reste le total figé
          return { ...finis, morts };
        },
        resultats: resultatsAdmin,
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
        masquer: (id, masque) => [
          { sql: "UPDATE jump_results SET final_rank = NULL, final_total = NULL WHERE day IN (SELECT day FROM jump_results WHERE player_id = ?)", params: [id] },
          { sql: "UPDATE jump_results SET hidden = ? WHERE player_id = ?", params: [masque ? 1 : 0, id] },
        ],
      }),
      // « Changer mon code » : les essais classés suivent le joueur (les premiers gardés en mémoire sont oubliés : leur identifiant a changé), ses vies aussi.
      rotation: (ancien, nouveau, base) => {
        firstOfClosed.clear();
        return [...base, ...lives.rotateStatements(ancien, nouveau)];
      },
      // Lot R5 — effacement d'un joueur : ses essais classés (un premier effacé n'est plus servi : le suivant devient le premier) et ses vies du jour en cours.
      effacement: async (playerId, base) => {
        const l = await lives.erase(playerId);
        return {
          counts: { ...base.counts, ...l.counts },
          statements: [
            // Lot I2 : les places finales des jours concernés sont recalculées sans lui (à la prochaine lecture du profil commun des autres).
            { sql: "UPDATE jump_results SET final_rank = NULL, final_total = NULL WHERE day IN (SELECT day FROM jump_results WHERE player_id = ?)", params: [playerId] },
            ...base.statements,
            ...l.statements,
          ],
        };
      },
      // Un pseudo changé : le premier d'un jour passé gardé en mémoire le reprend à la prochaine lecture.
      apresRenommage: () => firstOfClosed.clear(),
      apresEffacement: () => {
        firstOfClosed.clear();
        lives.onErased();
      },
    },
  });

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
    const closedBefore = o.ouvert(today() - 1) ? today() - 1 : today();
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
      const rang = r.final_rank ?? (await o.rang(r.day, { ticks: r.ticks }, r.submitted_at, id));
      const classes = r.final_total ?? (await o.classes(r.day));
      if (!meilleurRang || rang < meilleurRang.rang || (rang === meilleurRang.rang && classes > meilleurRang.classes)) meilleurRang = { date: formatDay(r.day), rang, classes };
    }
    return { joursFinis: rows.length, medailles, meilleurRang };
  }

  async function resultatsAdmin(id: string, limite: number) {
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
      const rang = r.final_rank ?? (await o.rang(r.day, { ticks: r.ticks }, r.submitted_at, id)); // un jour fermé a sa place gardée
      const classes = r.final_total ?? (await o.classes(r.day));
      liste.push({ day: r.day, tempsMs: msOfTicks(r.ticks), morts: r.deaths, medaille, rang, classes: Math.max(classes + r.hidden, rang), envoyeA: r.submitted_at });
    }
    return { jours: jours?.n ?? 0, liste };
  }
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
