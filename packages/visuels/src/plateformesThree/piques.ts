import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";
import { HAZARD_OUTLINE, PIQUE, trianglesDePiques, type Grille, type SensPique } from "../plateformes";

// Les piques d'une grille avec leur cerne (lot PG1, repris du jeu d'origine sans changement) : un triangle franc par case, rouge (`couleur`, la palette du jeu : `HAZARD` par défaut ailleurs), cerné de sombre (`HAZARD_OUTLINE`), le cerne
// derrière lui (`PIQUE.zCerne` contre `PIQUE.z`). Deux maillages, un par couleur, jamais un par case. Le jeu dit ce que sont ses cases (`sensDe`) ; le dessin ne lit rien d'autre que la grille.

/** Les triangles des piques d'une grille, en géométrie Three.js (`grow` > 0 : le cerne). */
export function geometrieDePiques(grille: Grille, sensDe: (t: number) => SensPique | null, grow = 0): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(trianglesDePiques(grille, sensDe, grow), 3));
  return g;
}

export interface Piques {
  /** Le groupe à ajouter au monde : le cerne puis les piques, profondeurs de `PIQUE`. */
  groupe: Group;
  piques: Mesh;
  cerne: Mesh;
}

/** Les piques et leur cerne d'une grille (`couleur` : le rouge des dangers de la palette du jeu). */
export function creerPiques(grille: Grille, sensDe: (t: number) => SensPique | null, couleur: number): Piques {
  const piques = new Mesh(geometrieDePiques(grille, sensDe), new MeshBasicMaterial({ color: couleur }));
  piques.position.z = PIQUE.z;
  const cerne = new Mesh(geometrieDePiques(grille, sensDe, PIQUE.cerne), new MeshBasicMaterial({ color: HAZARD_OUTLINE }));
  cerne.position.z = PIQUE.zCerne;
  const groupe = new Group();
  groupe.add(piques, cerne);
  return { groupe, piques, cerne };
}
