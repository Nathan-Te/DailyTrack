import { Rng, daysFromCivil, formatDay, mixSeed } from "@cdj/core";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, initialAttempt, stepAttempt, type AttemptState } from "./attempt";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, TICK_RATE, UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";
import { parseLevel, type Level } from "./level";
import { MODULES, buildModule, moduleSolutions, textHash, variantExigence, type ModuleEntry, type ModuleTag } from "./modules";
import { DEFAULT_JUMP_PARAMS, INPUT_RIGHT, PLAYER_WIDTH } from "./player";
import { decodeReplay, encodeReplay, fromRuns, replayAttempt, toRuns, type JumpReplay } from "./replay";

// Le niveau du jour (lot 5) : `dailyLevel(jour)` assemble des morceaux du catalogue (lot 4) qui **portent leur solution**, puis **rejoue** la
// suite de ces solutions sur le niveau assemblé. Si elle arrive au bout sans mourir, le niveau est valide et ce rejeu donne le temps de
// l'auteur, d'où les médailles. Fonction pure : la date est un argument (numéro de jour, `@cdj/core`), rien ne lit l'heure.
//
// **Assemblage** (une rangée = une rangée de tuiles, de haut en bas) :
//   colonne de départ `S` · morceau 1 · colonne de raccord · morceau 2 · … · morceau n · colonne d'arrivée `F`
//   - le palier de sortie d'un morceau est aligné, **par sa rangée**, sur le palier d'entrée du suivant ; la colonne de raccord entre les deux
//     a ce sol, et autant de vide au-dessus que l'une ou l'autre des colonnes voisines (c'est la colonne de sortie du premier morceau et la
//     colonne d'appel du second dans `buildModule`) ; le point de passage `C` du morceau suivant y est posé, au sol : y reprendre, c'est
//     exactement le départ « à l'arrêt » du morceau seul ;
//   - le premier morceau part à l'**arrêt** (départ `S`, comme `buildModule`), tous les suivants en **élan** ;
//   - hors des morceaux, **tout est plein** ; une rangée de blocs ferme le haut (les côtés sont fermés par `tileAt`) ; sous un morceau, le
//     vide continue jusqu'en bas du niveau là où sa dernière rangée n'est pas un bloc (on y meurt en tombant, comme dans le morceau seul) ;
//   - chaque morceau est **une section** (ses scies démarrent quand le centre du personnage y entre) ; ses scies mobiles sont recopiées,
//     coordonnées décalées.
//
// **La preuve** : la solution du premier morceau (à l'arrêt), puis, pour chaque morceau suivant, sa solution en élan, démarrée au pas où le
// personnage franchit le bord d'entrée du morceau, c'est-à-dire le pas où il est le plus près de la position du départ de ce morceau joué
// seul (colonne de raccord ; un pas à pleine vitesse fait 375 unités, l'écart reste dans ±187 : c'est le raccord mesuré au lot 4) ; si la
// solution n'aboutit pas de là, l'autre pas qui encadre ce départ. Entre la fin d'une solution (elle touche l'arrivée du morceau seul,
// c'est-à-dire la colonne de raccord) et ce pas, et après la dernière s'il le faut, on court vers la droite. Cette rediffusion complète est
// ensuite **rejouée** par `replayAttempt` sur le niveau assemblé : rien n'est supposé.
//
// **Tirages** : `DAILY_DRAWS` tirages par jour (graine `mixSeed(jour, sel)` puis `mixSeed(graine, tirage)`) ; chacun compose une suite de
// morceaux sous les règles ci-dessous, l'assemble et la rejoue ; on garde le meilleur tirage valide (durée et exigence les plus proches du
// centre de la cible). Sans tirage valide, on continue jusqu'à `DAILY_MAX_ATTEMPTS` ; s'il n'y en a toujours pas, niveau de **secours**
// (`FALLBACK_PIECES`, assemblé et validé de la même façon).
//
// **Toute modification qui change le niveau d'une date** (règles, seuils, catalogue, solutions, assemblage) : `JUMP_GENERATOR_VERSION` +1,
// golden régénérés (`UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts`), puis `npm run measure:jump -w @cdj/jump-sim`.

/** Le niveau n° 1 : le 16/10/2026 (numéro de jour, comme `parseDay`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

/** Numéro du niveau du jour (1 le 16/10/2026 ; 0 ou moins avant). */
export function levelNumber(day: number): number {
  return day - PREMIER_JOUR_JUMP + 1;
}

/** Identifiant du niveau d'une date : `jour-AAAA-MM-JJ-g<JUMP_GENERATOR_VERSION>` (identifiant des rediffusions et de la mémoire). */
export function dailyLevelId(day: number): string {
  return `jour-${formatDay(day)}-g${JUMP_GENERATOR_VERSION}`;
}

// ——— Constantes de la cible (toutes en pas : 120 pas = 1 s) ———

