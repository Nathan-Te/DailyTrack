// Lot T3b — le tirage du contenu du jour : la plage du Diamant, le nombre d'essais et la règle de choix. Des constantes et des fonctions PURES : la préparation (`bot/preparer.ts`) joue le bot sur
// chaque tirage et applique la règle ; le jeu et le garde-fou n'ont besoin que des bornes.
//
// **Pourquoi.** Au lot T3 le Diamant (la hauteur du bot) allait de 4,1 m à 103,4 m selon le jour : un jour à 4 m n'a pas de médailles à gagner, un jour à 100 m est hors de portée. Le contenu du jour
// est donc choisi par essais sur la valeur du bot : le premier tirage dont le Diamant tombe dans la plage est servi.

/** La plage du Diamant d'un jour servi, en millimètres : de 25 m à 60 m. */
export const PLAGE_DIAMANT_MM = { min: 25_000, max: 60_000 } as const;

/** Le nombre de tirages que la préparation essaie au plus : les tirages 0, 1, 2 et 3. */
export const TIRAGES_MAX = 4;

/** Ce qu'un tirage a donné : son numéro et son Diamant (la hauteur du bot, plafonnée : `diamantDe`). */
export interface Essai {
  tirage: number;
  diamantMm: number;
}

export const dansLaPlage = (diamantMm: number): boolean => diamantMm >= PLAGE_DIAMANT_MM.min && diamantMm <= PLAGE_DIAMANT_MM.max;

/** L'écart d'un Diamant à la plage, en millimètres (0 dedans). */
export const ecartALaPlage = (diamantMm: number): number =>
  diamantMm < PLAGE_DIAMANT_MM.min ? PLAGE_DIAMANT_MM.min - diamantMm : diamantMm > PLAGE_DIAMANT_MM.max ? diamantMm - PLAGE_DIAMANT_MM.max : 0;

/**
 * La règle de choix, sur les essais dans l'ordre des tirages : le PREMIER tirage dans la plage ; si aucun ne l'est, le plus proche de la plage (le premier à égalité).
 * `dedans` dit lequel des deux cas. Les essais sont ceux de la préparation, qui s'arrête au premier tirage dans la plage ou à `TIRAGES_MAX`.
 */
export function choisirTirage(essais: readonly Essai[]): { essai: Essai; dedans: boolean } {
  if (essais.length === 0) throw new Error("aucun essai à choisir");
  const premier = essais.find((e) => dansLaPlage(e.diamantMm));
  if (premier) return { essai: premier, dedans: true };
  let meilleur = essais[0]!;
  for (const e of essais) if (ecartALaPlage(e.diamantMm) < ecartALaPlage(meilleur.diamantMm)) meilleur = e;
  return { essai: meilleur, dedans: false };
}
