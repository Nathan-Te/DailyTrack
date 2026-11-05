import type { ThemeBlocks } from "@cdj/blocks-sim";
import { DecorCanvas } from "./canvas";
import type { DecorTheme } from "./logique";

// Lot B5 — les décors se chargent À LA DEMANDE, un module par thème (le port compris) : le premier chargement n'en porte aucun, et le corps du jeu seulement le dessinateur ; seul le décor du thème du jour est lu.
// Tant qu'il n'est pas là, le ciel du thème (la palette, un aplat) suffit. Affichage seulement.
const MODULES: Record<ThemeBlocks, () => Promise<{ DECOR: DecorTheme }>> = {
  port: () => import("./decor-port"),
  chantier: () => import("./decor-chantier"),
  canyon: () => import("./decor-canyon"),
  banquise: () => import("./decor-banquise"),
  jungle: () => import("./decor-jungle"),
  nuit: () => import("./decor-nuit"),
};

/** Le décor d'un thème : le module du thème, chargé la première fois. */
export const chargerDecorTheme = async (theme: ThemeBlocks): Promise<DecorTheme> => (await MODULES[theme]()).DECOR;

let courant: DecorCanvas | null = null;
/** Le décor de la partie en cours (aucun tant qu'aucun n'est posé) : `corps.ts` le pose en chargeant le jour, avant que la scène se construise. */
export const decorCourant = (): DecorCanvas | null => courant;
export function poserDecor(d: DecorTheme | null): void {
  courant = d ? new DecorCanvas(d) : null;
}