/** Temps de l'auteur permis : 25 à 40 s… */
export const AUTHOR_MIN_TICKS = 25 * TICK_RATE;
export const AUTHOR_MAX_TICKS = 40 * TICK_RATE;
/** … centré vers 30 s (centre du score des tirages). */
export const AUTHOR_TARGET_TICKS = 30 * TICK_RATE;
/**
 * Temps **estimé** (somme des durées des solutions, plus `JOINT_TICKS` par raccord) : on ajoute des morceaux tant qu'il est sous
 * `ESTIMATE_MIN_TICKS` ; le dernier ne doit pas le pousser au-delà de `ESTIMATE_MAX_TICKS`.
 */
export const ESTIMATE_MIN_TICKS = 28 * TICK_RATE;
export const ESTIMATE_MAX_TICKS = 32 * TICK_RATE;
/** Pas de course entre la fin d'une solution (elle touche la colonne de raccord) et le départ de la suivante (mesuré : 9). */
export const JOINT_TICKS = 9;
/** Morceaux par niveau : 6 à 10 (seed § 6). */
export const MIN_PIECES = 6;
export const MAX_PIECES = 10;
/** Hauteur totale du niveau, rangée de blocs du haut comprise. */
export const MAX_DAILY_HEIGHT = 48;

// ——— Budget d'exigence (la même exigence chaque jour : pas de difficulté selon le jour de la semaine) ———

/**
 * Exigence du niveau = somme des exigences de ses morceaux (1 à 5, lot 4) **ramenée à sa durée**, en **dixièmes de point par minute** de
 * temps de l'auteur (`exigenceRate`). Elle doit tomber dans [`EXIGENCE_RATE_MIN`, `EXIGENCE_RATE_MAX`] ; le score des tirages vise
 * `EXIGENCE_RATE_CENTER`. Seuils réglés sur `npm run measure:jump` (README du lot 5).
 */
export const EXIGENCE_RATE_MIN = 380;
export const EXIGENCE_RATE_MAX = 460;
export const EXIGENCE_RATE_CENTER = 420;
/** Au moins un morceau de cette exigence ou plus. */
export const EXIGENCE_PEAK = 4;
/**
 * Profil visé pendant le tirage, en dixièmes de point : un morceau placé à la fraction p du temps cible vise l'exigence
 * `PROFILE_START + (PROFILE_END − PROFILE_START) × p` (la variante la plus proche est choisie). Règle vérifiée après rejeu : le dernier
 * tiers (en temps) est au moins aussi exigeant, en moyenne pondérée par la durée, que le premier.
 */
export const PROFILE_START = 13;
export const PROFILE_END = 33;

// ——— Quotas, repos, tirages ———

/** Jamais plus de ce nombre de morceaux `precision` d'affilée. */
export const MAX_PRECISION_RUN = 2;
/** Le morceau `respiration` du milieu : son milieu tombe entre 35 et 65 % du temps (pour mille). Un seul morceau `respiration` par niveau. */
export const RESPIRATION_FROM = 350;
export const RESPIRATION_TO = 650;
/** Un quota manquant (mural, scie) est imposé à partir de cette fraction du temps cible (pour mille) ; la pointe d'exigence, au dernier tiers. */
export const FORCE_QUOTA_AT = 550;
export const FORCE_PEAK_AT = 667;
/** Tirages par jour (on garde le meilleur valide) et tentatives au plus (au-delà : le secours). */
export const DAILY_DRAWS = 6;
export const DAILY_MAX_ATTEMPTS = 40;
/** Sels des graines : `mixSeed(jour, DAILY_SALT)`, et des groupes de repos. */
const DAILY_SALT = 0x6a6f7572;

/** Médailles : facteurs (en pour cent) du temps de l'auteur, arrondis au pas supérieur. À calibrer sur de vraies parties (seed § 5). */
export const MEDAL_PERCENT = { gold: 110, silver: 130, bronze: 160 } as const;

/**
 * **Repos sans historique** (comme `isRested` de DailyTrack) : chaque morceau appartient à l'un de trois groupes (empreinte de son
 * identifiant) ; le jour `d` laisse au repos le groupe `d mod 3`. Deux jours de suite n'ont donc en commun que des morceaux du seul groupe
 * disponible les deux jours, sans aucune mémoire des jours passés. Le secours ignore le repos.
 */
export const REST_GROUPS = 3;
/**
 * Sel de l'empreinte des groupes : choisi (recherche sur 5 000 sels, README du lot 5) pour que le catalogue actuel se range en trois
 * groupes de 9 aux étiquettes réparties (mural, scie, respiration, précision… : au plus un d'écart entre deux groupes), les deux descentes
 * (`descente`, `puits`) dans deux groupes différents. Changer de sel change les niveaux : `JUMP_GENERATOR_VERSION` +1.
 */
export const REST_SALT = "repos4310:";
export function restGroup(id: string): number {
  return Number.parseInt(textHash(`${REST_SALT}${id}`), 16) % REST_GROUPS;
}
export function isRestedModule(id: string, day: number): boolean {
  return restGroup(id) === ((day % REST_GROUPS) + REST_GROUPS) % REST_GROUPS;
}

