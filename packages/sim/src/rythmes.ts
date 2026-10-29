import { themeDuSac, type ReglesSac } from "@cdj/core";
import { generatorVersionOf } from "./dailyId";
import { themeForDay, type ThemeName } from "./themes";

// Lot V2 — **le rythme d'un circuit** (générateur v21) : technique, rapide, mixte, vertical ou aérien. Il oriente le choix des figures (poids, generator.ts), pour que deux jours
// ne se jouent pas pareil, et décide du motif « boost → longue ligne droite → virage serré » (permis un jour rapide seulement, une fois au plus).
//
// **La règle.** Un sac de cinq rythmes, la règle commune du sac de thèmes (`themeDuSac`, `@cdj/core`, sel propre) : chaque rythme une fois par cycle de cinq jours, jamais deux
// jours de suite le même. **Le rythme dominant du biome** (sa fiche, `docs/track/biomes.md`) prend la place du rythme « mixte » de son jour, sauf s'il est celui du sac la veille
// ou le lendemain : il sort donc deux fois plus que les autres dans ce biome, et **deux jours qui se suivent n'ont jamais le même rythme** (testé). Un jour d'une version d'avant
// (le registre des jours) n'a pas de rythme ; le sac le compte comme « rapide » (il a pu avoir le motif) : le premier jour de la v21 n'est donc pas rapide.
// Pur, direct (trois cycles au plus, aucune histoire) : quelques microsecondes.

export const RYTHMES = ["technique", "rapide", "mixte", "vertical", "aerien"] as const;
export type Rythme = (typeof RYTHMES)[number];

/** Première version du générateur qui a des rythmes, des fiches de biomes et la règle du motif (lot V2). */
export const GENERATOR_RYTHMES = 21;

/** Le rythme dominant de chaque biome (sa fiche, `docs/track/biomes.md`). */
export const RYTHME_DOMINANT: Readonly<Record<ThemeName, Rythme>> = {
  stade: "rapide",
  rallye: "aerien",
  banquise: "mixte",
  nuit: "aerien",
  campagne: "technique",
  canyon: "technique",
  col: "vertical",
  ville: "technique",
};

const RAPIDE = RYTHMES.indexOf("rapide");
const MIXTE = RYTHMES.indexOf("mixte");
const REGLES: ReglesSac = { n: RYTHMES.length, sel: 0x7e7a, ancien: () => RAPIDE, estAncien: (day) => generatorVersionOf(day) < GENERATOR_RYTHMES };

/**
 * Le rythme du circuit d'un jour (ou d'une graine du Salon), ou `null` pour une version d'avant les rythmes. `theme` : le thème du circuit (celui du jour par défaut ; un thème
 * imposé par un essai ou le planning donne son rythme dominant).
 */
export function rythmeDuJour(day: number, generator = generatorVersionOf(day), theme?: ThemeName): Rythme | null {
  if (generator < GENERATOR_RYTHMES) return null;
  const sac = (d: number) => themeDuSac(d, REGLES);
  const r = sac(day);
  if (r !== MIXTE) return RYTHMES[r]!;
  const dominant = RYTHMES.indexOf(RYTHME_DOMINANT[theme ?? themeForDay(day, generator).name]);
  return RYTHMES[dominant === sac(day - 1) || dominant === sac(day + 1) ? MIXTE : dominant]!;
}
