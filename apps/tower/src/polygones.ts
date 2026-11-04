import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { ENCRE } from "@cdj/visuels/blocs";

// Lot T9 — les formes en aplat de l'habillage des effets et du taquet (polygones, traits épais, étoiles, bordure d'encre). **Affichage seulement**, aucune texture, aucun dégradé. Ce module est chargé À LA DEMANDE avec
// `habits.ts` et `taquetFx.ts` : il n'est ni dans l'accueil ni dans le jeu. Les matières sont partagées par couleur et opacité ; les deux faces sont dessinées (les polygones n'ont pas de sens imposé).
const matieres = new Map<string, MeshBasicMaterial>();
export function aplat(couleur: string, opacite = 1): MeshBasicMaterial {
  const cle = `${couleur}/${opacite}`;
  let m = matieres.get(cle);
  if (!m) matieres.set(cle, (m = new MeshBasicMaterial({ color: new Color(couleur), side: DoubleSide, transparent: opacite < 1, opacity: opacite, depthWrite: opacite >= 1 })));
  return m;
}

/** Un polygone (convexe, ou en étoile autour de son premier point) : `pts` = x, y, x, y… en mètres. Éventail depuis le premier sommet. */
export function poly(couleur: string, pts: readonly number[], z = 0, opacite = 1): Mesh {
  const v: number[] = [];
  for (let i = 2; i < pts.length / 2; i++) v.push(pts[0]!, pts[1]!, 0, pts[2 * i - 2]!, pts[2 * i - 1]!, 0, pts[2 * i]!, pts[2 * i + 1]!, 0);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(v), 3));
  g.userData.jetable = true; // propre à cette forme (la scène la libère avec la pièce qui la porte)
  const m = new Mesh(g, aplat(couleur, opacite));
  m.position.z = z;
  return m;
}

/** Un trait épais de largeur `w` entre deux points. */
export function trait(couleur: string, x1: number, y1: number, x2: number, y2: number, w: number, z = 0): Mesh {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1e-6;
  const nx = (-(y2 - y1) / d) * (w / 2);
  const ny = ((x2 - x1) / d) * (w / 2);
  return poly(couleur, [x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny], z);
}

/** Un rectangle (centre, taille). */
export const boite = (couleur: string, cx: number, cy: number, w: number, h: number, z = 0, opacite = 1): Mesh => poly(couleur, [cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2], z, opacite);

/** Un disque (24 côtés à peine visibles à cette taille : 14). */
export const rond = (couleur: string, cx: number, cy: number, r: number, z = 0, opacite = 1): Mesh => poly(couleur, Array.from({ length: 14 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 7), cy + r * Math.sin((i * Math.PI) / 7)]).flat(), z, opacite);

/** Une étoile à `n` branches, de rayon extérieur `re` et intérieur `ri` (un éclat, une étincelle, un flocon plein). Éventail depuis le centre. */
export function pointes(couleur: string, cx: number, cy: number, re: number, ri: number, n: number, z = 0, rot = 0, opacite = 1): Mesh {
  const pts = [cx, cy];
  for (let i = 0; i <= 2 * n; i++) {
    const r = i % 2 === 0 ? re : ri;
    const a = rot + (i * Math.PI) / n;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return poly(couleur, pts, z, opacite);
}

/** Un polygone bordé d'encre : l'encre dessous (chaque sommet repoussé du centre de `e` mètres), la couleur dessus. */
export function polyEncre(couleur: string, pts: readonly number[], e = 0.05, z = 0): Group {
  const n = pts.length / 2;
  const cx = pts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / n;
  const cy = pts.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / n;
  const g = new Group();
  g.add(poly(ENCRE, pts.map((v, i) => { const c = i % 2 === 0 ? cx : cy; const d = v - c; return v + (d === 0 ? 0 : Math.sign(d) * e); }), z - 0.0004), poly(couleur, pts, z));
  return g;
}

/** Une étoile bordée d'encre (l'éclat jaune du choc, une étincelle). */
export function pointesEncre(couleur: string, cx: number, cy: number, re: number, ri: number, n: number, z = 0, rot = 0, e = 0.05): Group {
  const g = new Group();
  g.add(pointes(ENCRE, cx, cy, re + e, ri + e * 0.7, n, z - 0.0004, rot), pointes(couleur, cx, cy, re, ri, n, z, rot));
  return g;
}

/** Un disque bordé d'encre. */
export function rondEncre(couleur: string, cx: number, cy: number, r: number, e = 0.04, z = 0): Group {
  const g = new Group();
  g.add(rond(ENCRE, cx, cy, r + e, z - 0.0004), rond(couleur, cx, cy, r, z));
  return g;
}
