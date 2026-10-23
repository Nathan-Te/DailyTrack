// Lot 40 — les formes des voitures : une caisse **par sections** (des clés le long de la voiture, un demi-profil chacune, interpolées et
// lissées selon le palier), des boîtes, des ailerons extrudés, des passages de roue (lèvre et fond sombre), et une roue complète (pneu, jante à
// branches, moyeu, disque et étrier). Tout s'écrit dans des `Pieces` : un seul maillage par matériau, quel que soit le nombre de pièces.
import type { Fini, Pieces, V3 } from "./pieces";

/** Une clé de la caisse : à l'avance `z`, le demi-profil (x ≥ 0) du bas au centre (x = 0) jusqu'au dessus (x = 0), point par point. */
export interface Cle {
  z: number;
  pts: readonly (readonly [number, number])[];
}

/** Ce que porte un tronçon de profil (entre deux points) : `seg` = son rang, `z` = l'avance du milieu de la face. */
export type FiniCaisse = (seg: number, z: number) => Fini;

/** Interpolation de Catmull-Rom (uniforme) entre `b` et `c`. */
const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);

/** Les clés interpolées : `n` sections entre deux clés (1 : les clés seules). Les profils gardent leur nombre de points. */
export function interpoler(cles: readonly Cle[], n: number): Cle[] {
  if (n <= 1) return cles.map((c) => ({ z: c.z, pts: c.pts }));
  const out: Cle[] = [];
  for (let i = 0; i + 1 < cles.length; i++) {
    const a = cles[Math.max(0, i - 1)]!;
    const b = cles[i]!;
    const c = cles[i + 1]!;
    const d = cles[Math.min(cles.length - 1, i + 2)]!;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      // Le long : linéaire (les clés sont placées là où les zones changent) ; le profil : lissé.
      out.push({ z: b.z + (c.z - b.z) * t, pts: b.pts.map((p, j) => [cr(a.pts[j]![0], p[0], c.pts[j]![0], d.pts[j]![0], t), cr(a.pts[j]![1], p[1], c.pts[j]![1], d.pts[j]![1], t)] as const) });
    }
  }
  out.push(cles[cles.length - 1]!);
  return out;
}

/** Arrondit un demi-profil : chaque tronçon marqué dans `bombe` (rang → flèche relative) est coupé en deux, le milieu poussé vers l'extérieur. */
export function arrondir(pts: readonly (readonly [number, number])[], bombe: Readonly<Record<number, number>>): { pts: [number, number][]; seg: number[] } {
  const out: [number, number][] = [[pts[0]![0], pts[0]![1]]];
  const seg: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const f = bombe[i];
    if (f) {
      // Normale extérieure du tronçon (le profil va du bas au dessus en passant par le flanc : l'extérieur est à droite du sens de parcours).
      const dx = bx - ax;
      const dy = by - ay;
      const l = Math.hypot(dx, dy);
      out.push([(ax + bx) / 2 + (dy / (l || 1)) * f * l, (ay + by) / 2 - (dx / (l || 1)) * f * l]);
      seg.push(i);
    }
    out.push([bx, by]);
    seg.push(i);
  }
  return { pts: out, seg };
}

/**
 * La caisse : les sections reliées deux à deux, un demi-profil et son miroir ; les deux bouts fermés. `fini(seg, z)` choisit la matière de
 * chaque face (peinture, vitre, bas de caisse…) ; `bombe` arrondit les tronçons voulus (paliers 2 et 3).
 */
