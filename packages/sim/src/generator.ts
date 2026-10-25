import { circuitNumber } from "./calendar";
import { bestPilotRun, withCut } from "./autopilot";
import { DEFAULT_CAR_PARAMS } from "./car";
import { createTestTrack } from "./circuits";
import { Rng, formatDay, mixSeed } from "@cdj/core";
import { BASCULE_LOT_49, dailyTrackId, generatorVersionOf } from "./dailyId";
import { SALON_SEED_BASE } from "./salon";
import { medalsFor, type Medals } from "./medals";
import { MAX_BRAKING_ADD, secureBraking } from "./braking";
import { MAX_TIGHT, maxTightOf, themeByName, themeForDay, type PaletteName, type Signature, type Theme, type ThemeName } from "./themes";
import { themeOfVersion } from "./themesVersion";
import { FIGURES, buildFigure, estimateSeconds, minTightTurns, figureByName, figureSeconds, hillRise, surfaceMod, transition, widthAfter, withMod, type Figure, type FigureCategory } from "./figures";
import { blockCells, cellKey, exitDelta, isCurve, isWide, parseToken, parseTrack, type BlockSurface, type Dir, type Track, type WidthLetter } from "./track";

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
// Lot 49 (générateur v18, à partir de `BASCULE_LOT_49`) : les fiches d'identité des thèmes (favorites, vedettes à tour de rôle, interdits), les douze
// nouvelles figures, et la variété garantie entre deux circuits consécutifs d'un même thème (`themeOccurrence`, `orderFigures`).

export * from "./medals";
export * from "./dailyId";

/** Durée visée du pilote : 30 à 40 s, pour qu'une course correcte (or ≈ ×1,08) tienne en 30 à 45 s. */
export const AUTHOR_MIN_MS = 30_000;
export const AUTHOR_MAX_MS = 40_000;
export const MAX_ATTEMPTS = 40;
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
    const parsed = parseToken(t);
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
    const p = parseToken(t);
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
  const k = parseToken(t).kind;
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

/** Poids d'une figure dans le tirage : favorite du thème ×4, super turbo et virages relevés selon les chances du thème. */
function figureWeight(f: Figure, theme: Theme): number {
  let w = f.weight ?? 10;
  if (theme.figures.favor.includes(f.name)) w *= FAVOR;
  // Lot 49 (v18, thèmes à vedettes) : un freinage franc est déjà exigé ; doublé en plus, il faisait revenir les mêmes plaques dans tous les thèmes.
  if (f.braking && !theme.figures.vedettes) w *= 2;
  if (f.turbo) w += Math.round(theme.turboChance / 3);
  if (f.banked) w += Math.round(theme.bankChance / 4);
  return w;
}

/** Une figure propre à des thèmes (`only`, lot 22) ne sort que chez eux. */
const ownedBy = (f: Figure, theme: Theme): boolean => !f.only || f.only.includes(theme.name);
/** Une figure plus récente que le générateur (`since`, lot 48) n'existe pas pour lui : ses circuits ne changent pas. */
const knownBy = (f: Figure, generator: number): boolean => f.since === undefined || generator >= f.since;

const isFast = (f: Figure) => f.category === "rapide" || !!f.turbo;

