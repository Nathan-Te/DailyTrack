import { GENERATOR_VERSION } from "./constants";
import { circuitNumber, formatDay } from "./calendar";
import { bestPilotRun } from "./autopilot";
import { createTestTrack } from "./circuits";
import { Rng, mixSeed } from "./rng";
import { BLOCK_LETTERS, cellKey, dirX, dirZ, exitDelta, parseTrack, type Dir, type Track } from "./track";

// Le circuit du jour : généré à partir de la date (graine = jour UTC), identique pour tout le monde.
//
// 1. Construction : on enchaîne des « segments » (courts motifs de blocs) en alternant calme (lignes droites,
//    plaques, bosses, côtes) et virages, avec un ou deux passages marquants (tremplin, chicane, épingle).
//    On place chaque segment sur la grille en refusant les croisements.
// 2. Validation : un pilote automatique parcourt le circuit avec la même physique. S'il ne le finit pas, ou si
//    sa durée sort de la fenêtre visée, on recommence avec une graine voisine (tentative suivante).
// 3. Le temps du pilote est le temps de l'auteur ; les médailles en découlent.

export const PALETTES = ["desert", "neige", "nuit", "neon"] as const;
export type PaletteName = (typeof PALETTES)[number];

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

export function paletteForDay(day: number): PaletteName {
  return PALETTES[new Rng(mixSeed(day, 0x70a1)).int(PALETTES.length)]!;
}

export function dailyTrackId(day: number): string {
  return `jour-${formatDay(day)}-g${GENERATOR_VERSION}`;
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
    const kind = BLOCK_LETTERS[t.split("@")[0]!]!;
    const key = cellKey(cx, cz);
    if (w.cells.has(key)) {
      for (const k of added) w.cells.delete(k);
      return false;
    }
    w.cells.add(key);
    added.push(key);
    y += exitDelta(kind);
    if (kind === "curveL") dir = ((dir + 1) & 3) as Dir;
    else if (kind === "curveR") dir = ((dir + 3) & 3) as Dir;
    cx += dirX(dir);
    cz += dirZ(dir);
  }
  w.cx = cx;
  w.cz = cz;
  w.dir = dir;
  w.y = y;
  w.tokens.push(...tokens);
  return true;
}

const MAX_HILLS = 2;

type Highlight = "jump" | "chicane" | "hairpin";

/** Texte d'un circuit pour (jour, tentative), ou `null` si la construction s'est coincée. */
export function composeSpec(day: number, attempt: number): string | null {
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

  const w: Walk = { cx: 0, cz: 0, dir: 0, y: 0, cells: new Set(), tokens: [] };
  place(w, ["S"]);
  let hills = 0;

  for (let i = 0; i < turns; i++) {
    // Créneau calme.
    const calmHighlight = calmSlot.get(i);
    const calm: string[][] = [];
    if (calmHighlight === "jump") {
      calm.push(["S", "J", "S", "S"]);
    } else {
      const options: string[][] = rng.shuffle<string[]>([["S"], ["S", "S"], ["S", "P", "S"], ["S", "B", "S"], ["P", "S"]]);
      if (hills < MAX_HILLS && rng.chance(35)) {
        options.unshift(rng.pick<string[]>([["U", "S", "D"], ["U", "S", "S", "D"], ["D", "S", "U"]]));
      }
      calm.push(...options);
    }
    // Repli sur une ligne droite simple, sauf pour un passage marquant : s'il ne tient pas, la tentative échoue.
    if (!calmHighlight) calm.push(["S"], ["S", "S"]);
    if (!calm.some((seg) => place(w, seg))) return null;
    if (w.tokens[w.tokens.length - 1] === "D" || w.tokens[w.tokens.length - 1] === "U") hills++;

    // Créneau de virage.
    const turnHighlight = turnSlot.get(i);
    const left = rng.chance(50);
    const L = left ? "L" : "R";
    const R = left ? "R" : "L";
    const segments: string[][] =
      turnHighlight === "chicane" ? [[L, R], [R, L]] : turnHighlight === "hairpin" ? [[L, L], [R, R]] : [[L], [R]];
    // Sens bloqué : on essaie l'autre ; pour un virage simple, puis l'autre virage. Un passage marquant, lui,
    // ne se remplace pas (la tentative échoue et la graine voisine prend le relais).
    if (!segments.some((seg) => place(w, seg))) return null;
  }

  // Dernière ligne droite puis arrivée.
  if (!place(w, ["S"]) && !place(w, ["S", "S"])) return null;
  const finish = ["S@finish"];
  if (!place(w, finish)) return null;
  w.tokens[0] = "S@start";

  // Points de contrôle (2 à 4), répartis le long du circuit, sur des lignes droites.
  const n = w.tokens.length;
  const eligible = (i: number) => i > 0 && i < n - 1 && w.tokens[i] === "S";
  const count = 2 + rng.int(3);
  const used = new Set<number>();
  for (let k = 1; k <= count; k++) {
    const target = Math.round((k * (n - 1)) / (count + 1));
    for (let d = 0; d < n; d++) {
      const c = [target + d, target - d].find((i) => eligible(i) && !used.has(i));
      if (c !== undefined) {
        used.add(c);
        break;
      }
    }
  }
  for (const i of used) w.tokens[i] = "S@cp";
  return w.tokens.join(" ");
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
  /** Vrai si aucune tentative n'a abouti et que le circuit d'essai a servi de secours (ne doit jamais arriver). */
  fallback: boolean;
}

export function dailyCircuit(day: number): DailyCircuit {
  const id = dailyTrackId(day);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const spec = composeSpec(day, attempt);
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
      palette: paletteForDay(day),
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
    palette: paletteForDay(day),
    fallback: true,
  };
}