/** Les médailles d'un niveau, en pas (le temps de l'auteur est le palier au-dessus de l'or). */
export interface JumpMedals {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

export type JumpMedal = keyof JumpMedals;

/** Pas × pour cent ÷ 100, arrondi au pas supérieur (entiers seulement). */
const ceilPercent = (ticks: number, percent: number): number => idiv(ticks * percent + 99, 100);

export function jumpMedalsFor(authorTicks: number): JumpMedals {
  return {
    author: authorTicks,
    gold: ceilPercent(authorTicks, MEDAL_PERCENT.gold),
    silver: ceilPercent(authorTicks, MEDAL_PERCENT.silver),
    bronze: ceilPercent(authorTicks, MEDAL_PERCENT.bronze),
  };
}

/** La meilleure médaille d'un temps (en pas), ou null. */
export function jumpMedalFor(ticks: number, medals: JumpMedals): JumpMedal | null {
  if (ticks <= medals.author) return "author";
  if (ticks <= medals.gold) return "gold";
  if (ticks <= medals.silver) return "silver";
  if (ticks <= medals.bronze) return "bronze";
  return null;
}

// ——— Le catalogue vu par le générateur ———

/** Une variante utilisable : solutions stockées aux deux entrées, exigence ≥ 1. */
interface Choice {
  id: string;
  variant: number;
  tags: readonly ModuleTag[];
  exigence: number;
  /** Durées des solutions (pas). */
  arret: number;
  elan: number;
  height: number;
  width: number;
  entryRow: number;
  exitRow: number;
}

let catalog: Choice[][] | null = null;

/** Par morceau (ordre du catalogue), ses variantes utilisables. Calculé une fois (déterministe). */
function choices(): Choice[][] {
  if (catalog) return catalog;
  catalog = MODULES.map((def) =>
    def.variants.flatMap((_, variant) => {
      const s = moduleSolutions(def.id, variant);
      const exigence = variantExigence(s);
      if (!s?.arret || !s.elan || exigence < 1) return [];
      const b = buildModule(def.id, variant);
      return [{ id: def.id, variant, tags: def.tags, exigence, arret: s.arret.ticks, elan: s.elan.ticks, height: b.height, width: b.width, entryRow: b.entryRow, exitRow: b.exitRow }];
    }),
  ).filter((list) => list.length > 0);
  return catalog;
}

const has = (c: { tags: readonly ModuleTag[] }, tag: ModuleTag) => c.tags.includes(tag);

// ——— Le niveau ———

/** Un morceau dans le niveau du jour. */
export interface DailyPiece {
  id: string;
  variant: number;
  entry: ModuleEntry;
  tags: readonly ModuleTag[];
  exigence: number;
  /** Durée de sa solution (pas), celle qui compte dans l'estimation. */
  solutionTicks: number;
  /** Colonnes du morceau dans le niveau (bornes comprises) : c'est sa section. */
  col0: number;
  col1: number;
  /** Rangée du niveau où commence sa grille, et rangées de ses paliers d'entrée et de sortie (sol). */
  top: number;
  entryRow: number;
  exitRow: number;
  /** Pas de la preuve où il commence (où sa solution démarre ; 0 pour le premier) et où il finit (début du suivant, ou l'arrivée). */
  start: number;
  end: number;
}

export interface DailyExigence {
  /** Somme des exigences des morceaux. */
  sum: number;
  /** Dixièmes de point par minute de temps de l'auteur. */
  rate: number;
  /** Exigence moyenne (dixièmes de point, pondérée par la durée) de chaque tiers du temps : début, milieu, fin. */
  thirds: readonly [number, number, number];
}

/** Ce qu'a donné un tirage. */
export interface DailyAttempt {
  index: number;
  /** `impasse` : la composition n'a pas abouti ; `refusé` : composé mais le rejeu échoue ou une règle n'est pas tenue ; `valide`. */
  status: "impasse" | "refusé" | "valide";
  /** Pourquoi (impasse ou refus), sinon vide. */
  reason: string;
  /** Morceaux (`id:variante`) quand le tirage a été composé. */
  pieces: string[];
  /** Temps de l'auteur et exigence (rejeu arrivé au bout, 0 sinon), score (plus petit = plus près du centre). */
  ticks: number;
  rate: number;
  score: number;
}

export interface DailyLevel {
  day: number;
  /** AAAA-MM-JJ. */
  date: string;
  /** Numéro du niveau (`levelNumber`). */
  number: number;
  /** `jour-AAAA-MM-JJ-g<N>`. */
  id: string;
  level: Level;
  /** Texte complet du niveau (grille et bloc annexe), et son empreinte FNV-1a. */
  ascii: string;
  hash: string;
  pieces: readonly DailyPiece[];
  /** La preuve : la rediffusion de l'auteur (et son texte base64url), rejouée par `replayAttempt`. */
  replay: JumpReplay;
  code: string;
  /** Temps de l'auteur, en pas : celui du rejeu. */
  authorTicks: number;
  medals: JumpMedals;
  exigence: DailyExigence;
  /** Les tirages essayés, dans l'ordre ; `chosen` = indice du tirage retenu (−1 pour le secours). */
  attempts: readonly DailyAttempt[];
  chosen: number;
  fallback: boolean;
}

/** Une pièce avant assemblage. */
interface Slot {
  choice: Choice;
  entry: ModuleEntry;
}

const ticksOf = (p: Slot) => (p.entry === "arret" ? p.choice.arret : p.choice.elan);

/** Rangées de chaque morceau (haut de sa grille), et hauteur totale (rangée du haut comprise), d'une suite de morceaux. */
function stack(picks: readonly Slot[]): { tops: number[]; height: number } {
  const offs: number[] = [];
  let o = 0;
  picks.forEach((p, k) => {
    if (k > 0) o = offs[k - 1]! + picks[k - 1]!.choice.exitRow - p.choice.entryRow;
    offs.push(o);
  });
  let lo = 0;
  let hi = 0;
  picks.forEach((p, k) => {
    if (k === 0 || offs[k]! < lo) lo = offs[k]!;
    if (k === 0 || offs[k]! + p.choice.height > hi) hi = offs[k]! + p.choice.height;
  });
  return { tops: offs.map((v) => v - lo + 1), height: hi - lo + 1 };
}

// ——— Composition d'un tirage ———

/** Pour mille. */
const per = (part: number, whole: number) => idiv(part * 1000, whole);

/** Compose une suite de morceaux (sans l'assembler). Rend la raison de l'échec si elle n'aboutit pas. */
function compose(day: number, rng: Rng): Slot[] | string {
  const pool = choices().filter((list) => !isRestedModule(list[0]!.id, day));
  const picks: Slot[] = [];
  const used = new Set<string>();
  let est = 0;
  for (;;) {
    if (picks.length >= MAX_PIECES) return "trop de morceaux";
    const first = picks.length === 0;
    const entry: ModuleEntry = first ? "arret" : "elan";
    const p = per(est, AUTHOR_TARGET_TICKS);
    const target = PROFILE_START * 10 + idiv((PROFILE_END - PROFILE_START) * 10 * (p < 1000 ? p : 1000), 1000); // centièmes de point
    const precisionRun = picks.length >= MAX_PRECISION_RUN && picks.slice(-MAX_PRECISION_RUN).every((q) => has(q.choice, "precision"));
    const needMural = !picks.some((q) => has(q.choice, "mural"));
    const needScie = !picks.some((q) => has(q.choice, "scie"));
    const needRest = !picks.some((q) => has(q.choice, "respiration"));
    const needPeak = !picks.some((q) => q.choice.exigence >= EXIGENCE_PEAK);
    const restWindow = (c: Choice, ticks: number) => {
      const mid = est + idiv(ticks, 2);
      return mid >= idiv(ESTIMATE_MAX_TICKS * RESPIRATION_FROM, 1000) && mid <= idiv(ESTIMATE_MIN_TICKS * RESPIRATION_TO, 1000) && has(c, "respiration");
    };
    // Le morceau de respiration est imposé dès que le prochain morceau risquerait de dépasser le milieu.
    const forceRest = needRest && est + 2 * TICK_RATE >= idiv(ESTIMATE_MAX_TICKS * RESPIRATION_FROM, 1000);
    const forceMural = needMural && p >= FORCE_QUOTA_AT;
    const forceScie = needScie && p >= FORCE_QUOTA_AT;
    const forcePeak = needPeak && p >= FORCE_PEAK_AT;

    interface Cand {
      pick: Slot;
      weight: number;
    }
    const cands: Cand[] = [];
    for (const list of pool) {
      const id = list[0]!.id;
      if (used.has(id)) continue;
      const tags = list[0]!.tags;
      if (precisionRun && tags.includes("precision")) continue;
      if (tags.includes("respiration") && !needRest) continue;
      if (forceRest && !tags.includes("respiration")) continue;
      if ((forceMural || forceScie) && !((forceMural && tags.includes("mural")) || (forceScie && tags.includes("scie")))) continue;
      // Variantes qui tiennent : hauteur, durée, respiration au milieu, pointe d'exigence imposée.
      const ok = list.filter((c) => {
        const pick = { choice: c, entry };
        const ticks = ticksOf(pick) + (first ? 0 : JOINT_TICKS);
        if (has(c, "respiration") && !restWindow(c, ticks)) return false;
        if (forcePeak && c.exigence < EXIGENCE_PEAK) return false;
        const end = est + ticks;
        if (end > ESTIMATE_MAX_TICKS) return false;
        if (end >= ESTIMATE_MIN_TICKS) {
          // Ce morceau finirait le niveau : tous les quotas doivent être tenus avec lui.
          const all = [...picks.map((q) => q.choice), c];
          if (!all.some((q) => has(q, "mural")) || !all.some((q) => has(q, "scie")) || !all.some((q) => has(q, "respiration"))) return false;
          if (!all.some((q) => q.exigence >= EXIGENCE_PEAK) || all.length < MIN_PIECES) return false;
        }
        return stack([...picks, pick]).height <= MAX_DAILY_HEIGHT;
      });
      if (ok.length === 0) continue;
      // La variante la plus proche du profil visé (à égalité : tirée au sort).
      let best: Choice[] = [];
      let gap = Infinity;
      for (const c of ok) {
        const g = Math.abs(c.exigence * 100 - target);
        if (g < gap) {
          gap = g;
          best = [c];
        } else if (g === gap) best.push(c);
      }
      const choice = best.length === 1 ? best[0]! : rng.pick(best);
      let weight = gap <= 50 ? 8 : gap <= 100 ? 5 : gap <= 200 ? 2 : 1;
      if ((needMural && has(choice, "mural")) || (needScie && has(choice, "scie"))) weight *= 2;
      cands.push({ pick: { choice, entry }, weight });
    }
    if (cands.length === 0) return `impasse au morceau ${picks.length + 1}`;
    let total = 0;
    for (const c of cands) total += c.weight;
    let r = rng.int(total);
    let chosen = cands[0]!;
    for (const c of cands) {
      if (r < c.weight) {
        chosen = c;
        break;
      }
      r -= c.weight;
    }
    picks.push(chosen.pick);
    used.add(chosen.pick.choice.id);
    est += ticksOf(chosen.pick) + (picks.length > 1 ? JOINT_TICKS : 0);
    if (est >= ESTIMATE_MIN_TICKS) return picks;
  }
}

// ——— Assemblage ———

interface Assembled {
  level: Level;
  ascii: string;
  pieces: DailyPiece[];
  /** Colonne de départ de chaque morceau joué seul (la colonne de raccord qui le précède ; 0 pour le premier). */
  calls: number[];
}

/** Assemble une suite de morceaux en un niveau (grille + bloc annexe). */
export function assemble(picks: readonly { id: string; variant: number }[]): Assembled {
  const all = choices().flat();
  const full: Slot[] = picks.map((p, k) => {
    const choice = all.find((c) => c.id === p.id && c.variant === p.variant);
    if (!choice) throw new RangeError(`Morceau « ${p.id} », variante ${p.variant} : pas de solution utilisable`);
    return { choice, entry: k === 0 ? "arret" : "elan" };
  });
  if (full.length === 0) throw new RangeError("Assemblage vide");
  const { tops, height } = stack(full);
  const width = full.reduce((s, p) => s + p.choice.width, 0) + full.length + 1;
  const rows: string[][] = [];
  for (let r = 0; r < height; r++) rows.push(new Array<string>(width).fill("#"));
  const annex: string[] = [];
  const pieces: DailyPiece[] = [];
  const calls: number[] = [];
  const grids: string[][] = [];
  let col = 1;
  full.forEach((p, k) => {
    const built = buildModule(p.choice.id, p.choice.variant);
    const [gridText, annexText = ""] = built.ascii.split("\n\n");
    const g = gridText!.split("\n").map((line) => line.slice(built.lead, built.lead + built.width));
    grids.push(g);
    const top = tops[k]!;
    for (let r = 0; r < g.length; r++) for (let c = 0; c < built.width; c++) rows[top + r]![col + c] = g[r]![c]!;
    // Sous le morceau : le vide continue jusqu'en bas là où sa dernière rangée n'est pas un bloc.
    const last = g[g.length - 1]!;
    for (let c = 0; c < built.width; c++) if (last[c] !== "#") for (let r = top + g.length; r < height; r++) rows[r]![col + c] = ".";
    // Bloc annexe : la section du morceau, ses scies (identifiants préfixés, coordonnées décalées).
    annex.push(`section ${p.choice.id} ${col}-${col + built.width - 1}`);
    for (const line of annexText.split("\n")) {
      const words = line.trim().split(/\s+/);
      if (words[0] !== "scie") continue;
      annex.push(
        words
          .map((w, i) => {
            if (i === 1) return `${p.choice.id}/${w}`;
            const m = i >= 5 ? /^(\d+),(\d+)$/.exec(w) : null;
            return m ? `${Number(m[1]) - built.lead + col},${Number(m[2]) + top}` : w;
          })
          .join(" "),
      );
    }
    calls.push(col - 1);
    pieces.push({
      id: p.choice.id,
      variant: p.choice.variant,
      entry: p.entry,
      tags: p.choice.tags,
      exigence: p.choice.exigence,
      solutionTicks: ticksOf(p),
      col0: col,
      col1: col + built.width - 1,
      top,
      entryRow: top + built.entryRow,
      exitRow: top + built.exitRow,
      start: 0,
      end: 0,
    });
    col += built.width + 1;
  });
  // Colonnes de départ, de raccord et d'arrivée : sol du palier, vide au-dessus là où une colonne voisine est vide, plein ailleurs.
  const open = (k: number, r: number, side: "first" | "last"): boolean => {
    const g = grids[k];
    if (!g) return false;
    const rr = r - pieces[k]!.top;
    if (rr < 0 || rr >= g.length) return false;
    return g[rr]![side === "first" ? 0 : g[rr]!.length - 1] === ".";
  };
  for (let k = 0; k <= full.length; k++) {
    const c = k === 0 ? 0 : pieces[k - 1]!.col1 + 1;
    const floor = k < full.length ? pieces[k]!.entryRow : pieces[k - 1]!.exitRow;
    for (let r = 0; r < floor; r++) rows[r]![c] = open(k - 1, r, "last") || open(k, r, "first") ? "." : "#";
    rows[floor - 1]![c] = k === 0 ? "S" : k === full.length ? "F" : "C";
  }
  const ascii = rows.map((r) => r.join("")).join("\n") + "\n\n" + annex.join("\n") + "\n";
  return { level: parseLevel(ascii), ascii, pieces, calls };
}

// ——— La preuve ———

/** Abscisse (unités) du départ d'un morceau joué seul : centré dans sa colonne d'appel, comme `initialPlayer`. */
const callX = (col: number) => col * UNITS_PER_TILE + idiv(UNITS_PER_TILE - PLAYER_WIDTH, 2);
/** Au plus ce nombre de pas de course entre deux solutions, ou après la dernière (sinon le raccord a échoué). */
const MAX_JOINT_RUN = 60;

type Step = (s: AttemptState, bits: number) => AttemptState;

/**
 * Joue la solution du morceau `k` depuis l'état `s`, puis court vers la droite : jusqu'au départ du morceau suivant (le pas qui y arrive
 * est rendu avec celui d'avant), ou jusqu'à l'arrivée pour le dernier. Rend null si le personnage meurt ou n'y arrive pas.
 */
function playPiece(asm: Assembled, k: number, s: AttemptState, step: Step): { inputs: number[]; after: AttemptState; before: AttemptState } | null {
  const piece = asm.pieces[k]!;
  const sol = moduleSolutions(piece.id, piece.variant)?.[piece.entry];
  if (!sol) return null;
  const inputs: number[] = [];
  const last = k === asm.pieces.length - 1;
  for (const bits of fromRuns(decodeReplay(sol.code).runs)) {
    s = step(s, bits);
    inputs.push(bits);
    if (s.status === ATTEMPT_DEAD) return null;
    if (s.status === ATTEMPT_FINISHED) return last ? { inputs, after: s, before: s } : null;
  }
  // Course vers la droite : jusqu'à l'arrivée (dernier morceau), ou jusqu'à passer le départ du morceau suivant.
  const goal = last ? 0 : callX(asm.calls[k + 1]!);
  let before = s;
  for (let n = 0; n < MAX_JOINT_RUN; n++) {
    if (!last && s.player.x >= goal) return { inputs, after: s, before };
    before = s;
    s = step(s, INPUT_RIGHT);
    inputs.push(INPUT_RIGHT);
    if (s.status === ATTEMPT_DEAD) return null;
    if (s.status === ATTEMPT_FINISHED) return last ? { inputs, after: s, before: s } : null;
  }
  return null;
}

/**
 * Met les solutions bout à bout en jouant la simulation. Chaque solution démarre au pas où le personnage **franchit le bord d'entrée** de
 * son morceau, c'est-à-dire passe la position du départ du morceau joué seul : le pas le plus proche de cette position (écart dans
 * ±187 unités à pleine vitesse), ou, si la solution n'aboutit pas de là, l'autre pas qui l'encadre (un pas de 375 unités plus tôt ou plus
 * tard). Entre deux solutions, et après la dernière s'il le faut, on court vers la droite. Rend les commandes et le pas où commence chaque
 * morceau, ou la raison de l'échec.
 */
function chainSolutions(asm: Assembled): { inputs: number[]; starts: number[] } | string {
  const level = asm.level;
  const step: Step = (s, bits) => stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
  const inputs: number[] = [];
  const starts: number[] = [];
  // Les deux états qui encadrent le départ du morceau courant : celui qui l'a passé (`after`) et celui d'avant (`before`).
  let after: AttemptState = initialAttempt(level);
  let before: AttemptState = after;
  let trailing: number[] = [];
  for (let k = 0; k < asm.pieces.length; k++) {
    const piece = asm.pieces[k]!;
    let options: { state: AttemptState; drop: number }[] = [{ state: after, drop: 0 }];
    if (k > 0) {
      const goal = callX(asm.calls[k]!);
      const late = { state: after, drop: 0 };
      const early = { state: before, drop: 1 };
      options = goal - before.player.x < after.player.x - goal ? [early, late] : [late, early];
    }
    let done: { inputs: number[]; after: AttemptState; before: AttemptState } | null = null;
    let drop = 0;
    for (const o of options) {
      done = playPiece(asm, k, o.state, step);
      if (done) {
        drop = o.drop;
        break;
      }
    }
    if (!done) return `${piece.id}:${piece.variant} n'aboutit pas (morceau ${k + 1})`;
    // Course du raccord précédent (sans son dernier pas si l'on part du pas d'avant), puis la solution.
    inputs.push(...trailing.slice(0, trailing.length - drop));
    starts.push(inputs.length);
    trailing = done.inputs;
    after = done.after;
    before = done.before;
  }
  inputs.push(...trailing);
  return { inputs, starts };
}

/** Ce qui suffit d'un morceau placé pour juger l'exigence : son exigence, son début et sa fin (pas). */
export interface PlacedExigence {
  exigence: number;
  start: number;
  end: number;
}

/** Exigence d'une suite de morceaux placés sur un temps total (pas). */
export function exigenceOfPieces(pieces: readonly PlacedExigence[], total: number): DailyExigence {
  let sum = 0;
  const acc = [
    [0, 0],
    [0, 0],
    [0, 0],
  ] as [number, number][];
  for (const p of pieces) {
    sum += p.exigence;
    const mid = idiv(p.start + p.end, 2);
    const third = mid * 3 < total ? 0 : mid * 3 < total * 2 ? 1 : 2;
    acc[third]![0] += p.exigence * (p.end - p.start);
    acc[third]![1] += p.end - p.start;
  }
  const mean = (a: [number, number]) => (a[1] === 0 ? 0 : idiv(a[0] * 10, a[1]));
  return { sum, rate: total > 0 ? idiv(sum * 10 * 60 * TICK_RATE, total) : 0, thirds: [mean(acc[0]!), mean(acc[1]!), mean(acc[2]!)] };
}

/**
 * Les règles du niveau du jour, vérifiées sur le niveau **après rejeu** (durées réelles) : rend la liste de ce qui ne va pas (vide : valide).
 * Les tests du lot 5 l'appliquent à chaque date.
 */
export function dailyProblems(d: Pick<DailyLevel, "pieces" | "authorTicks" | "level" | "exigence">): string[] {
  const out: string[] = [];
  const { pieces, authorTicks: total } = d;
  if (total < AUTHOR_MIN_TICKS || total > AUTHOR_MAX_TICKS) out.push(`temps de l'auteur ${total} pas hors de [${AUTHOR_MIN_TICKS}, ${AUTHOR_MAX_TICKS}]`);
  if (pieces.length < MIN_PIECES || pieces.length > MAX_PIECES) out.push(`${pieces.length} morceaux (de ${MIN_PIECES} à ${MAX_PIECES})`);
  if (d.level.height > MAX_DAILY_HEIGHT) out.push(`hauteur ${d.level.height} (au plus ${MAX_DAILY_HEIGHT})`);
  if (new Set(pieces.map((p) => p.id)).size !== pieces.length) out.push("morceau en double");
  if (!pieces.some((p) => p.tags.includes("mural"))) out.push("aucun morceau mural");
  if (!pieces.some((p) => p.tags.includes("scie"))) out.push("aucun morceau scie");
  let run = 0;
  for (const p of pieces) {
    run = p.tags.includes("precision") ? run + 1 : 0;
    if (run > MAX_PRECISION_RUN) out.push(`plus de ${MAX_PRECISION_RUN} morceaux precision d'affilée`);
  }
  const rest = pieces.filter((p) => p.tags.includes("respiration"));
  if (rest.length !== 1) out.push(`${rest.length} morceaux respiration (un seul, au milieu)`);
  for (const p of rest) {
    const mid = per(p.start + p.end, 2 * total);
    if (mid < RESPIRATION_FROM || mid > RESPIRATION_TO) out.push(`respiration à ${mid} ‰ (entre ${RESPIRATION_FROM} et ${RESPIRATION_TO})`);
  }
  if (pieces[0]?.entry !== "arret" || pieces.slice(1).some((p) => p.entry !== "elan")) out.push("entrées : le premier à l'arrêt, les autres en élan");
  if (!pieces.some((p) => p.exigence >= EXIGENCE_PEAK)) out.push(`aucun morceau d'exigence ${EXIGENCE_PEAK} ou plus`);
  const e = d.exigence;
  if (e.rate < EXIGENCE_RATE_MIN || e.rate > EXIGENCE_RATE_MAX) out.push(`exigence ${e.rate} hors de [${EXIGENCE_RATE_MIN}, ${EXIGENCE_RATE_MAX}]`);
  if (e.thirds[2] < e.thirds[0]) out.push(`le dernier tiers (${e.thirds[2]}) est moins exigeant que le premier (${e.thirds[0]})`);
  return out;
}

/** Score d'un tirage valide : écart au centre de la durée et de l'exigence, en pour mille de chacun (plus petit = meilleur). */
function scoreOf(ticks: number, rate: number): number {
  return per(Math.abs(ticks - AUTHOR_TARGET_TICKS), AUTHOR_TARGET_TICKS) + per(Math.abs(rate - EXIGENCE_RATE_CENTER), EXIGENCE_RATE_CENTER);
}

type Built = Omit<DailyLevel, "attempts" | "chosen" | "fallback" | "day" | "date" | "number">;

/** Assemble, enchaîne les solutions, **rejoue** et vérifie les règles. */
function prove(picks: readonly { id: string; variant: number }[], id: string): { built: Built; problems: string[] } | string {
  let asm: Assembled;
  try {
    asm = assemble(picks);
  } catch (e) {
    return `assemblage : ${(e as Error).message}`;
  }
  const chain = chainSolutions(asm);
  if (typeof chain === "string") return chain;
  const replay: JumpReplay = { simVersion: JUMP_SIM_VERSION, levelId: id, start: { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 }, runs: toRuns(chain.inputs) };
  // La preuve : le rejeu, rien d'autre.
  const result = replayAttempt(asm.level, replay, id);
  if (!result.finished) return "le rejeu n'arrive pas";
  if (result.deaths.length > 0) return `le rejeu meurt ${result.deaths.length} fois`;
  const total = result.time;
  const pieces = asm.pieces.map((p, k) => ({ ...p, start: chain.starts[k]!, end: k + 1 < asm.pieces.length ? chain.starts[k + 1]! : total }));
  const built: Built = {
    id,
    level: asm.level,
    ascii: asm.ascii,
    hash: textHash(asm.ascii),
    pieces,
    replay,
    code: encodeReplay(replay),
    authorTicks: total,
    medals: jumpMedalsFor(total),
    exigence: exigenceOfPieces(pieces, total),
  };
  return { built, problems: dailyProblems(built) };
}

/**
 * Le niveau de secours : une suite fixe de variantes, choisie parmi les tirages valides de 400 dates (celle qui tombe au centre exact de la
 * cible : 29,975 s, exigence 420), qui tient toutes les règles. Il ignore le repos. Assemblé et validé comme les autres (test) ; la mesure
 * (`measure:jump`) montre qu'il ne sert jamais.
 */
export const FALLBACK_PIECES: readonly { id: string; variant: number }[] = [
  { id: "mur-seul", variant: 2 },
  { id: "quinconce", variant: 0 },
  { id: "piliers", variant: 1 },
  { id: "escalier", variant: 1 },
  { id: "cheminee-scie", variant: 3 },
  { id: "scie-ronde", variant: 0 },
  { id: "demi-tour", variant: 1 },
  { id: "puits", variant: 1 },
  { id: "mur-friable", variant: 1 },
  { id: "lucarne", variant: 1 },
];

const cache = new Map<number, DailyLevel>();

/**
 * **Le niveau du jour** `day` (numéro de jour de `@cdj/core`, la date de Paris lue hors de la simulation). Pur et déterministe : même date,
 * même niveau, partout. Le résultat est gardé en mémoire (même objet pour une même date).
 */
export function dailyLevel(day: number): DailyLevel {
  const hit = cache.get(day);
  if (hit) return hit;
  const id = dailyLevelId(day);
  const seed = mixSeed(day, DAILY_SALT);
  const attempts: DailyAttempt[] = [];
  let best: { built: Built; index: number; score: number } | null = null;
  for (let index = 0; index < DAILY_MAX_ATTEMPTS; index++) {
    if (index >= DAILY_DRAWS && best) break;
    const picks = compose(day, new Rng(mixSeed(seed, index)));
    if (typeof picks === "string") {
      attempts.push({ index, status: "impasse", reason: picks, pieces: [], ticks: 0, rate: 0, score: 0 });
      continue;
    }
    const names = picks.map((p) => `${p.choice.id}:${p.choice.variant}`);
    const proof = prove(
      picks.map((p) => ({ id: p.choice.id, variant: p.choice.variant })),
      id,
    );
    if (typeof proof === "string") {
      attempts.push({ index, status: "refusé", reason: proof, pieces: names, ticks: 0, rate: 0, score: 0 });
      continue;
    }
    const { built, problems } = proof;
    const score = scoreOf(built.authorTicks, built.exigence.rate);
    const status = problems.length > 0 ? "refusé" : "valide";
    attempts.push({ index, status, reason: problems.join(" ; "), pieces: names, ticks: built.authorTicks, rate: built.exigence.rate, score });
    if (problems.length > 0) continue;
    if (!best || score < best.score) best = { built, index, score };
  }
  let out: DailyLevel;
  if (best) out = { ...best.built, day, date: formatDay(day), number: levelNumber(day), attempts, chosen: best.index, fallback: false };
  else {
    const proof = prove(FALLBACK_PIECES, id);
    if (typeof proof === "string" || proof.problems.length > 0) throw new Error(`Niveau de secours invalide : ${typeof proof === "string" ? proof : proof.problems.join(" ; ")}`);
    out = { ...proof.built, day, date: formatDay(day), number: levelNumber(day), attempts, chosen: -1, fallback: true };
  }
  cache.set(day, out);
  return out;
}

/** Le niveau de secours d'une date (pour les tests et la mesure : il ne sert que si aucun tirage ne passe). */
export function fallbackLevel(day: number): DailyLevel | string {
  const proof = prove(FALLBACK_PIECES, dailyLevelId(day));
  if (typeof proof === "string") return proof;
  if (proof.problems.length > 0) return proof.problems.join(" ; ");
  return { ...proof.built, day, date: formatDay(day), number: levelNumber(day), attempts: [], chosen: -1, fallback: true };
}
