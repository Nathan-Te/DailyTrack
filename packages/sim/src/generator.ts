import { circuitNumber } from "./calendar";
import { PILOT_GRIPS, bestPilotRun, runPilot, withCut } from "./autopilot";
import { DEFAULT_CAR_PARAMS } from "./car";
import { SIM_VERSION } from "./constants";
import type { Replay } from "./replay";
import { createTestTrack } from "./circuits";
import { Rng, daysFromCivil, formatDay, mixSeed } from "@cdj/core";
import { GENERATOR_SAC_THEMES, dailyTrackId, generatorVersionOf } from "./dailyId";
import { SALON_SEED_BASE } from "./salon";
import { medalsFor, type Medals } from "./medals";
import { MAX_BRAKING_ADD, secureBraking } from "./braking";
import { MAX_TIGHT, maxTightOf, themeAncien, themeByName, themeForDay, type PaletteName, type Signature, type Theme, type ThemeName } from "./themes";
import { FICHES_V21, GENERATOR_GRAMMAIRE, POIDS_RYTHME, themeOfVersion, type Etiquette, type Poids } from "./themesVersion";
import { GENERATOR_RYTHMES, rythmeDuJour, type Rythme } from "./rythmes";
import { motifsBoostSerre } from "./variete";
import { classerSauts, combinaison, sautDansLAxe } from "./sautsClasse";
import { sautsDansLAxe, technicite } from "./technicite";
import { FIGURES, buildFigure, estimateSeconds, minTightTurns, figureByName, figureSeconds, hillRise, surfaceMod, transition, widthAfter, withMod, type Figure, type FigureCategory } from "./figures";
import { FX_CRUISE, FX_FRAGILE, FX_NO_BRAKE, FX_NO_STEER, FX_RESET, blockCells, cellKey, curveSize, exitDelta, isCurve, isWide, parseTokenLu, parseTrack, turnsLeft, type BlockSurface, type Dir, type Track, type WidthLetter } from "./track";

// Le circuit du jour : généré à partir de la date (graine = jour UTC), identique pour tout le monde.
//
// 1. Construction (lot 20) : on assemble 5 à 7 **figures** de la bibliothèque (figures.ts) — techniques, sauts techniques, portions rapides,
//    combinaisons, cuves, reliefs — choisies selon le thème (signature, favorites, interdites, saut et cuve selon ses chances), jamais deux
//    fois la même, sans les figures « au repos » ce jour-là (voir `isRested`), puis posées sur la grille en refusant les croisements.
//    Le détail est dans `composeFigures`. Règles gardées des lots précédents : au plus deux virages serrés, jamais l'un derrière l'autre ni
//    sur la route large ; au moins deux largeurs de route ; dénivelé d'au moins 12 m ; sections sans rebords sur les parties surélevées
//    (lot 17) ; zones de revêtement (lot 8).
// 2. Validation : un pilote automatique parcourt le circuit avec la même physique. S'il ne le finit pas, ou si
//    sa durée sort de la fenêtre visée, on recommence avec une graine voisine (tentative suivante).
// 3. Le temps du pilote est le temps de l'auteur ; les médailles en découlent.
// Lot 34 (générateur v16, à partir du 28/10/2026) : après une plaque, un super turbo ou une portion rapide, le virage suivant se freine
// (`secureBraking`, braking.ts) ; au plus un virage-piège par circuit (passage signature, Ville). Les jours d'avant gardent la v15.
// Lot 48 (générateur v17, à partir du 04/11/2026) : la Campagne roule sur l'herbe de course (`themeOfVersion`, themes.ts ; figures `since`).
// Lot 49 (générateur v18) : les fiches d'identité des thèmes (favorites, vedettes à tour de rôle, interdits), les douze
// nouvelles figures, et la variété garantie entre deux circuits consécutifs d'un même thème (`themeOccurrence`, `orderFigures`).
// Lot V2 (générateur v21) : le rythme du jour (`rythmeDuJour`, rythmes.ts) et la fiche du biome (`FICHES_V21`, themesVersion.ts) multiplient les poids des figures ; le motif
// « boost → longue ligne droite → virage serré » (`motifsBoostSerre`, variete.ts) n'est permis qu'un jour rapide, une fois ; une fiche peut plafonner la ligne droite libre.

export * from "./medals";
export * from "./dailyId";

/** Durée visée du pilote : 30 à 40 s, pour qu'une course correcte (or ≈ ×1,08) tienne en 30 à 45 s. */
export const AUTHOR_MIN_MS = 30_000;
export const AUTHOR_MAX_MS = 40_000;
export const MAX_ATTEMPTS = 40;
/**
 * Lot V1 (v20) : le sac de thèmes donne à chaque date un thème que le tirage d'avant ne lui aurait pas donné ; mesuré sur 365 jours, un seul (Banquise, 02/12/2026) épuisait
 * les 40 tentatives sans circuit valide. À partir de la v20 le budget est de 120 tentatives (comme celui de Jump, `DAILY_MAX_ATTEMPTS_V4`) ; **une ancienne version garde
 * 40** : un jour qui a trouvé son circuit à la tentative k le trouve à la même, et un jour de secours d'une ancienne version ne change pas.
 */
export const MAX_ATTEMPTS_SAC = 120;
/** Lot 57b (v23) : les règles de variété des sauts (un seul saut « droite → tremplin → axe », jamais deux de même combinaison) refusent plus de tentatives ; quelques jours (un Stade du 01/02/2028, mesuré) n'en tenaient aucune en 120. */
export const MAX_ATTEMPTS_23 = 360;
/** Lot 57b (v23) : les dernières tentatives d'un jour ne tiennent plus les règles de variété des sauts (un circuit un peu moins varié vaut mieux que le circuit de secours : mesuré, un Nuit sur 480 y arrivait). */
const TENTATIVES_LIBRES = 180;
const maxAttempts = (generator: number): number => (generator >= GENERATOR_GRAMMAIRE ? MAX_ATTEMPTS_23 : generator >= GENERATOR_SAC_THEMES ? MAX_ATTEMPTS_SAC : MAX_ATTEMPTS);
/**
 * Vitesse que le pilote doit dépasser au moins une fois (lot 15) : 30 % au-dessus de la pointe du plat. Un circuit sans
 * portion rapide (descente, turbos, grande courbe prise à fond) est refusé, graine voisine.
 */
export const FAST_PEAK = DEFAULT_CAR_PARAMS.maxSpeed * 1.3;

/**
 * Écart-type de l'estimation (`estimateSeconds`) autour de la durée du pilote (≈ 0,95 × l'estimation sur 60 jours) : un circuit estimé au-delà de
 * `ESTIMATE_MAX` ou en deçà de `ESTIMATE_MIN` n'a aucune chance d'entrer dans la fenêtre 30–40 s, on le refuse sans faire rouler le pilote (4 courses).
 */
const ESTIMATE_MIN = 30;
const ESTIMATE_MAX = 44;
/** Lot 57b (v23) : durée estimée au plus sur les `TENTATIVES_GRAMMAIRE` premières tentatives — mesuré (150 circuits) : au-delà de 41 s estimées, moins d'un circuit sur dix tient dans les 40 s du pilote, et la course d'essai coûte ≈ 35 ms ; les tentatives de repli reprennent les 44 s d'avant (certains jours n'ont aucun circuit sous 41 s). */
const ESTIMATE_MAX_23 = 41;
/**
 * Lot 49 (v18) : la première des courses du pilote (adhérence la plus haute, sur le fond) roule seule d'abord ; si elle finit plus de `QUICK_SLACK_MS`
 * au-delà de la fenêtre, la tentative est refusée sans les autres (une adhérence plus basse ou la paroi d'une cuve ne gagnent presque jamais autant :
 * mesuré, voir le README du lot). La v18 refuse plus de tentatives (thèmes sans super turbo, glace sous-estimée) : sans ce tri, le pire jour de
 * génération dépassait la limite du test de durée en CI (3,6 s contre 3,5).
 */
const QUICK_SLACK_MS = 500;

// --- Construction -----------------------------------------------------------------------------

interface Walk {
  cx: number;
  cz: number;
  dir: Dir;
  y: number;
  cells: Set<number>;
  tokens: string[];
}

/** Pose des blocs à la suite ; renvoie faux (et ne change rien) si l'un d'eux tombe sur une cellule prise. */
function place(w: Walk, tokens: readonly string[]): boolean {
  let { cx, cz, dir, y } = w;
  const added: number[] = [];
  for (const t of tokens) {
    const parsed = parseTokenLu(t);
    const kind = parsed.kind;
    const placed = blockCells(cx, cz, dir, kind);
    for (const [x, z] of placed.cells) {
      const key = cellKey(x, z);
      if (w.cells.has(key)) {
        for (const k of added) w.cells.delete(k);
        return false;
      }
      w.cells.add(key);
      added.push(key);
    }
    y += exitDelta(kind, parsed.rise);
    ({ cx, cz, dir } = placed.next);
  }
  w.cx = cx;
  w.cz = cz;
  w.dir = dir;
  w.y = y;
  w.tokens.push(...tokens);
  return true;
}

/** Hauteurs permises (m) de la route par rapport au départ : au-delà, la prochaine colline repart dans l'autre sens ou la tentative échoue. */
const Y_MIN = -24;
const Y_MAX = 24;
/** Dénivelé minimal d'un circuit (m, du point le plus bas au plus haut) : trois niveaux. */
export const MIN_RELIEF = 12;
/** Une section sans rebords ne se pose que sur une route au moins aussi haute (m au-dessus du point le plus bas) : le risque de tomber doit être réel. */
const OPEN_MIN_HEIGHT = 6;

/** Virages serrés (une cellule, rayon 16 m) : au plus `MAX_TIGHT` (2) par circuit, 4 dans Ville (lot 22), jamais deux d'affilée. */
export { MAX_TIGHT };
/**
 * Figures par circuit : 5 à 7 (lot 20), dans un budget de durée : chaque figure pèse sa durée estimée (`figureSeconds`, figures.ts : un virage
 * large coûte deux fois une droite), et on n'en ajoute (au-delà de cinq) que tant que le total reste sous `FIGURE_BUDGET`. Sans cela, sept
 * figures donneraient un circuit de 50 s ; la fenêtre visée (30–40 s) correspond à ≈ 38 unités (le pilote met 3,9 s + 0,78 × l'estimation).
 */
const FIGURES_MIN = 5;
const FIGURES_SPAN = 3;
const FIGURE_BUDGET = 28;
/** Durée estimée maximale des figures d'un circuit : au-delà, on retire d'autres figures (jusqu'à `SELECTION_TRIES` fois). */
const FIGURE_TOTAL_MAX = 31;
const SELECTION_TRIES = 8;
/** Lot 57b (v23) : plus de tirages de figures par tentative (un tirage ne coûte presque rien devant une course du pilote) : avec le saut et la transition de la grammaire en plus, peu de tirages tiennent dans le budget de durée. */
const SELECTION_TRIES_23 = 12;
/**
 * Lot 34 (v16) : les droites de freinage ajoutées (≈ 2,3 par circuit, ≈ 1,6 s) se prennent en partie sur le budget des figures. Mesuré
 * (`npm run measure:generator`, validation par thème) : 1 unité garde la part des circuits dans la fenêtre de l'avant-lot (63 → 65 %) ;
 * 2 la montaient à 68 % mais retiraient trop de virages larges et de figures favorites (Banquise sous son seuil, README du lot 34).
 */
const BRAKING_BUDGET = 1;

/** Dénivelé d'un circuit (m, du point le plus bas au plus haut de la route) : le critère `MIN_RELIEF`. */
export function reliefOf(tokens: readonly string[]): number {
  return hillRise(tokens);
}

