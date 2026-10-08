import { GENERATOR_VERSION } from "./constants";
import { circuitNumber, formatDay } from "./calendar";
import { bestPilotRun } from "./autopilot";
import { DEFAULT_CAR_PARAMS } from "./car";
import { createTestTrack } from "./circuits";
import { Rng, mixSeed } from "./rng";
import { themeByName, themeForDay, type PaletteName, type Signature, type Theme, type ThemeName } from "./themes";
import { blockCells, cellKey, exitDelta, isCurve, isWide, parseToken, parseTrack, type Dir, type SurfaceKind, type Track, type WidthLetter } from "./track";

// Le circuit du jour : généré à partir de la date (graine = jour UTC), identique pour tout le monde.
//
// 1. Construction : on enchaîne des « segments » (courts motifs de blocs) en alternant calme (lignes droites,
//    plaques, bosses, côtes) et virages (le plus souvent larges : 2 × 2 cellules, ou amples : 3 × 3 ; au plus deux
//    virages serrés, jamais l'un derrière l'autre), avec un ou deux passages marquants (tremplin, S large, demi-tour).
//    La largeur de la route change par des blocs de transition (au moins deux largeurs par circuit, dominantes selon
//    le thème) ; un virage serré ne se pose pas sur la route large.
//    Relief (lot 17) : des collines de un à trois niveaux (montées, crêtes, descentes plus ou moins raides), un vrai saut
//    (rampe, vide, réception) selon le thème, des sections sans rebords sur les parties surélevées.
//    On place chaque segment sur la grille en refusant les croisements.
// 2. Validation : un pilote automatique parcourt le circuit avec la même physique. S'il ne le finit pas, ou si
//    sa durée sort de la fenêtre visée, on recommence avec une graine voisine (tentative suivante).
// 3. Le temps du pilote est le temps de l'auteur ; les médailles en découlent.

/** Durée visée du pilote : 30 à 40 s, pour qu'une course correcte (or ≈ ×1,08) tienne en 30 à 45 s. */
export const AUTHOR_MIN_MS = 30_000;
export const AUTHOR_MAX_MS = 40_000;
export const MAX_ATTEMPTS = 40;
/**
 * Vitesse que le pilote doit dépasser au moins une fois (lot 15) : 30 % au-dessus de la pointe du plat. Un circuit sans
 * portion rapide (descente, turbos, grande courbe prise à fond) est refusé, graine voisine.
 */
export const FAST_PEAK = DEFAULT_CAR_PARAMS.maxSpeed * 1.3;

/** Seuils des médailles, en multiples du temps de l'auteur. */
export const MEDAL_FACTORS = { gold: 1.08, silver: 1.2, bronze: 1.4 } as const;

export type Medal = "author" | "gold" | "silver" | "bronze";

