import { CATALOGUE_FR } from "./catalogue.fr";

// Les textes français que SEUL le jeu lit (lot T5 : la case « Sons » de la pause, la note « réglage d'essai » de l'arrivée) : à part du catalogue de l'accueil, parce que le premier chargement ne doit
// pas grossir (`tower.jsCss`, `docs/plateforme/budgets.md`). Le jeu les ajoute au catalogue français quand il se charge (`installerCataloguesDuJeu`, appelé par `jeu.ts`) ; l'anglais (`catalogue.en.ts`,
// à la demande) les a déjà. Les tests et `npm run traductions` voient le tout réuni (`catalogue.ts`).
export const CATALOGUE_JEU_FR = {
  "pause.sons": "Sons",
  "pause.sons.volume": "Volume",
  "fin.essai": "Réglage d'essai : partie non classée.",

  // Lot T7 : la pause complète, l'aide des commandes, les Réglages, les Archives, l'accueil de Tower depuis la partie.
  "pause.aide": "Comment jouer",
  "pause.reglages": "Réglages",
  "jeu.accueil": "Accueil de Tower",
  "pause.mentions": "Mentions légales",
  "fin.archive": "Archive : partie non classée.",
  "hud.archive": "Archive",
  "aide.ligne": "{gauche} {droite} déplacer · {tourner} tourner · {descendre} descendre · {pause} pause",
};

/** Ajoute les textes du jeu au catalogue français (le traducteur lit ce même objet : rien à reconstruire). */
export function installerCataloguesDuJeu(): void {
  Object.assign(CATALOGUE_FR, CATALOGUE_JEU_FR);
}
