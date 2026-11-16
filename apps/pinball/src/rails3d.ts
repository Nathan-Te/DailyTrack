import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, FrontSide, Mesh, MeshBasicMaterial, MeshPhongMaterial, Uint32BufferAttribute, Vector3, Vector4, type Camera, type Material } from "three";
import { HAUTEUR, LARGEUR, RAYON, UNITE, type Porte, type Rail, type Table, type ThemePinball } from "@cdj/pinball-sim";
import { echantillons, hauteurRail, pointDuRail, type PointRail } from "./rails";

// Les rails en volume (lot PBG1) : le rendu three.js des rampes et de l'orbite, **construits par le code** (aucun fichier 3D, aucune image) et habillés par thème — montagnes russes (foire), toboggan aquatique (océan), tube orbital
// (espace), rail de wagonnet (volcan). Le rail suit `echantillons(rail)` : un ruban (rebords, tube) balayé le long du tracé, des traverses, des supports fins posés sur le plateau, et une bouche (un entonnoir qui s'évase, un portique).
// **Tout est fusionné** : un seul maillage opaque pour toutes les rails de la table (couleurs par sommet), un seul maillage translucide (le toboggan, le tube), un seul maillage qui rayonne (les néons, les ampoules, la braise : il passe
// aussi dans la petite scène du bloom de `corps.ts`) — trois appels de dessin, quel que soit le nombre de rails. **Matériaux Phong, jamais « Standard »** (coût mesuré au PBV3) ; chacun passe par `etalonne` de `corps.ts` (son crochet
// `userData.crochet` ajoute l'uniforme de la fenêtre ci-dessous).
// **La fenêtre sur la bille** : un rail qui passe devant la bille posée sur le plateau la cacherait (les rails sont des couches au-dessus du plateau) ; les matériaux de rail trouent donc, en tramé, les pixels qui sont devant la bille
// dans un petit disque d'écran autour d'elle (`cdjBille`, en repère de la caméra). La bille sur un rail n'a pas de fenêtre (elle est dessinée par-dessus tout, `corps.ts`).
// Rien ici ne décide quoi que ce soit : ce fichier ne lit que la table (`Table.rails`, `Table.portes`).

const X = (x: number): number => x - LARGEUR / 2;
const Z = (y: number): number => y - HAUTEUR / 2;

/** Les rails sont dessinés un peu plus bas que `rail.hauteur` : la simulation dit 20 à 44 px, mais, en perspective, un rail plus haut passe devant les étiquettes des modules et les cache. La bille y est à la même hauteur. */
export const ECHELLE_HAUTEUR = 0.72;
/** La hauteur dessinée (px) d'un point d'un rail dont la simulation donne la hauteur `h`. */
export const hauteurVue = (h: number): number => h * ECHELLE_HAUTEUR;
/** La hauteur du centre de la bille posée sur le rail `rail` à l'abscisse `s` (unités). */
export const hauteurBille = (rail: Rail, s: number): number => RAYON + hauteurVue(hauteurRail(rail, s));

type V3 = readonly [number, number, number];
type C3 = readonly [number, number, number];
type Couleur = C3 | ((k: number) => C3);
const hex = (s: string): C3 => {
  const c = new Color(s);
  return [c.r, c.g, c.b];
};
const fois = (c: C3, f: number): C3 => [c[0] * f, c[1] * f, c[2] * f];