/** Vrai si la suite de blocs, posée à la hauteur `y`, reste entre `Y_MIN` et `Y_MAX`. */
function fits(y: number, seg: readonly string[]): boolean {
  let h = y;
  for (const t of seg) {
    const p = parseTokenLu(t);
    h += exitDelta(p.kind, p.rise);
    if (h > Y_MAX || h < Y_MIN) return false;
  }
  return y <= Y_MAX && y >= Y_MIN;
}

const WIDTH_LETTERS: readonly WidthLetter[] = ["e", "n", "l"];
/** Une transition passe à la largeur voisine (14 ↔ 20 ↔ 26 m) : jamais de saut de 12 m en un bloc. */
const NEXT_WIDTHS: Record<WidthLetter, readonly WidthLetter[]> = { e: ["n"], n: ["e", "l"], l: ["n"] };

function pickWidth(rng: Rng, weights: Record<WidthLetter, number>, among: readonly WidthLetter[]): WidthLetter {
  let roll = rng.int(among.reduce((sum, w) => sum + weights[w], 0));
  for (const w of among) {
    if (roll < weights[w]) return w;
    roll -= weights[w];
  }
  return among[0]!;
}

/** Nombre de virages serrés (une cellule) d'une suite de blocs. */
const tightCount = (tokens: readonly string[]) => tokens.filter((t) => {
  const k = parseTokenLu(t).kind;
  return isCurve(k) && !isWide(k);
}).length;

// --- Composition par figures (lot 20) ---------------------------------------------------------

/** Figure du passage signature de chaque thème : le circuit la contient toujours. */
export const SIGNATURE_FIGURE: Readonly<Record<Signature, string>> = {
  turboBank: "turbo-courbe",
  dirtJump: "saut-terre",
  iceChicane: "chicane-glace",
  cutRun: "coupe-virage",
  dirtPinch: "etranglement-terre",
  rockJump: "paroi-long-saut",
  switchbacks: "lacets",
  rightAngles: "chicane-angles",
};

/** Une figure posée dans un circuit : blocs `[from, to)` de la liste du circuit. */
export interface PlacedFigure {
  name: string;
  variant: number;
  /** Vrai si le premier virage est à gauche (le miroir de la variante d'origine sinon). */
  left: boolean;
  from: number;
  to: number;
}

export interface Composition {
  spec: string;
  figures: PlacedFigure[];
  /** Lot 34 (v16) : ce que la règle de freinage a fait (pièges gardés, droites ajoutées, bas-côtés imposés). */
  braking: { kept: number; added: number; escapes: number };
}

/** Plafonds de composition : pas plus de deux sauts, une cuve, un moteur coupé ; au plus quatre techniques, deux de chaque autre catégorie. */
const CAP_JUMPS = 2;
const CAP_CUVES = 1;
const CAP_CUTS = 1;
const CAP_CATEGORY: Record<FigureCategory, number> = { technique: 4, saut: 2, rapide: 2, combo: 1, cuve: 1, relief: 2 };
/** Au moins deux techniques par circuit (signature comprise) : c'est là que le pilote lâche l'accélérateur et freine. */
const MIN_TECHNIQUES = 2;
const FAVOR = 4;
/** Une figure favorite peut dépasser le budget de durée de ce que vaut un virage large : c'est la couleur du thème. */
const FAVORITE_SLACK = 4;
/** Au moins une figure à freinage franc par circuit (signature comprise), et elles sont tirées deux fois plus souvent. */
const MIN_BRAKING = 1;

/** Lot 57b (v23) : un saut qui demande un geste — un saut de la grammaire, ou une figure de saut dont aucun saut n'est « droite → tremplin → axe » et qui en demande au moins un (`technicite`). */
const sautTechnique = (f: Figure): boolean => !!f.jump && (!!f.grammaire || (sautsDansLAxe(f).max === 0 && technicite(f) >= 1));

/** Lot 57b (v23) : le tour d'un circuit dans la grammaire — le saut et la transition que son numéro d'apparition lui donne (le nom, ou `""` si le thème n'en a pas). */
interface Tour23 {
  saut: string;
  transition: string;
  /** Les tentatives « allégées » (après `TENTATIVES_GRAMMAIRE`) : une transition seule, sans saut de la grammaire exigé. */
  allege?: boolean;
}
/** Lot 57b (v23) : au plus un saut « ligne droite → tremplin → réception dans l'axe » par circuit. */
const MAX_SAUTS_AXE = 1;
/** Lot 57b (v23) : le budget de technicité d'un circuit — la somme des gestes que ses sauts et ses transitions demandent (`technicite`, technicite.ts). Mesuré : voir le README du lot 57b. */
export const TECHNICITE_MAX = 8;

/**
 * Lot 57b (v23) — **les règles de variété des sauts**, sur une suite de blocs (un circuit fini, ou en cours de pose) : `null` si elles sont tenues, sinon la faute — plus d'un saut
 * « droite → tremplin → axe » (`sautDansLAxe`), ou deux sauts de la même combinaison (approche, appel, vol, réception, sortie). `reserve` : les sauts « droite → tremplin → axe »
 * que les figures encore à poser ne peuvent éviter (leur minimum, `sautsDansLAxe`) : une figure posée avant elles ne prend pas leur place.
 */
export function fauteSauts(tokens: readonly string[], reserve = 0): string | null {
  // Un circuit en cours de pose n'a pas encore son repère de départ.
  const t = tokens.length > 0 && !tokens[0]!.includes("@") ? [`${tokens[0]!}@start`, ...tokens.slice(1)] : [...tokens];
  while (t.length > 1 && !/^S(\/[^@]*)?(@[a-z]+)?$/.test(t[t.length - 1]!)) t.pop();
  if (!t[t.length - 1]!.includes("@finish")) t[t.length - 1] = `${t[t.length - 1]!.split("@")[0]!}@finish`;
  const sauts = classerSauts(parseTrack("sauts", t.join(" ")));
  if (sauts.filter(sautDansLAxe).length + reserve > MAX_SAUTS_AXE) return "plusieurs sauts droite → tremplin → axe";
  const cles = sauts.map(combinaison);
  if (new Set(cles).size < cles.length) return "deux sauts de la même combinaison";
  return null;
}

/** Empreinte stable d'un nom (FNV-1a) : sert à répartir les figures en trois groupes pour la rotation par jour. */
function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Rotation par jour, sans générer les jours précédents : chaque figure appartient à l'un de trois groupes (par son nom) ; le jour `d`
 * laisse « au repos » le groupe `d mod 3`. Deux jours de suite n'ont donc en commun que le tiers des figures, et chaque figure reprend
 * du service au bout de deux jours. La figure signature d'un thème n'est jamais au repos.
 */
export const isRested = (name: string, day: number): boolean => nameHash(name) % 3 === (((day % 3) + 3) % 3);

/** Les étiquettes d'une figure (lot V2) : sa catégorie et ses drapeaux, ce que les poids du rythme et du biome regardent. */
function etiquettes(f: Figure): Etiquette[] {
  const out: Etiquette[] = [f.category];
  if (f.braking) out.push("braking");
  if (minTightTurns(f) > 0) out.push("tight");
  if (f.jump) out.push("jump");
  if (f.relief) out.push("relief");
  if (f.banked) out.push("banked");
  if (f.turbo) out.push("turbo");
  return out;
}
/** Le multiplicateur d'une figure (lot V2, v21) : le produit des poids de ses étiquettes, pour chaque table donnée (rythme, biome). */
function facteur(f: Figure, tables: readonly Poids[]): number {
  let k = 1;
  for (const e of etiquettes(f)) for (const t of tables) k *= t[e] ?? 1;
  return k;
}

/** Poids d'une figure dans le tirage : favorite du thème ×4, super turbo et virages relevés selon les chances du thème ; lot V2 (v21) : × rythme et biome (`poids`). */
function figureWeight(f: Figure, theme: Theme, poids?: readonly Poids[]): number {
  let w = f.weight ?? 10;
  if (theme.figures.favor.includes(f.name)) w *= FAVOR;
  // Lot 49 (v18, thèmes à vedettes) : un freinage franc est déjà exigé ; doublé en plus, il faisait revenir les mêmes plaques dans tous les thèmes.
  if (f.braking && !theme.figures.vedettes) w *= 2;
  if (f.turbo) w += Math.round(theme.turboChance / 3);
  if (f.banked) w += Math.round(theme.bankChance / 4);
  return poids ? Math.max(1, Math.round(w * facteur(f, poids))) : w;
}

const motifFigures = new Map<string, boolean>();
/** Lot V2 : vrai si chaque variante de la figure (les trois largeurs) fait le motif « boost → longue ligne droite → virage serré » (`turbo-epingle`, `plaque-epingle`). */
export function toujoursMotif(f: Figure): boolean {
  let v = motifFigures.get(f.name);
  if (v === undefined) {
    v = true;
    for (let k = 0; k < f.variants && v; k++) for (const w of WIDTH_LETTERS) {
      const b = buildFigure(f, true, w, k);
      if (b && motifsBoostSerre(b) === 0) v = false;
    }
    motifFigures.set(f.name, v);
  }
  return v;
}

/** Une figure propre à des thèmes (`only`, lot 22) ne sort que chez eux. */
const ownedBy = (f: Figure, theme: Theme): boolean => !f.only || f.only.includes(theme.name) || !!theme.figures.aussi?.includes(f.name);
/** Une figure plus récente que le générateur (`since`, lot 48) n'existe pas pour lui : ses circuits ne changent pas. */
const knownBy = (f: Figure, generator: number): boolean => f.since === undefined || generator >= f.since;

/** Lot V2 : durée estimée (s) d'un freinage franc « court » (`plaque-virage`, `plaque-epingle`, `turbo-epingle` ; pas les turbos enchaînés ni la descente). */
const BRAKING_SHORT = 6;

const isFast = (f: Figure) => f.category === "rapide" || !!f.turbo;

