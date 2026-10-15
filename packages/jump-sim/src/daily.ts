import { Rng, daysFromCivil, formatDay, mixSeed } from "@cdj/core";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, initialAttempt, stepAttempt, type AttemptState } from "./attempt";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, TICK_RATE } from "./constants";
import { idiv } from "./idiv";
import { parseLevel, type Level } from "./level";
import {
  MODULES,
  MODULE_ENTRIES,
  PALIER_GUARD,
  PALIER_LENGTH,
  RACCORD_TAIL,
  buildModule,
  canonicalOf,
  centerCol,
  moduleSolutions,
  textHash,
  variantExigence,
  type ModuleEntry,
  type ModuleExit,
  type ModuleTag,
  type Palier,
} from "./modules";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_RIGHT } from "./player";
import { decodeReplay, encodeReplay, fromRuns, replayAttempt, toRuns, type JumpReplay } from "./replay";

// Le niveau du jour (lot 5) : `dailyLevel(jour)` assemble des morceaux du catalogue (lot 4) qui **portent leur solution**, puis **rejoue** la
// suite de ces solutions sur le niveau assemblé. Si elle arrive au bout sans mourir, le niveau est valide et ce rejeu donne le temps de
// l'auteur, d'où les médailles. Fonction pure : la date est un argument (numéro de jour, `@cdj/core`), rien ne lit l'heure.
//
// **Assemblage** (lot 6 ; une rangée = une rangée de tuiles, de haut en bas) :
//   garde · palier de départ `S` · morceau 1 · palier partagé `C` · morceau 2 · … · morceau n · palier d'arrivée · colonne d'arrivée `F`
//   - les paliers sont les **paliers standard** des morceaux (`PALIER_LENGTH` colonnes : sol plein, plein dessous, vide au-dessus) ; le
//     palier de sortie d'un morceau **est** le palier d'entrée du suivant (les mêmes tuiles, aucune colonne de raccord), aligné **par sa
//     rangée** ; son vide monte jusqu'en haut du plus haut des deux morceaux voisins ;
//   - le point de passage `C` du morceau suivant est au début de ce palier, au sol : y reprendre, c'est exactement le départ « à l'arrêt »
//     du morceau seul ;
//   - le premier morceau part à l'**arrêt** (départ `S` au début du premier palier, une colonne de garde devant, comme `buildModule`) ;
//     chacun des suivants entre dans **l'état canonique où le précédent est sorti** (lot 8c : à la course ou en élan plein) ;
//   - hors des morceaux et des paliers, **tout est plein** ; une rangée de blocs ferme le haut (les côtés sont fermés par `tileAt`) ; sous
//     un morceau, le vide continue jusqu'en bas du niveau là où sa dernière rangée n'est pas un bloc (on y meurt en tombant, comme dans le
//     morceau seul) ;
//   - chaque morceau est **une section** (ses scies démarrent quand le centre du personnage passe le bord droit du palier qui le précède) ;
//     ses scies mobiles sont recopiées, coordonnées décalées.
//
// **La preuve** : la solution du premier morceau (à l'arrêt), jouée jusqu'à sa **sortie canonique** (le centre passe le bord droit du
// palier, au sol, à la course ou en élan plein : `canonicalOf`) ; puis, **au pas suivant, sans course entre les deux**, la solution du
// morceau suivant **pour cet état d'entrée** (lot 8c), à partir de son entrée (`entryTick` : le pas où, joué seul, il franchit ce même bord
// dans cet état) ; et ainsi de suite ; la dernière jusqu'à l'arrivée. L'élan passe donc les coutures : un morceau qui sort en élan plein
// fait entrer le suivant en élan plein. Une seule possibilité par raccord (plus de repli « l'autre pas » du lot 5) : le raccord strict du lot 6 l'a rendu inutile.
// Cette rediffusion complète est ensuite **rejouée** par `replayAttempt` sur le niveau assemblé : rien n'est supposé.
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
 * Temps **estimé** (somme des durées des solutions entre leur entrée et leur sortie canoniques, plus `JOINT_TICKS` par raccord) : on ajoute
 * des morceaux tant qu'il est sous `ESTIMATE_MIN_TICKS` ; le dernier ne doit pas le pousser au-delà de `ESTIMATE_MAX_TICKS`.
 */