/** Des quadrilatères à fusionner : sommets, normales et couleurs par sommet (les triangles se tournent d'eux-mêmes du côté de la normale donnée). */
class Tas {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];
  /** Un quadrilatère a, b, c, d (dans l'ordre du tour) ; `n` : la normale de chacun de ses sommets ; il est orienté vers elles. */
  quad(p: readonly [V3, V3, V3, V3], n: readonly [V3, V3, V3, V3], c: C3): void {
    const d1 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]] as const;
    const d2 = [p[3][0] - p[1][0], p[3][1] - p[1][1], p[3][2] - p[1][2]] as const;
    const gx = d1[1] * d2[2] - d1[2] * d2[1];
    const gy = d1[2] * d2[0] - d1[0] * d2[2];
    const gz = d1[0] * d2[1] - d1[1] * d2[0];
    const mx = n[0][0] + n[1][0] + n[2][0] + n[3][0];
    const my = n[0][1] + n[1][1] + n[2][1] + n[3][1];
    const mz = n[0][2] + n[1][2] + n[2][2] + n[3][2];
    const b = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(...p[k]!);
      this.nor.push(...n[k]!);
      this.col.push(...c);
    }
    if (gx * mx + gy * my + gz * mz >= 0) this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  get vide(): boolean {
    return this.idx.length === 0;
  }
  get triangles(): number {
    return this.idx.length / 3;
  }
  geometrie(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Un morceau du profil d'un balayage : du point `a` au point `b` (latéral `u`, hauteur `v` au-dessus du rail), de normale `na` (et `nb` au bout : un tube est lisse). */
interface Bande {
  a: readonly [number, number];
  b: readonly [number, number];
  na: readonly [number, number];
  nb?: readonly [number, number];
  c: Couleur;
}

/** Le profil d'un cercle de centre `(cu, cv)` et de rayon `r`, en `seg` bandes lisses. */
function cercle(cu: number, cv: number, r: number, seg: number, c: Couleur): Bande[] {
  const sortie: Bande[] = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    const b = ((k + 1) / seg) * Math.PI * 2;
    sortie.push({ a: [cu + r * Math.sin(a), cv + r * Math.cos(a)], b: [cu + r * Math.sin(b), cv + r * Math.cos(b)], na: [Math.sin(a), Math.cos(a)], nb: [Math.sin(b), Math.cos(b)], c });
  }
  return sortie;
}

/** Un point d'un rail en scène : latéral `u`, hauteur `v` au-dessus de la hauteur dessinée du rail, `e` : l'évasement de la bouche (la largeur seulement). */
const monde = (p: PointRail, u: number, v: number, e = 1): V3 => [X(p.x) - p.dy * u * e, hauteurVue(p.h) + v, Z(p.y) + p.dx * u * e];
const vecteur = (p: PointRail, nu: number, nv: number): V3 => [-p.dy * nu, nv, p.dx * nu];

/** Balaye un profil le long d'un rail échantillonné : un quadrilatère par bande et par pas. */
function balayer(tas: Tas, pts: readonly PointRail[], bandes: readonly Bande[], evase: (p: PointRail) => number = () => 1): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const ep = evase(p);
    const eq = evase(q);
    for (const b of bandes) {
      const c = typeof b.c === "function" ? b.c(i) : b.c;
      const nb = b.nb ?? b.na;
      tas.quad([monde(p, b.a[0], b.a[1], ep), monde(p, b.b[0], b.b[1], ep), monde(q, b.b[0], b.b[1], eq), monde(q, b.a[0], b.a[1], eq)], [vecteur(p, b.na[0], b.na[1]), vecteur(p, nb[0], nb[1]), vecteur(q, nb[0], nb[1]), vecteur(q, b.na[0], b.na[1])], c);
    }
  }
}

