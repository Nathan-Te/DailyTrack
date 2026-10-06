import { parseTrack } from "./track";

/**
 * Circuit d'essai écrit à la main (lot 2) : 37 blocs, ~1,2 km, trois points de contrôle, une montée,
 * une descente, deux bosses, un tremplin et quatre plaques d'accélération. Voir `parseTrack` pour la notation.
 */
export const TEST_TRACK_SPEC =
  "S@start S P S R S U S L S@cp B S L S R P D S R J S S L S@cp S R S B P R S S@cp U S D P S@finish";

export function createTestTrack() {
  return parseTrack("essai", TEST_TRACK_SPEC);
}

/**
 * Scénario `pilotage` (lot 7) : de quoi juger la conduite en un tour. Longue ligne droite et plaque, grande courbe
 * (L2) prise à fond où l'on frôle le rebord extérieur, chicane rapide, épingle, bosses, tremplin avec réception,
 * second virage large, montée et descente.
 */
export const PILOTAGE_TRACK_SPEC =
  "S@start S S S S S P S L2 S S R S@cp L R S S L S B B S S J S S S@cp R2 S S U S D S R L L S@cp S S S@finish";

export function createPilotageTrack() {
  return parseTrack("pilotage", PILOTAGE_TRACK_SPEC);
}
