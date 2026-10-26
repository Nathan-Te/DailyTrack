import { Rng, daysFromCivil, formatDay, mixSeed } from "@cdj/core";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, ATTEMPT_RUNNING, checkpointAttempt, circleHitsBox, initialAttempt, stepAttempt, type AttemptState, type Box } from "./attempt";
import { JUMP_GENERATOR_VERSION, PLATFORM_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, TICK_RATE, UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";
import { TILE_EMPTY, TILE_SOLID, cycleMod, parseLevel, platformPos, sawCenter, sectionPeriod, withSingleClock, type Level } from "./level";
import { FROZEN_BASE_IDS } from "./figes";
import { platformProblems } from "./plateformes";
import { PHASE_REFUSED } from "./phases";
import { PARASITE_CLOSED } from "./parasites";
import { MODULES, PALIER_GUARD, PALIER_LENGTH, RACCORD_TAIL, blinkRhythmProblems, buildModule, centerCol, isCleanRun, moduleSolutions, textHash, variantExigence, variantTheme, type ModuleEntry, type ModuleTag, type Palier } from "./modules";
import { SIGNATURE_MIN_PIECES, SIGNATURE_MIN_TICKS, SIGNATURE_SHARE_MAX, SIGNATURE_SHARE_MIN, SIGNATURE_SHARE_TARGET, jumpThemeForDay, mechanicOf, type JumpThemeName, type Mechanic } from "./themes";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_RIGHT } from "./player";
import { decodeReplay, encodeReplay, fromRuns, replayAttempt, toRuns, type JumpReplay } from "./replay";
import { SLOW_MAX_EXTRA, SLOW_MIN_EXIGENCE, SLOW_REACH_ROWS, SLOW_ZONE_WIDTH, carveSlowRoute, slowCostMin, slowGalleryRow, slowHeadroom, slowLedges, slowScript, type SlowRoute } from "./voies";

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
//   - le premier morceau part à l'**arrêt** (départ `S` au début du premier palier, une colonne de garde devant, comme `buildModule`),
//     tous les suivants en **élan** ;
//   - hors des morceaux et des paliers, **tout est plein** ; une rangée de blocs ferme le haut (les côtés sont fermés par `tileAt`) ; sous
//     un morceau, le vide continue jusqu'en bas du niveau là où sa dernière rangée n'est pas un bloc (on y meurt en tombant, comme dans le
//     morceau seul) ;
//   - chaque morceau est **une section** (ses scies démarrent quand le centre du personnage passe le bord droit du palier qui le précède) ;
//     ses scies mobiles sont recopiées, coordonnées décalées.
//
// **La preuve** : la solution du premier morceau (à l'arrêt), jouée jusqu'à sa **sortie canonique** (le centre passe le bord droit du
// palier, au sol, en course propre : `isCleanRun`) ; puis, **au pas suivant, sans course entre les deux**, la solution en élan du morceau
// suivant, à partir de son entrée (`entryTick` : le pas où, joué seul, il franchit ce même bord) ; et ainsi de suite ; la dernière jusqu'à
// l'arrivée. Une seule possibilité par raccord (plus de repli « l'autre pas » du lot 5) : le raccord strict du lot 6 l'a rendu inutile.
// Cette rediffusion complète est ensuite **rejouée** par `replayAttempt` sur le niveau assemblé : rien n'est supposé.
//
// **Tirages** : `DAILY_DRAWS` tirages par jour (graine `mixSeed(jour, sel)` puis `mixSeed(graine, tirage)`) ; chacun compose une suite de
// morceaux sous les règles ci-dessous, l'assemble et la rejoue ; on garde le meilleur tirage valide (durée et exigence les plus proches du
// centre de la cible). Sans tirage valide, on continue jusqu'à `DAILY_MAX_ATTEMPTS` ; s'il n'y en a toujours pas, niveau de **secours**
// (`FALLBACK_PIECES`, assemblé et validé de la même façon).
//
// **Horloge unique (lot 15, générateur g10, niveaux en version 4)** : l'assemblage et la preuve se font comme ci-dessus, sur le niveau en
// version 3 (chaque section démarre quand la preuve y entre) ; puis chaque section reçoit la **phase** qui fait tourner ses éléments, sur
// l'horloge unique, exactement comme la preuve les rencontrait (`phase ≡ −entrée`, modulo la période de la section) et le niveau passe en
// version 4 (`withSingleClock`) ; la preuve y est **rejouée** : mêmes commandes, même temps, sans mort (la référence passe sans attendre). Ne
// sont posées que les variantes qui passent la **validation toutes phases** (`PHASE_REFUSED`, `npm run phases:modules`) : repartir de leur
// point de passage, à n'importe quelle phase de leur horloge, a une solution jouable par un humain ; et chaque point de reprise est **sûr à
// toute phase** (`respawnProblems`). `dailyLevel(jour, thème, 3)` rend encore le niveau g9 d'une date (référence v3, golden).
//
// **Toute modification qui change le niveau d'une date** (règles, seuils, catalogue, solutions, assemblage) : `JUMP_GENERATOR_VERSION` +1,
// golden régénérés (`UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts`), puis `npm run measure:jump -w @cdj/jump-sim`.

/** Le niveau n° 1 : le 16/10/2026 (numéro de jour, comme `parseDay`). */
export const PREMIER_JOUR_JUMP = daysFromCivil(2026, 10, 16);

/** Numéro du niveau du jour (1 le 16/10/2026 ; 0 ou moins avant). */
export function levelNumber(day: number): number {
  return day - PREMIER_JOUR_JUMP + 1;
}

/**
 * Identifiant du niveau d'une date : `jour-AAAA-MM-JJ-g<JUMP_GENERATOR_VERSION>` (identifiant des rediffusions et de la mémoire). Un thème
 * **forcé** (lot 11 : un autre que celui de la date) y ajoute `-t<thème>` : c'est un essai (`forcedTheme`), jamais enregistré.
 */
export function dailyLevelId(day: number, forced: JumpThemeName | null = null, simVersion = PLATFORM_VERSION): string {
  const natural = jumpThemeForDay(day);
  const g = simVersion >= PLATFORM_VERSION ? JUMP_GENERATOR_VERSION : simVersion >= SINGLE_CLOCK_VERSION ? SINGLE_CLOCK_GENERATOR : SECTION_CLOCK_GENERATOR;
  return `jour-${formatDay(day)}-g${g}${forced !== null && forced !== natural ? `-t${forced}` : ""}`;
}

/** Lot 15 : le dernier générateur des niveaux en version 3 (g9, lot 13) : `dailyLevel(jour, thème, 3)` le rend encore, à l'identique. */
export const SECTION_CLOCK_GENERATOR = 9;
/**
 * Lot 20 : le dernier générateur des niveaux en version 4 (g14, lot 19) : `dailyLevel(jour, thème, 4)` le rend encore, à l'identique (référence v4 : le catalogue
 * sans les morceaux à plateformes, la même règle de variété). Les niveaux du jour depuis le générateur g15 (`PLATFORM_GENERATOR`) sont en version 5.
 */
export const SINGLE_CLOCK_GENERATOR = 14;
export const PLATFORM_GENERATOR = 15;

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
export const MAX_PIECES = 13;
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
/**
 * Lot 16 : la cible de la moyenne (1,2 s), mesurée et vérifiée par les tests ; en v4, le score d'un tirage compte ce qui la dépasse (pour mille
 * de la cible) : la zone de bifurcation d'une portion dure ajoute 6 colonnes de course (moyenne 1,23 s sur 60 dates sans ce terme, mesuré).
 */
export const LONGEST_RUN_TARGET = idiv(6 * TICK_RATE, 5);
/** Hauteur totale du niveau, rangée de blocs du haut comprise (48 au lot 5 : un morceau de plus, c'est plus de dénivelé). */
export const MAX_DAILY_HEIGHT = 56;

// ——— Budget d'exigence (la même exigence chaque jour : pas de difficulté selon le jour de la semaine) ———

/**
 * Exigence du niveau = somme des exigences de ses morceaux (1 à 5, lot 4) **ramenée à sa durée**, en **dixièmes de point par minute** de
 * temps de l'auteur (`exigenceRate`). Elle doit tomber dans [`EXIGENCE_RATE_MIN`, `EXIGENCE_RATE_MAX`] ; le score des tirages vise
 * `EXIGENCE_RATE_CENTER`. Seuils réglés sur `npm run measure:jump` (README des lots 5 à 7 : 380–460 au lot 5, 430–520 au lot 6 ; lot 7 :
 * nouveau catalogue, la fenêtre est recentrée sur la médiane des tirages, même largeur relative, ±10 % ; lot 8c : notes lues sur la gigue
 * ±3, un peu plus hautes en moyenne, 445–540 → 445–570, centre 492 → 505 : 63,9 % de tirages validés au lieu de 57,1 %, mesuré ; retouche « jouable au clavier » du lot 11 : appuis humains, notes plus basses en queue, 445 → 425 : tirages validés 54,7 % → voir `docs/jump/lots/lot-11-themes-jouables.md`).
 */
export const EXIGENCE_RATE_MIN = 425;
export const EXIGENCE_RATE_MAX = 570;
export const EXIGENCE_RATE_CENTER = 505;
/** Au moins un morceau de cette exigence ou plus. */
export const EXIGENCE_PEAK = 4;
/**
 * Profil visé pendant le tirage, en dixièmes de point : un morceau placé à la fraction p du temps cible vise l'exigence
 * `PROFILE_START + (PROFILE_END − PROFILE_START) × p` (la variante la plus proche est choisie). Règle vérifiée après rejeu : le dernier
 * tiers (en temps) est au moins aussi exigeant, en moyenne pondérée par la durée, que le premier. 1,3 → 3,3 aux lots 5 et 6 ; 1,0 → 3,0 au
 * lot 7 (avec la correction ci-dessous, le niveau moyen remonte de lui-même) ; 1,0 → 3,6 au lot 7b (tension jusqu'à la fin).
 */
export const PROFILE_START = 10;
export const PROFILE_END = 36;
/**
 * Correction du profil (lot 7, pour cent) : la variante visée suit le profil plus cette part de l'écart entre l'exigence accumulée et celle
 * que donnerait `EXIGENCE_RATE_CENTER` pour le temps estimé. Sans elle, la somme de 10 morceaux d'exigence 1 à 5 s'étalait trop : 44 % des
 * tirages rejoués tombaient hors de la fenêtre (mesuré). Elle ne s'applique qu'à partir de `STEER_FROM` (pour mille du temps visé) : le
 * début garde son profil doux, la fin rattrape (sinon la règle « dernier tiers ≥ premier tiers » échouait plus souvent).
 */
