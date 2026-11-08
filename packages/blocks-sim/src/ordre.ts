import { COLONNES, LIGNES } from "./constantes";
import { compterPleines, effacer, type Grille, peutPoser, pleines, poser } from "./grille";
import type { Piece } from "./pieces";

// LES QUESTIONS DU TIRAGE ADAPTÉ (lot B8c, seed § 4), posées à une grille et à une série de pièces. Pures, entières, sans aléa : le tirage (`suite.ts`) et son rejeu par le serveur en dépendent.
//   · `piecesPosables` : combien des pièces se posent, dans le meilleur ordre et aux meilleurs endroits, en comptant les effacements entre deux poses (exigence 1 : toutes). Recherche en profondeur avec arrêt au premier succès ;
//     un état déjà exploré (grille, pièces restantes) n'est jamais refait.
//   · `completeUneLigne` : une des pièces, posée seule, efface-t-elle au moins une ligne ou une colonne (exigence 2) ?

/** La clé d'un état de la recherche : la grille (deux entiers de 32 bits) et le masque des pièces déjà posées. */
const cle = (g: Grille, masque: number): string => `${g.lo}.${g.hi}.${masque}`;

/** Le plus grand nombre de pièces de la série qu'on peut poser, dans un ordre et à des endroits à choisir. S'arrête dès que toutes sont posées. */
export function piecesPosables(grille: Grille, pieces: readonly Piece[]): number {
  const n = pieces.length;
  const vus = new Map<string, number>();
  // Le plus grand nombre de pièces qu'on pose encore depuis cet état (0 à n − posées).
  const explorer = (g: Grille, pose: number): number => {
    const restant = n - popcount(pose);
    if (restant === 0) return 0;
    const k = cle(g, pose);
    const connu = vus.get(k);
    if (connu !== undefined) return connu;
    let meilleur = 0;
    for (let i = 0; i < n && meilleur < restant; i++) {
      if (pose & (1 << i)) continue;
      const p = pieces[i]!;
      for (let ligne = 0; ligne + p.hauteur <= LIGNES && meilleur < restant; ligne++) {
        for (let col = 0; col + p.largeur <= COLONNES && meilleur < restant; col++) {
          if (!peutPoser(g, p, col, ligne)) continue;
          let apres = poser(g, p, col, ligne);
          const m = pleines(apres);
          if (compterPleines(m) > 0) apres = effacer(apres, m.lignes, m.colonnes);
          const v = 1 + explorer(apres, pose | (1 << i));
          if (v > meilleur) meilleur = v;
        }
      }
    }
    vus.set(k, meilleur);
    return meilleur;
  };
  return explorer(grille, 0);
}

function popcount(v: number): number {
  let c = 0;
  for (let x = v; x; x &= x - 1) c++;
  return c;
}

/** Les trois pièces se posent-elles toutes, dans au moins un ordre ? */
export const serieEstPosable = (grille: Grille, pieces: readonly Piece[]): boolean => piecesPosables(grille, pieces) === pieces.length;

/** Une des pièces, posée seule sur cette grille, complète-t-elle une ligne ou une colonne ? */
export function completeUneLigne(grille: Grille, pieces: readonly Piece[]): boolean {
  for (const p of pieces) {
    for (let ligne = 0; ligne + p.hauteur <= LIGNES; ligne++) {
      for (let col = 0; col + p.largeur <= COLONNES; col++) {
        if (peutPoser(grille, p, col, ligne) && compterPleines(pleines(poser(grille, p, col, ligne))) > 0) return true;
      }
    }
  }
  return false;
}
