import { buildFigure, figureByName } from "./figures";
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

/**
 * Scénario `cuves` (lot 18) : après une ligne droite d'élan, une cuve droite (demi-tube, quatre `V`), un mur latéral à gauche (quatre `ML`,
 * à prendre vite : sous ≈ 24 m/s on glisse vers le fond), un virage en cuve large (`L2/c`) abordé à pleine vitesse ; puis un demi-tour serré
 * (`R R`) qui ramène la vitesse bien plus bas, et le même virage en cuve abordé trop lentement : la voiture n'y a plus la vitesse
 * de monter sur la paroi. Un point de contrôle sépare chaque épreuve.
 */
export const CUVES_TRACK_SPEC =
  "S/n@start S S S V V V V S S@cp ML ML ML ML S S@cp L2/c S S@cp R R L2/c S S S@finish";

export function createCuvesTrack() {
  return parseTrack("cuves", CUVES_TRACK_SPEC);
}

/**
 * Scénario `air` (lot 19) : l'air se travaille. Dos d'âne pris à haute vitesse (le nez pique ou se cabre selon la façon de décoller), tremplin
 * `J` à prendre en braquant (la caisse penche), long saut au super turbo, saut dont la réception est un virage relevé, chute de trois niveaux
 * (`GD2` puis `D`), mur latéral quitté en l'air. Le frein, en l'air, fige la caisse. Un point de contrôle sépare chaque épreuve.
 */
export const AIR_TRACK_SPEC =
  "S/n@start S S P S S U2 D2 S S L2 S S@cp S S P S J S S S S R2 S S@cp S T S S K G G D S S S S L2 S S@cp S P S S K G D S S L2/b S S R2/b S S@cp S P S K GD2 D S S R2 S S@cp S S P ML ML ML ML S S S@finish";

export function createAirTrack() {
  return parseTrack("air", AIR_TRACK_SPEC);
}

/**
 * Scénario `figures` (lot 20) : un tour de onze figures marquantes de la bibliothèque (figures.ts), écrit à la main, dans cet ordre :
 * S serré-large, turbo puis courbe relevée, rétrécissement et virage, saut vers un virage relevé, slalom de glace, descente-cuve-saut,
 * plaque puis épingle, virage aveugle en haut d'une montée, double saut, moteur coupé avant un virage, turbos enchaînés et S large.
 * Un point de contrôle environ tous les dix blocs ; la reprise repart de là.
 */
export const FIGURES_TRACK_SPEC =
  "S/n@start S S S L R2 S T S S S@cp S S L3/b S S/n>e L S P S K G D S@cp S R2/b S S/g L2/g R2/g L2/g S/g S@cp D S V V V S K GD S@cp S S P S S S L S U U U L2 D D D S P S K G D S@cp S K GD S S S R2 S@cp S C S S@cp R2 S T S S@cp T S S S S S L2 R2 S S S@finish";

export function createFiguresTrack() {
  return parseTrack("figures", FIGURES_TRACK_SPEC);
}

/**
 * Scénario `figure` (lot 20) : une seule figure, avec cinq droites de lancement (un point de contrôle juste avant), pour l'essayer en boucle.
 * `variant` (0 par défaut, borné) et `mirror` (le premier virage à droite) choisissent la variante ; `null` si le nom est inconnu ou si la
 * variante est impossible sur une route normale. Le circuit n'est jamais classé (c'est un essai, comme `?scenario=air`).
 */
export function createFigureTrack(name: string, variant = 0, mirror = false) {
  const figure = figureByName(name);
  if (!figure) return null;
  const body = buildFigure(figure, !mirror, "n", Math.max(0, Math.min(figure.variants - 1, Math.floor(variant))));
  if (!body) return null;
  const tokens = ["S/n@start", "S", "S", "S", "S", "S@cp", ...body.slice(body[0] === "S" ? 1 : 0), "S", "S@finish"];
  const cut = tokens.indexOf("C");
  if (cut >= 0) tokens[cut + 2] = "S@cp"; // un moteur coupé rend le moteur au point de contrôle deux blocs plus loin
  return parseTrack(`figure-${figure.name}`, tokens.join(" "));
}

/**
 * Scénario `bas-cotes` (lot 21) : un virage par bas-côté — herbe (Stade, Campagne), terre et gravier (Rallye), neige poudreuse (Banquise),
 * vide (Nuit) — chacun avec ses vibreurs, une portion bosselée (tôle ondulée du Rallye), puis un virage serré bordé d'herbe sur route
 * étroite, à couper (ou pas). Un point de contrôle entre chaque épreuve.
 */
export const BAS_COTES_TRACK_SPEC =
  "S/n@start S S/~h S L2 S S S/~r S@cp S/~t S R2 S S S/~r S/~p S L2 S S S/~r S@cp S/u S/u S/u S S/~v S R2 S S S/~r S@cp S/~h S/n>e S L S S S/~r S@finish";

export function createBasCotesTrack() {
  return parseTrack("bas-cotes", BAS_COTES_TRACK_SPEC);
}
