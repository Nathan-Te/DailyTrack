// Lot F1 — « Mes jeux » sur l'accueil du portail : l'ordre pur des cartouches (lot U1 : les jeux épinglés en tête de leur zone) et ce que dit la ligne de
// l'accueil. Pur et sans DOM : testé dans `test/mesJeux.test.ts`. L'ordre est celui de la plateforme (celui des cartouches montrées), jamais un ordre choisi.

/**
 * Lot U1 (charte rév. 19) : plus de section « Mes jeux » à part — **un jeu épinglé passe en tête de sa zone** (les jeux du jour, ou la salle d'arcade), chaque groupe dans l'ordre de la plateforme.
 * Un favori qui n'est pas montré (un jeu repassé à `off`) disparaît sans message : il revient avec le jeu (le serveur le garde). Sans favori, l'ordre est celui de la plateforme.
 */
export function epinglesEnTete<T extends { code: string }>(zone: readonly T[], favoris: readonly string[]): T[] {
  return [...zone.filter((c) => favoris.includes(c.code)), ...zone.filter((c) => !favoris.includes(c.code))];
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