/** Figures d'un circuit, dans le désordre : signature, relief, saut, cuve, portion rapide, techniques, puis le reste au poids. */
function selectFigures(rng: Rng, theme: Theme, day: number, count: number, wants: { jump: boolean; cuve: boolean }, budget: number, generator: number, vedette: string | null, poids?: readonly Poids[], sansMotif = false, sansFreinage = false, blocs?: readonly string[], tourBloc?: string, gram?: Tour23, regles23 = false, avecTransition = true): Figure[] | null {
  const banned = new Set(theme.figures.ban);
  const signature = figureByName(SIGNATURE_FIGURE[theme.signature])!;
  const chosen: Figure[] = [signature];
  const names = new Set([signature.name]);
  const required = new Set(theme.figures.require ?? []);
  const requiredAlso = new Set(theme.figures.requireAlso ?? []);
  // Les figures obligatoires du thème (lot 21) ne sont jamais au repos, comme la signature.
  // Lot 49 (v18) : la vedette du jour n'est jamais au repos ; les autres vedettes du thème attendent leur tour (`vedetteOf`).
  // Lot V2 (v21) : un jour où le motif « boost → longue ligne droite → virage serré » n'est pas permis, une figure qui le fait dans toutes ses variantes n'est pas tirée.
  // Lot 58 (v22) : une famille de blocs nouveaux ne sort que par son tour (`tourBloc`, ci-dessous) ou comme vedette — tirée comme les autres figures, le mur
  // roulable revenait comme cuve de la Nuit et du Stade presque chaque jour (la ressemblance d'un thème montait).
  const usable = (f: Figure) => !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator) && !otherVedette(f, theme, vedette) && !(sansMotif && toujoursMotif(f)) && (!f.bloc || f.name === vedette) && (!f.grammaire || f.name === vedette);
  // Lot V2 (v21) : « plaque puis virage », la plus courte des portions rapides sans épingle, se repose aussi un jour de repos sur deux (sinon elle était de 53 % des circuits).
  const reposPlus = (f: Figure) => generator >= GENERATOR_RYTHMES && f.name === "plaque-virage" && (((day % 2) + 2) % 2 === 1);
  const pool = FIGURES.filter((f) => usable(f) && (required.has(f.name) || requiredAlso.has(f.name) || f.name === vedette || (!isRested(f.name, day) && !reposPlus(f))));
  // Lot 49 (v18) : sans super turbo, un thème n'a que trois ou quatre figures de freinage franc ou de portion rapide ; si toutes sont au repos ce jour-là,
  // on en prend une qui l'est (sinon aucune tentative du jour n'aboutit : mesuré au Rallye et à la Campagne).
  const rested = generator >= 18 ? FIGURES.filter((f) => usable(f) && !pool.includes(f)) : [];
  const count_ = (pred: (f: Figure) => boolean) => chosen.filter(pred).length;
  // Lot 57b (v23) : ce que les figures déjà choisies posent de sauts « droite → tremplin → axe » (au moins) et de technicité (la signature comprise).
  let axeMin = sautsDansLAxe(signature).min;
  let technicitePosee = technicite(signature);
  const allowed = (f: Figure, optimiste = false) =>
    !names.has(f.name) &&
    // Lot 57b (v23) : les sauts de la grammaire ont leur place à part (un de plus que les deux permis) : un thème dont la signature et la vedette sont des sauts n'en aurait plus.
    (!f.jump || count_((g) => !!g.jump && !g.grammaire) < CAP_JUMPS || (!!f.grammaire && regles23 && count_((g) => !!g.grammaire && !!g.jump) < 1)) &&
    (!f.cuve || count_((g) => !!g.cuve) < CAP_CUVES) &&
    (!f.cut || count_((g) => !!g.cut) < CAP_CUTS) &&
    chosen.reduce((sum, g) => sum + minTightTurns(g), 0) + minTightTurns(f) <= maxTightOf(theme) &&
    count_((g) => g.category === f.category && !g.grammaire) < CAP_CATEGORY[f.category] + (f.grammaire && regles23 ? 1 : 0) &&
    // Lot 57b (v23) : au plus un saut « droite → tremplin → axe » par circuit et le budget de technicité. Les figures déjà choisies comptent au mieux (leur variante sans tel saut suffit :
    // la pose choisit celle-là, `fauteSauts` avec sa réserve) ; le tirage libre compte au pire (une figure qui peut poser un tel saut en pose un), sauf la signature, la vedette et la
    // famille de blocs (`optimiste`), que le thème impose.
    (!regles23 || (axeMin + (optimiste ? sautsDansLAxe(f).min : sautsDansLAxe(f).max) <= MAX_SAUTS_AXE && technicitePosee + technicite(f) <= TECHNICITE_MAX));
  const pick = (pred: (f: Figure) => boolean, from = pool, optimiste = false): Figure | null => {
    const list = from.filter((f) => allowed(f, optimiste) && pred(f));
    if (list.length === 0) return null;
    let roll = rng.int(list.reduce((sum, f) => sum + figureWeight(f, theme, poids), 0));
    for (const f of list) {
      const w = figureWeight(f, theme, poids);
      if (roll < w) return f;
      roll -= w;
    }
    return list[0]!;
  };
  const add = (f: Figure | null): boolean => {
    if (!f) return false;
    axeMin += sautsDansLAxe(f).min;
    technicitePosee += technicite(f);
    chosen.push(f);
    names.add(f.name);
    return true;
  };
  // Lot 49 (v18) : la vedette du jour, juste après la signature.
  if (vedette && !add(pick((f) => f.name === vedette, pool, true))) return null;
  // La règle propre du thème (lot 21) : l'une de ses figures obligatoires, si la signature n'en est pas une.
  if (required.size > 0 && !chosen.some((f) => required.has(f.name)) && !add(pick((f) => required.has(f.name), pool, true))) return null;
  // Lot 48 (v17) : une seconde règle propre (Campagne : une figure d'herbe de course).
  if (requiredAlso.size > 0 && !chosen.some((f) => requiredAlso.has(f.name)) && !add(pick((f) => requiredAlso.has(f.name), pool, true))) return null;
  // Lot 58 (v22) : une famille de blocs nouveaux du thème (`blocs` : celles du thème, sur les `TENTATIVES_BLOCS` premières tentatives du jour) ; au repos ce
  // jour-là, elle sert quand même (un thème qui n'en a qu'une la pose chaque fois).
  // À tour de rôle (`tourBloc`) ; si elle ne tient pas (plafonds du circuit), une autre famille du thème.
  const estBloc = (f: Figure) => !!blocs?.includes(f.name);
  const familles = blocs ? FIGURES.filter((f) => estBloc(f) && !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator)) : [];
  if (blocs && !chosen.some(estBloc) && !add(pick((f) => f.name === tourBloc, familles, true)) && !add(pick(estBloc, familles, true))) return null;
  // Lot 57b (v23) : le circuit a un saut qui demande un geste (`sautTechnique`) : celui de sa signature, de sa vedette ou de sa famille de blocs s'il en est un, sinon un saut de la
  // grammaire, à son tour (`Tour23`). Le saut est exigé : aucun saut du thème ne tient (plafonds, saut dans l'axe déjà posé) = la tentative échoue.
  const duThemeG = (f: Figure) => !!f.grammaire && !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator);
  if (gram && !gram.allege && !chosen.some(sautTechnique)) {
    const sautsG = FIGURES.filter((f) => duThemeG(f) && !!f.jump && !!theme.figures.sauts?.includes(f.name));
    if (sautsG.length > 0 && !add(pick((f) => f.name === gram.saut, sautsG)) && !add(pick(() => true, sautsG))) return null;
  }
  // Un vrai saut et une cuve (selon le thème) : quand le thème veut les deux, une figure qui fait les deux à la fois (saut dans une cuve,
  // saut en sortie de paroi…) tient en moins de blocs que deux figures, et elle est préférée un peu plus d'une fois sur deux.
  const wantsJump = !signature.jump && wants.jump;
  const wantsCuve = wants.cuve;
  if (wantsJump && wantsCuve && rng.chance(55)) add(pick((f) => !!f.jump && !!f.cuve));
  if (wantsCuve && !chosen.some((f) => f.cuve) && !add(pick((f) => f.category === "cuve")) && !add(pick((f) => !!f.cuve)) && theme.cuveChance >= 100) return null;
  if (wantsJump && !chosen.some((f) => f.jump) && !add(pick((f) => !!f.jump && !f.cuve)) && !add(pick((f) => !!f.jump)) && theme.jumpChance >= 100) return null;
  // Du dénivelé : une figure qui en fait (colline, virage en descente, crête…), la raide plus souvent dans les thèmes de relief marqué.
  if (!chosen.some((f) => f.relief)) {
    const hill = rng.chance(theme.relief.steep) ? "colline-raide" : "colline-douce";
    // De préférence un virage dans le dénivelé (virage aveugle, en descente, crête) : une colline seule se prend à plein gaz.
    if (!add(pick((f) => !!f.relief && f.category !== "relief")) && !add(pick((f) => f.name === hill)) && !add(pick((f) => !!f.relief))) return null;
  }
  // Un freinage franc (élan de plus de 60 m/s, puis un virage) : c'est ce qui fait lâcher l'accélérateur ; il fait aussi la portion rapide.
  // Lot 49 (v18) : de préférence une figure qui fait les deux (freinage franc et portion rapide) : une figure générique de moins par circuit.
  // Lot V2 (v21) : un jour sans épingle à plaque (le motif n'y est pas permis), si aucun freinage franc court n'est disponible ce jour-là (tous au repos), on en prend un au
  // repos : il ne restait sinon que les turbos enchaînés ou la descente (8 s chacun) et le circuit sortait trop long (mesuré : jusqu'à 4 Stade sur 45 sans circuit valide).
  // Seulement dans ce cas : le préférer toujours faisait de « plaque puis virage » la figure de 89 % des circuits.
  if (generator >= GENERATOR_RYTHMES && !sansFreinage && !chosen.some((f) => f.braking)) {
    const court = (f: Figure) => !!f.braking && isFast(f) && figureSeconds(f) <= BRAKING_SHORT;
    if (!pool.some((f) => allowed(f) && court(f))) add(pick(court, rested));
  }
  if (generator >= 18 && !sansFreinage && !chosen.some((f) => f.braking) && !chosen.some(isFast)) add(pick((f) => !!f.braking && isFast(f))) || add(pick((f) => !!f.braking && isFast(f), rested));
  // Lot V2 (v21) : un jour vertical ou aérien n'exige pas de freinage franc derrière une poussée (la descente, le saut font son moment fort) ; la portion rapide reste exigée.
  while (!sansFreinage && chosen.filter((f) => f.braking).length < MIN_BRAKING) if (!add(pick((f) => !!f.braking)) && !add(pick((f) => !!f.braking, rested))) return null;
  if (!chosen.some(isFast) && !add(pick(isFast)) && !add(pick(isFast, rested))) return null;
  // Lot 57b (v23) : une transition de la grammaire, à son tour (`Tour23`), trois tirages sur quatre sur les tentatives qui exigent aussi une famille de blocs, un sur deux ensuite (`avecTransition` : le tirage retenu est le plus court, la transition ne reste donc que si le circuit
  // tient dans le budget de durée) : elle tient lieu d'une technique (et du dénivelé quand elle en fait assez) ; si aucune ne tient, ou ne se pose, le circuit s'en passe.
  if (gram && (avecTransition || gram.allege || !chosen.some((f) => f.bloc || f.grammaire))) {
    const transG = FIGURES.filter((f) => duThemeG(f) && !f.jump && !!theme.figures.transitions?.includes(f.name));
    if (transG.length > 0 && !chosen.some((f) => f.grammaire && !f.jump) && !add(pick((f) => f.name === gram.transition, transG))) add(pick(() => true, transG));
  }
  // Une figure favorite du thème (en plus de la signature), si elle tient dans le budget : c'est ce qui donne au thème sa couleur.
  const seconds = () => chosen.reduce((sum, f) => sum + figureSeconds(f), 0);
  // Lot 58 (v22) : la famille de blocs nouveaux en tient lieu.
  if (!chosen.some((f) => f !== signature && (theme.figures.favor.includes(f.name) || !!blocs?.includes(f.name)))) add(pick((f) => theme.figures.favor.includes(f.name) && seconds() + figureSeconds(f) <= budget + FAVORITE_SLACK));
  // Lot 49 (v18) : la vedette tient lieu d'une des deux techniques (elle est le moment fort du thème ; sans cela le circuit sort trop long).
  // Lot 57b (v23) : la vedette ne tient lieu d'une technique que si elle n'en est pas une (sinon un circuit dont la vedette est la seule technique n'en avait qu'une).
  const vedetteTechnique = regles23 && !!vedette && figureByName(vedette)?.category === "technique";
  const minTechniques = vedette && !vedetteTechnique ? MIN_TECHNIQUES - 1 : MIN_TECHNIQUES;
  while (count_((f) => f.category === "technique") < minTechniques) if (!add(pick((f) => f.category === "technique"))) return null;
  // Le reste, au poids : jusqu'à cinq figures quoi qu'il arrive (les plus courtes si le budget est dépassé), puis tant que le budget le permet.
  const total = () => chosen.reduce((sum, f) => sum + figureSeconds(f), 0);
  while (chosen.length < count) {
    const room = budget - total();
    const fitting = pick((f) => figureSeconds(f) <= room);
    if (fitting) add(fitting);
    else if (chosen.length < FIGURES_MIN) {
      const pool_ = pool.filter((f) => allowed(f)).sort((a, b) => figureSeconds(a) - figureSeconds(b));
      if (!add(pool_[0] ?? null)) break;
    } else break;
  }
  return chosen;
}