/** Une boîte posée : centre `(cx, cz)`, de `y0` à `y1`, `(tx, tz)` le vecteur unitaire de sa longueur, demi-longueur `a` et demi-largeur `b` ; sans fond. `dessus` : la couleur de son dessus. */
function boite(tas: Tas, cx: number, cz: number, y0: number, y1: number, tx: number, tz: number, a: number, b: number, c: C3, dessus: C3 = c): void {
  const lx = -tz;
  const lz = tx;
  const coin = (sa: number, sb: number, y: number): V3 => [cx + tx * a * sa + lx * b * sb, y, cz + tz * a * sa + lz * b * sb];
  const bas = [coin(-1, -1, y0), coin(1, -1, y0), coin(1, 1, y0), coin(-1, 1, y0)] as const;
  const haut = [coin(-1, -1, y1), coin(1, -1, y1), coin(1, 1, y1), coin(-1, 1, y1)] as const;
  const haute: V3 = [0, 1, 0];
  tas.quad([haut[0], haut[1], haut[2], haut[3]], [haute, haute, haute, haute], dessus);
  // les quatre côtés : (0→1) arrière, (1→2) à gauche, (2→3) à l'avant, (3→0) à droite
  const n01: V3 = [-lx, 0, -lz];
  const n12: V3 = [tx, 0, tz];
  const n23: V3 = [lx, 0, lz];
  const n30: V3 = [-tx, 0, -tz];
  const faces: [number, number, V3][] = [[0, 1, n01], [1, 2, n12], [2, 3, n23], [3, 0, n30]];
  for (const [i, j, n] of faces) tas.quad([bas[i]!, bas[j]!, haut[j]!, haut[i]!], [n, n, n, n], c);
}

/** Un anneau d'un tube (les néons de l'espace) : un cerclé de rayon extérieur `r` autour du point `p`, centré à la hauteur `cv`, épais de `ep` ; sa bande et une face (le matériau le montre des deux côtés). */
function anneau(tas: Tas, p: PointRail, cv: number, r0: number, r1: number, ep: number, seg: number, c: C3, e = 1): void {
  const centre = (th: number, r: number, t: number): V3 => {
    const l = Math.sin(th) * r * e;
    const h = Math.cos(th) * r;
    return [X(p.x) - p.dy * l + p.dx * t, hauteurVue(p.h) + cv + h, Z(p.y) + p.dx * l + p.dy * t];
  };
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    const b = ((k + 1) / seg) * Math.PI * 2;
    const t = ep / 2;
    const na = vecteur(p, Math.sin(a), Math.cos(a));
    const nb = vecteur(p, Math.sin(b), Math.cos(b));
    tas.quad([centre(a, r1, -t), centre(a, r1, t), centre(b, r1, t), centre(b, r1, -t)], [na, na, nb, nb], c);
    const f: V3 = [p.dx, 0, p.dy];
    tas.quad([centre(a, r0, t), centre(a, r1, t), centre(b, r1, t), centre(b, r0, t)], [f, f, f, f], c);
  }
}

/** Les échantillons d'un balayage : fins là où le tracé tourne (un point tous les `ANGLE` radians), au plus tous les `pasMax` px là où il est droit — moins de triangles pour le même tracé lisse. */
function echantillonsAdaptes(rail: Rail, pasMax: number, angle = 0.1): PointRail[] {
  const fins = echantillons(rail, 3);
  const gardes: PointRail[] = [fins[0]!];
  let ref = fins[0]!;
  for (let i = 1; i < fins.length - 1; i++) {
    const p = fins[i]!;
    const d = (p.s - ref.s) / UNITE;
    const virage = Math.abs(Math.atan2(ref.dx * p.dy - ref.dy * p.dx, ref.dx * p.dx + ref.dy * p.dy));
    // aux bouts, où la hauteur monte (ou la bouche s'évase), un point au moins tous les 12 px
    const bout = Math.min(p.s, rail.len - p.s) / UNITE < 100 ? Math.min(pasMax, 12) : pasMax;
    if (d >= bout || (virage >= angle && d >= 5)) {
      gardes.push(p);
      ref = p;
    }
  }
  gardes.push(fins[fins.length - 1]!);
  return gardes;
}

/** Les échantillons à pas fixe (`pas` px, et le bout) : les rayures d'un rail tombent alors exactement sur les pas. */
function echantillonsFixes(rail: Rail, pas: number): PointRail[] {
  const sortie: PointRail[] = [];
  for (let d = 0; d < rail.len / UNITE - pas * 0.4; d += pas) sortie.push(pointDuRail(rail, Math.round(d * UNITE)));
  sortie.push(pointDuRail(rail, rail.len));
  return sortie;
}

