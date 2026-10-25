import { ProfileClient, TIMEOUT_MS, apiFromAddress, call, type ApiResult, type FetchLike, type ProfileApi } from "@cdj/profile";
import type { JumpMedal } from "@cdj/jump-sim";
import { fNombre, fRang, t } from "./i18n";
import type { DayBundle } from "./dayReads";
import type { FirstGhostData } from "./firstGhost";
import type { JumpMe } from "./jumpProfile";
import type { LifeVerdict } from "./livesQueue";

// Le classement du jour de DailyJump vu du jeu (lot P1 de la plateforme) : ce qu'on envoie et ce que le serveur rend, et le client HTTP
// (`POST /api/jump/submit`, `GET /api/jump/day/<date>/board`) bâti sur celui du profil commun (`@cdj/profile` : délai de 8 s, erreurs
// traduites, corps vide = panne réseau ; **un échec est une valeur, jamais une exception** : le jeu ne bloque jamais sur le réseau).
// L'identifiant secret voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse. Le mode démo (`demoRank.ts`) a la même interface.

/** Un essai à envoyer : le niveau du jour, sa rediffusion, et ce que **le jeu** a recalculé (pour la file ; le serveur, lui, rejoue). */
export interface RankEntry {
  /** AAAA-MM-JJ (date de Paris du niveau du jour). */
  date: string;
  levelId: string;
  /** Rediffusion de l'essai (base64url). */
  replay: string;
  /** Temps (pas) et morts du rejeu du jeu : servent à ne garder que le meilleur en attente ; le serveur ne les reçoit pas. */
  ticks: number;
  deaths: number;
}

export interface JumpBoardRow {
  rank: number;
  name: string;
  ticks: number;
  deaths: number;
  medal: JumpMedal | null;
}

/** `GET /api/jump/day/<date>/board`. */
export interface JumpBoard {
  date: string;
  /** Le jour accepte-t-il encore des envois (aujourd'hui, ou hier pendant la grâce) ? Sinon : figé. */
  open: boolean;
  participants: number;
  levelId: string | null;
  top: JumpBoardRow[];
  /** Ta ligne (identifiant fourni et classé), sinon `null`. */
  me: JumpBoardRow | null;
}

/** `POST /api/jump/submit` : le temps et les morts **du rejeu du serveur**, le meilleur essai gardé, sa médaille, son rang. */
export interface JumpSubmitResult {
  accepted: true;
  date: string;
  levelId: string;
  ticks: number;
  deaths: number;
  improved: boolean;
  bestTicks: number;
  bestDeaths: number;
  medal: JumpMedal | null;
  rank: number;
  participants: number;
  /** Lot P4 : le classement juste après l'envoi (top 10 et ta ligne) ; absent d'un serveur plus ancien (le jeu relit alors `/board`). */
  board?: JumpBoard;
}

/** Lot P3 : un lot de vies (rediffusions de vies qui finissent par une mort) ; jamais une position ni une cause : le serveur rejoue. */
export interface LivesLot {
  levelId: string;
  simVersion: number;
  generatorVersion: number;
  lives: string[];
}

/** `POST /api/jump/lives` : le sort de chaque vie, le nombre gardé aujourd'hui et le plafond (30). */
export interface LivesResult {
  accepted: number;
  received: number;
  duplicates: number;
  invalid: number;
  notDeath: number;
  overCap: number;
  dayCount: number;
  cap: number;
  results: LifeVerdict[];
  message: string;
}

/** `GET /api/jump/day/<date>/deaths` : la carte des morts du jour (`tiles` : `[col, row, morts, cause dominante]`). */
export interface DeathMapData {
  date: string;
  levelId: string | null;
  open: boolean;
  players: number;
  deaths: number;
  tiles: [number, number, number, number][];
}

/** `GET /api/jump/day/<date>/carnage` : l'échantillon du carnage de tout le monde (≈ 150 vies d'autres joueurs, sans identifiant). */
export interface CarnageSampleData {
  date: string;
  levelId: string | null;
  open: boolean;
  simVersion: number;
  generatorVersion: number;
  players: number;
  dayPlayers: number;
  lives: { replay: string; section: number; p: number }[];
}

/** Ce que le jeu demande à un classement : le serveur (`HttpRankSource`) ou le jeu de données statique de la démo (`DemoRankSource`). */
export interface RankSource extends ProfileApi {
  submit(playerId: string, name: string | null, entry: RankEntry, versions: { simVersion: number; generatorVersion: number }): Promise<ApiResult<JumpSubmitResult>>;
  board(date: string, playerId: string | null): Promise<ApiResult<JumpBoard>>;
  /** Lot P2 : le fantôme du premier d'un jour (`mine` si l'identifiant fourni est le sien). 404 `no_ghost` : personne n'est classé. */
  firstGhost?(date: string, playerId: string | null): Promise<ApiResult<FirstGhostData>>;
  /** Lot P2 : le profil DailyJump du joueur (`GET /api/jump/me`) ; la démonstration n'en a pas. */
  jumpMe?(playerId: string): Promise<ApiResult<JumpMe>>;
  /** Lot P3 : un lot de vies du jour (`keepalive` : la page se cache, l'envoi doit survivre à sa fermeture). La démonstration n'envoie rien. */
  sendLives?(playerId: string, lot: LivesLot, options?: { keepalive?: boolean }): Promise<ApiResult<LivesResult>>;
  /** Lot P3 : la carte des morts d'un jour (figée pour une archive). */
  deaths?(date: string): Promise<ApiResult<DeathMapData>>;
  /** Lot P3 : l'échantillon du carnage de tout le monde d'un jour (figé pour une archive). */
  carnage?(date: string): Promise<ApiResult<CarnageSampleData>>;
  /**
   * Lot P4 : la lecture regroupée d'un jour (classement, fantôme du premier, carte des morts ; le profil du jour en cours avec un identifiant)
   * en une requête. `fresh` : le navigateur revalide au lieu de servir sa copie (une lecture voulue malgré le cache court du jour en cours).
   */
  bundle?(date: string, playerId: string | null, options?: { fresh?: boolean }): Promise<ApiResult<DayBundle>>;
}

