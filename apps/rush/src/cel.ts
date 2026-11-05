import { BackSide, BufferGeometry, Color, DataTexture, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, ShaderMaterial, type Material } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ENCRE } from "./palette";

// L'ombrage « cel » de Rush : trois tons plats (pas de dégradé) et un contour d'encre dessiné par la coque inversée (la forme, gonflée le long de ses normales, vue de l'intérieur). Pas de texture, pas de fichier.

const degrade = new DataTexture(Uint8Array.of(96, 178, 255), 3, 1, RedFormat);
degrade.minFilter = NearestFilter;
degrade.magFilter = NearestFilter;
degrade.needsUpdate = true;

/** Un matériau plat à trois tons. Chaque personnage a le sien (l'éclair blanc le modifie). */
export const plat = (couleur: number): MeshToonMaterial => new MeshToonMaterial({ color: couleur, gradientMap: degrade });
/** Un aplat sans lumière (les yeux, les lueurs, les effets). */
export const uni = (couleur: number): MeshBasicMaterial => new MeshBasicMaterial({ color: couleur });

/** L'épaisseur du contour, en mètres. */
export const EPAISSEUR_CONTOUR = 0.045;
const contour = new ShaderMaterial({
  side: BackSide,
  uniforms: { e: { value: EPAISSEUR_CONTOUR }, c: { value: new Color(ENCRE) } },
  vertexShader: "uniform float e; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * e, 1.0); }",
  fragmentShader: "uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }",
});

const lisses = new WeakMap<BufferGeometry, BufferGeometry>();
/** La même forme aux normales lissées (sans arête vive) : le contour d'un cube ou d'un cylindre ne se déchire pas aux angles. */
function lisse(g: BufferGeometry): BufferGeometry {
  let l = lisses.get(g);
  if (!l) {
    const c = g.clone();
    c.deleteAttribute("normal");
    c.deleteAttribute("uv");
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

/** Une pièce : la forme ombrée et son contour, dans un groupe qu'on déplace et qu'on déforme d'un bloc. */
export function piece(g: BufferGeometry, couleur: number, avecContour = true): Piece {
  const groupe = new Group();
  const matiere = plat(couleur);
  const corps = new Mesh(g, matiere);
  groupe.add(corps);
  if (avecContour) groupe.add(new Mesh(lisse(g), contour));
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
