// Les orientations (lot V1) : la gravité tourne par QUARTS DE TOUR, donc le repère du joueur est l'une des 24 rotations du cube. Une orientation est une matrice 3 × 3 d'entiers (−1, 0 ou 1, une seule valeur non nulle par
// ligne et par colonne, déterminant 1) qui range les axes du repère LOCAL du joueur (x = sa droite à lacet nul, y = son haut, z = son arrière) dans le MONDE : monde = M · local. Au départ, M = identité : le repère local est le
// monde et la gravité va vers −y. Tout est entier, aucun flottant, aucune fonction transcendante : les mêmes matrices sur toutes les machines.
export type Mat = readonly number[]; // 9 entiers, rangée par rangée : monde_i = Σ_j m[3 i + j] · local_j
export type V3 = readonly [number, number, number];

export const IDENTITE: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Les six directions du monde : 0 = +x, 1 = −x, 2 = +y, 3 = −y, 4 = +z, 5 = −z. Pour la gravité, c'est le sens de la chute (le bas). */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5;
export const DIRS: readonly V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const DIR_BAS: Dir = 3;
export const DIR_HAUT: Dir = 2;
/** La direction (0 à 5) d'un vecteur unité sur un axe, ou −1. */
export function dirDe(v: V3): number {
  return DIRS.findIndex((d) => d[0] === v[0] && d[1] === v[1] && d[2] === v[2]);
}
export const oppose = (d: number): Dir => (d ^ 1) as Dir;

export const mul = (a: Mat, b: Mat): Mat => {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[3 * i]! * b[j]! + a[3 * i + 1]! * b[3 + j]! + a[3 * i + 2]! * b[6 + j]! + 0);
  return r;
};
export const trans = (a: Mat): Mat => [a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!];
/** M · v (local → monde). Le `+ 0` écarte les zéros négatifs. */
export const appliquer = (m: Mat, v: V3): V3 => [m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2] + 0, m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2] + 0, m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2] + 0];
/** Mᵀ · v (monde → local). */
export const appliquerT = (m: Mat, v: V3): V3 => [m[0]! * v[0] + m[3]! * v[1] + m[6]! * v[2] + 0, m[1]! * v[0] + m[4]! * v[1] + m[7]! * v[2] + 0, m[2]! * v[0] + m[5]! * v[1] + m[8]! * v[2] + 0];
export const croix = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1] + 0, a[2] * b[0] - a[0] * b[2] + 0, a[0] * b[1] - a[1] * b[0] + 0];
const cle = (m: Mat): string => m.join(",");

/** Le quart de tour (+90°, règle de la main droite) autour d'un axe unité : R v = (a·v) a + a × v. */
export function quartDeTour(axe: V3): Mat {
  const col = (e: V3): V3 => {
    const p = axe[0] * e[0] + axe[1] * e[1] + axe[2] * e[2];
    const c = croix(axe, e);
    return [p * axe[0] + c[0] + 0, p * axe[1] + c[1] + 0, p * axe[2] + c[2] + 0];
  };
  const [c0, c1, c2] = [col([1, 0, 0]), col([0, 1, 0]), col([0, 0, 1])];
  return [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
}
/** Le demi-tour autour d'un axe unité : R v = 2 (a·v) a − v. */
export function demiTour(axe: V3): Mat {
  const col = (e: V3): V3 => {
    const p = 2 * (axe[0] * e[0] + axe[1] * e[1] + axe[2] * e[2]);
    return [p * axe[0] - e[0] + 0, p * axe[1] - e[1] + 0, p * axe[2] - e[2] + 0];
  };
  const [c0, c1, c2] = [col([1, 0, 0]), col([0, 1, 0]), col([0, 0, 1])];
  return [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
}

// Les 24 orientations, numérotées dans l'ordre d'un parcours en largeur depuis l'identité (trois quarts de tour générateurs, ordre fixe) : le numéro fait partie de l'état et des empreintes.
export const ORIENTATIONS: readonly Mat[] = (() => {
  const gens = [quartDeTour([1, 0, 0]), quartDeTour([0, 1, 0]), quartDeTour([0, 0, 1])];
  const liste: Mat[] = [IDENTITE];
  const vus = new Set<string>([cle(IDENTITE)]);
  for (let i = 0; i < liste.length; i++) {
    for (const g of gens) {
      const n = mul(g, liste[i]!);
      if (!vus.has(cle(n))) {
        vus.add(cle(n));
        liste.push(n);
      }
    }
  }
  return liste;
})();
const INDEX = new Map<string, number>(ORIENTATIONS.map((m, i) => [cle(m), i]));
/** Le numéro (0 à 23) d'une matrice d'orientation. */
export function numeroOrientation(m: Mat): number {
  const i = INDEX.get(cle(m));
  if (i === undefined) throw new Error("orientation inconnue");
  return i;
}

/** Le sens de la gravité (le bas du joueur) dans le monde pour une orientation : M · (0, −1, 0). */
export function gravite(m: Mat): Dir {
  return dirDe(appliquer(m, [0, -1, 0])) as Dir;
}
