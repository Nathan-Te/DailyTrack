// Lot T2 — un joueur qui produit des fixtures et des mesures (outils seulement : ni la simulation ni le jeu ne l'importent). Ce n'est PAS le bot de l'auteur (lot T3) : pour chaque pièce il
// essaie une douzaine de placements en rejouant le début de la partie, et garde celui qui perd le moins de vies puis monte le plus haut. Il sert au golden (`references.ts`) et aux mesures
// de taille d'une rediffusion (`mesures-t2.ts`).
import { COMMANDE, Partie, type Rapier, type Reglages, type Scenario } from "../src";

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