/** Figures d'un circuit, dans le désordre : signature, relief, saut, cuve, portion rapide, techniques, puis le reste au poids. */
function selectFigures(rng: Rng, theme: Theme, day: number, count: number, wants: { jump: boolean; cuve: boolean }, budget: number, generator: number, vedette: string | null): Figure[] | null {
  const banned = new Set(theme.figures.ban);
  const signature = figureByName(SIGNATURE_FIGURE[theme.signature])!;
  const chosen: Figure[] = [signature];
  const names = new Set([signature.name]);
  const required = new Set(theme.figures.require ?? []);
  const requiredAlso = new Set(theme.figures.requireAlso ?? []);
  // Les figures obligatoires du thème (lot 21) ne sont jamais au repos, comme la signature.
  // Lot 49 (v18) : la vedette du jour n'est jamais au repos ; les autres vedettes du thème attendent leur tour (`vedetteOf`).
  const usable = (f: Figure) => !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator) && !otherVedette(f, theme, vedette);
  const pool = FIGURES.filter((f) => usable(f) && (required.has(f.name) || requiredAlso.has(f.name) || f.name === vedette || !isRested(f.name, day)));
  // Lot 49 (v18) : sans super turbo, un thème n'a que trois ou quatre figures de freinage franc ou de portion rapide ; si toutes sont au repos ce jour-là,
  // on en prend une qui l'est (sinon aucune tentative du jour n'aboutit : mesuré au Rallye et à la Campagne).
  const rested = generator >= 18 ? FIGURES.filter((f) => usable(f) && !pool.includes(f)) : [];
  const count_ = (pred: (f: Figure) => boolean) => chosen.filter(pred).length;
  const allowed = (f: Figure) =>
    !names.has(f.name) &&
    (!f.jump || count_((g) => !!g.jump) < CAP_JUMPS) &&
    (!f.cuve || count_((g) => !!g.cuve) < CAP_CUVES) &&
    (!f.cut || count_((g) => !!g.cut) < CAP_CUTS) &&
    chosen.reduce((sum, g) => sum + minTightTurns(g), 0) + minTightTurns(f) <= maxTightOf(theme) &&
    count_((g) => g.category === f.category) < CAP_CATEGORY[f.category];
  const pick = (pred: (f: Figure) => boolean, from = pool): Figure | null => {
    const list = from.filter((f) => allowed(f) && pred(f));
    if (list.length === 0) return null;
    let roll = rng.int(list.reduce((sum, f) => sum + figureWeight(f, theme), 0));
    for (const f of list) {
      const w = figureWeight(f, theme);
      if (roll < w) return f;
      roll -= w;
    }
    return list[0]!;
  };
  const add = (f: Figure | null): boolean => {
    if (!f) return false;
    chosen.push(f);
    names.add(f.name);
    return true;
  };
  // Lot 49 (v18) : la vedette du jour, juste après la signature.
  if (vedette && !add(pick((f) => f.name === vedette))) return null;
  // La règle propre du thème (lot 21) : l'une de ses figures obligatoires, si la signature n'en est pas une.
  if (required.size > 0 && !chosen.some((f) => required.has(f.name)) && !add(pick((f) => required.has(f.name)))) return null;
  // Lot 48 (v17) : une seconde règle propre (Campagne : une figure d'herbe de course).
  if (requiredAlso.size > 0 && !chosen.some((f) => requiredAlso.has(f.name)) && !add(pick((f) => requiredAlso.has(f.name)))) return null;
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
  if (generator >= 18 && !chosen.some((f) => f.braking) && !chosen.some(isFast)) add(pick((f) => !!f.braking && isFast(f))) || add(pick((f) => !!f.braking && isFast(f), rested));
  while (chosen.filter((f) => f.braking).length < MIN_BRAKING) if (!add(pick((f) => !!f.braking)) && !add(pick((f) => !!f.braking, rested))) return null;
  if (!chosen.some(isFast) && !add(pick(isFast)) && !add(pick(isFast, rested))) return null;
  // Une figure favorite du thème (en plus de la signature), si elle tient dans le budget : c'est ce qui donne au thème sa couleur.
  const seconds = () => chosen.reduce((sum, f) => sum + figureSeconds(f), 0);
  if (!chosen.some((f) => f !== signature && theme.figures.favor.includes(f.name))) add(pick((f) => theme.figures.favor.includes(f.name) && seconds() + figureSeconds(f) <= budget + FAVORITE_SLACK));
  // Lot 49 (v18) : la vedette tient lieu d'une des deux techniques (elle est le moment fort du thème ; sans cela le circuit sort trop long).
  const minTechniques = vedette ? MIN_TECHNIQUES - 1 : MIN_TECHNIQUES;
  while (count_((f) => f.category === "technique") < minTechniques) if (!add(pick((f) => f.category === "technique"))) return null;
  // Le reste, au poids : jusqu'à cinq figures quoi qu'il arrive (les plus courtes si le budget est dépassé), puis tant que le budget le permet.
  const total = () => chosen.reduce((sum, f) => sum + figureSeconds(f), 0);
  while (chosen.length < count) {
    const room = budget - total();
    const fitting = pick((f) => figureSeconds(f) <= room);
    if (fitting) add(fitting);
    else if (chosen.length < FIGURES_MIN) {
      const pool_ = pool.filter(allowed).sort((a, b) => figureSeconds(a) - figureSeconds(b));
      if (!add(pool_[0] ?? null)) break;
    } else break;
  }
  return chosen;
}