export function caisse(p: Pieces, sections: readonly Cle[], fini: FiniCaisse, bombe: Readonly<Record<number, number>> = {}, bouts?: { arriere: Fini; avant: Fini }): void {
  const prof = sections.map((s) => arrondir(s.pts, bombe));
  const segs = prof[0]!.seg;
  for (let s = 0; s + 1 < sections.length; s++) {
    const za = sections[s]!.z;
    const zb = sections[s + 1]!.z;
    const A = prof[s]!.pts;
    const B = prof[s + 1]!.pts;
    for (let i = 0; i + 1 < A.length; i++) {
      const f = fini(segs[i]!, (za + zb) / 2);
      for (const m of [1, -1]) {
        const a: V3 = [A[i]![0] * m, A[i]![1], za];
        const b: V3 = [A[i + 1]![0] * m, A[i + 1]![1], za];
        const c: V3 = [B[i + 1]![0] * m, B[i + 1]![1], zb];
        const d: V3 = [B[i]![0] * m, B[i]![1], zb];
        // Faces vers l'extérieur (normales sortantes : la livrée choisit sa projection par elles, le lissage les moyenne).
        if (m > 0) p.quad(a, b, c, d, f);
        else p.quad(a, d, c, b, f);
      }
    }
  }
  if (!bouts) return;
  const fermer = (k: number, f: Fini, avant: boolean) => {
    const pts = prof[k]!.pts;
    const z = sections[k]!.z;
    // Éventail autour d'un point du milieu de la section (le profil est presque convexe).
    const cy = pts.reduce((t, q) => t + q[1], 0) / pts.length;
    const centre: V3 = [0, cy, z];
    for (let i = 0; i + 1 < pts.length; i++) {
      for (const m of [1, -1]) {
        const a: V3 = [pts[i]![0] * m, pts[i]![1], z];
        const b: V3 = [pts[i + 1]![0] * m, pts[i + 1]![1], z];
        if (m > 0 === avant) p.tri(centre, a, b, f);
        else p.tri(centre, b, a, f);
      }
    }
  };
  fermer(0, bouts.arriere, false);
  fermer(sections.length - 1, bouts.avant, true);
}

/** Une boîte : tronc de pyramide de `y0` (largeur 2·`w0`, de `z0` à `z1`) à `y1` (2·`w1`, de `t0` à `t1`), décalée de `dx` ; 12 triangles. */
export function boite(p: Pieces, y0: number, w0: number, z0: number, z1: number, y1: number, w1: number, t0: number, t1: number, f: Fini, dx = 0, dessus?: Fini): void {
  const v: V3[] = [
    [dx + w0, y0, z0], [dx - w0, y0, z0], [dx - w0, y0, z1], [dx + w0, y0, z1],
    [dx + w1, y1, t0], [dx - w1, y1, t0], [dx - w1, y1, t1], [dx + w1, y1, t1],
  ];
  const [a, b, c, d, e, f2, g, h] = v as [V3, V3, V3, V3, V3, V3, V3, V3];
  p.quad(e, f2, g, h, dessus ?? f);
  p.quad(a, e, h, d, f);
  p.quad(b, c, g, f2, f);
  p.quad(d, h, g, c, f);
  p.quad(a, b, f2, e, f);
  p.quad(a, d, c, b, f);
}

/** Une boîte droite entre deux coins. */
export function pave(p: Pieces, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, f: Fini, dessus?: Fini): void {
  boite(p, y0, (x1 - x0) / 2, z0, z1, y1, (x1 - x0) / 2, z0, z1, f, (x0 + x1) / 2, dessus);
}

/** Un profil (z, y) extrudé en travers de `x0` à `x1` (aileron, lame) ; les deux bouts fermés. */
export function extruder(p: Pieces, profil: readonly (readonly [number, number])[], x0: number, x1: number, f: Fini, bouts?: Fini): void {
  const n = profil.length;
  for (let i = 0; i < n; i++) {
    const [za, ya] = profil[i]!;
    const [zb, yb] = profil[(i + 1) % n]!;
    p.quad([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], f);
  }
  const cz = profil.reduce((t, q) => t + q[0], 0) / n;
  const cy = profil.reduce((t, q) => t + q[1], 0) / n;
  for (let i = 0; i < n; i++) {
    const [za, ya] = profil[i]!;
    const [zb, yb] = profil[(i + 1) % n]!;
    p.tri([x0, cy, cz], [x0, yb, zb], [x0, ya, za], bouts ?? f);
    p.tri([x1, cy, cz], [x1, ya, za], [x1, yb, zb], bouts ?? f);
  }
}

/** Le fond sombre d'un passage de roue : un demi-disque (rayon `r`, au-dessus de `y0`) sur le flanc, à `x` (côté `cote`). */
export function fondDePassage(p: Pieces, cote: number, x: number, zc: number, yc: number, r: number, y0: number, n: number, f: Fini): void {
  const pts: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * (k / n);
    pts.push([x * cote, Math.max(y0, yc + Math.sin(a) * r), zc + Math.cos(a) * r]);
  }
  const centre: V3 = [x * cote, y0, zc];
  for (let k = 0; k < n; k++) {
    if (cote > 0) p.tri(centre, pts[k + 1]!, pts[k]!, f);
    else p.tri(centre, pts[k]!, pts[k + 1]!, f);
  }
}

