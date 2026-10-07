import { GENERATOR_VERSION } from "./constants";
import { circuitNumber, formatDay } from "./calendar";
import { bestPilotRun } from "./autopilot";
import { createTestTrack } from "./circuits";
import { Rng, mixSeed } from "./rng";
import { themeByName, themeForDay, type PaletteName, type Signature, type Theme, type ThemeName } from "./themes";
import { blockCells, cellKey, exitDelta, isCurve, parseToken, parseTrack, type Dir, type SurfaceKind, type Track } from "./track";

// Le circuit du jour : généré à partir de la date (graine = jour UTC), identique pour tout le monde.
//
// 1. Construction : on enchaîne des « segments » (courts motifs de blocs) en alternant calme (lignes droites,
//    plaques, bosses, côtes) et virages (serrés, ou larges sur 2 × 2 cellules), avec un ou deux passages
//    marquants (tremplin, chicane, épingle).
//    On place chaque segment sur la grille en refusant les croisements.
// 2. Validation : un pilote automatique parcourt le circuit avec la même physique. S'il ne le finit pas, ou si
//    sa durée sort de la fenêtre visée, on recommence avec une graine voisine (tentative suivante).
// 3. Le temps du pilote est le temps de l'auteur ; les médailles en découlent.

/** Durée visée du pilote : un humain mettra un peu plus (≈ 30 à 60 s). */
export const AUTHOR_MIN_MS = 28_000;
export const AUTHOR_MAX_MS = 48_000;
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