/**
 * Lot 49 (v18) — **variété garantie**. `themeOccurrence(jour, thème)` = le numéro d'apparition du thème depuis l'ancre `ANCRE_V18` (le nombre de jours
 * d'avant, depuis l'ancre, qui ont ce thème ; négatif avant elle : `themeForDay` jour après jour, quelques microsecondes ; rien n'est généré). Deux circuits consécutifs
 * d'un même thème ont deux numéros qui se suivent, d'où deux règles :
 * - **la vedette** (`vedetteOf`) : la `k`-ième apparition prend `vedettes[k mod n]` et s'interdit les autres vedettes du thème (n = 3 ou 4 : chaque
 *   vedette revient toutes les n apparitions, jamais deux de suite) ;
 * - **l'ordre des figures** (`orderFigures`) : chaque paire de figures du thème a un **sens fixe** (`follows`, un tournoi : une empreinte de la paire
 *   et du thème) ; un numéro pair n'enchaîne deux figures que dans ce sens, un impair que dans l'autre. Deux figures qui se suivent dans l'un ne
 *   se suivent donc jamais ainsi dans le suivant : **deux circuits consécutifs d'un même thème ne partagent aucun enchaînement de deux figures**
 *   (une figure remplacée à la pose suit la même règle : `keepsOrder`). Ce n'est pas un tri : beaucoup d'ordres conviennent, l'un est tiré au hasard
 *   (il en existe toujours un : tout tournoi a un chemin qui passe par tous ses sommets, théorème de Rédei, construit par insertion).
 * Le Salon (graines au-delà de tous les jours) prend le numéro de sa session : ses thèmes changent de toute façon d'une session à l'autre.
 */
/** Ancre du numéro d'apparition d'un thème (v18) : le 04/11/2026, où le lot 49 l'a défini. Ne bouge jamais : elle fixe le circuit de chaque jour de la v18. */
export const ANCRE_V18 = daysFromCivil(2026, 11, 4);
const occurrences = new Map<string, number>();
export function themeOccurrence(day: number, theme: ThemeName, generator = generatorVersionOf(day)): number {
  if (day >= SALON_SEED_BASE) return day - SALON_SEED_BASE;
  // Lot V1 : un jour d'avant le sac de thèmes compte les apparitions avec l'ancienne règle de tous les jours (comme toujours : son circuit ne change pas) ; un jour du sac
  // les compte avec le thème que chaque jour a réellement servi (`themeForDay(d)`, qui lit la version de d dans le registre).
  const ancien = generator < GENERATOR_SAC_THEMES;
  const key = `${theme}:${day}:${ancien ? "a" : "s"}`;
  let k = occurrences.get(key);
  if (k === undefined) {
    k = 0;
    const themeDe = (d: number): ThemeName => (ancien ? themeAncien(d) : themeForDay(d)).name;
    // L'ancre fait partie de la v18 (jamais une date de bascule) : avant elle, les apparitions se comptent à rebours (…, −2, −1) pour que deux circuits consécutifs
    // d'un même thème gardent leur vedette, leur repos et leur ordre différents quel que soit le premier jour servi par la v18.
    if (day >= ANCRE_V18) {
      for (let d = ANCRE_V18; d < day; d++) if (themeDe(d) === theme) k++;
    } else {
      for (let d = day; d < ANCRE_V18; d++) if (themeDe(d) === theme) k--;
    }
    if (occurrences.size > 512) occurrences.clear();
    occurrences.set(key, k);
  }
  return k;
}
/**
 * Lot 57b (v23) : la vedette d'une tentative. Après les `TENTATIVES_GRAMMAIRE` premières tentatives d'un jour, elle redevient l'une de celles d'avant la grammaire (la rotation du thème sans
 * les sauts de la grammaire) — certains jours (un Nuit de 2028, mesuré) n'ont aucun circuit avec la vedette de la grammaire qu'ils reçoivent ; les vedettes validées au lot 49 en ont toujours un.
 */
export function vedetteDeLaTentative(theme: Theme, occurrence: number, attempt: number, generator: number): string | null {
  const ancienne = generator >= GENERATOR_GRAMMAIRE && attempt >= TENTATIVES_GRAMMAIRE;
  return vedetteOf(ancienne ? { ...theme, figures: { ...theme.figures, vedettes: theme.figures.vedettes?.filter((v) => !figureByName(v)?.grammaire) } } : theme, occurrence);
}
/** La vedette d'une apparition du thème (lot 49), ou `null` pour un thème sans vedettes. */
export function vedetteOf(theme: Theme, occurrence: number): string | null {
  const v = theme.figures.vedettes;
  return v && v.length > 0 ? v[((occurrence % v.length) + v.length) % v.length]! : null;
}
const otherVedette = (f: Figure, theme: Theme, vedette: string | null) => !!vedette && f.name !== vedette && !!theme.figures.vedettes?.includes(f.name);
/** Le sens fixe d'une paire de figures dans un thème (lot 49) : vrai si `a` peut précéder `b` dans un circuit d'apparition paire (et `b` précéder `a` dans un impair). */
export function follows(theme: ThemeName, a: string, b: string): boolean {
  const [p, q] = a < b ? [a, b] : [b, a];
  return ((nameHash(`${theme}:${p}|${q}`) & 1) === 0) === (a === p);
}
interface Order49 {
  theme: ThemeName;
  /** Vrai pour une apparition paire du thème (le sens du tournoi), faux pour une impaire (le sens contraire). */
  even: boolean;
}
/** Vrai si `a` peut précéder `b` dans ce circuit (lot 49). */
const may = (o: Order49, a: string, b: string) => follows(o.theme, a, b) === o.even;

/** Ordre des figures : le tirage au hasard, avec un saut ni en tête (la voiture part de zéro) ni en queue (pas de saut juste avant l'arrivée) ; lot 49 (v18) : voir `may`. */
function orderFigures(rng: Rng, figures: Figure[], order49: Order49 | null): Figure[] | null {
  // Lot 49 (v18) : un ordre où deux figures qui se suivent vont dans le sens permis (`may`), construit par insertion dans un ordre tiré au hasard ; on
  // préfère un saut ni en tête ni en queue (douze essais), sinon un saut peut ouvrir le circuit (deux droites d'élan de plus : `composeFigures`) ou le finir
  // (sa réception mène à l'arrivée). Exiger « ni en tête ni en queue » faisait échouer un jour de Nuit sur cinq : le tournoi pousse certains sauts en bout.
  if (order49) {
    let path: Figure[] = [];
    for (let tries = 0; tries < 12; tries++) {
      path = [];
      for (const f of rng.shuffle(figures)) {
        const spots: number[] = [];
        for (let i = 0; i <= path.length; i++) if ((i === 0 || may(order49, path[i - 1]!.name, f.name)) && (i === path.length || may(order49, f.name, path[i]!.name))) spots.push(i);
        path.splice(spots[rng.int(spots.length)]!, 0, f);
      }
      if (!path[0]!.jump && !path[path.length - 1]!.jump) break;
    }
    return path;
  }
  for (let tries = 0; tries < 12; tries++) {
    const order = rng.shuffle(figures);
    if (!order[0]!.jump && !order[order.length - 1]!.jump) return order;
  }
  return null;
}

/** Blocs droits ordinaires (ni effet, ni saut, ni relief, ni cuve ; revêtement, largeur et point de contrôle permis). */
const isPlainStraight = (token: string) => /^S(\/[a-z>~]*)?(@cp)?$/.test(token);

/**
 * Lot V2 (v21) : plus longue ligne droite **libre** (blocs droits ordinaires) qui ne suit pas une plaque ni un super turbo — les droites de dégagement et de freinage
 * derrière une poussée, un saut ou une cuve sont comptées à part (`secureBraking` et les figures les exigent). C'est elle qu'une fiche de biome plafonne (`maxDroite`).
 */
export function longestFreeStraight(tokens: readonly string[], cretes = false): number {
  let best = 0;
  let run = 0;
  let free = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (isPlainStraight(t)) {
      run++;
      continue;
    }
    // L'élan d'une rampe de saut n'est pas une ligne droite libre non plus ; lot 57b (v23, `cretes`) : ni celui d'un appel sur une crête (une montée suivie d'un vide) ni d'un virage-tremplin (`/k`).
    const appel = /^K/.test(t) || (cretes && ((/^U\d?$/.test(t) && /^G/.test(tokens[i + 1] ?? "")) || /^[LR]\d\/[a-z+-]*k/.test(t)));
    if (free && !appel) best = Math.max(best, run);
    run = 0;
    // Derrière une poussée, un vide ou une cuve, les droites sont le dégagement exigé (elles le restent à travers une pente de réception) ; un autre bloc les libère.
    if (/^([PT]|G|V|ML|MR)/.test(t)) free = false;
    else if (!/^[UD]\d?(\/|@|$)/.test(t)) free = true;
  }
  return free ? Math.max(best, run) : best;
}