/** La lèvre d'un passage de roue : un arc épais (rayons `r0` à `r1`) qui déborde du flanc de `x0` à `x1`, de l'angle `a0` à `a1` (rad, 0 = avant). */
export function levre(p: Pieces, cote: number, x0: number, x1: number, zc: number, yc: number, r0: number, r1: number, a0: number, a1: number, n: number, f: Fini, dessous?: Fini): void {
  const P = (x: number, r: number, a: number): V3 => [x * cote, yc + Math.sin(a) * r, zc + Math.cos(a) * r];
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const b = a0 + ((a1 - a0) * (k + 1)) / n;
    const q = (A: V3, B: V3, C: V3, D: V3, g: Fini) => (cote > 0 ? p.quad(A, B, C, D, g) : p.quad(A, D, C, B, g));
    q(P(x1, r1, a), P(x1, r1, b), P(x0, r1, b), P(x0, r1, a), f); // dessus
    q(P(x1, r0, a), P(x1, r1, a), P(x1, r1, b), P(x1, r0, b), f); // face
    q(P(x0, r0, a), P(x0, r0, b), P(x1, r0, b), P(x1, r0, a), dessous ?? f); // dessous (vu dans le passage)
  }
}

/** Ce qu'il faut pour une roue : rayon, largeur, segments, nombre de branches, matières. */
export interface PlanRoue {
  rayon: number;
  largeur: number;
  segments: number;
  branches: number;
  /** Jante : rayon relatif (0 à 1), creux de la face (m). */
  jante: number;
  pneu: Fini;
  flanc: Fini;
  metal: Fini;
  fond: Fini;
  moyeu: Fini;
  disque: Fini;
  etrier: Fini;
  /**
   * Le dessin des branches, propre à chaque modèle (retouche 40b) : `lames` (une lame par branche), `doubles` (deux fines au lieu d'une large),
   * `y` (une lame du moyeu qui se fend en deux vers le cerclage), `larges` (des branches pleines et larges, de petites fenêtres : une jante de série).
   */
  dessin?: "lames" | "doubles" | "y" | "larges";
}

/**
 * Une roue complète, centrée sur son axe (x) : pneu (bande et flancs arrondis), jante (cerclage, fond sombre, branches), moyeu (tout cela tourne),
 * disque et étrier (fixes). `cote` = +1 à gauche (la face extérieure vers +x), −1 à droite.
 */
