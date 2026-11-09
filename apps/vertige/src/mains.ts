import * as THREE from "three";
import type { Habillage } from "./rendu";

// Les mains de la vue à la première personne : deux gants et quatre doigts chacune, des boîtes (aucun asset), fixées à la caméra. Elles balancent à la course, se lèvent en l'air et reculent au dash.
export interface Mains {
  groupe: THREE.Group;
  /** Un pas de l'animation : `sol` (au sol), `vitesse` (m/s horizontaux), `dash` (le dash est en cours), `t` (secondes). */
  animer(t: number, sol: boolean, vitesse: number, dash: boolean): void;
}

export function creerMains(hab: Habillage, parent: THREE.Group): Mains {
  const main = (cote: number): THREE.Group => {
    const g = new THREE.Group();
    const paume = hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.12)), "gant");
    g.add(paume);
    const manche = hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.16)), "gant");
    manche.position.set(0, -0.01, 0.13);
    g.add(manche);
    for (let i = 0; i < 4; i++) {
      const d = hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.07)), "peau");
      d.position.set(-0.036 + i * 0.024, 0.002, -0.085);
      d.rotation.x = -0.25;
      g.add(d);
    }
    const pouce = hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.024, 0.06)), "peau");
    pouce.position.set(-0.06 * cote, 0, -0.02);
    pouce.rotation.y = 0.6 * cote;
    g.add(pouce);
    g.position.set(0.27 * cote, -0.27, -0.42);
    g.rotation.set(0.5, -0.45 * cote, 0.25 * cote);
    g.scale.setScalar(0.72);
    parent.add(g);
    return g;
  };
  const gauche = main(-1);
  const droite = main(1);
  return {
    groupe: parent,
    animer(t, sol, vitesse, dash) {
      const bal = sol ? Math.sin(t * 11) * Math.min(1, vitesse / 9) : 0;
      const leve = sol ? 0 : 0.03;
      gauche.position.y = -0.27 + bal * 0.012 + leve;
      droite.position.y = -0.27 - bal * 0.012 + leve;
      parent.position.z = dash ? -0.06 : 0;
    },
  };
}