export interface Medals {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

export function medalsFor(authorMs: number): Medals {
  return {
    author: authorMs,
    gold: Math.round(authorMs * MEDAL_FACTORS.gold),
    silver: Math.round(authorMs * MEDAL_FACTORS.silver),
    bronze: Math.round(authorMs * MEDAL_FACTORS.bronze),
  };
}

/** Meilleure médaille obtenue avec ce temps, ou `null`. */
export function medalFor(ms: number, medals: Medals): Medal | null {
  if (ms <= medals.author) return "author";
  if (ms <= medals.gold) return "gold";
  if (ms <= medals.silver) return "silver";
  if (ms <= medals.bronze) return "bronze";
  return null;
}

/** Plus grand numéro de variante accepté (lot 14) : au-delà, la graine déborderait sur celle des tentatives. */
export const MAX_VARIANT = 99;

/** Vrai pour un numéro de variante valide : entier de 0 à `MAX_VARIANT`. */
export const isVariant = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_VARIANT;

/**
 * Identifiant du circuit d'un jour. La variante 0 (le circuit d'origine) n'a pas de suffixe : les circuits d'avant le lot 14
 * gardent leur identifiant (rediffusions et références inchangées) ; une variante n ≥ 1 ajoute `-v<n>`. Un thème imposé
 * (essais, ou remplacement du planning) ajoute son nom : un autre circuit.
 */
export function dailyTrackId(day: number, theme?: ThemeName | null, variant = 0): string {
  return `jour-${formatDay(day)}-g${GENERATOR_VERSION}${variant > 0 ? `-v${variant}` : ""}${theme ? `-${theme}` : ""}`;
}

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

/**
 * Lignes droites obligatoires après une plaque d'accélération, avant le virage suivant : elle pousse la voiture
 * pendant ~0,9 s, et pendant ce temps le frein (40 m/s²) lutte contre la poussée (30 m/s²). Avec une pointe à
 * 48 m/s, une plaque suivie d'un virage serré à moins de ~80 m ne se prend pas (mesuré au 7b : le pilote ne
 * finissait que 28 circuits sur 91).
 */
const PAD_RUNOUT = 2;
/** Idem pour un super turbo (poussée 42 m/s² pendant 1,5 s, jusqu'à 68 m/s) : bien plus de dégagement. */
const TURBO_RUNOUT = 5;
/** Créneaux calme + virage d'un circuit : 4 à 6 (5 à 7 au lot 12, 8 à 11 avant : les portions rapides du lot 15 allongent le circuit en cellules, donc un créneau de moins). */
const TURNS_MIN = 4;
const TURNS_SPAN = 3;
/** Virages serrés (une cellule, rayon 16 m) : au plus 2 par circuit passage signature compris, jamais deux d'affilée. */
const MAX_TIGHT = 2;

type Highlight = "chicane" | "hairpin";

/**
 * Reliefs (créneaux calmes), du plus doux au plus raide. `U` / `D` : un niveau (4 m) sur une cellule ; `U2` / `D2` et `U3` / `D3` :
 * deux et trois niveaux sur une cellule (pente 0,25 et 0,375). Un dos d'âne (`U2 D2`) fait décoller à haute vitesse : trois
 * lignes droites derrière lui pour atterrir (`CREST_RUNOUT`). Chaque motif revient en général à son niveau de départ.
 */
const CREST_RUNOUT = 3;
const crest = (up: string, down: string) => [up, down, ...Array<string>(CREST_RUNOUT).fill("S")];
const HILLS_GENTLE: readonly (readonly string[])[] = [
  ["U", "U", "S", "D", "D"], // montée de deux niveaux, crête, descente
  ["U", "S", "D"],
  ["D", "S", "U"], // creux
  ["D", "D", "S", "U", "U"],
  ["U", "U", "U", "S", "D", "D", "D"], // trois niveaux, long
];
const HILLS_STEEP: readonly (readonly string[])[] = [
  ["U2", "S", "D2"],
  ["U3", "S", "D3"],
  ["U2", "S", "D", "D", "D"], // montée raide, longue descente (rend un niveau de moins)
  ["U", "U", "S", "D2", "D"],
  ["D2", "S", "U2"],
  crest("U2", "D2"),
  crest("U3", "D3"),
  ["U3", "S", "D2", "D"],
  ["U2", "S", "S", "S", "D2"], // plateau surélevé : de la place pour une section sans rebords
  ["U3", "S", "S", "S", "D3"],
];
/** Hauteurs extrêmes atteintes par une suite de blocs partie de 0 (m), et son dénivelé net. */
function extent(seg: readonly string[]): { hi: number; lo: number; net: number } {
  let y = 0;
  let hi = 0;
  let lo = 0;
  for (const t of seg) {
    const p = parseToken(t);
    y += exitDelta(p.kind, p.rise);
    if (y > hi) hi = y;
    if (y < lo) lo = y;
  }
  return { hi, lo, net: y };
}
/** Dénivelé d'un relief (m) : sa hauteur la plus haute moins la plus basse. */
const hillRise = (seg: readonly string[]): number => {
  const e = extent(seg);
  return e.hi - e.lo;
};
/** Dénivelé d'un circuit (m, du point le plus bas au plus haut de la route) : le critère `MIN_RELIEF`. */
export function reliefOf(tokens: readonly string[]): number {
  return hillRise(tokens);
}

/**
 * Sauts (lot 17) : rampe `K`, vide `G` (32 m par cellule), réception. `GD` : le bord d'en face est un niveau plus bas que le bord de
 * la rampe. La voiture doit atteindre une vitesse minimale au bord de la rampe (voir `jumpMinSpeed`, jump.ts), faute de quoi
 * elle tombe ; les sauts longs partent d'une plaque (66 m/s) ou d'un super turbo (88 m/s). Trois lignes droites au moins derrière
 * un saut court, cinq derrière un saut long, pour freiner avant le virage suivant.
 * - court : de la rampe au vide, atterrissage un niveau plus bas (fenêtre ≥ 33 m/s) ;
 * - plat : vide au niveau de la rampe, réception en descente, après une plaque (fenêtre ≥ 40 m/s : la plaque en donne plus de 60) ;
 * - long : deux cellules de vide après un super turbo (fenêtre ≥ 58 m/s) ;
 * - long bas : deux cellules, atterrissage plus bas, après une plaque (fenêtre ≥ 52 m/s) ;
 * - haut : le bord d'en face est un niveau plus haut, après un super turbo (fenêtre ≥ 54 m/s).
 */
type JumpKind = "short" | "flat" | "long" | "longDown" | "up";
const JUMP_KINDS: readonly JumpKind[] = ["short", "flat", "long", "longDown", "up"];
const JUMP_WEIGHTS: Record<JumpKind, number> = { short: 3, flat: 3, long: 2, longDown: 2, up: 1 };
const JUMP_LANDING = 3;
const JUMP_LANDING_LONG = 5;
function jumpCalm(kind: JumpKind, surface = ""): string[] {
  const s = (t: string) => (surface ? withMod(t, surface) : t);
  const land = (n: number) => Array<string>(n).fill("S").map(s);
  switch (kind) {
    case "short":
      return [...["S", "S", "S"].map(s), s("K"), "GD", ...land(JUMP_LANDING)];
    case "flat":
      return [s("S"), "P", s("S"), s("K"), "G", s("D"), ...land(JUMP_LANDING)];
    case "long":
      return ["S", "T", "S", "S", "K", "G", "G", s("D"), ...land(JUMP_LANDING_LONG)];
    case "longDown":
      return ["S", "P", "S", "K", "G", "GD", s("D"), ...land(JUMP_LANDING_LONG - 1)];
    case "up":
      return ["S", "T", "S", "S", "K", "GU", ...land(JUMP_LANDING_LONG)];
  }
}

/**
 * Portions rapides (lot 15) : un créneau calme qui lance la voiture bien au-delà de la pointe du plat.
 * - `chain` : deux super turbos à trois blocs d'écart sur une ligne droite (le second prolonge le premier) ;
 * - `drop` : une plaque en haut d'une longue descente (six blocs) ;
 * - `bank` : un super turbo, puis une grande courbe relevée prise à fond (virage de la même case).
 * Chacune garde assez de lignes droites derrière elle pour freiner (`TURBO_RUNOUT`, `PAD_RUNOUT`).
 */
type Fast = "chain" | "drop" | "bank";
const FAST_KINDS: readonly Fast[] = ["chain", "drop", "bank"];

function fastCalm(kind: Fast): string[] {
  switch (kind) {
    case "chain":
      return ["S", "T", "S", "S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")];
    case "drop":
      return ["S", "P", "D", "D", "D", "D", "D", "D", ...Array<string>(PAD_RUNOUT).fill("S")];
    case "bank":
      return ["S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")];
  }
}

