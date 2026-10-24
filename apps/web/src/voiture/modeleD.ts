// Lot 42 — modèle D, la **compacte de rallye** (Badger) : une trois-portes courte et haute, posée plus haut que les autres (on voit la route sous
// elle), élargie par des ailes rapportées au-dessus de chaque roue, des bavettes derrière les roues, une rampe de quatre phares ronds devant la
// calandre, une écope sur le toit, un grand becquet à dérives au-dessus du hayon, des ouïes sur le capot. Le type : la compacte de rallye des
// spéciales sur terre. Création originale : aucun modèle, aucune calandre ni aucun phare d'une voiture réelle (standard.md du lot 40c).
import { boite, cle, extruder, levre, pave, type Sec } from "./forme";
import { ailettes, capotPlat, cote, montant, plaque, poignee, retroviseur } from "./details";
import { rond } from "./atelier";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -1.84;
const ZF = 1.98;

type P2 = [number, number];
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];
/** La hauteur de la rampe de phares. */
const YR = 0.66;

export const PLAN_D: PlanVoiture = {
  id: "D",
  nom: "D — Compacte de rallye",
  resume: "Une trois-portes courte et haute : ailes rapportées, bavettes, rampe de quatre phares ronds, écope de toit, grand becquet à dérives.",
  cles: [
    // Le hayon presque droit, le becquet au-dessus.
    habitacle(ZR, 0.38, [0.8, 0.42], [0.88, 0.6], [0.85, 0.92], [0.8, 0.98], [0.66, 1.04], 1.06),
    habitacle(-1.6, 0.33, [0.86, 0.37], [0.94, 0.6], [0.91, 0.92], [0.84, 0.99], [0.7, 1.28], 1.32),
    habitacle(-1.2, 0.32, [0.87, 0.36], [0.95, 0.6], [0.92, 0.91], [0.85, 0.97], [0.72, 1.31], 1.35),
    habitacle(-0.3, 0.32, [0.87, 0.36], [0.95, 0.59], [0.92, 0.9], [0.85, 0.95], [0.73, 1.32], 1.36),
    habitacle(0.32, 0.32, [0.87, 0.36], [0.95, 0.58], [0.92, 0.89], [0.85, 0.93], [0.71, 1.31], 1.35),
    // Le pied du pare-brise, juste derrière l'œil de la vue capot (z 0,98).
    habitacle(0.9, 0.32, [0.87, 0.36], [0.95, 0.57], [0.92, 0.87], [0.85, 0.874], [0.64, 0.884], 0.896),
    capotPlat(1.3, 0.32, [0.87, 0.36], [0.95, 0.56], [0.92, 0.865], 0.872),
    capotPlat(1.76, 0.33, [0.84, 0.37], [0.93, 0.53], [0.9, 0.855], 0.862),
    capotPlat(ZF, 0.35, [0.74, 0.38], [0.86, 0.52], [0.82, 0.8], 0.81),
  ],
  bombe: { 2: 0.05, 3: 0.07, 4: 0.1, 5: 0.05, 6: 0.12, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.32, 0.9], lunette: [ZR, -1.6], vitres: [-1.35, 0.82] },
  // Une caisse plus carrée que la Sparrow : le flanc et le bord du toit moins arrondis.
  tole: { rayons: [0, 0.05, 0.03, 0.1, 0, 0, 0, 0, 0.03, 0.05, 0], boutArriere: 0.26, boutAvant: 0.32 },
  vueCapot: { dy: 0.1 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [0.95, 2.1],
      [-2.0, 0.32],
    ],
    largeurBande: 0.56,
    portiere: { z: 0.1, y: 0.7, h: 0.27 },
    arriere: { y: 0.76, h: 0.16 },
    flancs: { z: [-0.62, 0.62], y: [0.44, 0.82] },
    toit: 1.0,
    filet: 0.58,
    joints: {
      // Une seule longue portière (la trois-portes), la vitre de custode fixe derrière elle, la trappe du réservoir.
      flanc: [
        [0.78, 0.35, 0.74, 0.94],
        [-0.66, 0.35, -0.68, 0.94],
        [-1.1, 0.64, -0.94, 0.64],
        [-0.94, 0.64, -0.94, 0.8],
        [-0.94, 0.8, -1.1, 0.8],
        [-1.1, 0.8, -1.1, 0.64],
      ],
      dessus: [
        [0.8, 0.95, 0.77, 1.9],
        [0.77, 1.9, 0, 1.91],
        [0.8, 0.95, 0, 0.95],
        [0.62, -1.62, 0, -1.62],
      ],
      arriere: [
        [0, 0.6, 0.82, 0.6],
        [0.82, 0.6, 0.84, 0.98],
      ],
    },
    arches: [
      [1.3, 0.38, 0.49],
      [-1.3, 0.38, 0.49],
    ],
    interieur: [0.25, -0.7, 1.05],
  },
  roue: { branches: 6, jante: 0.6, dessin: "lames" },
  pieces(p, c) {
    piecesD(p, c);
  },
  feux: feuxD,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Le grand becquet et la rampe de phares : ce qui fait lire la rallye à 50 m, de dos comme de face.
      pave(p, -0.74, 0.74, 1.3, 1.37, ZR - 0.1, ZR + 0.3, f.caisse);
      pave(p, -0.6, 0.6, YR - 0.07, YR + 0.07, ZF + 0.02, ZF + 0.1, f.sombre);
    },
  },
};