export function roue(p: Pieces, cote: number, r: PlanRoue): void {
  const n = r.segments;
  const R = r.rayon;
  const w = r.largeur / 2;
  const tourne = (f: Fini): Fini => ({ ...f, tourne: true });
  // Pneu : un profil (x, rayon) révolu autour de l'axe x ; de l'intérieur (x = −w) à l'extérieur (x = +w), côté `cote`.
  const profil: [number, number][] = [
    [-w * 0.9, R * r.jante * 1.04],
    [-w, R * 0.86],
    [-w * 0.86, R * 0.98],
    [w * 0.86, R * 0.98],
    [w, R * 0.86],
    [w * 0.9, R * r.jante * 1.04],
  ];
  const fins = [r.flanc, r.pneu, r.pneu, r.pneu, r.flanc];
  const P = (x: number, rr: number, a: number): V3 => [x * cote, Math.sin(a) * rr, Math.cos(a) * rr];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    for (let i = 0; i + 1 < profil.length; i++) {
      const [xa, ra] = profil[i]!;
      const [xb, rb] = profil[i + 1]!;
      const A = P(xa, ra, a), B = P(xb, rb, a), C = P(xb, rb, b), D = P(xa, ra, b);
      if (cote > 0) p.quad(A, D, C, B, tourne(fins[i]!));
      else p.quad(A, B, C, D, tourne(fins[i]!));
    }
  }
  // Jante : le cerclage (un anneau plat en façade), le fond sombre en retrait, les branches, le moyeu.
  const rj = R * r.jante;
  const xf = w * 0.9;
  const xfond = w * 0.15;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    const q = (A: V3, B: V3, C: V3, D: V3, f: Fini) => (cote > 0 ? p.quad(A, B, C, D, f) : p.quad(A, D, C, B, f));
    q(P(xf, rj * 1.04, a), P(xf, rj * 1.04, b), P(xf, rj * 0.88, b), P(xf, rj * 0.88, a), tourne(r.metal)); // lèvre de jante
    q(P(xf, rj * 0.88, a), P(xf, rj * 0.88, b), P(xfond, rj * 0.85, b), P(xfond, rj * 0.85, a), tourne(r.fond)); // cuvette
    const c: V3 = [xfond * cote, 0, 0];
    if (cote > 0) p.tri(c, P(xfond, rj * 0.85, b), P(xfond, rj * 0.85, a), tourne(r.fond));
    else p.tri(c, P(xfond, rj * 0.85, a), P(xfond, rj * 0.85, b), tourne(r.fond));
  }
  // Branches : des lames de l'axe au cerclage, un peu en avant du fond (la face extérieure se lit en tournant).
  const dessin = r.dessin ?? "lames";
  const x0 = xfond + 0.01, x1 = xf - 0.005;
  /** Une lame de `l0` à `l1` (le long du rayon d'angle `a`), de demi-largeur `t0` puis `t1`, décalée de `d` en travers. */
  const lame = (a: number, l0: number, l1: number, t0: number, t1: number, d0 = 0, d1 = 0) => {
    const s = Math.sin(a), co = Math.cos(a);
    const pt = (x: number, l: number, t: number): V3 => [x * cote, s * l + co * t, co * l - s * t];
    const A = pt(x1, l0, d0 - t0), B = pt(x1, l1, d1 - t1), C = pt(x1, l1, d1 + t1), D = pt(x1, l0, d0 + t0);
    const A2 = pt(x0, l0, d0 - t0), B2 = pt(x0, l1, d1 - t1), C2 = pt(x0, l1, d1 + t1), D2 = pt(x0, l0, d0 + t0);
    const q = (E: V3, F: V3, G: V3, H: V3) => (cote > 0 ? p.quad(E, F, G, H, tourne(r.metal)) : p.quad(E, H, G, F, tourne(r.metal)));
    // La face et les deux côtés ; les bouts sont cachés (sous le moyeu, sous la lèvre de jante, ou dans la lame voisine).
    q(A, B, C, D);
    q(A2, B2, B, A);
    q(D, C, C2, D2);
  };
  const k = R / 0.38;
  for (let i = 0; i < r.branches; i++) {
    const a = (i / r.branches) * Math.PI * 2;
    if (dessin === "doubles") for (const d of [-0.11, 0.11]) lame(a + d, rj * 0.18, rj * 0.86, 0.045 * k, 0.036 * k);
    else if (dessin === "y") {
      // Le pied de la lame, puis deux bras qui s'écartent jusqu'au cerclage.
      lame(a, rj * 0.18, rj * 0.5, 0.06 * k, 0.05 * k);
      for (const d of [-1, 1]) lame(a, rj * 0.48, rj * 0.86, 0.03 * k, 0.03 * k, d * 0.03 * k, d * 0.085 * k);
    } else if (dessin === "larges") lame(a, rj * 0.18, rj * 0.86, 0.045 * k, 0.08 * k);
    else lame(a, rj * 0.18, rj * 0.86, 0.075 * k, 0.06 * k);
  }
  // Moyeu : un petit prisme au centre.
  const m = 6;
  const rm = rj * 0.2;
  for (let k = 0; k < m; k++) {
    const a = (k / m) * Math.PI * 2;
    const b = ((k + 1) / m) * Math.PI * 2;
    const q = (A: V3, B: V3, C: V3, D: V3) => (cote > 0 ? p.quad(A, B, C, D, tourne(r.moyeu)) : p.quad(A, D, C, B, tourne(r.moyeu)));
    q(P(xf + 0.005, rm, a), P(xf + 0.005, rm, b), P(xfond, rm, b), P(xfond, rm, a));
    const c: V3 = [(xf + 0.005) * cote, 0, 0];
    if (cote > 0) p.tri(c, P(xf + 0.005, rm, a), P(xf + 0.005, rm, b), tourne(r.moyeu));
    else p.tri(c, P(xf + 0.005, rm, b), P(xf + 0.005, rm, a), tourne(r.moyeu));
  }
  // Disque (fixe, on le voit à travers les branches) et étrier (fixe, en haut à l'arrière du disque).
  const nd = Math.max(8, Math.round(n / 2));
  const xd = -w * 0.2;
  for (let k = 0; k < nd; k++) {
    const a = (k / nd) * Math.PI * 2;
    const b = ((k + 1) / nd) * Math.PI * 2;
    const c: V3 = [xd * cote, 0, 0];
    if (cote > 0) p.tri(c, P(xd, rj * 0.78, b), P(xd, rj * 0.78, a), r.disque);
    else p.tri(c, P(xd, rj * 0.78, a), P(xd, rj * 0.78, b), r.disque);
  }
  boite(p, rj * 0.45, 0.04, -rj * 0.42, -rj * 0.05, rj * 0.82, 0.04, -rj * 0.36, -rj * 0.1, r.etrier, xd * cote + 0.02 * cote);
}

