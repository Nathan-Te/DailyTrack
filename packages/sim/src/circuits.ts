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

/**
 * Scénario `largeurs` (lot 12) : les trois largeurs de route (14, 20 et 26 m) et leurs transitions, un virage ample (R3),
 * un S large (R2 L2), un virage large, un rétrécissement progressif de la route large à l'étroite juste avant un virage
 * serré, un élargissement, une plaque sur la route large.
 */
export const LARGEURS_TRACK_SPEC =
  "S/e@start S S/e>n S S/n>l S S/l@cp R3 S R2 L2 S S P S S S/l>n S/n>e S L S@cp S S/e>n S S/n>l S L2 S S@finish";

export function createLargeursTrack() {
  return parseTrack("largeurs", LARGEURS_TRACK_SPEC);
}

/**
 * Scénario `vitesse` (lot 15) : départ, plaque en haut d'une longue descente (six blocs), deux super turbos enchaînés sur
 * une ligne droite (le second prolonge le premier, jusqu'à 88 m/s), grande courbe relevée (R3/b) prise à fond, puis un
 * freinage appuyé avant un virage serré.
 */
export const VITESSE_TRACK_SPEC =
  "S@start S S P D D D D D D S S@cp S S T S S T S S S S S S@cp S T S S S S R3/b S S S S@cp S S S S L S S@finish";

export function createVitesseTrack() {
  return parseTrack("vitesse", VITESSE_TRACK_SPEC);
}

/**
 * Scénario `glace` (lot 16) : une ligne droite de route (pour la comparer), une longue ligne droite de glace, deux virages
 * (gauche puis droite) à prendre en roue libre, puis un slalom de deux S larges sur la glace.
 */
export const GLACE_TRACK_SPEC =
  "S@start S S S S S S S@cp S/g S/g S/g S/g S/g S/g S/g S/g@cp L/g S/g S/g R/g S/g S/g@cp L2/g R2/g S/g L2/g R2/g S/g S/g@cp S S@finish";

export function createGlaceTrack() {
  return parseTrack("glace", GLACE_TRACK_SPEC);
}

/**
 * Scénario `relief` (lot 17) : montée de deux niveaux (U U), crête, longue descente (D2 D D) ; virage ; saut court (rampe, vide, réception
 * un niveau plus bas, fenêtre ≥ 33 m/s) ; plaque puis long saut (deux cellules de vide, atterrissage deux niveaux plus bas,
 * fenêtre ≥ 52 m/s) ; montée de six niveaux en deux blocs raides (U3 U3), section surélevée de quatre blocs sans rebords (o)
 * à 24 m au-dessus du point le plus bas, descente et arrivée. Un virage large (L2, R2) sépare chaque épreuve.
 */
export const RELIEF_TRACK_SPEC =
  "S@start S S U U S@cp D2 D D S L2 S S S K GD S S S@cp R2 S P S K G GD D S S S@cp U3 U3 S/o S/o S/o S/o S D3 S L2 S S@finish";

export function createReliefTrack() {
  return parseTrack("relief", RELIEF_TRACK_SPEC);
}