export const EXIGENCE_STEER = 100;
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
/** Lot 11 : le quota de la mécanique est imposé à partir de cette fraction du temps cible (pour mille), et ses morceaux sont favorisés (poids). */
export const FORCE_MECH_AT = 450;
export const MECH_WEIGHT = 3;
/** Poids d'une respiration qui peut tomber au milieu (lot 7). */
export const REST_WEIGHT = 4;
/** Tirages par jour (on garde le meilleur valide) et tentatives au plus (au-delà : le secours). */
export const DAILY_DRAWS = 6;
export const DAILY_MAX_ATTEMPTS = 40;
/**
 * Lot 19 (v4) : tentatives au plus avant le secours. La règle de variété écarte une dizaine à une vingtaine de morceaux de base par jour :
 * plus d'impasses (une composition qui n'aboutit pas ne coûte presque rien : aucun rejeu). Réglé par la mesure : secours 0 sur 365 dates.
 */
export const DAILY_MAX_ATTEMPTS_V4 = 120;
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
 * (Lot 5 : `repos4310:`.)
 */
export const REST_SALT = "repos19541:";
export function restGroup(id: string): number {
  const fixed = THEMED_REST_GROUPS[id];
  if (fixed !== undefined) return fixed;
  return Number.parseInt(textHash(`${REST_SALT}${id}`), 16) % REST_GROUPS;
}
/**
 * Lot 11 : le groupe de repos des morceaux d'une mécanique (`theme:`), rangés **à la main** (`npm run repos:modules -w @cdj/jump-sim --
 * --themes`) : le sel ne change pas (les niveaux des thèmes sans mécanique restent ceux d'avant), les groupes gardent la même taille à un
 * près et chaque jour ouvre au moins quatre morceaux ou variantes de chaque mécanique. Lot 12 : nuit et néon (`repos:modules -- --themes` ne
 * place que les morceaux absents de la table : usine et glace gardent leurs groupes). Lot 13 : forêt (vent), de même.
 */
export const THEMED_REST_GROUPS: Readonly<Record<string, number>> = {
  "glace-cheminee": 2,
  "glace-corniches": 4,
  "glace-freinage": 6,
  "glace-mur": 5,
  "glace-promenade": 4,
  "glace-relais": 2,
  "glace-saut-haut": 1,
  "neon-cheminee": 2,
  "neon-couloir": 3,
  "neon-pics": 4,
  "neon-relais": 6,
  "neon-respiration": 5,
  "neon-silence": 0,
  "nuit-cheminee": 2,
  "nuit-escalier": 5,
  "nuit-marelle": 6,
  "nuit-opposition": 1,
  "nuit-pont": 4,
  "nuit-portes": 1,
  "nuit-relais": 3,
  "tapis-alternes": 2,
  "tapis-contraire": 6,
  "tapis-escalier": 2,
  "tapis-lance": 2,
  "tapis-mur": 0,
  "tapis-relais": 5,
  "tapis-respiration": 3,
  "vent-brise": 0,
  "vent-colonne": 1,
  "vent-derive": 6,
  "vent-piliers": 5,
  "vent-planeur": 3,
  "vent-pont": 0,
  "vent-puits": 4,
  "vent-rafale": 1,
  "vent-relais": 2,
};
/** Le groupe `g` est-il ouvert le jour `day` ? (Entre `REST_OPEN × day` et `REST_OPEN × day + REST_OPEN − 1`, modulo `REST_GROUPS`.) */
export function isOpenGroup(g: number, day: number): boolean {
  const from = (((REST_OPEN * day) % REST_GROUPS) + REST_GROUPS) % REST_GROUPS;
  return (((g - from) % REST_GROUPS) + REST_GROUPS) % REST_GROUPS < REST_OPEN;
}
export function isRestedModule(id: string, day: number): boolean {
  return !isOpenGroup(restGroup(id), day);
}

// ——— Variété (lot 19, générateur g14, niveaux v4) ———

/**
 * **Un morceau de base ne revient pas avant `VARIETY_DAYS` jours** (toutes variantes confondues) : deux niveaux du jour à moins de 3 jours
 * l'un de l'autre n'ont aucun morceau en commun. Remplace le repos par groupes pour les niveaux v4 (la référence v3 le garde, au bit près).
 * **Choisi par la mesure** (README du lot 19) : sous la règle bornée ci-dessous, W = 3 garde 0 secours sur 365 dates ; W = 4 en donne 6 à 12
 * sur 120 dates (même avec 150 tirages par jour), W = 5 davantage : le catalogue est trop mince.
 */
export const VARIETY_DAYS = 3;
/**
 * **Règle bornée : des époques de `VARIETY_EPOCH` jours**, alignées sur `VARIETY_ORIGIN`. Dans une époque, chaque jour écarte les morceaux
 * des jours qui le précèdent dans l'époque (à moins de `VARIETY_DAYS`) ; les `VARIETY_DAYS − 1` derniers jours d'une époque écartent **aussi**
 * ceux des premiers jours de l'époque suivante (qui, eux, ne regardent jamais en arrière au-delà de leur époque). Aucune chaîne : un niveau
 * dépend au plus des jours de son époque et des premiers jours de la suivante (`VARIETY_EPOCH + VARIETY_DAYS − 1` niveaux en tout, mis en
 * cache). Mesuré : 6 jours, 0 secours (4 jours : 3 secours sur 120 dates, le dernier jour d'une époque écarte 4 jours de morceaux).
 */
export const VARIETY_EPOCH = 6;
/** Le premier jour g14 (J + 2 de la PR du lot 19) : début de la première époque. */
export const VARIETY_ORIGIN = daysFromCivil(2026, 10, 27);
/**
 * **Les jours déjà figés comptent avec leur contenu réel** : les morceaux de base des jours qui précèdent `VARIETY_ORIGIN` (figés par la mise
 * en production du 25/10/2026, générateur g10 : `apps/jump/public/levels/`). Les premiers jours de la première époque les écartent comme s'ils étaient de
 * leur époque. **Lot 20 : cette table n'est plus tenue à la main** : `src/figes.ts` est déduit des fichiers figés par `npm run figes:jump -w @cdj/jump-sim`
 * (un test vérifie qu'il est à jour et qu'il couvre la jonction).
 */
export const VARIETY_FROZEN: Readonly<Record<string, readonly string[]>> = FROZEN_BASE_IDS;

/** Position d'un jour dans son époque (0 à `VARIETY_EPOCH − 1`). */
export function varietyPosition(day: number): number {
  return (((day - VARIETY_ORIGIN) % VARIETY_EPOCH) + VARIETY_EPOCH) % VARIETY_EPOCH;
}

/**
 * Les jours dont le niveau v4 du jour `day` écarte les morceaux de base (règle bornée, voir `VARIETY_EPOCH`) : ceux qui le précèdent dans son
 * époque à moins de `VARIETY_DAYS` jours (avant `VARIETY_ORIGIN` : les jours figés de `VARIETY_FROZEN`), et, pour les derniers jours d'une
 * époque, les premiers jours de la suivante à moins de `VARIETY_DAYS` jours. Toute paire de jours à moins de `VARIETY_DAYS` jours y est
 * couverte exactement une fois (par le plus tardif dans une époque, par celui de la première époque à travers une coupure).
 */
export function varietyNeighbours(day: number): number[] {
  const pos = varietyPosition(day);
  const out: number[] = [];
  for (let k = 1; k < VARIETY_DAYS; k++) {
    if (k <= pos || (day - k < VARIETY_ORIGIN && day >= VARIETY_ORIGIN)) out.push(day - k);
  }
  for (let k = 1; k < VARIETY_DAYS; k++) {
    const q = pos + k;
    if (q >= VARIETY_EPOCH && q - VARIETY_EPOCH < VARIETY_DAYS - 1) out.push(day + k);
  }
  return out;
}

/** Les morceaux de base du niveau du jour `day` (son thème, v4) : le contenu figé avant `VARIETY_ORIGIN`, sinon celui que donne `dailyLevel`. */
export function dailyBaseIds(day: number, simVersion = PLATFORM_VERSION): readonly string[] {
  const frozen = day < VARIETY_ORIGIN ? VARIETY_FROZEN[formatDay(day)] : undefined;
  return frozen ?? dailyLevel(day, null, simVersion).pieces.map((p) => p.id);
}

/** Les morceaux de base que le niveau v4 du jour `day` ne peut pas poser (lot 19). */
export function varietyExcluded(day: number, simVersion = PLATFORM_VERSION): Set<string> {
  const out = new Set<string>();
  for (const d of varietyNeighbours(day)) for (const id of dailyBaseIds(d, simVersion)) out.add(id);
  return out;
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
  /** Lot 11 : le thème auquel la variante est réservée (null : tous), et la mécanique qu'elle porte (celle de ce thème). */
  theme: JumpThemeName | null;
  mechanic: Mechanic | null;
  /** Famille (une seule de chaque par niveau) et enchaînement long (lot 7). */
  family: string;
  long: boolean;
  exigence: number;
  /** Durées des solutions entre leur entrée et leur sortie canoniques (pas). */
  arret: number;
  elan: number;
  height: number;
  width: number;
  entryRow: number;
  exitRow: number;
  /** Lot 16 (niveaux v4, g11) : portion dure (note ≥ `SLOW_MIN_EXIGENCE`) : elle reçoit une voie lente et sa zone de bifurcation. */
  hard: boolean;
}

/**
 * Lot 17 (g12) : les variantes ajoutées pour **remplacer** une variante refusée par la validation toutes phases (`PHASE_REFUSED`) : la refusée
 * garde son texte, ses solutions et sa place (la référence v3, g9, la connaît telle quelle : golden v3 au bit près) et la nouvelle, au bout de la
 * liste, n'existe que pour les niveaux à une seule horloge.
 */
export const V4_ONLY_VARIANTS: Readonly<Record<string, readonly number[]>> = Object.freeze({
  "scie-sol": [6],
  "cheminee-scie": [4],
  // Lot 18 (g13) : les remplaçantes des variantes de nuit refusées par la règle des 1,5 s par phase (`BLINK_PHASE_MIN`), chacune plus lente que la sienne.
  "nuit-opposition": [5, 6, 7, 8, 9],
  "nuit-cheminee": [4, 5, 6, 7],
  "nuit-escalier": [4, 5, 6, 7],
  "nuit-marelle": [4, 5, 6, 7],
  "nuit-pont": [5, 6, 7, 8, 9],
  "nuit-portes": [4, 5, 6, 7],
  "nuit-relais": [3, 4, 5],
  marelle: [6],
  piliers: [6],
  // Lot 19 (g14) : les variantes des mutateurs de silhouette (`hausse`, `ecart`, `decale`, `echange`) et de la mécanique du thème posée sur des
  // morceaux génériques ; ajoutées au bout de leurs morceaux, inconnues de la référence v3.
  ascenseur: [6, 7],
  "cheminee-vide": [4, 5],
  "chute-pics": [5, 6, 7],
  corniches: [5, 6],
  "demi-tour": [6],
  "descente-scies": [6, 7, 8],
  "escalier-friable": [3],
  "iles-scie": [6],
  lucarne: [4],
  "mur-friable": [4],
  "mur-seul": [6, 7, 8],
  pendule: [6, 7, 8],
  "petits-trous": [6, 7, 8],
  plongeon: [6],
  puits: [4, 5],
  quinconce: [6],
  "rebonds-doux": [5, 6],
  "saut-long": [6, 7],
  "scie-ronde": [6],
  tunnel: [5, 6],
});

