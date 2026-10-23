// Lot 42 — l'atelier des six voitures du lot (modèles D à I) : les formes qui manquaient aux quatre premières — un tube entre deux points (arceaux,
// pare-buffle, barres de toit), un carénage de roue fermé (ailes de monoplace, élargisseurs de caisse), un phare rond dans son boîtier. Un morceau
// partagé par ces six voitures, chargé à la demande avec la première d'entre elles (`vite.config.ts`) : rien au premier chargement. Rendu seul.
import { prismeZ } from "./forme";
import type { Fini, Pieces, V3 } from "./pieces";

const moins = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vect = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unite = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Un tube à `n` côtés de `a` à `b`, de rayon `r`, fermé aux deux bouts (arceau, pare-buffle, barre de toit, pied). */
export function tube(p: Pieces, a: V3, b: V3, r: number, n: number, f: Fini): void {
  const d = unite(moins(b, a));
  const u = unite(vect(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const v = vect(d, u);
  const P = (o: V3, t: number): V3 => [o[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, o[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, o[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r];
  for (let k = 0; k < n; k++) {
    const t0 = (k / n) * Math.PI * 2;
    const t1 = ((k + 1) / n) * Math.PI * 2;
    p.quad(P(a, t0), P(a, t1), P(b, t1), P(b, t0), f);
    p.tri(a, P(a, t1), P(a, t0), f);
    p.tri(b, P(b, t0), P(b, t1), f);
  }
}

/** Une ligne brisée de tubes (un arceau, un pare-buffle) : un tube par segment. */
export function tubes(p: Pieces, pts: readonly V3[], r: number, n: number, f: Fini): void {
  for (let i = 0; i + 1 < pts.length; i++) tube(p, pts[i]!, pts[i + 1]!, r, n, f);
}

/**
 * Un carénage de roue fermé, côté `s` (+1 à gauche) : une coque en arc (rayons `r0` à `r1` autour de l'axe de la roue en (`zc`, `yc`), de l'angle `a0` à `a1`,
 * 0 = vers l'avant), de `x0` à `x1` (|x|) ; dessus et flancs dans `f`, le dessous (vu dans le passage) dans `dessous`. Aile de monoplace, élargisseur.
 */
export function carenage(p: Pieces, s: number, x0: number, x1: number, zc: number, yc: number, r0: number, r1: number, a0: number, a1: number, n: number, f: Fini, dessous: Fini = f): void {
  const P = (x: number, r: number, a: number): V3 => [x * s, yc + Math.sin(a) * r, zc + Math.cos(a) * r];
  const q = (A: V3, B: V3, C: V3, D: V3, g: Fini) => (s > 0 ? p.quad(A, B, C, D, g) : p.quad(A, D, C, B, g));
  const g: Fini = { ...f, groupe: p.nouveauGroupe() };
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const b = a0 + ((a1 - a0) * (k + 1)) / n;
    q(P(x1, r1, a), P(x1, r1, b), P(x0, r1, b), P(x0, r1, a), g); // le dessus
    q(P(x1, r0, a), P(x1, r1, a), P(x1, r1, b), P(x1, r0, b), f); // la face extérieure
    q(P(x0, r1, a), P(x0, r0, a), P(x0, r0, b), P(x0, r1, b), f); // la face intérieure
    q(P(x0, r0, a), P(x0, r0, b), P(x1, r0, b), P(x1, r0, a), dessous); // le dessous
  }
  q(P(x0, r0, a0), P(x1, r0, a0), P(x1, r1, a0), P(x0, r1, a0), f);
  q(P(x0, r1, a1), P(x1, r1, a1), P(x1, r0, a1), P(x0, r0, a1), f);
}

/** Un phare rond tourné vers `sens` (+1 l'avant, −1 l'arrière) : sa glace (dans les feux, `glace`) devant un boîtier sombre (dans la caisse, `boitier`). */
export function rond(caisse: Pieces | null, feux: Pieces | null, z: number, x: number, y: number, r: number, n: number, boitier: Fini, glace: Fini | null, sens = 1): void {
  if (caisse) prismeZ(caisse, sens > 0 ? z - 0.05 : z - 0.012, sens > 0 ? z + 0.012 : z + 0.05, x, y, r * 1.22, n, boitier);
  if (feux && glace) prismeZ(feux, sens > 0 ? z - 0.01 : z - 0.02, sens > 0 ? z + 0.02 : z + 0.01, x, y, r, n, glace);
}
