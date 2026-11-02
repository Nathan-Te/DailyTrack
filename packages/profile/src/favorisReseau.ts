import { call, type ApiResult, type FetchLike } from "./client";

// Lot F1 : l'écriture des jeux épinglés au serveur. **Volontairement PAS dans `index.ts`** (comme `retrouver.ts`) : les applications l'importent par son chemin
// (`@cdj/profile/src/favorisReseau`) depuis un module chargé à la demande — le portail ne paie ni l'appel au réseau ni ce code avant le premier toucher d'une étoile.

/** Ce que rend `PUT /api/portail/favoris` : de quoi redessiner l'accueil sans relire le jour. */
export interface ReponseFavoris {
  favoris: string[] | null;
  jeuxDuJour: string[];
  /** Le premier jour où ce choix compte (AAAA-MM-JJ) : demain, ou aujourd'hui pour un profil créé aujourd'hui. */
  effetLe: string;
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
}

/** Enregistre la liste entière (le serveur répond ce qui compte). L'identifiant part en `X-Player-Id`, jamais dans l'adresse. Ne lève jamais. */
export function enregistrerFavoris(base: string, playerId: string, favoris: readonly string[], fetchImpl?: FetchLike): Promise<ApiResult<ReponseFavoris>> {
  return call<ReponseFavoris>(base, "PUT", "/api/portail/favoris", { favoris }, undefined, { "X-Player-Id": playerId }, fetchImpl);
}
