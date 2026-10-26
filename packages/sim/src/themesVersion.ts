import { THEMES, type Theme, type ThemeName } from "./themes";

// Les thèmes tels que chaque version du générateur les connaît (lots 48 et 49) : à part de `themes.ts` (lot 49), qui est dans le premier chargement du jeu
// (palettes, noms, thème du jour) ; ces tables ne servent qu'au générateur (fil de travail) et aux tests. Changer un thème à partir d'une version = une
// entrée ici, jamais une valeur de `THEMES` (les jours d'avant la bascule gardent leur thème au bit près).

/** Figures d'herbe de course (lot 48, propres à la Campagne, générateur v17). */
export const TURF_FIGURES = ["ample-herbe", "chicane-herbe", "droite-herbe"] as const;

/**
 * Lot 48 (générateur v17) : ce qui change dans un thème à partir de cette version. **Campagne** :
 * l'herbe de course remplace l'herbe de ses zones de revêtement et en devient le revêtement principal (poids 3 contre 1 à la terre), et
 * l'une de ses trois figures d'herbe de course est toujours là (`requireAlso`). Les zones d'herbe de course se posent là où trois blocs de suite
 * peuvent la porter (`turfZone`, generator.ts) : les approches protégées par le lot 34 gardent la route. Les autres thèmes ne changent pas ; un jour d'avant la bascule garde son thème tel quel.
 */
const THEMES_48: Partial<Record<ThemeName, Partial<Theme>>> = {
  campagne: { zones: { count: [2, 3], surfaces: [["turf", 3], ["dirt", 1]] }, figures: { ...THEMES.campagne.figures, favor: [...THEMES.campagne.figures.favor, ...TURF_FIGURES], requireAlso: TURF_FIGURES } },
};

/** Figures à super turbo (lot 49) : interdites, à partir de la v18, aux thèmes qui n'en ont pas (`turboChance` 0 : Rallye, Banquise, Campagne). */
export const TURBO_FIGURES = ["chaine-turbo", "turbo-epingle", "turbo-courbe", "turbo-saut-releve"] as const;

/**
 * Lot 49 (générateur v18) : **les fiches d'identité validées par Nathan** (`docs/lots/lot-49-identite/fiches.md`).
 * Pour chaque thème : ses nouvelles figures favorites (poids ×4), ses **vedettes** (une par circuit, à tour de rôle) et ce qu'il ne fait jamais ;
 * Rallye et Banquise : un peu plus de terre et de glace. Ces listes s'ajoutent à celles du thème (et du lot 48 pour la Campagne).
 */
const THEMES_49: Partial<Record<ThemeName, { zones?: Theme["zones"]; figures: { favor: readonly string[]; ban: readonly string[]; vedettes: readonly string[] } }>> = {
  stade: { figures: { favor: ["tremplin-releve", "reception-virage", "chicane-tremplin"], ban: [], vedettes: ["tremplin-releve", "reception-virage", "chicane-tremplin", "turbo-saut-releve"] } },
  rallye: { zones: { count: [3, 4], surfaces: [["dirt", 1]] }, figures: { favor: ["bosses-terre", "demi-tour-mixte", "saut-sortie-virage"], ban: TURBO_FIGURES, vedettes: ["bosses-terre", "demi-tour-mixte", "saut-sortie-virage"] } },
  banquise: { zones: { count: [2, 3], surfaces: [["ice", 3], ["dirt", 1]] }, figures: { favor: ["saut-glace", "demi-tour-glace"], ban: TURBO_FIGURES, vedettes: ["saut-glace", "demi-tour-glace", "slalom-glace", "glace-coupe-virage"] } },
  campagne: { figures: { favor: ["demi-tour-mixte", "saut-sortie-virage"], ban: TURBO_FIGURES, vedettes: ["demi-tour-mixte", "saut-sortie-virage", "droite-herbe", "ample-herbe"] } },
  canyon: { figures: { favor: ["saut-falaise", "reception-virage", "saut-sortie-virage"], ban: [], vedettes: ["saut-falaise", "reception-virage", "saut-sortie-virage"] } },
  col: { figures: { favor: ["devers-descente", "demi-tour-glace", "saut-glace"], ban: [], vedettes: ["devers-descente", "demi-tour-glace", "saut-glace"] } },
  ville: { figures: { favor: ["rues-en-escalier", "chicane-tremplin"], ban: [], vedettes: ["rues-en-escalier", "chicane-tremplin", "slalom-route", "u-urbain"] } },
  nuit: { figures: { favor: ["fil-du-rasoir", "tremplin-releve", "reception-virage"], ban: [], vedettes: ["fil-du-rasoir", "tremplin-releve", "reception-virage"] } },
};

/** Le thème tel que le générateur `generator` le connaît (lot 48 : la Campagne roule sur l'herbe de course à partir de la v17 ; lot 49 : les fiches à partir de la v18). */
export function themeOfVersion(theme: Theme, generator: number): Theme {
  const changes = generator >= 17 ? THEMES_48[theme.name] : undefined;
  const t = changes ? { ...theme, ...changes } : theme;
  const fiche = generator >= 18 ? THEMES_49[t.name] : undefined;
  if (!fiche) return t;
  const f = fiche.figures;
  return { ...t, ...(fiche.zones ? { zones: fiche.zones } : {}), figures: { ...t.figures, favor: [...t.figures.favor, ...f.favor], ban: [...t.figures.ban, ...f.ban], vedettes: f.vedettes } };
}
