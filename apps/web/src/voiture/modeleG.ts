// Lot 42 — modèle G, le **roadster** (Gecko) : une deux-places découverte, basse et courte, un long capot entre deux ailes bombées, un pare-brise bas
// dans son cadre, deux sièges crème avec leurs appuie-tête, un arceau derrière eux, un arrière court et rond. Le type : le petit roadster deux places
// à moteur avant. Création originale : aucun modèle, aucune calandre ni aucun phare d'une voiture réelle (standard.md du lot 40c).
// L'habitacle ouvert est creusé dans les clés de la caisse (entre les portières, le dessus descend aux sièges) ; le pare-brise, les sièges, la
// planche de bord et l'arceau sont des pièces.
import { boite, cle, levre, pave, type Sec } from "./forme";
import { ailettes, capotPlat, cote, plaque, poignee, retroviseur } from "./details";
import { rond, tubes } from "./atelier";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -1.98;
const ZF = 2.14;
/** L'habitacle ouvert : de l'arrière des sièges au pied du pare-brise, et la hauteur de son plancher. */
const ZH: [number, number] = [-0.86, 0.14];
const YH = 0.5;

type P2 = [number, number];
/** Une section de l'habitacle ouvert : le haut de la portière, la paroi intérieure jusqu'au plancher. */
const ouvert = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2) => cle(z, { bas: b, seuil, flanc, epaule, vitre: [epaule[0] - 0.08, epaule[1] + 0.008], toit: [epaule[0] - 0.16, YH + 0.04], dessus: YH } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_G: PlanVoiture = {
  id: "G",
  nom: "G — Roadster",
  resume: "Une deux-places découverte, basse et courte : long capot entre deux ailes bombées, pare-brise bas, sièges crème, arceau, arrière court et rond.",
  cles: [
    capotPlat(ZR, 0.32, [0.78, 0.36], [0.86, 0.55], [0.83, 0.78], 0.8),
    capotPlat(-1.5, 0.26, [0.87, 0.3], [0.96, 0.55], [0.93, 0.84], 0.84),
    // Le dessus du coffre, puis l'habitacle ouvert.
    capotPlat(ZH[0] - 0.1, 0.26, [0.87, 0.3], [0.95, 0.55], [0.92, 0.83], 0.84),
    ouvert(ZH[0], 0.26, [0.87, 0.3], [0.95, 0.55], [0.92, 0.82]),
    ouvert(ZH[1], 0.26, [0.87, 0.3], [0.95, 0.54], [0.92, 0.81]),
    // L'auvent devant le pare-brise, puis le capot long entre les ailes bombées (l'aile au-dessus de la roue, le capot un peu plus bas).
    capotPlat(ZH[1] + 0.1, 0.26, [0.87, 0.3], [0.95, 0.54], [0.92, 0.82], 0.81),
    capotPlat(1.3, 0.26, [0.87, 0.3], [0.96, 0.53], [0.93, 0.845], 0.79),
    capotPlat(1.85, 0.27, [0.85, 0.31], [0.93, 0.5], [0.89, 0.8], 0.74),
    capotPlat(ZF, 0.29, [0.72, 0.32], [0.8, 0.44], [0.76, 0.62], 0.62),
  ],
  bombe: { 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.05, 6: 0.12, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  // Ni vitres latérales ni lunette ; le pare-brise est une pièce : les zones vitrées sont hors de la voiture.
  zones: { pareBrise: [ZR - 1, ZR - 0.95], lunette: [ZR - 0.9, ZR - 0.85], vitres: [ZR - 0.8, ZR - 0.75] },
  tole: { rayons: [0, 0.05, 0.03, 0.16, 0, 0, 0, 0, 0.02, 0.05, 0], boutArriere: 0.4, boutAvant: 0.42 },
  // Les ailes bombées montent de part et d'autre de l'œil : il monte de 3 cm.
  vueCapot: { dy: 0.03 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.04,
    hauteur: 1.5,
    // Les bandes : le long capot, puis le coffre et la poupe (elles passent sous les sièges sans se voir).
    bandes: [
      [0.2, 2.3],
      [-2.1, -0.9],
    ],
    largeurBande: 0.5,
    portiere: { z: -0.32, y: 0.62, h: 0.26 },
    arriere: { y: 0.6, h: 0.15 },
    flancs: { z: [0.3, 1.0], y: [0.36, 0.72] },
    toit: 0.86,
    filet: 0.6,
    joints: {
      // La portière, le capot entre les ailes, le couvercle du coffre.
      flanc: [
        [0.12, 0.3, 0.1, 0.8],
        [-0.82, 0.3, -0.84, 0.8],
      ],
      dessus: [
        [0.7, 0.3, 0.68, 2.02],
        [0.68, 2.02, 0, 2.03],
        [0.7, 0.3, 0, 0.3],
        [0.72, -1.05, 0.7, -1.82],
        [0.7, -1.82, 0, -1.82],
        [0.72, -1.05, 0, -1.05],
      ],
      arriere: [[0, 0.72, 0.7, 0.72]],
    },
    arches: [
      [1.3, 0.38, 0.47],
      [-1.3, 0.38, 0.47],
    ],
  },
  roue: { branches: 8, jante: 0.7, dessin: "lames" },
  pieces(p, c) {
    piecesG(p, c);
  },
  feux: feuxG,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Le pare-brise et l'arceau : le roadster à 50 m.
      boite(p, 0.82, 0.76, 0.2, 0.26, 1.06, 0.68, 0.0, 0.05, f.sombre);
      pave(p, -0.58, 0.58, 1.06, 1.12, -0.82, -0.76, f.caisse);
    },
  },
};