/** Identifiant du circuit d'un jour ; avec un thème forcé (essais), le nom du thème s'y ajoute : un autre circuit. */
export function dailyTrackId(day: number, forcedTheme?: ThemeName): string {
  return `jour-${formatDay(day)}-g${GENERATOR_VERSION}${forcedTheme ? `-${forcedTheme}` : ""}`;
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

type Highlight = "jump" | "chicane" | "hairpin";

/** Ajoute un modificateur (`g`, `t`, `h`, `b`) à un bloc de la notation, avant son repère éventuel. */
function withMod(token: string, mod: string): string {
  const [body, mark] = token.split("@");
  const next = body!.includes("/") ? body + mod : `${body}/${mod}`;
  return mark === undefined ? next : `${next}@${mark}`;
}

const SURFACE_MOD: Record<SurfaceKind, string> = { road: "", dirt: "t", ice: "g", grass: "h" };
const surfaceOnly = (tokens: string[], surface: SurfaceKind) => tokens.map((t) => withMod(t, SURFACE_MOD[surface]));

/**
 * Passages signature : (créneau calme, virages possibles à la suite). `L` / `R` : le sens tiré pour ce virage.
 * Un passage signature ne se remplace pas : s'il ne tient pas sur la grille, la tentative échoue.
 */
function signatureParts(sig: Signature, L: string, R: string): { calm: string[]; turn?: string[][] } {
  switch (sig) {
    case "turboBank": // super turbo sur une ligne droite, puis grand virage relevé
      return { calm: ["S", "T", ...Array<string>(TURBO_RUNOUT).fill("S")], turn: [[withMod(L + "2", "b")], [withMod(R + "2", "b")]] };
    case "dirtJump": // tremplin sur la terre
      return { calm: ["S/t", "J/t", "S/t", "S/t"] };
    case "iceChicane": // chicane sur la glace, après une ligne droite verglacée
      return { calm: ["S/g", "S/g"], turn: [[`${L}/g`, `${R}/g`], [`${R}/g`, `${L}/g`]] };
    case "cutRun": // moteur coupé, puis point de contrôle deux blocs plus loin (voir composeSpec)
      return { calm: ["S", "S", "C", "S", "S"] };
    case "dirtHairpin": // épingle sur la terre
      return { calm: ["S/t", "S/t"], turn: [[`${L}/t`, `${L}/t`], [`${R}/t`, `${R}/t`]] };
  }
}

/** Texte d'un circuit pour (jour, tentative, thème), ou `null` si la construction s'est coincée. */
export function composeSpec(day: number, attempt: number, theme: Theme = themeForDay(day)): string | null {
  const rng = new Rng(mixSeed(day, attempt + 1));
  const turns = 8 + rng.int(4); // 8 à 11 virages ou passages serrés
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

  const w: Walk = { cx: 0, cz: 0, dir: 0, y: 0, cells: new Set(), tokens: [] };
  place(w, ["S"]);
  let hills = 0;

  for (let i = 0; i < turns; i++) {
    const left = rng.chance(50);
    const L = left ? "L" : "R";
    const R = left ? "R" : "L";
    const banked = rng.chance(theme.bankChance); // virage relevé ce tour-ci
    const bank = (seg: string[]) => (banked ? seg.map((t) => (isCurve(parseToken(t).kind) ? withMod(t, "b") : t)) : seg);
    const signature = i === signatureSlot ? signatureParts(theme.signature, L, R) : null;

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
    // Repli sur une ligne droite simple, sauf pour un passage marquant : s'il ne tient pas, la tentative échoue.
    if (!calmHighlight && !signature) calm.push(["S"], ["S", "S"]);
    if (!calm.some((seg) => place(w, seg))) return null;
    if (w.tokens[w.tokens.length - 1] === "D" || w.tokens[w.tokens.length - 1] === "U") hills++;

    // Créneau de virage.
    const turnHighlight = turnSlot.get(i);
    // Virage simple : serré, ou large (2 × 2 cellules) une fois sur quatre.
    const wide = !turnHighlight && rng.chance(25);
    const segments: string[][] = signature?.turn
      ? signature.turn
      : turnHighlight === "chicane"
        ? bankAll([[L, R], [R, L]], bank)
        : turnHighlight === "hairpin"
          ? bankAll([[L, L], [R, R]], bank)
          : wide
            ? bankAll([[L + "2"], [R + "2"], [L], [R]], bank)
            : bankAll([[L], [R]], bank);
    // Sens bloqué : on essaie l'autre ; pour un virage simple, puis l'autre virage. Un passage marquant, lui,
    // ne se remplace pas (la tentative échoue et la graine voisine prend le relais).
    if (!segments.some((seg) => place(w, seg))) return null;
  }

  // Dernière ligne droite puis arrivée.
  if (!place(w, ["S"]) && !place(w, ["S", "S"])) return null;
  const finish = ["S@finish"];
  if (!place(w, finish)) return null;
  w.tokens[0] = "S@start";

  // Points de contrôle (2 à 4), répartis le long du circuit, sur des lignes droites. Un moteur coupé est suivi d'un
  // point de contrôle deux blocs plus loin : « on vit sur son élan » ~1 s, pas jusqu'à la fin du circuit.
  const n = w.tokens.length;
  const eligible = (i: number) => i > 0 && i < n - 1 && w.tokens[i] === "S";
  const used = new Set<number>();
  const cutAt = w.tokens.indexOf("C");
  if (cutAt >= 0) {
    if (w.tokens[cutAt + 1] !== "S" || w.tokens[cutAt + 2] !== "S" || cutAt + 2 >= n - 1) return null;
    used.add(cutAt + 2);
  }
  const count = used.size > 0 ? 2 + rng.int(2) : 2 + rng.int(3); // le point de contrôle du moteur coupé compte
  for (let k = 1; used.size < count; k++) {
    const target = Math.round((k * (n - 1)) / (count + 1));
    for (let d = 0; d < n; d++) {
      const c = [target + d, target - d].find((i) => eligible(i) && !used.has(i) && ![...used].some((u) => Math.abs(u - i) < 3));
      if (c !== undefined) {
        used.add(c);
        break;
      }
    }
    if (k > count + 3) break;
  }
  for (const i of used) w.tokens[i] = "S@cp";

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
  spec: string;
  track: Track;
  authorMs: number;
  medals: Medals;
  palette: PaletteName;
  /** Thème du circuit (celui du jour, ou le thème forcé pour les essais). */
  theme: ThemeName;
  /** Vrai si le thème a été forcé (`?theme=`) : un circuit d'essai, jamais envoyé au classement. */
  forcedTheme: boolean;
  /** Vrai si aucune tentative n'a abouti et que le circuit d'essai a servi de secours (ne doit jamais arriver). */
  fallback: boolean;
}

/** Le circuit du jour ; `forced` impose un thème (essais : id et circuit propres, jamais classés). */
export function dailyCircuit(day: number, forced?: ThemeName | null): DailyCircuit {
  const theme = (forced ? themeByName(forced) : null) ?? themeForDay(day);
  const forcedTheme = !!forced && !!themeByName(forced);
  const id = dailyTrackId(day, forcedTheme ? theme.name : undefined);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const spec = composeSpec(day, attempt, theme);
    if (!spec) continue;
    const track = parseTrack(id, spec);
    const pilot = bestPilotRun(track);
    if (!pilot || pilot.finishMs < AUTHOR_MIN_MS || pilot.finishMs > AUTHOR_MAX_MS) continue;
    return {
      day,
      date: formatDay(day),
      number: circuitNumber(day),
      attempt,
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