/** Ajoute un modificateur (`g`, `t`, `h`, `b`) à un bloc de la notation, avant son repère éventuel. */
function withMod(token: string, mod: string): string {
  const [body, mark] = token.split("@");
  const next = body!.includes("/") ? body + mod : `${body}/${mod}`;
  return mark === undefined ? next : `${next}@${mark}`;
}

const SURFACE_MOD: Record<SurfaceKind, string> = { road: "", dirt: "t", ice: "g", grass: "h" };
const surfaceOnly = (tokens: string[], surface: SurfaceKind) => tokens.map((t) => withMod(t, SURFACE_MOD[surface]));

// --- Largeurs ---------------------------------------------------------------------------------

const WIDTH_LETTERS: readonly WidthLetter[] = ["e", "n", "l"];
/** Une transition passe à la largeur voisine (14 ↔ 20 ↔ 26 m) : jamais de saut de 12 m en un bloc. */
const NEXT_WIDTHS: Record<WidthLetter, readonly WidthLetter[]> = { e: ["n"], n: ["e", "l"], l: ["n"] };

/** Bloc de transition de largeur (une ligne droite de 32 m dont les rebords s'écartent ou se resserrent en douceur). */
const transition = (from: WidthLetter, to: WidthLetter) => `S/${from}>${to}`;