let tooFast: Record<string, number[]> | null = null;

/**
 * Lot 18 (g13) : les variantes dont un cycle de clignotement a une phase, présente ou absente, de moins de 1,5 s (`BLINK_PHASE_MIN`) — le joueur
 * n'a pas le temps de lire l'annonce ni de réagir. Calculée sur les textes des morceaux (aucun fichier à tenir à jour). Le générateur à une seule
 * horloge ne les pose jamais ; la référence v3 (g9) les connaît telles quelles (golden v3 inchangés), comme elle connaît `PHASE_REFUSED`.
 */
export function blinkTooFast(): Readonly<Record<string, readonly number[]>> {
  if (tooFast) return tooFast;
  const out: Record<string, number[]> = {};
  for (const def of MODULES) {
    for (let v = 0; v < def.variants.length; v++) {
      const blinks = def.tags.includes("clignotant") || (def.mutations[v] ?? []).some((m) => m.name === "clignotant");
      if (blinks && blinkRhythmProblems(buildModule(def.id, v).level).length > 0) (out[def.id] ??= []).push(v);
    }
  }
  tooFast = out;
  return out;
}

let catalogAll: Choice[][] | null = null;
let catalog: Choice[][] | null = null;
let catalogV4: Choice[][] | null = null;
let catalogV5: Choice[][] | null = null;

/**
 * Lot 20 : les morceaux de base à plateformes mobiles (une ligne `plateforme` dans leur bloc annexe) : réservés aux niveaux en version 5. Les catalogues des
 * versions 3 et 4 ne les connaissent pas (golden v3 et v4 au bit près), comme ils ne connaissent pas les variantes de `V4_ONLY_VARIANTS`.
 */
export function platformModuleIds(): ReadonlySet<string> {
  return new Set(MODULES.filter((def) => def.annex.some((l) => l.startsWith("plateforme "))).map((def) => def.id));
}

/**
 * Par morceau (ordre du catalogue), ses variantes utilisables. Calculé une fois (déterministe). Lot 15 : en version 4, sans les variantes
 * refusées par la validation toutes phases (`PHASE_REFUSED`) ; lot 18 : ni celles dont une phase de clignotement dure moins de 1,5 s (`blinkTooFast`).
 */
function choices(simVersion = SECTION_CLOCK_VERSION): Choice[][] {
  if (simVersion >= SINGLE_CLOCK_VERSION) {
    const usable = (list: Choice[]) => list.filter((c) => !PHASE_REFUSED[c.id]?.includes(c.variant) && !PARASITE_CLOSED[c.id]?.includes(c.variant) && !blinkTooFast()[c.id]?.includes(c.variant)).map((c) => ({ ...c, hard: c.exigence >= SLOW_MIN_EXIGENCE }));
    if (simVersion >= PLATFORM_VERSION) {
      catalogV5 ??= allChoices().map(usable).filter((list) => list.length > 0);
      return catalogV5;
    }
    // Lot 20 : la référence v4 (g14) ne connaît pas les morceaux à plateformes.
    catalogV4 ??= allChoices()
      .filter((list) => !platformModuleIds().has(list[0]!.id))
      .map(usable)
      .filter((list) => list.length > 0);
    return catalogV4;
  }
  // Lots 17 et 18 : la référence v3 ne connaît pas les variantes ajoutées aux g12 et g13 (lot 20 : ni les morceaux à plateformes).
  catalog ??= allChoices()
    .filter((list) => !platformModuleIds().has(list[0]!.id))
    .map((list) => list.filter((c) => !V4_ONLY_VARIANTS[c.id]?.includes(c.variant)))
    .filter((list) => list.length > 0);
  return catalog;
}

/** Toutes les variantes utilisables (solutions jouables aux deux entrées), sans filtre de version. */
function allChoices(): Choice[][] {
  if (catalogAll) return catalogAll;
  catalogAll = MODULES.map((def) =>
    def.variants.flatMap((_, variant) => {
      const s = moduleSolutions(def.id, variant);
      const exigence = variantExigence(s);
      if (!s?.arret || !s.elan || exigence < 1) return [];
      const b = buildModule(def.id, variant);
      const span = (x: { entryTick: number; exitTick: number }) => x.exitTick - x.entryTick;
      const theme = variantTheme(def, variant);
      return [{ id: def.id, variant, tags: def.tags, theme, mechanic: theme === null ? null : mechanicOf(theme), family: def.family, long: def.long, exigence, arret: span(s.arret), elan: span(s.elan), height: b.height, width: b.width, entryRow: b.entryRow, exitRow: b.exitRow, hard: false }];
    }),
  ).filter((list) => list.length > 0);
  return catalogAll;
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
  /** Lot 11 : la mécanique de la variante (tapis, glace), null si elle n'en a pas. */
  mechanic: Mechanic | null;
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
  /**
   * `impasse` : la composition n'a pas abouti ; `refusé` : composé mais le rejeu échoue ou une règle n'est pas tenue ; `valide` ; lot 19 (v4) :
   * `écarté` : composé, pas prouvé (un tirage de son lot, mieux estimé, est valide ; `score` est alors le score estimé).
   */
  status: "impasse" | "refusé" | "valide" | "écarté";
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
  /** `jour-AAAA-MM-JJ-g<N>` (suffixe `-t<thème>` pour un thème forcé). */
  id: string;
  /** Lot 11 : le thème du niveau (celui de la date, ou le thème forcé) et si c'est un essai (thème forcé différent de celui de la date). */
  theme: JumpThemeName;
  forcedTheme: boolean;
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
  /**
   * Lot 16 : les voies lentes des portions dures (une par morceau noté 4 ou 5, sauf le premier), avec leurs temps, et le temps de référence
   * « toutes voies lentes » (temps de l'auteur + la somme des surcoûts). Vides (et `slowTicks` = `authorTicks`) pour un niveau v3.
   */
  slowRoutes: readonly SlowRoute[];
  slowTicks: number;
}

/** Une pièce avant assemblage. */
interface Slot {
  choice: Choice;
  entry: ModuleEntry;
}

/** Lot 16 : la course sous la cage d'une zone de bifurcation (7 colonnes à pleine vitesse), comptée dans l'estimation d'une portion dure. */
export const SLOW_ZONE_TICKS = idiv(SLOW_ZONE_WIDTH * UNITS_PER_TILE, DEFAULT_JUMP_PARAMS.runSpeed);
const ticksOf = (p: Slot) => (p.entry === "arret" ? p.choice.arret : p.choice.elan) + (p.choice.hard ? SLOW_ZONE_TICKS : 0);

/**
 * Rangées de chaque morceau (haut de sa grille), et hauteur totale (rangée du haut comprise), d'une suite de morceaux. Lot 16 : une portion
 * dure réserve au-dessus d'elle la hauteur de sa voie lente (`slowHeadroom`, avec `extras[k]` montées de plus).
 */
function stack(picks: readonly Slot[], extras: readonly number[] = []): { tops: number[]; height: number } {
  const offs: number[] = [];
  let o = 0;
  picks.forEach((p, k) => {
    if (k > 0) o = offs[k - 1]! + picks[k - 1]!.choice.exitRow - p.choice.entryRow;
    offs.push(o);
  });
  let lo = 0;
  let hi = 0;
  picks.forEach((p, k) => {
    const head = p.choice.hard ? slowHeadroom(p.choice.entryRow, extras[k] ?? 0) : 0;
    if (k === 0 || offs[k]! - head < lo) lo = offs[k]! - head;
    if (k === 0 || offs[k]! + p.choice.height > hi) hi = offs[k]! + p.choice.height;
  });
  return { tops: offs.map((v) => v - lo + 1), height: hi - lo + 1 };
}

// ——— Composition d'un tirage ———

/** Pour mille. */
const per = (part: number, whole: number) => idiv(part * 1000, whole);

