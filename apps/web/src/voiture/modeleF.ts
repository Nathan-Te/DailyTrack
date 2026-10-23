// Lot 42 — modèle F, le **pick-up tout-terrain** (Armadillo) : une cabine simple haute et carrée, un capot haut et plat, une benne ouverte derrière
// (ridelles, plancher, hayon), la caisse posée haut au-dessus de grandes ailes en plastique sombre (on voit la route sous elle), un pare-buffle en
// tubes, un arceau dans la benne, une prise d'air de plongée le long du montant droit, des marchepieds, un sabot. Le type : le pick-up de chantier
// préparé pour la piste. Création originale : aucun modèle, aucune calandre ni aucun phare d'une voiture réelle (standard.md du lot 40c).
// La benne est creusée dans les clés de la caisse (le dessus descend au plancher entre les ridelles) ; le mur de la cabine et le hayon sont deux
// clés à 2 et 5 cm l'une de l'autre (des parois droites ; l'arrière n'est presque pas arrondi en plan : le hayon reste plat et carré).
import { cle, levre, pave, type Sec } from "./forme";
import { ailettes, capotPlat, cote, plaque, poignee, retroviseur } from "./details";
import { tube, tubes } from "./atelier";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.2;
const ZF = 2.2;
/** Le mur de la cabine (côté benne) et le plancher de la benne. */
const ZC = -0.47;
const YP = 0.72;

type P2 = [number, number];
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);
/** Une section de la benne : la ridelle (épaule, puis son dessus jusqu'au bord intérieur), la paroi intérieure jusqu'au plancher. */
const benne = (z: number, b: number, seuil: P2, flanc: P2, rail: number) => cle(z, { bas: b, seuil, flanc, epaule: [0.92, rail], vitre: [0.83, rail + 0.008], toit: [0.8, YP], dessus: YP });

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_F: PlanVoiture = {
  id: "F",
  nom: "F — Pick-up tout-terrain",
  resume: "Une cabine simple haute et carrée, une benne ouverte, la caisse posée haut sur de grandes ailes sombres, pare-buffle, arceau, prise d'air de plongée.",
  cles: [
    // Le hayon (plein), puis la benne creusée jusqu'au mur de la cabine.
    capotPlat(ZR, 0.48, [0.84, 0.52], [0.92, 0.7], [0.92, 1.03], 1.03),
    benne(ZR + 0.05, 0.46, [0.86, 0.5], [0.94, 0.7], 1.03),
    benne(-1.3, 0.45, [0.87, 0.49], [0.95, 0.7], 1.03),
    benne(ZC - 0.02, 0.45, [0.87, 0.49], [0.95, 0.7], 1.03),
    // La cabine : mur arrière droit, toit plat, pare-brise.
    // Le haut du mur arrondi, puis le toit (une clé de plus : sans elle, l'interpolation du profil fait bomber le toit au-dessus de 1,4 m).
    habitacle(ZC, 0.45, [0.87, 0.49], [0.95, 0.7], [0.93, 1.02], [0.86, 1.06], [0.74, 1.27], 1.3),
    habitacle(ZC + 0.1, 0.45, [0.87, 0.49], [0.95, 0.7], [0.93, 1.02], [0.86, 1.06], [0.76, 1.34], 1.365),
    habitacle(0.32, 0.45, [0.87, 0.49], [0.95, 0.7], [0.93, 1.01], [0.86, 1.05], [0.75, 1.335], 1.36),
    habitacle(0.9, 0.45, [0.87, 0.49], [0.95, 0.69], [0.93, 1.0], [0.86, 1.005], [0.66, 1.012], 1.024),
    // Le capot haut et plat, le nez droit.
    capotPlat(1.3, 0.45, [0.87, 0.49], [0.95, 0.68], [0.93, 1.0], 1.0),
    capotPlat(ZF, 0.48, [0.8, 0.52], [0.9, 0.66], [0.88, 0.96], 0.97),
  ],
  bombe: { 2: 0.04, 3: 0.05, 4: 0.06, 5: 0.03, 6: 0.06, 7: 0.02 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  // La lunette est une pièce (une vitre posée sur le mur de la cabine) : la zone est hors de la voiture.
  zones: { pareBrise: [0.32, 0.9], lunette: [ZR - 1, ZR - 0.9], vitres: [-0.38, 0.84] },
  // Une caisse carrée : peu d'arrondi sur le flanc, le toit et les ridelles.
  tole: { rayons: [0, 0.04, 0.03, 0.06, 0, 0, 0, 0, 0.02, 0.04, 0], boutArriere: 0.025, boutAvant: 0.26 },
  // Le capot est haut (1 m) : l'œil monte et avance au-dessus du capot, devant le pare-brise.
  vueCapot: { dy: 0.22, dz: 0.15 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [0.95, 2.3],
      [ZC, 0.4],
    ],
    largeurBande: 0.6,
    portiere: { z: 0.36, y: 0.8, h: 0.26 },
    arriere: { y: 0.84, h: 0.17 },
    flancs: { z: [-1.95, -0.62], y: [0.58, 0.96] },
    toit: 1.06,
    filet: 0.74,
    joints: {
      // La portière, la trappe du réservoir sur la benne.
      flanc: [
        [0.86, 0.5, 0.83, 1.0],
        [-0.16, 0.5, -0.16, 1.0],
        [-0.72, 0.76, -0.56, 0.76],
        [-0.56, 0.76, -0.56, 0.9],
        [-0.56, 0.9, -0.72, 0.9],
        [-0.72, 0.9, -0.72, 0.76],
      ],
      dessus: [
        [0.82, 0.95, 0.8, 2.08],
        [0.8, 2.08, 0, 2.09],
        [0.82, 0.95, 0, 0.95],
      ],
      arriere: [
        [0, 0.6, 0.84, 0.6],
        [0.84, 0.6, 0.86, 1.0],
      ],
    },
    arches: [
      [1.3, 0.38, 0.52],
      [-1.3, 0.38, 0.52],
    ],
    interieur: [0.12, 0.12, 1.14],
  },
  roue: { branches: 6, jante: 0.56, dessin: "larges" },
  pieces(p, c) {
    piecesF(p, c);
  },
  feux: feuxF,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // L'arceau et le pare-buffle : le pick-up à 50 m.
      pave(p, -0.8, 0.8, 1.28, 1.34, -0.72, -0.64, f.sombre);
      pave(p, -0.5, 0.5, 0.5, 0.86, ZF + 0.08, ZF + 0.14, f.sombre);
    },
  },
};

