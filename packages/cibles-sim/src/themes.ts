// Les deux thèmes de Cibles. Le sac de thèmes commun (`@cdj/core`, lot V1) exige au moins cinq thèmes pour que la jonction de deux cycles ait toujours une solution ; avec deux thèmes la seule
// règle « jamais deux jours de suite le même » est l'alternance stricte, que donne la parité du numéro de jour.
export const THEMES_CIBLES = ["sable", "ardoise"] as const;
export type ThemeCibles = (typeof THEMES_CIBLES)[number];

export const themeDuJour = (jour: number): ThemeCibles => THEMES_CIBLES[((jour % 2) + 2) % 2]!;
