import { Rng, mixSeed } from "@cdj/core";
import { TICK_RATE } from "./constants";

// Les thèmes de DailyJump (lot 11) : le thème est une **donnée du générateur**. Chaque thème peut apporter sa mécanique de jeu (revêtements,
// comme les thèmes de DailyTrack) : `usine` les tapis roulants, `glace` la glace, `nuit` les blocs clignotants et `neon` les blocs alternés
// (lot 12) ; `foret` n'a pas encore de mécanique (lot 13) et garde la composition d'avant. Le thème d'un jour se déduit de la date (`jumpThemeForDay`, pur) : il n'entre donc pas
// dans l'identifiant du niveau, sauf **forcé** par l'adresse (`?theme=`) : alors c'est un essai, identifiant suffixé `-t<thème>`.
//
// **Tout changement de `jumpThemeForDay` ou des règles d'un thème impose `JUMP_GENERATOR_VERSION` +1** (le niveau d'une date change).
// L'identité visuelle et sonore de chaque thème (palette, tuiles, décor) reste dans `apps/jump/src/themes.ts`, qui n'en lit que le nom.

export const JUMP_THEME_NAMES = ["foret", "usine", "glace", "nuit", "neon"] as const;
export type JumpThemeName = (typeof JUMP_THEME_NAMES)[number];

/** Les mécaniques : un morceau porte l'étiquette de sa mécanique (`tapis`, `glace`) et le thème qui la porte. */
export type Mechanic = "tapis" | "glace" | "clignotant" | "alterne";

/** Les thèmes qui ont une mécanique, et celle-ci (lot 12 : la nuit a ses blocs clignotants, le néon ses blocs alternés). */
export const THEME_MECHANIC: Readonly<Partial<Record<JumpThemeName, Mechanic>>> = { usine: "tapis", glace: "glace", nuit: "clignotant", neon: "alterne" };
export const MECHANIC_THEMES = ["usine", "glace", "nuit", "neon"] as const satisfies readonly JumpThemeName[];

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
 * Le thème d'un jour (numéro de jour de `@cdj/core`), **pur**. Deux jours consécutifs n'ont jamais le même thème : un jour pair tire
 * librement parmi les cinq ; un jour impair tire parmi ceux que n'ont pas ses deux voisins (pairs, donc connus sans récurrence).
 * Identique, date par date, à la version du lot 9 (test sur 400 dates : `fixtures/themes-lot9.json`).
 */
export function jumpThemeForDay(day: number): JumpThemeName {
  const even = (d: number) => JUMP_THEME_NAMES[draw(d, JUMP_THEME_NAMES.length)]!;
  if (((day % 2) + 2) % 2 === 0) return even(day);
  const banned = new Set([even(day - 1), even(day + 1)]);
  const allowed = JUMP_THEME_NAMES.filter((n) => !banned.has(n));
  return allowed[draw(day, allowed.length)]!;
}
