import { BONUS_PLATEAU_VIDE, COLONNES, LIGNES, POINTS_EFFACEMENT, TAILLE_SERIE } from "./constantes";
import type { Contenu } from "./generateur";
import { compterPleines, effacer, estVide, peutPoser, pleines, poser, rangee } from "./grille";
import { evaluerGrille, POIDS_DIAMANT } from "./evaluation";
import { actionDe, Partie, type ResultatDeBot } from "./partie";

// Le BOT MOYEN (lot B8 ; le glouton du lot B1, adapté aux séries) : la deuxième des trois références des médailles. Hors de l'index (`@cdj/blocks-sim/glouton`). **Ce n'est pas le Diamant** : il ne cherche ni l'ordre des pièces ni plus
// loin que la grille juste après la pose. À chaque coup il essaie toutes les poses de toutes les pièces restantes de la série et joue la MEILLEURE POSE IMMÉDIATE : valeur = les points de la pose (cases, effacement et combo, plateau vide)
// × `POIDS_DIAMANT.point` + l'évaluation de la grille obtenue — la même fonction (`evaluerGrille`) que le Diamant, qui, lui, regarde la série entière. À valeur égale : l'emplacement le plus à gauche, puis la première position
// (lignes de haut en bas, puis colonnes de gauche à droite). Aucun aléa. (Le glouton du lot B1, avec sa propre évaluation, tenait 76 séries en médiane contre 40 pour le bot faible : sous la cible de 80 à 150 séries ; avec l'évaluation
// du Diamant, 139 : README du lot B8.) **Il fait partie des règles du classement** (ses scores fixent l'argent et l'or) : tout changement monte `BLOCKS_BOT_VERSION`.

/** La meilleure pose de la pièce de cet emplacement et sa valeur, ou null si elle ne tient nulle part. */
export function meilleurePose(partie: Pick<Partie, "grille" | "pieces" | "combo">, emplacement: number): { col: number; ligne: number; valeur: number } | null {
  const p = partie.pieces[emplacement];
  if (!p) return null;
  const rangs = new Uint8Array(LIGNES);
  let meilleur: { col: number; ligne: number; valeur: number } | null = null;
  for (let ligne = 0; ligne + p.hauteur <= LIGNES; ligne++) {
    for (let col = 0; col + p.largeur <= COLONNES; col++) {
      if (!peutPoser(partie.grille, p, col, ligne)) continue;
      let g = poser(partie.grille, p, col, ligne);
      const m = pleines(g);
      const n = compterPleines(m);
      if (n > 0) g = effacer(g, m.lignes, m.colonnes);
      for (let l = 0; l < LIGNES; l++) rangs[l] = rangee(g, l);
      const points = p.cases + (n > 0 ? POINTS_EFFACEMENT * n * n * (partie.combo + 1) + (estVide(g) ? BONUS_PLATEAU_VIDE : 0) : 0);
      const v = POIDS_DIAMANT.point * points + evaluerGrille(rangs);
      if (meilleur === null || v > meilleur.valeur) meilleur = { col, ligne, valeur: v };
    }
  }
  return meilleur;
}

/** Le coup du bot moyen : la meilleure pose immédiate, toutes pièces restantes confondues. */
export function coupGlouton(partie: Pick<Partie, "grille" | "pieces" | "finie" | "combo">): { emplacement: number; col: number; ligne: number } | null {
  if (partie.finie) return null;
  let meilleur: { emplacement: number; col: number; ligne: number; valeur: number } | null = null;
  for (let e = 0; e < TAILLE_SERIE; e++) {
    const pose = meilleurePose(partie, e);
    if (pose && (meilleur === null || pose.valeur > meilleur.valeur)) meilleur = { emplacement: e, ...pose };
  }
  return meilleur === null ? null : { emplacement: meilleur.emplacement, col: meilleur.col, ligne: meilleur.ligne };
}

/** Joue une partie avec le bot moyen : le résultat et les actions (octets). `jusqua` (lot B8b) : s'arrête après ce nombre de pièces posées (la partie, alors non finie, rend son score du moment : `raison` « arret »). */
export function jouerGlouton(contenu: Pick<Contenu, "suite" | "depart">, jusqua: number = Infinity): { resultat: ResultatDeBot; actions: number[] } {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  while (!partie.finie && partie.poses < jusqua) {
    const a = coupGlouton(partie)!;
    partie.poser(a.emplacement, a.col, a.ligne);
    actions.push(actionDe(a.emplacement, a.col, a.ligne));
  }
  return { resultat: partie.instantane(), actions };
}
