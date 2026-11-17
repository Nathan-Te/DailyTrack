import type { Partie } from "@cdj/pinball-sim";
import { geoAiguillage, type Intention } from "./deblocages";
import type { FlecheAuSol } from "./dessin";

// Les flèches qui disent quoi viser maintenant (lot PBL1) : comme les flèches lumineuses peintes au sol des vrais flippers. Les flèches sont **toutes au sol, éteintes et discrètes par défaut** (`flechesAuSol`, cuites dans
// le sol) ; ce fichier dit **lesquelles s'allument et clignotent selon le moment**, dans **la couleur de leur intention** (`COULEURS_INTENTION`, la même dans tous les thèmes) :
//   • jackpot — pendant la multibille : l'élément du thème (et la rampe dont l'aiguillage y mène) ;
//   • verrou — verrou allumé : le verrou, et la rampe dont l'aiguillage y mène ;
//   • mission — la porte quand elle est ouverte (elle fait avancer la mission) ; l'élément de la mission tant qu'elle n'est pas réussie ;
//   • combo — un combo en cours : l'autre rampe ou l'orbite, celle qu'on ne vient pas de faire.
// **Pas plus de `MAX_FLECHES_VIVES` flèches vives à la fois** : la liste est classée par priorité (jackpot, verrou, porte, mission, combo) et coupée à trois. Rien ici ne décide quoi que ce soit : ce fichier lit la partie, comme
// `deblocages.ts`, et les deux rendus (three.js et à plat) lisent la même liste.

export const MAX_FLECHES_VIVES = 3;

/** Une flèche allumée : laquelle (`fleche.id`) et pour quelle intention. */
export interface Allumee {
  fleche: FlecheAuSol;
  intention: Intention;
}

/** Ce que la partie demande de viser maintenant, du plus important au moins important, **trois flèches au plus**. `dernierRail` : le rail que le joueur vient de réussir (−1 : aucun), pour le combo. Fonction pure. */
export function indiquer(partie: Pick<Partie, "table" | "multibille" | "verrouAllume" | "missionFaite" | "passageOuvert" | "passageServi" | "aiguillageVers" | "combo" | "comboFin" | "tick">, sol: readonly FlecheAuSol[], dernierRail: number): Allumee[] {
  const sortie: Allumee[] = [];
  const vues = new Set<string>();
  const ajouter = (f: FlecheAuSol, intention: Intention): void => {
    if (vues.has(f.id)) return;
    vues.add(f.id);
    sortie.push({ fleche: f, intention });
  };
  const elements = sol.filter((f) => f.cible === "element");
  const porteOuverte = partie.passageOuvert > 0 && !partie.passageServi;
  const aig = geoAiguillage(partie.table);
  const delAiguillage = (): FlecheAuSol[] => (aig ? sol.filter((f) => f.cible === "rail" && f.rang === aig.rail) : []);
  if (partie.multibille) {
    // le jackpot : l'élément du thème, puis la porte (un jackpot de plus), puis la rampe qui y mène
    for (const f of elements) ajouter(f, "jackpot");
    if (porteOuverte) for (const f of sol) if (f.cible === "porte") ajouter(f, "jackpot");
    if (partie.aiguillageVers === 2) for (const f of delAiguillage()) ajouter(f, "jackpot");
  } else {
    if (partie.verrouAllume) {
      for (const f of sol) if (f.cible === "verrou") ajouter(f, "verrou");
      if (partie.aiguillageVers === 1) for (const f of delAiguillage()) ajouter(f, "verrou");
    }
    if (porteOuverte) for (const f of sol) if (f.cible === "porte") ajouter(f, "mission");
    if (!partie.missionFaite) for (const f of elements) ajouter(f, "mission");
  }
  // un combo en cours : les rails qu'on ne vient pas de faire
  if (partie.combo >= 1 && partie.tick <= partie.comboFin) for (const f of sol) if (f.cible === "rail" && f.rang !== dernierRail) ajouter(f, "combo");
  return sortie.slice(0, MAX_FLECHES_VIVES);
}

/** Le suivi d'une partie : retient le dernier rail réussi (les rails faits ne sont comptés que par la partie : on regarde lequel a augmenté) et rend la liste des flèches allumées. Une instance par rendu ; rien n'est alloué par image que la liste. */
export interface Indications {
  /** Les flèches au sol de la table (les mêmes que celles que le sol peint éteintes). */
  readonly sol: readonly FlecheAuSol[];
  /** Les flèches allumées à l'état courant de la partie. */
  maj(): readonly Allumee[];
}
/** `sol` : les flèches au sol de la table (`flechesAuSol(table, theme)`). */
export function creerIndications(partie: Partie, sol: readonly FlecheAuSol[]): Indications {
  let faits = partie.railsFaits.slice();
  let dernier = -1;
  let combo = partie.combo;
  return {
    sol,
    maj(): readonly Allumee[] {
      for (let k = 0; k < faits.length; k++) {
        if ((partie.railsFaits[k] ?? 0) > (faits[k] ?? 0)) dernier = k;
        faits[k] = partie.railsFaits[k] ?? 0;
      }
      // le combo retombé à zéro (bille perdue) : plus de dernier rail
      if (partie.combo === 0 && combo !== 0) dernier = -1;
      combo = partie.combo;
      if (faits.length !== partie.railsFaits.length) faits = partie.railsFaits.slice();
      return indiquer(partie, sol, dernier);
    },
  };
}
