import type { Resultat } from "./partie";

// Comment « Pile poil » se classe (la fiche, `classement.colonnes`) : le score (↓), puis les « pile » (↓), puis le premier envoyé. Le seul endroit qui le sait, avec la fiche (`test/classement.test.ts` les compare).
export const COLONNES_CLASSEMENT = [
  { nom: "score", sens: "desc" },
  { nom: "piles", sens: "desc" },
] as const;

/** Le score d'un résultat : les colonnes de classement, dans l'ordre de la fiche. */
export const scoreDe = (r: Pick<Resultat, "score" | "piles">): number[] => [r.score, r.piles];

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export const scoreParColonnes = (r: Pick<Resultat, "score" | "piles">): Record<string, number> => ({ score: r.score, piles: r.piles });