export const ESTIMATE_MIN_TICKS = 28 * TICK_RATE;
export const ESTIMATE_MAX_TICKS = 32 * TICK_RATE;
/** Pas de course entre la sortie d'une solution et l'entrée de la suivante : 0 depuis le lot 6 (9 au lot 5, colonne de raccord). */
export const JOINT_TICKS = 0;
/** Morceaux par niveau : 6 à 13 (10 au lot 5 ; sans course à vide, il en faut 11 ou 12 pour la même durée). */
export const MIN_PIECES = 6;
export const MAX_PIECES = 15;
/**
 * Enchaînements longs (lot 7) : au moins `MIN_LONG` par niveau, au plus `MAX_LONG` ; imposé à partir de `FORCE_LONG_AT` (pour mille du
 * temps cible) s'il manque encore.
 */
export const MIN_LONG = 1;
export const MAX_LONG = 2;
export const FORCE_LONG_AT = 300;
/**
 * Plus longue course au sol sans saut (lot 7), sur la rediffusion de l'auteur : au plus 2 s (règle du générateur ; la cible de la moyenne,
 * 1,2 s, est mesurée par `measure:jump` et vérifiée par les tests).
 */
export const LONGEST_RUN_MAX = 2 * TICK_RATE;
/** Hauteur totale du niveau, rangée de blocs du haut comprise (48 au lot 5 : un morceau de plus, c'est plus de dénivelé). */
export const MAX_DAILY_HEIGHT = 56;

// ——— Budget d'exigence (la même exigence chaque jour : pas de difficulté selon le jour de la semaine) ———

/**
 * Exigence du niveau = somme des exigences de ses morceaux (1 à 5, lot 4) **ramenée à sa durée**, en **dixièmes de point par minute** de
 * temps de l'auteur (`exigenceRate`). Elle doit tomber dans [`EXIGENCE_RATE_MIN`, `EXIGENCE_RATE_MAX`] ; le score des tirages vise
 * `EXIGENCE_RATE_CENTER`. Seuils réglés sur `npm run measure:jump` (README des lots 5 à 7 : 380–460 au lot 5, 430–520 au lot 6 ; lot 7 :
 * nouveau catalogue, la fenêtre est recentrée sur la médiane des tirages, même largeur relative, ±10 %).
 */
export const EXIGENCE_RATE_MIN = 600;
export const EXIGENCE_RATE_MAX = 740;
export const EXIGENCE_RATE_CENTER = 670;
/** Au moins un morceau de cette exigence ou plus. */
export const EXIGENCE_PEAK = 4;
/**
 * Profil visé pendant le tirage, en dixièmes de point : un morceau placé à la fraction p du temps cible vise l'exigence
 * `PROFILE_START + (PROFILE_END − PROFILE_START) × p` (la variante la plus proche est choisie). Règle vérifiée après rejeu : le dernier
 * tiers (en temps) est au moins aussi exigeant, en moyenne pondérée par la durée, que le premier. 1,3 → 3,3 aux lots 5 et 6 ; 1,0 → 3,0 au
 * lot 7 (avec la correction ci-dessous, le niveau moyen remonte de lui-même) ; 1,0 → 3,6 au lot 7b (tension jusqu'à la fin).
 */
export const PROFILE_START = 10;
export const PROFILE_END = 34;
/**
 * Correction du profil (lot 7, pour cent) : la variante visée suit le profil plus cette part de l'écart entre l'exigence accumulée et celle
 * que donnerait `EXIGENCE_RATE_CENTER` pour le temps estimé. Sans elle, la somme de 10 morceaux d'exigence 1 à 5 s'étalait trop : 44 % des
 * tirages rejoués tombaient hors de la fenêtre (mesuré). Elle ne s'applique qu'à partir de `STEER_FROM` (pour mille du temps visé) : le
 * début garde son profil doux, la fin rattrape (sinon la règle « dernier tiers ≥ premier tiers » échouait plus souvent).
 */
export const EXIGENCE_STEER = 60;
export const STEER_FROM = 600;
/**
 * Lot 7b : la tension monte jusqu'à la fin — le dernier tiers est au moins aussi exigeant que le deuxième (en plus du premier). Mesurée sur
 * 120 dates : avec l'ancien pilotage (profil 1,0 → 3,0, correction 60 % dès 33 %) la règle ne laissait que 42 % de tirages validés ; avec
 * `PROFILE_END` 36, `EXIGENCE_STEER` 100 et `STEER_FROM` 600 (la correction ne joue que sur le dernier tiers, le milieu garde son profil
 * doux) 61,8 %, secours 0 (README du lot 7b).
 */
