import type { EcranManette, OptionsManette } from "@cdj/ui/src/manette";

export { demarrerManette } from "@cdj/ui/src/manette"; // le moteur voyage avec les déclarations : un seul `import()` à la première manette

// Lot K4f (règle M1) — **tout écran d'un jeu neuf se pilote à la manette** : chaque écran déclare ici son action principale (et ce que B active). Chargé à la première manette (`activerManette`). Un appui ne sert
// jamais deux fois : les menus cachent la manette à la partie (`padPourLeJeu`), sauf Start.
export const ECRANS_MANETTE: readonly EcranManette[] = [
  { ecran: "#jeu-accueil", principal: "#jeu-jouer" }, // l'accueil : « Jouer » ; B ne quitte pas le jeu
  { ecran: "#jeu-aide", principal: "#jeu-aide-ok", retour: "#jeu-aide-ok" }, // « Comment jouer »
  { ecran: "#jeu-classement-ecran", principal: "#jeu-classement-fermer", retour: "#jeu-classement-fermer" }, // le classement en dialogue
  { ecran: "#jeu-pause", principal: "#jeu-reprendre", retour: "#jeu-reprendre" }, // la pause
  { ecran: "#jeu-fin", principal: "#jeu-rejouer", retour: "#jeu-fin-accueil" }, // la fin de partie : « Rejouer » ; B : l'accueil
  { ecran: "#jeu-reglages", principal: ".dj-barre-jeu__retour", retour: ".dj-barre-jeu__retour" }, // Réglages ; B : le retour
  // Lot F2 : la feuille d'un joueur (au toucher d'une ligne du classement) : A valide, B ferme (`ECRAN_MANETTE_FEUILLE` de `@cdj/ui/src/amis`, recopié ici pour ne pas charger les amis à la première manette).
  { ecran: ".dj-feuille", principal: ".dj-feuille__principal, .dj-feuille__fermer", retour: ".dj-feuille__fermer" },
  // Lot C1 : « Un bug ? Une idée ? » (`ECRAN_MANETTE_RETOUR` de `@cdj/ui/src/retours`, recopié).
  { ecran: ".dj-retour", principal: ".dj-retour__texte", retour: ".dj-retour__fermer" },
];
export const OPTIONS_MANETTE: OptionsManette = { ecrans: ECRANS_MANETTE };
