import { BufferAttribute, BufferGeometry, Color, Euler, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Les briques de formes de Rush (lot BR0b) : des ROCHERS anguleux (icosaèdres déformés), la coloration par sommet, la fusion de géométries (un seul appel de dessin pour tout un décor ou tout un membre). Tout est code :
// aucun fichier de modèle. Le hasard n'est jamais `Math.random` ici : une graine, pour que la forme soit la même à chaque lancement (et sur chaque machine).

/** Un générateur à graine (mulberry32) : des nombres de 0 à 1. */
export function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une valeur de 0 à 1 qui ne dépend que de la position (arrondie) : deux sommets au même endroit se déforment pareil, la roche ne se fend pas. */
function brouille(x: number, y: number, z: number, graine: number): number {
  let h = graine | 0;
  for (const v of [x, y, z]) h = Math.imul(h ^ Math.round(v * 1000), 0x45d9f3b) ^ (h >>> 13);
  h = Math.imul(h ^ (h >>> 16), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
}

export interface OptionsRoche {
  /** Le nombre de subdivisions de l'icosaèdre (0 : 20 faces, 1 : 80). */
  detail?: number;
  /** La force de la déformation, en part du rayon (0,3 : très anguleuse). */
  bruit?: number;
  /** L'étirement (x, y, z) après déformation. */
  etire?: readonly [number, number, number];
}

/** Un rocher anguleux : un icosaèdre dont chaque sommet est déplacé le long de son rayon, aux normales de face (les arêtes restent vives : ombrage plat). Sans attribut `uv`, avec `normal`. */
export function roche(rayon: number, graine: number, o: OptionsRoche = {}): BufferGeometry {
  const g = new IcosahedronGeometry(rayon, o.detail ?? 1);
  const p = g.getAttribute("position");
  const bruit = o.bruit ?? 0.28;
  const [ex, ey, ez] = o.etire ?? [1, 1, 1];
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const f = 1 + (brouille(v.x / rayon, v.y / rayon, v.z / rayon, graine) * 2 - 1) * bruit;
    p.setXYZ(i, v.x * f * ex, v.y * f * ey, v.z * f * ez);
  }
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const plat = g.index ? g.toNonIndexed() : g;
  plat.computeVertexNormals();
  return plat;
}

/** Colorie chaque FACE d'une forme : une couleur tirée de `couleurs` (la variété d'une roche peinte). Une forme indexée est d'abord rendue non indexée (des aplats nets) : **la valeur rendue est la forme à garder**. */
export function colorier(forme: BufferGeometry, couleurs: readonly number[], graine = 1): BufferGeometry {
  const g = forme.index ? forme.toNonIndexed() : forme;
  const n = g.getAttribute("position").count;
  const c = new Float32Array(n * 3);
  const rnd = aleatoire(graine);
  const tmp = new Color();
  for (let f = 0; f < n; f += 3) {
    tmp.set(couleurs[Math.floor(rnd() * couleurs.length)]!);
    for (let k = 0; k < 3; k++) {
      c[(f + k) * 3] = tmp.r;
      c[(f + k) * 3 + 1] = tmp.g;
      c[(f + k) * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute("color", new BufferAttribute(c, 3));
  return g;
}

/** Colorie une forme d'une seule couleur : la forme rendue est à garder (voir `colorier`). */
export function teindre(g: BufferGeometry, couleur: number): BufferGeometry {
  return colorier(g, [couleur]);
}

export interface Pose {
  x?: number;
  y?: number;
  z?: number;
  /** Rotations (radians) autour de x, y, z. */
  rx?: number;
  ry?: number;
  rz?: number;
  /** Échelle (un nombre ou x, y, z). */
  s?: number | readonly [number, number, number];
}
const m4 = new Matrix4();
const q = new Quaternion();
const eu = new Vector3();
const echelle = new Vector3();
const angles = new Euler();
/** Place une forme (en place) : l'échelle, la rotation, puis la position. Rend la même forme. */
export function placer<T extends BufferGeometry>(g: T, p: Pose): T {
  const s = typeof p.s === "number" ? [p.s, p.s, p.s] : (p.s ?? [1, 1, 1]);
  q.setFromEuler(angles.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0));
  m4.compose(eu.set(p.x ?? 0, p.y ?? 0, p.z ?? 0), q, echelle.set(s[0], s[1], s[2]));
  g.applyMatrix4(m4);
  return g;
}

/** Fusionne des formes (même attributs : `position`, `normal`, `color`) en une seule : un appel de dessin. Les `uv` sont retirés ; une forme sans couleur est teinte en blanc. */
export function fusionner(formes: readonly BufferGeometry[]): BufferGeometry {
  const prets = formes.map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    c.deleteAttribute("uv");
    if (!c.getAttribute("normal")) c.computeVertexNormals();
    if (!c.getAttribute("color")) teindre(c, 0xffffff);
    return c;
  });
  const f = mergeGeometries(prets, false);
  if (!f) throw new Error("fusion impossible : attributs différents");
  return f;
}

/** Colorie une forme non indexée face par face d'après le centre et la normale de la face (une tache de reflet, une bande de mousse) : des aplats nets, jamais de dégradé. */
export function colorierParFace(forme: BufferGeometry, choisir: (centre: Vector3, normale: Vector3) => number): BufferGeometry {
  const g = forme.index ? forme.toNonIndexed() : forme;
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const c = new Float32Array(p.count * 3);
  const centre = new Vector3();
  const normale = new Vector3();
  const tmp = new Color();
  for (let f = 0; f < p.count; f += 3) {
    centre.set(0, 0, 0);
    normale.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      centre.x += p.getX(f + k) / 3;
      centre.y += p.getY(f + k) / 3;
      centre.z += p.getZ(f + k) / 3;
      normale.x += n.getX(f + k);
      normale.y += n.getY(f + k);
      normale.z += n.getZ(f + k);
    }
    tmp.set(choisir(centre, normale.normalize()));
    for (let k = 0; k < 3; k++) {
      c[(f + k) * 3] = tmp.r;
      c[(f + k) * 3 + 1] = tmp.g;
      c[(f + k) * 3 + 2] = tmp.b;
    }
  }
  g.setAttribute("color", new BufferAttribute(c, 3));
  return g;
}