/** Plus longue suite de droites ordinaires d'un circuit (blocs) : la « ligne droite sans figure » que le générateur plafonne à `MAX_PLAIN_STRAIGHT`. */
export function longestPlainStraight(tokens: readonly string[]): number {
  let best = 0;
  let run = 0;
  for (const t of tokens) {
    run = isPlainStraight(t) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Droites ordinaires à la fin d'une liste de blocs. */
function trailingStraights(tokens: readonly string[]): number {
  let n = 0;
  while (n < tokens.length && isPlainStraight(tokens[tokens.length - 1 - n]!)) n++;
  return n;
}

/** Plus longue ligne droite sans figure, en blocs (6 = 192 m ; 5 avant le lot 20) : les dégagements derrière un turbo ou une cuve (5 et 4) se suivent d'une droite d'amorce, pas de deux. */
export const MAX_PLAIN_STRAIGHT = 6;

/** Relève les virages larges et amples ordinaires d'une figure (`L2` → `L2/b`) : le virage relevé se prend sur une trajectoire plus serrée, donc plus lentement. */
const bankTurns = (tokens: readonly string[]): string[] => tokens.map((t) => (/^[LR][23]$/.test(t) ? withMod(t, "b") : t));

/**
 * Lot V2 (v21) — **les traits de tracé d'une fiche de biome**, posés sur les virages larges (`L2`, `R2`, relevés compris ; ni en cuve, ni sur un revêtement) d'une figure :
 * - **le virage qui suit une poussée** (le premier large derrière une plaque ou un super turbo, avec des droites ou des pentes entre eux) : large, ample ou relevé selon le jour
 *   (`apresPoussee` = jour mod 3, le même dans tout le circuit, jamais le même deux jours de suite ; ample au lieu de relevé dans un biome sans virage relevé) — sinon chaque
 *   circuit freinait de la même plaque vers le même virage large (mesuré : « boost → longue → large » dans 62 % des circuits) ;
 * - `serrer` (% par virage non relevé) : il devient serré — jamais sur la route large, ni dans une figure qui change de largeur, ni à côté d'un autre serré ;
 * - `amplifier` (% par virage) : il devient ample (rayon 80 m), relevé s'il l'était.
 */
function tournures(body: readonly string[], rng: Rng, fiche: (typeof FICHES_V21)[ThemeName], entry: WidthLetter, relevables: boolean, apresPoussee: number): string[] {
  const out = [...body];
  const tight = (t: string | undefined) => !!t && /^[LR](\/|@|$)/.test(t);
  let poussee = false;
  let apres = -1;
  for (let i = 0; i < out.length; i++) {
    const t = out[i]!;
    if (/^[PT](\/|@|$)/.test(t)) poussee = true;
    else if (/^[LR]2(\/b)?$/.test(t) && poussee) {
      apres = i;
      break;
    } else if (!/^(S|U|D)/.test(t)) poussee = false;
  }
  if (apres >= 0) {
    const d = out[apres]![0]!;
    out[apres] = apresPoussee === 0 ? `${d}2` : apresPoussee === 1 || !relevables ? `${d}3` : `${d}2/b`;
  }
  const serrable = entry !== "l" && !out.some((t) => t.includes(">"));
  for (let i = 0; i < out.length; i++) {
    const m = /^([LR])2(\/b)?$/.exec(out[i]!);
    if (i === apres || !m) continue;
    if (fiche.serrer && !m[2] && serrable && !tight(out[i - 1]) && !tight(out[i + 1]) && rng.chance(fiche.serrer)) out[i] = m[1]!;
    else if (fiche.amplifier && rng.chance(fiche.amplifier)) out[i] = `${m[1]}3${m[2] ?? ""}`;
  }
  return out;
}

/**
 * Lot V2 (v21) — **le relief d'une fiche**, posé sur le circuit fini (avant les revêtements) : sur les droites ordinaires (`S`, sans repère) loin de toute poussée, rampe, vide,
 * moteur coupé ou cuve (trois blocs de part et d'autre : l'élan d'un saut ne change pas) et hors des approches protégées d'un virage rapide (le freinage y est compté à plat),
 * `pente` (% par droite) devient une pente, vers le bas tant que la route reste dans les hauteurs permises, sinon vers le haut (Col alpin). Une droite et une pente d'une cellule
 * ont la même place sur la grille : rien ne se croise.
 */
function reliefDuBiome(tokens: string[], fiche: (typeof FICHES_V21)[ThemeName], rng: Rng, shielded: ReadonlySet<number>): void {
  const n = tokens.length;
  const libre = (i: number) => {
    if (i < 1 || i >= n - 1 || tokens[i] !== "S" || shielded.has(i)) return false;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) if (/^([PTKCV]|G|ML|MR)/.test(tokens[k]!)) return false;
    return true;
  };
  const hauteurs = (): number[] => {
    const out: number[] = [];
    let y = 0;
    for (const t of tokens) {
      const p = parseTokenLu(t);
      y += exitDelta(p.kind, p.rise);
      out.push(y);
    }
    return out;
  };
  for (let i = 1; i < n - 1; i++) {
    if (!libre(i)) continue;
    if (rng.chance(fiche.pente ?? 0)) {
      const reste = hauteurs().slice(i);
      if (Math.min(...reste) - LEVEL_STEP >= Y_MIN) tokens[i] = "D";
      else if (Math.max(...reste) + LEVEL_STEP <= Y_MAX) tokens[i] = "U";
    }
  }
}
const LEVEL_STEP = 4;

/** Liaisons entre deux figures : le plus souvent rien ou une droite ; parfois une plaque ou une bosse. */
const CONNECTORS: readonly (readonly string[])[] = [[], [], [], [], [], ["S"], ["S", "P", "S", "S"], ["S", "B", "S"]];

/**
 * Texte d'un circuit pour (jour, tentative, thème), avec ses figures, ou `null` si la construction s'est coincée.
 * Les figures sont tirées dans une bibliothèque (figures.ts) : signature du thème, relief, saut, cuve, portion rapide, au moins deux
 * techniques, le tout au poids du thème (favorites ×4, interdites exclues) et sans les figures « au repos » ce jour-là ; jamais la même
 * figure deux fois. Chacune est posée dans un sens (miroir) et avec une variante tirés au sort, la première qui tient sur la grille
 * (sans croisement, sans dépasser les hauteurs permises, dans le budget de virages serrés) l'emporte.
 */
export function composeFigures(day: number, attempt: number, themeAsked?: Theme | null, variant = 0, generator = generatorVersionOf(day)): Composition | null {
  // Lot 34 (v16) : freinage possible après un boost (`secureBraking`, braking.ts) ; v15 : les règles d'avant, au tirage près.
  const rules34 = generator >= 16;
  // Lot 48 (v17) : le thème tel que cette version le connaît (la Campagne roule sur l'herbe de course) ; avant, le thème tel quel.
  const theme = themeOfVersion(themeAsked ?? themeForDay(day, generator), generator);
  // Lot 49 (v18) : le numéro d'apparition du thème, sa vedette et le sens de l'ordre des figures ; un thème sans super turbo n'en pose aucun.
  const rules49 = generator >= 18;
  const occurrence = rules49 ? themeOccurrence(day, theme.name, generator) : 0;
  const vedette = rules49 ? vedetteDeLaTentative(theme, occurrence, attempt, generator) : null;
  const order49: Order49 | null = rules49 ? { theme: theme.name, even: occurrence % 2 === 0 } : null;
  const noTurbo = rules49 && theme.turboChance === 0;
  // Lot V2 (v21) : le rythme du jour, les poids (rythme puis biome), le motif « boost → longue ligne droite → virage serré » (un jour rapide seulement, une fois) et la
  // plus longue ligne droite libre de la fiche du biome.
  const rules21 = generator >= GENERATOR_RYTHMES;
  const rules58 = generator >= GENERATOR_BLOCS;
  // Lot 58 (v22) : les familles de blocs nouveaux exigées du thème, sur les premières tentatives du jour seulement — certains jours, toutes les tentatives avec
  // elles sortent trop longues (une figure de plus) ; plutôt qu'un circuit de secours, le jour reprend sans elles (mesuré : 3 jours sur 48 à la Ville et à la Nuit).
  const blocsDuTheme = rules58 && attempt < TENTATIVES_BLOCS ? theme.figures.blocs : undefined;
  // À tour de rôle : la famille suit le numéro d'apparition du thème (deux circuits consécutifs d'un thème n'ont pas la même) ; une famille qui ne tient pas
  // en `TOUR_BLOCS` tentatives laisse sa place à la suivante.
  const tour = occurrence + Math.floor(attempt / TOUR_BLOCS);
  const tourBloc = blocsDuTheme ? blocsDuTheme[((tour % blocsDuTheme.length) + blocsDuTheme.length) % blocsDuTheme.length] : undefined;
  // Un tour vide ("") : ce circuit n'en exige pas (un thème qui n'a qu'une famille la pose un circuit sur deux).
  const blocs = tourBloc ? blocsDuTheme : undefined;
  // Lot 57b (v23) : les sauts et les transitions de la grammaire, exigés sur les mêmes premières tentatives que les familles du lot 58, à tour de rôle eux aussi.
  const rules23 = generator >= GENERATOR_GRAMMAIRE;
  const varietes = rules23 && attempt < MAX_ATTEMPTS_23 - TENTATIVES_LIBRES;
  const allege = rules23 && attempt >= TENTATIVES_GRAMMAIRE && attempt < TENTATIVES_GRAMMAIRE + TENTATIVES_ALLEGEES;
  const sautsDuTheme = rules23 && (attempt < TENTATIVES_GRAMMAIRE || allege) ? theme.figures.sauts : undefined;
  const tour23: Tour23 | undefined = sautsDuTheme && sautsDuTheme.length > 0 ? {
    saut: sautsDuTheme[((tour % sautsDuTheme.length) + sautsDuTheme.length) % sautsDuTheme.length]!,
    transition: theme.figures.transitions?.length ? theme.figures.transitions[((tour % theme.figures.transitions.length) + theme.figures.transitions.length) % theme.figures.transitions.length]! : "",
    ...(allege ? { allege: true } : {}),
  } : undefined;
  const signatureName = SIGNATURE_FIGURE[theme.signature];
  const rythme: Rythme | null = rules21 ? rythmeDuJour(day, generator, theme.name) : null;
  const fiche = rules21 ? FICHES_V21[theme.name] : null;
  const poids = rythme && fiche ? [POIDS_RYTHME[rythme], fiche.poids] : undefined;
  const motifPermis = rythme === "rapide" ? 1 : 0;
  const maxDroite = fiche?.maxDroite ?? Infinity;
  // Le tiers de figures au repos (`isRested`) : par la date avant la v18 ; à partir d'elle, par le numéro d'apparition, k + ⌊k / n⌋ (mod 3), n le nombre
  // de vedettes (3 ou 4) : il change d'une apparition à la suivante, et deux apparitions qui ont la même vedette (k et k + n) n'ont jamais le même repos.
  const restDay = rules49 ? occurrence + Math.floor(occurrence / (theme.figures.vedettes?.length ?? 3)) : day;
  // Variante 0 : la graine d'origine. Variante n : une autre graine, décalée de n × 1000 tentatives (au plus `MAX_ATTEMPTS` = 40 sont
  // tirées : jamais de recoupement entre variantes).
  // Lot 58 (v22) : au-delà des tentatives qui exigent une famille, le repli reprend les graines du début (le jour retrouve le circuit qu'il aurait eu sans elle,
  // au lieu de chercher plus loin : mesuré, un Stade passait de 8 à 64 tentatives).
  const graine = rules23 && theme.figures.sauts ? (attempt >= TENTATIVES_GRAMMAIRE ? attempt - TENTATIVES_GRAMMAIRE : attempt) : rules58 && theme.figures.blocs && attempt >= TENTATIVES_BLOCS ? attempt - TENTATIVES_BLOCS : attempt;
  const rng = new Rng(mixSeed(day, graine + 1 + variant * 1000));
  const count = FIGURES_MIN + rng.int(FIGURES_SPAN);
  // Plusieurs tirages de figures, le premier dont la durée estimée tient dans le budget l'emporte (sinon le plus court) : les figures
  // obligatoires d'un thème (saut, cuve, signature) pèsent lourd, et sept tirages sur dix donneraient un circuit trop long.
  // Un saut et une cuve, selon les chances du thème : tirés une fois pour toutes (les tirages de figures ne les écartent pas).
  const wants = { jump: rng.chance(theme.jumpChance), cuve: theme.cuveChance > 0 && rng.chance(theme.cuveChance) };
  // Lot V2 (v21) : un jour aérien a toujours un saut ; un jour technique en tire deux fois moins (sauf thème qui en a toujours un).
  if (rythme === "aerien") wants.jump = true;
  else if (rythme === "technique" && theme.jumpChance < 100 && wants.jump) wants.jump = rng.chance(50);
  let picked: Figure[] | null = null;
  let best = -Infinity;
  for (let tries = 0; tries < (rules23 ? SELECTION_TRIES_23 : SELECTION_TRIES); tries++) {
    const candidate = selectFigures(rng, theme, restDay, count, wants, rules34 ? FIGURE_BUDGET - BRAKING_BUDGET : FIGURE_BUDGET, generator, vedette, poids, rules21 && motifPermis === 0, rythme === "vertical" || rythme === "aerien" || rythme === "technique", blocs, tourBloc, tour23, varietes, attempt < TENTATIVES_BLOCS ? tries % 4 !== 3 : tries % 2 === 0);
    if (!candidate) continue;
    const seconds = candidate.reduce((sum, f) => sum + figureSeconds(f), 0);
    // Hors budget : on garde le plus court seulement faute de mieux ; dans le budget : celui où l'on lâche le plus le gaz (somme des `off` des figures).
    // Lot 57b (v23) : à budget égal, un tirage qui a sa transition de la grammaire l'emporte (+ 6 : à peu près la durée d'une transition).
    const score = (seconds <= FIGURE_TOTAL_MAX - (rules34 ? BRAKING_BUDGET : 0) ? 1000 : -seconds) + candidate.reduce((sum, f) => sum + f.off, 0) + (rules23 && candidate.some((f) => f.grammaire && !f.jump) ? 6 : 0);
    if (score > best) {
      best = score;
      picked = candidate;
    }
  }
  if (!picked) return null;
  const order = orderFigures(rng, picked, order49);
  if (!order) return null;

  // Largeurs : la route démarre à une largeur tirée selon le thème, et change avant certaines figures tirées d'avance.
  const weights = theme.widths.weights;
  const startWidth = pickWidth(rng, weights, WIDTH_LETTERS);
  let width = startWidth;
  const usedWidths = new Set<WidthLetter>([width]);
  const changeCount = theme.widths.changes[0] + rng.int(theme.widths.changes[1] - theme.widths.changes[0] + 1);
  const changeSlots = new Set<number>();
  for (let tries = 0; changeSlots.size < changeCount && tries < 40; tries++) changeSlots.add(rng.int(order.length));

  const w: Walk = { cx: 0, cz: 0, dir: 0, y: 0, cells: new Set(), tokens: [] };
  place(w, [`S/${width}`]);
  const placed: PlacedFigure[] = [];
  let tightLeft = maxTightOf(theme);
  let majorHill = false;
  const names = new Set(order.map((f) => f.name));
  // Lot 34 : virages qui reçoivent un bas-côté, blocs d'approche protégés, un seul virage-piège (signature, ou Ville).
  const escapes = new Set<number>();
  const shielded = new Set<number>();
  const sansBord = new Set<number>();
  const braking = { kept: 0, added: 0, escapes: 0 };
  const escapeKind = theme.shoulder.kind !== "void" && theme.shoulder.share > 0;

  for (let i = 0; i < order.length; i++) {
    // Une figure qui ne tient pas est remplacée par une autre de la même catégorie (même nature : saut, cuve, moteur coupé) ;
    // la signature, elle, ne se remplace pas : la tentative échoue et la graine voisine prend le relais.
    const alternatives = [order[i]!];
    // Lot V2 (v21) : la seconde règle propre du thème (`requireAlso` : l'herbe de course de la Campagne) ne se remplace pas non plus — la ligne droite libre plafonnée la faisait
    // parfois remplacer par une figure sans herbe.
    // Lot 58 (v22) : la famille de blocs nouveaux non plus (sinon le circuit pouvait la perdre). Lot 57b (v23) : le saut de la grammaire non plus, ni la figure que le thème exige (`require`).
    const obligatoire = (rules21 && !!theme.figures.requireAlso?.includes(order[i]!.name)) || !!blocs?.includes(order[i]!.name) || (!!order[i]!.grammaire && !!order[i]!.jump) || (rules23 && !!theme.figures.require?.includes(order[i]!.name));
    if (order[i]!.name !== signatureName && order[i]!.name !== vedette && !obligatoire) {
      const f0 = order[i]!;
      const banned = new Set(theme.figures.ban);
      // Lot 49 (v18) : une remplaçante suit le sens permis avec la figure posée avant et celle qui suit (aucun enchaînement en commun avec la veille du thème).
      const prev = placed.length > 0 ? placed[placed.length - 1]!.name : null;
      const next = i + 1 < order.length ? order[i + 1]!.name : null;
      const keepsOrder = (f: Figure) => !order49 || ((prev === null || may(order49, prev, f.name)) && (next === null || may(order49, f.name, next)));
      const subs = FIGURES.filter((f) => !f.bloc && !f.grammaire && f.category === f0.category && !!f.jump === !!f0.jump && !!f.cuve === !!f0.cuve && !!f.cut === !!f0.cut && !names.has(f.name) && !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator) && !isRested(f.name, restDay) && !otherVedette(f, theme, vedette) && keepsOrder(f) && !(rules21 && motifPermis === 0 && toujoursMotif(f)));
      alternatives.push(...rng.shuffle(subs).slice(0, 3));
    }
    let done: { figure: Figure; tokens: string[]; variant: number; left: boolean; before: number; fix: ReturnType<typeof secureBraking> } | null = null;
    for (const figure of alternatives) {
      // Pas de liaison derrière une longue ligne droite (le dégagement d'une figure suffit), ni avant le premier.
      let connector = i === 0 || trailingStraights(w.tokens) > 1 ? [] : [...CONNECTORS[rng.int(CONNECTORS.length)]!];
      // Lot V2 (v21) : la liaison à plaque n'existe qu'un jour rapide (mesuré : elle faisait une bonne part des « boost → longue ligne droite → virage » de tous les jours).
      if (rules21 && rythme !== "rapide" && connector.includes("P")) connector = ["S"];
      const target = changeSlots.has(i) ? pickWidth(rng, weights, NEXT_WIDTHS[width]) : null;
      const variants = rng.shuffle(Array.from({ length: figure.variants }, (_, v) => v));
      const banked = rng.chance(theme.bankChance); // virages relevés dans cette figure (selon le thème), sauf si elle n'a pas de virage ordinaire
      let mirrors = rng.chance(50) ? [true, false] : [false, true];
      // Lot V2 (v21) : un biome qui alterne (Rallye) essaie d'abord le sens où le premier virage de la figure tourne à l'opposé du dernier virage posé.
      if (fiche?.alterner) {
        const last = [...w.tokens].reverse().map((t) => parseTokenLu(t).kind).find(isCurve);
        if (last) mirrors = turnsLeft(last) ? [false, true] : [true, false];
      }
      // Lot V2 (v21) : la signature et la vedette gardent leur dessin ; les autres figures prennent les traits du biome (`tournures`).
      // Lot 58 (v22) : une famille de blocs nouveaux non plus (un virage serré après la direction bloquée, une pente sous la route bombée : interdits).
      const traits = rules21 && fiche && figure.name !== signatureName && figure.name !== vedette && !figure.cuve && !figure.bloc && !figure.grammaire;
      outer: for (const withChange of target ? [true, false] : [false]) {
        const entry = withChange ? target! : width;
        const prefix = withChange ? [transition(width, target!)] : [];
        for (const v of variants) {
          for (const left of mirrors) {
            const plain = buildFigure(figure, left, entry, v, theme.name);
            if (!plain || (noTurbo && plain.some((t) => /^T(\/|@|$)/.test(t)))) continue;
            const banked_ = banked && !figure.cuve ? bankTurns(plain) : plain;
            const shaped = traits ? tournures(banked_, rng, fiche!, entry, theme.bankChance > 0, (((day + variant) % 3) + 3) % 3) : banked_;
            for (const body of shaped.join(" ") === banked_.join(" ") ? [banked_] : [shaped, banked_]) {
            // La droite d'amorce d'une figure est celle qui termine la précédente (ou le départ) : on ne la pose pas deux fois.
            const lead = connector.length === 0 && prefix.length === 0 && body[0] === "S" && /^S(\/[a-z]*)?(@start)?$/.test(w.tokens[w.tokens.length - 1] ?? "") ? 1 : 0;
            // Lot 49 (v18) : un saut en tête du circuit part de deux droites de plus (la voiture part de zéro).
            const runUp = rules49 && i === 0 && figure.jump ? ["S", "S"] : [];
            let tokens = [...(figure.jump || figure.cuve ? [] : connector), ...prefix, ...runUp, ...body.slice(lead)];
            let fix = rules34 ? secureBraking(w.tokens, tokens, { escape: escapeKind, allowTrap: braking.kept === 0 && (theme.name === "ville" || figure.name === signatureName) }) : null;
            // Lot V2 (v21) : quand le motif « boost → longue ligne droite → virage serré » apparaît, il garde sa zone de freinage — jamais un virage-piège.
            if (rules21 && fix && fix.kept > 0 && motifsBoostSerre([...w.tokens, ...fix.tokens]) > motifsBoostSerre(w.tokens)) fix = secureBraking(w.tokens, tokens, { escape: escapeKind, allowTrap: false });
            if (rules34 && !fix) continue;
            if (fix) tokens = fix.tokens;
            if (tightCount(tokens) > tightLeft || !fits(w.y, tokens)) continue;
            // Lot V2 (v21) : le motif et la ligne droite libre, comptés sur le circuit tel qu'il serait avec cette figure.
            if (rules21) {
              const motif = motifsBoostSerre([...w.tokens, ...tokens]);
              if (motif > motifPermis || longestFreeStraight([...w.tokens, ...tokens], rules23) > maxDroite) continue;
            }
            // Le premier relief d'un circuit fait au moins deux niveaux : c'est lui qui garantit le dénivelé minimal.
            if (figure.relief && !majorHill && hillRise(body) < MIN_RELIEF) continue;
            const before = w.tokens.length;
            // Lot 57b (v23) : un saut qui ferait deux sauts « droite → tremplin → axe », ou deux sauts de même combinaison, se pose dans une autre variante (ou ne se pose pas) :
            // on le pose, on regarde le circuit en cours, et on le retire s'il fait faute.
            const snap = varietes && figure.jump ? { cx: w.cx, cz: w.cz, dir: w.dir, y: w.y, cells: new Set(w.cells) } : null;
            if (!place(w, tokens)) continue;
            if (snap && fauteSauts(w.tokens, order.slice(i + 1).reduce((n, g) => n + sautsDansLAxe(g).min, 0))) {
              Object.assign(w, snap);
              w.tokens.length = before;
              continue;
            }
            done = { figure, tokens, variant: v, left, before, fix };
            break outer;
            }
          }
        }
      }
      if (done) break;
    }
    if (!done) return null;
    if (done.figure.name !== order[i]!.name) {
      names.delete(order[i]!.name);
      names.add(done.figure.name);
    }
    tightLeft -= tightCount(done.tokens);
    if (done.fix) {
      for (const k of done.fix.escapes) escapes.add(done.before + k);
      for (const k of done.fix.protect) shielded.add(done.before + k);
      braking.kept += done.fix.kept;
      braking.added += done.fix.added;
      braking.escapes += done.fix.escapes.length / 2;
    }
    if (done.figure.relief && hillRise(done.tokens) >= MIN_RELIEF) majorHill = true;
    placed.push({ name: done.figure.name, variant: done.variant, left: done.left, from: done.before, to: w.tokens.length });
    // Lot 58 (v22) : les blocs d'une famille nouvelle sont protégés des retouches du circuit fini (revêtement, bosses, rebords retirés, pente du biome).
    // Ni bas-côté sur elle ni sur les deux blocs qui la suivent (mesuré : un bas-côté de vide juste après le mur roulable, et la voiture qui en redescend tombait).
    if (rules58 && (done.figure.bloc || done.figure.grammaire)) {
      for (let k = done.before; k < w.tokens.length; k++) shielded.add(k);
      if (done.figure.bloc) for (let k = done.before; k < w.tokens.length + 2; k++) sansBord.add(k);
    }
    width = widthAfter(done.tokens, width);
    usedWidths.add(width);
  }

  // Dernière ligne droite puis arrivée.
  if (!place(w, ["S"]) && !place(w, ["S", "S"])) return null;
  if (!place(w, ["S@finish"])) return null;
  if (usedWidths.size < 2) return null; // au moins deux largeurs par circuit
  if (placed.some((p) => figureByName(p.name)!.cuve) && !w.tokens.some((t) => parseTokenLu(t).cuve)) return null;
  w.tokens[0] = `S/${startWidth}@start`;
  // Lot 34 (v16) : les droites de freinage ajoutées (derrière une portion rapide) s'ajoutent au plafond.
  if (longestPlainStraight(w.tokens) > MAX_PLAIN_STRAIGHT + (rules34 ? MAX_BRAKING_ADD : 0)) return null;

  // Points de contrôle (2 à 4), répartis le long du circuit, sur des lignes droites. Un moteur coupé est suivi d'un
  // point de contrôle deux blocs plus loin : « on vit sur son élan » ~1 s, pas jusqu'à la fin du circuit.
  const n = w.tokens.length;
  const eligible = (i: number) => i > 0 && i < n - 1 && w.tokens[i] === "S";
  const used2 = new Set<number>();
  const cutAt = w.tokens.indexOf("C");
  if (cutAt >= 0) {
    if (w.tokens[cutAt + 1] !== "S" || w.tokens[cutAt + 2] !== "S" || cutAt + 2 >= n - 1) return null;
    used2.add(cutAt + 2);
  }
  const cpCount = used2.size > 0 ? 2 + rng.int(2) : 2 + rng.int(3); // le point de contrôle du moteur coupé compte
  for (let k = 1; used2.size < cpCount; k++) {
    const target = Math.round((k * (n - 1)) / (cpCount + 1));
    for (let d = 0; d < n; d++) {
      const c = [target + d, target - d].find((i) => eligible(i) && !used2.has(i) && ![...used2].some((u) => Math.abs(u - i) < 3));
      if (c !== undefined) {
        used2.add(c);
        break;
      }
    }
    if (k > cpCount + 3) break;
  }
  for (const i of used2) w.tokens[i] = "S@cp";
  if (fiche?.pente) reliefDuBiome(w.tokens, fiche, rng, shielded);

  // Zones de revêtement : des suites de 3 à 6 blocs d'un même revêtement (terre, glace, herbe) sur les blocs ordinaires, sauf autour
  // d'un moteur coupé (il veut deux droites ordinaires derrière lui).
  // Lot 34 : ni sur l'approche d'un virage rapide (le freinage y est compté sur la route).
  const zoneGuard = new Set<number>(cutAt >= 0 ? [cutAt, cutAt + 1, cutAt + 2, cutAt + 3] : []);
  for (const k of shielded) zoneGuard.add(k);
  if (theme.zones) assignZones(w.tokens, theme.zones, rng, zoneGuard);
  // Dénivelé minimal, puis sections sans rebords sur les parties surélevées.
  if (reliefOf(w.tokens) < MIN_RELIEF) return null;
  if (theme.openChance > 0 && rng.chance(theme.openChance)) openSection(w.tokens, rng, rules34 ? shielded : undefined);
  // Identité du thème (lot 21) : route bosselée, puis bas-côtés.
  if (theme.bumpy[1] > 0) bumpySections(w.tokens, theme.bumpy, rng, rules34 ? shielded : undefined);
  assignShoulders(w.tokens, theme.shoulder, rng, escapes, rules58 ? sansBord : undefined);
  // Lot 49 (v18) : la Nuit (bas-côté de vide) a toujours de la route sans rebords — c'est sa fiche ; sinon, la graine voisine.
  if (rules49 && theme.shoulder.kind === "void" && !w.tokens.some((t) => parseTokenLu(t).open || t.includes("~v"))) return null;
  // Lot 58 (v22) : les règles d'équité des blocs à effet, sur le circuit fini (les figures les tiennent par construction : ceci les garde).
  if (rules58 && fauteEffets(w.tokens)) return null;
  return { spec: w.tokens.join(" "), figures: placed, braking };
}

