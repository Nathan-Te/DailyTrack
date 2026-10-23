// Lot 42 — modèle E, la **muscle car** (Boar) : un coupé long et large, le capot très long (le pare-brise recule derrière l'œil de la vue capot), un
// bossage au milieu du capot coiffé d'une écope, un pavillon bas qui file jusqu'à un arrière court relevé en queue de canard, des hanches arrière
// larges au-dessus des roues, un nez plat et vertical (calandre d'un bord à l'autre, barre et pare-chocs en métal clair), un panneau de feux sombre
// d'un bord à l'autre à l'arrière, deux gros échappements. Le type : la muscle car à moteur avant. Création originale : aucun modèle, aucune calandre
// ni aucun phare d'une voiture réelle (standard.md du lot 40c).
import { boite, cle, extruder, levre, pave, type Sec } from "./forme";
import { ailettes, capotPlat, cote, montant, plaque, poignee, retroviseur } from "./details";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.2;
const ZF = 2.32;

type P2 = [number, number];
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_E: PlanVoiture = {
  id: "E",
  nom: "E — Muscle car",
  resume: "Un coupé long et large : capot très long à bossage et écope, pavillon bas, arrière court en queue de canard, hanches larges, nez plat à calandre d'un bord à l'autre.",
  cles: [
    // La queue de canard : le bout du coffre relevé.
    capotPlat(ZR, 0.34, [0.8, 0.38], [0.9, 0.58], [0.87, 0.94], 0.99),
    capotPlat(-1.95, 0.27, [0.88, 0.31], [0.98, 0.57], [0.96, 0.9], 0.95),
    // Les hanches : le flanc le plus large au-dessus de la roue arrière ; le pavillon file jusqu'au coffre (la lunette).
    habitacle(-1.55, 0.26, [0.89, 0.3], [0.99, 0.56], [0.96, 0.88], [0.8, 0.92], [0.56, 0.97], 0.99),
    habitacle(-0.95, 0.26, [0.89, 0.3], [0.97, 0.55], [0.93, 0.86], [0.8, 0.91], [0.66, 1.19], 1.23),
    habitacle(-0.3, 0.26, [0.88, 0.3], [0.95, 0.54], [0.91, 0.85], [0.8, 0.9], [0.67, 1.2], 1.24),
    // Le pied du pare-brise, loin derrière l'œil de la vue capot (z 0,98) : tout le capot est devant.
    habitacle(0.25, 0.26, [0.88, 0.3], [0.95, 0.53], [0.91, 0.85], [0.84, 0.855], [0.62, 0.865], 0.877),
    capotPlat(0.9, 0.26, [0.88, 0.3], [0.95, 0.53], [0.92, 0.86], 0.85),
    capotPlat(1.3, 0.26, [0.88, 0.3], [0.96, 0.53], [0.93, 0.865], 0.852),
    capotPlat(1.95, 0.27, [0.86, 0.31], [0.94, 0.5], [0.9, 0.845], 0.835),
    // Le nez plat et vertical.
    capotPlat(ZF, 0.3, [0.8, 0.33], [0.9, 0.47], [0.87, 0.8], 0.8),
  ],
  bombe: { 2: 0.05, 3: 0.08, 4: 0.1, 5: 0.05, 6: 0.12, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [-0.3, 0.25], lunette: [-1.55, -0.95], vitres: [-1.3, 0.2] },
  // Des arêtes plus nettes que la Sparrow (flanc, toit), un nez et un arrière presque carrés en plan.
  tole: { rayons: [0, 0.05, 0.03, 0.08, 0, 0, 0, 0, 0.03, 0.06, 0], boutArriere: 0.3, boutAvant: 0.24 },
  vueCapot: { dy: 0.06 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.06,
    hauteur: 1.5,
    // Les deux bandes : le long capot (bossage compris), puis le toit, la lunette et le coffre jusqu'à la queue de canard.
    bandes: [
      [0.3, 2.45],
      [-2.35, -0.25],
    ],
    largeurBande: 0.62,
    portiere: { z: -0.2, y: 0.66, h: 0.26 },
    arriere: { y: 0.52, h: 0.13 },
    flancs: { z: [0.4, 1.0], y: [0.4, 0.78] },
    toit: 0.98,
    filet: 0.62,
    joints: {
      // Une longue portière, le capot d'une aile à l'autre, le couvercle du coffre.
      flanc: [
        [0.22, 0.31, 0.18, 0.88],
        [-0.98, 0.31, -1.0, 0.88],
      ],
      dessus: [
        [0.82, 0.3, 0.8, 2.22],
        [0.8, 2.22, 0, 2.23],
        [0.82, 0.3, 0, 0.3],
        [0.78, -1.55, 0.76, -2.1],
        [0.76, -2.1, 0, -2.1],
        [0.78, -1.55, 0, -1.55],
      ],
      arriere: [
        [0, 0.86, 0.8, 0.86],
        [0.8, 0.86, 0.82, 0.96],
      ],
    },
    arches: [
      [1.3, 0.38, 0.48],
      [-1.3, 0.38, 0.5],
    ],
    interieur: [-0.25, -0.95, 1.0],
  },
  roue: { branches: 5, jante: 0.64, dessin: "larges" },
  pieces(p, c) {
    piecesE(p, c);
  },
  feux: feuxE,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Le bossage et l'écope du capot, la queue de canard : la muscle car à 50 m.
      boite(p, 0.84, 0.3, 0.4, 2.0, 0.92, 0.24, 0.5, 1.9, f.caisse);
      pave(p, -0.8, 0.8, 0.98, 1.04, ZR - 0.04, ZR + 0.26, f.caisse);
    },
  },
};

