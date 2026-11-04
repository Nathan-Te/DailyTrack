import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Cibles » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Targets — Du Jour",
  "scene.aria": "Board of 8 columns by 6 rows: tap the square where the target appears",
  "theme.sable": "Sand",
  "theme.ardoise": "Slate",
  "accueil.phrase.sable": "Twenty targets, thirty seconds: sand does not forgive slowness.",
  "accueil.phrase.ardoise": "Slate is dark, your reflexes should be bright.",
  "aide.point1": "A target appears on a square: tap that square before it disappears.",
  "aide.point2": "Twenty targets in thirty seconds, each one shorter; a missed target does not come back.",
  "aide.point3": "On equal scores, whoever hits their last target first comes out ahead.",
  "commandes.action.gauche": "Cursor left",
  "commandes.action.droite": "Cursor right",
  "commandes.action.haut": "Cursor up",
  "commandes.action.bas": "Cursor down",
  "commandes.action.toucher": "Hit the square",
};
