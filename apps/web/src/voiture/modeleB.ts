// Lot 40 — modèle B, « GT basse » : large et posée, le capot long, l'habitacle reculé et bas (1,18 m), un pavillon fuyant jusqu'à un coffre
// court, des hanches arrière larges au-dessus des roues, un grand aileron sur cols de cygne aux dérives peintes, un diffuseur profond et une
// lame de feux d'un bord à l'autre. De dos, c'est la plus large et la plus basse des trois. Création originale.
import { cle, extruder, fondDePassage, levre, pave, pont, prismeZ } from "./forme";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.12;
const ZF = 2.26;

type P2 = [number, number];
const capot = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, dessus: number, creux = 0) => cle(z, { bas: b, seuil, flanc, epaule, ...pont(epaule, dessus, creux) });
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus });

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_B: PlanVoiture = {
  id: "B",
  nom: "B — GT basse",
  resume: "Large et posée : capot long, habitacle reculé et bas, hanches arrière, grand aileron sur cols de cygne, lame de feux d'un bord à l'autre.",
  cles: [
    capot(ZR, 0.32, [0.82, 0.36], [0.92, 0.52], [0.88, 0.78], 0.8),
    capot(-1.98, 0.25, [0.89, 0.29], [0.97, 0.52], [0.95, 0.84], 0.85),
    capot(-1.55, 0.24, [0.9, 0.28], [0.97, 0.53], [0.96, 0.86], 0.88),
    habitacle(-1.25, 0.24, [0.9, 0.28], [0.97, 0.53], [0.95, 0.84], [0.78, 0.88], [0.5, 0.9], 0.91),
    habitacle(-0.7, 0.24, [0.89, 0.28], [0.96, 0.52], [0.9, 0.8], [0.74, 0.85], [0.6, 1.12], 1.17),
    habitacle(-0.05, 0.24, [0.88, 0.28], [0.95, 0.51], [0.88, 0.76], [0.76, 0.82], [0.62, 1.13], 1.18),
    habitacle(0.52, 0.24, [0.88, 0.28], [0.95, 0.5], [0.89, 0.72], [0.8, 0.74], [0.56, 0.76], 0.77),
    capot(1.3, 0.25, [0.88, 0.29], [0.96, 0.5], [0.92, 0.72], 0.7, -0.03),
    capot(1.9, 0.26, [0.85, 0.3], [0.93, 0.46], [0.88, 0.6], 0.6, -0.02),
    capot(ZF, 0.28, [0.72, 0.31], [0.82, 0.38], [0.76, 0.45], 0.47),
  ],
  bombe: { 2: 0.05, 3: 0.1, 4: 0.16, 5: 0.07, 6: 0.16, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [-0.05, 0.52], lunette: [-1.25, -0.7], vitres: [-1.1, 0.45] },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.08,
    hauteur: 1.5,
    bandes: [
      [0.75, 2.15],
      [-0.65, -0.1],
    ],
    largeurBande: 0.66,
    portiere: { z: -0.35, y: 0.58, h: 0.28 },
    arriere: { y: 0.47, h: 0.21 },
  },
  roue: { branches: 5, jante: 0.72, doubles: true },
  pieces(p, c) {
    piecesB(p, c);
  },
  feux: feuxB,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      pave(p, -1.0, 1.0, 1.16, 1.21, ZR - 0.02, ZR + 0.4, f.caisse);
      for (const s of [-1, 1]) pave(p, s * 0.98 - 0.03, s * 0.98 + 0.03, 1.02, 1.28, ZR - 0.04, ZR + 0.46, f.sombre);
    },
  },
};

