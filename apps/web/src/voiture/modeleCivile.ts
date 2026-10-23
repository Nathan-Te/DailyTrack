// Retouche 40b — la voiture civile, la voiture par défaut (choisie par Nathan dans la vitrine le 23/10/2026) : une compacte sportive de série, cinq portes, haute et ramassée, le capot
// court, le pavillon long jusqu'au hayon presque droit, un petit becquet de toit au-dessus de la lunette. Création originale : un type de voiture (la compacte sportive),
// aucun modèle, aucune calandre, aucun phare d'une voiture réelle.
// Lot 40c — **la Sparrow au cran de qualité** (le standard : docs/lots/lot-40c-voitures-qualite/standard.md) : une caisse tôle (coins arrondis, ceinture et bord de capot
// vifs, bouts de plan arrondi, encadrements de vitres), des joints de portes, de capot et de hayon dessinés dans le nuanceur, la doublure des passages de roue,
// des phares et des feux construits (boîtier, glace, signature) qui épousent les coins, une calandre à ailettes, des échappements creux, des rétroviseurs
// attachés par leur pied à la portière, des poignées, des plaques vierges. Les motifs et le numéro sont dans le nuanceur (aucune texture).
import { boite, cle, extruder, levre, pave, pont, type Sec } from "./forme";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { echappement, ellipsoide } from "./surfaces";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -1.95;
const ZF = 2.08;

type P2 = [number, number];
/** Une section de capot ou de bas de hayon. */
const capot = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, ...pont(epaule, dessus) });
/** Une section d'habitacle (pied de vitre, bord du toit, dessus). */
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_CIVILE: PlanVoiture = {
  id: "civile",
  nom: "Civile — Compacte sportive",
  resume: "Une voiture de série : cinq portes, haute et ramassée, hayon presque droit, petit becquet de toit ; caisse en tôle lissée, joints de portes, phares et feux construits, jantes claires.",
  cles: [
    // Le hayon : le bas presque droit (le numéro, la plaque), la lunette inclinée jusqu'au becquet.
    habitacle(ZR, 0.33, [0.8, 0.36], [0.88, 0.56], [0.85, 0.9], [0.8, 0.96], [0.66, 1.0], 1.02),
    habitacle(-1.72, 0.28, [0.86, 0.31], [0.94, 0.56], [0.91, 0.9], [0.84, 0.97], [0.7, 1.28], 1.32),
    habitacle(-1.3, 0.27, [0.87, 0.3], [0.95, 0.56], [0.92, 0.88], [0.85, 0.95], [0.72, 1.3], 1.34),
    habitacle(-0.4, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.87], [0.85, 0.93], [0.73, 1.31], 1.35),
    habitacle(0.3, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.86], [0.85, 0.91], [0.71, 1.3], 1.34),
    // Le pied du pare-brise, juste derrière l'œil de la vue capot (z 0,98).
    habitacle(0.9, 0.27, [0.87, 0.3], [0.95, 0.54], [0.91, 0.8], [0.84, 0.79], [0.62, 0.81], 0.83),
    capot(1.3, 0.27, [0.87, 0.31], [0.95, 0.53], [0.9, 0.72], 0.765),
    capot(1.8, 0.28, [0.84, 0.32], [0.92, 0.5], [0.87, 0.68], 0.73),
    capot(ZF, 0.3, [0.74, 0.33], [0.82, 0.46], [0.76, 0.58], 0.61),
  ],
  bombe: { 2: 0.05, 3: 0.07, 4: 0.1, 5: 0.05, 6: 0.12, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.3, 0.9], lunette: [ZR, -1.72], vitres: [-1.45, 0.8] },
  tole: { boutArriere: 0.34, boutAvant: 0.4 },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    // La double bande : le capot (jusqu'au museau), puis le toit et le hayon (au-delà de l'arrière : elle descend sur le hayon).
    bandes: [
      [0.95, 2.2],
      [-2.1, 0.3],
    ],
    largeurBande: 0.6,
    portiere: { z: 0.34, y: 0.66, h: 0.26 },
    arriere: { y: 0.74, h: 0.17 },
    flancs: { z: [-0.82, -0.04], y: [0.42, 0.78] },
    toit: 0.985,
    filet: 0.55,
    joints: {
      // Les portières : le bord avant, le montant central, le bord arrière ; la trappe du réservoir.
      flanc: [
        [0.76, 0.31, 0.72, 0.93],
        [-0.2, 0.3, -0.2, 0.93],
        [-0.9, 0.3, -0.92, 0.93],
        [-1.12, 0.62, -0.96, 0.62],
        [-0.96, 0.62, -0.96, 0.78],
        [-0.96, 0.78, -1.12, 0.78],
        [-1.12, 0.78, -1.12, 0.62],
      ],
      // Le capot : ses deux bords, son bord d'attaque et le pied du pare-brise.
      dessus: [
        [0.8, 0.95, 0.77, 1.98],
        [0.77, 1.98, 0, 1.99],
        [0.8, 0.95, 0, 0.95],
        [0.62, -1.74, 0, -1.74],
      ],
      // Le hayon : son joint bas (au-dessus du pare-chocs) et ses deux bords.
      arriere: [
        [0, 0.55, 0.82, 0.55],
        [0.82, 0.55, 0.84, 0.97],
      ],
    },
    arches: [
      [1.3, 0.38, 0.47],
      [-1.3, 0.38, 0.47],
    ],
    interieur: [0.25, -0.72, 1.03],
  },
  roue: { branches: 6, jante: 0.66, dessin: "larges" },
  pieces(p, c) {
    piecesCivile(p, c);
  },
  feux: feuxCivile,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Le becquet de toit et le pare-chocs arrière : ce qui reste lisible de dos, à 50 m.
      pave(p, -0.66, 0.66, 1.27, 1.34, ZR + 0.12, ZR + 0.3, f.caisse);
      pave(p, -0.86, 0.86, 0.3, 0.5, ZR - 0.06, ZR + 0.2, f.sombre);
    },
  },
};

