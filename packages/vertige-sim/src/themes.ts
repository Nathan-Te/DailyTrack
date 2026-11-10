// Les deux thèmes de Vertige (provisoires : le style visuel se choisit sur le prototype). Le sac de thèmes commun (`@cdj/core`) exige au moins cinq thèmes pour que la jonction de deux cycles ait toujours
// une solution ; avec deux thèmes la seule règle « jamais deux jours de suite le même » est l'alternance stricte, que donne la parité du numéro de jour.
export const THEMES_VERTIGE = ["clair", "sombre"] as const;
export type ThemeVertige = (typeof THEMES_VERTIGE)[number];

export const themeDuJour = (jour: number): ThemeVertige => THEMES_VERTIGE[((jour % 2) + 2) % 2]!;
