// Lot T0 — les sept tétrominos en boîtes soudées. Tout est en HUITIÈMES de case (entiers) : le centre de masse d'un tétromino est un multiple de 1/8 de case.
import type { PieceKind } from "./interface";

/** Une boîte, rapportée au centre de masse de la pièce : centre et DEMI-dimensions, en huitièmes de case. */
export interface Box8 {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

/** Cases (colonne, ligne) de chaque forme au quart de tour 0 ; les boîtes les couvrent (peu de boîtes : moins de paires à tester). */
const SHAPES: Record<PieceKind, { boxes: [number, number, number, number][] }> = {
  // [x, y, largeur, hauteur] en cases, coin bas-gauche
  I: { boxes: [[0, 0, 4, 1]] },
  O: { boxes: [[0, 0, 2, 2]] },
  T: { boxes: [[0, 0, 3, 1], [1, 1, 1, 1]] },
  L: { boxes: [[0, 0, 3, 1], [2, 1, 1, 1]] },
  J: { boxes: [[0, 0, 3, 1], [0, 1, 1, 1]] },
  S: { boxes: [[1, 0, 2, 1], [0, 1, 2, 1]] },
  Z: { boxes: [[0, 0, 2, 1], [1, 1, 2, 1]] },
};

/** Les boîtes d'une pièce après `rot` quarts de tour (sens trigonométrique), autour de son centre de masse. Exact : que des entiers. */
export function pieceBoxes(kind: PieceKind, rot: number): Box8[] {
  // En huitièmes de case : coin bas-gauche (8x, 8y), taille (8w, 8h) ; chaque case a la masse 1, le centre de masse est la moyenne des centres de cases.
  const rects = SHAPES[kind].boxes.map(([x, y, w, h]) => ({ x0: x * 8, y0: y * 8, x1: (x + w) * 8, y1: (y + h) * 8 }));
  // Centre de masse : moyenne pondérée par l'aire (densité 1) des centres des boîtes. Somme de produits entiers, une division finale exacte (aire totale = 4 cases = 4 × 64).
  let sx = 0;
  let sy = 0;
  let area = 0;
  for (const r of rects) {
    const a = (r.x1 - r.x0) * (r.y1 - r.y0);
    sx += a * (r.x0 + r.x1); // 2 × centre
    sy += a * (r.y0 + r.y1);
    area += a;
  }
  // centre de masse × 2 × area = sx ; en huitièmes de case : sx / (2 × area) — divisible car area = 256 et les aires sont multiples de 64.
  const gx2 = sx / area; // 2 × centre de masse, en huitièmes (entier)
  const gy2 = sy / area;
  let out = rects.map((r) => ({
    // centre de la boîte − centre de masse, en demi-huitièmes → on garde le double (entier) puis on divise : toutes les valeurs sont des multiples de 1/16 de case ?
    cx2: r.x0 + r.x1 - gx2,
    cy2: r.y0 + r.y1 - gy2,
    hw2: r.x1 - r.x0,
    hh2: r.y1 - r.y0,
  }));
  for (let i = 0; i < (rot & 3); i++) out = out.map((b) => ({ cx2: -b.cy2, cy2: b.cx2, hw2: b.hh2, hh2: b.hw2 }));
  // Ici tout est « doublé » (un demi-huitième) : les valeurs sont paires, sinon la forme ne tomberait pas sur la grille du huitième.
  return out.map((b) => {
    if ((b.cx2 | b.cy2 | b.hw2 | b.hh2) & 1) throw new Error("tétromino hors de la grille du huitième");
    return { cx: b.cx2 / 2, cy: b.cy2 / 2, hw: b.hw2 / 2, hh: b.hh2 / 2 };
  });
}

/** Aire d'une pièce en cases (4 pour un tétromino) — la masse, avec une densité de 1. */
export const PIECE_AREA = 4;
