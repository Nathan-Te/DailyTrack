import { Rng, mixSeed, parseDay, themeDuSac, type ReglesSac } from "@cdj/core";
import { ALT_KEPT_VERSION, TICK_RATE } from "./constants";
import { JUMP_GENERATOR_SAC } from "./versionSac";

export { JUMP_GENERATOR_SAC };

// Les thèmes de DailyJump (lot 11) : le thème est une **donnée du générateur**. Chaque thème peut apporter sa mécanique de jeu (revêtements,
// comme les thèmes de DailyTrack) : `usine` les tapis roulants, `glace` la glace, `nuit` les blocs clignotants et `neon` les blocs alternés
// (lot 12), `foret` les courants d'air (lot 13) : depuis le lot 13, les cinq thèmes ont leur mécanique. Le thème d'un jour se déduit de la date (`jumpThemeForDay`, pur) : il n'entre donc pas
// dans l'identifiant du niveau, sauf **forcé** par l'adresse (`?theme=`) : alors c'est un essai, identifiant suffixé `-t<thème>`.
//
// **Tout changement de `jumpThemeForDay` ou des règles d'un thème impose `JUMP_GENERATOR_VERSION` +1** (le niveau d'une date change).
// L'identité visuelle et sonore de chaque thème (palette, tuiles, décor) reste dans `apps/jump/src/themes.ts`, qui n'en lit que le nom.

export const JUMP_THEME_NAMES = ["foret", "usine", "glace", "nuit", "neon"] as const;
export type JumpThemeName = (typeof JUMP_THEME_NAMES)[number];

/**
 * Les mécaniques : un morceau porte l'étiquette de sa mécanique (`tapis`, `glace`) et le thème qui la porte. **Lot 22 : l'usine a deux éléments, les tapis et les
 * presses** : un morceau à presses (étiquette `presse`) est de l'usine et compte, comme un morceau à tapis, pour le quota de la mécanique de l'usine (`tapis`).
 */
export type Mechanic = "tapis" | "glace" | "clignotant" | "alterne" | "vent";

/** Les thèmes qui ont une mécanique, et celle-ci (lot 12 : la nuit a ses blocs clignotants, le néon ses blocs alternés ; lot 13 : la forêt ses courants d'air). */
export const THEME_MECHANIC: Readonly<Partial<Record<JumpThemeName, Mechanic>>> = { usine: "tapis", glace: "glace", nuit: "clignotant", neon: "alterne", foret: "vent" };
export const MECHANIC_THEMES = ["usine", "glace", "nuit", "neon", "foret"] as const satisfies readonly JumpThemeName[];

/** La mécanique d'un thème, ou null. */
export function mechanicOf(theme: JumpThemeName): Mechanic | null {
  return THEME_MECHANIC[theme] ?? null;
}

/**
 * **Quota de signature** d'un niveau de thème à mécanique : au moins `SIGNATURE_MIN_PIECES` morceaux de la mécanique (étiquette, ou variante
 * `surface:` du thème), pour `SIGNATURE_SHARE_MIN` à `SIGNATURE_SHARE_MAX` ‰ du temps de l'auteur (20 à 40 %).
 */
export const SIGNATURE_MIN_PIECES = 2;
export const SIGNATURE_SHARE_MIN = 200;
export const SIGNATURE_SHARE_MAX = 400;
/** Part visée (‰) : le générateur favorise la mécanique tant qu'elle est en dessous. */
export const SIGNATURE_SHARE_TARGET = 300;
/** Le morceau qui porte la mécanique doit durer au moins ceci (pas) pour compter dans la part : un seul pas de tapis ne fait pas un thème. */
export const SIGNATURE_MIN_TICKS = TICK_RATE;

/** Sel du tirage des thèmes (celui du lot 9 : `themeForDay` donne exactement les mêmes thèmes qu'avant). */
const THEME_SALT = 0x74686d39;

const draw = (day: number, n: number): number => new Rng(mixSeed(day, THEME_SALT)).int(n);

/**
 * **L'ancienne règle** (générateurs g22 et avant), **pure** : deux jours consécutifs n'ont jamais le même thème (un jour pair tire librement parmi les cinq ; un jour
 * impair tire parmi ceux que n'ont pas ses deux voisins, pairs, donc connus sans récurrence), mais A B A était possible. Identique, date par date, à la version du lot 9
 * (test sur 400 dates : `fixtures/themes-lot9.json`). Elle reste celle de **tout niveau figé d'un générateur d'avant le sac** (`jumpThemeOfGenerator`) et des références
 * d'avant la version 12 de la simulation.
 */
