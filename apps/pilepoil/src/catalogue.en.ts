import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Pile poil » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Pile poil — Du Jour",
  "scene.aria": "Game board (text to replace)",
  "theme.unique": "Daily (to replace)",
  "accueil.phrase.unique": "To replace: a tagline for the “Daily” theme.",
  "aide.point1": "To replace: the goal of the game in one sentence.",
  "aide.point2": "To replace: what the player does, in one sentence.",
  "aide.point3": "To replace: how ties are broken.",
  "bilan.cause": "Time is up",
  "bilan.touches": "Hits landed",
  "bilan.theme": "Theme",
  "bilan.vide": "Empty line (ignored)",
  "bilan.duree": "Game length",
  "bilan.dureeValeur": "30 s",
  "bilan.pilepoil": "Total to aim for",
  "commandes.action.gauche": "Cursor left",
  "commandes.action.droite": "Cursor right",
  "commandes.action.haut": "Cursor up",
  "commandes.action.bas": "Cursor down",
  "commandes.action.toucher": "Hit the square",
};
