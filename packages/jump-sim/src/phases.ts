// Généré par `npm run phases:modules -w @cdj/jump-sim` (lot 15) à partir de `modules/phases.json` : ne pas modifier à la main.
// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer phases:modules »).

/**
 * Lot 15 — **validation toutes phases** : les variantes (par morceau) dont une reprise à l'arrêt, à l'une des phases essayées de leur horloge,
 * n'a pas de solution jouable par un humain. Le générateur v4 ne les pose jamais (`daily.ts`) ; le détail est dans `modules/phases.json`.
 */
export const PHASE_REFUSED: Readonly<Record<string, readonly number[]>> = {};
