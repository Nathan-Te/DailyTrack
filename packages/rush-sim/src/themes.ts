import { daysFromCivil, mixSeed } from "@cdj/core";

// Les trois thèmes de Rush (lot BR1), **purement visuels** : la palette du sol, la couleur des murs bas et quelques éléments de décor. Aucune mécanique par thème (à décider plus tard). Les anciens `clair` et `sombre` sont retirés.
// Le thème du jour vient du numéro de jour, sans état : par tranches de trois jours, les trois thèmes passent chacun une fois (une rotation de la liste décalée de `decalage(k)`), et le décalage ne
// grandit que de 0 ou 1 d'une tranche à la suivante : **jamais deux jours de suite le même thème**, jonction des tranches comprise (le dernier d'une tranche est `2 + s`, le premier de la suivante `s` ou `s + 1`).
export const THEMES_RUSH = ["prairie", "carriere", "sous-bois"] as const;
export type ThemeRush = (typeof THEMES_RUSH)[number];

const PREMIER = daysFromCivil(2026, 11, 2);
const SEL_THEME = 0x7a31;

/** Le décalage de la tranche `k` : la somme des pas (0 ou 1) tirés des tranches d'avant. Avant le premier jour : 0. */
function decalage(k: number): number {
  let s = 0;
  for (let i = 0; i < k; i++) s += mixSeed(i, SEL_THEME) & 1;
  return s;
}

export function themeDuJour(jour: number): ThemeRush {
  const n = jour - PREMIER;
  const k = Math.floor(n / 3);
  const r = ((n % 3) + 3) % 3;
  return THEMES_RUSH[(r + decalage(Math.max(0, k))) % 3]!;
}
