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
export function levre(p: Pieces, cote: number, x0: number, x1: number, zc: number, yc: number, r0: number, r1: number, a0: number, a1: number, n: number, f: Fini, dessous?: Fini, ymax = Infinity): void {
  const P = (x: number, r: number, a: number): V3 => [x * cote, yc + Math.sin(a) * r, zc + Math.cos(a) * r];
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const b = a0 + ((a1 - a0) * (k + 1)) / n;
    // `ymax` : la lèvre s'arrête là où la tôle de l'aile s'arrête (le capot de la voiture passe sous le haut de la roue).
    if (yc + Math.sin(a) * r1 > ymax && yc + Math.sin(b) * r1 > ymax) continue;
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
  /** Jante : rayon relatif (0 à 1). */
  jante: number;
  pneu: Fini;
  flanc: Fini;
  /** Le liseré du flanc (marquage clair, lot 40c) ; le flanc par défaut. */
  marque?: Fini;
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
 * Une roue complète (lot 40c), centrée sur son axe (x) : un pneu à flancs arrondis (bande de roulement, épaules, flancs, liseré), une jante claire (lèvre, fût
 * sombre, branches en relief et biseautées, cache-moyeu), derrière elles un disque de frein bien visible et son étrier. Tout cela tourne (shader) sauf le
 * disque et l'étrier. `cote` = +1 à gauche (la face extérieure vers +x), −1 à droite. À moins de 20 segments (palier 1), le pneu a moins de pas de profil.
 */
export function roue(p: Pieces, cote: number, r: PlanRoue): void {
  const n = r.segments;
  const R = r.rayon;
  const w = r.largeur / 2;
  const fin = n >= 20;
  const rj = R * r.jante;
  const tourne = (f: Fini): Fini => ({ ...f, tourne: true });
  const lisse = (f: Fini, g: number): Fini => ({ ...tourne(f), groupe: g });
  const P = (x: number, rr: number, a: number): V3 => [x * cote, Math.sin(a) * rr, Math.cos(a) * rr];
  // Le pneu (révolution de l'intérieur à l'extérieur) et le reste (face vers +x, rayon décroissant) n'ont pas le même sens d'écriture : `qT` pour le pneu.
  const qT = (A: V3, B: V3, C: V3, D: V3, f: Fini) => (cote > 0 ? p.quad(A, B, C, D, f) : p.quad(A, D, C, B, f));
  const q = (A: V3, B: V3, C: V3, D: V3, f: Fini) => (cote > 0 ? p.quad(A, D, C, B, f) : p.quad(A, B, C, D, f));
  const t3 = (A: V3, B: V3, C: V3, f: Fini) => (cote > 0 ? p.tri(A, C, B, f) : p.tri(A, B, C, f));
  const marque = r.marque ?? r.flanc;
  const gPneu = p.nouveauGroupe();
  const gFlanc = p.nouveauGroupe();
  const gJante = p.nouveauGroupe();

  // --- Le pneu : un profil (x, rayon) révolu autour de l'axe x, de l'intérieur (x < 0) à l'extérieur (x > 0). --------------------------------------
  const hf = R - rj;
  const profil: [number, number, Fini][] = fin
    ? [
        [-0.86 * w, rj * 1.03, lisse(r.flanc, gFlanc)],
        [-0.99 * w, rj + hf * 0.42, lisse(r.flanc, gFlanc)],
        [-0.95 * w, rj + hf * 0.8, lisse(r.flanc, gFlanc)],
        [-0.76 * w, R * 0.995, lisse(r.pneu, gPneu)],
        [-0.32 * w, R, lisse(r.pneu, gPneu)],
        [0.32 * w, R, lisse(r.pneu, gPneu)],
        [0.76 * w, R * 0.995, lisse(r.pneu, gPneu)],
        [0.95 * w, rj + hf * 0.8, lisse(r.flanc, gFlanc)],
        [0.99 * w, rj + hf * 0.42, lisse(r.flanc, gFlanc)],
        [0.86 * w, rj * 1.03, lisse(r.flanc, gFlanc)],
      ]
    : [
        [-0.86 * w, rj * 1.03, lisse(r.flanc, gFlanc)],
        [-0.99 * w, rj + hf * 0.5, lisse(r.flanc, gFlanc)],
        [-0.72 * w, R * 0.995, lisse(r.pneu, gPneu)],
        [-0.3 * w, R, lisse(r.pneu, gPneu)],
        [0.3 * w, R, lisse(r.pneu, gPneu)],
        [0.72 * w, R * 0.995, lisse(r.pneu, gPneu)],
        [0.99 * w, rj + hf * 0.5, lisse(r.flanc, gFlanc)],
        [0.86 * w, rj * 1.03, lisse(r.flanc, gFlanc)],
      ];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    for (let i = 0; i + 1 < profil.length; i++) {
      const [xa, ra] = profil[i]!;
      const [xb, rb, f] = profil[i + 1]!;
      qT(P(xa, ra, a), P(xb, rb, a), P(xb, rb, b), P(xa, ra, b), f);
    }
    // Le liseré du flanc extérieur : un anneau clair, à mi-hauteur du flanc (il fait tourner la roue aux yeux).
    const xm = 0.995 * w;
    if (fin) q(P(xm, rj + hf * 0.5, a), P(xm, rj + hf * 0.62, a), P(xm, rj + hf * 0.62, b), P(xm, rj + hf * 0.5, b), tourne(marque));
  }

  // --- La jante : la lèvre, le fût sombre, les branches, le cache-moyeu. -----------------------------------------------------------------------
  const xf = w * 0.9; // la face de la jante
  const xfond = -w * 0.35; // le fond du fût
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    q(P(xf, rj * 1.03, a), P(xf, rj * 1.03, b), P(xf, rj * 0.9, b), P(xf, rj * 0.9, a), lisse(r.metal, gJante)); // la lèvre
    q(P(xf, rj * 0.9, a), P(xf, rj * 0.9, b), P(xfond, rj * 0.84, b), P(xfond, rj * 0.84, a), tourne(r.fond)); // le fût
  }
  const dessin = r.dessin ?? "lames";
  const x1 = xf - 0.004; // la face des branches
  const x0 = xf - 0.04; // leur pied
  /** Une branche de `l0` à `l1` le long du rayon d'angle `a` : une face claire, deux flancs biseautés (le pied est plus large que la face). */
  const lame = (a: number, l0: number, l1: number, t0: number, t1: number, d0 = 0, d1 = 0) => {
    const s = Math.sin(a), co = Math.cos(a);
    const pt = (x: number, l: number, t: number): V3 => [x * cote, s * l + co * t, co * l - s * t];
    const A = pt(x1, l0, d0 - t0), B = pt(x1, l1, d1 - t1), C = pt(x1, l1, d1 + t1), D = pt(x1, l0, d0 + t0);
    const A2 = pt(x0, l0, d0 - t0 * 1.35), B2 = pt(x0, l1, d1 - t1 * 1.35), C2 = pt(x0, l1, d1 + t1 * 1.35), D2 = pt(x0, l0, d0 + t0 * 1.35);
    const m = (E: V3, F: V3, G: V3, H: V3, f: Fini) => (cote > 0 ? p.quad(E, H, G, F, f) : p.quad(E, F, G, H, f));
    m(A, B, C, D, tourne(r.metal));
    m(A2, B2, B, A, tourne(r.metal));
    m(D, C, C2, D2, tourne(r.metal));
  };
  const k = R / 0.38;
  for (let i = 0; i < r.branches; i++) {
    const a = (i / r.branches) * Math.PI * 2;
    if (dessin === "doubles") for (const d of [-0.11, 0.11]) lame(a + d, rj * 0.2, rj * 0.88, 0.05 * k, 0.04 * k);
    else if (dessin === "y") {
      lame(a, rj * 0.2, rj * 0.52, 0.066 * k, 0.054 * k);
      for (const d of [-1, 1]) lame(a, rj * 0.5, rj * 0.88, 0.036 * k, 0.034 * k, d * 0.03 * k, d * 0.09 * k);
    } else if (dessin === "larges") lame(a, rj * 0.2, rj * 0.88, 0.046 * k, 0.07 * k);
    else lame(a, rj * 0.2, rj * 0.88, 0.082 * k, 0.066 * k);
  }
  // Le cache-moyeu : un disque bombé (clair) et, en détail, cinq écrous.
  const rm = rj * 0.22;
  const xm = xf + 0.012;
  const m = fin ? 12 : 8;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    const b = ((i + 1) / m) * Math.PI * 2;
    q(P(x0, rm * 1.1, a), P(x0, rm * 1.1, b), P(xm - 0.006, rm, b), P(xm - 0.006, rm, a), tourne(r.moyeu));
    t3([xm * cote, 0, 0], P(xm - 0.006, rm, a), P(xm - 0.006, rm, b), tourne(r.moyeu));
  }
  if (fin) {
    for (let i = 0; i < r.branches; i++) {
      const a = ((i + 0.5) / r.branches) * Math.PI * 2;
      const ca = Math.cos(a) * rm * 0.55;
      const sa = Math.sin(a) * rm * 0.55;
      const bolt: Fini = { ...tourne(r.fond), groupe: p.nouveauGroupe() };
      for (let j = 0; j < 5; j++) {
        const u = (j / 5) * Math.PI * 2;
        const v = ((j + 1) / 5) * Math.PI * 2;
        const rr = rm * 0.17;
        const B1: V3 = [(xm + 0.006) * cote, sa + Math.sin(u) * rr, ca + Math.cos(u) * rr];
        const B2: V3 = [(xm + 0.006) * cote, sa + Math.sin(v) * rr, ca + Math.cos(v) * rr];
        t3([(xm + 0.006) * cote, sa, ca], B1, B2, bolt);
      }
    }
  }

  // --- Le disque (fixe, derrière les branches : on le voit) et l'étrier (fixe, en haut à l'arrière). ----------------------------------------------
  const nd = Math.max(10, Math.round(n * 0.75));
  const xd = -w * 0.18;
  const e = 0.008;
  for (let i = 0; i < nd; i++) {
    const a = (i / nd) * Math.PI * 2;
    const b = ((i + 1) / nd) * Math.PI * 2;
    q(P(xd + e, rj * 0.86, a), P(xd + e, rj * 0.86, b), P(xd + e, rj * 0.34, b), P(xd + e, rj * 0.34, a), r.disque); // la face
    q(P(xd - e, rj * 0.86, b), P(xd - e, rj * 0.86, a), P(xd - e, rj * 0.34, a), P(xd - e, rj * 0.34, b), r.disque); // l'envers
    q(P(xd + e, rj * 0.86, a), P(xd - e, rj * 0.86, a), P(xd - e, rj * 0.86, b), P(xd + e, rj * 0.86, b), r.disque); // la tranche
    // Le bol du disque, plus sombre, vers le moyeu.
    q(P(xd + e, rj * 0.34, a), P(xd + e, rj * 0.34, b), P(x0, rj * 0.24, b), P(x0, rj * 0.24, a), r.fond);
  }
  const na = fin ? 4 : 0;
  const a0 = 0.35 * Math.PI;
  const a1 = 0.75 * Math.PI;
  for (let i = 0; i < na; i++) {
    const a = a0 + ((a1 - a0) * i) / na;
    const b = a0 + ((a1 - a0) * (i + 1)) / na;
    const rr0 = rj * 0.5;
    const rr1 = rj * 0.9;
    const xe0 = xd - 0.045;
    const xe1 = xd + 0.05;
    q(P(xe1, rr1, a), P(xe1, rr1, b), P(xe0, rr1, b), P(xe0, rr1, a), r.etrier); // le dessus
    q(P(xe1, rr0, a), P(xe1, rr1, a), P(xe1, rr1, b), P(xe1, rr0, b), r.etrier); // la face
    q(P(xe0, rr1, a), P(xe0, rr0, a), P(xe0, rr0, b), P(xe0, rr1, b), r.etrier); // le côté intérieur
    q(P(xe0, rr0, a), P(xe1, rr0, a), P(xe1, rr0, b), P(xe0, rr0, b), r.etrier); // le dessous
  }
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
