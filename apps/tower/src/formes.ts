import { CircleGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

// Les formes de base de la scène (lots T1 et T5) : un rectangle et un disque en aplat. Les matières sont partagées par couleur (aucun dégradé, aucune texture).
const plan = new PlaneGeometry(1, 1);
const disque = new CircleGeometry(1, 20);
const matieres = new Map<string, MeshBasicMaterial>();
export function matiere(couleur: string): MeshBasicMaterial {
  let m = matieres.get(couleur);
  if (!m) matieres.set(couleur, (m = new MeshBasicMaterial({ color: new Color(couleur) })));
  return m;
}

export function rect(couleur: string, x: number, y: number, w: number, h: number, z: number): Mesh {
  const m = new Mesh(plan, matiere(couleur));
  m.position.set(x, y, z);
  m.scale.set(w, h, 1);
  return m;
}

export function cercle(couleur: string, x: number, y: number, r: number, z: number): Mesh {
  const m = new Mesh(disque, matiere(couleur));
  m.position.set(x, y, z);
  m.scale.set(r, r, 1);
  return m;
}
