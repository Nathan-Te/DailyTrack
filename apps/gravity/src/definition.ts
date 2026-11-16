import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroGravity, themeDuJour, type Contenu } from "@cdj/gravity-sim";
import type { ContexteAujourdhui, DefinitionJeu } from "@cdj/kit/jeu/types";
import { lireEssais } from "./essai";

// La définition de « Gravity » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le niveau (générateur, morceaux, seuils) et la scène (Three.js, `scene.ts`) sont chargés à la demande** : le premier
// chargement est l'accueil seul (ligne de budget `gravity.jsCss`). `contenuDuJour` charge les deux ensemble pendant que l'accueil s'affiche ; `nouvellePartie` ne vient qu'après (comme Vertige).
let corps: typeof import("./scene") | null = null;
/** Le panneau « Aujourd'hui » de l'accueil (lot GR4) : le kit l'appelle quand le contenu du jour est lu, donc quand la scène est chargée (`contenuDuJour`) : il vit dans son morceau, rien de plus au premier chargement. */
export const aujourdhui = (contenu: Contenu, hote: HTMLElement, ctx: ContexteAujourdhui): void => corps?.remplirAujourdhui(contenu, hote, ctx);
export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION },
  // Une seule commande : toucher. Espace, les flèches haut et bas, W et S, A à la manette (b0) ; l'écran tactile et le clic sont la scène elle-même. La touche T (thème suivant) est celle de la scène, seulement avec `?theme=`.
  actions: [{ id: "toucher", clavier: ["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"], manette: "b0" }],
  themeDuJour,
  numero: numeroGravity,
  async contenuDuJour(jour, base, theme) {
    const [contenu, scene] = await Promise.all([import("./niveau").then((n) => n.contenuDuJour(jour, base, theme)), corps ? Promise.resolve(corps) : import("./scene")]);
    corps = scene;
    return contenu;
  },
  // Les seuils sont écrits dans le contenu quand il est lu (`niveau.ts`) : ceux du fichier de jour figé, sinon le calcul provisoire.
  seuils: (c) => c.seuilsFiges!,
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieGravity(c, hote, o),
  // Pas de fantôme ni de Diamant (le robot du lot GR2 sert aux seuils et aux essais de recette ; un fantôme est un lot de la plateforme et de Nathan).
  sansFantome: true,
  // Les effets sonores (lot GR4, `sons.ts`) : le réglage « Volume des effets » du kit apparaît dans les Réglages du jeu.
  effets: true,
  rediffusionDiamant: () => "",
  // Une partie d'essai (`?theme=` : thème imposé, touche T ; `?robot` et `?morceau=<n>` du lot GR2 : hors production seulement) n'est ni classée ni envoyée ; le kit le sait déjà pour `?theme=`, on le dit aussi pour qu'aucun essai ne soit jamais pris pour une partie du jour.
  classable: (adresse) => {
    const e = lireEssais(adresse, import.meta.env.VITE_PRODUCTION === "1");
    return !new URLSearchParams(adresse).has("theme") && !e.robot && e.morceau === null;
  },
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  // « Comment jouer » (lot GR4) : les trois pas, les six blocs spéciaux, le bouclier, l'aimant et le multiplicateur. Le kit n'écrit que du texte (pas de dessins : README du lot).
  aide: ["aide.point1", "aide.point2", "aide.point3", "aide.bloc.usine", "aide.bloc.glace", "aide.bloc.nuit", "aide.bloc.neon", "aide.bloc.foret", "aide.bloc.inverseur", "aide.bouclier", "aide.aimant", "aide.mult"],
};