export const TENSION_RISES = true;

// ——— Quotas, repos, tirages ———

/** Jamais plus de ce nombre de morceaux `precision` d'affilée. */
export const MAX_PRECISION_RUN = 2;
/** Le morceau `respiration` du milieu : son milieu tombe entre 35 et 65 % du temps (pour mille). Un seul morceau `respiration` par niveau. */
export const RESPIRATION_FROM = 350;
export const RESPIRATION_TO = 650;
/** Un quota manquant (mural, scie) est imposé à partir de cette fraction du temps cible (pour mille) ; la pointe d'exigence, au dernier tiers. */
export const FORCE_QUOTA_AT = 550;
/** Le morceau `respiration` est imposé quand le temps estimé passe le haut de sa fenêtre moins ceci (un morceau et une demi-respiration). */
export const FORCE_REST_SLACK = 3 * TICK_RATE;
export const FORCE_PEAK_AT = 667;
/**
 * Lot 8c : le morceau `elan` (au moins un par niveau) est imposé plus tôt que les autres quotas, à partir de ce point du temps cible (pour
 * mille) : peu exigeant (1 à 3), placé dans le dernier tiers il le rendait moins exigeant que le deuxième (règle de tension, mesuré).
 */
export const FORCE_ELAN_AT = 450;
/** Lot 8c : poids relatif d'un morceau propre au jour (ni la veille ni le lendemain) face à un morceau partagé avec un jour voisin. */
export const SHARED_WEIGHT = 2;
/** Poids d'une respiration qui peut tomber au milieu (lot 7). */
export const REST_WEIGHT = 4;
/** Tirages par jour (on garde le meilleur valide) et tentatives au plus (au-delà : le secours). */
export const DAILY_DRAWS = 6;
export const DAILY_MAX_ATTEMPTS = 40;
/** Sels des graines : `mixSeed(jour, DAILY_SALT)`, et des groupes de repos. */
const DAILY_SALT = 0x6a6f7572;

/**
 * **Course à vide** (lot 6) : le temps passé au sol **sans appui de saut** quand le centre du personnage est au-dessus d'un palier de
 * raccord, sur la rediffusion de l'auteur, reste sous cette part du temps de l'auteur (pour mille). Cible du lot 6 : moins de 6 %.
 */
export const EMPTY_RUN_MAX = 60;

/** Médailles : facteurs (en pour cent) du temps de l'auteur, arrondis au pas supérieur. À calibrer sur de vraies parties (seed § 5). */
export const MEDAL_PERCENT = { gold: 110, silver: 130, bronze: 160 } as const;

/**
 * **Repos sans historique** (comme `isRested` de DailyTrack ; lot 7 : généralisé) : chaque morceau appartient à l'un de `REST_GROUPS`
 * groupes (empreinte de son identifiant) ; le jour `d`, seuls `REST_OPEN` groupes consécutifs sont ouverts, à partir du groupe
 * `REST_OPEN × d` (modulo `REST_GROUPS`) : la fenêtre avance de `REST_OPEN` groupes par jour. Deux jours de suite n'ont donc en commun que
 * les morceaux de `2 × REST_OPEN − REST_GROUPS` groupes, sans aucune mémoire des jours passés. Le secours ignore le repos.
 * Lots 5 et 6 : 3 groupes, 2 ouverts (un en commun d'un jour au suivant, le tiers du catalogue) ; lot 7 : 7 groupes, 4 ouverts (un en commun,
 * le septième du catalogue) — mesuré par `measure:jump` (README du lot 7).
 */
export const REST_GROUPS = 7;
export const REST_OPEN = 4;
/**
 * Sel de l'empreinte des groupes : choisi par `npm run repos:modules -w @cdj/jump-sim` (README du lot 7) pour que les groupes aient la même
 * taille, que chaque étiquette, les enchaînements longs et les morceaux qui finissent plus bas y soient répartis, et que les morceaux d'une
 * même famille tombent le plus possible dans des groupes différents. Changer de sel change les niveaux : `JUMP_GENERATOR_VERSION` +1.
 * (Lot 5 : `repos4310:` ; lot 7 : `repos2527:`.)
 */
