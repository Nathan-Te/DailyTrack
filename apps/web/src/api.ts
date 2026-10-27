import { ProfileClient, apiFromAddress, call, type ApiResult, type MeProfile, type NameCheck } from "@cdj/profile";
import type { EtatVoiture, ProgresGarage } from "@cdj/sim";
import { isRestricted } from "./access";
import type { ChoixVoiture } from "./voiture/choix";

// Client de l'API du classement. Le jeu fonctionne sans elle : si elle n'est pas configurée ou injoignable,
// on le dit poliment et on continue (le classement est un plus, pas un prérequis).
// Lot P0 (plateforme) : le résultat d'un appel (`ApiResult`, `call`), le profil (`GET /api/me`), le pseudo et le code viennent du module de
// profil commun (`@cdj/profile`) ; ce fichier n'ajoute que ce qui est propre à DailyTrack (envoi d'un temps, classement, fantômes).
export type { ApiResult, MeProfile, NameCheck } from "@cdj/profile";

export interface BoardRow {
  rank: number;
  name: string;
  ms: number;
  medal: "author" | "gold" | "silver" | "bronze" | null;
}

export interface Leaderboard {
  date: string;
  participants: number;
  top: BoardRow[];
  me: BoardRow | null;
}

export interface SubmitResult {
  accepted: true;
  improved: boolean;
  ms: number;
  splits: number[];
  respawns: number;
  bestMs: number;
  rank: number;
  participants: number;
  medal: BoardRow["medal"];
  /** Lot 41 : le Garage après cet envoi (absent d'un serveur plus ancien) ; `nouvelles` = les voitures que cette course débloque. */
  garage?: GarageStatut & { nouvelles: string[] };
}

/** Lot 51 : le choix de voiture gardé par le serveur (voiture, couleur, motif, teinte) et la minute où il a été fait. */
export interface ChoixServeur {
  voiture: ChoixVoiture;
  minute: number;
}

/** Lot 51 : `PUT /api/garage` — `enregistre` faux : refusé (voiture verrouillée, ou un choix plus récent est gardé) ; `voiture` et `minute` : ce que le serveur garde. */
export interface ReponseChoix {
  enregistre: boolean;
  voiture: ChoixVoiture | null;
  minute: number | null;
}

/** Lot 51 : le profil (`GET /api/me`) tel que DailyTrack le lit — le record porte la voiture de sa course, et le choix de voiture du serveur arrive avec lui. */
export type MeTrack = MeProfile & { best: (NonNullable<MeProfile["best"]> & { voiture?: unknown }) | null; garage?: { voiture?: unknown; minute?: unknown } | null };

/** Lot 41 : `GET /api/garage` — la progression du joueur et l'état de chaque voiture, calculés par le serveur. */
export interface GarageStatut {
  progres: ProgresGarage;
  voitures: EtatVoiture[];
  /** Lot 51 : le choix de voiture gardé par le serveur (`null` : jamais enregistré ; absent d'un serveur plus ancien). */
  choix?: { voiture?: unknown; minute?: unknown } | null;
}

export interface GhostData {
  name: string;
  rank: number;
  ms: number;
  splits: number[];
  replay: string;
  simVersion: number;
  /** Lot 51 : la voiture de cette course (absente d'un serveur plus ancien et de la démonstration : la Sparrow en orange). Illisible : à passer par `lireChoix`. */
  voiture?: unknown;
}

/**
 * Lot R4 (plateforme) : `VITE_API_URL=/` (ou `?api=/`) = le serveur **de la même origine** : le jeu appelle `/api/…` sur l'adresse où il est
 * servi (`playdujour.com`, `recette.playdujour.com`, un canal d'aperçu : Firebase Hosting renvoie `/api/**` vers Cloud Run). Aucune requête
 * CORS, donc aucun pré-vol.
 */
export const SAME_ORIGIN_API = "/";

/**
 * Adresse de l'API : `?api=https://…` (essais), sinon `VITE_API_URL` (fixée à la construction du jeu), sinon
 * rien : le classement est alors désactivé. `/` : l'origine de la page (`origin`).
 */
export function apiBase(
  search = location.search,
  env = import.meta.env.VITE_API_URL as string | undefined,
  origin?: string,
  restricted = isRestricted(search),
): string | null {
  // Lot R7 : sur la production, `?api=` ne peut viser qu'elle-même (voir `apiFromAddress`) : un lien piégé n'obtient jamais l'identifiant secret.
  const fromUrl = apiFromAddress(new URLSearchParams(search).get("api"), restricted, origin ?? safeOrigin());
  const base = fromUrl || env || "";
  if (base === SAME_ORIGIN_API) return (origin ?? location.origin).replace(/\/+$/, "");
  return base ? base.replace(/\/+$/, "") : null;
}

