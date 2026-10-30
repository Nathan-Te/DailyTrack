// Lot T2 — les paliers de Tower : tous les 10 m de hauteur stable, un bonus ou un malus du jour (docs/tower/seed.md § 3). Ce fichier ne contient que des données et des
// règles de tirage ; l'application des effets est dans `partie.ts`.

/** Les six effets du premier jalon. */
export const EFFETS = ["lierre", "figee", "petite", "geante", "vent", "glissante"] as const;
export type Effet = (typeof EFFETS)[number];

/** Bonus : lierre, pièce figée, petite pièce. Malus : pièce géante, coup de vent, pièce glissante. */
export const estBonus = (e: Effet): boolean => e === "lierre" || e === "figee" || e === "petite";

/** Le nombre de pièces que couvre un effet : le coup de vent dure trois pièces, les autres une. */
export const DUREE_EFFET: Readonly<Record<Effet, number>> = { lierre: 1, figee: 1, petite: 1, geante: 1, vent: 3, glissante: 1 };

/** Un palier : à `metres` mètres de hauteur stable, `effet` se déclenche. */
export interface Palier {
  metres: number;
  effet: Effet;
}

/** Un palier tous les 10 m, de 10 m à 60 m : six paliers, donc les six effets exactement une fois chacun. */
export const PALIERS_METRES: readonly number[] = [10, 20, 30, 40, 50, 60];

/** La taille d'une pièce : demi-taille (petite pièce), taille normale, double taille (pièce géante). */
export type Taille = "petite" | "normale" | "geante";

/**
 * Les règles de tirage d'une suite d'effets : le premier palier est un bonus, jamais deux malus de suite, jamais deux fois le même effet avant que les six soient passés.
 * Rend `null` si la suite les respecte, sinon la règle enfreinte.
 */
export function problemePaliers(effets: readonly Effet[]): string | null {
  for (let i = 0; i < effets.length; i++) {
    const e = effets[i]!;
    if (i === 0 && !estBonus(e)) return "le premier palier doit être un bonus";
    if (i > 0 && !estBonus(e) && !estBonus(effets[i - 1]!)) return `deux malus de suite au palier ${i + 1}`;
    const cycle = Math.floor(i / EFFETS.length) * EFFETS.length;
    for (let j = cycle; j < i; j++) if (effets[j] === e) return `l'effet « ${e} » revient avant que les six soient passés (palier ${i + 1})`;
  }
  return null;
}