// --- Les BLOCS arrondis (lot BR0c) : le golem et le décor en gros volumes lisses, légèrement irréguliers ---------------------------------------------------------------------------------------
/** Un bruit doux (somme de sinus à des phases tirées de la graine) de −1 à 1 : il ne dépend que de la position, deux sommets au même endroit se déplacent pareil. */
export function bruitDoux(graine: number): (x: number, y: number, z: number) => number {
  const r = aleatoire(graine * 7 + 3);
  const ph = Array.from({ length: 6 }, () => r() * Math.PI * 2);
  return (x, y, z) => (Math.sin(x * 1.9 + ph[0]! + Math.sin(y * 1.3 + ph[1]!)) + Math.sin(y * 2.3 + ph[2]! + z * 0.9) * Math.cos(z * 1.7 + ph[3]!) + Math.sin((x + z) * 1.1 + ph[4]!) * 0.6 + Math.cos((y - x) * 1.5 + ph[5]!) * 0.5) / 2.6;
}

export interface OptionsBloc {
  /** Le rayon d'arrondi des arêtes (mètres). */
  rayon?: number;
  /** L'irrégularité : le déplacement des sommets le long de leur normale, en part de la plus petite dimension (0,06 : visible, doux). */
  irregulier?: number;
  graine?: number;
  /** Les segments d'arrondi (4 : le golem ; 2 : un décor lointain, moins de triangles). */
  segments?: number;
  /** La couleur et sa variation lisse (0,1 : ±10 % de clarté selon la position). */
  couleur: number;
  variation?: number;
  /** Une seconde couleur vers laquelle le dessus du bloc s'éclaircit (l'ombrage lisse d'un bloc : la lumière du ciel sur le haut). */
  dessus?: number;
}

const lissage01 = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Une BOÎTE ARRONDIE un peu irrégulière à l'ombrage LISSE (normales calculées après la déformation, sommets soudés), colorée par sommet : un bloc de pierre. Rend une forme INDEXÉE avec `normal` et `color`. */
export function bloc(largeur: number, hauteur: number, profondeur: number, o: OptionsBloc): BufferGeometry {
  const petit = Math.min(largeur, hauteur, profondeur);
  const rayon = Math.min(o.rayon ?? petit * 0.3, petit * 0.48);
  const g0 = new RoundedBoxGeometry(largeur, hauteur, profondeur, o.segments ?? 4, rayon);
  g0.deleteAttribute("uv");
  g0.deleteAttribute("normal");
  const g = mergeVertices(g0, 1e-4);
  g.computeVertexNormals();
  const bruit = bruitDoux(o.graine ?? 1);
  const bruitC = bruitDoux((o.graine ?? 1) + 40);
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const force = (o.irregulier ?? 0.07) * petit;
  const v = new Vector3();
  const nv = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nv.fromBufferAttribute(n, i);
    const f = bruit(v.x, v.y, v.z) * force;
    p.setXYZ(i, v.x + nv.x * f, v.y + nv.y * f, v.z + nv.z * f);
  }
  g.computeVertexNormals();
  const c = new Float32Array(p.count * 3);
  const base = new Color(o.couleur);
  const haut = new Color(o.dessus ?? o.couleur);
  const t = new Color();
  const variation = o.variation ?? 0.1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nv.fromBufferAttribute(g.getAttribute("normal"), i);
    t.copy(base).lerp(haut, Math.max(0, nv.y) * 0.9);
    t.multiplyScalar(0.76 + 0.24 * lissage01(v.y / hauteur + 0.5)); // le bas du bloc est plus sombre : du volume sans dégradé de lumière
    t.multiplyScalar(1 + bruitC(v.x * 1.4, v.y * 1.4, v.z * 1.4) * variation);
    c[i * 3] = t.r;
    c[i * 3 + 1] = t.g;
    c[i * 3 + 2] = t.b;
  }
  g.setAttribute("color", new BufferAttribute(c, 3));
  return g;
}