const safeOrigin = (): string | undefined => (typeof location === "undefined" ? undefined : location.origin);

/**
 * Lot R7 : l'adresse de l'API des outils d'administration (`/admin/` : planning, médailles), qui envoient le **jeton d'admin**. Même règle que
 * `apiBase` : sur la production, ni `?api=` ni l'adresse mémorisée (`cdj:admin`) ne peuvent mener le jeton vers un autre serveur.
 */
export function adminApiBase(stored: string, search = location.search): string {
  const restricted = isRestricted(search);
  const origin = safeOrigin();
  const pick = (v: string | null) => {
    const ok = apiFromAddress(v, restricted, origin);
    return ok === SAME_ORIGIN_API ? (origin ?? "") : ok;
  };
  return (pick(new URLSearchParams(search).get("api")) || pick(stored) || apiBase(search) || "").replace(/\/+$/, "");
}

/** Lot 32 : l'en-tête qui désigne le joueur (une seule définition pour le classement, les fantômes et le Salon). */
export const asPlayer = (playerId: string): Record<string, string> => ({ "X-Player-Id": playerId });

/** Appel brut à l'API (planning, admin) : même gestion des erreurs et du délai que les routes du classement. */
export const apiCall = call;

/** Ce que le jeu demande à un classement : l'API réelle (`LeaderboardApi`) ou le jeu de données statique du mode démo. */
export interface LeaderboardSource {
  submit(playerId: string, name: string | null, date: string, replay: string, voiture?: ChoixVoiture): Promise<ApiResult<SubmitResult>>;
  rename(playerId: string, name: string): Promise<ApiResult<{ name: string }>>;
  leaderboard(date: string, playerId: string, limit?: number): Promise<ApiResult<Leaderboard>>;
  ghost(date: string, kind: "first" | "ahead", playerId: string): Promise<ApiResult<GhostData>>;
  /** Profil du joueur (lot 30). L'identifiant secret voyage dans un en-tête, jamais dans l'adresse. */
  me(playerId: string): Promise<ApiResult<MeProfile>>;
  /** Le pseudo est-il libre (ou déjà à ce joueur) ? */
  checkName(name: string, playerId: string): Promise<ApiResult<NameCheck>>;
  /** « Changer mon code » : le profil passe à `newId`, `oldId` est révoqué. */
  rotateCode(oldId: string, newId: string): Promise<ApiResult<{ rotated: true }>>;
  /** Lot 41 : les déblocages du Garage (calculés par le serveur ; l'identifiant dans l'en-tête). La démonstration n'en a pas : son joueur est dans le Garage. */
  garage?(playerId: string): Promise<ApiResult<GarageStatut>>;
  /** Lot 51 : enregistre le choix de voiture (gardé par le serveur pour tous les appareils de ce profil). */
  choisirVoiture?(playerId: string, voiture: ChoixVoiture, minute: number): Promise<ApiResult<ReponseChoix>>;
}

/** `?api=demo` : le jeu lit le jeu de données statique de `public/demo/` au lieu d'une API (voir `demo.ts`). */
export const DEMO_BASE = "demo";

/** L'API réelle : classement et fantômes de DailyTrack ; profil, pseudo et code viennent du client de la plateforme (`ProfileClient`). */
export class LeaderboardApi extends ProfileClient implements LeaderboardSource {
  // Lot 32 : l'identifiant secret du joueur voyage dans l'en-tête `X-Player-Id`, jamais dans l'adresse (qui finit dans les journaux de l'hébergeur).
  submit(playerId: string, name: string | null, date: string, replay: string, voiture?: ChoixVoiture) {
    return this.call<SubmitResult>("POST", "/api/submit", { ...(name ? { name } : {}), date, replay, ...(voiture ? { voiture } : {}) }, asPlayer(playerId));
  }

  leaderboard(date: string, playerId: string, limit = 10) {
    return this.call<Leaderboard>("GET", `/api/day/${date}/leaderboard?limit=${limit}`, undefined, asPlayer(playerId));
  }

  ghost(date: string, kind: "first" | "ahead", playerId: string) {
    return this.call<GhostData>("GET", `/api/day/${date}/ghost?kind=${kind}`, undefined, asPlayer(playerId));
  }

  garage(playerId: string) {
    return this.call<GarageStatut>("GET", "/api/garage", undefined, asPlayer(playerId));
  }

  choisirVoiture(playerId: string, voiture: ChoixVoiture, minute: number) {
    return this.call<ReponseChoix>("PUT", "/api/garage", { voiture, minute }, asPlayer(playerId));
  }
}
