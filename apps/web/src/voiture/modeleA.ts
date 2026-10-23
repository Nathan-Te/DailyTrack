// Lot 40 — modèle A, « évolution » : le coupé trapu d'aujourd'hui (lot 9b), affiné. Mêmes proportions (longueur, hauteur, bulle de toit au milieu), avec ce qui lui manquait pour se lire de dos : des passages de roue
// marqués (lèvres débordantes, doublure sombre), un bas de caisse, un aileron sur deux jambes au bord d'attaque crème, un diffuseur à ailettes, deux feux stop larges. Création originale.
// Lot 40c — **la Weasel au standard** (standard.md) : caisse tôle, capot presque plat avec des ailes en bosse au-dessus des roues (la roue ne traverse jamais le capot), joints de portes, de capot et de coffre dans
// le nuanceur, rétroviseurs sur leur pied, quatre yeux ronds sur le nez dans leur boîtier, deux feux de dos à deux ronds, échappements creux, calandre et prise d'air à ailettes.
import { boite, cle, extruder, levre, pave, prismeZ, type Sec } from "./forme";
import { ailettes, capotPlat, cote, montant, plaque, poignee, retroviseur } from "./details";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.08;
const ZF = 2.16;

type P2 = [number, number];
/** Une section d'habitacle (pied de vitre, bord du toit, dessus). */
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_A: PlanVoiture = {
  id: "A",
  nom: "A — Évolution",
  resume: "Le coupé trapu affiné : capot plat et ailes en bosse, passages de roue, aileron sur deux jambes, diffuseur, quatre yeux ronds. Même esprit, mêmes proportions.",
  cles: [
    capotPlat(ZR, 0.33, [0.78, 0.37], [0.88, 0.55], [0.84, 0.86], 0.873),
    capotPlat(-1.95, 0.27, [0.86, 0.31], [0.94, 0.55], [0.91, 0.9], 0.923),
    capotPlat(-1.3, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.9], 0.933),
    habitacle(-1.02, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.88], [0.84, 0.92], [0.66, 0.97], 0.99),
    habitacle(-0.62, 0.26, [0.87, 0.3], [0.95, 0.56], [0.92, 0.86], [0.82, 0.9], [0.7, 1.29], 1.33),
    habitacle(0.22, 0.26, [0.87, 0.3], [0.95, 0.55], [0.92, 0.84], [0.83, 0.88], [0.7, 1.3], 1.34),
    // Le pied du pare-brise : à la hauteur du capot (l'aile est plus haute que lui devant).
    habitacle(0.84, 0.26, [0.87, 0.3], [0.95, 0.54], [0.92, 0.84], [0.85, 0.845], [0.64, 0.855], 0.867),
    capotPlat(1.3, 0.27, [0.87, 0.31], [0.95, 0.53], [0.92, 0.83], 0.79),
    capotPlat(1.85, 0.28, [0.83, 0.32], [0.9, 0.5], [0.88, 0.8], 0.765),
    capotPlat(ZF, 0.3, [0.7, 0.33], [0.78, 0.44], [0.74, 0.64], 0.65),
  ],
  bombe: { 2: 0.06, 3: 0.09, 4: 0.12, 5: 0.06, 6: 0.14, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.22, 0.84], lunette: [-1.02, -0.62], vitres: [-0.95, 0.74] },
  tole: { boutArriere: 0.36, boutAvant: 0.38 },
  vueCapot: { dy: 0.08 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [1.0, 2.3],
      [-2.2, 0.25],
    ],
    largeurBande: 0.72,
    portiere: { z: -0.12, y: 0.62, h: 0.3 },
    arriere: { y: 0.5, h: 0.22 },
    flancs: { z: [-0.84, -0.3], y: [0.36, 0.8] },
    toit: 0.97,
    filet: 0.52,
    joints: {
      // Le coupé : une longue portière (bord avant sous le montant, bord arrière derrière la vitre), la trappe du réservoir ; le capot et le couvercle de coffre.
      flanc: [
        [0.72, 0.3, 0.68, 0.9],
        [-0.8, 0.3, -0.82, 0.9],
        [-1.05, 0.64, -1.05, 0.78],
        [-1.05, 0.78, -1.25, 0.78],
        [-1.25, 0.78, -1.25, 0.64],
        [-1.25, 0.64, -1.05, 0.64],
      ],
      dessus: [
        [0.8, 0.88, 0.76, 2.05],
        [0.76, 2.05, 0, 2.06],
        [0.8, 0.88, 0, 0.88],
        [0.78, -1.1, 0.74, -2.0],
        [0.74, -2.0, 0, -2.0],
        [0.78, -1.1, 0, -1.1],
      ],
      arriere: [
        [0, 0.58, 0.8, 0.58],
        [0.8, 0.58, 0.82, 0.9],
      ],
    },
    arches: [
      [1.3, 0.38, 0.47],
      [-1.3, 0.38, 0.47],
    ],
    interieur: [0.1, -0.5, 1.03],
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
  const coque = c.coque!;
  // Passages de roue : la doublure est dans le nuanceur ; une lèvre peinte qui déborde par-dessus le pneu (elle donne la largeur aux roues, vue de dos) et s'arrête là où l'aile s'arrête.
  for (const [s, z] of ROUES) levre(p, s, 0.9, 1.01, z, 0.38, 0.47, 0.52, 0.12, Math.PI - 0.12, arc + 3, m.peinture, m.plastique, z > 0 ? 0.82 : 0.9);
  // Bas de caisse : une lame sombre entre les roues, un filet net au-dessus.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.9, 0.97), 0.22, 0.33, -0.78, 0.78, m.plastique);
    if (c.palier > 1) pave(p, ...cote(s, 0.93, 0.965), 0.33, 0.345, -0.78, 0.78, m.cadre);
  }
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
    pave(p, s * 0.93 - 0.025, s * 0.93 + 0.025, 1.08, 1.27, ZR - 0.1, ZR + 0.44, m.cadre);
    pave(p, s * 0.52 - 0.035, s * 0.52 + 0.035, 0.88, 1.15, ZR + 0.06, ZR + 0.22, m.cadre);
  }
  // Diffuseur à ailettes, deux échappements creux, plaque.
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.7, 0.7, 0.2, 0.34, queue - 0.01, queue + 0.4, m.plastique);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) pave(p, x - 0.02, x + 0.02, 0.2, 0.36, queue - 0.02, queue + 0.3, m.noir);
  for (const s of [-1, 1]) echappement(p, s * 0.58, 0.31, queue + 0.05, 0.055, 0.13, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.48, queue - 0.01, -1);
  // Le nez : calandre basse à ailettes, plaque, lame avant ; le capot porte une prise d'air.
  const nez = coque.bout(1, 0.5).z;
  ailettes(p, c, -0.5, 0.5, 0.33, 0.47, nez, c.palier === 1 ? 3 : 5);
  plaque(p, c, 0.385, nez + 0.012, 1);
  pave(p, -0.62, 0.62, 0.24, 0.3, nez - 0.45, nez + 0.022, m.plastique);
  pave(p, -0.3, 0.3, 0.796, 0.826, 1.3, 1.72, m.cadre);
  if (c.palier > 1) for (let k = 0; k < 4; k++) pave(p, -0.28, 0.28, 0.8 + k * 0.006, 0.805 + k * 0.006, 1.34 + k * 0.1, 1.38 + k * 0.1, m.grille);
  for (const s of [-1, 1]) {
    // Rétroviseur sur son pied, au coin de la vitre (le coupé n'a qu'une portière : un seul rétroviseur par côté).
    retroviseur(p, c, s, { pied: [0.855, 0.93, 0.87, 0.925, 0.5], centre: [0.975, 0.985, 0.52], rayons: [0.06, 0.055, 0.092] });
    // La poignée de la portière, le montant de la custode (noir), une prise d'air devant la roue arrière.
    poignee(p, c, s, -0.5, 0.79, 0.945);
    pave(p, ...cote(s, 0.93, 0.97), 0.36, 0.56, -0.86, -0.66, m.noir);
  }
  montant(p, c, 0.87, 0.84, -0.44, -0.36, 1.28, 0.71);
}