function piecesF(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  const n = c.palier === 1 ? 4 : 8;
  // Les grandes ailes en plastique sombre au-dessus de chaque roue (la route se voit sous la caisse).
  for (const [s, z] of ROUES) levre(p, s, 0.86, 1.045, z, 0.38, 0.52, 0.61, 0.04, Math.PI - 0.04, arc + 1, m.plastique, m.noir, 1.02);
  // La benne : le plancher, le mur et les parois en plastique sombre (le revêtement) ; la lunette sur le mur de la cabine.
  pave(p, -0.81, 0.81, YP - 0.06, YP + 0.012, ZR + 0.06, ZC - 0.03, m.plastique);
  pave(p, -0.81, 0.81, YP, 1.0, ZC - 0.035, ZC - 0.02, m.plastique);
  for (const s of [-1, 1]) pave(p, ...cote(s, 0.79, 0.815), YP, 1.0, ZR + 0.06, ZC - 0.03, m.plastique);
  pave(p, -0.62, 0.62, 1.05, 1.31, ZC - 0.026, ZC - 0.018, m.cadre);
  pave(p, -0.58, 0.58, 1.07, 1.29, ZC - 0.032, ZC - 0.024, m.vitre);
  // L'arceau dans la benne, au ras du mur de la cabine.
  tubes(p, [[0.78, 1.03, -0.68], [0.7, 1.33, -0.68], [-0.7, 1.33, -0.68], [-0.78, 1.03, -0.68]], 0.035, n, m.cadre);
  // Les marchepieds sous les portières, le bas de caisse.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.84, 0.99), 0.4, 0.44, -0.3, 0.84, m.cadre);
    if (c.palier > 1) pave(p, ...cote(s, 0.88, 0.96), 0.44, 0.47, -0.3, 0.84, m.plastique);
  }

  // --- L'avant : le nez droit, une grande calandre à barres entre les phares, le sabot, la plaque ; le pare-buffle en tubes devant. ---
  const nez = coque.bout(1, 0.75).z;
  ailettes(p, c, -0.5, 0.5, 0.66, 0.9, nez, c.palier === 1 ? 3 : 5);
  pave(p, -0.84, 0.84, 0.48, 0.62, nez - 0.06, nez + 0.05, m.plastique);
  pave(p, -0.6, 0.6, 0.36, 0.4, nez - 0.5, nez + 0.04, m.metal);
  plaque(p, c, 0.55, nez + 0.052, 1);
  const zb = nez + 0.16;
  tubes(p, [[0.46, 0.46, nez + 0.04], [0.46, 0.46, zb], [0.46, 0.9, zb], [-0.46, 0.9, zb], [-0.46, 0.46, zb], [-0.46, 0.46, nez + 0.04]], 0.03, n, m.cadre);
  tube(p, [0.46, 0.66, zb], [-0.46, 0.66, zb], 0.026, n, m.cadre);

  // --- L'arrière : pare-chocs à marche, la plaque, l'échappement sous la benne. ---
  const queue = coque.bout(-1, 0.8).z;
  pave(p, -0.86, 0.86, 0.44, 0.54, queue - 0.08, queue + 0.1, m.plastique);
  pave(p, -0.3, 0.3, 0.54, 0.56, queue - 0.08, queue + 0.02, m.metal);
  plaque(p, c, 0.66, queue - 0.01, -1);
  echappement(p, -0.62, 0.42, queue + 0.2, 0.045, 0.2, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);

  // --- Les côtés : rétroviseurs sur pied, poignée ; la prise d'air de plongée le long du montant droit. ---
  for (const s of [-1, 1]) {
    retroviseur(p, c, s, { pied: [0.86, 0.94, 1.05, 1.1, 0.78], centre: [0.98, 1.14, 0.8], rayons: [0.064, 0.07, 0.1] });
    poignee(p, c, s, -0.02, 0.92, 0.93);
  }
  tubes(p, [[-0.92, 0.98, 1.05], [-0.96, 1.04, 0.92], [-0.9, 1.3, 0.42], [-0.9, 1.36, 0.36]], 0.045, n, m.cadre);
  pave(p, -0.97, -0.83, 1.33, 1.39, 0.34, 0.46, m.cadre);
}