/** Compose une suite de morceaux (sans l'assembler). Rend la raison de l'échec si elle n'aboutit pas. */
function compose(day: number, rng: Rng, theme: JumpThemeName, simVersion: number, excluded: ReadonlySet<string> | null): Slot[] | string {
  // Lot 11 : les variantes réservées à un autre thème sortent du catalogue ; pour un thème sans mécanique, ce qui reste est exactement le
  // catalogue d'avant (même ordre, mêmes variantes), donc la même composition.
  const mechanic = mechanicOf(theme);
  const pool = choices(simVersion)
    .map((list) => list.filter((c) => c.theme === null || c.theme === theme))
    // Lot 19 (v4) : les morceaux de base des jours voisins sont écartés (`varietyExcluded`) ; la référence v3 garde le repos par groupes.
    .filter((list) => list.length > 0 && (excluded ? !excluded.has(list[0]!.id) : !isRestedModule(list[0]!.id, day)));
  const picks: Slot[] = [];
  const used = new Set<string>();
  const families = new Set<string>();
  let est = 0;
  for (;;) {
    if (picks.length >= MAX_PIECES) return "trop de morceaux";
    const first = picks.length === 0;
    const entry: ModuleEntry = first ? "arret" : "elan";
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
    const forcePeak = needPeak && p >= FORCE_PEAK_AT;
    // Lot 11 : le quota de signature (au moins `SIGNATURE_MIN_PIECES` morceaux de la mécanique, `SIGNATURE_SHARE_MIN`–`MAX` ‰ du temps).
    const mechPicks = picks.filter((q) => q.choice.mechanic !== null);
    const mechTicks = mechPicks.reduce((n, q) => n + ticksOf(q), 0);
    const forceMech = mechanic !== null && mechPicks.length < SIGNATURE_MIN_PIECES && p >= FORCE_MECH_AT;
    const mechOk = (picked: readonly Slot[], total: number) => {
      const mine = picked.filter((q) => q.choice.mechanic !== null);
      const t = mine.reduce((n, q) => n + ticksOf(q), 0);
      return mine.length >= SIGNATURE_MIN_PIECES && t * 1000 >= SIGNATURE_SHARE_MIN * total && t * 1000 <= SIGNATURE_SHARE_MAX * total;
    };

    interface Cand {
      pick: Slot;
      weight: number;
    }
    const cands: Cand[] = [];
    for (const list0 of pool) {
      // Lot 16 : le premier morceau part à l'arrêt du départ, sans zone de bifurcation : jamais une portion dure.
      const list = first ? list0.filter((c) => !c.hard) : list0;
      if (list.length === 0) continue;
      const id = list[0]!.id;
      if (used.has(id) || families.has(list[0]!.family)) continue;
      const tags = list[0]!.tags;
      const long = list[0]!.long;
      if (long ? longs >= MAX_LONG : forceLong && !forceRest) continue;
      if (precisionRun && tags.includes("precision")) continue;
      if (tags.includes("respiration") && !needRest) continue;
      if (forceRest && !tags.includes("respiration")) continue;
      if ((forceMural || forceScie || forceMech) && !((forceMural && tags.includes("mural")) || (forceScie && tags.includes("scie")) || (forceMech && list.some((c) => c.mechanic !== null)))) continue;
      // Variantes qui tiennent : hauteur, durée, respiration au milieu, pointe d'exigence imposée.
      const ok = list.filter((c) => {
        const pick = { choice: c, entry };
        const ticks = ticksOf(pick) + (first ? 0 : JOINT_TICKS);
        if (has(c, "respiration") && !restWindow(c, ticks)) return false;
        if (forcePeak && c.exigence < EXIGENCE_PEAK) return false;
        if (forceMech && c.mechanic === null && !((forceMural && tags.includes("mural")) || (forceScie && tags.includes("scie")))) return false;
        const end = est + ticks;
        // Lot 11 : la mécanique ne dépasse pas sa part (ni ne s'installe seule : 40 % du temps au plus).
        if (c.mechanic !== null && (mechTicks + ticks) * 1000 > SIGNATURE_SHARE_MAX * ESTIMATE_MAX_TICKS) return false;
        if (end > ESTIMATE_MAX_TICKS) return false;
        if (end >= ESTIMATE_MIN_TICKS) {
          // Ce morceau finirait le niveau : tous les quotas doivent être tenus avec lui.
          const all = [...picks.map((q) => q.choice), c];
          if (!all.some((q) => has(q, "mural")) || !all.some((q) => has(q, "scie")) || !all.some((q) => has(q, "respiration"))) return false;
          if (!all.some((q) => q.exigence >= EXIGENCE_PEAK) || all.length < MIN_PIECES) return false;
          if (all.filter((q) => q.long).length < MIN_LONG) return false;
          if (mechanic !== null && !mechOk([...picks, pick], end)) return false;
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
      // Lot 7 : une respiration qui peut tomber au milieu est préférée tout de suite (`REST_WEIGHT`) ; attendue jusqu'au dernier moment, elle
      // manquait souvent (deux à quatre disponibles par jour, parfois prises par leur famille) : 20 % des tirages finissaient en impasse.
      if (has(choice, "respiration")) weight *= REST_WEIGHT;
      // Lot 11 : tant que la mécanique est sous sa part visée, ses morceaux sont préférés.
      if (choice.mechanic !== null && mechTicks * 1000 < SIGNATURE_SHARE_TARGET * (est + ticksOf({ choice, entry }))) weight *= MECH_WEIGHT;
      cands.push({ pick: { choice, entry }, weight });
    }
    if (cands.length === 0) {
      const forced = [forceRest && "respiration", forceLong && !forceRest && "long", forceMural && "mural", forceScie && "scie", forcePeak && "pointe"].filter(Boolean);
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

export interface Assembled {
  level: Level;
  ascii: string;
  pieces: DailyPiece[];
  paliers: Palier[];
  /** Lot 16 : les voies lentes posées (sans leurs temps : `prove` les mesure), et les cases creusées pour chacune. */
  slow: { piece: number; zone: number; entryRow: number; galleryRow: number; extra: number; carved: { col: number; row: number }[]; walls: { col: number; row: number }[] }[];
}

/** Options d'assemblage (lot 16) : poser les voies lentes des portions dures (niveaux v4), avec `extras[k]` montées de plus pour le morceau k. */
export interface AssembleOptions {
  slow?: boolean;
  extras?: readonly number[];
}

/** Assemble une suite de morceaux en un niveau (grille + bloc annexe). */
export function assemble(picks: readonly { id: string; variant: number }[], options: AssembleOptions = {}): Assembled {
  const all = allChoices().flat();
  const full: Slot[] = picks.map((p, k) => {
    const choice = all.find((c) => c.id === p.id && c.variant === p.variant);
    if (!choice) throw new RangeError(`Morceau « ${p.id} », variante ${p.variant} : pas de solution utilisable`);
    return { choice: { ...choice, hard: options.slow === true && k > 0 && choice.exigence >= SLOW_MIN_EXIGENCE }, entry: k === 0 ? "arret" : "elan" };
  });
  if (full.length === 0) throw new RangeError("Assemblage vide");
  const extras = options.extras ?? [];
  const L = PALIER_LENGTH;
  const Z = SLOW_ZONE_WIDTH;
  const { tops, height } = stack(full, extras);
  const G = PALIER_GUARD;
  const width = G + full.reduce((s, p) => s + p.choice.width + (p.choice.hard ? Z : 0), 0) + (full.length + 1) * L + 1;
  const rows: string[][] = [];
  for (let r = 0; r < height; r++) rows.push(new Array<string>(width).fill("#"));
  const annex: string[] = [];
  const pieces: DailyPiece[] = [];
  const paliers: Palier[] = [];
  const zones: number[] = [];
  let col = G + L;
  full.forEach((p, k) => {
    // Lot 16 : une portion dure a sa zone de bifurcation entre son palier d'entrée et elle.
    zones.push(p.choice.hard ? col : -1);
    if (p.choice.hard) col += Z;
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
      // Lot 12 : le cycle des blocs clignotants du morceau, rattaché à sa section (mêmes colonnes, rien à décaler).
      if (words[0] === "clignote") {
        annex.push(`clignote ${p.choice.id} ${words.slice(2).join(" ")}`);
        continue;
      }
      // Lot 13 : une zone de vent, colonnes et rangées décalées comme les scies (la section est celle de sa première colonne : le morceau).
      if (words[0] === "vent") {
        const [c0, c1] = words[1]!.split("-").map((v) => Number(v) - built.lead + col);
        const [r0, r1] = words[2]!.split("-").map((v) => Number(v) + top);
        annex.push(["vent", `${c0}-${c1}`, `${r0}-${r1}`, ...words.slice(3)].join(" "));
        continue;
      }
      // Lot 20 : une plateforme mobile, identifiant préfixé du morceau, extrémités décalées comme les points d'une scie.
      if (words[0] === "plateforme") {
        annex.push(
          words
            .map((w, i) => {
              if (i === 1) return `${p.choice.id}/${w}`;
              const m = i >= 5 ? /^(\d+),(\d+)$/.exec(w) : null;
              return m ? `${Number(m[1]) - built.lead + col},${Number(m[2]) + top}` : w;
            })
            .join(" "),
        );
        continue;
      }
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
      mechanic: p.choice.mechanic,
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
  const roofs: number[] = [];
  for (let k = 0; k <= full.length; k++) {
    const before = pieces[k - 1];
    const after = pieces[k];
    const row = after ? after.entryRow : before!.exitRow;
    const roof = Math.min(before ? before.top : height, after ? after.top : height);
    const zone = k < full.length ? zones[k]! : -1;
    const col0 = zone >= 0 ? zone - L : after ? after.col0 - L : before!.col1 + 1;
    // Le premier palier a sa colonne de garde devant lui, le dernier la colonne d'arrivée derrière lui.
    const from = k === 0 ? col0 - G : col0;
    const to = k === full.length ? col0 + L + 1 : col0 + L;
    for (let c = from; c < to; c++) for (let r = roof; r < row; r++) rows[r]![c] = ".";
    paliers.push({ col0, col1: col0 + L - 1, row });
    roofs.push(roof);
    rows[row - 1]![col0] = k === 0 ? "S" : k === full.length ? "." : "C";
    if (k === full.length) rows[row - 1]![col0 + L] = "F";
    if (zone >= 0) {
      // La zone : la piste (une rangée libre sous la cage) et le palier bis, vide jusqu'en haut du morceau.
      for (let c = zone; c < zone + Z; c++) rows[row - 1]![c] = ".";
      for (let c = zone + Z - L; c < zone + Z; c++) for (let r = after!.top; r < row; r++) rows[r]![c] = ".";
    }
  }
  // Lot 16 : les voies lentes, creusées dans le plein (la cage au-dessus de la piste, la galerie au-dessus du morceau, la descente).
  const slow: Assembled["slow"] = [];
  full.forEach((p, k) => {
    const zone = zones[k]!;
    if (zone < 0) return;
    const piece = pieces[k]!;
    const extra = extras[k] ?? 0;
    const galleryRow = piece.top + slowGalleryRow(piece.entryRow - piece.top, extra);
    const out = paliers[k + 1]!;
    const carved = carveSlowRoute(rows, zone, piece.entryRow, galleryRow, out, roofs[k + 1]!);
    // La descente ne doit pas donner sur le haut du morceau suivant (hors de portée d'un saut depuis le palier) : sinon, la colonne droite du
    // puits est murée au-dessus de cette portée (on descend par la colonne de gauche).
    const walls: { col: number; row: number }[] = [];
    const high = out.row - SLOW_REACH_ROWS;
    const shaftTop = Math.min(roofs[k + 1]!, galleryRow - 3);
    // À droite du puits : le morceau suivant, ou le mur gauche de la cage de la portion dure suivante (plein au-dessus de son entrée).
    const side = out.col1 + 1;
    if (k + 1 < full.length) {
      let open = false;
      for (let r = shaftTop; r < high; r++) if (rows[r]![side] !== "#") open = true;
      if (open) {
        for (let r = shaftTop; r < high; r++) {
          if (rows[r]![out.col1] !== "#") walls.push({ col: out.col1, row: r });
          rows[r]![out.col1] = "#";
        }
      }
    }
    const kept = carved.filter((c) => !walls.some((w) => w.col === c.col && w.row === c.row));
    slow.push({ piece: k, zone, entryRow: piece.entryRow, galleryRow, extra, carved: kept, walls });
  });
  const ascii = rows.map((r) => r.join("")).join("\n") + "\n\n" + annex.join("\n") + "\n";
  return { level: parseLevel(ascii), ascii, pieces, paliers, slow };
}

/**
 * Lot 16 : le même assemblage que celui d'un niveau du jour (mêmes morceaux, voies lentes et montées ajoutées), en version 3 comme le fait le
 * générateur avant la mise à l'heure unique : ses voies lentes et leurs cases creusées (tests, outils).
 */
export function reassemble(d: Pick<DailyLevel, "pieces" | "slowRoutes" | "level">): Assembled {
  const extras = d.pieces.map((_, k) => d.slowRoutes.find((r) => r.piece === k)?.extra ?? 0);
  return assemble(
    d.pieces.map((p) => ({ id: p.id, variant: p.variant })),
    { slow: d.level.simVersion >= SINGLE_CLOCK_VERSION, extras },
  );
}

// ——— La preuve ———

type Step = (s: AttemptState, bits: number) => AttemptState;

/**
 * Met les solutions bout à bout en jouant la simulation : la solution du morceau `k` est jouée à partir de son entrée (`entryTick` ; 0 pour le
 * premier, à l'arrêt) depuis l'état où le précédent est sorti, jusqu'à **sa** sortie canonique — le centre passe le bord droit du palier qui
 * le suit (la première colonne du morceau suivant), vivant, en course propre —, ou jusqu'à l'arrivée pour le dernier. Rend les commandes et
 * le pas où commence chaque morceau, ou la raison de l'échec.
 */
function chainSolutions(asm: Assembled): { inputs: number[]; starts: number[]; final: AttemptState } | string {
  const zoned = new Set(asm.slow.map((r) => r.piece));
  const level = asm.level;
  const step: Step = (s, bits) => stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
  const inputs: number[] = [];
  const starts: number[] = [];
  let s: AttemptState = initialAttempt(level);
  for (let k = 0; k < asm.pieces.length; k++) {
    const piece = asm.pieces[k]!;
    const sol = moduleSolutions(piece.id, piece.variant)?.[piece.entry];
    if (!sol) return `${piece.id}:${piece.variant} sans solution`;
    const commands = fromRuns(decodeReplay(sol.code).runs);
    const last = k === asm.pieces.length - 1;
    // Lot 16 : la sortie est le bord droit du palier qui suit (avant la zone de bifurcation d'une portion dure).
    const exitCol = last ? -1 : asm.paliers[k + 1]!.col1 + 1;
    starts.push(inputs.length);
    // Lot 16 : une portion dure commence par la course sous la cage, droite tenue, jusqu'au bord de son palier bis.
    if (zoned.has(k)) {
      for (let n = 0; centerCol(s.player) < piece.col0; n++) {
        if (n > 2 * SLOW_ZONE_WIDTH * 12) return `${piece.id}:${piece.variant} : la zone n'est pas traversée`;
        s = step(s, INPUT_RIGHT);
        inputs.push(INPUT_RIGHT);
        if (s.status !== ATTEMPT_RUNNING || !isCleanRun(s.player)) return `${piece.id}:${piece.variant} : course sous la cage interrompue`;
      }
    }
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
        if (!isCleanRun(s.player)) return `${piece.id}:${piece.variant} sort hors de la course propre (morceau ${k + 1})`;
        done = true;
      }
    }
    if (!done) return `${piece.id}:${piece.variant} n'aboutit pas (morceau ${k + 1})`;
  }
  return { inputs, starts, final: s };
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
export function dailyProblems(d: Pick<DailyLevel, "pieces" | "authorTicks" | "level" | "exigence" | "palierTicks" | "longestRun"> & { theme?: JumpThemeName }): string[] {
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
  if (TENSION_RISES && e.thirds[2] < e.thirds[1]) out.push(`le dernier tiers (${e.thirds[2]}) est moins exigeant que le deuxième (${e.thirds[1]})`);
  // Lot 11 : le quota de signature d'un thème à mécanique, sur le temps réel de l'auteur. Lot 13 : seuls comptent les morceaux de **la**
  // mécanique du thème ; un morceau d'une autre mécanique est hors de son thème (le générateur n'en pose jamais : rien ne change pour les autres).
  if (d.theme !== undefined && pieces.some((p) => p.mechanic !== null && p.mechanic !== mechanicOf(d.theme!))) out.push("un morceau de mécanique hors de son thème");
  if (d.theme !== undefined && mechanicOf(d.theme) !== null) {
    const mech = pieces.filter((p) => p.mechanic === mechanicOf(d.theme!));
    const t = mech.reduce((n, p) => n + (p.end - p.start), 0);
    if (mech.length < SIGNATURE_MIN_PIECES) out.push(`${mech.length} morceaux de la mécanique ${mechanicOf(d.theme)} (au moins ${SIGNATURE_MIN_PIECES})`);
    if (mech.some((p) => p.end - p.start < SIGNATURE_MIN_TICKS)) out.push("un morceau de la mécanique dure moins d'une seconde");
    if (t * 1000 < SIGNATURE_SHARE_MIN * total || t * 1000 > SIGNATURE_SHARE_MAX * total) out.push(`la mécanique prend ${per(t, total)} ‰ du temps (de ${SIGNATURE_SHARE_MIN} à ${SIGNATURE_SHARE_MAX})`);
  } else if (d.theme !== undefined && pieces.some((p) => p.mechanic !== null)) out.push("un morceau de mécanique hors de son thème");
  const idle = d.palierTicks.reduce((a, b) => a + b, 0);
  if (idle * 1000 >= EMPTY_RUN_MAX * total) out.push(`course à vide sur les paliers ${per(idle, total)} ‰ (moins de ${EMPTY_RUN_MAX} ‰)`);
  // Lot 15 : une seule horloge, rien ne s'arrête à la mort : chaque point de reprise doit être sûr à toute phase.
  if (d.level.simVersion >= SINGLE_CLOCK_VERSION) out.push(...respawnProblems(d.level));
  // Lot 20 : les règles de trajet des plateformes mobiles (dégagement, jamais poussé, dans son morceau).
  out.push(...platformProblems(d.level));
  return out;
}

/** Lot 15 : rangées libres au-dessus du sol d'un point de reprise qui doivent rester sûres (la hauteur libre minimale d'un palier). */
export const RESPAWN_ZONE_ROWS = 4;

/**
 * Lot 15 — **la zone d'un point de reprise est sûre à toute phase** (niveau en version 4 : les dangers ne s'arrêtent jamais) : pour le départ
 * `S` et chaque point de passage `C`, la boîte du palier (`PALIER_LENGTH` colonnes depuis le point, `RESPAWN_ZONE_ROWS` rangées au-dessus du
 * sol) n'est touchée par **aucune scie à aucun pas de son cycle**, ne contient ni pic, ni bloc, ni zone de vent, et le sol dessous est plein
 * et immobile (ni friable, ni clignotant, ni alterné). Rend ce qui ne va pas (vide : sûr).
 */
export function respawnProblems(level: Level): string[] {
  const out: string[] = [];
  const T = UNITS_PER_TILE;
  for (const [name, cell] of [["départ", level.start] as const, ...level.checkpoints.map((c, i) => [`point ${i + 1}`, c] as const)]) {
    const r0 = cell.row - RESPAWN_ZONE_ROWS + 1;
    const c1 = cell.col + PALIER_LENGTH - 1;
    const box: Box = { x: cell.col * T, y: r0 * T, w: PALIER_LENGTH * T, h: RESPAWN_ZONE_ROWS * T };
    for (let c = cell.col; c <= c1; c++) {
      for (let r = r0; r <= cell.row; r++) {
        if (level.tiles[r * level.width + c] !== TILE_EMPTY) out.push(`${name} : la case ${c},${r} n'est pas vide`);
      }
      const ground = level.tiles[(cell.row + 1) * level.width + c];
      if (ground !== TILE_SOLID) out.push(`${name} : le sol en ${c},${cell.row + 1} n'est pas un bloc immobile`);
    }
    if (level.winds.some((w) => w.c0 <= c1 && cell.col <= w.c1 && w.r0 <= cell.row && r0 <= w.r1)) out.push(`${name} : une zone de vent couvre le point`);
    for (const saw of level.saws) {
      const steps = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < steps; t++) {
        const at = sawCenter(saw, t);
        if (circleHitsBox(at.x, at.y, saw.radius, box)) {
          out.push(`${name} : la scie ${saw.id} y passe (pas ${t} de son cycle)`);
          break;
        }
      }
    }
    // Lot 20 : ni une plateforme mobile, à aucun pas de son cycle (elle ne porte, ne cache ni ne pousse personne à la reprise).
    for (const plat of level.platforms) {
      for (let t = 0; t < plat.cycle; t++) {
        const at = platformPos(plat, t);
        if (boxesOverlapUnits(box, { x: at.x, y: at.y, w: plat.width * UNITS_PER_TILE, h: UNITS_PER_TILE })) {
          out.push(`${name} : la plateforme ${plat.id} y passe (pas ${t} de son cycle)`);
          break;
        }
      }
    }
  }
  return out;
}

/** Deux boîtes [x, x + w) × [y, y + h) se chevauchent-elles ? */
const boxesOverlapUnits = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Lot 15 : la phase de chaque section du niveau v4, d'après le pas où la preuve (en v3) y est entrée (`entries`, −1 : jamais) : `−entrée`
 * modulo la période de la section, pour que ses éléments tournent sur l'horloge unique exactement comme la preuve les rencontrait.
 */
export function phasesFromEntries(level: Level, entries: readonly number[]): number[] {
  return level.sections.map((_, i) => {
    const period = sectionPeriod(level, i);
    const e = entries[i]!;
    return period === 0 || e < 0 ? 0 : cycleMod(-e, period);
  });
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

/**
 * Lot 19 : `palierTicksOf` et `longestRunOf` en un seul rejeu (mêmes résultats, au pas près : le générateur passe deux fois moins de temps à
 * les mesurer).
 */
export function runStatsOf(level: Level, paliers: readonly Palier[], inputs: readonly number[], states?: AttemptState[]): { palierTicks: number[]; longestRun: number } {
  const joints = paliers.slice(1, -1);
  const palierTicks = joints.map(() => 0);
  let s = initialAttempt(level);
  let run = 0;
  let longestRun = 0;
  for (const bits of inputs) {
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    states?.push(s);
    if (s.status === ATTEMPT_DEAD) break;
    const quiet = s.player.ground === 1 && (bits & INPUT_JUMP) === 0;
    if (quiet) {
      const col = centerCol(s.player);
      for (let k = 0; k < joints.length; k++) if (col >= joints[k]!.col0 && col <= joints[k]!.col1) palierTicks[k]!++;
    }
    run = quiet ? run + 1 : 0;
    if (run > longestRun) longestRun = run;
    if (s.status === ATTEMPT_FINISHED) break;
  }
  return { palierTicks, longestRun };
}

/**
 * Lot 19 (v4) : les règles d'exigence de `dailyProblems` (fenêtre de l'exigence par minute, dernier tiers au moins aussi exigeant que les deux
 * autres, respiration au milieu) **sur la composition estimée** (durées des solutions mises bout à bout, `ticksOf`) : un tirage qui ne les tient
 * pas est refusé sans rejeu. C'était le premier motif de refus après rejeu (mesuré) ; le rejeu les vérifie de nouveau sur le temps réel.
 */
function estimateProblem(picks: readonly Slot[]): string | null {
  let t = 0;
  const placed = picks.map((p) => {
    const start = t;
    t += ticksOf(p);
    return { exigence: p.choice.exigence, start, end: t, rest: has(p.choice, "respiration") };
  });
  const e = exigenceOfPieces(placed, t);
  if (e.rate < EXIGENCE_RATE_MIN || e.rate > EXIGENCE_RATE_MAX) return `exigence estimée ${e.rate} hors de [${EXIGENCE_RATE_MIN}, ${EXIGENCE_RATE_MAX}]`;
  if (e.thirds[2] < e.thirds[0] || (TENSION_RISES && e.thirds[2] < e.thirds[1])) return `tension estimée : dernier tiers ${e.thirds[2]} (${e.thirds[0]}, ${e.thirds[1]})`;
  for (const p of placed) {
    const mid = per(p.start + p.end, 2 * t);
    if (p.rest && (mid < RESPIRATION_FROM || mid > RESPIRATION_TO)) return `respiration estimée à ${mid} ‰`;
  }
  return null;
}

/**
 * Lot 19 : le score **estimé** d'une composition (sans rejeu) : celui de `scoreOf` sur la somme des durées de ses solutions (`ticksOf`) et
 * l'exigence ramenée à cette durée.
 */
function estimateScore(picks: readonly Slot[]): number {
  const ticks = picks.reduce((n, p) => n + ticksOf(p), 0);
  const sum = picks.reduce((n, p) => n + p.choice.exigence, 0);
  return scoreOf(ticks, ticks > 0 ? idiv(sum * 10 * 60 * TICK_RATE, ticks) : 0);
}

/** Score d'un tirage valide : écart au centre de la durée et de l'exigence, en pour mille de chacun (plus petit = meilleur). */
function scoreOf(ticks: number, rate: number): number {
  return per(Math.abs(ticks - AUTHOR_TARGET_TICKS), AUTHOR_TARGET_TICKS) + per(Math.abs(rate - EXIGENCE_RATE_CENTER), EXIGENCE_RATE_CENTER);
}

type Built = Omit<DailyLevel, "attempts" | "chosen" | "fallback" | "day" | "date" | "number" | "theme" | "forcedTheme">;

/**
 * Assemble, enchaîne les solutions, **rejoue** et vérifie les règles. Lot 15 : en version 4, le niveau passe à l'horloge unique (phases tirées
 * des entrées de la preuve dans chaque section) et la même preuve y est rejouée : même temps, sans mort. Lot 16 : en version 4, chaque
 * portion dure reçoit sa voie lente ; si l'une ne coûte pas assez, sa cage monte de `SLOW_STEP_ROWS` rangées et tout est refait.
 */
function prove(picks: readonly { id: string; variant: number }[], id: string, theme: JumpThemeName, simVersion: number): { built: Built; problems: string[] } | string {
  const extras = picks.map(() => 0);
  for (;;) {
    const r = proveOnce(picks, id, theme, simVersion, extras);
    if (typeof r === "string" || r.cheap.length === 0) return typeof r === "string" ? r : { built: r.built, problems: r.problems };
    for (const k of r.cheap) {
      if (extras[k]! >= SLOW_MAX_EXTRA) return `voie lente du morceau ${k + 1} : coût minimal impossible à tenir`;
      extras[k]!++;
    }
  }
}

function proveOnce(picks: readonly { id: string; variant: number }[], id: string, theme: JumpThemeName, simVersion: number, extras: readonly number[]): { built: Built; problems: string[]; cheap: number[] } | string {
  let asm: Assembled;
  try {
    asm = assemble(picks, { slow: simVersion >= SINGLE_CLOCK_VERSION, extras });
  } catch (e) {
    return `assemblage : ${(e as Error).message}`;
  }
  const single = simVersion >= SINGLE_CLOCK_VERSION;
  // Lot 19 (v4) : un niveau trop haut est refusé avant tout rejeu (la règle de `dailyProblems`, vérifiée plus tôt).
  if (single && asm.level.height > MAX_DAILY_HEIGHT) return `hauteur ${asm.level.height} (au plus ${MAX_DAILY_HEIGHT})`;
  const chain = chainSolutions(asm);
  if (typeof chain === "string") return chain;
  const start = { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 };
  let replay: JumpReplay = { simVersion: SECTION_CLOCK_VERSION, levelId: id, start, runs: toRuns(chain.inputs) };
  // La preuve : le rejeu, rien d'autre. Lot 19 (v4) : la preuve est le rejeu v4 ci-dessous ; l'état v3 d'où l'on tire les phases est celui de la
  // chaîne, qui vient de jouer exactement ces commandes depuis le départ (le rejeu v3 le referait au pas près ; la référence v3 le garde).
  let result = single ? { finished: chain.final.status === ATTEMPT_FINISHED, deaths: [] as unknown[], time: chain.final.time, final: chain.final } : replayAttempt(asm.level, replay, id);
  if (!result.finished) return "le rejeu n'arrive pas";
  if (result.deaths.length > 0) return `le rejeu meurt ${result.deaths.length} fois`;
  if (single) {
    const v3Time = result.time;
    let ascii: string;
    try {
      ascii = withSingleClock(asm.ascii, phasesFromEntries(asm.level, result.final.sections), simVersion >= PLATFORM_VERSION ? PLATFORM_VERSION : SINGLE_CLOCK_VERSION);
      asm = { ...asm, ascii, level: parseLevel(ascii) };
    } catch (e) {
      return `horloge unique : ${(e as Error).message}`;
    }
    replay = { ...replay, simVersion: asm.level.simVersion };
    result = replayAttempt(asm.level, replay, id);
    if (!result.finished || result.deaths.length > 0 || result.time !== v3Time) return "horloge unique : la preuve ne passe plus sans attendre";
  }
  const total = result.time;
  // Lot 19 : les états du rejeu de la preuve, gardés pour la voie lente (un seul rejeu de plus pour la course au sol et les voies lentes).
  const states: AttemptState[] = [];
  const pieces = asm.pieces.map((p, k) => ({ ...p, start: chain.starts[k]!, end: k + 1 < asm.pieces.length ? chain.starts[k + 1]! : total }));
  const base: Built = {
    id,
    level: asm.level,
    ascii: asm.ascii,
    hash: textHash(asm.ascii),
    pieces,
    paliers: asm.paliers,
    ...runStatsOf(asm.level, asm.paliers, chain.inputs, states),
    replay,
    code: encodeReplay(replay),
    authorTicks: total,
    medals: jumpMedalsFor(total),
    exigence: exigenceOfPieces(pieces, total),
    slowRoutes: [],
    slowTicks: total,
  };
  // Un tirage que les règles refusent déjà n'a pas besoin de ses voies lentes (elles ne changent aucune de ces règles) : on s'arrête là.
  const early = dailyProblems({ ...base, theme });
  if (early.length > 0) return { built: base, problems: early, cheap: [] };
  // Lot 16 : les voies lentes, mesurées contre la preuve.
  const slow = slowRoutesOf(asm, chain.inputs, id, total, states);
  if (typeof slow === "string") return slow;
  const cheap = slow.filter((r) => r.slowTicks < r.fastTicks + slowCostMin(r.fastTicks)).map((r) => r.piece);
  const slowTicks = total + slow.reduce((n, r) => n + r.slowTicks - r.fastTicks, 0);
  const built: Built = { ...base, medals: medalsWithSlow(total, slow), slowRoutes: slow, slowTicks };
  const problems = [...early];
  problems.push(...slowShortcutProblems(asm));
  problems.push(...slowRespawnProblems(asm, pieces));
  return { built, problems, cheap };
}

/**
 * Lot 16 : la voie lente de chaque portion dure, jouée par son script (`slowScript`) dans le niveau final à partir de l'état de la preuve au
 * pas où son centre entre sur le palier d'entrée ; la portion rapide va de ce pas à la sortie canonique du palier suivant (ou à l'arrivée).
 */
function slowRoutesOf(asm: Assembled, inputs: readonly number[], id: string, total: number, known: readonly AttemptState[] = []): SlowRoute[] | string {
  if (asm.slow.length === 0) return [];
  const level = asm.level;
  // Les pas où la preuve entre sur chaque palier (centre dans ses colonnes) et où elle passe son bord droit.
  const enter = asm.paliers.map(() => -1);
  const leave = asm.paliers.map(() => -1);
  // Lot 19 : les états déjà joués par `runStatsOf` (la même preuve sur le même niveau), sinon on les rejoue.
  const states: AttemptState[] = known.length === inputs.length ? [...known] : [];
  let s = initialAttempt(level);
  for (let t = 0; t < inputs.length; t++) {
    if (states.length === inputs.length) s = states[t]!;
    else {
      s = stepAttempt(s, inputs[t]!, level, DEFAULT_JUMP_PARAMS);
      states.push(s);
    }
    const col = centerCol(s.player);
    asm.paliers.forEach((p, k) => {
      if (enter[k]! < 0 && col >= p.col0) enter[k] = t + 1;
      if (leave[k]! < 0 && col > p.col1) leave[k] = t + 1;
    });
  }
  const out: SlowRoute[] = [];
  for (const r of asm.slow) {
    const k = r.piece;
    const last = k === asm.pieces.length - 1;
    const fork = enter[k]!;
    const end = last ? total : leave[k + 1]!;
    if (fork < 1 || end < 0) return `voie lente du morceau ${k + 1} : la preuve ne passe pas ses paliers`;
    const palierOut = asm.paliers[k + 1]!;
    const script = slowScript(level, states[fork - 1]!, { zone: r.zone, entryRow: r.entryRow, galleryRow: r.galleryRow, palierOut }, last);
    if (typeof script === "string") return `morceau ${k + 1} : ${script}`;
    const all = [...inputs.slice(0, fork), ...script];
    const code = encodeReplay({ simVersion: level.simVersion, levelId: id, start: { checkpoint: -1, held: 0, time: 0, sections: [], elan: 0 }, runs: toRuns(all) });
    out.push({
      piece: k,
      zone: r.zone,
      entryRow: r.entryRow,
      galleryRow: r.galleryRow,
      extra: r.extra,
      palierIn: asm.paliers[k]!,
      palierOut,
      ledges: slowLedges(r.zone, r.entryRow, r.galleryRow),
      fork,
      fastTicks: end - fork,
      slowTicks: script.length,
      code,
    });
  }
  return out;
}

/** Lot 16 : marge du bronze au-dessus du temps « toutes voies lentes » (pour cent). */
export const SLOW_BRONZE_MARGIN = 110;

/**
 * Lot 16 — les médailles d'un niveau à voies lentes : celles du temps de l'auteur (`jumpMedalsFor`), puis, au minimum, **l'or sous le temps
 * de n'importe quelle voie lente** (auteur + le plus petit surcoût − 1 pas) et **le bronze au-dessus du temps « toutes voies lentes »** avec
 * `SLOW_BRONZE_MARGIN` ; l'argent reste entre les deux. La calibration complète est pour le lot 17.
 */
export function medalsWithSlow(author: number, slow: readonly Pick<SlowRoute, "fastTicks" | "slowTicks">[]): JumpMedals {
  const m = jumpMedalsFor(author);
  if (slow.length === 0) return m;
  const minExtra = slow.reduce((n, r) => (r.slowTicks - r.fastTicks < n ? r.slowTicks - r.fastTicks : n), slow[0]!.slowTicks - slow[0]!.fastTicks);
  const all = author + slow.reduce((n, r) => n + r.slowTicks - r.fastTicks, 0);
  const goldMax = author + minExtra - 1;
  const gold = m.gold > goldMax ? goldMax : m.gold;
  const bronzeMin = ceilPercent(all, SLOW_BRONZE_MARGIN);
  const bronze = m.bronze < bronzeMin ? bronzeMin : m.bronze;
  const silver = m.silver < gold ? gold : m.silver > bronze ? bronze : m.silver;
  return { author, gold, silver, bronze };
}

/**
 * Lot 19 — **une voie lente ne gêne pas la reprise d'un morceau voisin** : la géométrie d'une voie lente sort de son morceau — le mur gauche de
 * sa cage se dresse juste après le palier de sortie du morceau d'avant, et une descente murée (`walls`) au-dessus du palier de sortie de la
 * portion dure —, là où le morceau seul n'a que du vide. La preuve (solutions en élan) passe par construction ; une **reprise sur le point de
 * passage** joue la solution « arrêt » du morceau : elle doit en sortir au bord du palier, en course propre, à la phase où elle attend l'horloge
 * (la vérification que `daily.test.ts` fait sur 20 dates, posée en règle pour les morceaux voisins d'une voie lente : en g14, le 19/10/2026 —
 * `chute-pics` v0 suivi de `mur-seul` v2 — et le 02/11/2026 l'avaient cassée). Rend ce qui ne va pas.
 */
export function slowRespawnProblems(asm: Pick<Assembled, "level" | "slow" | "paliers">, pieces: readonly Pick<DailyPiece, "id" | "variant" | "col0" | "entryRow">[]): string[] {
  const out: string[] = [];
  const lv = asm.level;
  const hard = new Set(asm.slow.map((r) => r.piece));
  const zoneOf = new Map(asm.slow.map((r) => [r.piece, r]));
  for (let k = 1; k < pieces.length - 1; k++) {
    if (!hard.has(k + 1) && !(zoneOf.get(k)?.walls.length ?? 0)) continue;
    const p = pieces[k]!;
    const sol = moduleSolutions(p.id, p.variant)?.arret;
    if (!sol) continue;
    const m = buildModule(p.id, p.variant);
    const own = fromRuns(decodeReplay(sol.code).runs);
    const e = replayAttempt(m.level, decodeReplay(sol.code)).final.sections[0] ?? 0;
    const period = sectionPeriod(lv, k);
    const time = 5000 + (period === 0 ? 0 : cycleMod(-e - (lv.sections[k]?.phase ?? 0) - 5000, period));
    let s = checkpointAttempt(lv, { ...initialAttempt(lv), checkpoint: k - 1, time });
    // Devant une portion dure, la reprise se joue depuis le palier « bis » de la zone (l'entrée du morceau seul).
    if (hard.has(k)) s = { ...s, player: { ...s.player, x: s.player.x + (p.col0 - PALIER_LENGTH - asm.paliers[k]!.col0) * UNITS_PER_TILE } };
    for (let t = 0; t < sol.exitTick && s.status === ATTEMPT_RUNNING; t++) s = stepAttempt(s, own[t]!, lv, DEFAULT_JUMP_PARAMS);
    if (s.status !== ATTEMPT_RUNNING || centerCol(s.player) !== asm.paliers[k + 1]!.col1 + 1 || !isCleanRun(s.player)) out.push(`morceau ${k + 1} : une voie lente voisine gêne la reprise`);
  }
  return out;
}

/**
 * Lot 16 — **aucun raccourci** : chaque voie lente n'est reliée au reste du niveau que par son entrée (le puits du palier d'entrée, par
 * l'ouverture du mur gauche de la cage) et par sa descente (le puits du palier suivant) ; dans ce puits, au-dessus de la portée d'un saut depuis le sol
 * (`SLOW_REACH_ROWS`), le morceau suivant n'a aucune case libre contre la descente (on ne tombe pas dans le haut du morceau suivant). Aucune
 * scie ne touche une case de la voie, à aucun pas de son cycle. Rend ce qui ne va pas.
 */
export function slowShortcutProblems(asm: Pick<Assembled, "level" | "slow" | "paliers" | "pieces">): string[] {
  const out: string[] = [];
  const level = asm.level;
  const T = UNITS_PER_TILE;
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= level.width || r >= level.height ? TILE_SOLID : level.tiles[r * level.width + c]!);
  const mine = new Map<string, number>();
  asm.slow.forEach((r, i) => r.carved.forEach((cell) => mine.set(`${cell.col},${cell.row}`, i)));
  // Le trajet de chaque scie (tous les pas de son cycle) et sa boîte, rayon compris : calculés une fois pour toutes les voies.
  const sawPaths = asm.slow.length === 0 ? [] : level.saws.map((saw) => {
    const steps = saw.cycle === 0 ? 1 : saw.cycle;
    const centers: { x: number; y: number }[] = [];
    for (let t = 0; t < steps; t++) centers.push(sawCenter(saw, t));
    let x0 = centers[0]!.x;
    let x1 = x0;
    let y0 = centers[0]!.y;
    let y1 = y0;
    for (const p of centers) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { saw, centers, x0: x0 - saw.radius, x1: x1 + saw.radius, y0: y0 - saw.radius, y1: y1 + saw.radius };
  });
  asm.slow.forEach((r, i) => {
    const pin = asm.paliers[r.piece]!;
    const pout = asm.paliers[r.piece + 1]!;
    const next = asm.pieces[r.piece + 1];
    for (const cell of r.carved) {
      // Voisines par un côté (une boîte de ¾ de tuile ne passe pas entre deux coins pleins).
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        {
          const c = cell.col + dc;
          const row = cell.row + dr;
          if (at(c, row) === TILE_SOLID) continue;
          const owner = mine.get(`${c},${row}`);
          if (owner === i) continue;
          if (owner !== undefined) {
            // La descente d'une voie longe l'ouverture de la cage de la suivante (portions dures voisines) : c'est l'entrée de celle-ci, qu'on
            // prend de toute façon depuis ce palier ; aucune autre jonction n'est permise.
            const opening = (q: (typeof asm.slow)[number], col: number, rr: number) => col === q.zone && rr >= q.entryRow - 5 && rr <= q.entryRow - 3;
            const other = asm.slow[owner]!;
            const joint = (other.piece === r.piece + 1 && opening(other, c, row)) || (other.piece === r.piece - 1 && opening(r, cell.col, cell.row));
            if (!joint) out.push(`voies lentes ${i + 1} et ${owner + 1} se touchent en ${c},${row}`);
            continue;
          }
          const entrance = c >= pin.col0 && c <= pin.col1;
          const descent = c >= pout.col0 && c <= pout.col1;
          if (!entrance && !descent) out.push(`voie lente ${i + 1} : ouverte sur la case ${c},${row}`);
        }
      }
    }
    // La descente longe le morceau suivant : rien de libre au-dessus de la portée d'un saut.
    if (next) {
      for (let row = 0; row < pout.row - SLOW_REACH_ROWS; row++) {
        let c = pout.col0;
        while (c <= pout.col1 + 1 && at(c, row) !== TILE_SOLID) c++;
        if (c > pout.col1 + 1) out.push(`voie lente ${i + 1} : la descente donne sur le morceau suivant en ${pout.col1 + 1},${row}`);
      }
    }
    sawPaths.forEach(({ saw, centers, x0, x1, y0, y1 }) => {
      // Seules les cases dans la boîte du trajet de la scie (rayon compris) peuvent être touchées : les autres ne sont pas testées.
      const near = r.carved.filter((cell) => (cell.col + 1) * T > x0 && cell.col * T < x1 && (cell.row + 1) * T > y0 && cell.row * T < y1);
      if (near.length === 0) return;
      for (const p of centers) {
        for (const cell of near) {
          if (circleHitsBox(p.x, p.y, saw.radius, { x: cell.col * T, y: cell.row * T, w: T, h: T })) {
            out.push(`voie lente ${i + 1} : la scie ${saw.id} touche ${cell.col},${cell.row}`);
            return;
          }
        }
      }
    });
  });
  return out;
}

/**
 * Le niveau de secours : une suite fixe de variantes, choisie parmi les tirages valides de 400 dates (celle qui tombe le plus près du centre
 * de la cible : 30,13 s, exigence 497 ; lot 7), qui tient toutes les règles. Il ignore le repos. Assemblé et validé comme les autres (test) ; la
 * mesure (`measure:jump`) montre qu'il ne sert jamais. Lot 11 : un thème à mécanique a le sien (il doit tenir le quota de signature).
 */
export const FALLBACK_PIECES: readonly { id: string; variant: number }[] = [
  { id: "cheminee-vide", variant: 1 },
  { id: "pont-friable", variant: 3 },
  { id: "escalier-scies", variant: 0 },
  { id: "descente", variant: 2 },
  { id: "mur-friable", variant: 1 },
  { id: "piliers-scie", variant: 1 },
  { id: "puits", variant: 1 },
  { id: "ascenseur", variant: 5 },
  { id: "chute-pics", variant: 0 },
  { id: "iles-friables", variant: 1 },
];

/** Lot 11 : les suites de secours des thèmes à mécanique (remplies avec le catalogue : voir `fallbackFor`). */
export const FALLBACK_BY_THEME: Readonly<Partial<Record<JumpThemeName, readonly { id: string; variant: number }[]>>> = {
  // Choisies, comme `FALLBACK_PIECES`, parmi les tirages valides (80 dates, thème forcé) : celle qui tombe le plus près du centre.
  usine: [
    { id: "cheminee", variant: 1 },
    { id: "tapis-alternes", variant: 0 },
    { id: "tapis-escalier", variant: 2 },
    { id: "mur-trous", variant: 3 },
    { id: "tunnel", variant: 0 },
    { id: "descente-scies", variant: 1 },
    { id: "escalier-friable", variant: 2 },
    { id: "tapis-mur", variant: 3 },
    { id: "saut-long", variant: 2 },
    { id: "pendule", variant: 3 },
    { id: "tapis-lance", variant: 3 },
  ],
  glace: [
    { id: "pendule", variant: 2 },
    { id: "ressorts-trous", variant: 0 },
    { id: "mur-trous", variant: 2 },
    { id: "petits-trous", variant: 1 },
    { id: "glace-relais", variant: 0 },
    { id: "glace-cheminee", variant: 0 },
    { id: "chute-pics", variant: 2 },
    { id: "iles-friables", variant: 1 },
    { id: "cheminee", variant: 0 },
  ],
  // Lot 12 : choisies par `npm run secours:modules -w @cdj/jump-sim` parmi les tirages valides de 80 dates (thème forcé), les plus proches du centre.
  // Lot 18 (g13) : rechoisie (`secours:modules -- --theme=nuit`, 80 niveaux valides sur 80 dates) — l'ancienne (`FALLBACK_NUIT_V3`) pose des phases de moins de 1,5 s.
  nuit: [
    { id: "nuit-cheminee", variant: 5 },
    { id: "cheminee-pics", variant: 0 },
    { id: "ressort-mur", variant: 1 },
    { id: "scie-ronde", variant: 0 },
    { id: "nuit-opposition", variant: 7 },
    { id: "puits-descente", variant: 2 },
    { id: "nuit-marelle", variant: 4 },
    { id: "piliers", variant: 3 },
    { id: "escalier-friable", variant: 2 },
    { id: "mur-seul", variant: 5 },
    { id: "pendule", variant: 5 },
  ],
  // Lot 16 : l'ancienne suite dépassait 56 rangées avec la galerie de ses voies lentes ; rechoisie (`secours:modules -- --theme=neon`).
  neon: [
    { id: "neon-pics", variant: 2 },
    { id: "mur-trous", variant: 4 },
    { id: "cheminee-scie", variant: 2 },
    { id: "petits-trous", variant: 1 },
    { id: "neon-cheminee", variant: 0 },
    { id: "saut-long", variant: 3 },
    { id: "descente-scies", variant: 0 },
    { id: "cheminee-vide", variant: 3 },
    { id: "grande-scie", variant: 4 },
    { id: "neon-couloir", variant: 2 },
  ],
  // Lot 13 : la forêt (courants d'air), choisie de même (`secours:modules -- --theme=foret`, 80 dates valides sur 80).
  // Lot 19 (g14) : rechoisie (`secours:modules -- --theme=foret`, 80 niveaux valides sur 80 dates) — l'ancienne (`FALLBACK_FORET_V3`) casse la règle
  // de la reprise près d'une voie lente (`slowRespawnProblems`).
  foret: [
    { id: "tunnel-scies", variant: 1 },
    { id: "vent-puits", variant: 0 },
    { id: "vent-rafale", variant: 0 },
    { id: "saut-plafond", variant: 4 },
    { id: "tunnel", variant: 0 },
    { id: "vent-relais", variant: 1 },
    { id: "puits", variant: 0 },
    { id: "scies-jumelles", variant: 4 },
    { id: "ressort-mur", variant: 3 },
    { id: "cheminee-pics", variant: 1 },
  ],
};

/** Lot 16 : la suite de secours du néon d'avant (lot 12), gardée pour la référence v3 (`dailyLevel(jour, thème, 3)` ne change pas). */
const FALLBACK_NEON_V3: readonly { id: string; variant: number }[] = [
  { id: "neon-cheminee", variant: 1 },
  { id: "ressort-scie", variant: 1 },
  { id: "paroi-friable", variant: 2 },
  { id: "escalier-scies", variant: 0 },
  { id: "puits", variant: 2 },
  { id: "petits-trous", variant: 5 },
  { id: "piliers-scie", variant: 5 },
  { id: "demi-tour", variant: 3 },
  { id: "pont-friable", variant: 4 },
  { id: "neon-couloir", variant: 2 },
];

/** Lot 18 : la suite de secours de la nuit d'avant (g9 à g12), gardée pour la référence v3 : certaines de ses variantes ont des phases de moins de 1,5 s. */
const FALLBACK_NUIT_V3: readonly { id: string; variant: number }[] = [
  { id: "mur-seul", variant: 0 },
  { id: "grande-scie", variant: 3 },
  { id: "puits-descente", variant: 1 },
  { id: "marelle", variant: 5 },
  { id: "nuit-marelle", variant: 0 },
  { id: "nuit-escalier", variant: 1 },
  { id: "piliers", variant: 1 },
  { id: "cheminee-quinconce", variant: 1 },
  { id: "plongeon", variant: 1 },
  { id: "nuit-portes", variant: 0 },
];

/** Lot 19 : la suite de secours de la forêt d'avant (g9 à g13), gardée pour la référence v3. */
const FALLBACK_FORET_V3: readonly { id: string; variant: number }[] = [
  { id: "scie-sol", variant: 1 },
  { id: "tremplin", variant: 1 },
  { id: "demi-tour", variant: 0 },
  { id: "mur-friable", variant: 3 },
  { id: "ressort-mur-iles", variant: 3 },
  { id: "corniches", variant: 4 },
  { id: "vent-piliers", variant: 1 },
  { id: "chute-pics", variant: 0 },
  { id: "ressort-scie", variant: 2 },
  { id: "lucarne", variant: 3 },
  { id: "quinconce", variant: 3 },
];

/** La suite de secours d'un thème (lot 16 : celle du néon a changé pour la v4 ; lot 18 : celle de la nuit aussi ; lot 19 : celle de la forêt). */
export function fallbackFor(theme: JumpThemeName, simVersion = PLATFORM_VERSION): readonly { id: string; variant: number }[] {
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "neon") return FALLBACK_NEON_V3;
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "nuit") return FALLBACK_NUIT_V3;
  if (simVersion < SINGLE_CLOCK_VERSION && theme === "foret") return FALLBACK_FORET_V3;
  return FALLBACK_BY_THEME[theme] ?? FALLBACK_PIECES;
}

const cache = new Map<string, DailyLevel>();

/** Lot 19 : oublie les niveaux gardés en mémoire (tests et mesures : une génération « à froid », dépendances de variété comprises). */
export function forgetDailyLevels(): void {
  cache.clear();
}

/**
 * **Le niveau du jour** `day` (numéro de jour de `@cdj/core`, la date de Paris lue hors de la simulation). Pur et déterministe : même date,
 * même niveau, partout. Le résultat est gardé en mémoire (même objet pour une même date).
 * Lot 11 : le thème du jour (`jumpThemeForDay`) décide des morceaux permis et du quota de signature ; `forced` impose un autre thème : c'est
 * un **essai** (`forcedTheme`, identifiant suffixé `-t<thème>`), jamais enregistré. Forcer le thème de la date donne le niveau de la date.
 * Lot 15 : `simVersion` 3 : le niveau g9 d'avant le lot, à l'identique (référence v3). Lot 20 : 4 : le niveau g14 d'avant les plateformes, à l'identique (référence v4) ;
 * 5 (défaut) : le niveau du générateur g15, en version 5.
 */
export function dailyLevel(day: number, forced: JumpThemeName | null = null, simVersion = PLATFORM_VERSION): DailyLevel {
  const natural = jumpThemeForDay(day);
  const theme = forced ?? natural;
  const isForced = theme !== natural;
  const key = `${day}:${theme}:${simVersion}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const id = dailyLevelId(day, theme, simVersion);
  const seed = mixSeed(day, DAILY_SALT);
  const attempts: DailyAttempt[] = [];
  let best: { built: Built; index: number; score: number } | null = null;
  /** Prouve un tirage composé, l'inscrit dans `attempts` et rend son résultat s'il est valide. */
  const tryDraw = (index: number, picks: Slot[]): { built: Built; score: number; runOver: number } | null => {
    const names = picks.map((p) => `${p.choice.id}:${p.choice.variant}`);
    const proof = prove(
      picks.map((p) => ({ id: p.choice.id, variant: p.choice.variant })),
      id,
      theme,
      simVersion,
    );
    if (typeof proof === "string") {
      attempts.push({ index, status: "refusé", reason: proof, pieces: names, ticks: 0, rate: 0, score: 0 });
      return null;
    }
    const { built, problems } = proof;
    // Lot 16 (v4) : la piste sous la cage allonge la course au sol ; à score égal, le tirage dont la plus longue course passe 1,2 s perd.
    const runOver = simVersion >= SINGLE_CLOCK_VERSION && built.longestRun > LONGEST_RUN_TARGET ? per(built.longestRun - LONGEST_RUN_TARGET, LONGEST_RUN_TARGET) : 0;
    const score = scoreOf(built.authorTicks, built.exigence.rate) + runOver;
    const status = problems.length > 0 ? "refusé" : "valide";
    attempts.push({ index, status, reason: problems.join(" ; "), pieces: names, ticks: built.authorTicks, rate: built.exigence.rate, score });
    return problems.length > 0 ? null : { built, score, runOver };
  };
  if (simVersion < SINGLE_CLOCK_VERSION) {
    // La référence v3 (g9) : le meilleur des `DAILY_DRAWS` premiers tirages valides, au bit près comme avant.
    for (let index = 0; index < DAILY_MAX_ATTEMPTS; index++) {
      if (index >= DAILY_DRAWS && best) break;
      const picks = compose(day, new Rng(mixSeed(seed, index)), theme, simVersion, null);
      if (typeof picks === "string") {
        attempts.push({ index, status: "impasse", reason: picks, pieces: [], ticks: 0, rate: 0, score: 0 });
        continue;
      }
      const r = tryDraw(index, picks);
      if (r && (!best || r.score < best.score)) best = { ...r, index };
    }
  } else {
    // Lot 19 (g14) : les morceaux de base des jours voisins sont écartés, et les tirages sont **prouvés dans l'ordre de leur score estimé**
    // (durée et exigence de la composition, sans rejeu) par lots de `DAILY_DRAWS` : le premier valide est retenu. Le score estimé suit le score
    // rejoué à quelques pas près (les solutions sont mises bout à bout sans course entre deux) ; on prouve 2 à 3 tirages au lieu de 6 à 8, ce
    // qui paie les niveaux voisins que la règle de variété fait calculer (« une génération d'un niveau sous 2 s »).
    const excluded = varietyExcluded(day, simVersion);
    for (let from = 0; from < DAILY_MAX_ATTEMPTS_V4 && !best; from += DAILY_DRAWS) {
      const batch: { index: number; picks: Slot[]; estimate: number }[] = [];
      for (let index = from; index < from + DAILY_DRAWS && index < DAILY_MAX_ATTEMPTS_V4; index++) {
        const picks = compose(day, new Rng(mixSeed(seed, index)), theme, simVersion, excluded);
        if (typeof picks === "string") attempts.push({ index, status: "impasse", reason: picks, pieces: [], ticks: 0, rate: 0, score: 0 });
        else batch.push({ index, picks, estimate: estimateScore(picks) });
      }
      batch.sort((a, b) => a.estimate - b.estimate || a.index - b.index);
      // Le premier valide dont la plus longue course au sol tient sous 1,2 s (`LONGEST_RUN_TARGET`) arrête le lot ; sinon on prouve la suite du
      // lot et le meilleur score rejoué l'emporte (le score estimé ne voit pas la course au sol).
      let done = false;
      for (const b of batch) {
        if (done) {
          attempts.push({ index: b.index, status: "écarté", reason: "un tirage mieux estimé est valide", pieces: b.picks.map((p) => `${p.choice.id}:${p.choice.variant}`), ticks: 0, rate: 0, score: b.estimate });
          continue;
        }
        const early = estimateProblem(b.picks);
        if (early) {
          attempts.push({ index: b.index, status: "refusé", reason: early, pieces: b.picks.map((p) => `${p.choice.id}:${p.choice.variant}`), ticks: 0, rate: 0, score: 0 });
          continue;
        }
        const r = tryDraw(b.index, b.picks);
        if (r && (!best || r.score < best.score)) best = { ...r, index: b.index };
        if (r && r.runOver === 0) done = true;
      }
    }
    attempts.sort((a, b) => a.index - b.index);
  }
  let out: DailyLevel;
  if (best) out = { ...best.built, theme, forcedTheme: isForced, day, date: formatDay(day), number: levelNumber(day), attempts, chosen: best.index, fallback: false };
  else {
    const proof = prove(fallbackFor(theme, simVersion), id, theme, simVersion);
    if (typeof proof === "string" || proof.problems.length > 0) throw new Error(`Niveau de secours invalide : ${typeof proof === "string" ? proof : proof.problems.join(" ; ")}`);
    out = { ...proof.built, theme, forcedTheme: isForced, day, date: formatDay(day), number: levelNumber(day), attempts, chosen: -1, fallback: true };
  }
  cache.set(key, out);
  return out;
}

/** Le niveau de secours d'une date (pour les tests et la mesure : il ne sert que si aucun tirage ne passe). */
export function fallbackLevel(day: number, forced: JumpThemeName | null = null, simVersion = PLATFORM_VERSION): DailyLevel | string {
  const natural = jumpThemeForDay(day);
  const theme = forced ?? natural;
  const proof = prove(fallbackFor(theme, simVersion), dailyLevelId(day, theme, simVersion), theme, simVersion);
  if (typeof proof === "string") return proof;
  if (proof.problems.length > 0) return proof.problems.join(" ; ");
  return { ...proof.built, theme, forcedTheme: theme !== natural, day, date: formatDay(day), number: levelNumber(day), attempts: [], chosen: -1, fallback: true };
}
