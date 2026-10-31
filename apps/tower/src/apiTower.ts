import { apiFromAddress, ProfileClient, type ApiResult, type FetchLike, type ProfileApi } from "@cdj/profile";
import type { NomMedaille } from "@cdj/tower-sim";
import type { FantomePiece } from "./fantomeLocal";

// Le serveur de Tower vu du jeu (lot T4) : ce qu'on envoie et ce que `apps/api/src/tower.ts` rend, et le client HTTP bâti sur celui du profil commun (`@cdj/profile` : délai de 8 s, erreurs
// traduites, corps vide = panne réseau ; **un échec est une valeur, jamais une exception** : le jeu ne bloque jamais sur le réseau). L'identifiant secret voyage dans l'en-tête `X-Player-Id`,
// jamais dans l'adresse. Les médailles de l'API portent les codes communs de la plateforme (`author | gold | silver | bronze`) ; le jeu les lit sous les noms de la simulation (`MEDAILLE_API`).

export type MedailleApi = "author" | "gold" | "silver" | "bronze";

/** Les codes de la plateforme vers les noms de la simulation (la clé `auteur` est le Diamant). */
export const MEDAILLE_API: Readonly<Record<MedailleApi, NomMedaille>> = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" };
/** Et retour. */
export const API_MEDAILLE: Readonly<Record<NomMedaille, MedailleApi>> = { auteur: "author", or: "gold", argent: "silver", bronze: "bronze" };

export const medailleLue = (m: MedailleApi | null | undefined): NomMedaille | null => (m ? (MEDAILLE_API[m] ?? null) : null);

/** Une ligne du classement. */
export interface LigneTower {
  rank: number;
  name: string;
  hauteurMm: number;
  vies: number;
  ticks: number;
  medal: MedailleApi | null;
}

/** `GET /api/tower/day/<date>/board` : les 50 premiers, le nombre de classés, ta ligne (identifiant fourni et classé). */
export interface ClassementTower {
  date: string;
  /** Le jour accepte-t-il encore des envois (aujourd'hui, ou hier pendant la grâce) ? Sinon : figé. */
  open: boolean;
  participants: number;
  top: LigneTower[];
  me: LigneTower | null;
  /** La génération de données (remise à zéro du lancement). */
  generation?: number;
}

/** `POST /api/tower/submit` : le résultat **rejoué par le serveur**, la médaille, le rang. */
export interface EnvoiTower {
  accepted: true;
  date: string;
  resultat: { hauteurMm: number; hauteurMaxMm: number; vies: number; ticks: number; posees: number; tombees: number; motif: "pieces" | "vies" };
  medal: MedailleApi | null;
  /** « Nouveau record » : premier envoi du jour, ou strictement meilleur que le précédent. */
  improved: boolean;
  best: { hauteurMm: number; vies: number; ticks: number; medal: MedailleApi | null };
  rank: number;
  participants: number;
  board: ClassementTower;
}

/** `GET /api/tower/day/<date>/diamant` : la silhouette du Diamant (les pièces de la partie du bot, jamais ses commandes). */
export interface DiamantTower {
  date: string;
  hauteurMm: number;
  pieces: FantomePiece[];
}

export interface JourMoiTower {
  date: string;
  hauteurMm: number;
  vies: number;
  ticks: number;
  medal: MedailleApi | null;
}

/** `GET /api/tower/me` : tes records et ta série Tower. */
export interface MoiTower {
  name: string;
  renameRequired: boolean;
  today: string;
  simVersion: number;
  generatorVersion: number;
  days: JourMoiTower[];
  stats: { days: number; medals: Record<MedailleApi, number>; streak: number };
  generation?: number;
}

/** Ce que le jeu demande au serveur de Tower. */
export interface SourceTower extends ProfileApi {
  submit(playerId: string, name: string | null, replay: string): Promise<ApiResult<EnvoiTower>>;
  board(date: string, playerId: string | null): Promise<ApiResult<ClassementTower>>;
  diamant(date: string, playerId: string): Promise<ApiResult<DiamantTower>>;
  towerMe(playerId: string): Promise<ApiResult<MoiTower>>;
}

/** Le serveur de la plateforme. */
export class HttpTowerSource extends ProfileClient implements SourceTower {
  constructor(base: string, fetchImpl?: FetchLike) {
    super(base, fetchImpl);
  }

  submit(playerId: string, name: string | null, replay: string) {
    // Ni la hauteur ni les vies du jeu ne partent : le serveur rejoue la rediffusion et garde les siennes.
    return this.call<EnvoiTower>("POST", "/api/tower/submit", { replay, ...(name ? { name } : {}) }, { "X-Player-Id": playerId });
  }

  board(date: string, playerId: string | null) {
    return this.call<ClassementTower>("GET", `/api/tower/day/${encodeURIComponent(date)}/board`, undefined, playerId ? { "X-Player-Id": playerId } : undefined);
  }

  diamant(date: string, playerId: string) {
    return this.call<DiamantTower>("GET", `/api/tower/day/${encodeURIComponent(date)}/diamant`, undefined, { "X-Player-Id": playerId });
  }

  towerMe(playerId: string) {
    return this.call<MoiTower>("GET", "/api/tower/me", undefined, { "X-Player-Id": playerId });
  }
}

/** La valeur de `VITE_API_URL` (ou de `?api=`) qui veut dire « le serveur de la même origine » (`/api/…` sur l'adresse de la page). */
export const SAME_ORIGIN_API = "/";

/**
 * L'adresse de l'API : `?api=https://…` (essais), sinon `VITE_API_URL` (fixée à la construction : `/` sur la production, la recette et les aperçus ; l'adresse directe d'une révision de
 * recette pour l'aperçu d'une PR qui touche le serveur), sinon rien : pas de classement, le jeu marche comme avant. Règle R7 : sur la production `?api=` ne vise que `/`, la page elle-même ou la
 * machine locale (`apiFromAddress`) ; l'identifiant secret ne part jamais vers un serveur étranger.
 */
export function baseApi(deLAdresse: string | null, deLaConstruction: string | undefined, origine: string | undefined, restreint: boolean): string | null {
  const base = apiFromAddress(deLAdresse, restreint, origine) || deLaConstruction || "";
  if (base === SAME_ORIGIN_API) return origine ? origine.replace(/\/+$/, "") : null;
  return base && base !== "demo" ? base.replace(/\/+$/, "") : null;
}
