// Lot F1 — « Mes jeux » sur l'accueil du portail : la répartition pure des cartouches (mes jeux en cartouches pleines, les autres en compactes) et ce que dit la ligne de
// l'accueil. Pur et sans DOM : testé dans `test/mesJeux.test.ts`. L'ordre est celui de la plateforme (celui des cartouches montrées), jamais un ordre choisi.

export interface Repartition<T> {
  /** Aucun favori parmi les jeux montrés : l'accueil est celui d'avant, tous les jeux en cartouches pleines (et la ligne qui invite à épingler). */
  sansFavori: boolean;
  /** « Mes jeux » (ou, sans favori, tous les jeux). */
  mes: T[];
  /** « Les autres jeux » (vide sans favori, ou quand tous les jeux sont épinglés). */
  autres: T[];
}

/**
 * Répartit les jeux montrés (ceux que le serveur liste, donc `on`) selon la liste de favoris. Un favori qui n'est pas montré (un jeu repassé à `off`) disparaît sans message : il n'est
 * pas dans les cartouches, et il revient avec le jeu (le serveur le garde). Aucun favori montré : l'accueil sans favori.
 */
export function repartir<T extends { code: string }>(montrees: readonly T[], favoris: readonly string[]): Repartition<T> {
  const mes = montrees.filter((c) => favoris.includes(c.code));
  if (mes.length === 0) return { sansFavori: true, mes: [...montrees], autres: [] };
  return { sansFavori: false, mes, autres: montrees.filter((c) => !favoris.includes(c.code)) };
}

/**
 * Faut-il dire que le choix compte à partir de demain ? Oui quand les jeux épinglés qui comptent aujourd'hui ne sont pas ceux de la journée du joueur (il vient de changer sa liste).
 * `comptentAujourdhui` : les dossiers des jeux montrés qui comptent dans la journée ; `jeuxDuJour` : ceux de la journée du joueur (absent : le serveur ne le dit pas, rien à signaler).
 */
export function choixPourDemain(favoris: readonly string[], comptentAujourdhui: readonly string[], jeuxDuJour: readonly string[] | undefined): boolean {
  if (!jeuxDuJour || jeuxDuJour.length === 0) return false;
  const attendus = comptentAujourdhui.filter((j) => favoris.includes(j));
  const voulus = attendus.length > 0 ? attendus : [...comptentAujourdhui];
  const reels = jeuxDuJour.filter((j) => comptentAujourdhui.includes(j));
  return voulus.length !== reels.length || voulus.some((j) => !reels.includes(j));
}

/**
 * Lot A3 : les jeux d'arcade dans leur section — **les favoris d'abord**, puis les autres, chaque groupe dans l'ordre de la plateforme. Les favoris d'arcade ne changent jamais « Mes jeux »
 * de la journée (un jeu d'arcade n'y compte pas).
 */
export function ordonnerArcade<T extends { code: string }>(arcade: readonly T[], favoris: readonly string[]): T[] {
  return [...arcade.filter((c) => favoris.includes(c.code)), ...arcade.filter((c) => !favoris.includes(c.code))];
}
