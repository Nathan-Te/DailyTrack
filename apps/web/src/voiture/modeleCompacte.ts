// Retouche 40b — proposition de voiture civile n° 1, la « compacte sportive » : une voiture de série, cinq portes, haute et ramassée, le capot
// court, le pavillon long jusqu'au hayon presque droit, un petit becquet de toit au-dessus de la lunette. Ce qui la dit « de série » d'un coup
// d'œil : des pare-chocs peints avec leur grille et leur entrée d'air sombres, les plaques avant et arrière, les rétroviseurs sur les portières,
// deux poignées par côté (cinq portes), des passages de roue affleurants, pas d'aileron. Elle garde la livrée de Track (bandes, numéro) comme
// les autres. Création originale : un type de voiture (la compacte sportive), aucun modèle, aucune calandre, aucun phare d'une voiture réelle.
import { boite, cle, extruder, fondDePassage, levre, pave, pont, prismeZ, type Sec } from "./forme";
import type { Contexte, Feux, PlanVoiture } from "./modele";
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

export const PLAN_COMPACTE: PlanVoiture = {
  id: "compacte",
  nom: "Civile 1 — Compacte sportive",
  resume: "Une voiture de série : cinq portes, haute et ramassée, hayon presque droit, petit becquet de toit ; pare-chocs, plaques, rétroviseurs, poignées.",
  cles: [
    // Le hayon : le bas presque droit (le numéro, la plaque), la lunette inclinée jusqu'au becquet.
    habitacle(ZR, 0.33, [0.8, 0.36], [0.88, 0.56], [0.85, 0.9], [0.8, 0.96], [0.66, 1.0], 1.02),
    habitacle(-1.72, 0.28, [0.86, 0.31], [0.94, 0.56], [0.91, 0.9], [0.84, 0.97], [0.7, 1.28], 1.32),
    habitacle(-1.3, 0.27, [0.87, 0.3], [0.95, 0.56], [0.92, 0.88], [0.85, 0.95], [0.72, 1.3], 1.34),
    habitacle(-0.4, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.87], [0.85, 0.93], [0.73, 1.31], 1.35),
    habitacle(0.3, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.86], [0.85, 0.91], [0.71, 1.3], 1.34),
    // Le pied du pare-brise, juste derrière l'œil de la vue capot (z 0,98).
    habitacle(0.9, 0.27, [0.87, 0.3], [0.95, 0.54], [0.91, 0.8], [0.84, 0.8], [0.62, 0.83], 0.85),
    capot(1.3, 0.27, [0.87, 0.31], [0.95, 0.53], [0.9, 0.73], 0.78),
    capot(1.8, 0.28, [0.84, 0.32], [0.92, 0.5], [0.87, 0.68], 0.73),
    capot(ZF, 0.3, [0.74, 0.33], [0.82, 0.46], [0.76, 0.58], 0.61),
  ],
  bombe: { 2: 0.05, 3: 0.07, 4: 0.1, 5: 0.05, 6: 0.12, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.3, 0.9], lunette: [ZR, -1.72], vitres: [-1.45, 0.8] },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [1.0, 2.0],
      [-1.6, 0.25],
    ],
    largeurBande: 0.6,
    portiere: { z: 0.3, y: 0.66, h: 0.26 },
    arriere: { y: 0.74, h: 0.18 },
  },
  roue: { branches: 5, jante: 0.66 },
  pieces(p, c) {
    piecesCompacte(p, c);
  },
  feux: feuxCompacte,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      // Le becquet de toit et le pare-chocs arrière : ce qui reste lisible de dos, à 50 m.
      pave(p, -0.66, 0.66, 1.27, 1.34, ZR + 0.12, ZR + 0.3, f.caisse);
      pave(p, -0.86, 0.86, 0.3, 0.5, ZR - 0.06, ZR + 0.2, f.sombre);
    },
  },
};

