import type { ThemeTower } from "@cdj/tower-sim";
import type { DecorTheme } from "./decorLogique";
import type { DecorScene } from "./decorScene";

// Lot T9 — les décors se chargent À LA DEMANDE, un module par thème (le port compris) : le premier chargement n'en porte aucun, l'accueil non plus. Tant que le décor n'est pas là, le ciel et la mer du thème
// (la palette, un aplat) suffisent. Affichage seulement.
const MODULES: Record<ThemeTower, () => Promise<{ DECOR: DecorTheme }>> = {
  port: () => import("./decorPort"),
  chantier: () => import("./decorChantier"),
  canyon: () => import("./decorCanyon"),
  banquise: () => import("./decorBanquise"),
  jungle: () => import("./decorJungle"),
  nuit: () => import("./decorNuit"),
};

/**
 * Le décor d'un thème, prêt à poser dans la scène : le module du thème et celui qui l'assemble en Three.js, chargés la première fois. `yRef` : le bas de la vue au départ d'une partie (en paysage −2,75 m, en
 * portrait −7,2 m : `basDeVue(0, …)` de `scene.ts`) ; les bandes du ciel haut et le ciel semé en partent, pour que « 45 m » soit 45 m de tour dans les deux orientations.
 */
export async function chargerDecor(theme: ThemeTower, yRef: number): Promise<DecorScene> {
  const [{ DECOR }, { DecorScene: Decor }] = await Promise.all([MODULES[theme](), import("./decorScene")]);
  return new Decor(DECOR, theme, yRef);
}
