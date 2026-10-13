import { apiCall, type ApiResult } from "./api";

// Contrat de l'API du Salon (lot 26) : ce que le jeu demande, ce que le serveur (lot 27) ou le mode démo (`salonDemo.ts`) répondent.
//
//   GET  /api/salon/now?player=<id>                      → SalonNow          (heure du serveur, session en cours, présents)
//   GET  /api/salon/<session>/board?player=<id>&since=<v> → SalonBoard        (classement de la session ; `unchanged` si la version est la même)
//   GET  /api/salon/<session>/ghosts?refs=a,b,c           → { ghosts: SalonGhost[] }
//   POST /api/salon/<session>/submit  { playerId, name, replay } → SalonSubmitResult
//
// Un joueur n'est jamais désigné par son identifiant secret mais par une **référence publique** (`ref`) propre à la session : les
// fantômes se demandent par référence. Comme pour le classement du jour, le serveur ne fait jamais confiance à un temps annoncé :
// il rejoue la rediffusion sur `salonCircuit(session)` et n'enregistre que son propre résultat.
//
// **Une session finie est oubliée** (lot 27b) : après sa fin et la minute de grâce, `board` et `ghosts` répondent 404 pour elle (courses,
// classement, podium : plus rien). Le podium de fin se calcule sur le classement servi pendant la grâce.

export interface SalonNow {
  /** Heure du serveur (ms depuis 1970, UTC). */
  serverMs: number;
  session: number;
  /** Début et fin de la session en cours (ms UTC) ; `endMs - startMs` = durée d'une session. */
  startMs: number;
  endMs: number;
  /** Identifiant du circuit de la session (`salon-<session>-g<G>`). */
  trackId: string;
  /** Joueurs présents (ayant interrogé le Salon dans la dernière minute ; le serveur n'écrit la présence d'un joueur qu'une fois par 30 s). */
  players: number;
}

export interface SalonRow {
  rank: number;
  /** Référence publique du joueur pour cette session. */
  ref: string;
  name: string;
  ms: number;
  /** Écart au premier (ms ; 0 pour le premier). */
  gap: number;
  /** Vrai pour la ligne du joueur qui interroge. */
  mine?: boolean;
}

export interface SalonBoard {
  session: number;
  /** Change à chaque modification du classement : `board(…, since)` ne renvoie alors que `unchanged`. */
  version: number;
  /** Joueurs classés (ayant au moins un temps validé). */
  participants: number;
  players: number;
  rows: SalonRow[];
  me: SalonRow | null;
  unchanged?: boolean;
}

export interface SalonGhost {
  ref: string;
  name: string;
  rank: number;
  ms: number;
  splits: number[];
  replay: string;
  simVersion: number;
}

export interface SalonSubmitResult {
  accepted: true;
  improved: boolean;
  /** Temps recalculé par le serveur. */
  ms: number;
  bestMs: number;
  rank: number;
  participants: number;
  board: SalonBoard;
}

export interface SalonApi {
  /** `playerId` nul : un spectateur (lot 27b) — il ne compte pas dans la présence du Salon (aucun identifiant n'est envoyé). */
  now(playerId: string | null): Promise<ApiResult<SalonNow>>;
  board(session: number, playerId: string | null, since?: number): Promise<ApiResult<SalonBoard>>;
  ghosts(session: number, refs: string[]): Promise<ApiResult<{ ghosts: SalonGhost[] }>>;
  submit(session: number, playerId: string, name: string, replay: string): Promise<ApiResult<SalonSubmitResult>>;
}

/** Client de l'API réelle (serveur du lot 27). Sans serveur qui répond, chaque appel échoue proprement. */
export class HttpSalonApi implements SalonApi {
  constructor(private readonly base: string) {}

  now(playerId: string | null) {
    return apiCall<SalonNow>(this.base, "GET", `/api/salon/now${playerId ? `?player=${encodeURIComponent(playerId)}` : ""}`);
  }

  board(session: number, playerId: string | null, since?: number) {
    const query = [...(playerId ? [`player=${encodeURIComponent(playerId)}`] : []), ...(since !== undefined ? [`since=${since}`] : [])].join("&");
    return apiCall<SalonBoard>(this.base, "GET", `/api/salon/${session}/board${query ? `?${query}` : ""}`);
  }

  ghosts(session: number, refs: string[]) {
    return apiCall<{ ghosts: SalonGhost[] }>(this.base, "GET", `/api/salon/${session}/ghosts?refs=${refs.map(encodeURIComponent).join(",")}`);
  }

  submit(session: number, playerId: string, name: string, replay: string) {
    return apiCall<SalonSubmitResult>(this.base, "POST", `/api/salon/${session}/submit`, { playerId, name, replay });
  }
}
