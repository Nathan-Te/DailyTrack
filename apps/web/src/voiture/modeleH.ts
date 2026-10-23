// Lot 42 — modèle H, la **monoplace carénée** (Sailfish) : un fuseau étroit au nez pointu, des pontons entre les roues, un poste de pilotage ouvert
// (le casque du pilote, un petit saute-vent), une grande dérive dorsale qui monte jusqu'à l'aileron arrière (la « voile » qui lui donne son nom),
// des roues **à demi apparentes** sous des ailes-carénages fixées au fuseau par des bras, un aileron avant bas. Le type : la monoplace de course
// carénée d'autrefois. Création originale : aucun modèle d'une voiture réelle (standard.md du lot 40c).
// Les roues restent aux points de contact de la simulation (rien ne change : même boîte, mêmes roues) ; le fuseau se resserre entre elles.
import { boite, cle, extruder, pave, type Sec } from "./forme";
import { ailettes, cote, retroviseur } from "./details";
import { carenage, rond, tubes } from "./atelier";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement, ellipsoide } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.04;
const ZF = 2.32;
/** Le poste de pilotage ouvert : de l'appuie-tête au saute-vent. */
const ZP: [number, number] = [-0.3, 0.36];

type P2 = [number, number];
/** Une section du fuseau : le flanc (ou le ponton), son dessus, le bord du poste, le dessus (`dessus` bas : le poste ouvert). */
const sec = (z: number, b: number, seuil: P2, flanc: P2, ponton: P2, bord: P2, haut: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule: ponton, vitre: bord, toit: haut, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_H: PlanVoiture = {
  id: "H",
  nom: "H — Monoplace carénée",
  resume: "Un fuseau au nez pointu, des pontons, le poste ouvert et le casque, une grande dérive dorsale, les roues à demi apparentes sous des ailes-carénages.",
  cles: [
    sec(ZR, 0.24, [0.3, 0.26], [0.36, 0.36], [0.36, 0.5], [0.3, 0.56], [0.18, 0.6], 0.61),
    sec(-1.6, 0.2, [0.4, 0.22], [0.46, 0.36], [0.46, 0.54], [0.4, 0.62], [0.26, 0.68], 0.69),
    // Le fuseau étroit entre les roues arrière, puis les pontons et le poste.
    sec(-1.0, 0.18, [0.46, 0.2], [0.52, 0.36], [0.52, 0.56], [0.44, 0.64], [0.3, 0.72], 0.74),
    sec(ZP[0] - 0.24, 0.17, [0.86, 0.19], [0.92, 0.34], [0.88, 0.5], [0.56, 0.56], [0.34, 0.8], 0.86),
    sec(ZP[0], 0.17, [0.86, 0.19], [0.92, 0.34], [0.88, 0.5], [0.56, 0.58], [0.38, 0.8], 0.48),
    sec(ZP[1], 0.17, [0.86, 0.19], [0.92, 0.34], [0.88, 0.5], [0.56, 0.58], [0.38, 0.78], 0.48),
    sec(ZP[1] + 0.2, 0.17, [0.86, 0.19], [0.92, 0.34], [0.88, 0.5], [0.56, 0.56], [0.36, 0.74], 0.77),
    // Le nez qui se resserre entre les roues avant, jusqu'à sa pointe.
    sec(1.0, 0.18, [0.44, 0.2], [0.5, 0.35], [0.5, 0.54], [0.42, 0.6], [0.28, 0.66], 0.67),
    sec(1.75, 0.19, [0.34, 0.21], [0.4, 0.32], [0.4, 0.46], [0.34, 0.52], [0.2, 0.56], 0.57),
    sec(ZF, 0.21, [0.18, 0.23], [0.24, 0.29], [0.24, 0.35], [0.19, 0.39], [0.1, 0.41], 0.415),
  ],
  bombe: { 2: 0.05, 3: 0.08, 4: 0.1, 5: 0.05, 6: 0.1, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [ZR - 1, ZR - 0.95], lunette: [ZR - 0.9, ZR - 0.85], vitres: [ZR - 0.8, ZR - 0.75] },
  tole: { rayons: [0, 0.04, 0.03, 0.1, 0.04, 0, 0, 0, 0.03, 0.06, 0], boutArriere: 0.22, boutAvant: 0.3 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.04,
    hauteur: 1.5,
    // Les bandes : sur le nez, puis sur le capot moteur jusqu'à la poupe.
    bandes: [
      [ZP[1] + 0.1, 2.45],
      [-2.2, ZP[0] - 0.1],
    ],
    largeurBande: 0.34,
    portiere: { z: 0.04, y: 0.36, h: 0.2 },
    arriere: { y: 0.44, h: 0.12 },
    flancs: { z: [-0.5, 0.5], y: [0.22, 0.48] },
    toit: 0.7,
    filet: 0.42,
    joints: {
      // Les trappes des pontons, le capot moteur, le nez amovible.
      flanc: [
        [0.55, 0.2, 0.52, 0.5],
        [-0.52, 0.2, -0.54, 0.5],
      ],
      dessus: [
        [0.3, 1.5, 0, 1.5],
        [0.36, -0.62, 0.28, -1.75],
        [0.28, -1.75, 0, -1.75],
      ],
    },
  },
  roue: { branches: 4, jante: 0.72, dessin: "lames" },
  pieces(p, c) {
    piecesH(p, c);
  },
  feux: feuxH,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // La dérive, l'aileron et les ailes des roues : la monoplace à 50 m.
      pave(p, -0.02, 0.02, 0.7, 1.12, -1.9, -0.6, f.caisse);
      pave(p, -0.86, 0.86, 1.06, 1.12, ZR - 0.06, ZR + 0.34, f.caisse);
      for (const [s, z] of ROUES) pave(p, ...cote(s, 0.68, 1.02), 0.8, 0.84, z - 0.4, z + 0.4, f.caisse);
    },
  },
};

