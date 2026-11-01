import type { EcranManette, OptionsManette } from "@cdj/ui/src/manette";

// Lot M1 (plateforme) : les menus de Tower se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette). Lot T7 : et la partie aussi
// (`entrees.ts`). **Chaque écran déclare ici son action principale** (une ligne par écran) et, si besoin, ce que B active ; un nouvel écran de Tower s'ajoute ici (docs/tower/consignes.md).
export const ECRANS_MANETTE: readonly EcranManette[] = [
  { ecran: '#accueil-ecran [role="dialog"]', principal: "#accueil-jouer" }, // l'accueil (lot T4) : « Jouer » ; B ne quitte pas Tower
  { ecran: '#aide-ecran [role="dialog"]', principal: "#aide-ok", retour: "#aide-ok" }, // « Comment jouer » : « C'est parti »
  { ecran: '#classement-ecran [role="dialog"]', principal: "#classement-fermer", retour: "#classement-fermer" }, // le classement en dialogue : « Fermer »
  { ecran: '#pause-ecran [role="dialog"]', principal: "#pause-reprendre", retour: "#pause-reprendre" }, // la pause : « Reprendre »
  { ecran: '#fin-ecran [role="dialog"]', principal: "#fin-rejouer", retour: "#fin-accueil" }, // la fin de partie : « Rejouer » ; B : l'accueil de Tower (lot T7)
  { ecran: "#reglages-ecran", principal: "#reglages-sons" }, // les Réglages (lot T7) ; B : « ‹ TOWER », la barre
  { ecran: "#archives-ecran", principal: ".archive, .dj-barre-jeu__retour" }, // les Archives (lot T7) : le premier jour ; B : « ‹ TOWER »
];

/** Ce que le menu à la manette lit (chargé avec lui, à la première manette). */
export const OPTIONS_MANETTE: OptionsManette = { ecrans: ECRANS_MANETTE };
