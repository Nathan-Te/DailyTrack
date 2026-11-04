import { DELAI_ENVOI_MS, ProfileClient, type ApiResult } from "@cdj/profile";
import type { ReponseSource, SourceEnvoi } from "../envoi";

// Le serveur d'un jeu neuf vu du jeu : le client HTTP de la plateforme (`@cdj/profile` : délai, erreurs traduites, corps vide = panne réseau ; **un échec est une valeur, jamais une exception**). Les routes
// sont celles du module des jeux (`/api/<id>/…`) ; l'identifiant secret voyage dans `X-Player-Id`, jamais dans l'adresse.

/** Une ligne du classement : les colonnes de la fiche par leur nom, plus le pseudo, la médaille et la référence publique. */
export type LigneJeu = { rank: number; name: string; medal: string | null; ref?: string } & Record<string, unknown>;
export interface ClassementJeu {
  date: string;
  open: boolean;
  participants: number;
  top: LigneJeu[];
  me: LigneJeu | null;
  generation?: number;
}
export interface EnvoiJeu {
  accepted: true;
  date: string;
  score: Record<string, number>;
  medal: string | null;
  improved: boolean;
  deja?: true;
  rank: number;
  participants: number;
  board: ClassementJeu;
}
export interface MoiJeu {
  name: string;
  today: string;
  days: ({ date: string; medal: string | null } & Record<string, unknown>)[];
  stats: { days: number; medals: Record<string, number>; streak: number };
  generation?: number;
}

export class ClientJeu extends ProfileClient implements SourceEnvoi<EnvoiJeu> {
  constructor(
    base: string,
    private readonly id: string,
  ) {
    super(base);
  }
  submit(playerId: string, name: string | null, replay: string, delaiMs: number = DELAI_ENVOI_MS): Promise<ReponseSource<EnvoiJeu>> {
    return this.call<EnvoiJeu>("POST", `/api/${this.id}/submit`, { replay, ...(name ? { name } : {}) }, { "X-Player-Id": playerId }, delaiMs);
  }
  board(date: string, playerId: string | null): Promise<ApiResult<ClassementJeu>> {
    return this.call<ClassementJeu>("GET", `/api/${this.id}/day/${encodeURIComponent(date)}/board`, undefined, playerId ? { "X-Player-Id": playerId } : undefined);
  }
  moi(playerId: string): Promise<ApiResult<MoiJeu>> {
    return this.call<MoiJeu>("GET", `/api/${this.id}/me`, undefined, { "X-Player-Id": playerId });
  }
}

/** La valeur de `VITE_API_URL` (ou de `?api=`) qui veut dire « le serveur de la même origine ». */
export const SAME_ORIGIN_API = "/";