/**
 * Lot 49 (v18) — **variété garantie**. `themeOccurrence(jour, thème)` = le numéro d'apparition du thème depuis la bascule du lot 49 (le nombre de jours
 * d'avant, depuis la bascule, qui ont ce thème : `themeForDay` jour après jour, quelques microsecondes ; rien n'est généré). Deux circuits consécutifs
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
const occurrences = new Map<string, number>();
export function themeOccurrence(day: number, theme: ThemeName): number {
  if (day >= SALON_SEED_BASE) return day - SALON_SEED_BASE;
  const key = `${theme}:${day}`;
  let k = occurrences.get(key);
  if (k === undefined) {
    k = 0;
    for (let d = BASCULE_LOT_49; d < day; d++) if (themeForDay(d).name === theme) k++;
    if (occurrences.size > 512) occurrences.clear();
    occurrences.set(key, k);
  }
  return k;
}
/** La vedette d'une apparition du thème (lot 49), ou `null` pour un thème sans vedettes. */
export function vedetteOf(theme: Theme, occurrence: number): string | null {
  const v = theme.figures.vedettes;
  return v && v.length > 0 ? v[occurrence % v.length]! : null;
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

/** Liaisons entre deux figures : le plus souvent rien ou une droite ; parfois une plaque ou une bosse. */
const CONNECTORS: readonly (readonly string[])[] = [[], [], [], [], [], ["S"], ["S", "P", "S", "S"], ["S", "B", "S"]];

/**
 * Texte d'un circuit pour (jour, tentative, thème), avec ses figures, ou `null` si la construction s'est coincée.
 * Les figures sont tirées dans une bibliothèque (figures.ts) : signature du thème, relief, saut, cuve, portion rapide, au moins deux
 * techniques, le tout au poids du thème (favorites ×4, interdites exclues) et sans les figures « au repos » ce jour-là ; jamais la même
 * figure deux fois. Chacune est posée dans un sens (miroir) et avec une variante tirés au sort, la première qui tient sur la grille
 * (sans croisement, sans dépasser les hauteurs permises, dans le budget de virages serrés) l'emporte.
 */
export function composeFigures(day: number, attempt: number, themeAsked: Theme = themeForDay(day), variant = 0, generator = generatorVersionOf(day)): Composition | null {
  // Lot 34 (v16) : freinage possible après un boost (`secureBraking`, braking.ts) ; v15 : les règles d'avant, au tirage près.
  const rules34 = generator >= 16;
  // Lot 48 (v17) : le thème tel que cette version le connaît (la Campagne roule sur l'herbe de course) ; avant, le thème tel quel.
  const theme = themeOfVersion(themeAsked, generator);
  // Lot 49 (v18) : le numéro d'apparition du thème, sa vedette et le sens de l'ordre des figures ; un thème sans super turbo n'en pose aucun.
  const rules49 = generator >= 18;
  const occurrence = rules49 ? themeOccurrence(day, theme.name) : 0;
  const vedette = rules49 ? vedetteOf(theme, occurrence) : null;
  const order49: Order49 | null = rules49 ? { theme: theme.name, even: occurrence % 2 === 0 } : null;
  const noTurbo = rules49 && theme.turboChance === 0;
  // Le tiers de figures au repos (`isRested`) : par la date avant la v18 ; à partir d'elle, par le numéro d'apparition, k + ⌊k / n⌋ (mod 3), n le nombre
  // de vedettes (3 ou 4) : il change d'une apparition à la suivante, et deux apparitions qui ont la même vedette (k et k + n) n'ont jamais le même repos.
  const restDay = rules49 ? occurrence + Math.floor(occurrence / (theme.figures.vedettes?.length ?? 3)) : day;
  // Variante 0 : la graine d'origine. Variante n : une autre graine, décalée de n × 1000 tentatives (au plus `MAX_ATTEMPTS` = 40 sont
  // tirées : jamais de recoupement entre variantes).
  const rng = new Rng(mixSeed(day, attempt + 1 + variant * 1000));
  const count = FIGURES_MIN + rng.int(FIGURES_SPAN);
  // Plusieurs tirages de figures, le premier dont la durée estimée tient dans le budget l'emporte (sinon le plus court) : les figures
  // obligatoires d'un thème (saut, cuve, signature) pèsent lourd, et sept tirages sur dix donneraient un circuit trop long.
  // Un saut et une cuve, selon les chances du thème : tirés une fois pour toutes (les tirages de figures ne les écartent pas).
  const wants = { jump: rng.chance(theme.jumpChance), cuve: theme.cuveChance > 0 && rng.chance(theme.cuveChance) };
  let picked: Figure[] | null = null;
  let best = -Infinity;
  for (let tries = 0; tries < SELECTION_TRIES; tries++) {
    const candidate = selectFigures(rng, theme, restDay, count, wants, rules34 ? FIGURE_BUDGET - BRAKING_BUDGET : FIGURE_BUDGET, generator, vedette);
    if (!candidate) continue;
    const seconds = candidate.reduce((sum, f) => sum + figureSeconds(f), 0);
    // Hors budget : on garde le plus court seulement faute de mieux ; dans le budget : celui où l'on lâche le plus le gaz (somme des `off` des figures).
    const score = (seconds <= FIGURE_TOTAL_MAX - (rules34 ? BRAKING_BUDGET : 0) ? 1000 : -seconds) + candidate.reduce((sum, f) => sum + f.off, 0);
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
  const signatureName = SIGNATURE_FIGURE[theme.signature];
  // Lot 34 : virages qui reçoivent un bas-côté, blocs d'approche protégés, un seul virage-piège (signature, ou Ville).
  const escapes = new Set<number>();
  const shielded = new Set<number>();
  const braking = { kept: 0, added: 0, escapes: 0 };
  const escapeKind = theme.shoulder.kind !== "void" && theme.shoulder.share > 0;

  for (let i = 0; i < order.length; i++) {
    // Une figure qui ne tient pas est remplacée par une autre de la même catégorie (même nature : saut, cuve, moteur coupé) ;
    // la signature, elle, ne se remplace pas : la tentative échoue et la graine voisine prend le relais.
    const alternatives = [order[i]!];
    if (order[i]!.name !== signatureName && order[i]!.name !== vedette) {
      const f0 = order[i]!;
      const banned = new Set(theme.figures.ban);
      // Lot 49 (v18) : une remplaçante suit le sens permis avec la figure posée avant et celle qui suit (aucun enchaînement en commun avec la veille du thème).
      const prev = placed.length > 0 ? placed[placed.length - 1]!.name : null;
      const next = i + 1 < order.length ? order[i + 1]!.name : null;
      const keepsOrder = (f: Figure) => !order49 || ((prev === null || may(order49, prev, f.name)) && (next === null || may(order49, f.name, next)));
      const subs = FIGURES.filter((f) => f.category === f0.category && !!f.jump === !!f0.jump && !!f.cuve === !!f0.cuve && !!f.cut === !!f0.cut && !names.has(f.name) && !banned.has(f.name) && ownedBy(f, theme) && knownBy(f, generator) && !isRested(f.name, restDay) && !otherVedette(f, theme, vedette) && keepsOrder(f));
      alternatives.push(...rng.shuffle(subs).slice(0, 3));
    }
    let done: { figure: Figure; tokens: string[]; variant: number; left: boolean; before: number; fix: ReturnType<typeof secureBraking> } | null = null;
    for (const figure of alternatives) {
      // Pas de liaison derrière une longue ligne droite (le dégagement d'une figure suffit), ni avant le premier.
      const connector = i === 0 || trailingStraights(w.tokens) > 1 ? [] : [...CONNECTORS[rng.int(CONNECTORS.length)]!];
      const target = changeSlots.has(i) ? pickWidth(rng, weights, NEXT_WIDTHS[width]) : null;
      const variants = rng.shuffle(Array.from({ length: figure.variants }, (_, v) => v));
      const banked = rng.chance(theme.bankChance); // virages relevés dans cette figure (selon le thème), sauf si elle n'a pas de virage ordinaire
      const mirrors = rng.chance(50) ? [true, false] : [false, true];
      outer: for (const withChange of target ? [true, false] : [false]) {
        const entry = withChange ? target! : width;
        const prefix = withChange ? [transition(width, target!)] : [];
        for (const v of variants) {
          for (const left of mirrors) {
            const plain = buildFigure(figure, left, entry, v);
            if (!plain || (noTurbo && plain.some((t) => /^T(\/|@|$)/.test(t)))) continue;
            const body = banked && !figure.cuve ? bankTurns(plain) : plain;
            // La droite d'amorce d'une figure est celle qui termine la précédente (ou le départ) : on ne la pose pas deux fois.
            const lead = connector.length === 0 && prefix.length === 0 && body[0] === "S" && /^S(\/[a-z]*)?(@start)?$/.test(w.tokens[w.tokens.length - 1] ?? "") ? 1 : 0;
            // Lot 49 (v18) : un saut en tête du circuit part de deux droites de plus (la voiture part de zéro).
            const runUp = rules49 && i === 0 && figure.jump ? ["S", "S"] : [];
            let tokens = [...(figure.jump || figure.cuve ? [] : connector), ...prefix, ...runUp, ...body.slice(lead)];
            const fix = rules34 ? secureBraking(w.tokens, tokens, { escape: escapeKind, allowTrap: braking.kept === 0 && (theme.name === "ville" || figure.name === signatureName) }) : null;
            if (rules34 && !fix) continue;
            if (fix) tokens = fix.tokens;
            if (tightCount(tokens) > tightLeft || !fits(w.y, tokens)) continue;
            // Le premier relief d'un circuit fait au moins deux niveaux : c'est lui qui garantit le dénivelé minimal.
            if (figure.relief && !majorHill && hillRise(body) < MIN_RELIEF) continue;
            const before = w.tokens.length;
            if (!place(w, tokens)) continue;
            done = { figure, tokens, variant: v, left, before, fix };
            break outer;
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
    width = widthAfter(done.tokens, width);
    usedWidths.add(width);
  }

  // Dernière ligne droite puis arrivée.
  if (!place(w, ["S"]) && !place(w, ["S", "S"])) return null;
  if (!place(w, ["S@finish"])) return null;
  if (usedWidths.size < 2) return null; // au moins deux largeurs par circuit
  if (placed.some((p) => figureByName(p.name)!.cuve) && !w.tokens.some((t) => parseToken(t).cuve)) return null;
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
  assignShoulders(w.tokens, theme.shoulder, rng, escapes);
  // Lot 49 (v18) : la Nuit (bas-côté de vide) a toujours de la route sans rebords — c'est sa fiche ; sinon, la graine voisine.
  if (rules49 && theme.shoulder.kind === "void" && !w.tokens.some((t) => parseToken(t).open || t.includes("~v"))) return null;
  return { spec: w.tokens.join(" "), figures: placed, braking };
}

/** Texte d'un circuit pour (jour, tentative, thème), ou `null` si la construction s'est coincée (voir `composeFigures`). */
export function composeSpec(day: number, attempt: number, theme: Theme = themeForDay(day), variant = 0, generator = generatorVersionOf(day)): string | null {
  return composeFigures(day, attempt, theme, variant, generator)?.spec ?? null;
}

/** Blocs qui reçoivent un revêtement : droites, virages, côtes d'un niveau (pas les effets, bosses, rampes, vides, côtes raides ni le départ / l'arrivée). */
function surfaceable(token: string, index: number, n: number): boolean {
  if (index === 0 || index >= n - 1 || token.includes("/")) return false;
  const p = parseToken(token);
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
    const p = parseToken(t);
    entry.push(y);
    y += exitDelta(p.kind, p.rise);
    exit.push(y);
    low = Math.min(low, y, entry[entry.length - 1]!);
  }
  const ok = (i: number): boolean => {
    if (i < 1 || i >= n - 2 || shielded?.has(i)) return false;
    const k = parseToken(tokens[i]!).kind;
    if (k === "kick" || k === "gap" || k === "jump" || parseToken(tokens[i]!).cuve) return false;
    // Le bloc d'avant un saut garde ses rebords (la rampe commence sur une route fermée), comme la réception.
    const next = parseToken(tokens[i + 1]!).kind;
    const prev = parseToken(tokens[i - 1]!).kind;
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
  const beforeKick = (i: number) => tokens.slice(i + 1, i + 4).some((t) => parseToken(t).kind === "kick");
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
function assignShoulders(tokens: string[], shoulder: Theme["shoulder"], rng: Rng, forced?: ReadonlySet<number>): void {
  const n = tokens.length;
  const parsed = tokens.map((t) => parseToken(t));
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
      on[j] = take;
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
  const ok = (i: number) => !protect?.has(i) && surfaceable(tokens[i]!, i, n) && !isCurve(parseToken(tokens[i]!).kind);
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
  medals: Medals;
}

/**
 * Cherche, tentative après tentative, un circuit de `seed` (un numéro de jour, ou la graine d'une session du Salon) pour ce thème :
 * assemblage de figures, durée estimée dans la fenêtre, puis pilote automatique (il finit, dans la fenêtre 30–40 s, à une vitesse de
 * pointe suffisante). `null` si aucune des `MAX_ATTEMPTS` tentatives n'a abouti.
 */
export function generateCircuit(seed: number, theme: Theme, variant: number, id: string, generator = generatorVersionOf(seed)): GeneratedCircuit | null {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const composed = composeFigures(seed, attempt, theme, variant, generator);
    if (!composed) continue;
    const { spec } = composed;
    const estimate = estimateSeconds(spec.split(" "));
    if (estimate < ESTIMATE_MIN || estimate > ESTIMATE_MAX) continue;
    const track = parseTrack(id, spec);
    // La coupe par le bas-côté (lot 21) n'est essayée que sur la tentative retenue : une course de plus, pas une par tentative.
    const uncut = bestPilotRun(track, { cut: false });
    if (!uncut || uncut.finishMs < AUTHOR_MIN_MS || uncut.finishMs > AUTHOR_MAX_MS || uncut.maxSpeed < FAST_PEAK) continue;
    const pilot = withCut(track, uncut, AUTHOR_MIN_MS);
    return { attempt, spec, figures: composed.figures, track, authorMs: pilot.finishMs, medals: medalsFor(pilot.finishMs, seed) };
  }
  return null;
}

/**
 * Le circuit du jour. `variant` : 0 = le circuit d'origine (identique à celui d'avant le lot 14), n ≥ 1 = une variante du
 * planning ; `forced` impose un thème (id et circuit propres). Un thème imposé par un essai (`?theme=`) n'est jamais classé ;
 * celui du planning l'est (c'est le jeu qui sait d'où il vient).
 */
export function dailyCircuit(day: number, variant = 0, forced?: ThemeName | null, generator = generatorVersionOf(day)): DailyCircuit {
  const theme = (forced ? themeByName(forced) : null) ?? themeForDay(day);
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
    medals: medalsFor(authorMs, day),
    palette: theme.palette,
    theme: theme.name,
    forcedTheme,
    fallback: true,
  };
}
