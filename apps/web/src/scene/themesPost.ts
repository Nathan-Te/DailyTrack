// Lot 47 — **l'étalonnage et le halo de chaque thème** (palier 3, ordinateur), les nombres que lit la chaîne de post-traitement (`post.ts`, `postJeu.ts`) ; et la
// lumière des reflets (`environnement`, lue par la vitrine). Une table à part, sans dépendance : le jeu la charge avec sa chaîne, sans la brume, les nuages ni les
// particules (`themes3.ts` les réunit pour la vitrine).
import type { PaletteName } from "@cdj/sim";
import type { Theme3 } from "./lumiere3";

/** Étalonnage, halo et reflets par thème (post-traitement et reflets) : le jeu lit l'étalonnage et le halo avec sa chaîne (lot 47). */
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