export const REST_SALT = "repos17912:";
export function restGroup(id: string): number {
  return Number.parseInt(textHash(`${REST_SALT}${id}`), 16) % REST_GROUPS;
}
/** Le groupe `g` est-il ouvert le jour `day` ? (Entre `REST_OPEN × day` et `REST_OPEN × day + REST_OPEN − 1`, modulo `REST_GROUPS`.) */
export function isOpenGroup(g: number, day: number): boolean {
  const from = (((REST_OPEN * day) % REST_GROUPS) + REST_GROUPS) % REST_GROUPS;
  return (((g - from) % REST_GROUPS) + REST_GROUPS) % REST_GROUPS < REST_OPEN;
}
export function isRestedModule(id: string, day: number): boolean {
  return !isOpenGroup(restGroup(id), day);
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

/** Une variante utilisable : solutions stockées aux trois entrées, exigence ≥ 1. */
interface Choice {
  id: string;
  variant: number;
  tags: readonly ModuleTag[];
  /** Famille (une seule de chaque par niveau) et enchaînement long (lot 7). */
  family: string;
  long: boolean;
  exigence: number;
  /** Durées des solutions entre leur entrée et leur sortie canoniques (pas), par entrée, et l'état de sortie de chacune (lot 8c). */
  ticks: Readonly<Record<ModuleEntry, number>>;
  exits: Readonly<Record<ModuleEntry, ModuleExit>>;
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
      if (!s || MODULE_ENTRIES.some((e) => !s[e]) || exigence < 1) return [];
      const b = buildModule(def.id, variant);
      const ticks = { arret: 0, course: 0, plein: 0 };
      const exits: Record<ModuleEntry, ModuleExit> = { arret: "course", course: "course", plein: "course" };
      for (const e of MODULE_ENTRIES) {
        ticks[e] = s[e]!.exitTick - s[e]!.entryTick;
        exits[e] = s[e]!.exit;
      }
      return [{ id: def.id, variant, tags: def.tags, family: def.family, long: def.long, exigence, ticks, exits, height: b.height, width: b.width, entryRow: b.entryRow, exitRow: b.exitRow }];
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
  /** Famille et enchaînement long (lot 7). */
  family: string;
  long: boolean;
  exigence: number;
  /** Durée de sa solution entre son entrée et sa sortie canoniques (pas), celle qui compte dans l'estimation. */
  solutionTicks: number;
  /** Colonnes du morceau dans le niveau (bornes comprises) : c'est sa section. */
  col0: number;
  col1: number;
  /** Rangée du niveau où commence sa grille, et rangées de ses paliers d'entrée et de sortie (sol). */
  top: number;
  entryRow: number;
  exitRow: number;
  /** Pas de la preuve où il commence (son entrée : la sortie du précédent ; 0 pour le premier) et où il finit (début du suivant, ou l'arrivée). */
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
  /** Les paliers (`pieces.length + 1`) : départ, raccords (palier de sortie de l'un = palier d'entrée du suivant), arrivée. */
  paliers: readonly Palier[];
  /** Course à vide sur chaque palier de raccord (`pieces.length − 1`), en pas, sur la rediffusion de l'auteur (`palierTicksOf`). */
  palierTicks: readonly number[];
  /** Plus longue course au sol sans saut de la rediffusion de l'auteur, en pas (`longestRunOf`, lot 7). */
  longestRun: number;
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

const ticksOf = (p: Slot) => p.choice.ticks[p.entry];
/** L'entrée du morceau qui suit `p` : l'état canonique où sort sa solution. */
const nextEntry = (p: Slot): ModuleEntry => p.choice.exits[p.entry];

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
  const families = new Set<string>();
  let est = 0;
  for (;;) {
    if (picks.length >= MAX_PIECES) return "trop de morceaux";
    const first = picks.length === 0;
    const entry: ModuleEntry = first ? "arret" : nextEntry(picks[picks.length - 1]!);
    const p = per(est, AUTHOR_TARGET_TICKS);
    // Le profil visé, corrigé (lot 7) d'une part du retard ou de l'avance de l'exigence accumulée sur ce que donnerait le centre de la
    // fenêtre pour ce temps estimé (en centièmes de point : rate × pas ÷ 720) : la composition revient vers le centre au lieu d'y tomber au
    // hasard.
    const done = picks.reduce((n, q) => n + q.choice.exigence, 0) * 100;
    const steer = p < STEER_FROM ? 0 : idiv((idiv(EXIGENCE_RATE_CENTER * est, 720) - done) * EXIGENCE_STEER, 100);
    const target = PROFILE_START * 10 + idiv((PROFILE_END - PROFILE_START) * 10 * (p < 1000 ? p : 1000), 1000) + steer; // centièmes de point
    const precisionRun = picks.length >= MAX_PRECISION_RUN && picks.slice(-MAX_PRECISION_RUN).every((q) => has(q.choice, "precision"));
    const needMural = !picks.some((q) => has(q.choice, "mural"));
    const needScie = !picks.some((q) => has(q.choice, "scie"));
    const needElan = !picks.some((q) => has(q.choice, "elan"));
    const needRest = !picks.some((q) => has(q.choice, "respiration"));
    const needPeak = !picks.some((q) => q.choice.exigence >= EXIGENCE_PEAK);
    const longs = picks.filter((q) => q.choice.long).length;
    const forceLong = longs < MIN_LONG && p >= FORCE_LONG_AT;
    const restWindow = (c: Choice, ticks: number) => {
      const mid = est + idiv(ticks, 2);
      return mid >= idiv(ESTIMATE_MAX_TICKS * RESPIRATION_FROM, 1000) && mid <= idiv(ESTIMATE_MIN_TICKS * RESPIRATION_TO, 1000) && has(c, "respiration");
    };
    // Le morceau de respiration est imposé quand, après un morceau de plus, il ne pourrait plus tomber au milieu (lot 6 : les morceaux plus
    // courts le faisaient imposer trop tôt, quand aucun ne pouvait encore avoir son milieu dans la fenêtre).
    const forceRest = needRest && est + FORCE_REST_SLACK > idiv(ESTIMATE_MIN_TICKS * RESPIRATION_TO, 1000);
    const forceMural = needMural && p >= FORCE_QUOTA_AT;
    const forceScie = needScie && p >= FORCE_QUOTA_AT;
    const forceElan = needElan && p >= FORCE_ELAN_AT;
    const forcePeak = needPeak && p >= FORCE_PEAK_AT;

    interface Cand {
      pick: Slot;
      weight: number;
    }
    const cands: Cand[] = [];
    for (const list of pool) {
      const id = list[0]!.id;
      if (used.has(id) || families.has(list[0]!.family)) continue;
      const tags = list[0]!.tags;
      const long = list[0]!.long;
      if (long ? longs >= MAX_LONG : forceLong && !forceRest) continue;
      if (precisionRun && tags.includes("precision")) continue;
      if (tags.includes("respiration") && !needRest) continue;
      if (forceRest && !tags.includes("respiration")) continue;
      if ((forceMural || forceScie || forceElan) && !((forceMural && tags.includes("mural")) || (forceScie && tags.includes("scie")) || (forceElan && tags.includes("elan")))) continue;
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
          if (!all.some((q) => has(q, "mural")) || !all.some((q) => has(q, "scie")) || !all.some((q) => has(q, "respiration")) || !all.some((q) => has(q, "elan"))) return false;
          if (!all.some((q) => q.exigence >= EXIGENCE_PEAK) || all.length < MIN_PIECES) return false;
          if (all.filter((q) => q.long).length < MIN_LONG) return false;
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
      if ((needMural && has(choice, "mural")) || (needScie && has(choice, "scie")) || (needElan && has(choice, "elan"))) weight *= 2;
      // Lot 7 : une respiration qui peut tomber au milieu est préférée tout de suite (`REST_WEIGHT`) ; attendue jusqu'au dernier moment, elle
      // manquait souvent (deux à quatre disponibles par jour, parfois prises par leur famille) : 20 % des tirages finissaient en impasse.
      if (has(choice, "respiration")) weight *= REST_WEIGHT;
      // Lot 8c : un morceau d'un groupe ouvert aussi la veille ou le lendemain (les deux groupes du bord de la fenêtre, déduits de la date
      // seule) pèse moitié moins : avec l'élan, les morceaux sont plus courts et plus nombreux par niveau (12 au lieu de 11), et les jours
      // consécutifs en partageaient davantage (1,6 en moyenne, cible 1,5).
      const g = restGroup(choice.id);
      if (!isOpenGroup(g, day - 1) && !isOpenGroup(g, day + 1)) weight *= SHARED_WEIGHT;
      cands.push({ pick: { choice, entry }, weight });
    }
    if (cands.length === 0) {
      const forced = [forceRest && "respiration", forceLong && !forceRest && "long", forceMural && "mural", forceScie && "scie", forceElan && "elan", forcePeak && "pointe"].filter(Boolean);
      return `impasse au morceau ${picks.length + 1}${forced.length ? ` (imposés : ${forced.join(", ")})` : ""}`;
    }
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
    families.add(chosen.pick.choice.family);
    est += ticksOf(chosen.pick) + (picks.length > 1 ? JOINT_TICKS : 0);
    if (est >= ESTIMATE_MIN_TICKS) return picks;
  }
}

// ——— Assemblage ———

interface Assembled {
  level: Level;
  ascii: string;
  pieces: DailyPiece[];
  paliers: Palier[];
}

/**
 * Assemble une suite de morceaux en un niveau (grille + bloc annexe). L'entrée de chaque morceau (`DailyPiece.entry`) est celle que
 * prévoient les solutions stockées (l'état de sortie du précédent) ; l'enchaînement rejoué (`chainSolutions`) la confirme ou la corrige.
 */
export function assemble(picks: readonly { id: string; variant: number }[]): Assembled {
  const all = choices().flat();
  const full: Slot[] = [];
  picks.forEach((p, k) => {
    const choice = all.find((c) => c.id === p.id && c.variant === p.variant);
    if (!choice) throw new RangeError(`Morceau « ${p.id} », variante ${p.variant} : pas de solution utilisable`);
    full.push({ choice, entry: k === 0 ? "arret" : nextEntry(full[k - 1]!) });
  });
  if (full.length === 0) throw new RangeError("Assemblage vide");
  const L = PALIER_LENGTH;
  const { tops, height } = stack(full);
  const G = PALIER_GUARD;
  const width = G + full.reduce((s, p) => s + p.choice.width, 0) + (full.length + 1) * L + 1;
  const rows: string[][] = [];
  for (let r = 0; r < height; r++) rows.push(new Array<string>(width).fill("#"));
  const annex: string[] = [];
  const pieces: DailyPiece[] = [];
  const paliers: Palier[] = [];
  let col = G + L;
  full.forEach((p, k) => {
    const built = buildModule(p.choice.id, p.choice.variant);
    const [gridText, annexText = ""] = built.ascii.split("\n\n");
    const g = gridText!.split("\n").map((line) => line.slice(built.lead, built.lead + built.width));
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
    pieces.push({
      id: p.choice.id,
      variant: p.choice.variant,
      entry: p.entry,
      tags: p.choice.tags,
      family: p.choice.family,
      long: p.choice.long,
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
    col += built.width + L;
  });
  // Les paliers : avant le premier morceau, entre deux morceaux (partagé), après le dernier ; sol à la rangée du raccord, plein dessous,
  // vide au-dessus jusqu'en haut du plus haut des morceaux voisins. Puis la colonne d'arrivée, comme le dernier palier.
  for (let k = 0; k <= full.length; k++) {
    const before = pieces[k - 1];
    const after = pieces[k];
    const row = after ? after.entryRow : before!.exitRow;
    const roof = Math.min(before ? before.top : height, after ? after.top : height);
    const col0 = after ? after.col0 - L : before!.col1 + 1;
    // Le premier palier a sa colonne de garde devant lui, le dernier la colonne d'arrivée derrière lui.
    const from = k === 0 ? col0 - G : col0;
    const to = k === full.length ? col0 + L + 1 : col0 + L;
    for (let c = from; c < to; c++) for (let r = roof; r < row; r++) rows[r]![c] = ".";
    paliers.push({ col0, col1: col0 + L - 1, row });
    rows[row - 1]![col0] = k === 0 ? "S" : k === full.length ? "." : "C";
    if (k === full.length) rows[row - 1]![col0 + L] = "F";
  }
  const ascii = rows.map((r) => r.join("")).join("\n") + "\n\n" + annex.join("\n") + "\n";
  return { level: parseLevel(ascii), ascii, pieces, paliers };
}

// ——— La preuve ———

type Step = (s: AttemptState, bits: number) => AttemptState;

/**
 * Met les solutions bout à bout en jouant la simulation : la solution du morceau `k` **pour l'état où le précédent est sorti** (lot 8c :
 * arrêt pour le premier, puis course ou élan plein) est jouée à partir de son entrée (`entryTick` ; 0 pour le premier) depuis cet état,
 * jusqu'à **sa** sortie canonique — le centre passe le bord droit du palier qui le suit (la première colonne du morceau suivant), vivant, à
 * la course ou en élan plein —, ou jusqu'à l'arrivée pour le dernier. Rend les commandes, le pas où commence chaque morceau et l'entrée
 * de chacun, ou la raison de l'échec.
 */
function chainSolutions(asm: Assembled): { inputs: number[]; starts: number[]; entries: ModuleEntry[] } | string {
  const level = asm.level;
  const step: Step = (s, bits) => stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
  const inputs: number[] = [];
  const starts: number[] = [];
  const entries: ModuleEntry[] = [];
  let s: AttemptState = initialAttempt(level);
  let entry: ModuleEntry = "arret";
  for (let k = 0; k < asm.pieces.length; k++) {
    const piece = asm.pieces[k]!;
    entries.push(entry);
    const sol = moduleSolutions(piece.id, piece.variant)?.[entry];
    if (!sol) return `${piece.id}:${piece.variant} sans solution`;
    const commands = fromRuns(decodeReplay(sol.code).runs);
    const last = k === asm.pieces.length - 1;
    const exitCol = last ? -1 : asm.pieces[k + 1]!.col0;
    starts.push(inputs.length);
    let done = false;
    // Selon la position d'entrée (dans un pas de course), la sortie peut venir quelques pas après la fin des commandes stockées : on
    // continue alors droite tenue, comme le test de raccord (`RACCORD_TAIL`).
    const end = commands.length + RACCORD_TAIL;
    for (let t = k === 0 ? 0 : sol.entryTick; t < end && !done; t++) {
      const bits = t < commands.length ? commands[t]! : INPUT_RIGHT;
      s = step(s, bits);
      inputs.push(bits);
      if (s.status === ATTEMPT_DEAD) return `${piece.id}:${piece.variant} meurt (morceau ${k + 1})`;
      if (s.status === ATTEMPT_FINISHED) {
        if (!last) return `${piece.id}:${piece.variant} touche l'arrivée (morceau ${k + 1})`;
        done = true;
      } else if (!last && centerCol(s.player) >= exitCol) {
        const exit = canonicalOf(s.player);
        if (!exit) return `${piece.id}:${piece.variant} sort hors des états canoniques (morceau ${k + 1})`;
        entry = exit;
        done = true;
      }
    }
    if (!done) return `${piece.id}:${piece.variant} n'aboutit pas (morceau ${k + 1})`;
  }
  return { inputs, starts, entries };
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
export function dailyProblems(d: Pick<DailyLevel, "pieces" | "authorTicks" | "level" | "exigence" | "palierTicks" | "longestRun">): string[] {
  const out: string[] = [];
  const { pieces, authorTicks: total } = d;
  if (total < AUTHOR_MIN_TICKS || total > AUTHOR_MAX_TICKS) out.push(`temps de l'auteur ${total} pas hors de [${AUTHOR_MIN_TICKS}, ${AUTHOR_MAX_TICKS}]`);
  if (pieces.length < MIN_PIECES || pieces.length > MAX_PIECES) out.push(`${pieces.length} morceaux (de ${MIN_PIECES} à ${MAX_PIECES})`);
  if (d.level.height > MAX_DAILY_HEIGHT) out.push(`hauteur ${d.level.height} (au plus ${MAX_DAILY_HEIGHT})`);
  if (new Set(pieces.map((p) => p.id)).size !== pieces.length) out.push("morceau en double");
  if (new Set(pieces.map((p) => p.family)).size !== pieces.length) out.push("famille en double");
  const longs = pieces.filter((p) => p.long).length;
  if (longs < MIN_LONG || longs > MAX_LONG) out.push(`${longs} enchaînements longs (de ${MIN_LONG} à ${MAX_LONG})`);
  if (d.longestRun > LONGEST_RUN_MAX) out.push(`course au sol sans saut de ${d.longestRun} pas (au plus ${LONGEST_RUN_MAX})`);
  if (!pieces.some((p) => p.tags.includes("mural"))) out.push("aucun morceau mural");
  if (!pieces.some((p) => p.tags.includes("scie"))) out.push("aucun morceau scie");
  if (!pieces.some((p) => p.tags.includes("elan"))) out.push("aucun morceau elan");
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
  if (pieces[0]?.entry !== "arret" || pieces.slice(1).some((p) => p.entry === "arret")) out.push("entrées : le premier à l'arrêt, les autres lancés (course ou élan plein)");
  if (!pieces.some((p) => p.exigence >= EXIGENCE_PEAK)) out.push(`aucun morceau d'exigence ${EXIGENCE_PEAK} ou plus`);
  const e = d.exigence;
  if (e.rate < EXIGENCE_RATE_MIN || e.rate > EXIGENCE_RATE_MAX) out.push(`exigence ${e.rate} hors de [${EXIGENCE_RATE_MIN}, ${EXIGENCE_RATE_MAX}]`);
  if (e.thirds[2] < e.thirds[0]) out.push(`le dernier tiers (${e.thirds[2]}) est moins exigeant que le premier (${e.thirds[0]})`);
  if (TENSION_RISES && e.thirds[2] < e.thirds[1]) out.push(`le dernier tiers (${e.thirds[2]}) est moins exigeant que le deuxième (${e.thirds[1]})`);
  const idle = d.palierTicks.reduce((a, b) => a + b, 0);
  if (idle * 1000 >= EMPTY_RUN_MAX * total) out.push(`course à vide sur les paliers ${per(idle, total)} ‰ (moins de ${EMPTY_RUN_MAX} ‰)`);
  return out;
}

/**
 * Course à vide sur les paliers de raccord (`paliers` sans le premier ni le dernier) : pour chacun, les pas où, après le pas joué, le
 * personnage est au sol, le bouton de saut relâché dans la commande de ce pas, et son centre au-dessus des colonnes du palier. Rejoue les
 * commandes depuis le départ (jusqu'à l'arrivée ou une mort).
 */
export function palierTicksOf(level: Level, paliers: readonly Palier[], inputs: readonly number[]): number[] {
  const joints = paliers.slice(1, -1);
  const out = joints.map(() => 0);
  let s = initialAttempt(level);
  for (const bits of inputs) {
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) break;
    if (s.player.ground === 1 && (bits & INPUT_JUMP) === 0) {
      const col = centerCol(s.player);
      for (let k = 0; k < joints.length; k++) if (col >= joints[k]!.col0 && col <= joints[k]!.col1) out[k]!++;
    }
    if (s.status === ATTEMPT_FINISHED) break;
  }
  return out;
}

/**
 * Plus longue course au sol sans saut (lot 7) : le plus grand nombre de pas consécutifs où, après le pas joué, le personnage est au sol et le
 * bouton de saut relâché dans la commande de ce pas (la même mesure que `tools/vide.ts`). Rejoue les commandes depuis le départ.
 */
export function longestRunOf(level: Level, inputs: readonly number[]): number {
  let s = initialAttempt(level);
  let run = 0;
  let best = 0;
  for (const bits of inputs) {
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) break;
    run = s.player.ground === 1 && (bits & INPUT_JUMP) === 0 ? run + 1 : 0;
    if (run > best) best = run;
    if (s.status === ATTEMPT_FINISHED) break;
  }
  return best;
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
  const pieces = asm.pieces.map((p, k) => {
    const entry = chain.entries[k]!;
    const sol = moduleSolutions(p.id, p.variant)![entry]!;
    return { ...p, entry, solutionTicks: sol.exitTick - sol.entryTick, start: chain.starts[k]!, end: k + 1 < asm.pieces.length ? chain.starts[k + 1]! : total };
  });
  const built: Built = {
    id,
    level: asm.level,
    ascii: asm.ascii,
    hash: textHash(asm.ascii),
    pieces,
    paliers: asm.paliers,
    palierTicks: palierTicksOf(asm.level, asm.paliers, chain.inputs),
    longestRun: longestRunOf(asm.level, chain.inputs),
    replay,
    code: encodeReplay(replay),
    authorTicks: total,
    medals: jumpMedalsFor(total),
    exigence: exigenceOfPieces(pieces, total),
  };
  return { built, problems: dailyProblems(built) };
}

/**
 * Le niveau de secours : une suite fixe de variantes, choisie parmi les tirages valides de 400 dates (celle qui tombe le plus près du centre
 * de la cible : 30,23 s, exigence 674 ; lot 8c, `tools/secours.ts`), qui tient toutes les règles. Il ignore le repos. Assemblé et validé comme
 * les autres (test) ; la mesure (`measure:jump`) montre qu'il ne sert jamais.
 */
export const FALLBACK_PIECES: readonly { id: string; variant: number }[] = [
  { id: "piliers", variant: 2 },
  { id: "scie-sol", variant: 0 },
  { id: "grand-saut", variant: 3 },
  { id: "puits", variant: 1 },
  { id: "mur-trous", variant: 1 },
  { id: "petits-trous", variant: 1 },
  { id: "ressort-plafond", variant: 1 },
  { id: "iles-scie", variant: 2 },
  { id: "mur-friable", variant: 1 },
  { id: "plafond-pics", variant: 1 },
  { id: "escalier-friable", variant: 2 },
  { id: "saut-long", variant: 2 },
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