/** Les abscisses (unités) où poser quelque chose tous les `pas` px, depuis `depart` px, sans les `marge` px des bouts. */
function repartir(rail: Rail, pas: number, depart: number, marge: number): number[] {
  const total = rail.len / UNITE;
  const sortie: number[] = [];
  for (let d = depart; d <= total - marge; d += pas) if (d >= marge) sortie.push(Math.round(d * UNITE));
  return sortie;
}

/** Les rails que dessine un thème : ses fonctions écrivent dans les trois tas (opaque, translucide, qui rayonne). */
interface Tas3 {
  opaque: Tas;
  translucide: Tas;
  rayon: Tas;
}
interface Contexte {
  rail: Rail;
  rang: number;
  evase: (p: PointRail) => number;
}

const HAUTEUR_SUPPORT_MIN = 6.5;
/** Les supports d'un rail : un fût fin posé sur le plateau et une traverse sous le rail, tous les `pas` px là où le rail est assez haut. */
function supports(tas: Tas, rail: Rail, pas: number, fut: C3, traverse: C3, largeur: number, couleurHaut?: C3, segment = 0): void {
  for (const s of repartir(rail, pas, pas * 0.6, 26)) {
    const p = pointDuRail(rail, s);
    const hv = hauteurVue(p.h);
    if (hv < HAUTEUR_SUPPORT_MIN) continue;
    const base = 0;
    if (segment > 0) {
      for (let y = base, k = 0; y < hv - 3; y += segment, k++) boite(tas, X(p.x), Z(p.y), y, Math.min(hv - 3, y + segment), p.dx, p.dy, largeur / 2, largeur / 2, k % 2 ? couleurHaut ?? fut : fut);
    } else boite(tas, X(p.x), Z(p.y), base, hv - 3, p.dx, p.dy, largeur / 2, largeur / 2, fut);
    boite(tas, X(p.x), Z(p.y), hv - 3.2, hv - 0.6, p.dx, p.dy, 1.7, 12.5, traverse, couleurHaut ?? traverse);
  }
}