/** Lot 58 : première version du générateur qui pose les familles de blocs nouveaux (`Figure.bloc`, `Theme.figures.blocs`). */
export const GENERATOR_BLOCS = 22;
/** Lot 58 (v22) : tentatives d'un jour qui exigent une famille de blocs nouveaux (au-delà, elle n'est plus qu'une favorite : jamais de circuit de secours pour elle). */
const TENTATIVES_BLOCS = 30;
/** Lot 57b (v23) : tentatives d'un jour qui exigent la grammaire (un saut qui demande un geste, une transition si le budget le permet) : les `TENTATIVES_BLOCS` premières exigent aussi une famille de blocs nouveaux, les suivantes la grammaire seule, au-delà le jour reprend les graines du début sans rien exiger. */
const TENTATIVES_GRAMMAIRE = 120;
/** Lot 57b (v23) : tentatives « allégées » qui suivent : une transition de la grammaire seule (4 à 7 s, elle tient lieu d'une technique) ; au-delà, plus rien n'est exigé. */
const TENTATIVES_ALLEGEES = 60;
/** Lot 58 (v22) : tentatives d'un jour avec la même famille (son tour), avant de passer à la suivante. */
const TOUR_BLOCS = 10;

/**
 * Lot 58 (v22) — **les règles d'équité des blocs à effet**, sur un circuit écrit (`null` s'il les tient, sinon la faute) : un effet (bande `Ed`, `Ef`, `Er`,
 * `Ex`) est toujours éteint par une remise à zéro (`E0`) **avant** un autre effet et avant l'arrivée (jamais deux effets qui se cumulent, jamais d'effet sur
 * la ligne) ; et jusqu'à sa remise à zéro, rien de ce qui le rendrait injouable : direction bloquée → aucun virage ; freins coupés → aucun virage serré ;
 * régulateur → la vitesse tenue est celle d'un virage à au plus deux blocs avant la bande, et aucun virage plus petit que lui ne suit (il se passe à la
 * vitesse tenue) ; voiture fragile → ni plaque ni super turbo (un saut à plus de ≈ 60 m/s), ni chute de deux niveaux ; aucun moteur coupé sous un effet.
 */