function piecesCivile(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  const coque = c.coque!;
  // Les passages de roue : une lèvre peinte (un arc épais, sa face intérieure en plastique) ; la doublure est dessinée dans le nuanceur de la livrée.
  for (const [s, z] of ROUES) if (z < 0) levre(p, s, 0.915, 0.985, z, 0.38, 0.47, 0.515, 0.12, Math.PI - 0.12, arc + 3, m.peinture, m.plastique, 0.9);
  // Les bas de caisse : une jupe en plastique gris sous la ceinture, un filet net au-dessus.
  for (const s of [-1, 1]) {
    pave(p, s > 0 ? 0.9 : -0.955, s > 0 ? 0.955 : -0.9, 0.245, 0.31, -0.84, 0.84, m.plastique);
    pave(p, s > 0 ? 0.93 : -0.96, s > 0 ? 0.96 : -0.93, 0.31, 0.325, -0.84, 0.84, m.cadre);
  }

  // --- L'avant : calandre à ailettes entre les phares, grande entrée d'air basse à grille, antibrouillards, lame, plaque. ---
  const nez = coque.bout(1, 0.5).z;
  pave(p, -0.36, 0.36, 0.46, 0.57, nez - 0.03, nez + 0.006, m.cadre);
  for (const y of [0.485, 0.515, 0.545]) pave(p, -0.34, 0.34, y, y + 0.012, nez - 0.01, nez + 0.014, m.grille);
  pave(p, -0.56, 0.56, 0.3, 0.41, nez - 0.03, nez + 0.008, m.cadre);
  for (let k = -5; k <= 5; k++) pave(p, k * 0.1 - 0.008, k * 0.1 + 0.008, 0.31, 0.4, nez - 0.01, nez + 0.016, m.grille);
  pave(p, -0.6, 0.6, 0.27, 0.3, nez - 0.2, nez + 0.012, m.plastique);
  plaque(p, c, 0.365, nez + 0.016, 1);

  // --- L'arrière : le bouclier, l'insert sombre, deux échappements creux, la plaque. ---
  const queue = coque.bout(-1, 0.5).z;
  pave(p, -0.64, 0.64, 0.275, 0.36, queue - 0.01, queue + 0.12, m.plastique);
  for (const s of [-1, 1]) echappement(p, s * 0.46, 0.31, queue + 0.04, 0.036, 0.1, c.palier === 1 ? 7 : 12, m.metal, m.noir, -1);
  plaque(p, c, 0.45, queue - 0.01, -1);

  // --- Le becquet de toit au-dessus de la lunette (le seul appendice), ses jambes ; le troisième feu sous lui (feux). ---
  extruder(
    p,
    [
      [ZR + 0.1, 1.3],
      [ZR + 0.42, 1.325],
      [ZR + 0.4, 1.355],
      [ZR + 0.08, 1.33],
    ],
    -0.68,
    0.68,
    m.peinture,
    m.garniture,
  );
  for (const s of [-1, 1]) pave(p, s * 0.5 - 0.02, s * 0.5 + 0.02, 1.25, 1.31, ZR + 0.14, ZR + 0.2, m.cadre);

  // --- Les côtés : rétroviseurs sur leur pied, montant central noir, poignées. ---
  for (const s of [-1, 1]) {
    const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
    // Le rétroviseur : un pied triangulaire fixé sur la portière au coin de la vitre, la coque ovale (peinte), la glace sombre côté conducteur.
    pave(p, ...x(0.855, 0.935), 0.9, 0.94, 0.68, 0.76, m.cadre);
    ellipsoide(p, [s * 0.975, 0.985, 0.7], [0.062, 0.056, 0.098], c.palier === 1 ? 8 : 14, c.palier === 1 ? 5 : 8, m.peinture);
    pave(p, ...x(0.93, 1.015), 0.955, 1.01, 0.597, 0.601, m.noir);
    // Le montant central : noir, brillant (encadrement de vitre).
    boite(p, 0.9, 0.878, -0.25, -0.15, 1.3, 0.752, -0.25, -0.15, m.cadre);
    // Les poignées : une par portière, avec leur fond sombre.
    for (const z of [-0.1, -0.78]) {
      pave(p, ...x(0.925, 0.972), 0.79, 0.835, z - 0.1, z + 0.1, m.cadre);
      pave(p, ...x(0.93, 0.985), 0.8, 0.825, z - 0.08, z + 0.08, m.peinture);
    }
  }
}

