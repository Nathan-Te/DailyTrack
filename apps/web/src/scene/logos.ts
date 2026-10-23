// Les sponsors fictifs du ruban des écrans à diodes (palier 3, `vie.ts`), par thème : les noms de l'atlas de la direction B du lot 38, gardés quand la
// direction est partie (lot 44). Logos inventés : aucune marque réelle. Les affiches du jeu sont dans `sponsors.ts`.
import type { PaletteName } from "@cdj/sim";

export const LOGOS = ["dujour", "volta", "mistral", "pneusroc", "gazole", "eclair", "boulon", "cafe", "chrono", "distance2", "distance1", "col", "glacier", "taxi", "motel", "rodeo"] as const;
export type Logo = (typeof LOGOS)[number];

/** Les sponsors d'un thème : ceux qui défilent sur ses écrans. */
export const SPONSORS: Record<PaletteName, Logo[]> = {
  stade: ["dujour", "volta", "mistral", "pneusroc", "eclair", "boulon"],
  desert: ["pneusroc", "gazole", "rodeo", "volta", "dujour"],
  neige: ["glacier", "mistral", "dujour", "volta"],
  nuit: ["volta", "motel", "eclair", "dujour"],
  campagne: ["cafe", "gazole", "dujour", "boulon"],
  canyon: ["rodeo", "gazole", "pneusroc", "dujour"],
  alpin: ["col", "glacier", "mistral", "dujour"],
  ville: ["taxi", "cafe", "eclair", "dujour", "boulon"],
  neon: ["motel", "volta", "eclair"],
};
