// Lot 38 — le mélange recommandé : les éléments de course de A (portique-cartouche, arrivée, plaques, panneaux larges, vibreurs en dents, lignes
// épaisses), les feux de départ et l'arche gonflable du point de contrôle de B, les rebords propres à chaque thème de B, un décor de B allégé, l'horizon
// du thème ; la lumière, l'occlusion et les matières de C s'y appliquent ensuite (`appliquerC`, voir `src/vitrine/variantes.ts`). Matériau
// « standard » : la lumière de C est continue (le « toon » de A s'y prête mal, voir le README du lot).
import type { PaletteName } from "@cdj/sim";
import { ambianceDOrigine, placesDeDecor } from "./composer";
import { DIRECTION_A, arrivee, panneau, portiqueDepart, routeA, rythme } from "./directionA";
import { RECETTES_B, REBORDS_B, atlasB, feuxDeDepart, porteB, routeB, tribuneB } from "./directionB";
import { repereBloc } from "./outils";
import type { StyleRoute } from "./route";
import { HORIZONS, type Direction } from "./types";

/**
 * La route du mélange : les rebords de B (le profil du thème : béton, pneus, bois, roche, glissière), peints des couleurs franches de A (palette de A),
 * les vibreurs, lignes et tirets de A. La Banquise garde le béton (une congère blanche sur un monde blanc ne se lit pas : la piste d'abord).
 */
export function routeM(nom: PaletteName): StyleRoute {
  const a = routeA(nom);
  const b = routeB(nom, nom === "neige" ? "beton" : REBORDS_B[nom]);
  return { ...a, rebord: b.rebord, bordureVide: b.bordureVide };
}

/**
 * La piste du mélange : ce qui doit être là au premier écran (route, rebords, éléments de course, ambiance). Sans décor : le décor de fond
 * arrive ensuite (`DECOR_M`, chargé à la demande pendant l'accueil ; voir le document de direction, « stratégie de chargement »).
 */
export const PISTE_M: Direction = /* @__PURE__ */ (() => ({
  ...DIRECTION_A,
  id: "M",
  nom: "Mélange recommandé",
  materiau: "standard",
  ambiance: (nom, pal, look) => {
    const amb = ambianceDOrigine(pal, look);
    return { ...amb, silhouettes: { ...amb.silhouettes, forme: HORIZONS[nom] } };
  },
  route: routeM,
  portiqueDepart(c, x, b, q) {
    portiqueDepart(c, x, b, q);
    feuxDeDepart(c, repereBloc(b, q), 8.6, -0.75);
  },
  arrivee,
  porte: porteB,
  plaque: DIRECTION_A.plaque,
  turbo: DIRECTION_A.turbo,
  coupure: DIRECTION_A.coupure,
  panneau,
  rythme,
  decor() {
    // Rien au premier écran : voir DECOR_M.
  },
}))();

/** Le décor du mélange (à la demande) : le décor de B allégé, la tribune du départ, les sponsors de l'atlas. */
export const DECOR_M: Pick<Direction, "decor" | "atlas"> = {
  atlas: atlasB,
  decor(c, x, rnd) {
    // Le décor de B, allégé : la tribune du départ, une place sur deux près de la piste, une par cellule plus loin. La Ville garde sa densité :
    // les immeubles serrés sont son identité.
    tribuneB(c, x, x.track.blocks[0]!, rnd);
    const recette = RECETTES_B[x.palette];
    const proche = x.palette === "ville" ? 0.85 : 0.5;
    for (const p of placesDeDecor(x.track, rnd, (anneau) => (anneau === 1 ? (rnd() < proche ? 1 : 0) : 1))) recette(c, x, p, rnd);
  },
};

/** Le mélange complet (la vitrine le montre tel qu'il serait une fois le décor arrivé). */
export const DIRECTION_M: Direction = /* @__PURE__ */ (() => ({ ...PISTE_M, ...DECOR_M }))();