export function fauteEffets(tokens: readonly string[]): string | null {
  let actif = 0;
  let dernier = -10; // le dernier virage avant la bande, et sa taille (1 serré, 2 large, 3 ample)
  let taille = 0;
  let entree = 0;
  for (let i = 0; i < tokens.length; i++) {
    const p = parseTokenLu(tokens[i]!);
    if (p.fx === FX_RESET) {
      actif = 0;
      continue;
    }
    if (p.fx) {
      if (actif) return `deux effets sans remise à zéro (bloc ${i})`;
      actif = p.fx;
      if (actif === FX_CRUISE && i - dernier > 2) return `régulateur sans virage juste avant (bloc ${i})`;
      entree = taille;
      continue;
    }
    if (isCurve(p.kind)) {
      dernier = i;
      taille = curveSize(p.kind);
    }
    if (!actif) continue;
    if (tokens[i]!.includes("@finish")) break;
    const serre = isCurve(p.kind) && !isWide(p.kind);
    if (p.kind === "cut") return `moteur coupé sous un effet (bloc ${i})`;
    if (actif === FX_NO_STEER && isCurve(p.kind)) return `virage sous la direction bloquée (bloc ${i})`;
    if (actif === FX_NO_BRAKE && serre) return `virage serré sans frein (bloc ${i})`;
    if (actif === FX_CRUISE && isCurve(p.kind) && curveSize(p.kind) < entree) return `virage plus serré que la vitesse tenue (bloc ${i})`;
    if (actif === FX_FRAGILE && (p.kind === "boost" || p.kind === "turbo" || (p.kind === "gap" && (p.rise ?? 0) <= -8))) return `élan ou chute qui casse la voiture fragile (bloc ${i})`;
  }
  return actif ? "un effet jusqu'à l'arrivée" : null;
}

/** Texte d'un circuit pour (jour, tentative, thème), ou `null` si la construction s'est coincée (voir `composeFigures`). */
export function composeSpec(day: number, attempt: number, theme?: Theme | null, variant = 0, generator = generatorVersionOf(day)): string | null {
  return composeFigures(day, attempt, theme, variant, generator)?.spec ?? null;
}

/** Blocs qui reçoivent un revêtement : droites, virages, côtes d'un niveau (pas les effets, bosses, rampes, vides, côtes raides ni le départ / l'arrivée). */
function surfaceable(token: string, index: number, n: number): boolean {
  if (index === 0 || index >= n - 1 || token.includes("/")) return false;
  const p = parseTokenLu(token);
  if (p.cuve) return false; // une cuve garde la route
  // Une montée raide (U2, U3 : pente 0,25 et 0,375) reste sur la route : sur l'herbe, la poussée ne suffit pas à la monter (mesuré :
  // la voiture cale et recule), et une descente raide sur la glace ne se contrôle pas.
  if ((p.kind === "up" || p.kind === "down") && p.rise !== undefined && Math.abs(p.rise) > 4) return false;
  return p.kind === "straight" || isCurve(p.kind) || p.kind === "up" || p.kind === "down";
}

/**
 * Sections sans rebords (lot 17) : sur une suite de 3 à 5 blocs ordinaires (droites, virages, montées, descentes) dont la route est
 * à `OPEN_MIN_HEIGHT` m au moins au-dessus du point le plus bas du circuit, on retire les rebords (modificateur `o`). Rien
 * si aucune suite n'est assez haute.
 */
function openSection(tokens: string[], rng: Rng, shielded?: ReadonlySet<number>): void {
  const n = tokens.length;
  const entry: number[] = [];
  const exit: number[] = [];
  let y = 0;
  let low = 0;
  for (const t of tokens) {
    const p = parseTokenLu(t);
    entry.push(y);
    y += exitDelta(p.kind, p.rise);
    exit.push(y);
    low = Math.min(low, y, entry[entry.length - 1]!);
  }
  const ok = (i: number): boolean => {
    if (i < 1 || i >= n - 2 || shielded?.has(i)) return false;
    const k = parseTokenLu(tokens[i]!).kind;
    if (k === "kick" || k === "gap" || k === "jump" || parseTokenLu(tokens[i]!).cuve) return false;
    // Le bloc d'avant un saut garde ses rebords (la rampe commence sur une route fermée), comme la réception.
    const next = parseTokenLu(tokens[i + 1]!).kind;
    const prev = parseTokenLu(tokens[i - 1]!).kind;
    if (next === "kick" || prev === "gap") return false;
    return Math.min(entry[i]!, exit[i]!) - low >= OPEN_MIN_HEIGHT;
  };
  const runs: [number, number][] = [];
  for (let i = 1; i < n - 2; i++) {
    if (!ok(i)) continue;
    let j = i;
    while (j + 1 < n - 2 && ok(j + 1)) j++;
    if (j - i + 1 >= 3) runs.push([i, j]);
    i = j;
  }
  if (runs.length === 0) return;
  const [from, to] = runs[rng.int(runs.length)]!;
  const length = Math.min(to - from + 1, 3 + rng.int(3));
  const start = from + rng.int(to - from + 1 - length + 1);
  for (let i = start; i < start + length; i++) tokens[i] = withMod(tokens[i]!, "o");
}

/**
 * Route bosselée (lot 21) : `count` séries de 2 à 4 droites ordinaires (`S`, sur route ou sur terre, point de contrôle permis) prennent
 * le modificateur `u` (tôle ondulée). Ni départ, ni arrivée, ni bloc à effet, ni les trois blocs avant une rampe de saut.
 */
function bumpySections(tokens: string[], count: [number, number], rng: Rng, shielded?: ReadonlySet<number>): void {
  const n = tokens.length;
  // Jamais dans les trois blocs avant une rampe de saut : il faut y garder sa vitesse (les pilotes prudents du jeu de démo ne passaient plus).
  const beforeKick = (i: number) => tokens.slice(i + 1, i + 4).some((t) => parseTokenLu(t).kind === "kick");
  const plain = (i: number) => i > 0 && i < n - 1 && !shielded?.has(i) && /^S(\/[a-z>]*)?(@cp)?$/.test(tokens[i]!) && !tokens[i]!.includes("u") && !beforeKick(i);
  const wanted = count[0] + rng.int(count[1] - count[0] + 1);
  for (let k = 0; k < wanted; k++) {
    const length = 2 + rng.int(3);
    // Toutes les places possibles pour une série de cette longueur (une série plus courte si aucune ne convient).
    for (let len = length; len >= 2; len--) {
      const starts: number[] = [];
      for (let i = 1; i + len <= n - 1; i++) {
        let ok = true;
        for (let j = i; j < i + len; j++) if (!plain(j)) ok = false;
        if (ok) starts.push(i);
      }
      if (starts.length === 0) continue;
      const start = starts[rng.int(starts.length)]!;
      for (let i = start; i < start + len; i++) tokens[i] = withMod(tokens[i]!, "u");
      break;
    }
  }
}

/** Lettre de chaque bas-côté dans la notation (`~h`…). */
const EDGE_MOD: Record<Theme["shoulder"]["kind"], string> = { grass: "~h", gravel: "~t", snow: "~p", sand: "~s", void: "~v" };

/**
 * Bas-côtés (lot 21) : sur les blocs qui peuvent en porter (droites, virages non relevés, descentes d'un ou deux niveaux, blocs à effet ;
 * pas le départ, l'arrivée, une montée, une rampe, un vide, sa réception, une cuve ni un bloc déjà sans rebords ; pour le vide, ni un
 * virage serré ni les deux blocs qui le suivent), des séries de 3 à 6
 * blocs prennent le bas-côté du thème avec la probabilité `share`. La notation est chaînée : `~x` sur le premier bloc de la série, `~r`
 * sur le bloc qui la suit.
 */
