// Les actions de Rush (le kit ajoute `pause`, `recommencer` et `fantome`) : les touches d'origine du clavier et de la manette, réglables par le joueur (Réglages › Commandes, règle M2). Fichier à part : la
// définition du jeu le lit dans le premier chargement, sans le reste des commandes.
/** Les actions du jeu (le kit ajoute `pause`, `recommencer` et `fantome`). Le coup est sur A de la manette et l'esquive sur B (X et Y servent au kit). */
export const ACTIONS_RUSH = [
  { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
  { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
  { id: "coup", clavier: ["Space", "KeyJ"], manette: "b0" },
  { id: "esquive", clavier: ["ShiftLeft", "KeyK"], manette: "b1" },
] as const;
