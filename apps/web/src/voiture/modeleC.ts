// Lot 40 — modèle C, proposition libre : un **prototype d'endurance fermé** (une « barquette » à bulle). Pourquoi pour Track : (1) les ailes
// détachées au-dessus de chaque roue font voir le braquage des roues avant depuis la caméra de poursuite, mieux qu'une caisse qui les couvre ;
// (2) l'habitacle est une bulle étroite au centre, basse : de dos, la poupe (lame de feux, aileron, dérive, numéro) prend toute la place ; (3) la
// silhouette se lit « voiture de course » à 50 m, en fantôme, rien qu'à ses deux bosses et à sa dérive ; (4) elle reste dans le gabarit des
// deux autres (la simulation ne change pas). Le centre plonge entre les ailes (un capot creux), une dérive court sur le dos jusqu'à l'aileron.
// Pas d'intérieur : la bulle est vitrée, sombre et opaque. Création originale.
// Lot 40c — **la Dragonfly au standard** (standard.md) : caisse tôle, ailes détachées (1 m, au-dessus des roues à 0,76 m : la roue ne traverse jamais l'aile), joints, phares à trois traits et feux en lame construits
// sur les coins, rétroviseurs sur les ailes avant par un pied, deux échappements creux, prises d'air à ailettes.
import { boite, cle, extruder, levre, pave } from "./forme";
import { ailettes, cote, plaque, retroviseur } from "./details";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.15;
const ZF = 2.22;

type P2 = [number, number];
/**
 * Une section du proto : le flanc et l'aile (épaule haute au-dessus des roues, plus basse ailleurs), le creux entre les ailes (pied de vitre),
 * la bulle (bord du toit, dessus) — hors de la bulle, le dessus suit le creux.
 */
const sec = (z: number, b: number, seuil: P2, flanc: P2, aile: P2, creux: P2, bulle: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule: aile, vitre: creux, toit: bulle, dessus });

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_C: PlanVoiture = {
  id: "C",
  nom: "C — Proto à bulle",
  resume: "Un prototype d'endurance fermé : ailes détachées au-dessus des roues (le braquage se voit), bulle étroite au centre, dérive, poupe large.",
  cles: [
    sec(ZR, 0.3, [0.8, 0.34], [0.9, 0.5], [0.88, 0.8], [0.5, 0.74], [0.24, 0.76], 0.77),
    sec(-1.95, 0.22, [0.88, 0.27], [0.96, 0.52], [0.94, 0.88], [0.56, 0.72], [0.26, 0.74], 0.75),
    sec(-1.3, 0.21, [0.88, 0.26], [0.97, 0.56], [0.95, 1.0], [0.56, 0.72], [0.3, 0.78], 0.8),
    sec(-0.9, 0.21, [0.86, 0.26], [0.94, 0.5], [0.9, 0.8], [0.5, 0.74], [0.32, 0.9], 0.94),
    sec(-0.45, 0.21, [0.84, 0.26], [0.92, 0.46], [0.88, 0.62], [0.5, 0.7], [0.36, 1.08], 1.12),
    sec(0.15, 0.21, [0.84, 0.26], [0.92, 0.46], [0.88, 0.62], [0.5, 0.7], [0.36, 1.07], 1.11),
    sec(0.72, 0.21, [0.86, 0.26], [0.94, 0.5], [0.9, 0.8], [0.5, 0.7], [0.32, 0.76], 0.77),
    sec(1.3, 0.22, [0.88, 0.27], [0.96, 0.55], [0.93, 0.98], [0.54, 0.64], [0.3, 0.64], 0.645),
    sec(1.85, 0.23, [0.84, 0.28], [0.92, 0.48], [0.88, 0.8], [0.5, 0.56], [0.26, 0.56], 0.565),
    sec(ZF, 0.26, [0.72, 0.29], [0.8, 0.38], [0.76, 0.5], [0.42, 0.42], [0.2, 0.42], 0.425),
  ],
  bombe: { 2: 0.05, 3: 0.08, 4: 0.18, 5: -0.06, 6: 0.18, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [6, 7] },
  zones: { pareBrise: [0.15, 0.72], lunette: [-0.9, -0.45], vitres: [-0.9, 0.72] },
  tole: { boutArriere: 0.34, boutAvant: 0.36 },
  vueCapot: { dy: 0.04 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    // Le proto : la bande du capot, puis celle qui court sur la bulle, la dérive et le dos jusqu'à la poupe.
    bandes: [
      [0.9, 2.3],
      [-2.25, 0.12],
    ],
    largeurBande: 0.6,
    portiere: { z: -0.2, y: 0.58, h: 0.28 },
    arriere: { y: 0.5, h: 0.22 },
    flancs: { z: [0.02, 0.78], y: [0.28, 0.6] },
    toit: 0.95,
    filet: 0.44,
    joints: {
      // Les ailes avant et arrière (leur bord interne sur le dos), la porte-papillon de la bulle, le capot, le capot moteur.
      flanc: [
        [0.8, 0.3, 0.74, 0.62],
        [-0.8, 0.3, -0.84, 0.62],
        [-0.8, 0.62, 0.8, 0.62],
      ],
      dessus: [
        [0.6, 0.75, 0.56, 2.1],
        [0.56, 2.1, 0, 2.1],
        [0.58, -1.0, 0.54, -2.0],
        [0.54, -2.0, 0, -2.0],
      ],
      arriere: [
        [0, 0.6, 0.86, 0.6],
        [0.86, 0.6, 0.88, 0.76],
      ],
    },
    arches: [
      [1.3, 0.38, 0.46],
      [-1.3, 0.38, 0.46],
    ],
    interieur: [-0.05, -0.05, 0.98],
  },
  roue: { branches: 5, jante: 0.7, dessin: "y" },
  pieces(p, c) {
    piecesC(p, c);
  },
  feux: feuxC,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      pave(p, -0.97, 0.97, 1.08, 1.13, ZR - 0.08, ZR + 0.36, f.caisse);
      pave(p, -0.025, 0.025, 0.74, 1.1, ZR, -0.5, f.caisse);
    },
  },
};

