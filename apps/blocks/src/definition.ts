import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, medailleDe, numeroBlocks, seuilsDe, themeDuJour, type Contenu } from "@cdj/blocks-sim";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { ecrireScore } from "./textes";

// La définition de « Blocks » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le corps du jeu (le tirage de la suite, les scénarios, la scène, les blocs communs) est à la demande**
// (`corps.ts`) : `contenuDuJour` le charge, l'accueil l'appelle dès son premier dessin ; `nouvellePartie` ne vient qu'après.
let corps: typeof import("./corps") | null = null;

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: 30,
  versions: { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION },
  actions: [
    { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
    { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
    { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
    { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
    { id: "poser", clavier: ["Space", "Enter"], manette: "b0" },
  ],
  themeDuJour,
  numero: numeroBlocks,
  async contenuDuJour(jour, base) {
    corps ??= await import("./corps");
    return corps.contenuDuJour(jour, base);
  },
  seuils: (c) => seuilsDe(c), // pas de médaille avant B3
  medaille: (score, s) => medailleDe(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieBlocks(c, hote, o),
  rediffusionDiamant: () => "", // le Diamant (bot) et le fantôme viennent aux lots B3 et B4
  formatScore: (score) => ecrireScore(score[0] ?? 0),
  scorePartage: (score) => ecrireScore(score[0] ?? 0),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
