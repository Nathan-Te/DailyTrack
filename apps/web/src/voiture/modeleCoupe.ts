// Retouche 40b — proposition de voiture civile n° 2, le « coupé de série » : deux portes, plus bas et plus long que la compacte, plus sage que
// A — le capot long, un pavillon qui file vers une malle courte, un simple becquet en lèvre sur la malle. Ce qui le dit « de série » : des
// pare-chocs peints avec leur grille et leur entrée d'air sombres, les plaques avant et arrière, des rétroviseurs sur les portières, une poignée
// par côté, des passages de roue affleurants, pas d'aileron ni de diffuseur. La livrée de Track (bandes, numéro) comme les autres. Création
// originale : un type de voiture (le coupé de série), aucun modèle, aucune calandre, aucun phare d'une voiture réelle.
import { boite, cle, extruder, fondDePassage, levre, pave, pont, prismeZ, type Sec } from "./forme";
import type { Contexte, Feux, PlanVoiture } from "./modele";
import { srgb, type Fini, type Pieces } from "./pieces";

const ZR = -2.12;
const ZF = 2.2;

type P2 = [number, number];
const capot = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, ...pont(epaule, dessus) });
const habitacle = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, vitre: P2, toit: P2, dessus: number) => cle(z, { bas: b, seuil, flanc, epaule, vitre, toit, dessus } satisfies Sec);

const ROUES: [number, number][] = [
  [1, 1.3],
  [1, -1.3],
  [-1, 1.3],
  [-1, -1.3],
];

export const PLAN_COUPE: PlanVoiture = {
  id: "coupe",
  nom: "Civile 2 — Coupé de série",
  resume: "Une voiture de série : coupé deux portes, capot long, pavillon fuyant vers une malle courte, becquet en lèvre ; pare-chocs, plaques, rétroviseurs, poignées.",
  cles: [
    capot(ZR, 0.33, [0.8, 0.36], [0.89, 0.56], [0.85, 0.84], 0.86),
    capot(-1.95, 0.28, [0.86, 0.31], [0.94, 0.56], [0.91, 0.88], 0.91),
    capot(-1.4, 0.27, [0.87, 0.3], [0.95, 0.56], [0.92, 0.88], 0.93),
    // La lunette part du bout de la malle et file jusqu'au pavillon.
    habitacle(-1.1, 0.27, [0.87, 0.3], [0.95, 0.56], [0.92, 0.87], [0.85, 0.9], [0.62, 0.95], 0.96),
    habitacle(-0.5, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.86], [0.85, 0.89], [0.69, 1.22], 1.26),
    habitacle(0.15, 0.27, [0.87, 0.3], [0.95, 0.55], [0.92, 0.84], [0.85, 0.87], [0.69, 1.22], 1.26),
    habitacle(0.82, 0.27, [0.87, 0.3], [0.95, 0.54], [0.91, 0.79], [0.84, 0.81], [0.6, 0.84], 0.86),
    capot(1.3, 0.27, [0.87, 0.31], [0.95, 0.53], [0.9, 0.74], 0.78),
    capot(1.9, 0.28, [0.85, 0.32], [0.92, 0.49], [0.87, 0.66], 0.7),
    capot(ZF, 0.3, [0.74, 0.33], [0.8, 0.44], [0.74, 0.55], 0.57),
  ],
  bombe: { 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.06, 6: 0.14, 7: 0.03 },
  tronçons: { dessous: [0], bas: [1], vitre: [5], dessus: [7] },
  zones: { pareBrise: [0.15, 0.82], lunette: [-1.1, -0.5], vitres: [-1.0, 0.72] },
  cadre: {
    z: [ZR, ZF],
    demiLargeur: 1.05,
    hauteur: 1.5,
    bandes: [
      [1.0, 2.1],
      [-0.5, 0.15],
    ],
    largeurBande: 0.62,
    portiere: { z: -0.1, y: 0.64, h: 0.27 },
    arriere: { y: 0.7, h: 0.17 },
  },
  roue: { branches: 6, jante: 0.7 },
  pieces(p, c) {
    piecesCoupe(p, c);
  },
  feux: feuxCoupe,
  fantome: {
    profil: [0, 2, 3, 4, 5, 6, 8],
    pieces(p, f) {
      pave(p, -0.86, 0.86, 0.3, 0.5, ZR - 0.06, ZR + 0.2, f.sombre);
      pave(p, -0.8, 0.8, 0.86, 0.92, ZR + 0.02, ZR + 0.14, f.caisse);
    },
  },
};