function piecesE(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  // Passages de roue : les hanches arrière plus larges que l'avant ; la lèvre s'arrête où la tôle de l'aile s'arrête.
  for (const [s, z] of ROUES) {
    const ar = z < 0;
    levre(p, s, 0.93, ar ? 1.03 : 1.0, z, 0.38, 0.48, ar ? 0.55 : 0.52, 0.1, Math.PI - 0.1, arc + 2, m.peinture, m.plastique, ar ? 0.9 : 0.86);
  }
  // Bas de caisse : un filet de métal clair le long du seuil (la muscle car en a), une lame sombre dessous.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.9, 0.955), 0.24, 0.3, -0.8, 0.8, m.plastique);
    pave(p, ...cote(s, 0.935, 0.962), 0.3, 0.318, -0.8, 0.8, m.metal);
  }
  // --- Le capot : le bossage (peint) et son écope (ouverture sombre vers l'avant), loin devant l'œil de la vue capot. ---
  boite(p, 0.855, 0.3, 0.32, 2.05, 0.888, 0.25, 0.42, 1.95, m.peinture);
  boite(p, 0.886, 0.17, 1.38, 1.82, 0.952, 0.14, 1.44, 1.72, m.peinture);
  pave(p, -0.12, 0.12, 0.898, 0.942, 1.715, 1.725, m.noir);
  // --- Le nez : la calandre sombre d'un bord à l'autre, une barre de métal clair au milieu, le pare-chocs en métal, la plaque. ---
  const nez = coque.bout(1, 0.6).z;
  ailettes(p, c, -0.62, 0.62, 0.52, 0.74, nez, c.palier === 1 ? 3 : 6);
  pave(p, -0.62, 0.62, 0.62, 0.64, nez - 0.01, nez + 0.022, m.metal);
  pave(p, -0.86, 0.86, 0.38, 0.47, nez - 0.12, nez + 0.06, m.metal);
  pave(p, -0.5, 0.5, 0.3, 0.37, nez - 0.2, nez + 0.02, m.plastique);
  plaque(p, c, 0.42, nez + 0.062, 1);
  // --- L'arrière : la queue de canard, le pare-chocs en métal, deux gros échappements, la plaque sous le panneau de feux. ---
  extruder(
    p,
    [
      [ZR - 0.06, 0.985],
      [ZR + 0.3, 0.995],
      [ZR + 0.28, 1.02],
      [ZR - 0.07, 1.06],
    ],
    -0.82,
    0.82,
    m.peinture,
    m.garniture,
  );
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.88, 0.88, 0.32, 0.42, queue - 0.06, queue + 0.12, m.metal);
  for (const s of [-1, 1]) echappement(p, s * 0.6, 0.27, queue + 0.06, 0.055, 0.16, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.37, queue - 0.07, -1);
  // --- Les côtés : rétroviseurs sur pied, poignée de la longue portière, écope sombre devant la hanche, montant de custode. ---
  for (const s of [-1, 1]) {
    retroviseur(p, c, s, { pied: [0.86, 0.93, 0.86, 0.9, 0.12], centre: [0.975, 0.93, 0.14], rayons: [0.06, 0.05, 0.09] });
    poignee(p, c, s, -0.7, 0.78, 0.93);
    pave(p, ...cote(s, 0.955, 0.985), 0.52, 0.66, -1.0, -0.82, m.cadre);
    if (c.palier > 1) for (let k = 0; k < 3; k++) pave(p, ...cote(s, 0.96, 0.99), 0.54 + k * 0.04, 0.555 + k * 0.04, -0.99, -0.83, m.grille);
  }
  montant(p, c, 0.88, 0.8, -1.0, -0.9, 1.16, 0.68);
}

function feuxE(c: Contexte): Feux {
  const coque = c.coque!;
  const verre: Fini = { couleur: srgb(0x8a97a5), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : un phare rectangulaire aux deux bouts de la calandre, coupé d'un trait de jour, le clignotant ambre sous lui.
      coque.ruban(f, 1, 0.55, 0.72, 0.64, 2, 0.004, boitier);
      coque.ruban(f, 1, 0.57, 0.7, 0.66, 2, 0.008, verre, 0.86);
      coque.ruban(f, 1, 0.63, 0.645, 0.66, 2, 0.012, jour, 0.86);
      coque.ruban(f, 1, 0.49, 0.53, 0.64, 2, 0.011, ambre);
      void c;
    },
    stop(f) {
      // Un panneau sombre d'un bord à l'autre, deux feux rouges à chaque bout (deux rectangles côte à côte), le recul au milieu.
      coque.ruban(f, -1, 0.62, 0.84, 0.0, 3, 0.004, boitier);
      coque.ruban(f, -1, 0.66, 0.8, 0.6, 3, 0.011, rouge);
      const queue = coque.bout(-1, 0.7).z;
      for (const s of [-1, 1]) pave(f, ...cote(s, 0.34, 0.54), 0.66, 0.8, queue - 0.015, queue - 0.003, rouge);
    },
  };
}