function feuxA(c: Contexte): Feux {
  const coque = c.coque!;
  const blanc: Fini = { couleur: srgb(0xf4f6fa), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const rond: Fini = { couleur: srgb(0x4a0c0f), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : quatre yeux ronds sur le nez (deux par côté) dans leur boîtier sombre, un trait de jour dessous, le clignotant ambre au coin.
      const nez = coque.bout(1, 0.5).z;
      coque.ruban(f, 1, 0.455, 0.605, 0.1, 3, 0.004, boitier);
      for (const s of [-1, 1]) for (const x of [0.28, 0.46]) prismeZ(f, nez - 0.03, nez + 0.012, s * x, 0.53, 0.055, c.palier === 1 ? 8 : 14, blanc);
      coque.ruban(f, 1, 0.462, 0.474, 0.1, 3, 0.009, jour);
      coque.ruban(f, 1, 0.49, 0.58, 0.58, 3, 0.011, ambre);
    },
    stop(f) {
      // Deux feux larges, chacun marqué de deux ronds (signature de dos), dans un boîtier sombre.
      const queue = coque.bout(-1, 0.5).z;
      coque.ruban(f, -1, 0.64, 0.84, 0.12, 3, 0.004, boitier);
      coque.ruban(f, -1, 0.68, 0.8, 0.22, 3, 0.008, rouge);
      for (const s of [-1, 1]) for (const x of [0.36, 0.56]) prismeZ(f, queue - 0.04, queue - 0.012, s * x, 0.74, 0.045, c.palier === 1 ? 8 : 14, rond, rond);
      void c;
    },
  };
}
