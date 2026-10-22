import {
  createAirTrack,
  createBasCotesTrack,
  createCuvesTrack,
  createFigureTrack,
  createFiguresTrack,
  createGlaceTrack,
  createLargeursTrack,
  createPilotageTrack,
  createReliefTrack,
  createSurfacesTrack,
  createTestTrack,
  createVitesseTrack,
  figureByName,
  type Track,
} from "@cdj/sim";

// Les circuits des scénarios d'essai (`?scenario=…`, lots 2 à 21) : écrits à la main, ils n'ont de sens que pour les outils de test. Lot 36 : ils quittent le paquet du
// premier chargement (avec la bibliothèque de figures qu'ils tirent), le jeu les charge (`import()`) seulement quand l'adresse en demande un, ou quand le circuit de
// secours du générateur est nécessaire (`circuitEngine.ts`).

/** Les scénarios connus de l'adresse (`?scenario=`), sauf `figure` (une figure à part, voir `scenarioTrack`). */
export const SCENARIOS = ["figures", "plat", "essai", "pilotage", "surfaces", "largeurs", "vitesse", "glace", "relief", "cuves", "air", "bas-cotes"] as const;
export type Scenario = (typeof SCENARIOS)[number] | "figure";

/**
 * Le circuit d'un scénario ; `null` pour `plat` (le terrain d'essai du lot 1 n'a pas de circuit) et, pour `figure`, quand le nom est inconnu ou la variante
 * impossible (`?scenario=figure&f=<nom>&v=<variante>&m=1`). Tout autre nom donne le circuit d'essai.
 */
export function scenarioTrack(scenario: string, params: URLSearchParams): Track | null {
  switch (scenario) {
    case "plat":
      return null;
    case "pilotage":
      return createPilotageTrack();
    case "surfaces":
      return createSurfacesTrack();
    case "largeurs":
      return createLargeursTrack();
    case "vitesse":
      return createVitesseTrack();
    case "glace":
      return createGlaceTrack();
    case "relief":
      return createReliefTrack();
    case "cuves":
      return createCuvesTrack();
    case "air":
      return createAirTrack();
    case "bas-cotes":
      return createBasCotesTrack();
    case "figures":
      return createFiguresTrack();
    case "figure":
      return createFigureTrack(params.get("f") ?? "", Number(params.get("v") ?? 0) || 0, params.get("m") === "1");
    default:
      return createTestTrack();
  }
}

/** Le nom lisible d'une figure (le titre du scénario `figure`). */
export const figureLabel = (name: string | null): string => figureByName(name)?.label ?? "";