function piecesD(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  // Les ailes rapportées : une lèvre large et peinte qui déborde par-dessus le pneu (la largeur de la rallye, de dos comme de face), son dessous en plastique.
  for (const [s, z] of ROUES) levre(p, s, 0.88, 1.045, z, 0.38, 0.49, 0.56, 0.06, Math.PI - 0.06, arc + 1, m.peinture, m.plastique, 0.92);
  // Les bavettes derrière chaque roue (sombres, un liseré crème en bas), et les bas de caisse.
  for (const [s, z] of ROUES) {
    const zb = z - 0.5;
    pave(p, ...cote(s, 0.7, 0.99), 0.12, 0.44, zb - 0.012, zb + 0.012, m.noir);
    if (c.palier > 1) pave(p, ...cote(s, 0.7, 0.99), 0.12, 0.17, zb - 0.016, zb + 0.016, m.creme);
  }
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.9, 0.96), 0.3, 0.36, -0.74, 0.74, m.plastique);
    pave(p, ...cote(s, 0.93, 0.965), 0.36, 0.375, -0.74, 0.74, m.cadre);
  }

  // --- L'avant : calandre en grille entre les phares, grande prise d'air basse, sabot, plaque ; la rampe de quatre phares ronds devant la calandre. ---
  const nez = coque.bout(1, 0.6).z;
  ailettes(p, c, -0.36, 0.36, 0.56, 0.72, nez, c.palier === 1 ? 3 : 5);
  ailettes(p, c, -0.6, 0.6, 0.38, 0.5, nez, c.palier === 1 ? 2 : 4);
  // Le sabot (plaque de protection sous le nez, en métal clair) et les crochets de remorquage.
  pave(p, -0.58, 0.58, 0.26, 0.31, nez - 0.3, nez + 0.04, m.metal);
  if (c.palier > 1) pave(p, 0.42, 0.48, 0.32, 0.36, nez - 0.02, nez + 0.07, m.creme);
  plaque(p, c, 0.44, nez + 0.016, 1);
  // La rampe : une barre sombre sur deux pattes, quatre boîtiers ronds (les glaces sont dans les feux).
  pave(p, -0.62, 0.62, YR - 0.02, YR + 0.02, nez + 0.04, nez + 0.08, m.cadre);
  for (const x of [-0.42, 0.42]) pave(p, x - 0.02, x + 0.02, YR - 0.02, 0.74, nez, nez + 0.06, m.cadre);
  for (const x of [-0.5, -0.17, 0.17, 0.5]) rond(p, null, nez + 0.12, x, YR, 0.072, c.palier === 1 ? 6 : 14, m.noir, null);
  // Les ouïes du capot : deux grilles sombres de part et d'autre de l'axe.
  for (const s of [-1, 1]) {
    pave(p, ...cote(s, 0.16, 0.46), 0.866, 0.872, 1.36, 1.64, m.cadre);
    if (c.palier > 1) for (let k = 0; k < 4; k++) pave(p, ...cote(s, 0.18, 0.44), 0.872, 0.878, 1.39 + k * 0.065, 1.41 + k * 0.065, m.grille);
  }

  // --- L'arrière : le bouclier, un gros échappement à droite, la plaque ; les crochets. ---
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.66, 0.66, 0.32, 0.42, queue - 0.01, queue + 0.12, m.plastique);
  echappement(p, -0.5, 0.36, queue + 0.06, 0.06, 0.14, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  if (c.palier > 1) pave(p, 0.42, 0.48, 0.34, 0.38, queue - 0.07, queue + 0.02, m.creme);
  plaque(p, c, 0.5, queue - 0.01, -1);

  // --- Le grand becquet au-dessus du hayon, sur deux dérives qui descendent le long de la lunette. ---
  extruder(
    p,
    [
      [ZR - 0.1, 1.31],
      [ZR + 0.32, 1.33],
      [ZR + 0.36, 1.37],
      [ZR - 0.06, 1.355],
    ],
    -0.74,
    0.74,
    m.peinture,
    m.garniture,
  );
  for (const s of [-1, 1]) {
    extruder(
      p,
      [
        [ZR - 0.12, 1.385],
        [ZR + 0.38, 1.385],
        [ZR + 0.34, 1.29],
        [ZR - 0.02, 1.2],
      ],
      s * 0.74 - 0.018,
      s * 0.74 + 0.018,
      m.cadre,
    );
  }
  // --- L'écope du toit (ouverture sombre vers l'avant). ---
  boite(p, 1.34, 0.16, -0.32, 0.14, 1.392, 0.13, -0.26, 0.1, m.peinture);
  pave(p, -0.11, 0.11, 1.352, 1.384, 0.098, 0.12, m.noir);

  // --- Les côtés : rétroviseurs sur pied, montant de custode, poignée de la longue portière. ---
  for (const s of [-1, 1]) {
    retroviseur(p, c, s, { pied: [0.855, 0.935, 0.93, 0.97, 0.7], centre: [0.975, 1.01, 0.72], rayons: [0.062, 0.056, 0.092] });
    poignee(p, c, s, -0.5, 0.82, 0.945);
  }
  montant(p, c, 0.9, 0.88, -0.74, -0.62, 1.3, 0.75);
}

