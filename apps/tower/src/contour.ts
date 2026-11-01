import { type Box8 } from "@cdj/tower-sim/lab/pieces";
import { boites, type PieceKind, type Taille } from "@cdj/tower-sim";

// Lot T6 — le CONTOUR d'un ensemble de pièces : les arêtes extérieures de leurs boîtes, sans celles qui sont à l'intérieur d'une autre boîte ou collées contre elle. Il sert à deux choses, toutes
// deux de l'affichage : le fantôme de la partie précédente (UN seul contour de la silhouette de la tour, en trait fin, et non plus chaque pièce en pointillé) et le contour de l'endroit où la pièce
// en main touchera en premier (la visée). Pur, en mètres.

/** Une pièce placée : forme, quarts de tour, taille, centre de masse (m) et angle (rad). */
export interface PiecePlacee {
  kind: PieceKind;
  rot: number;
  taille: Taille;
  x: number;
  y: number;
  angle: number;
}
export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface BoiteMonde {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  c: number;
  s: number;
}

/** Le pas d'échantillonnage le long d'une arête, et la distance dont on sort de la forme pour savoir si l'on est contre une autre : au-delà du jour entre deux pièces posées (quelques mm). */
const PAS = 0.2;
const SORTIE = 0.03;

function enMonde(p: PiecePlacee, b: Box8): BoiteMonde {
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  const lx = b.cx / 8;
  const ly = b.cy / 8;
  return { cx: p.x + lx * c - ly * s, cy: p.y + lx * s + ly * c, hw: b.hw / 8, hh: b.hh / 8, c, s };
}
const dedans = (b: BoiteMonde, x: number, y: number): boolean => {
  const dx = x - b.cx;
  const dy = y - b.cy;
  return Math.abs(dx * b.c + dy * b.s) <= b.hw && Math.abs(-dx * b.s + dy * b.c) <= b.hh;
};

/** Les arêtes extérieures de l'ensemble de pièces, fusionnées par arête en segments continus. */
export function contourDe(pieces: readonly PiecePlacee[]): Segment[] {
  const boxes: BoiteMonde[] = [];
  for (const p of pieces) for (const b of boites(p.kind, p.rot, p.taille)) boxes.push(enMonde(p, b));
  const out: Segment[] = [];
  boxes.forEach((b, i) => {
    // Les quatre arêtes : un point de départ, la direction de l'arête (unitaire) et sa normale sortante, dans le repère du monde.
    const ex = { x: b.c, y: b.s };
    const ey = { x: -b.s, y: b.c };
    const aretes = [
      { o: { x: b.cx - ex.x * b.hw - ey.x * b.hh, y: b.cy - ex.y * b.hw - ey.y * b.hh }, d: ex, n: { x: -ey.x, y: -ey.y }, L: 2 * b.hw },
      { o: { x: b.cx - ex.x * b.hw + ey.x * b.hh, y: b.cy - ex.y * b.hw + ey.y * b.hh }, d: ex, n: ey, L: 2 * b.hw },
      { o: { x: b.cx - ex.x * b.hw - ey.x * b.hh, y: b.cy - ex.y * b.hw - ey.y * b.hh }, d: ey, n: { x: -ex.x, y: -ex.y }, L: 2 * b.hh },
      { o: { x: b.cx + ex.x * b.hw - ey.x * b.hh, y: b.cy + ex.y * b.hw - ey.y * b.hh }, d: ey, n: ex, L: 2 * b.hh },
    ];
    for (const a of aretes) {
      const n = Math.max(1, Math.ceil(a.L / PAS));
      let debut = -1;
      for (let k = 0; k <= n; k++) {
        const garde = k < n && !boxes.some((o, j) => j !== i && dedans(o, a.o.x + a.d.x * (((k + 0.5) * a.L) / n) + a.n.x * SORTIE, a.o.y + a.d.y * (((k + 0.5) * a.L) / n) + a.n.y * SORTIE));
        if (garde && debut < 0) debut = k;
        if (!garde && debut >= 0) {
          const t0 = (debut * a.L) / n;
          const t1 = (k * a.L) / n;
          out.push({ x0: a.o.x + a.d.x * t0, y0: a.o.y + a.d.y * t0, x1: a.o.x + a.d.x * t1, y1: a.o.y + a.d.y * t1 });
          debut = -1;
        }
      }
    }
  });
  return out;
}

/** Les segments en rectangles d'épaisseur `e` (deux triangles chacun, z = 0) : les sommets d'un seul maillage. Le trait déborde de `e / 2` de chaque côté de l'arête et de ses extrémités. */
export function enQuads(segments: readonly Segment[], e: number): number[] {
  const pos: number[] = [];
  for (const s of segments) {
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const l = Math.hypot(dx, dy) || 1;
    const ux = (dx / l) * (e / 2);
    const uy = (dy / l) * (e / 2);
    const nx = -uy;
    const ny = ux;
    const a = [s.x0 - ux + nx, s.y0 - uy + ny];
    const b = [s.x1 + ux + nx, s.y1 + uy + ny];
    const c = [s.x1 + ux - nx, s.y1 + uy - ny];
    const d = [s.x0 - ux - nx, s.y0 - uy - ny];
    pos.push(a[0]!, a[1]!, 0, b[0]!, b[1]!, 0, c[0]!, c[1]!, 0, a[0]!, a[1]!, 0, c[0]!, c[1]!, 0, d[0]!, d[1]!, 0);
  }
  return pos;
}
