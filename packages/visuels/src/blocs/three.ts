import { CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { ENCRE, PAPIER } from "./couleurs";
import type { Expression } from "./expression";
import type { CoucheRelief } from "./relief";
import { COTES_DISQUE, disposerYeux, PROFONDEUR_OEIL } from "./yeux";

// Le dessinateur THREE.JS des blocs : celui de Tower (caméra orthographique, y vers le haut, un mètre = une unité). Il lit la description (`relief.ts`, `yeux.ts`) et la pose en maillages ; il ne décide de rien.
// Les formes de base (lots T1 et T5 de Tower, `formes.ts` avant le lot DA1) sont ici : un rectangle et un disque en aplat, les matières partagées par couleur (aucun dégradé, aucune texture).
// **À la demande** : `three` n'est chargé que par un jeu qui dessine une scène (Tower : avec le jeu, jamais avec l'accueil).
const plan = new PlaneGeometry(1, 1);
const disque = new CircleGeometry(1, COTES_DISQUE);
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

/** Lot T6 de Tower : une matière translucide (la visée : discrète, on voit la scène à travers). Partagée par couleur et opacité. */
const translucides = new Map<string, MeshBasicMaterial>();
export function matiereTransparente(couleur: string, opacite: number): MeshBasicMaterial {
  const cle = `${couleur}/${opacite}`;
  let m = translucides.get(cle);
  if (!m) translucides.set(cle, (m = new MeshBasicMaterial({ color: new Color(couleur), transparent: true, opacity: opacite, depthWrite: false })));
  return m;
}

/** Pose les couches d'une pièce (`decrirePiece`) dans un groupe : un rectangle par rect, à la profondeur de sa couche, dans l'ordre de la liste. */
export function poserCouches(groupe: Group, couches: readonly CoucheRelief[]): void {
  for (const c of couches) for (const r of c.rects) groupe.add(rect(c.couleur, r.cx, r.cy, r.w, r.h, c.profondeur));
}

interface Oeil {
  groupe: Group;
  blanc: Mesh;
  encre: Mesh;
  pupille: Mesh;
  sourcil: Mesh;
}

/**
 * Les yeux d'une pièce en maillages Three.js : deux groupes (contour d'encre, blanc, pupille) et deux sourcils, posés dans la plus grande boîte de la pièce (`ex`, `ey`, mètres), droits dans son repère. `appliquer` pose une
 * expression (`expressionDe`) : toute la géométrie vient de `disposerYeux`, ce module ne fait que la poser sur les formes — **à appeler avant chaque image** (les formes sont créées sans place ni taille). Affichage seulement.
 * `phase` : la phase de tremblement de cette pièce (tirée du hasard d'affichage).
 */
export class Yeux {
  private readonly yeux: Oeil[] = [];
  constructor(
    readonly parent: Group,
    private readonly ex: number,
    private readonly ey: number,
    private readonly echelle: number,
    private readonly phase = 0,
  ) {
    for (let i = 0; i < 2; i++) {
      const groupe = new Group();
      const encre = cercle(ENCRE, 0, 0, 1, PROFONDEUR_OEIL.encre);
      const blanc = cercle(PAPIER, 0, 0, 1, PROFONDEUR_OEIL.blanc);
      const pupille = cercle(ENCRE, 0, 0, 1, PROFONDEUR_OEIL.pupille);
      groupe.add(encre, blanc, pupille);
      parent.add(groupe);
      const sourcil = rect(ENCRE, 0, 0, 1, 1, PROFONDEUR_OEIL.sourcil);
      parent.add(sourcil);
      this.yeux.push({ groupe, encre, blanc, pupille, sourcil });
    }
  }

  /** Pose une expression sur les maillages. `t` : le temps d'affichage (secondes). */
  appliquer(x: Expression, t: number): void {
    disposerYeux(this.ex, this.ey, this.echelle, x, t, this.phase).forEach((p, i) => {
      const o = this.yeux[i]!;
      const { pupille, sourcil } = p;
      o.groupe.position.set(p.x, p.y, 0);
      o.groupe.scale.set(p.sx, p.sy, 1);
      o.encre.scale.set(p.rEncre, p.rEncre, 1);
      o.blanc.scale.set(p.rBlanc, p.rBlanc, 1);
      o.pupille.position.set(pupille.x, pupille.y, PROFONDEUR_OEIL.pupille);
      o.pupille.scale.set(pupille.r, pupille.r, 1);
      o.sourcil.visible = sourcil.visible;
      o.sourcil.position.set(sourcil.x, sourcil.y, PROFONDEUR_OEIL.sourcil);
      o.sourcil.scale.set(sourcil.w, sourcil.h, 1);
      o.sourcil.rotation.z = sourcil.rot;
    });
  }
}
