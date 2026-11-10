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
  { id: "relancer", clavier: ["KeyR"], manette: null },
];

/** Les actions qui se TIENNENT (les autres sont des appuis). */
export const ACTIONS_TENUES = ["avant", "arriere", "gauche", "droite", "saut", "dash"] as const;
