import { parseTrack } from "./track";

/**
 * Circuit d'essai écrit à la main (lot 2) : 37 blocs, ~1,2 km, trois points de contrôle, une montée,
 * une descente, deux bosses, un tremplin et trois plaques d'accélération, chacune suivie d'au moins deux blocs sans virage
 * (voir `PAD_RUNOUT` dans generator.ts ; une plaque suivie d'une bosse puis d'un virage ne se passe pas : on décolle, donc
 * on ne freine plus). Voir `parseTrack` pour la notation.
 */
export const TEST_TRACK_SPEC =
  "S@start P S S R S U S L S@cp B S L S R P D S R J S S L S@cp S R S B S R S S@cp U S D P S@finish";

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

/**
 * Scénario `surfaces` (lot 8) : chaque revêtement (terre, glace, herbe), un super turbo (cinq lignes droites pour
 * freiner ensuite), un moteur coupé (point de contrôle deux blocs plus loin), un virage relevé serré (R/b, L/b) et un
 * virage relevé large (L2/b), puis une plaque d'accélération.
 */
export const SURFACES_TRACK_SPEC =
  "S@start S S S/t S/t R/t S/t S@cp S/g S/g S/g L/g S/g S/h S/h S/h S S T S S S S S L2/b S S S R/b S S C S S@cp S L/b S S P S S S L2 S S@finish";

export function createSurfacesTrack() {
  return parseTrack("surfaces", SURFACES_TRACK_SPEC);
}
