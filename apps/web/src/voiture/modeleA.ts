// Lot 40 — modèle A, « évolution » : le coupé trapu d'aujourd'hui (lot 9b), affiné. Mêmes proportions (longueur, hauteur, bulle de toit au
// milieu), avec ce qui lui manquait pour se lire de dos : des passages de roue marqués (lèvres débordantes, fond sombre), un bas de caisse,
// un aileron sur deux jambes au bord d'attaque crème, un diffuseur à ailettes, deux feux stop larges sous un bandeau sombre. Création originale.
import { boite, cle, extruder, fondDePassage, levre, pave, pont, prismeZ, type Sec } from "./forme";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.08;
const ZF = 2.16;

const bas = (z: number, bas: number, seuil: [number, number], flanc: [number, number], epaule: [number, number]) => ({ z, bas, seuil, flanc, epaule });
/** Une section de capot ou de coffre. */
const capot = (z: number, b: number, seuil: [number, number], flanc: [number, number], epaule: [number, number], dessus: number) => cle(z, { ...bas(z, b, seuil, flanc, epaule), ...pont(epaule, dessus) });
/** Une section d'habitacle (pied de vitre, bord du toit, dessus). */
const habitacle = (z: number, b: number, seuil: [number, number], flanc: [number, number], epaule: [number, number], vitre: [number, number], toit: [number, number], dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_A: PlanVoiture = {
  id: "A",
  nom: "A — Évolution",
  resume: "La voiture d'aujourd'hui affinée : passages de roue, bas de caisse, aileron sur deux jambes, diffuseur. Même esprit, mêmes proportions.",
  cles: [
    capot(ZR, 0.33, [0.78, 0.37], [0.88, 0.55], [0.84, 0.86], 0.885),
    capot(-1.95, 0.27, [0.86, 0.31], [0.94, 0.55], [0.91, 0.9], 0.935),
    capot(-1.3, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.9], 0.945),
    habitacle(-1.02, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.88], [0.84, 0.92], [0.66, 0.97], 0.99),
    habitacle(-0.62, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.86], [0.82, 0.9], [0.7, 1.29], 1.33),
    habitacle(0.22, 0.26, [0.87, 0.3], [0.95, 0.55], [0.92, 0.84], [0.83, 0.88], [0.7, 1.3], 1.34),
    habitacle(0.84, 0.26, [0.87, 0.3], [0.95, 0.54], [0.91, 0.78], [0.84, 0.8], [0.62, 0.82], 0.84),
    capot(1.3, 0.27, [0.87, 0.31], [0.95, 0.53], [0.9, 0.74], 0.78),
    capot(1.85, 0.28, [0.83, 0.32], [0.9, 0.5], [0.85, 0.68], 0.725),
    capot(ZF, 0.3, [0.7, 0.33], [0.78, 0.44], [0.72, 0.54], 0.565),
  ],
  bombe: { 2: 0.06, 3: 0.09, 4: 0.12, 5: 0.06, 6: 0.14, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.22, 0.84], lunette: [-1.02, -0.62], vitres: [-0.95, 0.74] },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [1.0, 2.05],
      [-0.6, 0.2],
    ],
    largeurBande: 0.72,
    portiere: { z: -0.12, y: 0.62, h: 0.3 },
    arriere: { y: 0.5, h: 0.22 },
    flancs: { z: [-0.84, -0.3], y: [0.36, 0.8] },
  },
  roue: { branches: 5, jante: 0.68 },
  pieces(p, c) {
    piecesA(p, c);
  },
  feux: feuxA,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      pave(p, -0.95, 0.95, 1.14, 1.2, ZR - 0.06, ZR + 0.36, f.caisse);
      for (const s of [-1, 1]) pave(p, s * 0.5 - 0.04, s * 0.5 + 0.04, 0.9, 1.14, ZR + 0.08, ZR + 0.24, f.sombre);
    },
  },
};

