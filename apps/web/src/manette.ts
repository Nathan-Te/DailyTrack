import type { EcranManette, OptionsManette } from "@cdj/ui/src/manette";

export { demarrerManette } from "@cdj/ui/src/manette"; // le moteur voyage avec les déclarations : un seul `import()` au premier chargement

// Lot M1 (plateforme) : les menus de Track se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette).
// **Chaque écran déclare ici son action principale** (où le focus se pose à son ouverture) et, si besoin, ce que B active : une ligne par écran. Un écran qui n'est pas
// listé se pilote quand même (le focus part du premier élément) ; un nouvel écran s'ajoute ici (`test/manette.test.ts` vérifie que les éléments nommés existent).
export const ECRANS_MANETTE: readonly EcranManette[] = [
  { ecran: "#home", principal: "#home-daily" }, // l'accueil : « Courir » ; B ne quitte pas le jeu
  { ecran: "#howto", principal: "#howto-done", retour: "#howto-done" }, // « Comment jouer »
  { ecran: '#pause [role="dialog"]', principal: "#pause-stay, #pause-resume", retour: "#pause-stay, #pause-resume" }, // la pause : « Reprendre » (ou « Rester » à la confirmation)
  { ecran: "#finish", principal: ".dj-bouton--track", retour: "#finish-home" }, // l'arrivée (jour, Salon, rediffusion) : « Recourir » ; B : l'accueil de Track
  { ecran: "#board-screen", principal: "#board-screen-watch, .dj-barre-jeu__retour" }, // le classement du jour
  { ecran: "#settings", principal: '[role="tab"][aria-selected="true"]' }, // les réglages : l'onglet ouvert
  { ecran: "#archive", principal: ".etiquette a[href], .etiquette button" }, // les archives : le premier jour
  { ecran: "#podium", principal: ".etiquette .dj-bouton, .etiquette button" }, // le classement final du Salon
  { ecran: "#garage", principal: '.garage-voiture[aria-current="true"], .garage-voiture' }, // le Garage : la voiture regardée
];

/** Ce que le menu à la manette lit (chargé avec lui, à la première manette : ce fichier n'importe rien d'exécutable). */
export const OPTIONS_MANETTE: OptionsManette = { ecrans: ECRANS_MANETTE };
