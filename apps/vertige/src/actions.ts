import type { ActionCommande } from "@cdj/ui/src/commandes";

// Les actions de Vertige (le kit ajoute `pause`, `recommencer` et `fantome`) : les touches d'origine du clavier et de la manette, réglables par le joueur (Réglages › Commandes, règle M2). Les touches sont des
// `event.code` : la POSITION de la touche, pas sa lettre. `KeyW`, `KeyA`, `KeyS`, `KeyD` sont donc ZQSD sur un clavier AZERTY et WASD sur un QWERTY, sans rien de plus. Les directions de la manette sont celles du
// stick gauche (le stick droit regarde : il n'est pas une action). Fichier à part : la définition du jeu le lit dans le premier chargement, sans le reste des commandes.
export const ACTIONS_VERTIGE: readonly ActionCommande[] = [
  { id: "avant", clavier: ["KeyW", "ArrowUp"], manette: "a1-" },
  { id: "arriere", clavier: ["KeyS", "ArrowDown"], manette: "a1+" },
  { id: "gauche", clavier: ["KeyA", "ArrowLeft"], manette: "a0-" },
  { id: "droite", clavier: ["KeyD", "ArrowRight"], manette: "a0+" },
  { id: "saut", clavier: ["Space"], manette: "b0" },
  { id: "dash", clavier: ["ShiftLeft", "ShiftRight"], manette: "b5" },
  // Lot V2 : la reprise au dernier palier (le chrono continue), les mêmes touches que « point de contrôle » de Track et Jump (R, et le bouton Y de la manette) ; Entrée (le kit) recommence depuis le départ.
  { id: "reprendre", clavier: ["KeyR"], manette: "b3" },
];

/** Les actions que la simulation lit, une touche chacune dans ses commandes (la reprise est lue à l'appui : un front montant). */
export const ACTIONS_TENUES = ["avant", "arriere", "gauche", "droite", "saut", "dash", "reprendre"] as const;
