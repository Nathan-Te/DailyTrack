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