function piecesB(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  // Passages de roue : hanches arrière plus larges et plus hautes que l'avant.
  for (const [s, z] of ROUES) {
    const ar = z < 0;
    fondDePassage(p, s, 0.975, z, 0.38, 0.47, 0.25, arc + 2, m.noir);
    levre(p, s, 0.93, ar ? 1.04 : 1.02, z, 0.38, 0.45, ar ? 0.56 : 0.52, 0.1, Math.PI - 0.1, arc + 2, m.peinture, m.noir);
  }
  // Lames latérales (bas de caisse sombre, plus saillant).
  for (const s of [-1, 1]) pave(p, s > 0 ? 0.9 : -1.0, s > 0 ? 1.0 : -0.9, 0.2, 0.28, -0.8, 0.8, m.garniture);
  // Grand aileron sur cols de cygne : la lame haute, les dérives peintes (elles portent la couleur de dos), les cols sombres.
  const aile: [number, number][] = [
    [ZR - 0.02, 1.16],
    [ZR + 0.38, 1.2],
    [ZR + 0.44, 1.235],
    [ZR + 0.1, 1.245],
    [ZR - 0.04, 1.205],
  ];
  extruder(p, aile, -0.97, 0.97, m.garniture);
  extruder(p, [[ZR + 0.4, 1.225], [ZR + 0.45, 1.232], [ZR + 0.44, 1.246], [ZR + 0.37, 1.24]], -0.975, 0.975, m.creme);
  for (const s of [-1, 1]) {
    pave(p, s * 0.98 - 0.022, s * 0.98 + 0.022, 1.02, 1.3, ZR - 0.06, ZR + 0.5, m.peinture);
    // Col de cygne : il part du coffre et vient tenir la lame par-dessus.
    pave(p, s * 0.45 - 0.03, s * 0.45 + 0.03, 0.82, 1.27, ZR + 0.3, ZR + 0.38, m.garniture);
    pave(p, s * 0.45 - 0.03, s * 0.45 + 0.03, 1.24, 1.27, ZR + 0.12, ZR + 0.38, m.garniture);
  }
  // Diffuseur profond à cinq ailettes, quatre sorties d'échappement, bandeau sombre sous la lame de feux.
  pave(p, -0.78, 0.78, 0.18, 0.36, ZR - 0.08, ZR + 0.5, m.garniture);
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) pave(p, x - 0.018, x + 0.018, 0.18, 0.4, ZR - 0.09, ZR + 0.36, m.noir);
  for (const s of [-1, 1]) for (const dx of [0, 0.13]) prismeZ(p, ZR - 0.06, ZR + 0.1, s * (0.62 + dx), 0.3, 0.045, c.palier === 1 ? 6 : 10, m.metal, m.noir);
  pave(p, -0.86, 0.86, 0.6, 0.74, ZR - 0.012, ZR + 0.02, m.noir);
  // Rétroviseurs sur pied, ouïes du capot, grande bouche avant et lame.
  for (const s of [-1, 1]) {
    pave(p, s > 0 ? 0.8 : -0.97, s > 0 ? 0.97 : -0.8, 0.86, 0.94, 0.3, 0.42, m.peinture);
    for (const k of [0, 1, 2]) pave(p, s * (0.32 + k * 0.1) - 0.03, s * (0.32 + k * 0.1) + 0.03, 0.66, 0.69, 1.1, 1.45, m.noir);
  }
  pave(p, -0.66, 0.66, 0.27, 0.4, ZF - 0.04, ZF + 0.012, m.noir);
  pave(p, -0.86, 0.86, 0.2, 0.26, ZF - 0.55, ZF + 0.14, m.garniture);
}

function feuxB(c: Contexte): Feux {
  const blanc: Fini = { couleur: srgb(0xfff3d6) };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  return {
    phares(f) {
      for (const s of [-1, 1]) {
        // Phares étirés vers l'arrière, en amande, et un trait de jour en dessous.
        pave(f, s > 0 ? 0.48 : -0.8, s > 0 ? 0.8 : -0.48, 0.42, 0.47, ZF - 0.4, ZF - 0.04, blanc);
        pave(f, s > 0 ? 0.58 : -0.82, s > 0 ? 0.82 : -0.58, 0.34, 0.36, ZF - 0.12, ZF + 0.006, blanc);
      }
    },
    stop(f) {
      // Une lame d'un bord à l'autre, plus épaisse aux deux bouts.
      pave(f, -0.84, 0.84, 0.75, 0.78, ZR - 0.03, ZR + 0.005, rouge);
      for (const s of [-1, 1]) pave(f, s > 0 ? 0.5 : -0.86, s > 0 ? 0.86 : -0.5, 0.7, 0.79, ZR - 0.035, ZR + 0.005, rouge);
      void c;
    },
  };
}
