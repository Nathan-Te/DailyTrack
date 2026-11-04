import { casesOccupees, COLONNES, compterPleines, effacer, estVide, type Grille, LIGNES, peutPoser, Partie, pleines, poser, rangee, type Contenu, type Resultat } from "./index";

// Le bot GLOUTON SIMPLE des tests et de la mesure de la rampe (lot B1). Hors de l'index (`@cdj/blocks-sim/glouton`). **Ce n'est pas le Diamant** (le bot de l'auteur, lot B3, regarde aussi la pièce suivante) : il joue la position qui laisse la meilleure
// grille après la pose, sans regarder plus loin. Évaluation : les points de la pose (effacement surtout), moins un malus par case vide isolée ou à demi enfermée, moins un petit malus par case occupée.

/** Les voisins occupés d'une case vide (les bords comptent). */
function enfermement(g: Grille): number {
  let m = 0;
  for (let l = 0; l < LIGNES; l++) {
    const o = rangee(g, l);
    for (let c = 0; c < COLONNES; c++) {
      if (o & (1 << c)) continue;
      const pris = (c === 0 || (o & (1 << (c - 1))) !== 0 ? 1 : 0) + (c === COLONNES - 1 || (o & (1 << (c + 1))) !== 0 ? 1 : 0) + (l === 0 || (rangee(g, l - 1) & (1 << c)) !== 0 ? 1 : 0) + (l === LIGNES - 1 || (rangee(g, l + 1) & (1 << c)) !== 0 ? 1 : 0);
      if (pris >= 3) m += pris === 4 ? 4 : 1;
    }
  }
  return m;
}

/** Le périmètre : les côtés entre une case occupée et une case vide (le bord de la grille compte comme occupé). Plus il est petit, plus la grille est compacte. */
function perimetre(g: Grille): number {
  let m = 0;
  for (let l = 0; l < LIGNES; l++) {
    const o = rangee(g, l);
    for (let c = 0; c < COLONNES; c++) {
      const vide = (o & (1 << c)) === 0;
      const droite = c === COLONNES - 1 ? false : (o & (1 << (c + 1))) === 0;
      const bas = l === LIGNES - 1 ? false : (rangee(g, l + 1) & (1 << c)) === 0;
      if (c < COLONNES - 1 && vide !== droite) m++;
      if (l < LIGNES - 1 && vide !== bas) m++;
    }
  }
  return m;
}

/** La meilleure pose (col, ligne) de la pièce du moment, ou null. Sans aléa : à valeur égale, la première (lignes puis colonnes). */
export function meilleurePose(partie: Partie): { col: number; ligne: number } | null {
  const p = partie.piece;
  if (!p) return null;
  let meilleur: { col: number; ligne: number } | null = null;
  let valeur = -Infinity;
  for (let ligne = 0; ligne + p.hauteur <= LIGNES; ligne++) {
    for (let col = 0; col + p.largeur <= COLONNES; col++) {
      if (!peutPoser(partie.grille, p, col, ligne)) continue;
      let g = poser(partie.grille, p, col, ligne);
      const m = pleines(g);
      const n = compterPleines(m);
      if (n > 0) g = effacer(g, m.lignes, m.colonnes);
      const v = n * n * 100 + (estVide(g) ? 500 : 0) - enfermement(g) * 12 - perimetre(g) * 3 - casesOccupees(g);
      if (v > valeur) {
        valeur = v;
        meilleur = { col, ligne };
      }
    }
  }
  return meilleur;
}

/** Joue une partie entière avec le glouton : le résultat et les actions (octets). */
export function jouerGlouton(contenu: Pick<Contenu, "suite" | "depart">): { resultat: Resultat; actions: number[] } {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  while (!partie.finie) {
    const a = meilleurePose(partie)!;
    partie.poser(a.col, a.ligne);
    actions.push(a.ligne * COLONNES + a.col);
  }
  return { resultat: partie.resultat()!, actions };
}
