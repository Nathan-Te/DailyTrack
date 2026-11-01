import { Commandes, type ActionCommande } from "@cdj/ui/src/commandes";
import { definirParametresCommuns, langueCourante } from "./i18n";

// Lot T7 (règle M2 de la plateforme) : les actions de Tower, leurs touches et boutons d'origine, et les choix du joueur (`cdj:commandes:tower`). **Le jeu ne lit jamais une touche en dur** :
// `entrees.ts` et `jeu.ts` passent par `commandes` ; la correspondance touche → action se fait AVANT le masque de commandes de la simulation (`COMMANDE` de `@cdj/tower-sim` : un entier par tick,
// toujours le même) — la rediffusion ne change donc pas d'un bit, quelles que soient les touches. **Échap et Start (pause) sont fixes** ; le stick et la croix déplacent (fixes à la manette : seules
// les touches du clavier de « déplacer » se règlent), et le bas du stick et de la croix descend aussi. Les touches sont des `event.code` (la touche physique) : ← A / → D sont Q / D sur un
// AZERTY, ↑ W est Z, ↓ S reste S. Une action a deux emplacements au clavier, davantage si son origine en a plus (« tourner » et « descendre » : trois).
export const ACTIONS_TOWER: readonly ActionCommande[] = [
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
  { id: "tourner", clavier: ["ArrowUp", "KeyW", "KeyX"], manette: "b0" },
  { id: "descendre", clavier: ["ArrowDown", "KeyS", "Space"], manette: "b7" },
  { id: "recommencer", clavier: ["Enter"], manette: "b2" },
  { id: "pause", clavier: ["KeyP"], manette: null },
  { id: "fantome", clavier: ["KeyG"], manette: "b3" },
];

/** La clé de catalogue qui nomme une action (Réglages › Commandes). */
export const cleAction = (id: string): string => `commandes.action.${id}`;

export const commandes = new Commandes("tower", ACTIONS_TOWER);

// Les aides citent les touches choisies (`{tourner}`, `{m_tourner}`…) : `t` (`i18n.ts`) reçoit ces paramètres.
definirParametresCommuns(() => commandes.parametres(langueCourante()));