function piecesC(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  // Passages de roue : les ailes couvrent le haut des roues ; une lèvre à l'avant et à l'arrière de chaque aile (elle s'arrête sous le haut de l'aile).
  for (const [s, z] of ROUES) levre(p, s, 0.94, 1.01, z, 0.38, 0.46, 0.5, 0.1, Math.PI - 0.1, arc + 3, m.peinture, m.plastique, 0.96);
  // La dérive : une lame peinte sur le dos, de la bulle à l'aileron (elle porte la couleur de dos, entre les feux et l'aileron).
  extruder(
    p,
    [
      [-0.5, 0.95],
      [-0.5, 0.82],
      [ZR + 0.05, 0.76],
      [ZR + 0.02, 1.12],
    ],
    -0.025,
    0.025,
    m.peinture,
  );
  // Aileron large, bas et plat, porté par la dérive et deux dérives latérales ; bord d'attaque crème.
  const aile: [number, number][] = [
    [ZR - 0.1, 1.06],
    [ZR + 0.3, 1.1],
    [ZR + 0.36, 1.125],
    [ZR + 0.04, 1.135],
    [ZR - 0.12, 1.1],
  ];
  extruder(p, aile, -0.98, 0.98, m.cadre);
  extruder(p, [[ZR + 0.32, 1.115], [ZR + 0.37, 1.122], [ZR + 0.36, 1.136], [ZR + 0.29, 1.13]], -0.985, 0.985, m.creme);
  for (const s of [-1, 1]) pave(p, s * 0.99 - 0.022, s * 0.99 + 0.022, 0.78, 1.2, ZR - 0.16, ZR + 0.4, m.peinture);
  // Poupe : diffuseur haut et large, deux sorties d'échappement creuses de part et d'autre du numéro.
  const queue = coque.bout(-1, 0.4).z;
  pave(p, -0.86, 0.86, 0.16, 0.38, queue - 0.02, queue + 0.55, m.plastique);
  for (const x of [-0.6, -0.3, 0.3, 0.6]) pave(p, x - 0.02, x + 0.02, 0.16, 0.42, queue - 0.03, queue + 0.4, m.noir);
  for (const s of [-1, 1]) echappement(p, s * 0.48, 0.47, queue + 0.06, 0.055, 0.13, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.5, queue - 0.01, -1);
  // Écopes latérales à ailettes devant les roues arrière, rétroviseurs sur pied au bord des ailes avant.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.86, 0.93), 0.36, 0.6, -0.95, -0.7, m.cadre);
    if (c.palier > 1) for (let k = 0; k < 3; k++) pave(p, ...cote(s, 0.9, 0.94), 0.4 + k * 0.07, 0.43 + k * 0.07, -0.93, -0.72, m.grille);
    retroviseur(p, c, s, { pied: [0.8, 0.88, 0.93, 0.98, 0.68], centre: [0.9, 1.02, 0.68], rayons: [0.06, 0.05, 0.088] });
  }
  // La prise d'air de toit (une écope sur la bulle, ouverture sombre vers l'avant) : la silhouette d'un proto, lisible en fantôme.
  boite(p, 1.07, 0.12, -0.5, -0.12, 1.2, 0.09, -0.46, -0.2, m.peinture);
  pave(p, -0.07, 0.07, 1.1, 1.17, -0.215, -0.19, m.noir);
  // Le nez : la lame avant, une prise d'air basse à ailettes, la plaque.
  const nez = coque.bout(1, 0.34).z;
  pave(p, -0.72, 0.72, 0.18, 0.24, nez - 0.55, nez + 0.03, m.plastique);
  ailettes(p, c, -0.34, 0.34, 0.27, 0.36, nez, c.palier === 1 ? 2 : 3);
}

function feuxC(c: Contexte): Feux {
  const coque = c.coque!;
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : trois traits superposés sur le nez de chaque aile, dans leur boîtier.
      coque.ruban(f, 1, 0.33, 0.44, 0.42, 3, 0.004, boitier);
      for (const y of [0.345, 0.378, 0.411]) coque.ruban(f, 1, y, y + 0.02, 0.46, 3, 0.01, jour);
    },
    stop(f) {
      // Lame de feux d'une aile à l'autre, ses bouts se retournent vers le bas au bord des ailes, et le feu de pluie au centre du diffuseur.
      coque.ruban(f, -1, 0.6, 0.72, 0.0, 3, 0.004, boitier);
      coque.ruban(f, -1, 0.63, 0.7, 0.0, 3, 0.009, rouge);
      coque.ruban(f, -1, 0.5, 0.7, 0.6, 3, 0.011, rouge);
      pave(f, -0.1, 0.1, 0.27, 0.36, ZR - 0.125, ZR - 0.09, rouge);
      void c;
    },
  };
}
