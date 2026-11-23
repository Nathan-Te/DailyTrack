import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Pile poil » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Pile poil — Du Jour",
  "scene.aria": "Pile poil: press to stop the cursor on the target",
  "theme.unique": "Ten gauges",
  "accueil.phrase.unique": "To replace (platform lot: legal notice): Stop the cursor right on the target.",
  "aide.point1": "To replace (platform lot: legal notice): 10 gauges. The cursor sweeps back and forth: tap the screen (or {arreter}) to stop it.",
  "aide.point2": "To replace (platform lot: legal notice): Centre of the target: 100 points. Dead centre: a bonus, which grows if you chain them.",
  "aide.point3": "To replace (platform lot: legal notice): Gauge after gauge, it speeds up and the target shrinks. The last three move.",
  "commandes.action.arreter": "Stop the cursor",
  "hud.valeur": "{n}",
  "hud.score": "{n} points",
  "hud.enchaine": "PILE ×{n}",
  "mot.pile": "PILE!",
  "mot.bien": "GOOD",
  "mot.touche": "PHEW",
  "mot.rate": "MISS",
  "partie.bouge": "THE TARGET MOVES",
  "partie.points": "+{n}",
  "partie.pointsBonus": "+{n} +{b}",
  "partie.zero": "0",
  "partie.consigne.toucher": "Tap the screen to stop the cursor",
  "partie.consigne.touche": "Press to stop the cursor",
  "bilan.piles": "“Pile”",
  "bilan.enchaine": "Longest chain",
  "bilan.ratees": "Missed",
  "bilan.surDix": "{n} out of 10",
  "score.valeur": "{n}",
  "partage.score": "{n} pts",
  "partage.piles": "pile ×{n}",
};
