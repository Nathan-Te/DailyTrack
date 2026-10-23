// Retouche 38b, lot 46 — **le palier 3 de chaque thème, tout compris** (la vitrine : `composerPalier.ts`, `post.ts`) : la brume et les nuages (`CIEL_3`,
// lumiere3.ts), les particules (`PARTICULES_3`, vie.ts), et ici l'étalonnage, le halo et la lumière des reflets. Le jeu ne charge pas ce module : ses pas
// « ciel » et « vie » lisent leurs tables chacun de son côté (un morceau à la demande chacun, sans morceau partagé).
import type { PaletteName } from "@cdj/sim";
import { CIEL_3, type Theme3 } from "./lumiere3";
import { PARTICULES_3 } from "./vie";

/** Étalonnage, halo et reflets par thème (post-traitement et palier 2 de la vitrine) : le jeu ne les charge pas encore (lot 47). */
export const POST_3: Record<PaletteName, Omit<Theme3, "brume" | "nuages" | "particules">> = {
  stade: {
    etalonnage: { contraste: 1.08, saturation: 1.12, ombres: [-0.01, 0, 0.02], lumieres: [0.015, 0.01, 0] },
    halo: { force: 0.14, seuil: 2.4, rayon: 0.4 },
    environnement: 0.55,
  },
  desert: {
    etalonnage: { contraste: 1.06, saturation: 1.05, ombres: [0.015, 0, -0.02], lumieres: [0.03, 0.015, -0.01] },
    halo: { force: 0.12, seuil: 2.4, rayon: 0.4 },
    environnement: 0.5,
  },
  neige: {
    etalonnage: { contraste: 1.04, saturation: 0.95, ombres: [-0.015, 0, 0.025], lumieres: [0, 0.005, 0.015] },
    halo: { force: 0.1, seuil: 2.8, rayon: 0.4 },
    environnement: 0.6,
  },
  nuit: {
    etalonnage: { contraste: 1.1, saturation: 1.1, ombres: [-0.01, 0, 0.03], lumieres: [0.03, 0.015, -0.01] },
    halo: { force: 0.55, seuil: 0.95, rayon: 0.55 },
    environnement: 0.3,
  },
  campagne: {
    etalonnage: { contraste: 1.05, saturation: 1.08, ombres: [0.01, -0.005, 0.015], lumieres: [0.035, 0.02, -0.015] },
    halo: { force: 0.14, seuil: 2.2, rayon: 0.45 },
    environnement: 0.5,
  },
  canyon: {
    etalonnage: { contraste: 1.08, saturation: 1.06, ombres: [0.01, -0.01, 0.03], lumieres: [0.04, 0.015, -0.02] },
    halo: { force: 0.14, seuil: 2.2, rayon: 0.45 },
    environnement: 0.5,
  },
  alpin: {
    etalonnage: { contraste: 1.07, saturation: 1.1, ombres: [-0.015, 0, 0.03], lumieres: [0.01, 0.01, 0] },
    halo: { force: 0.12, seuil: 2.6, rayon: 0.4 },
    environnement: 0.6,
  },
  ville: {
    etalonnage: { contraste: 1.06, saturation: 0.94, ombres: [-0.01, 0.005, 0.02], lumieres: [0.015, 0.01, -0.005] },
    halo: { force: 0.16, seuil: 2.0, rayon: 0.45 },
    environnement: 0.5,
  },
  neon: {
    etalonnage: { contraste: 1.1, saturation: 1.15, ombres: [0.01, -0.01, 0.03], lumieres: [0.02, 0, 0.02] },
    halo: { force: 0.65, seuil: 0.9, rayon: 0.6 },
    environnement: 0.3,
  },
};

export const THEMES_3: Record<PaletteName, Theme3> = Object.fromEntries((Object.keys(CIEL_3) as PaletteName[]).map((k) => [k, { ...CIEL_3[k], particules: PARTICULES_3[k], ...POST_3[k] }])) as Record<PaletteName, Theme3>;