function piecesH(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  const n = c.palier === 1 ? 3 : 6;
  // Les ailes-carénages au-dessus de chaque roue (la roue se voit dessous et de côté), sur un bras sombre fixé au fuseau ; les bras de suspension.
  for (const [s, z] of ROUES) {
    carenage(p, s, 0.68, 1.02, z, 0.38, 0.43, 0.455, 0.1 * Math.PI, 0.9 * Math.PI, arc, m.peinture, m.plastique);
    pave(p, ...cote(s, 0.42, 0.67), 0.62, 0.66, z - 0.06, z + 0.06, m.cadre);
    tubes(p, [[s * 0.44, 0.24, z - 0.18], [s * 0.7, 0.3, z], [s * 0.44, 0.24, z + 0.18]], 0.018, n, m.cadre);
    if (c.palier > 1) tubes(p, [[s * 0.44, 0.5, z - 0.14], [s * 0.7, 0.48, z], [s * 0.44, 0.5, z + 0.14]], 0.018, n, m.cadre);
  }
  // Le fond plat (une lame sombre sous les pontons).
  pave(p, -0.9, 0.9, 0.12, 0.17, -0.58, 0.58, m.plastique);

  // --- Le poste ouvert : le fond, le casque du pilote (crème, visière sombre), le saute-vent, les rétroviseurs sur les pontons. ---
  pave(p, -0.36, 0.36, 0.46, 0.5, ZP[0] + 0.02, ZP[1] - 0.02, m.garniture);
  pave(p, -0.36, 0.36, 0.48, 0.8, ZP[0] + 0.01, ZP[0] + 0.02, m.garniture);
  ellipsoide(p, [0, 0.86, -0.12], [0.13, 0.14, 0.15], c.palier === 1 ? 7 : 14, c.palier === 1 ? 4 : 8, m.creme);
  pave(p, -0.1, 0.1, 0.84, 0.9, 0.0, 0.035, m.noir);
  boite(p, 0.78, 0.34, ZP[1] - 0.06, ZP[1] - 0.02, 0.92, 0.26, ZP[1] - 0.14, ZP[1] - 0.1, m.vitre);
  for (const s of [-1, 1]) retroviseur(p, c, s, { pied: [0.5, 0.56, 0.56, 0.64, 0.42], centre: [0.6, 0.66, 0.42], rayons: [0.05, 0.04, 0.07] });

  // --- La grande dérive dorsale (la voile), de l'appuie-tête à l'aileron, et l'aileron arrière sur elle. ---
  extruder(
    p,
    [
      [ZP[0] - 0.24, 0.86],
      [ZR + 0.2, 1.12],
      [ZR + 0.02, 1.12],
      [ZR + 0.1, 0.6],
      [-1.2, 0.72],
    ],
    -0.022,
    0.022,
    m.peinture,
  );
  extruder(
    p,
    [
      [ZR - 0.06, 1.06],
      [ZR + 0.32, 1.1],
      [ZR + 0.38, 1.125],
      [ZR + 0.04, 1.135],
      [ZR - 0.08, 1.1],
    ],
    -0.86,
    0.86,
    m.cadre,
  );
  extruder(p, [[ZR + 0.34, 1.115], [ZR + 0.39, 1.122], [ZR + 0.38, 1.136], [ZR + 0.31, 1.13]], -0.865, 0.865, m.creme);
  for (const s of [-1, 1]) pave(p, s * 0.87 - 0.02, s * 0.87 + 0.02, 0.92, 1.2, ZR - 0.12, ZR + 0.42, m.peinture);

  // --- L'aileron avant, bas, d'une roue à l'autre, sous le nez ; ses dérives. ---
  const nez = coque.bout(1, 0.3).z;
  extruder(
    p,
    [
      [1.86, 0.15],
      [nez - 0.02, 0.14],
      [nez - 0.06, 0.18],
      [1.9, 0.21],
    ],
    -0.98,
    0.98,
    m.cadre,
  );
  for (const s of [-1, 1]) pave(p, s * 0.98 - 0.02, s * 0.98 + 0.02, 0.11, 0.25, 1.84, nez - 0.04, m.peinture);
  ailettes(p, c, -0.16, 0.16, 0.24, 0.33, nez, 2);

  // --- La poupe : deux échappements sous l'aileron. ---
  const queue = coque.bout(-1, 0.4).z;
  for (const s of [-1, 1]) echappement(p, s * 0.16, 0.36, queue + 0.06, 0.045, 0.14, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  // Les deux petits phares ronds du nez (boîtiers).
  for (const s of [-1, 1]) rond(p, null, 1.9, s * 0.33, 0.42, 0.05, c.palier === 1 ? 6 : 12, m.noir, null);
}

function feuxH(c: Contexte): Feux {
  const coque = c.coque!;
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  return {
    phares(f) {
      // Signature : deux petits phares ronds sur les flancs du nez, et un trait de jour sous la pointe.
      for (const s of [-1, 1]) rond(null, f, 1.9, s * 0.33, 0.42, 0.05, c.palier === 1 ? 6 : 12, jour, jour);
      coque.ruban(f, 1, 0.28, 0.3, 0.0, 2, 0.01, jour);
    },
    stop(f) {
      // Le feu de pluie au milieu de la poupe (une barre verticale) et un feu rouge au dos de chaque dérive de l'aileron.
      const queue = coque.bout(-1, 0.45).z;
      pave(f, -0.05, 0.05, 0.4, 0.58, queue - 0.02, queue - 0.004, rouge);
      for (const s of [-1, 1]) pave(f, s * 0.87 - 0.026, s * 0.87 + 0.026, 0.95, 1.04, ZR - 0.135, ZR - 0.118, rouge);
    },
  };
}
