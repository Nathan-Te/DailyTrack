// Lot U3 (charte rév. 19, § 9) — la logique pure de la page « Profil » : les médailles de tous les jeux (la somme de celles de chaque jeu) et le rangement des jeux (ceux du jour d'abord, puis l'arcade).
// Sans DOM ni réseau, testée dans `test/profilDonnees.test.ts`. Rien n'est inventé : la « meilleure série » vient du serveur (lot U4, `meilleureSerie`), les dates de début, il ne les donne pas : la page ne les montre pas.

export type CleMedaille = "author" | "gold" | "silver" | "bronze";
export const CLES_MEDAILLES: readonly CleMedaille[] = ["author", "gold", "silver", "bronze"];

/** Les médailles d'un jeu telles que le serveur les rend (une clé absente vaut zéro). */
export type Medailles = Partial<Record<CleMedaille, number>>;

/** Les médailles de tous les jeux : la somme, type par type. */
export function medaillesTotales(jeux: readonly { medailles: Medailles }[]): Record<CleMedaille, number> {
  const somme: Record<CleMedaille, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
  for (const j of jeux) for (const k of CLES_MEDAILLES) somme[k] += Math.max(0, Math.floor(j.medailles[k] ?? 0));
  return somme;
}

/** Les jeux en deux groupes, dans l'ordre où le serveur les rend : ceux du jour d'abord, puis l'arcade. `categorie` dit la catégorie d'un jeu (sa fiche, ou ce que le serveur a dit). */
export function rangerLesJeux<J extends { jeu: string }>(jeux: readonly J[], categorie: (jeu: J) => "jour" | "arcade"): { jour: J[]; arcade: J[] } {
  const jour: J[] = [];
  const arcade: J[] = [];
  for (const j of jeux) (categorie(j) === "arcade" ? arcade : jour).push(j);
  return { jour, arcade };
}