/** Le serveur de la plateforme. */
export class HttpRankSource extends ProfileClient implements RankSource {
  constructor(base: string, fetchImpl?: FetchLike) {
    super(base, fetchImpl);
  }

  submit(playerId: string, name: string | null, entry: RankEntry, versions: { simVersion: number; generatorVersion: number }) {
    // Ni le temps ni les morts du jeu ne partent : le serveur rejoue la rediffusion et garde les siens.
    const body = { levelId: entry.levelId, simVersion: versions.simVersion, generatorVersion: versions.generatorVersion, replay: entry.replay, ...(name ? { name } : {}) };
    return this.call<JumpSubmitResult>("POST", "/api/jump/submit", body, { "X-Player-Id": playerId });
  }

  board(date: string, playerId: string | null) {
    return this.call<JumpBoard>("GET", `/api/jump/day/${encodeURIComponent(date)}/board`, undefined, playerId ? { "X-Player-Id": playerId } : undefined);
  }

  firstGhost(date: string, playerId: string | null) {
    return this.call<FirstGhostData>("GET", `/api/jump/day/${encodeURIComponent(date)}/ghost/first`, undefined, playerId ? { "X-Player-Id": playerId } : undefined);
  }

  jumpMe(playerId: string) {
    return this.call<JumpMe>("GET", "/api/jump/me", undefined, { "X-Player-Id": playerId });
  }

  sendLives(playerId: string, lot: LivesLot, options: { keepalive?: boolean } = {}) {
    if (!options.keepalive) return this.call<LivesResult>("POST", "/api/jump/lives", lot, { "X-Player-Id": playerId });
    // La page se cache : `keepalive` laisse partir la requête même si la page se ferme (corps < 64 ko : 30 vies font ≈ 3 ko).
    const base = this.fetchImpl ?? ((u: string, i: RequestInit) => fetch(u, i));
    return call<LivesResult>(this.base, "POST", "/api/jump/lives", lot, TIMEOUT_MS, { "X-Player-Id": playerId }, (u, init) => base(u, { ...init, keepalive: true }));
  }

  deaths(date: string) {
    return this.call<DeathMapData>("GET", `/api/jump/day/${encodeURIComponent(date)}/deaths`);
  }

  carnage(date: string) {
    return this.call<CarnageSampleData>("GET", `/api/jump/day/${encodeURIComponent(date)}/carnage`);
  }

  bundle(date: string, playerId: string | null, options: { fresh?: boolean } = {}) {
    // Une seule adresse par jour pour toutes les lectures personnelles : un seul pré-vol CORS (OPTIONS) par 2 heures dans le navigateur.
    const path = `/api/jump/day/${encodeURIComponent(date)}/bundle`;
    const headers = playerId ? { "X-Player-Id": playerId } : undefined;
    if (!options.fresh) return this.call<DayBundle>("GET", path, undefined, headers);
    // Lecture voulue malgré le cache court du jour (`Cache-Control: private, max-age=30`) : le navigateur revalide.
    const base = this.fetchImpl ?? ((u: string, i: RequestInit) => fetch(u, i));
    return call<DayBundle>(this.base, "GET", path, undefined, TIMEOUT_MS, headers, (u, init) => base(u, { ...init, cache: "no-cache" }));
  }
}

/**
 * Adresse de l'API : `?api=https://…` (essais), `?api=demo` (démonstration), sinon `VITE_API_URL` (fixée à la construction : `/`, la même
 * origine, sur la production, la recette et les aperçus depuis le lot R4 ; l'adresse directe d'une révision de recette pour l'aperçu d'une PR
 * qui touche le serveur), sinon rien : pas de classement, le jeu marche comme avant.
 */
export function rankApiBase(fromUrl: string | null, env: string | undefined, origin?: string, restricted = false): string | null {
  // Lot R7 : sur la production (`VITE_PRODUCTION=1`), `?api=` ne peut viser qu'elle-même : un lien piégé n'obtient jamais l'identifiant secret.
  const base = apiFromAddress(fromUrl, restricted, origin) || env || "";
  // Lot R4 (plateforme) : `/` = le serveur de la même origine (Firebase Hosting renvoie `/api/**` vers Cloud Run) : aucune requête CORS.
  if (base === SAME_ORIGIN_API) return origin ? origin.replace(/\/+$/, "") : null;
  return base ? base.replace(/\/+$/, "") : null;
}

/** Lot R4 : la valeur de `VITE_API_URL` (ou de `?api=`) qui veut dire « le serveur de la même origine » (`/api/…` sur l'adresse de la page). */
export const SAME_ORIGIN_API = "/";

/** « 1er », « 3e » / « 1st », « 3rd » (lot I5 : le format du socle, dans la langue du joueur). */
export function ordinal(rank: number): string {
  return fRang(rank);
}

/** « 3e sur 128 » / « 3rd of 128 » (écran d'arrivée, accueil). */
export function rankText(rank: number, participants: number): string {
  return t("rang.sur", { rang: fRang(rank), total: fNombre(participants) });
}
