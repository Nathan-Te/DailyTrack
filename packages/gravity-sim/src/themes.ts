import { mixSeed, Rng } from "@cdj/core";
import { NB_THEMES } from "./constantes";

// Les cinq thèmes de Gravity sont **ceux de Jump** (mêmes codes, même palette de rendu — `@cdj/visuels` au lot GR3), chacun avec sa case spéciale (seed « Le niveau du jour »). Un thème tous les 300 m environ
// (19 morceaux de 16 colonnes), dans **un ordre tiré chaque jour** ; au bout des cinq, la boucle reprend dans le même ordre, plus dense.
export const THEMES_GRAVITY = ["foret", "usine", "glace", "nuit", "neon"] as const;
export type ThemeGravity = (typeof THEMES_GRAVITY)[number];

const SEL_ORDRE = 0x4f7d2e;

/** L'ordre des cinq thèmes du jour (un mélange de Fisher-Yates de la graine du jour). Pure. */
export function ordreDesThemes(jour: number): ThemeGravity[] {
  if (THEMES_GRAVITY.length !== NB_THEMES) throw new Error("NB_THEMES");
  return new Rng(mixSeed(jour, SEL_ORDRE)).shuffle(THEMES_GRAVITY);
}

/** Le thème du jour : celui où la partie commence. */
export const themeDuJour = (jour: number): ThemeGravity => ordreDesThemes(jour)[0]!;

/** L'ordre du jour ramené à un thème imposé en tête (l'essai `?theme=<id>`, jamais classé) : la liste tournée pour que ce thème soit le premier, l'ordre relatif des autres inchangé. */
export function ordreCommencantPar(ordre: readonly ThemeGravity[], theme: ThemeGravity): ThemeGravity[] {
  const i = ordre.indexOf(theme);
  if (i < 0) return [...ordre];
  return [...ordre.slice(i), ...ordre.slice(0, i)];
}
