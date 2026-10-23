// Lot 38 — outils de géométrie des directions de la scène (vitrine `/track/vitrine/`, puis lots de mise en œuvre) : un repère posé sur un bloc,
// des boîtes, boîtes chanfreinées, tubes et bandes dans ce repère, tout dans un `Builder` (maillage fusionné à couleurs par sommet : un appel de rendu
// par calque, quel que soit le nombre de pièces). Présentation seule : rien ne touche à `sim`.
import { CELL, blockHeight, type Block } from "@cdj/sim";
import { Builder, world, type V3 } from "../meshKit";

/** Repère local : origine, avant (le sens de la course), gauche, haut. Tous unitaires, haut = vertical. */
export interface Repere {
  o: V3;
  f: V3;
  l: V3;
}

const unit = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Repère d'un bloc droit à l'abscisse `q` (axe de la route, à la hauteur de la route), décalé de `p` m vers la gauche. */
export function repereBloc(b: Block, q: number, p = 0): Repere {
  const y = blockHeight(b, q);
  const o = world(b, CELL / 2 + p, q, y);
  const f = unit(sub(world(b, CELL / 2 + p, q + 1, y), o));
  const l = unit(sub(world(b, CELL / 2 + p + 1, q, y), o));
  return { o, f: [f[0], 0, f[2]], l: [l[0], 0, l[2]] };
}

/** Repère au sol en (x, y, z), avant selon l'angle `a` (rad, 0 = +z). */
export function repereSol(x: number, y: number, z: number, a = 0): Repere {
  const f: V3 = [Math.sin(a), 0, Math.cos(a)];
  return { o: [x, y, z], f, l: [f[2], 0, -f[0]] };
}

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Point du repère : `g` m à gauche, `h` m en haut, `a` m en avant. */
export function pt(r: Repere, g: number, h: number, a: number): V3 {
  return [r.o[0] + r.l[0] * g + r.f[0] * a, r.o[1] + h, r.o[2] + r.l[2] * g + r.f[2] * a];
}

/** Boîte du repère : de `g0` à `g1` (gauche), `h0` à `h1` (haut), `a0` à `a1` (avant). `dessous` : la face du dessous (souvent invisible : omise). */
export function boite(b: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a0: number, a1: number, couleur: number, cotes = couleur, dessous = false) {
  if (b.mute) return;
  // Les huit coins, calculés une fois (lot 44 : la construction du décor en pose des milliers) ; mêmes points, même ordre qu'avant.
  const P = (g: number, h: number, a: number) => pt(r, g, h, a);
  const b00 = P(g0, h0, a0), b10 = P(g1, h0, a0), b01 = P(g0, h0, a1), b11 = P(g1, h0, a1);
  const t00 = P(g0, h1, a0), t10 = P(g1, h1, a0), t01 = P(g0, h1, a1), t11 = P(g1, h1, a1);
  b.quad(t00, t10, t11, t01, couleur); // dessus
  b.quad(b00, b10, t10, t00, cotes); // arrière (vers a0)
  b.quad(b11, b01, t01, t11, cotes); // avant
  b.quad(b01, b00, t00, t01, cotes); // droite (g0)
  b.quad(b10, b11, t11, t10, cotes); // gauche (g1)
  if (dessous) b.quad(b01, b11, b10, b00, cotes);
}

/** Boîte chanfreinée : arêtes du haut coupées à 45° de `c` m (B : pièces « fabriquées », moins de faces vives). */
export function boiteChanfreinee(b: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a0: number, a1: number, c: number, couleur: number, chanfrein = couleur) {
  const P = (g: number, h: number, a: number) => pt(r, g, h, a);
  const hc = h1 - c;
  // Corps (sous le chanfrein)
  b.quad(P(g0, h0, a0), P(g1, h0, a0), P(g1, hc, a0), P(g0, hc, a0), couleur);
  b.quad(P(g1, h0, a1), P(g0, h0, a1), P(g0, hc, a1), P(g1, hc, a1), couleur);
  b.quad(P(g0, h0, a1), P(g0, h0, a0), P(g0, hc, a0), P(g0, hc, a1), couleur);
  b.quad(P(g1, h0, a0), P(g1, h0, a1), P(g1, hc, a1), P(g1, hc, a0), couleur);
  // Chanfreins (quatre pans) et dessus
  b.quad(P(g0, hc, a0), P(g1, hc, a0), P(g1 - c, h1, a0 + c), P(g0 + c, h1, a0 + c), chanfrein);
  b.quad(P(g1, hc, a1), P(g0, hc, a1), P(g0 + c, h1, a1 - c), P(g1 - c, h1, a1 - c), chanfrein);
  b.quad(P(g0, hc, a1), P(g0, hc, a0), P(g0 + c, h1, a0 + c), P(g0 + c, h1, a1 - c), chanfrein);
  b.quad(P(g1, hc, a0), P(g1, hc, a1), P(g1 - c, h1, a1 - c), P(g1 - c, h1, a0 + c), chanfrein);
  b.quad(P(g0 + c, h1, a0 + c), P(g1 - c, h1, a0 + c), P(g1 - c, h1, a1 - c), P(g0 + c, h1, a1 - c), couleur);
}

