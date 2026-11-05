import { RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroRush, themeDuJour, type Contenu } from "@cdj/rush-sim";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { ACTIONS_RUSH } from "./actions";
import { lireEssai } from "./essai";

// La définition de « Rush » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le corps du jeu (Three.js, la scène, les sons, les commandes) est à la demande** (`corps.ts`) :
// `contenuDuJour` le charge, l'accueil l'appelle dès son premier dessin ; `nouvellePartie` ne vient qu'après.
let corps: typeof import("./corps") | null = null;

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION },
  actions: ACTIONS_RUSH,
  themeDuJour,
  numero: numeroRush,
  async contenuDuJour(jour, base) {
    corps ??= await import("./corps");
    return corps.contenuDuJour(jour, base);
  },
  seuils: (c) => corps!.seuilsDeRush(c), // le Diamant provisoire : la partie du pilote
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieRush(c, hote, o),
  rediffusionDiamant: (c) => corps!.rediffusionDiamantRush(c),
  // Une partie d'essai (scénario, sensations réglées) n'est jamais classée ; en production ces options n'existent pas.
  classable: (adresse) => !lireEssai(adresse, BUILD_RESTRICTED).essai,
  sansMedaille: true, // prototype : pas de médaille avant la décision de Nathan sur leur méthode
  vibration: true,
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
