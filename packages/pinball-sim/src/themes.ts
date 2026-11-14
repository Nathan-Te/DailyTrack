// Les deux thèmes de Pinball. Le sac de thèmes commun (`@cdj/core`, lot V1) exige au moins cinq thèmes pour que la jonction de deux cycles ait toujours une solution ; avec deux thèmes la seule
// règle « jamais deux jours de suite le même » est l'alternance stricte, que donne la parité du numéro de jour.
export const THEMES_PINBALL = ["clair", "sombre"] as const;
export type ThemePinball = (typeof THEMES_PINBALL)[number];

export const themeDuJour = (jour: number): ThemePinball => THEMES_PINBALL[((jour % 2) + 2) % 2]!;
