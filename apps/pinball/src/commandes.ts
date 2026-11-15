import type { ActionCommande } from "@cdj/ui/src/commandes";

// Les trois commandes de Pinball (règle M2 : le jeu déclare ses actions, il ne lit jamais une touche en dur). Le batteur gauche : ← Q A ; le droit : → D ; le lanceur : Espace ↓ (seed « Commandes »).
// **Le seed donne aussi P au batteur droit, mais P est la touche de la pause du kit** (`ACTIONS_KIT`, zone partagée) : une touche liée à deux actions fait refuser en bloc les réglages du joueur au rechargement (`Commandes.coherent`,
// vérifié au lot PB1 : un seul réglage enregistré revenait aux touches d'origine). P reste donc la pause tant que la plateforme n'en décide pas autrement (README du lot PB1).
// À la manette : LB, RB, A ; la croix et le stick gauche font aussi les deux batteurs (le kit leur donne les noms `gauche` et `droite`). **Un seul fichier, partagé par la définition et la scène** (la scène relit
// les touches choisies par le joueur pour savoir quand elles sont RELÂCHÉES : le kit ne signale qu'un appui).
export const ACTIONS: readonly ActionCommande[] = [
  { id: "gauche", clavier: ["ArrowLeft", "KeyQ", "KeyA"], manette: "b4" },
  { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: "b5" },
  { id: "lanceur", clavier: ["Space", "ArrowDown"], manette: "b0" },
];
