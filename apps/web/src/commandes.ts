import { appliquerTextes, definirParametresCommuns, langueCourante } from "./i18n";
import { Commandes, type ActionCommande } from "@cdj/ui/src/commandes";

// Lot M2 : les actions de Track (touches et boutons d'origine) et les choix du joueur (`cdj:commandes:track`). **Le jeu ne lit jamais une touche en dur** : `input.ts` et `main.ts`
// passent par `commandes` ; la correspondance touche → action se fait avant `makeInput` (la simulation reçoit les mêmes commandes). Échap et Start (pause) sont fixes ; le stick et
// la croix font tourner (fixes à la manette : seules les touches de « tourner » se règlent au clavier). Un `nom` est une clé de catalogue. Les touches de l'essai (`N`, `T`, `H`),
// du Salon (`Tab`) et de la rediffusion (Espace, flèches, 1 à 4) restent celles de leurs écrans.
export const ACTIONS_TRACK: readonly ActionCommande[] = [
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
  { id: "accelerer", clavier: ["ArrowUp", "KeyW"], manette: "b7" },
  { id: "freiner", clavier: ["ArrowDown", "KeyS", "Space"], manette: "b6" },
  { id: "point", clavier: ["KeyR"], manette: "b3" },
  { id: "recommencer", clavier: ["Enter"], manette: "b2" },
  { id: "camera", clavier: ["KeyC"], manette: "b8" },
  { id: "pause", clavier: ["KeyP"], manette: null },
  { id: "classement", clavier: ["KeyL"], manette: null },
  { id: "fantome", clavier: ["KeyG"], manette: null },
  { id: "son", clavier: ["KeyM"], manette: null },
];

/** La clé de catalogue qui nomme une action (Réglages › Commandes). */
export const cleAction = (id: string): string => `commandes.action.${id}`;

export const commandes = new Commandes("track", ACTIONS_TRACK);

// Les aides citent les touches choisies (`{sauter}`, `{m_sauter}`…) : `t` (`i18n.ts`) reçoit ces paramètres, et un changement redessine tous les textes liés (`data-t`).
definirParametresCommuns(() => commandes.parametres(langueCourante()));
commandes.surChangement(() => appliquerTextes());
