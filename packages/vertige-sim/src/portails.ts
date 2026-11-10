import { CM } from "./constantes";
import type { Boite } from "./niveaux";
import { DIRS, appliquer, croix, mul, trans, type Dir, type Mat, type V3 } from "./orientation";

// Les portails (lot V1) : des PAIRES d'ouvertures de taille fixe, percées dans un mur fait de blocs. Chaque portail est un rectangle dans un plan aligné sur les axes : son centre, sa normale (le côté d'où l'on vient,
// vers la pièce), et son « haut » (le grand côté de l'ouverture). Derrière le plan, une poche vide de `PORTAIL_PROFONDEUR` de profondeur et de la section de l'ouverture : c'est là que la boîte du joueur s'enfonce
// avant que son CENTRE ne passe le plan. Les niveaux sont construits pour que la poche ne contienne aucun bloc (un test le vérifie) : une boîte à cheval sur un plan ne touche donc jamais la géométrie de l'autre côté,
// et la simulation n'a aucun cas particulier de collision pour les portails (règle « à cheval », `docs/vertige/consignes.md`).
/** Demi-largeur (0,8 m), demi-hauteur (1,2 m) de l'ouverture, profondeur de la poche (1,0 m ≥ la demi-hauteur 0,9 m de la boîte) : les mêmes pour tous les portails. */
export const PORTAIL_DEMI_L = 80 * CM;
export const PORTAIL_DEMI_H = 120 * CM;
export const PORTAIL_PROFONDEUR = 100 * CM;

export interface Portail {
  /** Le centre de l'ouverture, sur le plan (µm). */
  x: number;
  y: number;
  z: number;
  /** La normale, vers la pièce (0 à 5 : +x, −x, +y, −y, +z, −z). */
  normale: Dir;
  /** Le haut de l'ouverture (une direction perpendiculaire à la normale). */
  haut: Dir;
}
export interface Paire {
  a: Portail;
  b: Portail;
}

/** Un portail vu par la simulation : ses vecteurs unité (normale, haut, droite = haut × normale) et son centre. */
export interface Geo {
  centre: V3;
  n: V3;
  u: V3;
  r: V3;
}
export const geo = (p: Portail): Geo => {
  const n = DIRS[p.normale]!;
  const u = DIRS[p.haut]!;
  return { centre: [p.x, p.y, p.z], n, u, r: croix(u, n) };
};

/** Un sens de traversée : entrer par `de`, sortir par `vers`. `R` est la rotation du monde (quarts de tour) qui envoie le sens d'entrée (−normale de `de`) sur le sens de sortie (normale de `vers`) et le haut de `de` sur celui de `vers`. */
export interface Liaison {
  de: Geo;
  vers: Geo;
  R: Mat;
}
const colonnes = (c0: V3, c1: V3, c2: V3): Mat => [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
const neg = (v: V3): V3 => [0 - v[0], 0 - v[1], 0 - v[2]];
export function liaison(de: Geo, vers: Geo): Liaison {
  const e1 = neg(de.n);
  const fa = colonnes(e1, de.u, croix(e1, de.u));
  const fb = colonnes(vers.n, vers.u, croix(vers.n, vers.u));
  return { de, vers, R: mul(fb, trans(fa)) };
}
/** Les deux sens d'une paire : a → b, puis b → a. */
export function liaisons(p: Paire): [Liaison, Liaison] {
  const a = geo(p.a);
  const b = geo(p.b);
  return [liaison(a, b), liaison(b, a)];
}

/** La rotation d'une liaison appliquée à un point du monde : R (p − centre de `de`) + centre de `vers`. */
export function traverserPoint(l: Liaison, p: V3): V3 {
  const d: V3 = [p[0] - l.de.centre[0], p[1] - l.de.centre[1], p[2] - l.de.centre[2]];
  const r = appliquer(l.R, d);
  return [r[0] + l.vers.centre[0], r[1] + l.vers.centre[1], r[2] + l.vers.centre[2]];
}

/** Une boîte du monde décrite dans le repère d'un portail (r = droite, u = haut, n = normale ; intervalles en µm autour du centre du portail). */
export function boiteRepere(centre: V3, r: V3, u: V3, n: V3, rr: readonly [number, number], uu: readonly [number, number], nn: readonly [number, number]): Boite {
  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  for (const [v, [a, b]] of [[r, rr], [u, uu], [n, nn]] as const) {
    for (let i = 0; i < 3; i++) {
      if (v[i] === 0) continue;
      lo[i] = centre[i]! + (v[i]! > 0 ? a : -b);
      hi[i] = centre[i]! + (v[i]! > 0 ? b : -a);
    }
  }
  return { x0: lo[0]!, y0: lo[1]!, z0: lo[2]!, x1: hi[0]!, y1: hi[1]!, z1: hi[2]! };
}

/** La poche d'un portail : le volume qui doit rester vide derrière son plan (la section de l'ouverture sur `PORTAIL_PROFONDEUR`). */
export function poche(p: Portail): Boite {
  const g = geo(p);
  return boiteRepere(g.centre, g.r, g.u, g.n, [-PORTAIL_DEMI_L, PORTAIL_DEMI_L], [-PORTAIL_DEMI_H, PORTAIL_DEMI_H], [-PORTAIL_PROFONDEUR, 0]);
}