/** Une plaque minéralogique (sans inscription) : un cadre sombre, un fond crème ; `sens` = +1 à l'avant, −1 à l'arrière. */
function plaque(p: Pieces, c: Contexte, y: number, z: number, sens: number) {
  const z0 = sens > 0 ? z : z - 0.015;
  pave(p, -0.26, 0.26, y - 0.065, y + 0.065, z0, z0 + 0.015, c.m.noir);
  pave(p, -0.24, 0.24, y - 0.05, y + 0.05, sens > 0 ? z0 + 0.012 : z0 - 0.004, sens > 0 ? z0 + 0.018 : z0 + 0.004, c.m.creme);
}

function feuxCivile(c: Contexte): Feux {
  const coque = c.coque!;
  const verre: Fini = { couleur: srgb(0x8a97a5), recto: true };
  const jour: Fini = { couleur: srgb(0xffffff), recto: true };
  const ambre: Fini = { couleur: srgb(0xf2a03a), recto: true };
  const recul: Fini = { couleur: srgb(0xe8e4dc), recto: true };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  const boitier: Fini = { couleur: srgb(0x15161a), recto: true };
  return {
    phares(f) {
      // Signature : un phare en amande dont le trait de jour remonte vers l'aile, le clignotant ambre au coin (la glace, le boîtier sombre, le trait).
      coque.ruban(f, 1, 0.445, 0.575, 0.3, 3, 0.004, boitier);
      coque.ruban(f, 1, 0.46, 0.55, 0.34, 2, 0.008, verre, 0.74);
      coque.ruban(f, 1, 0.5, 0.516, 0.34, 3, 0.012, jour);
      coque.ruban(f, 1, 0.46, 0.5, 0.6, 3, 0.011, ambre);
      // Feu de recul, dans le feu arrière gauche seulement (comme une voiture de série).
      coque.ruban(f, -1, 0.62, 0.655, 0.46, 0, 0.01, recul, 0.7);
    },
    stop(f) {
      // Trois barres horizontales qui tournent sur l'aile, dans un boîtier sombre, et le troisième feu sous le becquet.
      coque.ruban(f, -1, 0.64, 0.9, 0.3, 3, 0.004, boitier);
      for (const [a, b] of [
        [0.82, 0.87],
        [0.75, 0.8],
        [0.68, 0.73],
      ] as const)
        coque.ruban(f, -1, a, b, 0.4, 3, 0.011, rouge);
      pave(f, -0.2, 0.2, 1.28, 1.3, ZR + 0.08, ZR + 0.11, rouge);
      void c;
    },
  };
}
