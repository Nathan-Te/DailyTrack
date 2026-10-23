// Lot 40 — modèle B, « GT basse » : large et posée, le capot long, l'habitacle reculé et bas (1,18 m), un pavillon fuyant jusqu'à un coffre
// court, des hanches arrière larges au-dessus des roues, un grand aileron sur cols de cygne aux dérives peintes, un diffuseur profond et une
// lame de feux d'un bord à l'autre. De dos, c'est la plus large et la plus basse des trois. Création originale.
// Lot 40c — **la Moray au standard** (standard.md) : caisse tôle, ailes avant en bosses au-dessus des roues autour d'un capot bas et long (la roue ne traverse jamais la tôle), joints dans le nuanceur,
// phares en amande et feux en lame construits sur les coins, rétroviseurs sur pied, quatre échappements creux, ouïes à ailettes, bouche avant à ailettes.
import { cle, extruder, levre, pave, type Sec } from "./forme";
import { ailettes, capotPlat, cote, montant, plaque, poignee, retroviseur } from "./details";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.12;
const ZF = 2.26;

type P2 = [number, number];
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_B: PlanVoiture = {
  id: "B",
  nom: "B — GT basse",
  resume: "Large et posée : capot long entre deux ailes en bosse, habitacle reculé et bas, hanches arrière, grand aileron sur cols de cygne, lame de feux d'un bord à l'autre.",
  cles: [
    capotPlat(ZR, 0.32, [0.82, 0.36], [0.92, 0.52], [0.88, 0.78], 0.788),
    capotPlat(-1.98, 0.25, [0.89, 0.29], [0.97, 0.52], [0.95, 0.84], 0.838),
    capotPlat(-1.55, 0.24, [0.9, 0.28], [0.97, 0.53], [0.96, 0.86], 0.868),
    habitacle(-1.25, 0.24, [0.9, 0.28], [0.97, 0.53], [0.95, 0.84], [0.78, 0.88], [0.5, 0.9], 0.91),
    habitacle(-0.7, 0.24, [0.89, 0.28], [0.96, 0.52], [0.9, 0.8], [0.74, 0.85], [0.6, 1.12], 1.17),
    habitacle(-0.05, 0.24, [0.88, 0.28], [0.95, 0.51], [0.88, 0.76], [0.76, 0.82], [0.62, 1.13], 1.18),
    // Le pied du pare-brise : un peu relevé pour joindre les ailes (le capot est bas entre elles).
    habitacle(0.52, 0.24, [0.88, 0.28], [0.95, 0.5], [0.9, 0.8], [0.8, 0.795], [0.56, 0.785], 0.797),
    // Devant : les ailes (0,83 m, au-dessus du haut de la roue à 0,76 m) encadrent un capot bas (0,70 m).
    capotPlat(1.3, 0.25, [0.88, 0.29], [0.96, 0.5], [0.92, 0.83], 0.7),
    capotPlat(1.9, 0.26, [0.85, 0.3], [0.93, 0.46], [0.88, 0.7], 0.6),
    capotPlat(ZF, 0.28, [0.72, 0.31], [0.82, 0.38], [0.76, 0.5], 0.49),
  ],
  bombe: { 2: 0.05, 3: 0.1, 4: 0.16, 5: 0.07, 6: 0.16, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [-0.05, 0.52], lunette: [-1.25, -0.7], vitres: [-1.1, 0.45] },
  tole: { boutArriere: 0.36, boutAvant: 0.4 },
  vueCapot: { dy: 0.04 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.08,
    hauteur: 1.5,
    bandes: [
      [0.75, 2.35],
      [-2.2, -0.1],
    ],
    largeurBande: 0.66,
    portiere: { z: -0.35, y: 0.58, h: 0.28 },
    arriere: { y: 0.47, h: 0.21 },
    flancs: { z: [-0.08, 0.72], y: [0.32, 0.72] },
    toit: 0.9,
    filet: 0.46,
    joints: {
      // La GT : une longue portière, la trappe du réservoir sur la hanche, le capot long, le couvercle moteur.
      flanc: [
        [0.5, 0.3, 0.46, 0.8],
        [-0.98, 0.3, -1.0, 0.8],
        [-1.2, 0.58, -1.2, 0.72],
        [-1.2, 0.72, -1.4, 0.72],
        [-1.4, 0.72, -1.4, 0.58],
        [-1.4, 0.58, -1.2, 0.58],
      ],
      dessus: [
        [0.84, 0.55, 0.8, 2.15],
        [0.8, 2.15, 0, 2.16],
        [0.84, 0.55, 0, 0.55],
        [0.8, -1.25, 0.76, -2.05],
        [0.76, -2.05, 0, -2.05],
        [0.8, -1.25, 0, -1.25],
      ],
      arriere: [
        [0, 0.56, 0.86, 0.56],
        [0.86, 0.56, 0.88, 0.8],
      ],
    },
    arches: [
      [1.3, 0.38, 0.47],
      [-1.3, 0.38, 0.5],
    ],
    interieur: [-0.1, -0.62, 0.99],
  },
  roue: { branches: 5, jante: 0.72, dessin: "doubles" },
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
  const coque = c.coque!;
  // Passages de roue : hanches arrière plus larges et plus hautes que l'avant ; la lèvre s'arrête là où l'aile s'arrête.
  for (const [s, z] of ROUES) {
    const ar = z < 0;
    levre(p, s, 0.93, ar ? 1.04 : 1.02, z, 0.38, 0.47, ar ? 0.56 : 0.52, 0.1, Math.PI - 0.1, arc + 3, m.peinture, m.plastique, ar ? 0.9 : 0.82);
  }
  // Lames latérales : bas de caisse sombre, plus saillant, un filet net au-dessus.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.9, 1.0), 0.2, 0.28, -0.8, 0.8, m.plastique);
    if (c.palier > 1) pave(p, ...cote(s, 0.93, 0.985), 0.28, 0.295, -0.8, 0.8, m.cadre);
  }
  // Grand aileron sur cols de cygne : la lame haute, les dérives peintes (elles portent la couleur de dos), les cols sombres.
  const aile: [number, number][] = [
    [ZR - 0.02, 1.16],
    [ZR + 0.38, 1.2],
    [ZR + 0.44, 1.235],
    [ZR + 0.1, 1.245],
    [ZR - 0.04, 1.205],
  ];
  extruder(p, aile, -0.97, 0.97, m.cadre);
  extruder(p, [[ZR + 0.4, 1.225], [ZR + 0.45, 1.232], [ZR + 0.44, 1.246], [ZR + 0.37, 1.24]], -0.975, 0.975, m.creme);
  for (const s of [-1, 1]) {
    pave(p, s * 0.98 - 0.022, s * 0.98 + 0.022, 1.02, 1.3, ZR - 0.06, ZR + 0.5, m.peinture);
    pave(p, s * 0.45 - 0.03, s * 0.45 + 0.03, 0.82, 1.27, ZR + 0.3, ZR + 0.38, m.cadre);
    pave(p, s * 0.45 - 0.03, s * 0.45 + 0.03, 1.24, 1.27, ZR + 0.12, ZR + 0.38, m.cadre);
  }
  // Diffuseur profond à cinq ailettes, quatre échappements creux, plaque.
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.78, 0.78, 0.18, 0.36, queue - 0.02, queue + 0.5, m.plastique);
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) pave(p, x - 0.018, x + 0.018, 0.18, 0.4, queue - 0.03, queue + 0.36, m.noir);
  for (const s of [-1, 1]) for (const dx of c.palier === 1 ? [0] : [0, 0.13]) echappement(p, s * (0.62 + dx), 0.3, queue + 0.06, 0.045, 0.13, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.46, queue - 0.01, -1);
  // Le nez : grande bouche à ailettes, lame avant, plaque ; le capot porte trois ouïes.
  const nez = coque.bout(1, 0.4).z;
  ailettes(p, c, -0.62, 0.62, 0.285, 0.4, nez, c.palier === 1 ? 3 : 6);
  plaque(p, c, 0.34, nez + 0.012, 1);
  pave(p, -0.66, 0.66, 0.2, 0.26, nez - 0.5, nez + 0.025, m.plastique);
  for (const s of [-1, 1]) {
    for (const k of c.palier === 1 ? [0, 1] : [0, 1, 2]) pave(p, s * (0.32 + k * 0.1) - 0.03, s * (0.32 + k * 0.1) + 0.03, 0.7, 0.725, 1.1, 1.45, m.noir);
    // Rétroviseur sur son pied au coin de la vitre ; poignée de la longue portière ; ouïes derrière la roue avant.
    retroviseur(p, c, s, { pied: [0.86, 0.93, 0.8, 0.85, 0.34], centre: [0.98, 0.89, 0.36], rayons: [0.058, 0.048, 0.09] });
    poignee(p, c, s, -0.18, 0.75, 0.94);
    if (c.palier > 1) for (const k of [0, 1]) pave(p, ...cote(s, 0.95, 0.99), 0.42 + k * 0.08, 0.46 + k * 0.08, 0.62, 0.84, m.noir);
    else pave(p, ...cote(s, 0.95, 0.99), 0.42, 0.54, 0.62, 0.84, m.noir);
  }
  montant(p, c, 0.84, 0.75, -1.02, -0.94, 0.98, 0.69);
}

function feuxB(c: Contexte): Feux {
  const coque = c.coque!;
  const verre: Fini = { couleur: srgb(0x8a97a5), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : un phare en amande sur le nez, fermé d'un crochet de jour au bout de l'aile ; un trait sous la bouche.
      coque.ruban(f, 1, 0.37, 0.475, 0.26, 3, 0.004, boitier);
      coque.ruban(f, 1, 0.385, 0.46, 0.3, 2, 0.008, verre, 0.74);
      coque.ruban(f, 1, 0.43, 0.445, 0.3, 3, 0.012, jour);
      coque.ruban(f, 1, 0.37, 0.43, 0.64, 3, 0.011, ambre);
      coque.ruban(f, 1, 0.405, 0.42, 0.0, 1, 0.01, jour, 0.2);
    },
    stop(f) {
      // Une lame d'un bord à l'autre, plus épaisse aux deux bouts qui descendent sur la hanche (signature de dos).
      coque.ruban(f, -1, 0.68, 0.81, 0.0, 3, 0.004, boitier);
      coque.ruban(f, -1, 0.735, 0.775, 0.0, 3, 0.009, rouge);
      coque.ruban(f, -1, 0.62, 0.79, 0.5, 3, 0.011, rouge);
      void c;
    },
  };
}
