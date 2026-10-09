import { Rng, mixSeed } from "./rng";
import type { BlockSurface, ShoulderKind, WidthLetter } from "./track";
import { DEFAULT_CAR_PARAMS } from "./car";
import { FIGURES } from "./figures";

// Les thèmes du jour (lot 8). Le thème est tiré de la date (même graine que la palette avant le lot 8) ; il règle :
// - la palette (couleurs de la scène) ;
// - les largeurs de route (lot 12) : poids de l'étroite, de la normale et de la large, et nombre de changements de largeur ;
// - les zones de revêtement (terre, glace, herbe) : nombre de zones et poids de chaque revêtement ;
// - les virages relevés (chance qu'un virage le soit) et les blocs à effet (super turbo, moteur coupé) ;
// - le relief (lot 17) : nombre de reliefs marqués (montées, crêtes, descentes) et part des plus raides ;
// - les sauts : chance d'un vrai saut au-dessus du vide, et chance de sections sans rebords sur les parties surélevées ;
// - les cuves (lot 18) : chance d'une cuve droite, d'un mur latéral ou d'un virage en cuve ;
// - un passage signature : une figure (figures.ts) que le circuit du thème contient toujours ;
// - les figures (lot 20) : celles que le thème favorise (tirées plus souvent) et celles qu'il s'interdit ;
// - l'identité (lot 21) : les bas-côtés (herbe, terre et gravier, neige poudreuse ou vide) et leur part, la route bosselée, une figure
//   obligatoire (sa « règle propre ») ; la lumière est côté jeu (palette, `trackMesh.ts`).
// - lot 22 : Canyon, Col alpin et Ville (le sable est leur bas-côté ou leur revêtement) ; les figures propres à un thème (`only`, figures.ts)
//   ne sortent que chez lui.
// - lot 25 : la **fiche de format** (`Theme.format`, `ThemeFormat`) : ce qui fait que le thème se joue autrement (dénivelé, largeur dominante,
//   densité de virages, longueur des droites, vitesses, sauts, revêtements, turbos permis). Le générateur la respecte (pose des figures puis
//   contrôle du tracé, `formatViolations`, generator.ts) et le script de mesure la vérifie (empreinte par thème, `fingerprint.ts`).
// Changer un thème (ou en ajouter un) change le circuit d'une date : `GENERATOR_VERSION` +1.

export const PALETTES = ["desert", "neige", "nuit", "neon", "campagne", "stade", "canyon", "alpin", "ville"] as const;
export type PaletteName = (typeof PALETTES)[number];

