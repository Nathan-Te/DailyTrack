import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, estScenario, medailleDe, numeroBlocks, themeDuJour, type Contenu } from "@cdj/blocks-sim";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
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
    // Lot B8 : choisir l'une des trois pièces (touches 1 à 3), ou passer de l'une à l'autre avec les boutons d'épaule (Q et E au clavier, comme Tower).
    ...[1, 2, 3].map((n) => ({ id: `piece${n}`, clavier: [`Digit${n}`, `Numpad${n}`], manette: null })),
    { id: "pieceAvant", clavier: ["KeyQ"], manette: "b4" },
    { id: "pieceApres", clavier: ["KeyE"], manette: "b5" },
  ],
  themeDuJour, // le thème du jour (sac commun) ; `?theme=` (hors production) est géré par le kit
  numero: numeroBlocks,
  async contenuDuJour(jour, base, theme) {
    corps ??= await import("./corps");
    return corps.contenuDuJour(jour, base, theme);
  },
  seuils: (c) => corps!.seuilsDeBlocks(c), // le Diamant (bot) et ses fractions, dans le corps du jeu (à la demande)
  medaille: (score, s) => medailleDe(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieBlocks(c, hote, o),
  rediffusionDiamant: (c) => corps!.rediffusionDuDiamant(c), // la partie du bot (le kit l'exige ; lot B5 : plus de fantôme, la partie du Diamant se revoit hors partie)
  // Lot « manques de Blocks » : tout essai local est une partie non classable — un scénario, une rampe réglée (`?debug&tune`), `&bot`, `?scenario=partage` ; le kit ne la classe ni ne l'envoie, sans passer la page en archive.
  // (Écrit ici, court, plutôt que par `lireEssai` (`essai.ts`) : celui-ci est dans le corps du jeu, à la demande, et n'a pas à entrer dans le premier chargement — budget `blocks.jsCss` ; `essai.test.ts` garde les deux d'accord.)
  classable: (adresse) => {
    if (BUILD_RESTRICTED) return true;
    const q = new URLSearchParams(adresse);
    const nom = q.get("scenario") ?? "";
    const rampe = q.has("debug") && q.has("tune") && (q.get("rampe") ?? "").split(",").some((x) => /^\d+(\.\d+)?$/.test(x));
    return !(estScenario(nom) || nom === "partage" || q.has("bot") || rampe);
  },
  sansFantome: true, // lot « manques de Blocks » : l'option du kit remplace le bouton, la ligne des Réglages et la commande cachés par `partie.css` (seed § 5 : une grille en transparence est illisible)
  formatScore: (score, langue, t) => ecrireScore(score[0] ?? 0, t, langue),
  // La ligne à partager (lot B4, seed § 5) : `Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7`. Le gabarit est celui du kit (`ligneParDefaut` : le titre, le score, la médaille, les extras, puis le rang) ; le jeu ne donne que le score
  // et, **après la médaille**, le combo maximal (`extrasPartage`, lot « manques de Blocks » : l'exception acceptée à la zone du jeu, une ligne).
  scorePartage: (score, langue, t) => ecrireScore(score[0] ?? 0, t, langue),
  extrasPartage: (score, _langue, t) => [ecrireComboPartage(score[1] ?? 0, t) ?? ""],
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
