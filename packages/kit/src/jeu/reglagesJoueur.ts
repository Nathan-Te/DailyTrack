// Les réglages du joueur d'un jeu neuf (`<id>:reglages`) : lus en partie (animations réduites, fantôme au départ), écrits par l'écran Réglages. Jamais dans la simulation.
export interface ReglagesJoueur {
  v: 1;
  mouvement: "normal" | "reduit";
  fantome: "aucun" | "meilleure";
}
const DEFAUT: ReglagesJoueur = { v: 1, mouvement: "normal", fantome: "aucun" };
const cle = (c: { fiche: { prefixe: string } }): string => `${c.fiche.prefixe}reglages`;

export function lireReglages(c: { fiche: { prefixe: string } }, stockage: Pick<Storage, "getItem"> | null): ReglagesJoueur {
  try {
    const j = JSON.parse(stockage?.getItem(cle(c)) ?? "null") as Partial<ReglagesJoueur> | null;
    return { v: 1, mouvement: j?.mouvement === "reduit" ? "reduit" : "normal", fantome: j?.fantome === "meilleure" ? "meilleure" : "aucun" };
  } catch {
    return DEFAUT;
  }
}
export function ecrire(c: { fiche: { prefixe: string } }, stockage: Pick<Storage, "setItem"> | null, r: ReglagesJoueur): void {
  try {
    stockage?.setItem(cle(c), JSON.stringify(r));
  } catch {
    /* stockage refusé : le réglage vaut pour cette page */
  }
}

