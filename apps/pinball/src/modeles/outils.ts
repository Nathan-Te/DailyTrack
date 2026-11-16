import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3 } from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { alea, type Outils, type Placement, type Point3 } from "./types";

// Lot PBV4 : les fabriques de géométrie que les thèmes reçoivent (`Outils`), et la coque d'encre. Utilisé par le rendu three.js (`trois.ts`) et par `test/modeles.test.ts` (sans navigateur : rien ici ne dessine).

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const s3 = new Vector3();

/** Une géométrie propre à fusionner : sans index, position et normale seulement. */
function nette(g: BufferGeometry): BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  for (const a of Object.keys(n.attributes)) if (a !== "position" && a !== "normal") n.deleteAttribute(a);
  if (!n.getAttribute("normal")) n.computeVertexNormals();
  return n;
}
function placer(g: BufferGeometry, p: Placement = {}): BufferGeometry {
  e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
  q.setFromEuler(e);
  const s = p.s ?? 1;
  s3.set((p.sx ?? 1) * s, (p.sy ?? 1) * s, (p.sz ?? 1) * s);
  v.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.applyMatrix4(m4.compose(v, q, s3));
  return nette(g);
}

export const OUTILS: Outils = {
  cylindre: (rh, rb, h, p, seg = 20) => placer(new CylinderGeometry(rh, rb, h, seg), p),
  sphere: (r, p, seg = 18) => placer(new SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.6))), p),
  tore: (R, r, p, seg = 24, arc = Math.PI * 2) => placer(new TorusGeometry(R, r, r < 1.5 ? 5 : 8, seg, arc), p),
  boite: (l, h, pr, p) => placer(new BoxGeometry(l, h, pr), p),
  calotte(r, angle, p, seg = 24) {
    // une calotte de sphère retournée : un creux tourné vers le haut, son fond à l'origine
    const g = new SphereGeometry(r, seg, 6, 0, Math.PI * 2, Math.PI - angle, angle);
    g.translate(0, r, 0);
    return placer(g, p);
  },
  extruder(contour, ep, p, biseau = 0.6) {
    const f = new Shape(contour.map(([x, y]) => new Vector2(x, y)));
    const g = new ExtrudeGeometry(f, { depth: Math.max(0.1, ep - 2 * biseau), bevelEnabled: biseau > 0, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -(ep - 2 * biseau) / 2);
    return placer(g, p);
  },
  roche(r, graine, p, relief = 0.22, seg = 12) {
    // une sphère dont chaque sommet s'écarte du centre selon trois ondes tirées de la graine (la même roche pour la même graine)
    const sp = new SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.7)));
    sp.deleteAttribute("uv");
    sp.deleteAttribute("normal");
    const g = mergeVertices(sp, 0.001);
    sp.dispose();
    const t = alea(graine);
    const ondes = Array.from({ length: 3 }, () => ({ x: t() * 2 - 1, y: t() * 2 - 1, z: t() * 2 - 1, f: 1.5 + t() * 2.5, d: t() * 6 }));
    const pos = g.getAttribute("position");
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).normalize();
      let b = 0;
      for (const o of ondes) b += Math.sin((v.x * o.x + v.y * o.y + v.z * o.z) * o.f * 3 + o.d);
      v.multiplyScalar(r * (1 + (relief * b) / 3));
      pos.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return placer(g, p);
  },
  tube(points, r0, r1, p, seg = 7) {
    // un tube qui s'affine de r0 à r1 le long des points (pour les tentacules), fermé par une pointe
    const pts = points.map(([x, y, z]) => new Vector3(x, y, z));
    const pos: number[] = [];
    const n = pts.length;
    const anneaux: Vector3[][] = [];
    const haut = new Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = pts[Math.min(n - 1, i + 1)]!.clone().sub(pts[Math.max(0, i - 1)]!).normalize();
      const a = new Vector3().crossVectors(t, haut);
      if (a.lengthSq() < 1e-6) a.set(1, 0, 0);
      a.normalize();
      const b = new Vector3().crossVectors(a, t).normalize();
      const r = r0 + ((r1 - r0) * i) / (n - 1);
      anneaux.push(Array.from({ length: seg }, (_, k) => pts[i]!.clone().addScaledVector(a, Math.cos((k / seg) * Math.PI * 2) * r).addScaledVector(b, Math.sin((k / seg) * Math.PI * 2) * r)));
    }
    const tri = (a: Vector3, b: Vector3, c: Vector3): void => void pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < n - 1; i++)
      for (let k = 0; k < seg; k++) {
        const a = anneaux[i]![k]!;
        const b = anneaux[i]![(k + 1) % seg]!;
        const c = anneaux[i + 1]![k]!;
        const d = anneaux[i + 1]![(k + 1) % seg]!;
        tri(a, c, b);
        tri(b, c, d);
      }
    const bout = pts[n - 1]!;
    for (let k = 0; k < seg; k++) tri(anneaux[n - 1]![k]!, bout, anneaux[n - 1]![(k + 1) % seg]!);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return placer(g, p);
  },
  anneau: (r0, r1, p = {}, seg = 32) => placer(new TorusGeometry((r0 + r1) / 2, (r1 - r0) / 2, 6, seg), { ...p, rx: Math.PI / 2, sz: 0.12 }),
  placer,
  fusion: (...g) => {
    const f = mergeGeometries(g.map(nette), false);
    for (const x of g) x.dispose();
    return f;
  },
};

/** La coque d'encre d'une géométrie : la même, gonflée de `ep` le long des normales lissées (dessinée face arrière, elle fait le contour). */
export function coque(g: BufferGeometry, ep: number): BufferGeometry {
  const c = new BufferGeometry();
  c.setAttribute("position", g.getAttribute("position").clone());
  const f = mergeVertices(c, 0.01);
  c.dispose();
  f.computeVertexNormals();
  const pos = f.getAttribute("position");
  const nor = f.getAttribute("normal");
  for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) + nor.getX(k) * ep, pos.getY(k) + nor.getY(k) * ep, pos.getZ(k) + nor.getZ(k) * ep);
  f.deleteAttribute("normal");
  return f;
}
export type { Point3 };