export function jumpThemeAncien(day: number): JumpThemeName {
  const even = (d: number) => JUMP_THEME_NAMES[draw(d, JUMP_THEME_NAMES.length)]!;
  if (((day % 2) + 2) % 2 === 0) return even(day);
  const banned = new Set([even(day - 1), even(day + 1)]);
  const allowed = JUMP_THEME_NAMES.filter((n) => !banned.has(n));
  return allowed[draw(day, allowed.length)]!;
}

/**
 * Lot V1 (plateforme) — **le sac de thèmes** (générateur g23) : la règle commune aux deux jeux (`themeDuSac`, `@cdj/core/src/sacThemes.ts`) — chaque thème une fois par
 * cycle de cinq jours, dans un ordre tiré de la graine, jamais deux jours de suite le même, jamais A B A. Un niveau figé d'un générateur d'avant (`< JUMP_GENERATOR_SAC`)
 * garde l'ancienne règle ; le premier jour du sac lit le thème de la veille (un jour figé d'avant).
 */
const SEL_SAC = 0x6a756d70;

/** Les jours que des niveaux figés d'un générateur d'avant le sac ont servis (voir `declareFrozenGenerators`). */
let joursAnciens: ReadonlySet<number> = new Set();

/**
 * **Ce que le code sait des niveaux figés** : les dates (`AAAA-MM-JJ`) des jours servis par un générateur d'avant le sac (< `JUMP_GENERATOR_SAC`). Un tel jour garde son thème de
 * l'ancienne règle, et le premier jour du sac l'évite — c'est ainsi que « le générateur lit le thème de la veille dans le fichier figé », sans aucune date écrite. Les jours que
 * personne ne déclare suivent le sac. **Chaque lieu qui calcule un thème le déclare au démarrage** : le jeu (page, fil du générateur, page d'outils : `apps/jump/src/frozen.ts`)
 * et le serveur (`apps/api/src/jump.ts`, par `declareFrozenGenerators`) ; la déclaration remplace la précédente.
 */
export function declareOldFrozenDays(dates: readonly string[]): void {
  const anciens = new Set<number>();
  for (const date of dates) {
    const day = parseDay(date);
    if (day !== null) anciens.add(day);
  }
  const change = anciens.size !== joursAnciens.size || [...anciens].some((d) => !joursAnciens.has(d));
  joursAnciens = anciens;
  if (change) for (const f of auChangement) f();
}

const auChangement: (() => void)[] = [];
/** Appelé quand la déclaration des jours figés change : les niveaux gardés en mémoire (`daily.ts`) en dépendent (le thème d'un jour, donc la variété de ses voisins) et sont oubliés. */
export function auChangementDesJoursAnciens(f: () => void): void {
  auChangement.push(f);
}

/** Comme `declareOldFrozenDays`, d'après le générateur de chaque fichier figé (`AAAA-MM-JJ` → `generatorVersion`) : seuls ceux d'avant le sac comptent. */
export function declareFrozenGenerators(generators: Readonly<Record<string, number>>): void {
  declareOldFrozenDays(Object.entries(generators).filter(([, g]) => Number.isInteger(g) && g < JUMP_GENERATOR_SAC).map(([date]) => date));
}

const REGLES_SAC: ReglesSac = {
  n: JUMP_THEME_NAMES.length,
  sel: SEL_SAC,
  ancien: (day) => JUMP_THEME_NAMES.indexOf(jumpThemeAncien(day)),
  estAncien: (day) => joursAnciens.has(day),
};

/**
 * Le thème d'un jour (numéro de jour de `@cdj/core`), **pur** hors ce que `declareFrozenGenerators` a appris des jours figés : le sac de thèmes pour un jour du générateur
 * g23 ou plus, l'ancienne règle pour un jour figé d'un générateur d'avant.
 */
export function jumpThemeForDay(day: number): JumpThemeName {
  return JUMP_THEME_NAMES[themeDuSac(day, REGLES_SAC)]!;
}

/** Le thème d'un jour pour une version de la simulation : l'ancienne règle avant la version 12 (les références g9 à g21 gardent leurs niveaux), le sac depuis. */
export function jumpThemeOfSim(day: number, simVersion: number): JumpThemeName {
  return simVersion >= ALT_KEPT_VERSION ? jumpThemeForDay(day) : jumpThemeAncien(day);
}

/** Le thème d'un jour figé par le générateur `generator` : l'ancienne règle avant le sac, le sac depuis. */
export function jumpThemeOfGenerator(day: number, generator: number): JumpThemeName {
  return generator < JUMP_GENERATOR_SAC ? jumpThemeAncien(day) : jumpThemeForDay(day);
}