/** Largeur de la route à la fin d'une suite de blocs (les seuls blocs qui écrivent une largeur sont les transitions). */
function widthAfter(tokens: readonly string[], width: WidthLetter): WidthLetter {
  let w = width;
  for (const t of tokens) {
    const m = /\/[^@]*?[enl]>([enl])/.exec(t);
    if (m) w = m[1] as WidthLetter;
  }
  return w;
}

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

/**
 * Passages signature : (créneau calme, virages possibles à la suite). `L` / `R` : le sens tiré pour ce virage ; `width` :
 * la largeur au début du créneau. Un passage signature ne se remplace pas : s'il ne tient pas sur la grille, la tentative échoue.
 */
function signatureParts(sig: Signature, L: string, R: string, width: WidthLetter): { calm: string[]; turn?: string[][] } {
  switch (sig) {
    case "turboBank": // super turbo sur une ligne droite, puis grand virage relevé
      return { calm: ["S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")], turn: [[withMod(L + "2", "b")], [withMod(R + "2", "b")]] };
    case "dirtJump": // saut court sur la terre : rampe de terre, vide, réception de terre
      return { calm: jumpCalm("short", SURFACE_MOD.dirt) };
    case "iceChicane": // chicane large sur la glace, après une ligne droite verglacée
      return { calm: ["S/g", "S/g"], turn: [[`${L}2/g`, `${R}2/g`], [`${R}2/g`, `${L}2/g`]] };
    case "cutRun": // moteur coupé, puis point de contrôle deux blocs plus loin (voir composeSpec)
      return { calm: ["S", "S", "C", "S", "S"] };
    case "dirtPinch": {
      // étranglement : la route se resserre jusqu'à 14 m, puis un virage serré sur la terre, au bout de la ligne droite étroite
      const narrowing: string[] = [];
      if (width === "l") narrowing.push(withMod(transition("l", "n"), "t"));
      if (width !== "e") narrowing.push(withMod(transition("n", "e"), "t"));
      return { calm: ["S/t", ...narrowing, "S/t"], turn: [[`${L}/t`], [`${R}/t`]] };
    }
  }
}

/** Vrai si la suite de blocs, posée à la hauteur `y`, reste entre `Y_MIN` et `Y_MAX`. */
function fits(y: number, seg: readonly string[]): boolean {
  const e = extent(seg);
  return y + e.hi <= Y_MAX && y + e.lo >= Y_MIN;
}