function feuxD(c: Contexte): Feux {
  const coque = c.coque!;
  const verre: Fini = { couleur: srgb(0x8a97a5), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rampe: Fini = { couleur: srgb(0xfff4dc), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : des phares carrés aux coins, un trait de jour en équerre ; la rampe de quatre ronds, d'un blanc chaud.
      coque.ruban(f, 1, 0.55, 0.73, 0.38, 3, 0.004, boitier);
      coque.ruban(f, 1, 0.57, 0.71, 0.4, 2, 0.008, verre, 0.74);
      coque.ruban(f, 1, 0.57, 0.585, 0.4, 3, 0.012, jour);
      coque.ruban(f, 1, 0.585, 0.71, 0.66, 3, 0.012, jour, 0.76);
      coque.ruban(f, 1, 0.5, 0.54, 0.5, 3, 0.011, ambre);
      const nez = coque.bout(1, 0.6).z;
      for (const x of [-0.5, -0.17, 0.17, 0.5]) rond(null, f, nez + 0.12, x, YR, 0.072, c.palier === 1 ? 6 : 14, boitier, rampe);
    },
    stop(f) {
      // Des feux hauts et étroits aux coins du hayon (deux carrés l'un sur l'autre), et le troisième feu sous le becquet.
      coque.ruban(f, -1, 0.62, 0.96, 0.62, 3, 0.004, boitier);
      for (const [a, b] of [
        [0.81, 0.94],
        [0.65, 0.78],
      ] as const)
        coque.ruban(f, -1, a, b, 0.64, 3, 0.011, rouge);
      pave(f, -0.22, 0.22, 1.295, 1.31, ZR - 0.11, ZR - 0.07, rouge);
    },
  };
}