function feuxF(c: Contexte): Feux {
  const coque = c.coque!;
  const verre: Fini = { couleur: srgb(0x8a97a5), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : des phares hauts et carrés aux coins, deux traits de jour (dessus et dessous), le clignotant ambre sous eux.
      coque.ruban(f, 1, 0.66, 0.92, 0.54, 2, 0.004, boitier);
      coque.ruban(f, 1, 0.69, 0.89, 0.57, 2, 0.008, verre, 0.82);
      coque.ruban(f, 1, 0.885, 0.9, 0.56, 2, 0.012, jour);
      coque.ruban(f, 1, 0.68, 0.695, 0.56, 2, 0.012, jour);
      coque.ruban(f, 1, 0.6, 0.64, 0.6, 2, 0.011, ambre);
      void c;
    },
    stop(f) {
      // Des feux hauts et étroits aux deux coins du hayon, à trois cases ; le troisième feu au-dessus de la lunette.
      coque.ruban(f, -1, 0.62, 1.0, 0.72, 3, 0.004, boitier);
      for (const [a, b] of [
        [0.88, 0.98],
        [0.76, 0.86],
        [0.64, 0.74],
      ] as const)
        coque.ruban(f, -1, a, b, 0.74, 3, 0.011, rouge);
      pave(f, -0.2, 0.2, 1.325, 1.35, ZC - 0.034, ZC - 0.024, rouge);
    },
  };
}