function piecesCompacte(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  // Passages de roue affleurants : le fond sombre et une lèvre peinte fine (une voiture de série ne déborde pas de ses ailes).
  for (const [s, z] of ROUES) {
    fondDePassage(p, s, 0.955, z, 0.38, 0.46, 0.27, arc + 2, m.noir);
    levre(p, s, 0.92, 0.975, z, 0.38, 0.45, 0.49, 0.14, Math.PI - 0.14, arc + 2, m.peinture, m.noir);
  }
  // Bas de caisse peint, souligné d'un filet sombre.
  for (const s of [-1, 1]) pave(p, s > 0 ? 0.9 : -0.955, s > 0 ? 0.955 : -0.9, 0.25, 0.3, -0.82, 0.82, m.garniture);
  // Pare-chocs avant : un volume peint, la grille sombre entre les phares, l'entrée d'air basse, la plaque.
  boite(p, 0.27, 0.8, ZF - 0.2, ZF + 0.03, 0.5, 0.77, ZF - 0.24, ZF - 0.01, m.peinture);
  pave(p, -0.42, 0.42, 0.5, 0.57, ZF - 0.04, ZF + 0.005, m.noir);
  pave(p, -0.6, 0.6, 0.29, 0.38, ZF + 0.02, ZF + 0.04, m.noir);
  plaque(p, c, 0.4, ZF + 0.03, 1);
  // Pare-chocs arrière : un volume peint, un insert sombre en bas, la plaque, deux sorties d'échappement discrètes.
  boite(p, 0.28, 0.86, ZR - 0.06, ZR + 0.2, 0.52, 0.84, ZR - 0.03, ZR + 0.2, m.peinture);
  pave(p, -0.7, 0.7, 0.27, 0.33, ZR - 0.07, ZR + 0.1, m.noir);
  plaque(p, c, 0.44, ZR - 0.06, -1);
  for (const s of [-1, 1]) prismeZ(p, ZR - 0.11, ZR + 0.08, s * 0.5, 0.3, 0.035, c.palier === 1 ? 6 : 10, m.metal, m.noir);
  // Becquet de toit au-dessus de la lunette (le seul appendice), et le troisième feu sous lui (feux).
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
  // Rétroviseurs sur les portières (coque peinte, pied sombre), deux poignées par côté (cinq portes).
  for (const s of [-1, 1]) {
    const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
    boite(p, 0.92, 0.07, 0.64, 0.74, 1.03, 0.08, 0.62, 0.76, m.peinture, s * 0.94);
    pave(p, ...x(0.84, 0.9), 0.88, 0.94, 0.66, 0.74, m.garniture);
    // Le montant central (cinq portes) : peint, sur la vitre latérale.
    boite(p, 0.9, 0.875, -0.36, -0.27, 1.3, 0.75, -0.36, -0.27, m.peinture);
    for (const z of [0.12, -0.72]) pave(p, ...x(0.93, 0.975), 0.79, 0.82, z - 0.08, z + 0.08, m.garniture);
  }
}

/** Une plaque minéralogique (sans inscription) : un cadre sombre, un fond crème ; `sens` = +1 à l'avant, −1 à l'arrière. */
function plaque(p: Pieces, c: Contexte, y: number, z: number, sens: number) {
  const z0 = sens > 0 ? z : z - 0.015;
  pave(p, -0.26, 0.26, y - 0.065, y + 0.065, z0, z0 + 0.015, c.m.noir);
  pave(p, -0.24, 0.24, y - 0.05, y + 0.05, sens > 0 ? z0 + 0.012 : z0 - 0.004, sens > 0 ? z0 + 0.018 : z0 + 0.004, c.m.creme);
}

function feuxCompacte(c: Contexte): Feux {
  const blanc: Fini = { couleur: srgb(0xfff3d6) };
  const ambre: Fini = { couleur: srgb(0xf2a03a) };
  const recul: Fini = { couleur: srgb(0xe8e4dc) };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  return {
    phares(f) {
      // Signature : un phare en trapèze au coin du capot, souligné d'un trait de jour qui remonte vers l'aile ; le clignotant au bout.
      for (const s of [-1, 1]) {
        const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
        pave(f, ...x(0.42, 0.7), 0.5, 0.58, ZF - 0.1, ZF + 0.012, blanc);
        pave(f, ...x(0.4, 0.72), 0.58, 0.6, ZF - 0.14, ZF - 0.01, blanc);
        pave(f, ...x(0.7, 0.76), 0.5, 0.58, ZF - 0.16, ZF - 0.02, ambre);
        // Feu de recul, dans le feu arrière gauche seulement (comme une voiture de série).
        if (s > 0) pave(f, 0.6, 0.72, 0.8, 0.85, ZR - 0.035, ZR - 0.005, recul);
      }
    },
    stop(f) {
      // Deux feux d'angle hauts qui tournent sur l'aile, et le troisième feu sous le becquet.
      for (const s of [-1, 1]) {
        const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
        pave(f, ...x(0.56, 0.86), 0.68, 0.8, ZR - 0.035, ZR - 0.005, rouge);
        pave(f, ...x(0.6, 0.86), 0.86, 0.9, ZR - 0.035, ZR - 0.005, rouge);
        pave(f, ...x(0.86, 0.9), 0.68, 0.84, ZR + 0.0, ZR + 0.18, rouge);
      }
      pave(f, -0.2, 0.2, 1.28, 1.3, ZR + 0.08, ZR + 0.11, rouge);
      void c;
    },
  };
}
