// Les DANGERS côté jeu (lot GR7), la **décision**, pure : l'annonce « Nouveau : … » d'un danger qu'on rencontre pour la première fois (une seule fois par partie), et la couleur du rouge. **Aucun rendu ici** : `hud.ts` écrit
// l'annonce, `monde3d.ts` dessine, `sonsLogique.ts` joue. Ce fichier ne touche ni la simulation ni la rediffusion.

/** Les dangers qu'on annonce (le premier passage de chacun : le plan du jour le marque `intro`, `Morceau.intro`). Les écraseurs, plateformes mobiles et projectiles sont pour le GR8. */
export type NomDeDanger = "scies" | "fragiles" | "lasers";
export const NOMS_DES_DANGERS: readonly NomDeDanger[] = ["scies", "fragiles", "lasers"];

/** Combien de colonnes avant le morceau qui l'introduit l'annonce paraît : assez tôt pour être lue, assez tard pour tomber au bon endroit (12 colonnes : une seconde à 12,5 cases/s). */
export const COLONNES_AVANT_ANNONCE = 12;
/** Combien de pas (120 par seconde) l'annonce reste affichée : 3 s. */
export const DANGER_AFFICHE = 360;

export interface AnnonceDanger {
  /** Change à chaque annonce (le HUD sait qu'il faut réécrire). */
  id: number;
  danger: NomDeDanger;
  /** Le pas où elle a paru. */
  depuis: number;
  /** Le rouge des dangers, en `#rrggbb`. */
  couleur: string;
}
/** Le rouge de l'accent de l'annonce : celui des dangers (jamais une autre couleur). */
export const couleurDuDanger = (danger: number): number => danger;
