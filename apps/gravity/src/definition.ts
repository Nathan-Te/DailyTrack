import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroGravity, themeDuJour, type Contenu } from "@cdj/gravity-sim";
import type { ContexteAujourdhui, DefinitionJeu } from "@cdj/kit/jeu/types";
import { aUnReglageDEssai, lireEssais } from "./essai";

// La définition de « Gravity » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le niveau (générateur, morceaux, seuils) et la scène (Three.js, `scene.ts`) sont chargés à la demande** : le premier
// chargement est l'accueil seul (ligne de budget `gravity.jsCss`). Lot GR5 : `contenuDuJour` ne rend plus que le niveau (le panneau « Aujourd'hui » et les seuils sont prêts avant JOUER) ; **la scène (≈ 148 Ko gzip) est chargée par
// `chargerPartie`, que le kit attend au toucher de JOUER** (« Chargement du jeu… » après 250 ms, « Réessaie » si elle ne vient pas) ; `nouvellePartie` reste synchrone et lit la scène chargée. Pendant que l'accueil est lu on la demande
// déjà, sans l'attendre (`prechauffer`) : le toucher de JOUER la trouve le plus souvent chargée.
let corps: typeof import("./scene") | null = null;
let chargement: Promise<typeof import("./scene")> | null = null;
const charger = (): Promise<typeof import("./scene")> => {
  chargement ??= import("./scene").then((m) => (corps = m));
  chargement.catch(() => (chargement = null)); // une panne ne reste pas mémorisée : « Réessaie » recommence
  return chargement;
};
/** Le panneau « Aujourd'hui » de l'accueil (lot GR4) : le kit l'appelle quand le contenu du jour est lu, avant JOUER ; il a son propre morceau (`panneau-`, petit : les thèmes du jour, les seuils), jamais la scène. */
export const aujourdhui = (contenu: Contenu, hote: HTMLElement, ctx: ContexteAujourdhui): void => void import("./panneau").then((m) => m.remplirAujourdhui(contenu, hote, ctx));
export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION },
  // Une seule commande : toucher (lot GR6 : **l'état du bouton** — le kit dit l'appui par `action` et le relâché par `actionRelachee`). Espace, les flèches haut et bas, W et S, A à la manette (b0) ; l'écran tactile et le clic sont la scène elle-même. La touche T (thème suivant) est celle de la scène, seulement avec `?theme=`.
  actions: [{ id: "toucher", clavier: ["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"], manette: "b0" }],
  themeDuJour,
  numero: numeroGravity,
  async contenuDuJour(jour, base, theme) {
    const contenu = await import("./niveau").then((n) => n.contenuDuJour(jour, base, theme));
    void charger().catch(() => undefined); // préchauffage : la scène se charge pendant qu'on lit l'accueil (le toucher de JOUER l'attend, `chargerPartie`)
    return contenu;
  },
  chargerPartie: async () => void (await charger()),
  // Lot GR5 : le HUD est posé sur le plateau dans les zones du kit (`OptionsPartie.zones`), le texte de sa barre n'est plus visible (il reste lu par la pause et les lecteurs d'écran).
  hud: "surimpression",
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
    const production = import.meta.env.VITE_PRODUCTION === "1";
    const e = lireEssais(adresse, production);
    return !new URLSearchParams(adresse).has("theme") && !e.robot && e.morceau === null && e.mode === null && e.danger === null && !aUnReglageDEssai(adresse, production); // lot GR5 : un réglage d'essai non plus ; lot GR6 : ni `?mode=` ; lot GR7 : ni `?danger=`
  },
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  // « Comment jouer » (lot GR4 ; lot GR6 : + les trois modes de vol et les portails de vitesse ; lot GR7 : + les trois dangers) : les trois pas, les six blocs spéciaux, le bouclier, l'aimant et le multiplicateur. Le kit n'écrit que du texte (pas de dessins : README du lot).
  aide: ["aide.point1", "aide.point2", "aide.point3", "aide.bloc.usine", "aide.bloc.glace", "aide.bloc.nuit", "aide.bloc.neon", "aide.bloc.foret", "aide.bloc.inverseur", "aide.mode.avion", "aide.mode.onde", "aide.mode.ressort", "aide.danger.scies", "aide.danger.fragiles", "aide.danger.lasers", "aide.vitesse", "aide.bouclier", "aide.aimant", "aide.mult"],
};
