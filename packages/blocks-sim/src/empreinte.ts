import { PLAFOND_PIECES, TAILLE_SERIE } from "./constantes";
import type { Contenu } from "./generateur";
import { Partie } from "./partie";

// LA MARCHE D'EMPREINTE (lot B8c) : la partie de référence qui sert à dire ce qu'un contenu tire. Comme les séries dépendent de la grille, il n'y a plus de suite fixe à hacher ; on joue donc une marche sans réflexion et sans aléa — les pièces
// dans l'ordre des emplacements, chacune au premier endroit où elle tient (lignes de haut en bas, colonnes de gauche à droite) — et l'empreinte couvre les séries que le tirage donne au fil de cette marche (leurs ids de pièces). Toute
// modification du tirage, de ses exigences, de ses poids ou de la grille qu'il regarde change cette marche. Elle s'arrête à `SERIES_DE_LA_MARCHE` séries (ou plus tôt si la partie finit).

export const SERIES_DE_LA_MARCHE = 60;

/** Les ids des pièces des séries tirées pendant la marche d'empreinte, série après série. */
export function empreinteDeLaMarche(contenu: Pick<Contenu, "graine" | "depart" | "imposees" | "reglage">): number[] {
  const partie = new Partie(contenu);
  const ids: number[] = [];
  let serieVue = -1;
  while (!partie.finie && partie.serie < SERIES_DE_LA_MARCHE) {
    if (partie.serie !== serieVue) {
      serieVue = partie.serie;
      for (const p of partie.pieces) ids.push(p ? p.id : 255);
    }
    let posee = false;
    for (let e = 0; e < TAILLE_SERIE && !posee; e++) {
      const p = partie.piece(e);
      if (!p) continue;
      for (let ligne = 0; ligne + p.hauteur <= 8 && !posee; ligne++) for (let col = 0; col + p.largeur <= 8 && !posee; col++) posee = partie.poser(e, col, ligne) !== null;
    }
    if (!posee) break; // inatteignable : une partie non finie a toujours une pièce qui tient
    if (partie.poses >= PLAFOND_PIECES) break;
  }
  return ids;
}
