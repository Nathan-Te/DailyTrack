// Les sept formes à quatre cases (I, O, T, L, J, S, Z) en BOÎTES, huitièmes de case autour du centre de masse : la forme que dessinent les deux dessinateurs. Une pièce d'un autre jeu n'a pas à les utiliser :
// tout ce qui dessine prend une liste de boîtes (`Boite8`). Cette table est celle de `packages/tower-sim/lab/pieces.ts` (la physique de Tower) ; `apps/tower/test/visuelsBlocs.test.ts` vérifie qu'elles sont égales
// pour les sept formes et les quatre quarts de tour — une seule des deux ne peut pas changer.

/** Une boîte rapportée au centre de masse de la pièce : centre et DEMI-dimensions, en huitièmes de case (1 case = 1 m dans Tower). */
export interface Boite8 {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

export const FORMES = ["I", "O", "T", "L", "J", "S", "Z"] as const;
export type Forme = (typeof FORMES)[number];

/** Les cases de chaque forme au quart de tour 0 : [x, y, largeur, hauteur] en cases, coin bas-gauche. */
const CASES: Record<Forme, readonly (readonly [number, number, number, number])[]> = {
  I: [[0, 0, 4, 1]],
  O: [[0, 0, 2, 2]],
  T: [[0, 0, 3, 1], [1, 1, 1, 1]],
  L: [[0, 0, 3, 1], [2, 1, 1, 1]],
  J: [[0, 0, 3, 1], [0, 1, 1, 1]],
  S: [[1, 0, 2, 1], [0, 1, 2, 1]],
  Z: [[0, 0, 2, 1], [1, 1, 2, 1]],
};

/** Les boîtes d'une forme après `rot` quarts de tour (sens trigonométrique), autour de son centre de masse. Exact : que des entiers. */
export function boitesDeForme(forme: Forme, rot = 0): Boite8[] {
  const rects = CASES[forme].map(([x, y, w, h]) => ({ x0: x * 8, y0: y * 8, x1: (x + w) * 8, y1: (y + h) * 8 }));
  let sx = 0;
  let sy = 0;
  let aire = 0;
  for (const r of rects) {
    const a = (r.x1 - r.x0) * (r.y1 - r.y0);
    sx += a * (r.x0 + r.x1);
    sy += a * (r.y0 + r.y1);
    aire += a;
  }
  const gx2 = sx / aire;
  const gy2 = sy / aire;
  let out = rects.map((r) => ({ cx2: r.x0 + r.x1 - gx2, cy2: r.y0 + r.y1 - gy2, hw2: r.x1 - r.x0, hh2: r.y1 - r.y0 }));
  for (let i = 0; i < (rot & 3); i++) out = out.map((b) => ({ cx2: -b.cy2, cy2: b.cx2, hw2: b.hh2, hh2: b.hw2 }));
  return out.map((b) => ({ cx: b.cx2 / 2, cy: b.cy2 / 2, hw: b.hw2 / 2, hh: b.hh2 / 2 }));
}