/** Quadrilatère plat posé dans le plan (gauche, avant) à la hauteur `h` : marquage au sol. */
export function sol(b: Builder, r: Repere, g0: number, g1: number, a0: number, a1: number, h: number, couleur: number) {
  b.quad(pt(r, g0, h, a0), pt(r, g1, h, a0), pt(r, g1, h, a1), pt(r, g0, h, a1), couleur);
}

/** Panneau vertical dans le plan (gauche, haut), face vers l'arrière du repère (vers qui arrive), à l'avance `a`. */
export function face(b: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a: number, couleur: number) {
  b.quad(pt(r, g1, h0, a), pt(r, g0, h0, a), pt(r, g0, h1, a), pt(r, g1, h1, a), couleur);
}

/** Tube (cylindre à `cotes` pans) de `a` à `b`, rayon `rayon` : mâts obliques, câbles, arche gonflable, glissières. */
export function tube(g: Builder, a: V3, b: V3, rayon: number, cotes: number, couleur: number, rayonB = rayon) {
  const ax = unit(sub(b, a));
  // Deux axes perpendiculaires à l'axe du tube.
  const ref: V3 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const n1 = unit(cross(ax, ref));
  const n2 = cross(ax, n1);
  const ring = (c: V3, r: number, k: number): V3 => {
    const t = (k / cotes) * Math.PI * 2;
    const cs = Math.cos(t) * r;
    const sn = Math.sin(t) * r;
    return [c[0] + n1[0] * cs + n2[0] * sn, c[1] + n1[1] * cs + n2[1] * sn, c[2] + n1[2] * cs + n2[2] * sn];
  };
  for (let k = 0; k < cotes; k++) g.quad(ring(a, rayon, k), ring(a, rayon, k + 1), ring(b, rayonB, k + 1), ring(b, rayonB, k), couleur);
}

export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Bandes de livrée (charte « Cartouches » : rayures à 115°) sur un panneau vertical du repère, de `g0` à `g1` et de `h0` à `h1`, à l'avance `a` :
 * bandes de largeur `l`, couleurs alternées. Découpées en parallélogrammes, coupés aux bords du panneau.
 */
export function livree(b: Builder, r: Repere, g0: number, g1: number, h0: number, h1: number, a: number, l: number, c1: number, c2: number) {
  const pente = Math.tan((25 * Math.PI) / 180); // 115° depuis l'horizontale = 25° depuis la verticale
  const haut = h1 - h0;
  const decal = haut * pente;
  // Fond, puis les bandes claires par-dessus (un peu devant pour ne pas scintiller)
  face(b, r, g0, g1, h0, h1, a, c1);
  for (let x = g0 - decal; x < g1; x += l * 2) {
    const pts: [number, number][] = [
      [x, h0],
      [x + l, h0],
      [x + l + decal, h1],
      [x + decal, h1],
    ];
    const clip = pts.map(([g, h]) => [Math.min(g1, Math.max(g0, g)), h] as [number, number]);
    const P = (i: number) => pt(r, clip[i]![0], clip[i]![1], a - 0.01);
    if (clip[1]![0] - clip[0]![0] < 1e-3 && clip[2]![0] - clip[3]![0] < 1e-3) continue;
    b.quad(P(1), P(0), P(3), P(2), c2);
  }
}

/** Repère d'un tronçon de `a` à `b` (au sol) : avant le long du tronçon, origine en `a`. */
export function repereSegment(a: V3, b: V3): Repere {
  const f = unit([b[0] - a[0], 0, b[2] - a[2]]);
  return { o: a, f, l: [f[2], 0, -f[0]] };
}

/**
 * Affiches : des quadrilatères texturés par un **atlas** (une seule texture, un seul maillage, un seul appel de rendu pour toutes les affiches,
 * logos de sponsors fictifs et bandeaux de B). `rect` = [u0, v0, u1, v1] dans l'atlas.
 */
export class Affiches {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  quad(a: V3, b: V3, c: V3, d: V3, rect: readonly [number, number, number, number]) {
    const [u0, v0, u1, v1] = rect;
    for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]] as const) {
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(u, v);
    }
  }
  /** Une affiche dans le plan (gauche, haut) du repère, lue depuis l'arrière du repère (qui arrive), à l'avance `a`. */
  face(r: Repere, g0: number, g1: number, h0: number, h1: number, a: number, rect: readonly [number, number, number, number]) {
    this.quad(pt(r, g1, h0, a), pt(r, g0, h0, a), pt(r, g0, h1, a), pt(r, g1, h1, a), rect);
  }
}