function piecesA(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  // Passages de roue : le fond sombre sur le flanc, la lèvre peinte qui déborde par-dessus le pneu (elle donne la largeur aux roues, vue de dos).
  for (const [s, z] of ROUES) {
    fondDePassage(p, s, 0.958, z, 0.38, 0.47, 0.27, arc + 2, m.noir);
    levre(p, s, 0.9, 1.01, z, 0.38, 0.45, 0.52, 0.12, Math.PI - 0.12, arc + 2, m.peinture, m.noir);
  }
  // Bas de caisse : une lame sombre entre les roues.
  for (const s of [-1, 1]) pave(p, s > 0 ? 0.9 : -0.97, s > 0 ? 0.97 : -0.9, 0.22, 0.33, -0.78, 0.78, m.garniture);
  // Aileron sur deux jambes, bord d'attaque crème, dérives sombres.
  const aile: [number, number][] = [
    [ZR - 0.04, 1.14],
    [ZR + 0.34, 1.18],
    [ZR + 0.4, 1.205],
    [ZR + 0.1, 1.215],
    [ZR - 0.06, 1.18],
  ];
  extruder(p, aile, -0.93, 0.93, m.peinture, m.garniture);
  extruder(p, [[ZR + 0.36, 1.2], [ZR + 0.42, 1.208], [ZR + 0.41, 1.222], [ZR + 0.33, 1.215]], -0.935, 0.935, m.creme);
  for (const s of [-1, 1]) {
    pave(p, s * 0.93 - 0.025, s * 0.93 + 0.025, 1.08, 1.27, ZR - 0.1, ZR + 0.44, m.garniture);
    pave(p, s * 0.52 - 0.035, s * 0.52 + 0.035, 0.88, 1.15, ZR + 0.06, ZR + 0.22, m.garniture);
  }
  // Diffuseur à ailettes, échappements, bandeau sombre des feux à l'arrière.
  pave(p, -0.7, 0.7, 0.2, 0.34, ZR - 0.05, ZR + 0.42, m.garniture);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) pave(p, x - 0.02, x + 0.02, 0.2, 0.36, ZR - 0.06, ZR + 0.3, m.noir);
  for (const s of [-1, 1]) prismeZ(p, ZR - 0.09, ZR + 0.1, s * 0.58, 0.31, 0.055, c.palier === 1 ? 6 : 10, m.metal, m.noir);
  pave(p, -0.82, 0.82, 0.64, 0.84, ZR - 0.012, ZR + 0.02, m.noir);
  // Rétroviseurs (dans la silhouette : pas plus large que les lèvres), prise d'air du capot, lame avant, calandre.
  for (const s of [-1, 1]) {
    pave(p, s > 0 ? 0.82 : -0.98, s > 0 ? 0.98 : -0.82, 0.93, 1.02, 0.5, 0.64, m.peinture);
    pave(p, s > 0 ? 0.82 : -0.86, s > 0 ? 0.86 : -0.82, 0.86, 0.94, 0.54, 0.6, m.garniture);
    // Retouche 40b, le petit niveau de détail : la glace du rétroviseur (vue de dos), une poignée affleurante, une prise d'air devant la roue
    // arrière, le montant peint de la vitre de custode (la ligne de vitrage d'un coupé : deux glaces par côté).
    pave(p, s > 0 ? 0.85 : -0.96, s > 0 ? 0.96 : -0.85, 0.945, 1.005, 0.494, 0.5, m.vitre);
    pave(p, s > 0 ? 0.93 : -0.975, s > 0 ? 0.975 : -0.93, 0.79, 0.82, -0.02, 0.16, m.garniture);
    pave(p, s > 0 ? 0.93 : -0.97, s > 0 ? 0.97 : -0.93, 0.36, 0.56, -0.86, -0.66, m.noir);
  }
  boite(p, 0.87, 0.84, -0.44, -0.36, 1.28, 0.71, -0.44, -0.36, m.peinture);
  pave(p, -0.32, 0.32, 0.79, 0.825, 1.25, 1.65, m.noir);
  pave(p, -0.78, 0.78, 0.24, 0.3, ZF - 0.5, ZF + 0.1, m.garniture);
  pave(p, -0.55, 0.55, 0.36, 0.46, ZF - 0.04, ZF + 0.01, m.noir);
}

function feuxA(c: Contexte): Feux {
  const blanc: Fini = { couleur: srgb(0xfff3d6) };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  return {
    phares(f) {
      for (const s of [-1, 1]) {
        // Signature (retouche 40b) : quatre yeux ronds sur le nez, un trait de jour en dessous.
        for (const x of [0.44, 0.6]) prismeZ(f, ZF - 0.08, ZF + 0.012, s * x, 0.47, 0.055, c.palier === 1 ? 8 : 12, blanc);
        pave(f, s > 0 ? 0.6 : -0.76, s > 0 ? 0.76 : -0.6, 0.38, 0.41, ZF - 0.06, ZF + 0.012, blanc);
      }
    },
    stop(f) {
      // Deux feux larges, chacun marqué de deux ronds (signature de dos).
      for (const s of [-1, 1]) {
        pave(f, s > 0 ? 0.26 : -0.8, s > 0 ? 0.8 : -0.26, 0.68, 0.8, ZR - 0.03, ZR + 0.005, rouge);
        for (const x of [0.4, 0.66]) prismeZ(f, ZR - 0.045, ZR - 0.02, s * x, 0.74, 0.05, c.palier === 1 ? 8 : 12, rouge, rouge);
      }
    },
  };
}