// ---------------------------------------------------------------------------------------------------------------- foire : les montagnes russes
function foire(t: Tas3, c: Contexte): void {
  const { rail } = c;
  // des rayures de 11 px : un échantillon tous les 11 px, une rayure par pas
  const pts = echantillonsFixes(rail, 11);
  const rouge = hex("#D8332A");
  const blanc = hex("#F6F0E4");
  const creme = hex("#EFE2C6");
  const crememoins = hex("#DCC9A2");
  const rayure = (k: number): number => k % 2;
  const bande = (k: number): C3 => (rayure(k) ? rouge : blanc);
  const autre = (k: number): C3 => (rayure(k) ? blanc : rouge);
  const bandes: Bande[] = [
    { a: [-12, 0], b: [12, 0], na: [0, 1], c: (k) => (rayure(k) ? creme : crememoins) },
    // les rebords : l'intérieur, le dessus, l'extérieur ; les rayures rouges et blanches en quinconce
    { a: [-12, 0], b: [-12, 6], na: [1, 0], c: bande },
    { a: [-14.5, 6], b: [-12, 6], na: [0, 1], c: bande },
    { a: [-14.5, 6], b: [-14.5, -0.5], na: [-1, 0], c: bande },
    { a: [12, 0], b: [12, 6], na: [-1, 0], c: autre },
    { a: [12, 6], b: [14.5, 6], na: [0, 1], c: autre },
    { a: [14.5, 6], b: [14.5, -0.5], na: [1, 0], c: autre },
  ];
  balayer(t.opaque, pts, bandes, c.evase);
  // les traverses, sous le rail
  for (const [k, s] of repartir(rail, 20, 5, 3).entries()) {
    const p = pointDuRail(rail, s);
    const hv = hauteurVue(p.h);
    boite(t.opaque, X(p.x), Z(p.y), Math.max(-1, hv - 3.4), hv - 0.3, p.dx, p.dy, 2, 15.8, k % 2 ? hex("#B8281F") : hex("#8F1F19"), k % 2 ? hex("#E7554A") : hex("#C73329"));
  }
  supports(t.opaque, rail, 42, rouge, blanc, 3, blanc, 9);
  // les ampoules sur les rebords (elles rayonnent)
  const ampoule = hex("#FFD35C");
  for (const s of repartir(rail, 30, 14, 14)) {
    const p = pointDuRail(rail, s);
    for (const u of [-13.2, 13.2]) {
      const m = monde(p, u, 7.4);
      boite(t.rayon, m[0], m[2], m[1] - 1.1, m[1] + 1.1, p.dx, p.dy, 1.1, 1.1, ampoule);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------- océan : le toboggan aquatique
function ocean(t: Tas3, c: Contexte): void {
  const { rail } = c;
  const pts = echantillonsAdaptes(rail, 14);
  const eau = hex("#38CFD6");
  const ecume = hex("#F4FFFF");
  // la gouttière : une demi-ellipse (14 px de large, 8 de profond), translucide, plus claire vers les bords
  const bandes: Bande[] = [];
  const NB = 6;
  const pointU = (th: number): [number, number] => [14 * Math.sin(th), 8 - 8 * Math.cos(th)];
  const normale = (th: number): [number, number] => {
    // vers l'intérieur : du point vers le centre (0, 8), avec les rayons de l'ellipse
    const [u, v] = pointU(th);
    const nu = -u / (14 * 14);
    const nv = (8 - v) / (8 * 8);
    const l = Math.hypot(nu, nv) || 1;
    return [nu / l, nv / l];
  };
  for (let k = 0; k < NB; k++) {
    const a = -Math.PI / 2 + (k / NB) * Math.PI;
    const b = -Math.PI / 2 + ((k + 1) / NB) * Math.PI;
    const clair = Math.abs((a + b) / 2) / (Math.PI / 2);
    const couleur = ((): C3 => {
      const f = 0.82 + 0.5 * clair * clair;
      return [Math.min(1, eau[0] * f), Math.min(1, eau[1] * f), Math.min(1, eau[2] * f)];
    })();
    bandes.push({ a: pointU(a), b: pointU(b), na: normale(a), nb: normale(b), c: couleur });
  }
  balayer(t.translucide, pts, bandes, c.evase);
  // les bords : un tube d'écume le long de chaque rebord
  for (const u of [-14.4, 14.4]) {
    balayer(t.opaque, pts, [
      { a: [u - 1.7, 9.8], b: [u + 1.7, 9.8], na: [0, 1], c: ecume },
      { a: [u - 1.7, 7.2], b: [u - 1.7, 9.8], na: [-1, 0], c: ecume },
      { a: [u + 1.7, 7.2], b: [u + 1.7, 9.8], na: [1, 0], c: ecume },
    ], c.evase);
  }
  // des crêtes d'écume sur les bords (des petites pointes blanches, une sur deux de chaque côté)
  for (const [k, s] of repartir(rail, 15, 9, 14).entries()) {
    const p = pointDuRail(rail, s);
    const u = k % 2 ? 14.6 : -14.6;
    const m = monde(p, u, 9.8);
    const a = k * 0.9;
    boite(t.opaque, m[0], m[2], m[1] - 0.6, m[1] + 1.4 + (k % 3), Math.cos(a), Math.sin(a), 1.7, 1.2, ecume);
  }
  // des piliers de corail
  supports(t.opaque, rail, 40, hex("#E8785F"), hex("#F7E8CC"), 3.2);
}

// ---------------------------------------------------------------------------------------------------------------- espace : le tube orbital
const NEON_ESPACE = "#38E4FF";
function espace(t: Tas3, c: Contexte): void {
  const { rail } = c;
  const pts = echantillonsAdaptes(rail, 14);
  const verre = hex("#8FE9FF");
  // le tube : un cylindre de verre, dont le fond touche le plateau (centre à 12,4 px, rayon de 12,4)
  balayer(t.translucide, pts, cercle(0, 12.4, 12.4, 10, verre), c.evase);
  // le plancher, dans le tube : une bande sombre bordée de néon (qui rayonne)
  const sombre = hex("#262E4C");
  const clair = hex("#35406A");
  balayer(t.opaque, pts, [{ a: [-9.5, 0.1], b: [9.5, 0.1], na: [0, 1], c: (k) => (k % 2 ? sombre : clair) }], c.evase);
  const neon = hex(NEON_ESPACE);
  for (const u of [-9.9, 9.9]) balayer(t.rayon, pts, [{ a: [u - 0.9, 0.3], b: [u + 0.9, 0.3], na: [0, 1], c: neon }], c.evase);
  // les anneaux : de fins anneaux de néon autour du tube, plus larges à la bouche
  for (const s of repartir(rail, 46, 20, 24)) anneau(t.rayon, pointDuRail(rail, s), 12.4, 13.0, 14.7, 2.2, 10, neon);
  // les entretoises : des fûts d'argent
  supports(t.opaque, rail, 44, hex("#BAC6DA"), hex("#8794AE"), 2.6);
}

// ---------------------------------------------------------------------------------------------------------------- volcan : le rail de wagonnet
function volcan(t: Tas3, c: Contexte): void {
  const { rail } = c;
  const pts = echantillonsAdaptes(rail, 14);
  const fer = hex("#2D2926");
  const ferHaut = hex("#6A625B");
  // les deux rails de fer : un profil carré (les côtés sombres, le dessus clair)
  for (const u of [-8.2, 8.2]) {
    balayer(t.opaque, pts, [
      { a: [u - 1.5, 2.4], b: [u - 1.5, 5.1], na: [-1, 0], c: fer },
      { a: [u + 1.5, 2.4], b: [u + 1.5, 5.1], na: [1, 0], c: fer },
      { a: [u - 1.5, 5.1], b: [u + 1.5, 5.1], na: [0, 1], c: ferHaut },
    ], c.evase);
  }
  // les traverses de bois, sous les rails ; entre elles, la braise qui rougeoie
  const bois = hex("#6A4126");
  const boisClair = hex("#865832");
  for (const [k, s] of repartir(rail, 13, 5, 2).entries()) {
    const p = pointDuRail(rail, s);
    const hv = hauteurVue(p.h);
    boite(t.opaque, X(p.x), Z(p.y), Math.max(-1, hv + 0.3), hv + 2.4, p.dx, p.dy, 2.3, 13.5, k % 2 ? hex("#4D2E1A") : bois, k % 2 ? bois : boisClair);
  }
  const braise = fois(hex("#FF5A0E"), 0.22);
  balayer(t.rayon, pts, [{ a: [-5.5, 0.25], b: [5.5, 0.25], na: [0, 1], c: braise }], c.evase);
  supports(t.opaque, rail, 40, hex("#4D3220"), hex("#2F2018"), 3.6, hex("#6A4126"));
}

/** La bouche d'un rail : un portique propre au thème, posé de part et d'autre de l'entrée. */
function portique(t: Tas3, theme: ThemePinball, porte: Porte): void {
  const x = porte.x / UNITE;
  const y = porte.y / UNITE;
  const dx = porte.ux / 16384;
  const dy = porte.uy / 16384;
  const w = porte.l / UNITE;
  const lx = -dy;
  const lz = dx;
  const poteau = (u: number, h: number, l: number, c: C3, dessus: C3 = c): void => boite(t.opaque, X(x) + lx * u, Z(y) + lz * u, 0, h, dx, dy, l, l, c, dessus);
  const linteau = (h0: number, h1: number, c: C3, dessus: C3 = c): void => boite(t.opaque, X(x), Z(y), h0, h1, dx, dy, 1.8, w + 4.6, c, dessus);
  if (theme === "foire") {
    const rouge = hex("#D8332A");
    const blanc = hex("#F6F0E4");
    poteau(-(w + 3), 7.5, 1.7, rouge);
    poteau(-(w + 3), 15, 1.7, blanc);
    poteau(w + 3, 7.5, 1.7, rouge);
    poteau(w + 3, 15, 1.7, blanc);
    linteau(15, 18.2, rouge, hex("#F0574B"));
    for (const u of [-w, 0, w]) boite(t.rayon, X(x) + lx * u, Z(y) + lz * u, 18.4, 20.6, dx, dy, 1.1, 1.1, hex("#FFD35C"));
  } else if (theme === "ocean") {
    const corail = hex("#E8785F");
    const ecume = hex("#F4FFFF");
    poteau(-(w + 3), 12, 1.8, corail, hex("#F7E8CC"));
    poteau(w + 3, 12, 1.8, corail, hex("#F7E8CC"));
    // l'arche d'écume : des morceaux de bord à bord
    const N = 9;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI;
      const u = -Math.cos(a) * (w + 3);
      const h = 12 + Math.sin(a) * 6;
      boite(t.opaque, X(x) + lx * u, Z(y) + lz * u, h - 1.4, h + 1.4, dx, dy, 1.6, 2.4, ecume);
    }
  } else if (theme === "espace") {
    const metal = hex("#BAC6DA");
    poteau(-(w + 4), 8, 1.4, metal, hex("#38E4FF"));
    poteau(w + 4, 8, 1.4, metal, hex("#38E4FF"));
    const p: PointRail = { x, y, h: 0, dx, dy, s: 0 };
    anneau(t.rayon, p, 12.4, 15.6, 18.2, 2.8, 12, hex(NEON_ESPACE));
  } else {
    const bois = hex("#6A4126");
    const fer = hex("#2D2926");
    poteau(-(w + 3), 16, 2, bois, hex("#865832"));
    poteau(w + 3, 16, 2, bois, hex("#865832"));
    linteau(16, 19, bois, hex("#865832"));
    boite(t.opaque, X(x), Z(y), 12.4, 16, dx, dy, 0.9, 0.9, fer);
    boite(t.rayon, X(x), Z(y), 9.4, 12.4, dx, dy, 1.5, 1.5, hex("#FF7A1A"));
  }
}

const STYLES: Record<ThemePinball, (t: Tas3, c: Contexte) => void> = { foire, ocean, espace, volcan };

/** Ce que `corps.ts` pose dans la scène et libère. */
export interface Rails3d {
  /** Le maillage opaque (il projette une ombre), le translucide, et celui qui rayonne (à poser aussi dans la scène du bloom : la même géométrie, le même matériau). */
  opaque: Mesh | null;
  translucide: Mesh | null;
  rayonne: Mesh | null;
  /** Les matériaux et géométries à libérer. */
  liberables: { dispose(): void }[];
  /** La force de la lueur (le curseur « bandes » de la vue, 1 à 100 %). */
  lueur(k: number): void;
  /** Une image : les billes qui sont sur le plateau (les `n` premiers centres, scène ; `FENETRES` au plus, les autres restent sous les rails) — aucune quand elles sont sur un rail ou cachées ; `camera` : celle de l'image. */
  fenetre(billes: readonly Vector3[], n: number, camera: Camera): void;
  /** Les triangles posés (pour les mesures). */
  triangles: number;
}

const GAIN_RAILS = 3;
/** Lot PBG2 : le nombre de billes à la fois qui voient à travers les rails (la bille du lanceur et celles de la multibille : trois au plus sur le plateau). */
export const FENETRES = 3;
/** La fenêtre sur la bille : l'uniforme partagé de tous les matériaux de rail (une fenêtre par bille du plateau). */
const FENETRE = `
  for ( int cdjI = 0; cdjI < ${FENETRES}; cdjI ++ ) {
    vec4 cdjB = cdjBille[ cdjI ];
    if ( cdjB.w > 0.0 ) {
      vec3 cdjP = - vViewPosition;
      vec2 cdjD = cdjP.xy / - cdjP.z - cdjB.xy / - cdjB.z;
      float cdjRayon = cdjB.w / - cdjB.z;
      float cdjDist = length( cdjD ) / cdjRayon;
      if ( cdjDist < 1.0 && cdjP.z > cdjB.z + 3.0 ) {
        float cdjSeuil = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        if ( cdjSeuil >= clamp( ( cdjDist - 0.55 ) / 0.45, 0.0, 1.0 ) ) discard;
      }
    }
  }`;

/** Construit les rails d'une table pour un thème. `table.rails` vide : rien (tous les maillages sont `null`). */
export function creerRails3d(theme: ThemePinball, table: Table): Rails3d {
  const t3: Tas3 = { opaque: new Tas(), translucide: new Tas(), rayon: new Tas() };
  table.rails.forEach((rail, rang) => {
    const total = rail.len / UNITE;
    // la bouche s'évase : de 1,35 fois sa largeur à l'entrée, à 1 vingt-deux px plus loin ; l'orbite en a une à chaque bout
    const evase = (p: PointRail): number => {
      const d = rail.genre === "orbite" ? Math.min(p.s / UNITE, total - p.s / UNITE) : p.s / UNITE;
      return 1 + 0.35 * Math.max(0, 1 - d / 22);
    };
    STYLES[theme](t3, { rail, rang, evase });
  });
  for (const porte of table.portes) portique(t3, theme, porte);

  const liberables: { dispose(): void }[] = [];
  const fenetre = { value: Array.from({ length: FENETRES }, () => new Vector4(0, 0, 0, 0)) };
  const crochet = (sh: { uniforms: Record<string, unknown>; fragmentShader: string }): void => {
    sh.uniforms.cdjBille = fenetre;
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", `uniform vec4 cdjBille[${FENETRES}];\nvoid main() {`).replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${FENETRE}`);
  };
  const marquer = <M extends Material>(m: M): M => {
    m.userData.crochet = crochet;
    m.customProgramCacheKey = () => "cdj-rails";
    liberables.push(m);
    return m;
  };
  const maillage = (tas: Tas, m: Material, ombre: boolean): Mesh | null => {
    if (tas.vide) return null;
    const g = tas.geometrie();
    liberables.push(g);
    const mesh = new Mesh(g, m);
    mesh.castShadow = ombre;
    mesh.receiveShadow = ombre;
    mesh.frustumCulled = false;
    return mesh;
  };
  const translucide = theme === "ocean" ? { opacite: 0.5, deux: true } : { opacite: 0.2, deux: false };
  const opaque = maillage(t3.opaque, marquer(new MeshPhongMaterial({ vertexColors: true, color: new Color(GAIN_RAILS, GAIN_RAILS, GAIN_RAILS), specular: "#6a5a48", shininess: 40 })), true);
  const clair = maillage(t3.translucide, marquer(new MeshPhongMaterial({ vertexColors: true, color: new Color(1.6, 1.6, 1.6), specular: "#ffffff", shininess: 90, transparent: true, opacity: translucide.opacite, depthWrite: false, side: translucide.deux ? DoubleSide : FrontSide })), false);
  if (clair) clair.renderOrder = 1;
  const rayon = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  liberables.push(rayon);
  const rayonne = maillage(t3.rayon, rayon, false);
  const v = new Vector3();
  return {
    opaque,
    translucide: clair,
    rayonne,
    liberables,
    triangles: t3.opaque.triangles + t3.translucide.triangles + t3.rayon.triangles,
    lueur(k: number): void {
      rayon.color.setScalar(0.35 + 1.6 * k);
    },
    fenetre(billes: readonly Vector3[], n: number, camera: Camera): void {
      for (let i = 0; i < FENETRES; i++) {
        const w = fenetre.value[i]!;
        const bille = i < n ? billes[i] : undefined;
        if (!bille) {
          w.w = 0;
          continue;
        }
        v.copy(bille).applyMatrix4(camera.matrixWorldInverse);
        w.set(v.x, v.y, v.z, RAYON * 2.4);
      }
    },
  };
}
