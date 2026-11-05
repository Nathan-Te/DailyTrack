import { BackSide, BufferGeometry, Color, DataTexture, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, ShaderMaterial, type Material } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ENCRE } from "./palette";

// L'ombrage « cel » de Rush : trois tons plats (pas de dégradé) et un contour d'encre dessiné par la coque inversée (la forme, gonflée le long de ses normales, vue de l'intérieur). Pas de texture, pas de fichier.

const degrade = new DataTexture(Uint8Array.of(96, 178, 255), 3, 1, RedFormat);
degrade.minFilter = NearestFilter;
degrade.magFilter = NearestFilter;
degrade.needsUpdate = true;

/** Un matériau plat à trois tons. Chaque personnage a le sien (l'éclair blanc le modifie). `couleurs` : la forme porte ses couleurs par sommet (les rochers, les pièces fusionnées) ; `couleur` les multiplie. */
export const plat = (couleur: number, couleurs = false): MeshToonMaterial => new MeshToonMaterial({ color: couleur, gradientMap: degrade, vertexColors: couleurs });
/** Un aplat sans lumière (les yeux, les lueurs, les effets). */
export const uni = (couleur: number): MeshBasicMaterial => new MeshBasicMaterial({ color: couleur });

/** Le contour est RELATIF à la taille de la forme (comme la maquette `boss-rush-3d.html`) : une fraction du rayon de sa boule englobante, bornée. Le chevalier (corps de 45 cm de rayon) garde ses 4,5 cm ; les poings du golem en ont 10. */
export const COEFFICIENT_CONTOUR = 0.1;
export const CONTOUR_MIN = 0.02;
export const CONTOUR_MAX = 0.15;
export const epaisseurContour = (rayon: number): number => Math.min(CONTOUR_MAX, Math.max(CONTOUR_MIN, rayon * COEFFICIENT_CONTOUR));

const contours = new WeakMap<BufferGeometry, ShaderMaterial>();
/** Le matériau du contour d'une forme : un par géométrie (l'épaisseur dépend de sa taille), sans appel de dessin de plus. */
function contourDe(g: BufferGeometry): ShaderMaterial {
  let m = contours.get(g);
  if (!m) {
    g.computeBoundingSphere();
    m = new ShaderMaterial({
      side: BackSide,
      uniforms: { e: { value: epaisseurContour(g.boundingSphere?.radius ?? 0.5) }, c: { value: new Color(ENCRE) } },
      vertexShader: "uniform float e; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * e, 1.0); }",
      fragmentShader: "uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }",
    });
    contours.set(g, m);
  }
  return m;
}

const lisses = new WeakMap<BufferGeometry, BufferGeometry>();
/** La même forme aux normales lissées (sans arête vive) : le contour d'un cube ou d'un cylindre ne se déchire pas aux angles. */
function lisse(g: BufferGeometry): BufferGeometry {
  let l = lisses.get(g);
  if (!l) {
    const c = g.clone();
    c.deleteAttribute("normal");
    c.deleteAttribute("uv");
    c.deleteAttribute("color");
    l = mergeVertices(c, 1e-4);
    l.computeVertexNormals();
    lisses.set(g, l);
  }
  return l;
}

export interface Piece {
  groupe: Group;
  corps: Mesh;
  matiere: MeshToonMaterial;
}

/** Une pièce : la forme ombrée et son contour, dans un groupe qu'on déplace et qu'on déforme d'un bloc. `couleurs` : la géométrie porte l'attribut `color` (pièces fusionnées). */
export function piece(g: BufferGeometry, couleur: number, avecContour = true, couleurs = false): Piece {
  const groupe = new Group();
  const matiere = plat(couleur, couleurs);
  const corps = new Mesh(g, matiere);
  groupe.add(corps);
  if (avecContour) groupe.add(new Mesh(lisse(g), contourDe(g)));
  return { groupe, corps, matiere };
}

/** Une forme sans ombrage ni contour (un œil, une lueur). */
export function aplat(g: BufferGeometry, couleur: number): Mesh {
  return new Mesh(g, uni(couleur));
}

/** L'éclair blanc : de 0 (rien) à 1 (tout blanc). */
export function eclair(matieres: readonly Material[], f: number): void {
  for (const m of matieres) (m as MeshToonMaterial).emissive.setScalar(f);
}