function piecesCoupe(p: Pieces, c: Contexte) {
  const { m, arc } = c;
  // Passages de roue affleurants.
  for (const [s, z] of ROUES) {
    fondDePassage(p, s, 0.955, z, 0.38, 0.46, 0.27, arc + 2, m.noir);
    levre(p, s, 0.92, 0.975, z, 0.38, 0.45, 0.49, 0.14, Math.PI - 0.14, arc + 2, m.peinture, m.noir);
  }
  // Bas de caisse : un filet sombre.
  for (const s of [-1, 1]) pave(p, s > 0 ? 0.9 : -0.955, s > 0 ? 0.955 : -0.9, 0.25, 0.3, -0.82, 0.82, m.garniture);
  // Pare-chocs avant : volume peint, grille fine et basse entre les phares, grande entrée d'air, deux antibrouillards (feux), la plaque.
  boite(p, 0.27, 0.8, ZF - 0.2, ZF + 0.03, 0.48, 0.76, ZF - 0.24, ZF - 0.02, m.peinture);
  pave(p, -0.36, 0.36, 0.47, 0.52, ZF - 0.05, ZF + 0.005, m.noir);
  pave(p, -0.66, 0.66, 0.29, 0.37, ZF + 0.02, ZF + 0.04, m.noir);
  plaque(p, c, 0.4, ZF + 0.03, 1);
  // Malle : un becquet en lèvre sur son bord ; pare-chocs arrière peint, un insert sombre, la plaque, une sortie d'échappement double à gauche.
  extruder(
    p,
    [
      [ZR + 0.02, 0.86],
      [ZR + 0.2, 0.9],
      [ZR + 0.06, 0.925],
      [ZR - 0.02, 0.9],
    ],
    -0.8,
    0.8,
    m.peinture,
  );
  boite(p, 0.28, 0.86, ZR - 0.06, ZR + 0.2, 0.5, 0.84, ZR - 0.03, ZR + 0.2, m.peinture);
  pave(p, -0.72, 0.72, 0.27, 0.33, ZR - 0.07, ZR + 0.1, m.noir);
  plaque(p, c, 0.42, ZR - 0.06, -1);
  for (const dx of [0, 0.11]) prismeZ(p, ZR - 0.11, ZR + 0.08, 0.5 + dx, 0.3, 0.038, c.palier === 1 ? 6 : 10, m.metal, m.noir);
  // Rétroviseurs sur les portières, une poignée par côté (deux portes), une prise d'air discrète en bas des portières.
  for (const s of [-1, 1]) {
    const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
    boite(p, 0.9, 0.07, 0.54, 0.64, 1.0, 0.08, 0.52, 0.66, m.peinture, s * 0.94);
    pave(p, ...x(0.84, 0.9), 0.86, 0.92, 0.56, 0.64, m.garniture);
    pave(p, ...x(0.93, 0.975), 0.77, 0.8, -0.38, -0.2, m.garniture);
  }
}

/** Une plaque minéralogique (sans inscription) : un cadre sombre, un fond crème ; `sens` = +1 à l'avant, −1 à l'arrière. */
function plaque(p: Pieces, c: Contexte, y: number, z: number, sens: number) {
  const z0 = sens > 0 ? z : z - 0.015;
  pave(p, -0.26, 0.26, y - 0.065, y + 0.065, z0, z0 + 0.015, c.m.noir);
  pave(p, -0.24, 0.24, y - 0.05, y + 0.05, sens > 0 ? z0 + 0.012 : z0 - 0.004, sens > 0 ? z0 + 0.018 : z0 + 0.004, c.m.creme);
}

function feuxCoupe(c: Contexte): Feux {
  const blanc: Fini = { couleur: srgb(0xfff3d6) };
  const ambre: Fini = { couleur: srgb(0xf2a03a) };
  const recul: Fini = { couleur: srgb(0xe8e4dc) };
  const rouge: Fini = { couleur: srgb(0x7a1418), recto: true };
  return {
    phares(f) {
      // Signature : des phares fins étirés vers l'aile, deux points de jour à l'intérieur ; antibrouillards ronds dans le pare-chocs.
      for (const s of [-1, 1]) {
        const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
        pave(f, ...x(0.38, 0.7), 0.47, 0.525, ZF - 0.08, ZF + 0.012, blanc);
        pave(f, ...x(0.42, 0.5), 0.525, 0.54, ZF - 0.1, ZF - 0.0, blanc);
        pave(f, ...x(0.56, 0.64), 0.525, 0.54, ZF - 0.12, ZF - 0.02, blanc);
        pave(f, ...x(0.7, 0.78), 0.46, 0.51, ZF - 0.2, ZF - 0.04, ambre);
        prismeZ(f, ZF + 0.02, ZF + 0.045, s * 0.62, 0.33, 0.035, 8, blanc);
      }
      pave(f, -0.7, -0.6, 0.36, 0.4, ZR - 0.075, ZR - 0.055, recul);
    },
    stop(f) {
      // Deux feux en double trait, d'un coin vers le centre de la malle.
      for (const s of [-1, 1]) {
        const x = (a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);
        pave(f, ...x(0.42, 0.86), 0.74, 0.79, ZR - 0.035, ZR - 0.005, rouge);
        pave(f, ...x(0.5, 0.86), 0.66, 0.7, ZR - 0.035, ZR - 0.005, rouge);
        pave(f, ...x(0.86, 0.9), 0.66, 0.79, ZR + 0.0, ZR + 0.14, rouge);
      }
      void c;
    },
  };
}