/** Un prisme à `n` côtés autour de l'axe x (roue simple d'un fantôme, échappement…). */
export function prismeX(p: Pieces, x0: number, x1: number, yc: number, zc: number, r: number, n: number, f: Fini, phase = 0): void {
  for (let k = 0; k < n; k++) {
    const a = phase + (k / n) * Math.PI * 2;
    const b = phase + ((k + 1) / n) * Math.PI * 2;
    const P = (x: number, t: number): V3 => [x, yc + Math.sin(t) * r, zc + Math.cos(t) * r];
    p.quad(P(x0, a), P(x1, a), P(x1, b), P(x0, b), f);
    p.tri([x0, yc, zc], P(x0, a), P(x0, b), f);
    p.tri([x1, yc, zc], P(x1, b), P(x1, a), f);
  }
}

/** Un prisme à `n` côtés autour de l'axe z (échappement, rétroviseur rond). */
export function prismeZ(p: Pieces, z0: number, z1: number, xc: number, yc: number, r: number, n: number, f: Fini, bout?: Fini): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    const P = (z: number, t: number): V3 => [xc + Math.cos(t) * r, yc + Math.sin(t) * r, z];
    p.quad(P(z0, a), P(z0, b), P(z1, b), P(z1, a), f);
    p.tri([xc, yc, z0], P(z0, b), P(z0, a), bout ?? f);
    p.tri([xc, yc, z1], P(z1, a), P(z1, b), f);
  }
}

/** Une section décrite par ses repères : le bas, le bas de caisse, le flanc, l'épaule, le pied de vitre, le bord du toit, le dessus (y au centre). */
export interface Sec {
  bas: number;
  seuil: readonly [number, number];
  flanc: readonly [number, number];
  epaule: readonly [number, number];
  vitre: readonly [number, number];
  toit: readonly [number, number];
  dessus: number;
}

/**
 * Une clé à neuf points (rangs des tronçons : 0 dessous, 1 bas de caisse, 2 flanc bas, 3 flanc, 4 épaule, 5 flanc vitré, 6 montant et bord du
 * toit, 7 dessus) : le bord du toit garde 9 cm de peinture (montants du pare-brise et de la lunette), le dessus est vitré dans les zones voulues.
 */
export const cle = (z: number, s: Sec): Cle => ({
  z,
  pts: [[0, s.bas], [Math.max(0.05, s.seuil[0] - 0.1), s.bas], s.seuil, s.flanc, s.epaule, s.vitre, s.toit, [Math.max(0.04, s.toit[0] - 0.09), s.dessus - 0.012], [0, s.dessus]],
});

/** Le dessus d'une section sans habitacle (capot, coffre) : du pied de l'épaule au centre, presque plat (`creux` : creux au centre, négatif). */
export const pont = (epaule: readonly [number, number], dessus: number, creux = 0): Pick<Sec, "vitre" | "toit" | "dessus"> => ({
  vitre: [epaule[0] - 0.05, epaule[1] + (dessus - epaule[1]) * 0.45],
  toit: [epaule[0] * 0.62, dessus + creux * 0.6],
  dessus: dessus + creux,
});
