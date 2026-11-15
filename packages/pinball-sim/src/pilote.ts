import { AXE, DROITE, GAUCHE, LANCEUR, UNITE, type Controle } from "./constantes";
import type { Contenu } from "./generateur";
import { Partie } from "./partie";
import type { Evenement } from "./rediffusion";
import { REGLAGES, type Reglages } from "./reglages";

// Le pilote d'essai (lot PB1) : **le robot de la maquette** (`robotJoue`), porté en entiers. Il ne sert qu'aux tests, au golden, aux mesures et aux essais du serveur — jamais à un classement ni aux médailles (le
// vrai robot, qui valide les tables et donne les seuils, est du lot PB4). Il lance quand la charge atteint 85 %, puis frappe un batteur 96 pas (0,16 s) dès que la bille arrive sur son bout, jamais quand elle repose près
// de l'axe. Pur : il ne lit que la partie et ne produit que des événements de commande, comme un joueur.
const PRESSE = 96;

export interface Pilote {
  evenements: Evenement[];
  partie: Partie;
}

/** Joue `maxTicks` pas (ou jusqu'à la fin) ; `retard` décale le premier appui du lanceur (une partie différente, mêmes réflexes). */
export function piloter(contenu: Contenu, maxTicks: number, retard = 0, reglages: Reglages = REGLAGES): Pilote {
  const partie = new Partie(contenu, reglages);
  const evenements: Evenement[] = [];
  const minuteur = [0, 0];
  const regler = (c: Controle, enfonce: boolean): void => {
    if (partie.tenue(c) === enfonce) return;
    partie.regler(c, enfonce);
    evenements.push({ tick: partie.tick, c, enfonce });
  };
  while (!partie.finie && partie.tick < maxTicks) {
    minuteur[0]!--;
    minuteur[1]!--;
    if (partie.dansLanceur) regler(LANCEUR, partie.tick >= retard && partie.charge < 850);
    else {
      regler(LANCEUR, false);
      const x = partie.x;
      const y = partie.y;
      if (y > 590 * UNITE && y < 665 * UNITE && partie.vy > -50 * UNITE) {
        if (x > 126 * UNITE && x < (AXE + 6) * UNITE) minuteur[0] = PRESSE;
        if (x < (2 * AXE - 126) * UNITE && x > (AXE - 6) * UNITE) minuteur[1] = PRESSE;
      }
    }
    regler(GAUCHE, minuteur[0]! > 0);
    regler(DROITE, minuteur[1]! > 0);
    partie.avancer();
  }
  return { evenements, partie };
}
