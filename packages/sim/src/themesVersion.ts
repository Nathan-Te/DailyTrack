import type { FigureCategory } from "./figures";
import { RYTHME_DOMINANT, type Rythme } from "./rythmes";
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

/**
 * Lot V2 (générateur v21) — ce que le poids d'une figure regarde : sa catégorie et ses drapeaux (`braking` : un freinage franc, `tight` : au moins un virage serré, `jump`,
 * `relief`, `banked`, `turbo`). Le poids d'une figure est multiplié par celui de chaque étiquette qu'elle porte (rythme du jour, puis fiche du biome).
 */
export type Etiquette = FigureCategory | "braking" | "tight" | "jump" | "relief" | "banked" | "turbo";
export type Poids = Partial<Record<Etiquette, number>>;

/**
 * Lot V2 (générateur v21) — **les rythmes** (`rythmeDuJour`, rythmes.ts) : ce que chacun fait aux poids des figures. Technique : virages et freinages courts, moins de boosts ;
 * rapide : portions rapides et freinages francs (le seul rythme où le motif « boost → longue ligne droite → virage serré » est permis, une fois) ; vertical : le relief ;
 * aérien : les sauts (le circuit en veut toujours un) ; mixte : les poids du biome seuls.
 */
export const POIDS_RYTHME: Readonly<Record<Rythme, Poids>> = {
  technique: { technique: 2.5, tight: 1.5, rapide: 0.4, braking: 0.5, saut: 0.6, turbo: 0.5 },
  rapide: { braking: 2, turbo: 1.5, rapide: 1.5, banked: 1.3, technique: 0.8 },
  mixte: {},
  vertical: { relief: 3, saut: 0.6, rapide: 0.6 },
  aerien: { saut: 3, combo: 1.5, technique: 0.7 },
};

/**
 * Lot V2 (générateur v21) — **la fiche de chaque biome** (`docs/track/biomes.md`, la même en mots) : les poids de ses figures, son rythme dominant (`RYTHME_DOMINANT`,
 * rythmes.ts), son relief (`steep` : part des collines raides), et un ou deux traits de tracé : `maxDroite` (plus longue ligne droite libre, en blocs, hors du dégagement d'une poussée,
 * d'un saut ou d'une cuve : `longestFreeStraight`), `maxTight` (virages serrés permis), `serrer` / `amplifier` / `alterner` (les virages larges des figures, `tournures`), `pente`
 * (`reliefDuBiome`), des favorites de plus, `aussi` (des figures propres à un autre biome). **Un nouveau biome a sa fiche** (le type l'exige : `Record<ThemeName, …>`).
 */
