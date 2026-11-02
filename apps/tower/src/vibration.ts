// Lot T9 — la vibration du choc d'un taquet (15 ms sur téléphone) : une décision pure et son appel. Elle est permise par le réglage du joueur (Réglages › Affichage › Vibration, allumée par défaut) ET par le curseur
// de `?debug&tune` (1 : permise, 0 : coupée) ; un navigateur sans `navigator.vibrate` (ordinateur, iPhone) ne vibre pas, sans erreur. **Affichage seulement** : rien n'entre dans la simulation.

/** La durée de la vibration d'un choc, en millisecondes. */
export const VIBRATION_CHOC_MS = 15;

/** La vibration est-elle permise ? `reglage` : le choix du joueur ; `curseur` : le curseur de rendu (0 : coupée). */
export const vibrationPermise = (reglage: boolean, curseur: number): boolean => reglage && curseur > 0;

/** Fait vibrer l'appareil `ms` millisecondes si c'est permis et possible. Rend vrai si l'appel a été fait. */
export function vibrer(permise: boolean, ms = VIBRATION_CHOC_MS, nav: { vibrate?: (d: number) => boolean } | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!permise || typeof nav?.vibrate !== "function") return false;
  try {
    nav.vibrate(ms);
    return true;
  } catch {
    return false;
  }
}
