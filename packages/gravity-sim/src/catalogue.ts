import type { ThemeGravity } from "./themes";

// LE CATALOGUE DES MOTIFS (lot GR7) : **ce que le générateur sait poser dans un morceau de gravité**, avec pour chacun sa difficulté (de 1 à 5), son nombre de variantes, le danger qu'il porte, le rang de thème à partir
// duquel il peut sortir. Ce fichier ne contient que des données (le plan du jour les lit pour choisir : `plan.ts`) ; la construction de chaque motif est dans `motifs.ts`.
//
// **Une variante** est une combinaison de paramètres du même motif (longueur, hauteur, répétitions, côté du danger, miroir) : `variantes` en donne le nombre, la construction la lit (`v` de 0 à `variantes − 1`). **Un motif distinct** est un
// identifiant d'ici (`special-<thème>` compte un motif par thème). Les **morceaux de section** (avion, onde, ressort, avec ou sans danger) ont leurs identifiants plus bas : ils sont posés par `sections.ts`, jamais piochés.

/** Les trois dangers du GR7. Place laissée au GR8 : `ecraseurs`, `mobiles` (plateformes), `projectiles`. */
export type Danger = "scies" | "fragiles" | "lasers";
export const DANGERS: readonly Danger[] = ["scies", "fragiles", "lasers"];
/** Le rang de thème (0 à 4) où chaque danger est introduit dans la première boucle (seed : 2e thème les scies, 3e les sols fragiles et les lasers). */
export const RANG_D_INTRODUCTION: Readonly<Record<Danger, number>> = { scies: 1, fragiles: 2, lasers: 2 };

export interface Meta {
  id: string;
  /** La difficulté, de 1 (facile) à 5 (le plus tendu). */
  diff: 1 | 2 | 3 | 4 | 5;
  /** Le nombre de variantes (≥ 2). */
  variantes: number;
  /** Le danger rouge que le motif porte (il ne sort pas avant son introduction), ou null. */
  danger: Danger | null;
  /** Un motif **de plusieurs dangers** : il ne sort qu'à partir du 4e thème de la première boucle (« ensuite, tout se combine »). */
  combine?: true;
  /** La case spéciale d'un thème : le motif ne sort que dans ce thème. */
  theme?: ThemeGravity;
  /** Un passage technique : un portail de vitesse ne le précède que pour ralentir. */
  technique: boolean;
  /** Le motif ne tient pas à grande vitesse (`vite` : au-delà de 10 cases/s environ) : le plan ne le pioche pas alors. */
  pasVite?: true;
  /** Le motif ne se pose pas **à grande vitesse** juste après l'un de ceux-là : leur dernier vol atterrit dans le morceau suivant, il n'y reste plus la place de se préparer (les îlots, lot GR2). */
  pasApres?: readonly string[];
  /** La vitesse (cases par seconde) en dessous de laquelle le motif n'est pas posé : les îlots au-dessus de piques ne tiennent pas dans les premiers mètres (8 cases/s). */
  vmin?: number;
  /** Le poids du tirage (100 par défaut). */
  poids?: number;
}

/** Les motifs dont le dernier vol atterrit dans le morceau d'après. */
const ATTERRISSENT_APRES: readonly string[] = ["etages", "milieu", "escalier", "escalierPiques"];
const m = (id: string, diff: Meta["diff"], variantes: number, technique: boolean, extra: Partial<Meta> = {}): Meta => ({ id, diff, variantes, danger: null, technique, ...extra });

/** Les motifs de gravité piochés par le plan. `calme` n'y est pas (les trois premiers morceaux et les morceaux d'avant et d'après une section) ; `souffle` non plus (la vague le pose). */
export const MOTIFS: readonly Meta[] = [
  // Ceux d'avant le GR7, avec des variantes et un danger sur le côté d'où l'on arrive.
  m("trou", 1, 6, false),
  m("pilier", 2, 6, false),
  m("pics", 2, 6, false),
  m("zigzag", 2, 6, true),
  m("milieu", 2, 4, true),
  m("escalier", 3, 4, true, { pasVite: true }),
  m("etages", 3, 4, true),
  m("ilots", 3, 6, true, { pasApres: ATTERRISSENT_APRES }),
  m("special-usine", 2, 4, true, { theme: "usine", poids: 160 }),
  m("special-glace", 2, 4, true, { theme: "glace", poids: 160 }),
  m("special-foret", 3, 4, true, { theme: "foret", poids: 160 }),
  m("special-nuit", 3, 6, true, { theme: "nuit", poids: 160 }),
  m("special-neon", 4, 6, true, { theme: "neon", poids: 160 }),
  // Nouveaux motifs qui combinent l'existant.
  m("couloirPiques", 3, 6, false),
  m("fauxChemin", 2, 4, true),
  m("ilotsPiques", 3, 6, true, { vmin: 9, pasApres: ATTERRISSENT_APRES }),
  m("slalom", 4, 6, true),
  m("pilierDouble", 3, 4, false),
  m("gouffre", 3, 3, false),
  m("escalierPiques", 4, 4, true, { pasVite: true }),
  m("inversionsRapides", 4, 3, true, { pasVite: true }),
  // Les scies (2e thème).
  m("scieSol", 2, 6, true, { danger: "scies" }),
  m("scieVerticale", 3, 6, true, { danger: "scies" }),
  m("sciesAlternees", 4, 6, true, { danger: "scies" }),
  m("scieIlots", 4, 4, true, { danger: "scies", pasApres: ATTERRISSENT_APRES }),
  // Les sols fragiles (3e thème).
  m("fragilePont", 2, 6, true, { danger: "fragiles" }),
  m("fragileIlots", 3, 6, true, { danger: "fragiles", pasApres: ATTERRISSENT_APRES }),
  m("fragileRelais", 4, 4, true, { danger: "fragiles", pasVite: true }),
  // Les lasers (3e thème).
  m("laserSimple", 2, 6, true, { danger: "lasers" }),
  m("laserDouble", 3, 6, true, { danger: "lasers" }),
  m("laserEscalier", 4, 4, true, { danger: "lasers" }),
  m("laserRafale", 5, 4, true, { danger: "lasers" }),
  // Les motifs de plusieurs dangers (4e thème et après).
  m("piquesScies", 5, 4, true, { danger: "scies", combine: true }),
  m("fragileLaser", 5, 4, true, { danger: "fragiles", combine: true }),
  m("laserScies", 5, 4, true, { danger: "lasers", combine: true }),
];
export const META: ReadonlyMap<string, Meta> = new Map(MOTIFS.map((x) => [x.id, x]));

/** Les morceaux de repos : posés par la vague, jamais piochés. */
export const SOUFFLE: Meta = m("souffle", 1, 4, false);
export const CALME: Meta = m("calme", 1, 1, false);

/** Les sections à mode : le mode, avec ou sans danger. Ils sont comptés comme des motifs distincts. */
export const MOTIFS_DE_SECTION: readonly string[] = ["avion", "onde", "ressort", "avion+scies", "avion+lasers", "onde+lasers", "onde+scies", "ressort+scies", "ressort+lasers"];

/** Tous les motifs que le générateur peut poser (les mesures et le test de la liste les comptent). `trou` se nomme `trouBas` ou `trouHaut` selon le côté d'où l'on arrive. */
export const TOUS_LES_MOTIFS: readonly string[] = [
  "calme",
  "souffle",
  "transition",
  "trouBas",
  "trouHaut",
  ...MOTIFS.filter((x) => x.id !== "trou").map((x) => x.id),
  ...MOTIFS_DE_SECTION,
];
