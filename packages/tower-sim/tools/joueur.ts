// Lot T2 — un joueur qui produit des fixtures et des mesures (outils seulement : ni la simulation ni le jeu ne l'importent). Ce n'est PAS le bot de l'auteur (lot T3) : pour chaque pièce il
// essaie une douzaine de placements en rejouant le début de la partie, et garde celui qui perd le moins de vies puis monte le plus haut. Il sert au golden (`references.ts`) et aux mesures
// de taille d'une rediffusion (`mesures-t2.ts`).
import { COMMANDE, Partie, type Rapier, type Reglages, REGLAGES_DEFAUT, type Scenario } from "../src";
import { etendue } from "./alignement";

export interface Choix {
  rot: number;
  dx: number;
}
export const CANDIDATS: Choix[] = [...[-3, -2, -1, 0, 1, 2, 3].map((dx) => ({ rot: 0, dx })), { rot: 1, dx: 0 }, { rot: 2, dx: 0 }, { rot: 3, dx: 0 }, { rot: 2, dx: -1 }, { rot: 2, dx: 1 }];

/** Joue les choix (un par pièce) ; s'arrête `reste` ticks après le lâcher de la pièce `jusqua`. */
export function jouer(R: Rapier, contenu: Scenario, choix: readonly Choix[], jusqua: number, reste: number, reglages: Reglages): Partie {
  const p = new Partie(R, contenu, reglages);
  let id = -1;
  let k = 0;
  let apres = -1;
  while (p.etape !== "fini") {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    if (v.posees > jusqua && ++apres >= reste) break;
    let c = 0;
    if (v.active >= 0) {
      const ch = choix[v.active] ?? { rot: 0, dx: 0 };
      if (k < ch.rot) c |= COMMANDE.TOURNER;
      else if (k >= 4 && k < 4 + 2 * Math.abs(ch.dx) && k % 2 === 0) c |= ch.dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
      if (k > 12 + 2 * Math.abs(ch.dx)) c |= COMMANDE.DESCENDRE;
      k++;
    }
    p.avancer(c);
  }
  return p;
}

/** Cherche une partie : pour chaque pièce, le placement qui perd le moins de vies puis monte le plus haut (ou, avec `bas`, reste le plus bas). */
export function chercher(R: Rapier, contenu: Scenario, reglages: Reglages, bas = false): Partie {
  const choix: Choix[] = [];
  for (let i = 0; i < contenu.pieces.length; i++) {
    let meilleur = CANDIDATS[0]!;
    let meilleurScore = -Infinity;
    for (const c of CANDIDATS) {
      const p = jouer(R, contenu, [...choix, c], i, 150, reglages);
      const v = p.vue();
      const score = -1_000_000 * v.tombees + (bas ? -v.hauteurMm : v.hauteurMm + 100_000 * v.declenches);
      p.dispose();
      if (score > meilleurScore) {
        meilleurScore = score;
        meilleur = c;
      }
    }
    choix.push(meilleur);
    const p = jouer(R, contenu, choix, i, 150, reglages);
    const fini = p.vue().vies <= 0;
    p.dispose();
    if (fini) break;
  }
  return jouer(R, contenu, choix, 10_000, 0, reglages);
}

/** La partie qui perd ses trois vies : chaque pièce part à l'extrême droite de la plateforme et tombe à la mer. */
export function perdreTout(R: Rapier, contenu: Scenario): Partie {
  const p = new Partie(R, contenu);
  let k = 0;
  let id = -1;
  while (p.etape !== "fini") {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    p.avancer((k < 40 ? COMMANDE.DROITE : 0) | (k > 45 ? COMMANDE.DESCENDRE : 0));
    k++;
  }
  return p;
}


/**
 * Lot T8 — la partie de référence du taquet (`?scenario=emboitement`) : le carré 0 est posé à gauche du bâton couché puis poussé deux fois vers la droite dans la niche (taquet après le lâcher), le
 * bâton 1 est mené debout dans le trou rétréci (tolérance d'emboîtement), les autres tombent au centre. Des commandes scriptées (réactives), pas une recherche : de quoi produire un golden qui
 * contient les deux bits du taquet.
 */
export function joueurEmboitement(R: Rapier, contenu: Scenario): Partie {
  const p = new Partie(R, contenu, REGLAGES_DEFAUT);
  const base = contenu.depart?.length ?? 0; // la tour de départ occupe les premiers numéros de pièce
  let id = -1;
  let k = 0;
  let lacheDepuis = -1;
  let tournes = 0;
  const bord8 = (q: { kind: Scenario["pieces"][number]; rot: number; x: number; angle: number }): number => etendue(q.kind, q.rot, { x: q.x, y: 0, angle: q.angle }).gauche * 8;
  for (let t = 0; t < 20000 && p.etape !== "fini"; t++) {
    const v = p.vue();
    if (v.active !== id) {
      if (id === base) lacheDepuis = 0;
      id = v.active;
      k = 0;
      tournes = 0;
    }
    let m = 0;
    if (lacheDepuis >= 0) {
      lacheDepuis++;
      // la pièce 0 vient d'être lâchée : deux poussées vers la droite, à 3 et 8 ticks
      if (lacheDepuis === 3 || lacheDepuis === 8) m |= COMMANDE.TAQUET_DROITE;
      if (lacheDepuis > 12) lacheDepuis = -2;
    }
    if (v.active >= 0) {
      const q = v.pieces[v.active]!;
      const n = id - base;
      const cible8 = n === 0 ? -24 : n === 1 ? 40 : 0;
      if (n === 1 && tournes < 3 && k % 6 === 1) {
        m |= COMMANDE.TOURNER;
        tournes++;
      } else if (n <= 1 && (n === 0 || tournes >= 3)) {
        const ecart = cible8 - bord8(q);
        if (ecart > 2) m |= COMMANDE.DROITE;
        else if (ecart < -2) m |= COMMANDE.GAUCHE;
        else if (k > 30) m |= COMMANDE.DESCENDRE;
      } else if (k > 30) m |= COMMANDE.DESCENDRE;
      k++;
    }
    p.avancer(m);
  }
  return p;
}
