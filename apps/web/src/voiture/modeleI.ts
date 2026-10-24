// Lot 42 — modèle I, la **fourgonnette de livraison** (Pelican), la voiture qui fait sourire : une caisse haute et ronde au flanc plein (la livrée et le
// numéro y prennent toute la place), une cabine au pare-brise droit, un capot court et étroit entre deux ailes séparées en goutte, de gros phares
// ronds posés sur les ailes, une calandre haute à barreaux, des marchepieds d'une aile à l'autre, des pare-chocs en métal. Le type : la fourgonnette
// de livraison d'autrefois. Création originale : aucun modèle, aucune calandre ni aucun phare d'une voiture réelle (standard.md du lot 40c).
import { cle, pave, type Sec } from "./forme";
import { capotPlat, cote, plaque, poignee, retroviseur } from "./details";
import { carenage, rond } from "./atelier";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.06;
const ZF = 2.08;

type P2 = [number, number];
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);
/** La caisse haute (cabine et fourgon) : flanc presque droit, toit rond. */
const caisseHaute = (z: number, toit: P2, dessus: number) => habitacle(z, 0.44, [0.76, 0.48], [0.81, 0.7], [0.81, 0.98], [0.79, 1.02], toit, dessus);

/** Les phares ronds sur les ailes avant. */
const PHARE = { z: 1.66, x: 0.78, y: 0.86, r: 0.085 };

export const PLAN_I: PlanVoiture = {
  id: "I",
  nom: "I — Fourgonnette de livraison",
  resume: "Une caisse haute et ronde au flanc plein, un capot court entre deux ailes séparées, de gros phares ronds sur les ailes, une calandre à barreaux, des marchepieds.",
  cles: [
    habitacle(ZR, 0.48, [0.7, 0.52], [0.76, 0.7], [0.76, 0.98], [0.74, 1.02], [0.6, 1.3], 1.33),
    caisseHaute(-1.82, [0.66, 1.34], 1.37),
    caisseHaute(-0.2, [0.67, 1.345], 1.375),
    caisseHaute(0.72, [0.67, 1.345], 1.375),
    // Le haut du pare-brise, puis son pied (presque droit) : l'œil de la vue capot est devant lui, au-dessus du capot.
    caisseHaute(1.04, [0.66, 1.33], 1.36),
    habitacle(1.3, 0.44, [0.76, 0.48], [0.81, 0.7], [0.81, 0.95], [0.77, 0.955], [0.6, 0.965], 0.975),
    // Le capot court et étroit entre les ailes, puis la calandre haute.
    capotPlat(1.74, 0.46, [0.55, 0.5], [0.6, 0.66], [0.58, 0.92], 0.93),
    capotPlat(ZF, 0.48, [0.5, 0.52], [0.55, 0.64], [0.53, 0.88], 0.89),
  ],
  bombe: { 2: 0.04, 3: 0.06, 4: 0.08, 5: 0.04, 6: 0.14, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  // Seule la cabine a des vitres (le fourgon est plein) ; la lunette est une pièce sur la porte arrière.
  zones: { pareBrise: [1.04, 1.3], lunette: [ZR - 1, ZR - 0.9], vitres: [0.7, 1.28] },
  // Une caisse ronde : le bord du toit très arrondi.
  tole: { rayons: [0, 0.05, 0.03, 0.12, 0, 0, 0, 0, 0.04, 0.16, 0], boutArriere: 0.36, boutAvant: 0.2 },
  // La cabine est sous l'œil habituel : il avance au-dessus du capot, devant le pare-brise.
  vueCapot: { dy: 0.16, dz: 0.47 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.04,
    hauteur: 1.5,
    // Les bandes : le capot, puis tout le toit jusqu'à la porte arrière.
    bandes: [
      [1.3, 2.2],
      [-2.2, 1.04],
    ],
    largeurBande: 0.52,
    portiere: { z: -0.62, y: 0.74, h: 0.34 },
    arriere: { y: 0.66, h: 0.16 },
    flancs: { z: [-1.7, 0.5], y: [0.5, 0.98] },
    toit: 1.04,
    filet: 0.82,
    joints: {
      // La portière de la cabine, la porte coulissante du fourgon, la trappe du réservoir.
      flanc: [
        [1.28, 0.47, 1.26, 0.98],
        [0.72, 0.47, 0.72, 1.3],
        [0.62, 0.47, 0.62, 1.3],
        [-0.5, 0.47, -0.5, 1.3],
        [-1.5, 0.6, -1.36, 0.6],
        [-1.36, 0.6, -1.36, 0.72],
        [-1.36, 0.72, -1.5, 0.72],
        [-1.5, 0.72, -1.5, 0.6],
      ],
      dessus: [
        [0.5, 1.32, 0.48, 1.98],
        [0.48, 1.98, 0, 1.99],
      ],
      // La porte arrière d'une pièce (on la lève) : ses bords.
      arriere: [
        [0, 0.48, 0.66, 0.48],
        [0.66, 0.48, 0.62, 1.26],
      ],
    },
    arches: [
      [1.3, 0.38, 0.5],
      [-1.3, 0.38, 0.5],
    ],
    interieur: [1.0, 1.0, 1.18],
  },
  roue: { branches: 8, jante: 0.58, dessin: "larges" },
  pieces(p, c) {
    piecesI(p, c);
  },
  feux: feuxI,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Les deux ailes avant et les phares ronds : la fourgonnette à 50 m.
      for (const s of [-1, 1]) pave(p, ...cote(s, 0.6, 1.0), 0.6, 0.9, 0.9, 1.8, f.caisse);
      for (const s of [-1, 1]) pave(p, ...cote(s, 0.7, 1.0), 0.5, 0.86, -1.75, -0.85, f.caisse);
    },
  },
};

