import { formatScore, formatTemps, type Langue } from "@cdj/ui";
import type { SensClassement } from "@cdj/ui/src/classementLogique";
import type { Classement, LigneClassement } from "./classementDonnees";

// Lot U6 — ce que dit chaque ligne d'un classement : son écart au premier, l'avance du premier. Pur — sans DOM, sans réseau, sans stockage — et dans le premier chargement de `/classement/` ; « Ta course » (`classementCourse.ts`) est à la demande.
// Testé dans `test/classementCourse.test.ts`.

/** Comment s'écrit la valeur d'une vue : au temps, à la hauteur, ou en points (`formatDeVue`). */
export type FormatDeVue = "temps" | "hauteur" | "entier";

/** La valeur d'une ligne dans la vue : son temps, ou son score à la hauteur ; `null` : pas de résultat (au cumul, un joueur qui n'a pas tout fini). */
export const valeurDeLigne = (l: Pick<LigneClassement, "score" | "tempsMs">): number | null => (l.score ? l.score.valeur : l.tempsMs);

/** Le plus petit gagne (un temps) ou le plus grand (une hauteur, des points) : dit par la vue (`unite` dans la vue d'un jeu qui n'est pas au chrono). */
export const sensDeLaVue = (c: Pick<Classement, "unite">): SensClassement => (c.unite ? "grand" : "petit");

/** L'écart de deux valeurs, écrit : un temps sans l'unité de fin (« 0,185 » : l'unité est dite plus haut), sinon la valeur de la vue. `signe` : ce qui précède (« + » pour un temps de plus, « - » pour une hauteur de moins). */
export function ecritEcart(format: FormatDeVue, ecart: number, langue: Langue): string {
  return format === "temps" ? `+${formatTemps(ecart, langue).replace(/ s$/u, "")}` : `-${formatScore(format, ecart, langue)}`;
}
/** L'écart écrit avec son unité (« 0,185 s ») : l'avance du premier, l'écart dans « Ta course ». */
export const ecritDuree = (format: FormatDeVue, ecart: number, langue: Langue): string => formatScore(format, ecart, langue);

/** L'écart d'une ligne au premier (« +0,185 ») ; `null` pour le premier lui-même et pour qui n'a pas de résultat. */
export function ecartAuPremier(c: Pick<Classement, "unite">, l: LigneClassement, premier: LigneClassement | undefined, format: FormatDeVue, langue: Langue): string | null {
  const v = valeurDeLigne(l);
  const p = premier ? valeurDeLigne(premier) : null;
  if (v === null || p === null || l === premier) return null;
  const ecart = Math.abs(v - p);
  return ecart === 0 ? null : ecritEcart(format, ecart, langue);
}

/** L'avance du premier sur le deuxième, avec son unité (« 0,185 s ») ; `null` sans deuxième ou à égalité. */
export function avanceDuPremier(premier: LigneClassement | undefined, deuxieme: LigneClassement | undefined, format: FormatDeVue, langue: Langue): string | null {
  const a = premier ? valeurDeLigne(premier) : null;
  const b = deuxieme ? valeurDeLigne(deuxieme) : null;
  if (a === null || b === null || a === b) return null;
  return ecritDuree(format, Math.abs(b - a), langue);
}

