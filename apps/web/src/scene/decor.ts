// Lot 44 — **le décor du palier 1, chargé à la demande, thème par thème** : ce registre (dans le premier chargement, quelques lignes) sait où est le décor de
// chaque thème (`decor/<thème>.ts`, un morceau chacun, plus `decor/commun.ts` qu'ils partagent). La scène s'affiche d'abord sans lui (la piste, les rebords,
// les éléments de course : `composerP1.ts`) ; le jeu le demande dès que le thème est connu, et l'ajoute à la scène **hors course seulement** (accueil, pause,
// arrivée, podium du Salon : `main.ts`). Budget : ligne « décor 3D à la demande » (16 ko pour les huit thèmes, `docs/plateforme/budgets.md`).
import type { PaletteName } from "@cdj/sim";
import type { ModuleDecor } from "./types";

type Chargeur = () => Promise<{ DECOR: ModuleDecor }>;

/** Le morceau du décor de chaque palette (la palette « neon », sans thème, reprend la Nuit). */
export const DECORS: Record<PaletteName, Chargeur> = {
  stade: () => import("./decor/stade"),
  desert: () => import("./decor/rallye"),
  neige: () => import("./decor/banquise"),
  nuit: () => import("./decor/nuit"),
  neon: () => import("./decor/nuit"),
  campagne: () => import("./decor/campagne"),
  canyon: () => import("./decor/canyon"),
  alpin: () => import("./decor/col"),
  ville: () => import("./decor/ville"),
};

const promesses = new Map<PaletteName, Promise<ModuleDecor>>();
const prets = new Map<PaletteName, ModuleDecor>();

/** Charge le décor d'une palette (une fois ; une erreur de chargement permet de réessayer plus tard). */
export function chargerDecor(palette: PaletteName): Promise<ModuleDecor> {
  let p = promesses.get(palette);
  if (!p) {
    p = DECORS[palette]().then((m) => {
      prets.set(palette, m.DECOR);
      return m.DECOR;
    });
    p.catch(() => promesses.delete(palette));
    promesses.set(palette, p);
  }
  return p;
}

/** Le décor d'une palette s'il est déjà chargé (sinon `null` : la scène se construit sans lui). */
export const decorPret = (palette: PaletteName): ModuleDecor | null => prets.get(palette) ?? null;