function piecesG(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  const n = c.palier === 1 ? 4 : 8;
  // Passages de roue : une lèvre peinte qui s'arrête où l'aile s'arrête.
  for (const [s, z] of ROUES) levre(p, s, 0.9, 0.99, z, 0.38, 0.47, 0.52, 0.12, Math.PI - 0.12, arc + 1, m.peinture, m.plastique, 0.84);
  for (const s of [-1, 1]) pave(p, ...cote(s, 0.9, 0.955), 0.24, 0.3, -0.8, 0.8, m.plastique);

  // --- L'habitacle ouvert : le plancher, la planche de bord, le volant, deux sièges crème et leurs appuie-tête, l'arceau derrière eux. ---
  pave(p, -0.76, 0.76, YH - 0.02, YH + 0.02, ZH[0] + 0.02, ZH[1] - 0.02, m.garniture);
  // Les deux cloisons (derrière les sièges, sous la planche de bord) : la livrée n'y dessine rien.
  pave(p, -0.76, 0.76, YH, 0.82, ZH[0] + 0.005, ZH[0] + 0.015, m.garniture);
  pave(p, -0.76, 0.76, YH, 0.78, ZH[1] - 0.015, ZH[1] - 0.005, m.garniture);
  boite(p, 0.62, 0.74, ZH[1] - 0.16, ZH[1] - 0.02, 0.82, 0.74, ZH[1] - 0.1, ZH[1] - 0.02, m.noir);
  for (const s of [-1, 1]) {
    const x = s * 0.36;
    pave(p, x - 0.2, x + 0.2, YH + 0.02, YH + 0.1, -0.62, -0.2, m.creme);
    boite(p, YH + 0.06, 0.2, -0.74, -0.62, 0.94, 0.18, -0.8, -0.7, m.creme, x);
    pave(p, x - 0.11, x + 0.11, 0.94, 1.06, -0.8, -0.72, m.creme);
  }
  // Le volant, à gauche (+x) : un anneau sombre incliné vers le siège (un cadre au palier 1).
  const v = (a: number): [number, number, number] => [0.36 + Math.cos(a) * 0.17, 0.78 + Math.sin(a) * 0.17 * 0.9, -0.02 - Math.sin(a) * 0.17 * 0.42];
  const pas = c.palier === 1 ? 6 : 10;
  tubes(p, Array.from({ length: pas + 1 }, (_, k) => v((k / pas) * Math.PI * 2)), 0.018, c.palier === 1 ? 3 : 6, m.noir);
  tubes(p, [[0.62, 0.84, -0.82], [0.56, 1.12, -0.82], [-0.56, 1.12, -0.82], [-0.62, 0.84, -0.82]], 0.03, n, m.metal);

  // --- Le pare-brise bas dans son cadre sombre. ---
  boite(p, 0.83, 0.78, ZH[1] + 0.06, ZH[1] + 0.09, 1.07, 0.7, ZH[1] - 0.15, ZH[1] - 0.12, m.vitre);
  tubes(p, [[0.79, 0.82, ZH[1] + 0.08], [0.71, 1.08, ZH[1] - 0.135], [-0.71, 1.08, ZH[1] - 0.135], [-0.79, 0.82, ZH[1] + 0.08]], 0.02, n, m.cadre);

  // --- L'avant : une fente de calandre basse à ailettes, une lame, la plaque. ---
  const nez = coque.bout(1, 0.45).z;
  ailettes(p, c, -0.38, 0.38, 0.38, 0.5, nez, c.palier === 1 ? 2 : 4);
  pave(p, -0.56, 0.56, 0.27, 0.32, nez - 0.3, nez + 0.03, m.plastique);
  plaque(p, c, 0.4, nez + 0.012, 1);
  for (const s of [-1, 1]) rond(p, null, nez + 0.005, s * 0.52, 0.55, 0.075, c.palier === 1 ? 8 : 14, m.noir, null);

  // --- L'arrière court : la plaque, deux échappements au milieu. ---
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.6, 0.6, 0.3, 0.38, queue - 0.01, queue + 0.12, m.plastique);
  for (const s of [-1, 1]) echappement(p, s * 0.14, 0.32, queue + 0.06, 0.045, 0.13, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.47, queue - 0.01, -1);

  // --- Les côtés : rétroviseurs sur pied, poignée, ouïe derrière la roue avant. ---
  for (const s of [-1, 1]) {
    retroviseur(p, c, s, { pied: [0.84, 0.92, 0.82, 0.86, 0.06], centre: [0.96, 0.9, 0.06], rayons: [0.058, 0.05, 0.088] });
    poignee(p, c, s, -0.68, 0.74, 0.93, 0.16);
    pave(p, ...cote(s, 0.945, 0.975), 0.46, 0.62, 0.66, 0.82, m.cadre);
    if (c.palier > 1) for (let k = 0; k < 3; k++) pave(p, ...cote(s, 0.95, 0.98), 0.485 + k * 0.045, 0.5 + k * 0.045, 0.67, 0.81, m.grille);
  }
}

function feuxG(c: Contexte): Feux {
  const coque = c.coque!;
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : deux phares ronds sur le nez, chacun cerclé d'un anneau de jour ; le clignotant ambre sous lui.
      const nez = coque.bout(1, 0.45).z;
      for (const s of [-1, 1]) rond(null, f, nez + 0.005, s * 0.52, 0.55, 0.075, c.palier === 1 ? 8 : 14, boitier, jour);
      coque.ruban(f, 1, 0.42, 0.46, 0.46, 3, 0.011, ambre);
    },
    stop(f) {
      // Un feu mince qui fait le tour de chaque coin arrière, dans son boîtier sombre.
      coque.ruban(f, -1, 0.62, 0.74, 0.5, 3, 0.004, boitier);
      coque.ruban(f, -1, 0.645, 0.715, 0.52, 3, 0.011, rouge);
    },
  };
}
