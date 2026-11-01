// Le bouton fantôme de Tower (lot T4) : **trois états**, Aucun → Ma meilleure → Diamant → Aucun… (charte rév. 12 : le fantôme reste en vue en partie, son nom est lu « Fantôme : {nom} »).
//   - « Ma meilleure » : la silhouette de ta meilleure partie du jour (celle de la session, ou la rediffusion gardée dans le navigateur) ;
//   - « Diamant » : la silhouette de la tour du bot de l'auteur. **Elle n'est offerte qu'une fois que tu es classé ce jour-là** (règle G1 : débloqué quand on a fini) ; le serveur la
//     refuse (403) à qui ne l'est pas, et le bouton ne la propose pas.
// Pur et testé : `suivant` saute les états indisponibles ; si rien n'est disponible, le fantôme reste « Aucun ».

export type EtatFantome = "aucun" | "meilleure" | "diamant";

export const ETATS_FANTOME: readonly EtatFantome[] = ["aucun", "meilleure", "diamant"];

export interface DisponiblesFantome {
  meilleure: boolean;
  diamant: boolean;
}

/** L'état d'après celui-ci à l'appui du bouton : le prochain état disponible dans l'ordre (Aucun est toujours disponible). */
export function suivant(etat: EtatFantome, dispo: DisponiblesFantome): EtatFantome {
  const ok = (e: EtatFantome): boolean => e === "aucun" || dispo[e];
  for (let i = 1; i <= ETATS_FANTOME.length; i++) {
    const e = ETATS_FANTOME[(ETATS_FANTOME.indexOf(etat) + i) % ETATS_FANTOME.length]!;
    if (ok(e)) return e;
  }
  return "aucun";
}

/** L'état de départ d'une partie : « Ma meilleure » si elle existe (et si le joueur la veut au départ : Réglages › Affichage, lot T7), sinon « Aucun ». */
export function etatInitial(dispo: DisponiblesFantome, depart: "aucun" | "meilleure" = "meilleure"): EtatFantome {
  return depart === "meilleure" && dispo.meilleure ? "meilleure" : "aucun";
}

/** Un état qui n'est plus disponible (le Diamant d'un autre jour, une meilleure effacée) retombe sur « Aucun ». */
export function etatValide(etat: EtatFantome, dispo: DisponiblesFantome): EtatFantome {
  return etat === "aucun" || dispo[etat] ? etat : "aucun";
}

/** La clé de catalogue du nom lu : `fantome.aucun`, `fantome.meilleure`, `fantome.diamant`. */
export const cleNomFantome = (etat: EtatFantome): string => `fantome.${etat}`;
