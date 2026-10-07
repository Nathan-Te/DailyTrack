import { GENERATOR_VERSION } from "./constants";
import { circuitNumber, formatDay } from "./calendar";
import { bestPilotRun } from "./autopilot";
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
//    On place chaque segment sur la grille en refusant les croisements.
// 2. Validation : un pilote automatique parcourt le circuit avec la même physique. S'il ne le finit pas, ou si
//    sa durée sort de la fenêtre visée, on recommence avec une graine voisine (tentative suivante).
// 3. Le temps du pilote est le temps de l'auteur ; les médailles en découlent.

/** Durée visée du pilote : 30 à 40 s, pour qu'une course correcte (or ≈ ×1,08) tienne en 30 à 45 s. */
export const AUTHOR_MIN_MS = 30_000;
export const AUTHOR_MAX_MS = 40_000;
export const MAX_ATTEMPTS = 40;

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
    const kind = parseToken(t).kind;
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
    y += exitDelta(kind);
    ({ cx, cz, dir } = placed.next);
  }
  w.cx = cx;
  w.cz = cz;
  w.dir = dir;
  w.y = y;
  w.tokens.push(...tokens);
  return true;
}

const MAX_HILLS = 2;
/**
 * Lignes droites obligatoires après une plaque d'accélération, avant le virage suivant : elle pousse la voiture
 * pendant ~0,9 s, et pendant ce temps le frein (40 m/s²) lutte contre la poussée (30 m/s²). Avec une pointe à
 * 48 m/s, une plaque suivie d'un virage serré à moins de ~80 m ne se prend pas (mesuré au 7b : le pilote ne
 * finissait que 28 circuits sur 91).
 */
const PAD_RUNOUT = 2;
/** Idem pour un super turbo (poussée 42 m/s² pendant 1,5 s, jusqu'à 68 m/s) : bien plus de dégagement. */
const TURBO_RUNOUT = 5;
/** Créneaux calme + virage d'un circuit : 5 à 7 (8 à 11 avant le lot 12, quand presque tous les virages étaient serrés). */
const TURNS_MIN = 5;
const TURNS_SPAN = 3;
/** Virages serrés (une cellule, rayon 16 m) : au plus 2 par circuit passage signature compris, jamais deux d'affilée. */
const MAX_TIGHT = 2;

type Highlight = "jump" | "chicane" | "hairpin";

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
    case "dirtJump": // tremplin sur la terre
      return { calm: ["S/t", "J/t", "S/t", "S/t"] };
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

/** Texte d'un circuit pour (jour, tentative, thème), ou `null` si la construction s'est coincée. */
export function composeSpec(day: number, attempt: number, theme: Theme = themeForDay(day), variant = 0): string | null {
  // Variante 0 : la graine d'avant le lot 14 (circuits inchangés). Variante n : une autre graine, décalée de n × 1000
  // tentatives (au plus `MAX_ATTEMPTS` = 40 sont tirées : jamais de recoupement entre variantes).
  const rng = new Rng(mixSeed(day, attempt + 1 + variant * 1000));
  const turns = TURNS_MIN + rng.int(TURNS_SPAN);
  // Créneaux : calme, virage, calme, virage, …, calme final. Les passages marquants prennent des créneaux distincts.
  const pickHighlights = rng.shuffle<Highlight>(["jump", "chicane", "hairpin"]).slice(0, 1 + rng.int(2));
  const calmSlot = new Map<number, Highlight>();
  const turnSlot = new Map<number, Highlight>();
  for (const h of pickHighlights) {
    const slots = h === "jump" ? calmSlot : turnSlot;
    const limit = h === "jump" ? turns - 1 : turns; // pas de tremplin juste avant l'arrivée
    let i = rng.int(limit);
    for (let tries = 0; tries < turns && slots.has(i); tries++) i = (i + 1) % limit;
    slots.set(i, h);
  }
  // Passage signature du thème : un créneau (calme + virage) qui ne porte aucun autre passage marquant.
  let signatureSlot = 1 + rng.int(turns - 2);
  for (let tries = 0; tries < turns && (calmSlot.has(signatureSlot) || turnSlot.has(signatureSlot)); tries++) {
    signatureSlot = signatureSlot >= turns - 2 ? 1 : signatureSlot + 1;
  }

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
  let hills = 0;

  for (let i = 0; i < turns; i++) {
    const left = rng.chance(50);
    const L = left ? "L" : "R";
    const R = left ? "R" : "L";
    const banked = rng.chance(theme.bankChance); // virage relevé ce tour-ci
    const bank = (seg: string[]) => (banked ? seg.map((t) => (isCurve(parseToken(t).kind) ? withMod(t, "b") : t)) : seg);
    const signature = i === signatureSlot ? signatureParts(theme.signature, L, R, width) : null;

    // Créneau calme.
    const calmHighlight = calmSlot.get(i);
    const calm: string[][] = [];
    if (signature) {
      calm.push(signature.calm);
    } else if (calmHighlight === "jump") {
      calm.push(["S", "J", "S", "S"]);
    } else {
      const pad = Array<string>(PAD_RUNOUT).fill("S");
      const options: string[][] = rng.shuffle<string[]>([["S"], ["S", "S"], ["S", "P", ...pad], ["S", "B", "S"], ["P", ...pad]]);
      if (hills < MAX_HILLS && rng.chance(35)) {
        options.unshift(rng.pick<string[]>([["U", "S", "D"], ["U", "S", "S", "D"], ["D", "S", "U"]]));
      }
      if (rng.chance(theme.turboChance)) options.unshift(["S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")]);
      calm.push(...options);
    }
    // Changement de largeur : un bloc de transition en tête du créneau (sauf passage signature). Si aucun motif ne tient avec lui,
    // le créneau se pose sans changement.
    const target = !signature && (mustChange || changeSlots.has(i)) ? pickWidth(rng, weights, NEXT_WIDTHS[width]) : null;
    const candidates = target ? calm.map((seg) => [transition(width, target), ...seg]) : [];
    candidates.push(...calm);
    // Repli sur une ligne droite simple, sauf pour un passage marquant : s'il ne tient pas, la tentative échoue.
    if (!calmHighlight && !signature) candidates.push(["S"], ["S", "S"]);
    const calmChoice = candidates.find((seg) => place(w, seg));
    if (!calmChoice) return null;
    if (w.tokens[w.tokens.length - 1] === "D" || w.tokens[w.tokens.length - 1] === "U") hills++;
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
  return w.tokens.join(" ");
}

const bankAll = (segments: string[][], bank: (seg: string[]) => string[]): string[][] => segments.map(bank);

/** Blocs qui reçoivent un revêtement : droites, virages, côtes (pas les effets, bosses, tremplins ni le départ / l'arrivée). */
function surfaceable(token: string, index: number, n: number): boolean {
  if (index === 0 || index >= n - 1 || token.includes("/")) return false;
  const k = parseToken(token).kind;
  return k === "straight" || isCurve(k) || k === "up" || k === "down";
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
    if (!pilot || pilot.finishMs < AUTHOR_MIN_MS || pilot.finishMs > AUTHOR_MAX_MS) continue;
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
