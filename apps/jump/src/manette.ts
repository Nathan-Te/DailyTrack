import type { EcranManette, OptionsManette } from "@cdj/ui/src/manette";

export { demarrerManette } from "@cdj/ui/src/manette"; // le moteur voyage avec les déclarations : un seul `import()` au premier chargement

// Lot M1 (plateforme) : les menus de Jump se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette).
// **Chaque écran déclare ici son action principale** (où le focus se pose à son ouverture) et, si besoin, ce que B active : une ligne par écran. Un écran qui n'est pas
// listé se pilote quand même (le focus part du premier élément) ; un nouvel écran s'ajoute ici (`test/manette.test.ts` vérifie que les éléments nommés existent).
export const ECRANS_MANETTE: readonly EcranManette[] = [
  { ecran: "#home", principal: "#home-play" }, // l'accueil : JOUER / CONTINUER / REJOUER ; B ne quitte pas le jeu
  { ecran: '#help [role="dialog"]', principal: "#help-close", retour: "#help-close" }, // « Comment jouer »
  { ecran: '#menu [role="dialog"]', principal: "#menu-resume", retour: "#menu-resume" }, // la pause : REPRENDRE
  { ecran: "#arrival", principal: "#arrival-replay", retour: "#arrival-home" }, // l'arrivée : REJOUER ; B : l'accueil du jeu
  { ecran: "#finish", principal: "#finish-restart" }, // le bandeau d'arrivée d'un morceau ou d'un scénario
  { ecran: "#carnage", principal: "#carnage-pause", retour: "#carnage-close" }, // le carnage : la lecture ; B le ferme
  { ecran: "#leaderboard", principal: ".dj-barre-jeu__retour" }, // le classement du jour
  { ecran: "#archives", principal: ".etiquette a[href], .etiquette button" }, // les archives : le premier jour
  { ecran: "#settings", principal: ".etiquette button, .etiquette input" }, // les réglages
];

/** Ce que le menu à la manette lit (chargé avec lui, à la première manette). La barre du carnage n'est pas un dialogue : elle se pilote comme un écran tant qu'elle est visible. */
export const OPTIONS_MANETTE: OptionsManette = { ecrans: ECRANS_MANETTE, surimpressions: ["#carnage"] };
