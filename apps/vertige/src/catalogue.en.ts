import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Vertige » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Vertige — Du Jour",
  "scene.aria": "First-person view of Vertige: a course of platforms above the clouds",
  "scene.tactile": "Play on a computer, with keyboard and mouse, or with a gamepad.",
  "scene.verrou": "Click to play",
  "scene.verrou.reprise": "Click to take the mouse back",
  "theme.clair": "Light (to replace)",
  "theme.sombre": "Dark (to replace)",
  "accueil.phrase.clair": "To replace: a tagline for the “Light” theme.",
  "accueil.phrase.sombre": "To replace: a tagline for the “Dark” theme.",
  "aide.point1": "To replace: the goal of the game in one sentence.",
  "aide.point2": "To replace: what the player does, in one sentence.",
  "aide.point3": "To replace: how ties are broken.",
  "hud.gemmes": "{n} / {total} gems",
  "etat.dash": "Dash",
  "etat.mur": "Wall run",
  "etat.gravite": "Gravity turned",
  "confort.ouvrir": "Comfort",
  "confort.titre": "Comfort settings",
  "confort.sensibilite": "Mouse sensitivity",
  "confort.champ": "Field of view",
  "confort.roulis": "Camera tilt on the wall",
  "confort.balancement": "Camera sway while walking",
  "confort.fermer": "Close",
  "commandes.action.avant": "Move forward",
  "commandes.action.arriere": "Move back",
  "commandes.action.gauche": "Move left",
  "commandes.action.droite": "Move right",
  "commandes.action.saut": "Jump (and wall jump)",
  "commandes.action.dash": "Dash",
  "commandes.action.relancer": "Restart the course",
};