function assignShoulders(tokens: string[], shoulder: Theme["shoulder"], rng: Rng, forced?: ReadonlySet<number>, sansBord?: ReadonlySet<number>): void {
  const n = tokens.length;
  const parsed = tokens.map((t) => parseTokenLu(t));
  const eligible = (i: number): boolean => {
    if (i < 1 || i >= n - 1) return false;
    const p = parsed[i]!;
    if (p.open || p.cuve || p.banked || p.kind === "up" || p.kind === "kick" || p.kind === "jump" || p.kind === "gap" || p.kind === "bump") return false;
    if (p.kind === "down" && p.rise !== undefined && p.rise < -8) return false;
    const prev = parsed[i - 1]!.kind;
    const next = parsed[i + 1]!.kind;
    if (prev === "gap") return false; // la réception d'un saut garde ses rebords (et sa face pleine)
    // Le vide : comme une section sans rebords, ni juste avant une rampe ni à la réception ; ni sur un virage serré ni sur les deux blocs
    // qui le suivent (mesuré : le pilote sort large d'un serré et tombait sur un circuit de Nuit sur six).
    if (shoulder.kind === "void") {
      if (next === "kick") return false;
      const tight = (k: number) => k >= 1 && isCurve(parsed[k]!.kind) && !isWide(parsed[k]!.kind);
      if (tight(i) || tight(i - 1) || tight(i - 2)) return false;
      if (isCurve(p.kind) && prev === "up") return false; // virage aveugle : la voiture s'allège en haut de la montée
      // Ni à 88 m/s (cinq blocs après un super turbo), ni juste après un saut (la voiture se pose rarement sur l'axe).
      for (let k = Math.max(1, i - 5); k <= i; k++) if (parsed[k]!.kind === "turbo" || (k >= i - 3 && parsed[k]!.kind === "gap")) return false;
    }
    return true;
  };
  const on = new Array<boolean>(n).fill(false);
  for (let i = 1; i < n - 1; ) {
    if (!eligible(i)) {
      i++;
      continue;
    }
    const length = 3 + rng.int(4);
    const take = rng.chance(shoulder.share);
    let j = i;
    while (j < n - 1 && j < i + length && eligible(j)) {
      // Lot 58 (v22) : ni sur une famille de blocs nouveaux ni sur les deux blocs qui la suivent (`sansBord`) ; les dégagements exigés (`forced`) restent.
      on[j] = take && !sansBord?.has(j);
      j++;
    }
    i = j;
  }
  // Lot 34 : l'échappatoire d'un virage rapide (son bas-côté, et celui du bloc qui le suit), quel que soit le tirage.
  if (forced) for (const k of forced) if (eligible(k)) on[k] = true;
  const mod = EDGE_MOD[shoulder.kind];
  for (let i = 1; i < n; i++) {
    if (on[i] && !on[i - 1]) tokens[i] = withMod(tokens[i]!, mod);
    else if (!on[i] && on[i - 1]) tokens[i] = withMod(tokens[i]!, "~r");
  }
}

function assignZones(tokens: string[], zones: NonNullable<Theme["zones"]>, rng: Rng, protect?: ReadonlySet<number>): void {
  const n = tokens.length;
  const count = zones.count[0] + rng.int(zones.count[1] - zones.count[0] + 1);
  const total = zones.surfaces.reduce((a, [, w]) => a + w, 0);
  for (let z = 0; z < count; z++) {
    let roll = rng.int(total);
    let surface: BlockSurface = zones.surfaces[0]![0];
    for (const [sf, wgt] of zones.surfaces) {
      if (roll < wgt) {
        surface = sf;
        break;
      }
      roll -= wgt;
    }
    const length = 3 + rng.int(4);
    if (surface === "turf") {
      turfZone(tokens, length, rng, protect);
      continue;
    }
    const last = Math.max(1, n - 2 - length);
    const start = 1 + rng.int(last);
    for (let i = start; i < Math.min(n - 1, start + length); i++) {
      if (!protect?.has(i) && surfaceable(tokens[i]!, i, n)) tokens[i] = withMod(tokens[i]!, surfaceMod(surface));
    }
  }
}

/**
 * Zone d'herbe de course (lot 48, v17) : `length` blocs à la suite qui peuvent tous la porter (ni protégés, ni déjà revêtus, ni virages), à une place
 * tirée parmi toutes celles qui conviennent — une série plus courte (jusqu'à 3) s'il n'y en a pas. Une zone tirée au hasard sans regarder
 * tombait trop souvent sur des plaques ou des approches protégées : l'herbe de course est l'identité de la Campagne, elle doit se voir.
 */
function turfZone(tokens: string[], length: number, rng: Rng, protect?: ReadonlySet<number>): void {
  const n = tokens.length;
  // Lignes droites et pentes seulement : sur l'herbe de course on entre avec sa trajectoire et on la tient (braquer y coûte de la vitesse).
  const ok = (i: number) => !protect?.has(i) && surfaceable(tokens[i]!, i, n) && !isCurve(parseTokenLu(tokens[i]!).kind);
  for (let len = length; len >= 3; len--) {
    const starts: number[] = [];
    for (let i = 1; i + len <= n - 1; i++) {
      let all = true;
      for (let j = i; j < i + len && all; j++) all = ok(j);
      if (all) starts.push(i);
    }
    if (starts.length === 0) continue;
    const start = starts[rng.int(starts.length)]!;
    for (let i = start; i < start + len; i++) tokens[i] = withMod(tokens[i]!, surfaceMod("turf"));
    return;
  }
}

// --- Circuit du jour --------------------------------------------------------------------------

export interface DailyCircuit {
  day: number;
  /** « AAAA-MM-JJ ». */
  date: string;
  /** Numéro affiché (« Circuit du Jour #3 »). */
  number: number;
  /** Tentative retenue (0 = la première graine a convenu ; plus = graines voisines). */
  attempt: number;
  /** Variante du planning (0 = le circuit d'origine ; n ≥ 1 : un remplacement choisi à l'avance, lot 14). */
  variant: number;
  spec: string;
  /** Figures du circuit, dans l'ordre (lot 20) ; vide pour le circuit de secours. */
  figures: PlacedFigure[];
  track: Track;
  authorMs: number;
  /** Lot R9 : la rediffusion du pilote (la « preuve de l'auteur » : le serveur refuse une course qui en est la copie) ; jamais servie aux joueurs. */
  authorReplay: Replay;
  medals: Medals;
  palette: PaletteName;
  /** Thème du circuit (celui du jour, ou le thème forcé pour les essais). */
  theme: ThemeName;
  /** Vrai si le thème a été imposé (essai `?theme=`, ou remplacement du planning) : l'id porte le nom du thème. */
  forcedTheme: boolean;
  /** Vrai si aucune tentative n'a abouti et que le circuit d'essai a servi de secours (ne doit jamais arriver). */
  fallback: boolean;
}

/** Un circuit généré et validé par le pilote (commun au circuit du jour et à ceux du Salon). */
export interface GeneratedCircuit {
  attempt: number;
  spec: string;
  figures: PlacedFigure[];
  track: Track;
  authorMs: number;
  /** Lot R9 : la rediffusion du pilote retenu. */
  authorReplay: Replay;
  medals: Medals;
}

/**
 * Cherche, tentative après tentative, un circuit de `seed` (un numéro de jour, ou la graine d'une session du Salon) pour ce thème :
 * assemblage de figures, durée estimée dans la fenêtre, puis pilote automatique (il finit, dans la fenêtre 30–40 s, à une vitesse de
 * pointe suffisante). `null` si aucune des `MAX_ATTEMPTS` tentatives n'a abouti.
 */
export function generateCircuit(seed: number, theme: Theme, variant: number, id: string, generator = generatorVersionOf(seed)): GeneratedCircuit | null {
  for (let attempt = 0; attempt < maxAttempts(generator); attempt++) {
    const composed = composeFigures(seed, attempt, theme, variant, generator);
    if (!composed) continue;
    const { spec } = composed;
    const estimate = estimateSeconds(spec.split(" "));
    if (estimate < ESTIMATE_MIN || estimate > (generator >= GENERATOR_GRAMMAIRE && attempt < TENTATIVES_GRAMMAIRE ? ESTIMATE_MAX_23 : ESTIMATE_MAX)) continue;
    // Lot 57b (v23) : les règles de variété des sauts sur le circuit fini (les retouches de revêtement, de bosses, de rebords et de bas-côtés ne les défont pas, mais on le vérifie).
    if (generator >= GENERATOR_GRAMMAIRE && attempt < MAX_ATTEMPTS_23 - TENTATIVES_LIBRES && fauteSauts(spec.split(" "))) continue;
    const track = parseTrack(id, spec);
    const first = generator >= 18 ? runPilot(track, { grip: PILOT_GRIPS[0], wall: false }) : undefined;
    if (first && first.valid && first.jumpsOk && first.finishMs > AUTHOR_MAX_MS + QUICK_SLACK_MS) continue;
    // Lot 57b (v23) : un circuit dont le pilote, à la meilleure adhérence, rate la fenêtre d'un saut n'est presque jamais sauvé par une autre adhérence (mesuré : 20 tentatives de suite
    // d'un Canyon, 3,4 s) : on le refuse tout de suite, sans les autres courses.
    if (generator >= GENERATOR_GRAMMAIRE && first && first.valid && !first.jumpsOk) continue;
    // La coupe par le bas-côté (lot 21) n'est essayée que sur la tentative retenue : une course de plus, pas une par tentative.
    const uncut = bestPilotRun(track, { cut: false, first });
    if (!uncut || uncut.finishMs < AUTHOR_MIN_MS || uncut.finishMs > AUTHOR_MAX_MS || uncut.maxSpeed < FAST_PEAK) continue;
    const pilot = withCut(track, uncut, AUTHOR_MIN_MS);
    return { attempt, spec, figures: composed.figures, track, authorMs: pilot.finishMs, authorReplay: pilot.replay, medals: medalsFor(pilot.finishMs, seed, generator) };
  }
  return null;
}

/**
 * Le circuit du jour. `variant` : 0 = le circuit d'origine (identique à celui d'avant le lot 14), n ≥ 1 = une variante du
 * planning ; `forced` impose un thème (id et circuit propres). Un thème imposé par un essai (`?theme=`) n'est jamais classé ;
 * celui du planning l'est (c'est le jeu qui sait d'où il vient).
 */
export function dailyCircuit(day: number, variant = 0, forced?: ThemeName | null, generator = generatorVersionOf(day)): DailyCircuit {
  const theme = (forced ? themeByName(forced) : null) ?? themeForDay(day, generator);
  const forcedTheme = !!forced && !!themeByName(forced);
  const id = dailyTrackId(day, forcedTheme ? theme.name : undefined, variant, generator);
  const found = generateCircuit(day, theme, variant, id, generator);
  if (found) {
    return {
      day,
      date: formatDay(day),
      number: circuitNumber(day),
      attempt: found.attempt,
      variant,
      spec: found.spec,
      figures: found.figures,
      track: found.track,
      authorMs: found.authorMs,
      authorReplay: found.authorReplay,
      medals: found.medals,
      palette: theme.palette,
      theme: theme.name,
      forcedTheme,
      fallback: false,
    };
  }
  // Secours : le circuit d'essai, pour ne jamais laisser le joueur sans circuit.
  const t = createTestTrack();
  const pilot = bestPilotRun(t);
  const authorMs = pilot ? pilot.finishMs : 40_000;
  return {
    day,
    date: formatDay(day),
    number: circuitNumber(day),
    attempt: MAX_ATTEMPTS,
    variant,
    spec: "",
    figures: [],
    track: t,
    authorMs,
    authorReplay: pilot ? pilot.replay : { simVersion: SIM_VERSION, trackId: t.id, runs: [] },
    medals: medalsFor(authorMs, day, generator),
    palette: theme.palette,
    theme: theme.name,
    forcedTheme,
    fallback: true,
  };
}
