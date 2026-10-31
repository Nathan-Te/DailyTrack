// Lot T4 — le numéro de la tour. **`PREMIER_JOUR_TOWER` est PROVISOIRE** : Nathan le règle au lancement de Tower (une ligne, ici). Il ne change que la numérotation (« Tour n° N », la ligne à
// partager `Du Jour · Tower #N`), jamais un contenu : `dailyTower(jour)` ne lit pas cette date. Le serveur (`/api/tower/day`) et le jeu la lisent ici, une seule fois.
import { daysFromCivil } from "@cdj/core";

/** Le premier jour de Tower (la tour n° 1), numéro de jour civil. Provisoire : le lundi 2 novembre 2026. */
export const PREMIER_JOUR_TOWER = daysFromCivil(2026, 11, 2);

/** Le numéro de la tour d'un jour (n° 1 au premier jour) ; ≤ 0 avant : le jeu n'affiche alors pas de numéro. */
export function numeroTower(jour: number): number {
  return jour - PREMIER_JOUR_TOWER + 1;
}
