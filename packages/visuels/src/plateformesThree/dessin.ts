import { BufferGeometry, Float32BufferAttribute } from "three";
import type { Art } from "./artKit";

/** Une `BufferGeometry` d'un tampon pur (positions, couleurs par sommet, indices) : un appel de dessin par tampon. */
export function artGeometry(art: Art): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(art.pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(art.col, 3));
  g.setIndex(art.idx);
  g.computeBoundingSphere();
  return g;
}