function piecesI(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  // Les ailes séparées, en goutte : l'avant descend vers le pare-chocs, l'arrière rejoint le marchepied ; leur dessous en plastique sombre.
  for (const s of [-1, 1]) {
    carenage(p, s, 0.58, 1.02, 1.3, 0.38, 0.46, 0.53, 0.02 * Math.PI, 0.96 * Math.PI, arc + 1, m.peinture, m.plastique);
    carenage(p, s, 0.7, 1.02, -1.3, 0.38, 0.46, 0.52, 0.06 * Math.PI, 0.99 * Math.PI, arc + 1, m.peinture, m.plastique);
    // Le marchepied d'une aile à l'autre, sous la porte (sombre, un liseré clair).
    pave(p, ...cote(s, 0.74, 1.0), 0.4, 0.45, -0.84, 0.86, m.cadre);
    if (c.palier > 1) pave(p, ...cote(s, 0.98, 1.004), 0.415, 0.435, -0.84, 0.86, m.metal);
  }
  // Les nacelles des phares ronds, peintes, sur les ailes (les glaces sont dans les feux).
  for (const s of [-1, 1]) rond(p, null, PHARE.z, s * PHARE.x, PHARE.y, PHARE.r, c.palier === 1 ? 8 : 14, m.peinture, null);

  // --- L'avant : la calandre haute à barreaux de métal clair dans son cadre, le pare-chocs en métal, la plaque. ---
  const nez = coque.bout(1, 0.7).z;
  pave(p, -0.4, 0.4, 0.52, 0.86, nez - 0.03, nez + 0.006, m.cadre);
  const barreaux = c.palier === 1 ? 8 : 11;
  for (let k = 0; k < barreaux; k++) {
    const x = -0.34 + (0.68 * k) / (barreaux - 1);
    pave(p, x - 0.012, x + 0.012, 0.54, 0.84, nez - 0.01, nez + 0.016, m.metal);
  }
  pave(p, -0.42, 0.42, 0.86, 0.88, nez - 0.03, nez + 0.02, m.metal);
  pave(p, -0.9, 0.9, 0.31, 0.42, nez - 0.02, nez + 0.07, m.metal);
  plaque(p, c, 0.46, nez + 0.012, 1);

  // --- L'arrière : la lunette de la porte arrière, le pare-chocs en métal, la plaque, l'échappement. ---
  const queue = coque.bout(-1, 1.1).z;
  pave(p, -0.46, 0.46, 0.98, 1.22, queue - 0.012, queue + 0.004, m.cadre);
  pave(p, -0.42, 0.42, 1.0, 1.2, queue - 0.018, queue - 0.008, m.vitre);
  const pied = coque.bout(-1, 0.5).z;
  pave(p, -0.7, 0.7, 0.33, 0.43, pied - 0.07, pied + 0.1, m.metal);
  plaque(p, c, 0.52, pied - 0.01, -1);
  echappement(p, 0.5, 0.34, pied + 0.2, 0.04, 0.22, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);

  // --- Les côtés : rétroviseurs sur pied à la portière, poignées (portière et porte coulissante). ---
  for (const s of [-1, 1]) {
    retroviseur(p, c, s, { pied: [0.79, 0.88, 0.98, 1.02, 1.2], centre: [0.95, 1.06, 1.2], rayons: [0.06, 0.08, 0.06] });
    poignee(p, c, s, 1.0, 0.92, 0.81, 0.16);
    poignee(p, c, s, 0.45, 0.86, 0.81, 0.16);
  }
}

function feuxI(c: Contexte): Feux {
  const coque = c.coque!;
  const jour: Fini = { couleur: srgb(0xfff8e6), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : deux gros phares ronds sur les ailes, et deux petits clignotants ambre ronds sous eux, au bout des ailes.
      for (const s of [-1, 1]) rond(null, f, PHARE.z, s * PHARE.x, PHARE.y, PHARE.r, c.palier === 1 ? 8 : 14, boitier, jour);
      for (const s of [-1, 1]) rond(null, f, 1.78, s * 0.72, 0.6, 0.035, 6, boitier, ambre);
      void coque;
    },
    stop(f) {
      // Des feux hauts et étroits aux deux coins arrière, et deux feux ronds au dos des ailes arrière.
      coque.ruban(f, -1, 0.7, 1.0, 0.62, 2, 0.004, boitier);
      coque.ruban(f, -1, 0.72, 0.98, 0.64, 2, 0.011, rouge);
      for (const s of [-1, 1]) rond(null, f, -1.75, s * 0.86, 0.66, 0.045, c.palier === 1 ? 6 : 10, boitier, rouge, -1);
    },
  };
}