/** Texte d'un circuit pour (jour, tentative, thème), ou `null` si la construction s'est coincée. */
export function composeSpec(day: number, attempt: number, theme: Theme = themeForDay(day), variant = 0): string | null {
  // Variante 0 : la graine d'avant le lot 14 (circuits inchangés). Variante n : une autre graine, décalée de n × 1000
  // tentatives (au plus `MAX_ATTEMPTS` = 40 sont tirées : jamais de recoupement entre variantes).
  const rng = new Rng(mixSeed(day, attempt + 1 + variant * 1000));
  const turns = TURNS_MIN + rng.int(TURNS_SPAN);
  // Créneaux : calme, virage, calme, virage, …, calme final. Les passages marquants prennent des créneaux distincts, dans cet ordre
  // de priorité : passage signature, saut, virages marquants, portions rapides (celles-là se perdent si la place manque : le pilote
  // refuse alors le circuit faute de portion rapide, et la graine voisine prend le relais).
  const freeSlot = (from: number, to: number, taken: (i: number) => boolean): number => {
    const start = from + rng.int(to - from + 1);
    for (let k = 0; k <= to - from; k++) {
      const i = from + ((start - from + k) % (to - from + 1));
      if (!taken(i)) return i;
    }
    return -1;
  };
  const signatureSlot = freeSlot(1, turns - 2, () => false);
  // Vrai saut (lot 17) : un créneau calme au milieu du circuit (ni le premier, où la voiture part de zéro, ni le dernier : pas de
  // saut juste avant l'arrivée), du type tiré selon les poids.
  const jumpSlot = new Map<number, JumpKind>();
  if (rng.chance(theme.jumpChance)) {
    let roll = rng.int(JUMP_KINDS.reduce((sum, k) => sum + JUMP_WEIGHTS[k], 0));
    let kind = JUMP_KINDS[0]!;
    for (const k of JUMP_KINDS) {
      if (roll < JUMP_WEIGHTS[k]) {
        kind = k;
        break;
      }
      roll -= JUMP_WEIGHTS[k];
    }
    const slot = freeSlot(1, turns - 2, (i) => i === signatureSlot);
    if (slot >= 0) jumpSlot.set(slot, kind);
  }
  const pickHighlights = rng.shuffle<Highlight>(["chicane", "hairpin"]).slice(0, 1 + rng.int(2));
  const turnSlot = new Map<number, Highlight>();
  for (const h of pickHighlights) {
    const slot = freeSlot(0, turns - 1, (i) => turnSlot.has(i) || i === signatureSlot);
    if (slot >= 0) turnSlot.set(slot, h);
  }
  // Portions rapides : un ou deux créneaux calmes de plus, distincts du saut (un décollage coupe tout freinage).
  const fastSlot = new Map<number, Fast>();
  for (const kind of rng.shuffle<Fast>([...FAST_KINDS]).slice(0, 1 + rng.int(2))) {
    const slot = freeSlot(0, turns - 2, (i) => fastSlot.has(i) || jumpSlot.has(i) || i === signatureSlot);
    if (slot >= 0) fastSlot.set(slot, kind);
  }
  // Reliefs : des créneaux calmes libres (ni saut, ni portion rapide, ni signature). Le premier relief d'un circuit est toujours
  // d'au moins deux niveaux : c'est lui qui garantit le dénivelé minimal.
  const hillSlot = new Set<number>();
  const hillCount = theme.relief.hills[0] + rng.int(theme.relief.hills[1] - theme.relief.hills[0] + 1);
  for (let tries = 0; hillSlot.size < hillCount && tries < 3 * turns; tries++) {
    const i = rng.int(turns);
    if (!jumpSlot.has(i) && !fastSlot.has(i) && i !== signatureSlot) hillSlot.add(i);
  }
  let majorHill = false;

  // Largeurs : la route démarre à une largeur tirée selon le thème, et change aux créneaux calmes tirés d'avance.
  const weights = theme.widths.weights;
  const startWidth = pickWidth(rng, weights, WIDTH_LETTERS);
  let width = startWidth;
  const used = new Set<WidthLetter>([width]);
  const changeCount = theme.widths.changes[0] + rng.int(theme.widths.changes[1] - theme.widths.changes[0] + 1);
  const changeSlots = new Set<number>();
  for (let tries = 0; changeSlots.size < changeCount && tries < 40; tries++) changeSlots.add(rng.int(turns));
  let mustChange = false; // après un étranglement, la route s'élargit à nouveau
  // Virages serrés : un budget de 0 à 2, dont le passage signature (étranglement) prend un.
  let tightLeft = Math.min(rng.int(MAX_TIGHT + 1), MAX_TIGHT - (theme.signature === "dirtPinch" ? 1 : 0));

  const w: Walk = { cx: 0, cz: 0, dir: 0, y: 0, cells: new Set(), tokens: [] };
  place(w, [`S/${width}`]);

  for (let i = 0; i < turns; i++) {
    const left = rng.chance(50);
    const L = left ? "L" : "R";
    const R = left ? "R" : "L";
    const banked = rng.chance(theme.bankChance); // virage relevé ce tour-ci
    const bank = (seg: string[]) => (banked ? seg.map((t) => (isCurve(parseToken(t).kind) ? withMod(t, "b") : t)) : seg);
    const signature = i === signatureSlot ? signatureParts(theme.signature, L, R, width) : null;
    const fast = signature ? undefined : fastSlot.get(i);

    // Créneau calme.
    const jump = signature ? undefined : jumpSlot.get(i);
    const calm: string[][] = [];
    if (signature) {
      calm.push(signature.calm);
    } else if (fast) {
      calm.push(fastCalm(fast));
    } else if (jump) {
      calm.push(jumpCalm(jump));
    } else {
      const pad = Array<string>(PAD_RUNOUT).fill("S");
      const options: string[][] = rng.shuffle<string[]>([["S"], ["S", "S"], ["S", "P", ...pad], ["S", "B", "S"], ["P", ...pad]]);
      if (rng.chance(theme.turboChance)) options.unshift(["S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")]);
      if (hillSlot.has(i)) {
        // Un relief : les motifs raides ou doux selon le thème, mélangés ; le premier relief du circuit fait au moins 2 niveaux.
        const steep = rng.chance(theme.relief.steep);
        const pool = rng.shuffle<readonly string[]>([...(steep ? HILLS_STEEP : HILLS_GENTLE), ...(steep ? HILLS_GENTLE : HILLS_STEEP)]);
        const fitting = pool.filter((seg) => (majorHill ? true : hillRise(seg) >= MIN_RELIEF) && fits(w.y, seg));
        options.unshift(...fitting.map((seg) => [...seg]));
      }
      calm.push(...options);
    }
    // Changement de largeur : un bloc de transition en tête du créneau (sauf passage signature). Si aucun motif ne tient avec lui,
    // le créneau se pose sans changement.
    const target = !signature && (mustChange || changeSlots.has(i)) ? pickWidth(rng, weights, NEXT_WIDTHS[width]) : null;
    const candidates = target ? calm.map((seg) => [transition(width, target), ...seg]) : [];
    candidates.push(...calm);
    // Repli sur une ligne droite simple, sauf pour un passage marquant : s'il ne tient pas, la tentative échoue.
    if (!jump && !signature && !fast) candidates.push(["S"], ["S", "S"]);
    const calmChoice = candidates.find((seg) => fits(w.y, seg) && place(w, seg));
    if (!calmChoice) return null;
    if (hillSlot.has(i) && !signature && !fast && !jump && hillRise(calmChoice) >= MIN_RELIEF) majorHill = true;
    const after = widthAfter(calmChoice, width);
    if (!signature && after !== width) mustChange = false;
    width = after;
    used.add(width);

    // Créneau de virage.
    const turnHighlight = turnSlot.get(i);
    const tightOk = tightLeft > 0 && width !== "l";
    const wide = [[L + "2"], [R + "2"]];
    const grand = [[L + "3"], [R + "3"]];
    const wideS = [[L + "2", R + "2"], [R + "2", L + "2"]];
    const tight = tightOk ? [[L], [R]] : [];
    let segments: string[][];
    if (signature?.turn) segments = signature.turn;
    else if (turnHighlight === "chicane") segments = bankAll(wideS, bank); // S large
    else if (turnHighlight === "hairpin") segments = bankAll([[L + "2", L + "2"], [R + "2", R + "2"]], bank); // demi-tour large
    else if (fast === "bank") segments = [[L + "3/b"], [R + "3/b"], [L + "2/b"], [R + "2/b"]]; // grande courbe relevée prise à fond
    else {
      // Virage simple : le plus souvent large (2 × 2 cellules) ou ample (3 × 3), parfois un S large ou, rarement, serré.
      const roll = rng.int(100);
      const order = roll < 25 && tightOk ? [tight, wide, grand] : roll < 42 ? [grand, wide] : roll < 60 ? [wideS, wide, grand] : [wide, grand, wideS];
      segments = bankAll(order.flat(), bank);
    }
    // Sens bloqué : on essaie l'autre, puis un autre virage. Un passage marquant, lui, ne se remplace pas (la tentative échoue
    // et la graine voisine prend le relais).
    const turnChoice = segments.find((seg) => place(w, seg));
    if (!turnChoice) return null;
    if (!signature?.turn) tightLeft -= tightCount(turnChoice); // le virage d'un passage signature a son propre budget
    if (signature && theme.signature === "dirtPinch") mustChange = true;
  }

  // Dernière ligne droite puis arrivée.
  if (!place(w, ["S"]) && !place(w, ["S", "S"])) return null;
  const finish = ["S@finish"];
  if (!place(w, finish)) return null;
  if (used.size < 2) return null; // au moins deux largeurs par circuit
  w.tokens[0] = `S/${startWidth}@start`;

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
  const count = used2.size > 0 ? 2 + rng.int(2) : 2 + rng.int(3); // le point de contrôle du moteur coupé compte
  for (let k = 1; used2.size < count; k++) {
    const target = Math.round((k * (n - 1)) / (count + 1));
    for (let d = 0; d < n; d++) {
      const c = [target + d, target - d].find((i) => eligible(i) && !used2.has(i) && ![...used2].some((u) => Math.abs(u - i) < 3));
      if (c !== undefined) {
        used2.add(c);
        break;
      }
    }
    if (k > count + 3) break;
  }
  for (const i of used2) w.tokens[i] = "S@cp";

  // Zones de revêtement : des suites de 3 à 6 blocs d'un même revêtement (terre, glace, herbe) sur les blocs ordinaires.
  if (theme.zones) assignZones(w.tokens, theme.zones, rng);
  // Dénivelé minimal, puis sections sans rebords sur les parties surélevées.
  if (reliefOf(w.tokens) < MIN_RELIEF) return null;
  if (theme.openChance > 0 && rng.chance(theme.openChance)) openSection(w.tokens, rng);
  return w.tokens.join(" ");
}

