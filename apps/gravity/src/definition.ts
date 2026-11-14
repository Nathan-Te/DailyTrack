import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroGravity, themeDuJour, type Contenu } from "@cdj/gravity-sim";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { nouvellePartieGravity } from "./scene";

// La définition de « Gravity » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le niveau (générateur, morceaux, seuils) est chargé à la demande** (`niveau.ts`) : le premier chargement
// est l'accueil seul (ligne de budget `gravity.jsCss`). La scène (`scene.ts`) est dans le morceau de la partie, chargé par le kit au clic sur JOUER.
export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION },
  // Une seule commande : toucher. Espace, les flèches haut et bas, W et S, A à la manette (b0) ; l'écran tactile et le clic sont la scène elle-même. La touche T (thème suivant) est celle de la scène, seulement avec `?theme=`.
  actions: [{ id: "toucher", clavier: ["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"], manette: "b0" }],
  themeDuJour,
  numero: numeroGravity,
  contenuDuJour: async (jour, base, theme) => (await import("./niveau")).contenuDuJour(jour, base, theme),
  // Les seuils sont écrits dans le contenu quand il est lu (`niveau.ts`) : ceux du fichier de jour figé, sinon le calcul provisoire.
  seuils: (c) => c.seuilsFiges!,
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: nouvellePartieGravity,
  // Pas de fantôme ni de Diamant en GR1 : le robot du jour arrive au lot GR2.
  sansFantome: true,
  rediffusionDiamant: () => "",
  // Une partie d'essai (`?theme=` : thème imposé, touche T) n'est ni classée ni envoyée ; le kit le sait déjà pour `?theme=`, on le dit aussi pour qu'aucun essai ne soit jamais pris pour une partie du jour.
  classable: (adresse) => !new URLSearchParams(adresse).has("theme"),
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