export const THEME_NAMES = ["stade", "rallye", "banquise", "nuit", "campagne", "canyon", "col", "ville"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Passages signature : voir `composeSpec` (generator.ts) pour les blocs de chacun. */
export type Signature = "turboBank" | "dirtStage" | "iceChicane" | "cutRun" | "dirtPinch" | "rockJump" | "switchbacks" | "rightAngles";

/**
 * Fiche de format d'un thème (lot 25) : le circuit du thème en nombres. Les bornes « exigées » sont vérifiées sur chaque circuit (sinon graine
 * voisine) ; les autres sont visées et mesurées (`npm run measure:generator`, empreinte par thème). Les figures favorites et interdites sont
 * dans `Theme.figures`, les chances (turbo, relevé, saut, cuve) dans le thème : la fiche dit ce qui en sort.
 */
export interface ThemeFormat {
  /** Le format en une phrase (affiché par le script de mesure et dans la documentation). */
  summary: string;
  /** Hauteurs permises de la route par rapport au départ (m) : exigé pendant la pose des figures. */
  heights: [number, number];
  /** Dénivelé net, arrivée − départ (m) : [min, max], exigé. */
  net: [number, number];
  /** Amplitude du relief, point le plus haut − le plus bas (m) : [min, max], exigé ; le premier relief posé fait au moins le min (0 : aucun relief exigé). */
  relief: [number, number];
  /** Part minimale de la longueur en descente (exigée) et plus haute montée d'une traite (m, exigée pendant la pose). */
  descent: number;
  climb: number;
  /** L'arrivée est le point le plus bas du circuit (à un niveau près) : exigé (Col alpin). */
  finishLow?: boolean;
  /** Largeur dominante et part minimale de la longueur à cette largeur (exigée). */
  width: { main: WidthLetter; share: number };
  /** Virages par 100 m : [min, max], exigé. */
  turns: [number, number];
  /** Plus longue suite de blocs sans virage (blocs) : exigée pendant la pose des figures (départ et arrivée compris). */
  straight: number;
  /** Vitesses du pilote d'auteur (m/s) : moyenne visée [min, max] (mesurée, non exigée) ; pointe minimale exigée (sinon graine voisine). */
  speed: { mean: [number, number]; peak: number };
  /** Sauts au-dessus du vide : nombre [min, max] (exigé) et vide le plus long exigé (cellules, 0 = rien d'exigé). */
  jumps: { count: [number, number]; longGap: number };
  /** Revêtements dominants : part minimale de la longueur (exigée ; la Banquise est complétée en glace jusqu'à sa part). */
  surfaces: Partial<Record<BlockSurface, number>>;
  /** Plaques et super turbos permis par circuit (au plus, exigé pendant la pose). */
  pads: number;
  turbos: number;
  /** Composition : une figure à freinage franc, une portion rapide exigées (lot 20) ; budget de durée des figures (secondes estimées). */
  braking: boolean;
  fast: boolean;
  budget: number;
  /** Virages larges posés en virages amples (`L2` → `L3`) : les grandes courbes du Canyon. */
  grand?: boolean;
  /** Plus longue ligne droite ordinaire (blocs `S` à la suite, lot 20) : `MAX_PLAIN_STRAIGHT` (6) par défaut ; le Canyon a ses longues droites. */
  plain?: number;
  /** Plafonds de figures par catégorie, en plus de ceux du générateur (`CAP_CATEGORY`) : le Rallye enchaîne les techniques. */
  caps?: Partial<Record<"technique" | "saut" | "rapide" | "combo" | "cuve" | "relief", number>>;
  /** Figures techniques exigées (lot 20 : 2) ; le Canyon n'en exige pas (ses courbes se prennent à fond). */
  techniques?: number;
  /** La signature ouvre le circuit, sa figure obligatoire suit (Rallye : la spéciale, quatre virages, ne trouve plus sa place une fois la grille encombrée). */
  signatureFirst?: boolean;
  /**
   * Allure : durée du pilote ÷ durée estimée (`estimateSeconds`), mesurée par thème (0,95 par défaut, lot 20). Le générateur s'en sert pour
   * refuser sans faire rouler le pilote un circuit qui sortira de la fenêtre : le Canyon va plus vite que l'estimation (grandes courbes à
   * fond), le Rallye moins vite (terre, virages enchaînés).
   */
  pace?: number;
  /** Nombre de figures par circuit (min, max) : 5 à 7 par défaut (lot 20) ; moins quand les figures du thème sont longues (Col alpin). */
  count?: [number, number];
}

/** Pointe exigée par défaut (lot 15) : 30 % au-dessus de la pointe du plat (62,4 m/s). */
export const DEFAULT_PEAK = DEFAULT_CAR_PARAMS.maxSpeed * 1.3;
const ANY: [number, number] = [-999, 999];

export interface Theme {
  name: ThemeName;
  /** Nom affiché dans l'en-tête et les archives. */
  label: string;
  palette: PaletteName;
  /** Zones de revêtement : nombre (min, max) et poids de chaque revêtement ; `null` = route partout. */
  zones: { count: [number, number]; surfaces: [BlockSurface, number][] } | null;
  /** Largeurs de route : poids de chacune (la largeur de départ et chaque changement s'en tirent) et nombre de changements (min, max). */
  widths: { weights: Record<WidthLetter, number>; changes: [number, number] };
  /** Chance (%) qu'un virage soit relevé. */
  bankChance: number;
  /** Chance (%) d'un super turbo dans un créneau calme. */
  turboChance: number;
  /** Un bloc de moteur coupé (suivi d'un point de contrôle) sur le circuit. */
  cut: boolean;
  /** Relief (lot 17) : nombre (min, max) de reliefs marqués (le premier est toujours d'au moins deux niveaux) et chance (%) qu'un relief soit raide (U2 / U3, D2 / D3). */
  relief: { hills: [number, number]; steep: number };
  /** Chance (%) d'un vrai saut (rampe, vide, réception) en plus de la signature ; 100 = tous les circuits du thème en ont un. */
  jumpChance: number;
  /** Chance (%) qu'une partie surélevée du circuit n'ait pas de rebords. */
  openChance: number;
  /** Chance (%) d'une cuve (lot 18) : cuve droite, mur latéral ou virage en cuve ; 100 = tous les circuits du thème en ont une. */
  cuveChance: number;
  signature: Signature;
  /**
   * Figures (lot 20) : noms des figures favorites (poids ×4) et interdites du thème ; `require` (lot 21) : le circuit contient toujours
   * l'une d'elles (jamais au repos, comme la signature) — la règle propre du thème.
   */
  figures: { favor: readonly string[]; ban: readonly string[]; require?: readonly string[] };
  /**
   * Bas-côtés (lot 21) : revêtement de la bande au bord de la route (ou le vide) et part (%) des blocs qui peuvent en porter, posés par
   * séries de 3 à 6 blocs (voir `assignShoulders`, generator.ts).
   */
  shoulder: { kind: ShoulderKind | "void"; share: number };
  /** Route bosselée (lot 21) : nombre (min, max) de séries de 2 à 4 droites bosselées. */
  bumpy: [number, number];
  /** Virages serrés (une cellule) permis par circuit (lot 22) : `MAX_TIGHT` (2) par défaut ; Ville en veut jusqu'à 4 (angles droits). */
  maxTight?: number;
  /** Fiche de format (lot 25). */
  format: ThemeFormat;
}

/** Virages serrés permis par circuit, signature comprise : 2 sauf thème qui en fait son identité (Ville : 4). */
export const MAX_TIGHT = 2;
export const maxTightOf = (theme: Theme): number => theme.maxTight ?? MAX_TIGHT;

/** Figures qui n'ont de sens que sur de la route (terre, glace) ou de la cuve : interdites là où le thème n'en a pas. */
const ICE = ["slalom-glace", "chicane-glace", "glace-coupe-virage"];
const DIRT = ["epingle-terre", "etranglement-terre", "saut-terre", "changement-revetement"];
const CUVES = ["cuve-droite", "mur-lateral", "virage-cuve", "saut-cuve", "descente-cuve-saut", "saut-paroi"];

/** Figures qui font un vrai saut au-dessus du vide, et celles qui posent un super turbo (lot 25 : interdites là où la fiche n'en veut pas). */
const JUMPS = FIGURES.filter((f) => f.jump).map((f) => f.name);
const TURBOS = FIGURES.filter((f) => f.turbo).map((f) => f.name);
/** Figures du Col alpin (lot 25) : les siennes, qui descendent toutes (virages compris) ; toutes les autres lui sont interdites. */
const COL_FIGURES = ["lacets", "grande-descente", "plongeon", "descente-epingle", "descente-releve", "descente-s", "corniche"];

/** Fiche des thèmes qui gardent leur format d'avant le lot 25 : bornes tirées de ce qu'ils font (mesuré), dénivelé et sauts du lot 17. */
const classic = (f: Partial<ThemeFormat> & Pick<ThemeFormat, "summary" | "width" | "turns" | "speed" | "jumps">): ThemeFormat => ({
  heights: [-24, 24],
  net: [-24, 24],
  relief: [12, 48],
  descent: 0,
  climb: 48,
  straight: 99,
  surfaces: {},
  pads: 99,
  turbos: 99,
  braking: true,
  fast: true,
  budget: 28,
  ...f,
});

export const THEMES: Readonly<Record<ThemeName, Readonly<Theme>>> = {
  stade: {
    name: "stade", label: "Stade", palette: "stade", shoulder: { kind: "grass", share: 85 }, bumpy: [0, 0], zones: null,
    widths: { weights: { e: 1, n: 3, l: 6 }, changes: [1, 2] }, bankChance: 35, turboChance: 30, cut: false, relief: { hills: [1, 3], steep: 60 },
    jumpChance: 100, openChance: 0, cuveChance: 100, signature: "turboBank",
    figures: { favor: ["turbo-courbe", "saut-releve", "saut-paroi", "saut-virage", "descente-cuve-saut", "turbo-saut-releve", "plaque-virage", "chaine-turbo", "releve-contre", "esse-relevee"], ban: [...ICE, ...DIRT] },
    format: classic({ summary: "le spectacle : route large, vitesse, cuve et saut à chaque circuit, turbos", width: { main: "l", share: 0 }, turns: [0.1, 0.7], speed: { mean: [44, 50], peak: DEFAULT_PEAK }, jumps: { count: [1, 3], longGap: 0 } }),
  },
  rallye: {
    name: "rallye", label: "Rallye", palette: "desert", shoulder: { kind: "gravel", share: 75 }, bumpy: [1, 2], zones: { count: [3, 4], surfaces: [["dirt", 1]] },
    widths: { weights: { e: 8, n: 2, l: 0 }, changes: [2, 2] }, bankChance: 10, turboChance: 0, cut: false, relief: { hills: [1, 2], steep: 0 },
    jumpChance: 0, openChance: 0, cuveChance: 0, signature: "dirtStage",
    figures: {
      require: ["epingle-terre", "demi-tour-large"],
      favor: ["epingle-terre", "demi-tour-large", "changement-revetement", "slalom-route", "s-serre-large", "bosse-virage", "petit-saut", "virage-descente", "esse-relevee"],
      ban: [...ICE, ...CUVES, ...JUMPS, ...TURBOS, "freinage-epingle", "plaque-epingle", "crete-virage", "colline-raide", "descente-plaque", "coupe-virage", "plaque-virage", "colline-douce"],
    },
    format: {
      summary: "la spéciale : route étroite sur terre et gravier, virages enchaînés sans longues droites, bosses ; ni vide ni super turbo",
      heights: [-12, 12], net: [-12, 12], relief: [4, 12], descent: 0, climb: 8,
      width: { main: "e", share: 0.5 }, turns: [0.6, 2], straight: 3,
      speed: { mean: [34, 41], peak: 0 }, jumps: { count: [0, 0], longGap: 0 }, surfaces: { dirt: 0.3 },
      pads: 1, turbos: 0, braking: false, fast: false, budget: 32, count: [6, 8], caps: { technique: 8 }, signatureFirst: true, pace: 1.09,
    },
  },
  banquise: {
    name: "banquise", label: "Banquise", palette: "neige", shoulder: { kind: "snow", share: 70 }, bumpy: [0, 0], zones: { count: [2, 2], surfaces: [["ice", 3], ["dirt", 1]] },
    widths: { weights: { e: 0, n: 1, l: 10 }, changes: [2, 2] }, bankChance: 15, turboChance: 0, cut: false, relief: { hills: [0, 1], steep: 0 },
    jumpChance: 0, openChance: 0, cuveChance: 25, maxTight: 0, signature: "iceChicane",
    figures: {
      favor: ["slalom-glace", "chicane-glace", "glace-coupe-virage", "esse-relevee", "demi-tour-large", "slalom-route", "releve-contre"],
      ban: [...JUMPS, ...TURBOS, "etranglement-terre", "colline-raide", "crete-virage", "virage-aveugle", "descente-plaque"],
    },
    format: {
      summary: "la patinoire : tout plat, large, glace dominante, slaloms et grandes courbes en roue libre ; ni vide ni saut",
      heights: [-8, 8], net: [-8, 8], relief: [0, 8], descent: 0, climb: 8,
      width: { main: "l", share: 0.45 }, turns: [0.4, 1], straight: 99,
      speed: { mean: [33, 43], peak: 0 }, jumps: { count: [0, 0], longGap: 0 }, surfaces: { ice: 0.4 },
      pads: 2, turbos: 0, braking: false, fast: false, budget: 24, count: [4, 6],
    },
  },
  nuit: {
    name: "nuit", label: "Nuit", palette: "nuit", shoulder: { kind: "void", share: 30 }, bumpy: [0, 0], zones: null,
    widths: { weights: { e: 3, n: 4, l: 3 }, changes: [2, 3] }, bankChance: 20, turboChance: 25, cut: true, relief: { hills: [2, 3], steep: 60 },
    jumpChance: 100, openChance: 70, cuveChance: 100, signature: "cutRun",
    figures: { favor: ["descente-cuve-saut", "saut-paroi", "coupe-virage", "saut-virage", "double-saut", "virage-aveugle", "virage-descente", "turbo-epingle", "plaque-epingle"], ban: [...ICE, ...DIRT] },
    format: classic({ summary: "la nuit : vide en bas-côté, sections suspendues, turbos, moteur coupé, cuve et saut", width: { main: "n", share: 0 }, turns: [0.1, 0.7], speed: { mean: [41, 51], peak: DEFAULT_PEAK }, jumps: { count: [1, 3], longGap: 0 } }),
  },
  campagne: {
    name: "campagne", label: "Campagne", palette: "campagne", shoulder: { kind: "grass", share: 75 }, bumpy: [0, 0], zones: { count: [2, 3], surfaces: [["dirt", 2], ["grass", 1]] },
    widths: { weights: { e: 6, n: 3, l: 1 }, changes: [1, 2] }, bankChance: 10, turboChance: 0, cut: false, relief: { hills: [2, 3], steep: 40 },
    jumpChance: 40, openChance: 0, cuveChance: 0, signature: "dirtPinch",
    figures: { require: ["crete-virage", "virage-aveugle"], favor: ["etranglement-terre", "epingle-terre", "changement-revetement", "virage-aveugle", "crete-virage", "virage-descente", "freinage-epingle", "pincement"], ban: [...ICE, ...CUVES] },
    format: classic({ summary: "la campagne : route étroite, collines et virages aveugles, terre et herbe", width: { main: "e", share: 0 }, turns: [0.15, 0.9], speed: { mean: [38, 47], peak: DEFAULT_PEAK }, jumps: { count: [0, 3], longGap: 0 } }),
  },
  canyon: {
    name: "canyon", label: "Canyon", palette: "canyon", shoulder: { kind: "sand", share: 80 }, bumpy: [0, 0], zones: { count: [1, 2], surfaces: [["sand", 1]] },
    widths: { weights: { e: 0, n: 1, l: 10 }, changes: [2, 2] }, bankChance: 5, turboChance: 40, cut: false, relief: { hills: [1, 3], steep: 60 },
    jumpChance: 100, openChance: 35, cuveChance: 85, maxTight: 0, signature: "rockJump",
    figures: {
      // Lot 25 : des favorites que les plafonds laissent passer (une seule figure de saut en plus de la signature) : turbos, sauts, grandes collines.
      favor: ["turbo-courbe", "chaine-turbo", "saut-simple", "saut-releve", "descente-plaque", "colline-raide"],
      ban: [...ICE, ...DIRT, "cuve-droite", "saut-etroit"],
    },
    format: {
      summary: "les grands espaces : route large, longues droites et courbes amples prises à fond, super turbos, deux sauts au-dessus des ravins dont un long",
      heights: [-24, 24], net: [-24, 24], relief: [12, 48], descent: 0, climb: 48,
      width: { main: "l", share: 0.5 }, turns: [0, 0.3], straight: 99, plain: 9,
      speed: { mean: [47, 58], peak: DEFAULT_PEAK }, jumps: { count: [2, 3], longGap: 2 }, surfaces: {},
      pads: 99, turbos: 99, braking: true, fast: true, budget: 30, grand: true, count: [4, 5], techniques: 0, pace: 0.85,
    },
  },
  col: {
    name: "col", label: "Col alpin", palette: "alpin", shoulder: { kind: "snow", share: 60 }, bumpy: [0, 0], zones: { count: [0, 1], surfaces: [["ice", 1]] },
    widths: { weights: { e: 2, n: 5, l: 3 }, changes: [1, 2] }, bankChance: 30, turboChance: 0, cut: false, relief: { hills: [3, 4], steep: 85 },
    jumpChance: 0, openChance: 100, cuveChance: 0, signature: "switchbacks",
    figures: { favor: COL_FIGURES.filter((n) => n !== "lacets"), ban: FIGURES.map((f) => f.name).filter((n) => !COL_FIGURES.includes(n)) },
    format: {
      summary: "la descente : départ en haut, arrivée tout en bas, la vitesse vient de la pente, lacets à freinage franc, sections sans rebords au-dessus du vide",
      heights: [-300, 4], net: [-300, -40], relief: [40, 300], descent: 0.7, climb: 4, finishLow: true,
      width: { main: "n", share: 0 }, turns: [0.25, 0.6], straight: 99,
      speed: { mean: [44, 52], peak: 70 }, jumps: { count: [0, 0], longGap: 0 }, surfaces: {},
      pads: 99, turbos: 0, braking: true, fast: true, budget: 26, count: [4, 5], pace: 1,
    },
  },
  ville: {
    name: "ville", label: "Ville", palette: "ville", shoulder: { kind: "gravel", share: 0 }, bumpy: [0, 0], zones: null,
    widths: { weights: { e: 5, n: 5, l: 0 }, changes: [1, 2] }, bankChance: 0, turboChance: 20, cut: false, relief: { hills: [1, 2], steep: 30 },
    jumpChance: 30, openChance: 0, cuveChance: 0, maxTight: 4, signature: "rightAngles",
    figures: { require: ["u-urbain", "freinage-epingle", "plaque-epingle", "turbo-epingle", "s-serre-large"], favor: ["chicane-angles", "u-urbain", "freinage-epingle", "plaque-epingle", "turbo-epingle", "s-serre-large", "pincement", "slalom-route", "virage-descente"], ban: [...ICE, ...DIRT, ...CUVES, "saut-etroit"] },
    format: classic({ summary: "la ville : route étroite entre des murs, angles droits, gros freinages", width: { main: "e", share: 0 }, turns: [0.15, 0.9], speed: { mean: [40, 49], peak: DEFAULT_PEAK }, jumps: { count: [0, 3], longGap: 0 } }),
  },
};
/** Thème de la journée : tiré de la date (graine = jour UTC), identique pour tout le monde. */
export function themeForDay(day: number): Theme {
  return THEMES[THEME_NAMES[new Rng(mixSeed(day, 0x70a1)).int(THEME_NAMES.length)]!];
}

export function paletteForDay(day: number): PaletteName {
  return themeForDay(day).palette;
}

/** Thème demandé par un nom (`?theme=banquise`), ou `null`. */
export function themeByName(name: string | null | undefined): Theme | null {
  return name && (THEME_NAMES as readonly string[]).includes(name) ? THEMES[name as ThemeName] : null;
}