const bankAll = (segments: string[][], bank: (seg: string[]) => string[]): string[][] => segments.map(bank);

/** Blocs qui reçoivent un revêtement : droites, virages, côtes d'un niveau (pas les effets, bosses, rampes, vides, côtes raides ni le départ / l'arrivée). */
function surfaceable(token: string, index: number, n: number): boolean {
  if (index === 0 || index >= n - 1 || token.includes("/")) return false;
  const p = parseToken(token);
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
function openSection(tokens: string[], rng: Rng): void {
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
    if (i < 1 || i >= n - 2) return false;
    const k = parseToken(tokens[i]!).kind;
    if (k === "kick" || k === "gap" || k === "jump") return false;
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

function assignZones(tokens: string[], zones: NonNullable<Theme["zones"]>, rng: Rng): void {
  const n = tokens.length;
  const count = zones.count[0] + rng.int(zones.count[1] - zones.count[0] + 1);
  const total = zones.surfaces.reduce((a, [, w]) => a + w, 0);
  for (let z = 0; z < count; z++) {
    let roll = rng.int(total);
    let surface: SurfaceKind = zones.surfaces[0]![0];
    for (const [sf, wgt] of zones.surfaces) {
      if (roll < wgt) {
        surface = sf;
        break;
      }
      roll -= wgt;
    }
    const length = 3 + rng.int(4);
    const start = 1 + rng.int(Math.max(1, n - 2 - length));
    for (let i = start; i < Math.min(n - 1, start + length); i++) {
      if (surfaceable(tokens[i]!, i, n)) tokens[i] = withMod(tokens[i]!, SURFACE_MOD[surface]);
    }
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

/**
 * Le circuit du jour. `variant` : 0 = le circuit d'origine (identique à celui d'avant le lot 14), n ≥ 1 = une variante du
 * planning ; `forced` impose un thème (id et circuit propres). Un thème imposé par un essai (`?theme=`) n'est jamais classé ;
 * celui du planning l'est (c'est le jeu qui sait d'où il vient).
 */
export function dailyCircuit(day: number, variant = 0, forced?: ThemeName | null): DailyCircuit {
  const theme = (forced ? themeByName(forced) : null) ?? themeForDay(day);
  const forcedTheme = !!forced && !!themeByName(forced);
  const id = dailyTrackId(day, forcedTheme ? theme.name : undefined, variant);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const spec = composeSpec(day, attempt, theme, variant);
    if (!spec) continue;
    const track = parseTrack(id, spec);
    const pilot = bestPilotRun(track);
    if (!pilot || pilot.finishMs < AUTHOR_MIN_MS || pilot.finishMs > AUTHOR_MAX_MS || pilot.maxSpeed < FAST_PEAK) continue;
    return {
      day,
      date: formatDay(day),
      number: circuitNumber(day),
      attempt,
      variant,
      spec,
      track,
      authorMs: pilot.finishMs,
      medals: medalsFor(pilot.finishMs),
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
    track: t,
    authorMs,
    medals: medalsFor(authorMs),
    palette: theme.palette,
    theme: theme.name,
    forcedTheme,
    fallback: true,
  };
}
