import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, medailleDe, numeroBlocks, type Contenu, type Seuils } from "@cdj/blocks-sim";
import { parisDay } from "@cdj/clock";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { assemblerLigne } from "@cdj/kit/partage";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { lireEssai } from "./essai";
import { themeAffiche } from "./themeAffiche";
import { ecrireComboPartage, ecrireScore } from "./textes";

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
  themeDuJour: themeAffiche, // le thème du jour (sac commun), ou `?theme=` hors production
  numero: numeroBlocks,
  async contenuDuJour(jour, base) {
    corps ??= await import("./corps");
    return corps.contenuDuJour(jour, base);
  },
  seuils: (c) => corps!.seuilsDeBlocks(c), // le Diamant (bot) et ses fractions, dans le corps du jeu (à la demande)
  medaille: (score, s) => medailleDe(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieBlocks(c, hote, o),
  rediffusionDiamant: (c) => corps!.rediffusionDuDiamant(c), // la partie du bot (le kit l'exige ; lot B5 : plus de fantôme, la partie du Diamant se revoit hors partie)
  classable: (adresse) => {
    const essai = lireEssai(adresse, BUILD_RESTRICTED, parisDay(Date.now()));
    return essai.bot === null && essai.mode === undefined; // `&bot`, `?scenario=partage` : des essais locaux, jamais classés
  },
  formatScore: (score) => ecrireScore(score[0] ?? 0),
  // La ligne à partager (lot B4, seed § 5) : `Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7`. Le gabarit est celui du kit (`ligneParDefaut`) : le titre, le score, la médaille, puis le rang. Le kit n'offre pas encore d'« extras » à un
  // jeu neuf : le combo maximal part donc avec le score, AVANT la médaille (`4 582 pts — combo ×7 — 🥈`) — manque de la plateforme, voir le README du lot B4.
  scorePartage: (score, langue) => assemblerLigne([ecrireScore(score[0] ?? 0, langue), ecrireComboPartage(score[1] ?? 0)]),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
