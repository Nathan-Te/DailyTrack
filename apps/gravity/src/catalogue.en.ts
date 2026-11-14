import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Gravity » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`. Textes courts : les complets viennent au lot GR4.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Gravity — Du Jour",
  "scene.aria": "The runner and today's level: touch the screen to flip gravity",
  "theme.foret": "Forest",
  "theme.usine": "Factory",
  "theme.glace": "Ice",
  "theme.nuit": "Night",
  "theme.neon": "Neon",
  "theme.foret.meca": "Air currents",
  "theme.usine.meca": "Conveyor belts",
  "theme.glace.meca": "Icy floors",
  "theme.nuit.meca": "Blinking blocks",
  "theme.neon.meca": "Alternating blocks",
  "accueil.phrase.foret": "Floor, ceiling: same fight. As long as you're touching something.",
  "accueil.phrase.usine": "The belts push faster: flip before they run out.",
  "accueil.phrase.glace": "You can't push off ice: flip before it, or after.",
  "accueil.phrase.nuit": "The blocks switch on and off: cross in rhythm.",
  "accueil.phrase.neon": "Two colours, only one solid at a time: follow the beat.",
  "aide.point1": "An endless runner: it runs right by itself. The goal: get as far as you can, collecting coins and gems.",
  "aide.point2": "Touch the screen (or Space, A on a controller): gravity flips, but only while you touch a surface: floor, ceiling or platform. No flipping in mid-air or on ice.",
  "aide.point3": "To replace: coins, the multiplier and power-ups (full text in lot GR4).",
  "commandes.action.toucher": "Flip gravity",
  "hud.detail": "{m} m · ×{mult}",
  "mort.vide": "Fell into the void",
  "mort.pique": "Hit a spike",
  "mort.bord": "Caught by the edge of the screen",
  "mort.temps": "Time's up: ten minutes!",
};