export interface FicheBiome {
  rythme: Rythme;
  poids: Poids;
  maxDroite?: number;
  theme?: Partial<Pick<Theme, "maxTight" | "relief" | "bankChance" | "widths">>;
  favor?: readonly string[];
  /** Figures propres à un autre biome (`only`) que celui-ci tire aussi. */
  aussi?: readonly string[];
  /** Traits posés sur les virages larges ordinaires des figures (`tournures`, generator.ts) : part (%) qui deviennent serrés, amples ; virages qui alternent de sens. */
  serrer?: number;
  amplifier?: number;
  alterner?: boolean;
  /** Relief posé sur les droites ordinaires du circuit fini (`reliefDuBiome`, generator.ts) : part (%) qui deviennent des pentes (Col alpin). */
  pente?: number;
}
export const FICHES_V21: Readonly<Record<ThemeName, FicheBiome>> = {
  // Le circuit de vitesse : les virages larges deviennent des courbes amples, souvent relevées ; peu de serrés.
  stade: { rythme: RYTHME_DOMINANT.stade, poids: { banked: 1.5, rapide: 1.5, combo: 1.5 }, theme: { bankChance: 50 }, amplifier: 100 },
  // La spéciale de terre : des virages qui changent de sens, des bosses et des sauts, aucune ligne droite libre de plus de trois blocs.
  rallye: { rythme: RYTHME_DOMINANT.rallye, poids: { technique: 1.5, saut: 1.5, tight: 0.5, rapide: 0.6 }, maxDroite: 3, alterner: true, favor: ["slalom-route", "s-serre-large", "bosses-terre"] },
  // La patinoire : la route large, des S larges en roue libre, un seul virage serré au plus, peu de relief.
  banquise: { rythme: RYTHME_DOMINANT.banquise, poids: { tight: 0.2, banked: 0.6, relief: 0.3 }, theme: { maxTight: 1, relief: { hills: [1, 2], steep: 10 } }, amplifier: 40, favor: ["slalom-glace", "slalom-route", "demi-tour-large"] },
  // La précision au-dessus du vide : des sauts et des combinaisons, de la route sans rebords (son bas-côté de vide, lot 21).
  nuit: { rythme: RYTHME_DOMINANT.nuit, poids: { saut: 1.8, combo: 1.5, rapide: 0.7 }, favor: ["double-saut", "saut-virage"] },
  // Les routes de campagne : étroites et vallonnées, des collines douces, des crêtes et des virages aveugles, des virages serrés au bout des petites routes.
  campagne: { rythme: RYTHME_DOMINANT.campagne, poids: { relief: 1.5, technique: 1.5, rapide: 0.6 }, theme: { relief: { hills: [3, 4], steep: 10 } }, favor: ["colline-douce", "crete-virage", "virage-aveugle"] },
  // Entre les parois : chaque virage large des figures devient serré (quatre au plus), aucune ligne droite libre de plus de trois blocs, le relief en marches (collines raides).
  canyon: { rythme: RYTHME_DOMINANT.canyon, poids: { tight: 2.5, technique: 1.8, rapide: 0.4, braking: 0.5 }, maxDroite: 3, theme: { maxTight: 4, relief: { hills: [1, 3], steep: 90 } }, favor: ["s-serre-large", "pincement", "colline-raide", "chicane-angles"], aussi: ["chicane-angles"], serrer: 100 },
  // La descente en lacets : chaque droite libre devient une pente, des demi-tours dans la pente.
  col: { rythme: RYTHME_DOMINANT.col, poids: { relief: 3, tight: 0.6, saut: 0.6 }, pente: 100, favor: ["virage-descente", "virage-aveugle", "demi-tour-large"] },
  // Les angles droits : des virages larges qui deviennent serrés (40 %), des rues courtes (quatre blocs), peu de relief.
  ville: { rythme: RYTHME_DOMINANT.ville, poids: { tight: 1.5, technique: 1.5, relief: 0.5, saut: 0.5, rapide: 0.6 }, maxDroite: 4, serrer: 40 },
};

/** Le thème tel que le générateur `generator` le connaît (lot 48 : la Campagne roule sur l'herbe de course à partir de la v17 ; lot 49 : les fiches à partir de la v18 ; lot V2 : la fiche du biome à partir de la v21). */
export function themeOfVersion(theme: Theme, generator: number): Theme {
  const changes = generator >= 17 ? THEMES_48[theme.name] : undefined;
  const t = changes ? { ...theme, ...changes } : theme;
  const fiche = generator >= 18 ? THEMES_49[t.name] : undefined;
  if (!fiche) return t;
  const f = fiche.figures;
  const t49: Theme = { ...t, ...(fiche.zones ? { zones: fiche.zones } : {}), figures: { ...t.figures, favor: [...t.figures.favor, ...f.favor], ban: [...t.figures.ban, ...f.ban], vedettes: f.vedettes } };
  const v21 = generator >= 21 ? FICHES_V21[t.name] : undefined;
  return v21 ? { ...t49, ...v21.theme, figures: { ...t49.figures, favor: [...t49.figures.favor, ...(v21.favor ?? [])], ...(v21.aussi ? { aussi: v21.aussi } : {}) } } : t49;
}
