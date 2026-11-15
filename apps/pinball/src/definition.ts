import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroPinball, themeDuJour, type Contenu } from "@cdj/pinball-sim";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { ACTIONS } from "./commandes";

// La définition de « Pinball » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **La table (générateur, seuils) et la scène sont chargées à la demande** : le premier chargement est
// l'accueil seul (ligne de budget `pinball.jsCss`). Le kit demande le contenu du jour dès l'accueil dessiné : c'est là que la scène se charge, bien avant le clic sur JOUER.
type Scene = typeof import("./scene");
let scene: Scene | null = null;

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION },
  // Trois commandes TENUES (le kit n'en signale que l'appui : la scène relit les touches pour le relâchement, `scene.ts`).
  actions: ACTIONS,
  themeDuJour,
  numero: numeroPinball,
  contenuDuJour: async (jour, base, theme) => {
    const [niveau, s] = await Promise.all([import("./niveau"), import("./scene")]);
    scene = s;
    return niveau.contenuDuJour(jour, base, theme);
  },
  // Les seuils sont écrits dans le contenu quand il est lu (`niveau.ts`) : ceux du fichier de jour figé, sinon le calcul provisoire.
  seuils: (c) => c.seuilsFiges!,
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: (contenu, hote, options) => scene!.nouvellePartiePinball(contenu, hote, options),
  // Pas de fantôme ni de Diamant au PB1 : le robot du jour arrive au lot PB4.
  sansFantome: true,
  rediffusionDiamant: () => "",
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
