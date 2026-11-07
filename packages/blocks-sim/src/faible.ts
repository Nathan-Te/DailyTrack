import { COLONNES, LIGNES, TAILLE_SERIE } from "./constantes";
import type { Contenu } from "./generateur";
import { compterPleines, peutPoser, pleines, poser } from "./grille";
import { actionDe, Partie, type Resultat } from "./partie";

// LE BOT FAIBLE (lot B8) — la première des trois références des médailles (`medailles.ts`) : un joueur qui ne réfléchit pas. Il prend **la pièce la plus grosse** de la série (celle qui a le plus de cases ; à égalité, l'emplacement
// le plus à gauche) parmi celles qui tiennent quelque part, et la pose **au premier endroit qui efface** une ligne ou une colonne (lignes de haut en bas, puis colonnes de gauche à droite), **sinon au plus bas à gauche** (la ligne la
// plus basse où elle tient, puis la colonne la plus à gauche). Aucun aléa, aucune recherche : il sert de repère aux médailles de bronze. Hors de l'index (`@cdj/blocks-sim/faible`), comme les autres bots.
// **Il fait partie des règles du classement** (ses scores fixent le bronze) : tout changement monte `BLOCKS_BOT_VERSION`.

export interface CoupBot {
  emplacement: number;
  col: number;
  ligne: number;
}

export function coupFaible(partie: Pick<Partie, "grille" | "pieces" | "finie">): CoupBot | null {
  if (partie.finie) return null;
  let choix: { e: number; cases: number } | null = null;
  for (let e = 0; e < TAILLE_SERIE; e++) {
    const p = partie.pieces[e];
    if (!p) continue;
    if (choix !== null && p.cases <= choix.cases) continue;
    let tient = false;
    for (let l = 0; l + p.hauteur <= LIGNES && !tient; l++) for (let c = 0; c + p.largeur <= COLONNES && !tient; c++) tient = peutPoser(partie.grille, p, c, l);
    if (tient) choix = { e, cases: p.cases };
  }
  if (choix === null) return null;
  const p = partie.pieces[choix.e]!;
  let basGauche: { col: number; ligne: number } | null = null;
  for (let ligne = 0; ligne + p.hauteur <= LIGNES; ligne++) {
    for (let col = 0; col + p.largeur <= COLONNES; col++) {
      if (!peutPoser(partie.grille, p, col, ligne)) continue;
      const m = pleines(poser(partie.grille, p, col, ligne));
      if (compterPleines(m) > 0) return { emplacement: choix.e, col, ligne };
      if (basGauche === null || ligne > basGauche.ligne || (ligne === basGauche.ligne && col < basGauche.col)) basGauche = { col, ligne };
    }
  }
  return { emplacement: choix.e, ...basGauche! };
}

/** Joue une partie entière avec le bot faible : le résultat et les actions (octets). */
export function jouerFaible(contenu: Pick<Contenu, "suite" | "depart">): { resultat: Resultat; actions: number[] } {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  while (!partie.finie) {
    const a = coupFaible(partie)!;
    partie.poser(a.emplacement, a.col, a.ligne);
    actions.push(actionDe(a.emplacement, a.col, a.ligne));
  }
  return { resultat: partie.resultat()!, actions };
}
