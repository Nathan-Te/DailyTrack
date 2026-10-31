import { appliquerTextes, definirParametresCommuns, langueCourante } from "./i18n";
import { Commandes, type ActionCommande } from "@cdj/ui/src/commandes";

// Lot M2 : les actions de Jump (touches et boutons d'origine) et les choix du joueur (`cdj:commandes:jump`). **Le jeu ne lit jamais une touche en dur** : `input.ts`
// et `main.ts` passent par `commandes` ; la correspondance touche → action se fait avant les bits de la simulation (rien ne change pour elle). Échap et Start (pause) sont
// fixes ; le stick et la croix font courir (fixes à la manette : seules les touches du clavier de « courir » se règlent). Un nom de `nom` = une clé de catalogue.
export const ACTIONS_JUMP: readonly ActionCommande[] = [
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
  { id: "sauter", clavier: ["Space", "ArrowUp", "KeyW"], manette: "b0" },
  { id: "reprendre", clavier: ["KeyR"], manette: "b3" },
  { id: "recommencer", clavier: ["Enter"], manette: "b2" },
  { id: "pause", clavier: ["KeyP"], manette: null },
  { id: "fantome", clavier: ["KeyG"], manette: null },
];

/** La clé de catalogue qui nomme une action (Réglages › Commandes). */
export const cleAction = (id: string): string => `commandes.action.${id}`;

export const commandes = new Commandes("jump", ACTIONS_JUMP);

// Les aides citent les touches choisies (`{sauter}`, `{m_sauter}`…) : `t` (`i18n.ts`) reçoit ces paramètres, et un changement redessine tous les textes liés (`data-t`).
definirParametresCommuns(() => commandes.parametres(langueCourante()));
commandes.surChangement(() => appliquerTextes());
