import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Vertige » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Vertige — Du Jour",
  "scene.aria": "Game board (text to replace)",
  "theme.clair": "Light (to replace)",
  "theme.sombre": "Dark (to replace)",
  "accueil.phrase.clair": "To replace: a tagline for the “Light” theme.",
  "accueil.phrase.sombre": "To replace: a tagline for the “Dark” theme.",
  "aide.point1": "To replace: the goal of the game in one sentence.",
  "aide.point2": "To replace: what the player does, in one sentence.",
  "aide.point3": "To replace: how ties are broken.",
  "commandes.action.gauche": "Cursor left",
  "commandes.action.droite": "Cursor right",
  "commandes.action.haut": "Cursor up",
  "commandes.action.bas": "Cursor down",
  "commandes.action.toucher": "Hit the square",
};
