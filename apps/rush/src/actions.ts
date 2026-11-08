// Les actions de Rush (le kit ajoute `pause`, `recommencer` et `fantome`) : les touches d'origine du clavier et de la manette, réglables par le joueur (Réglages › Commandes, règle M2). Fichier à part : la
// définition du jeu le lit dans le premier chargement, sans le reste des commandes.
/**
 * Les actions du jeu (le kit ajoute `pause`, `recommencer` et `fantome`). Le coup est sur A de la manette et l'esquive sur B (X et Y servent au kit). Les touches sont des `event.code` (la place de la touche, pas la lettre) :
 * `KeyW`, `KeyA`, `KeyS`, `KeyD` sont Z, Q, S, D sur un clavier AZERTY et W, A, S, D sur un QWERTY. À la souris : le clic gauche frappe (maintenu, il enchaîne), le clic droit lance la compétence, la souris vise ; ce ne sont pas des touches réglables.
 */
export const ACTIONS_RUSH = [
  { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
  { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
  { id: "coup", clavier: ["KeyJ"], manette: "b0" },
  { id: "esquive", clavier: ["Space", "ShiftLeft"], manette: "b1" },
  // Lot BR5 : la compétence (E, ou le clic droit de la souris — qui n'est pas réglable —, ou RB à la manette ; X, Y et Start restent au kit).
  { id: "competence", clavier: ["KeyE"], manette: "b5" },
] as const;
