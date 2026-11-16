import { AXE, UNITE, type Table } from "@cdj/pinball-sim";
import { REFERENCE } from "./types";

// Lot PBV4 : où se pose chaque modèle sur la table, en pixels de la table (x, y), commun aux deux rendus et à `test/modeles.test.ts` (qui vérifie sur les 500 tables (444 avant les plans du lot PBG1) que chaque modèle posé reste dans l'emprise de collision
// de son module). Rien ici ne dépend de three.js.

const px = (u: number): number => u / UNITE;
/** Une instance : son centre (px), l'angle qui tourne son avant (+z du modèle, +y à plat) vers les batteurs, l'échelle du modèle de référence. */
export interface Instance {
  x: number;
  y: number;
  /** Le cap (radians) : le modèle tourne de `a` autour de la verticale (three.js : `rotation.y = a`). */
  a: number;
  s: number;
  /** Le rang de l'élément dans son tableau de la table (`bumpers`, `murs`, `spinners`, `trous`). */
  i: number;
  /** Le rang de l'instance dans son modèle (les variantes et les teintes tournent avec lui). */
  k: number;
}
export interface Placements {
  /** Les bumpers, mini-bumpers compris ; ceux de l'astéroïde (`asteroide`) ont le modèle de l'élément. */
  bumper: Instance[];
  asteroide: Instance[];
  cible: Instance[];
  spinner: Instance[];
  trou: Instance[];
}

export function placements(t: Table): Placements {
  const r: Placements = { bumper: [], asteroide: [], cible: [], spinner: [], trou: [] };
  const deLAsteroide = new Set<number>();
  for (const p of t.poses) if (p.type === "asteroide") for (let k = 0; k < p.n; k++) deLAsteroide.add(p.rang + k);
  t.bumpers.forEach((b, i) => {
    const l = deLAsteroide.has(i) ? r.asteroide : r.bumper;
    l.push({ x: px(b.x), y: px(b.y), a: 0, s: px(b.r) / REFERENCE.bumper, i, k: l.length });
  });
  t.murs.forEach((m, i) => {
    if (m.type !== 2) return;
    const ax = px(m.ax);
    const ay = px(m.ay);
    const bx = px(m.bx);
    const by = px(m.by);
    const x = (ax + bx) / 2;
    const y = (ay + by) / 2;
    // l'avant de la cible regarde les batteurs : la perpendiculaire au segment, du côté du point (AXE, 640)
    let nx = -(by - ay);
    let ny = bx - ax;
    if (nx * (AXE - x) + ny * (640 - y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    r.cible.push({ x, y, a: Math.atan2(nx, ny), s: Math.hypot(bx - ax, by - ay) / REFERENCE.cible, i, k: r.cible.length });
  });
  t.spinners.forEach((c, i) => r.spinner.push({ x: px(c.x), y: px(c.y), a: 0, s: px(c.l) / REFERENCE.spinner, i, k: i }));
  t.trous.forEach((c, i) => r.trou.push({ x: px(c.x), y: px(c.y), a: 0, s: px(c.r) / REFERENCE.trou, i, k: i }));
  return r;
}
