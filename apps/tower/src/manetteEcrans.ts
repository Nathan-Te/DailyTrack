import type { EcranManette, OptionsManette } from "@cdj/ui/src/manette";

// Lot M1 (plateforme) : les menus de Tower se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette).
// Tower n'a pas encore de commande à la manette en partie (ses entrées sont au clavier et aux boutons) : seuls ses écrans sont concernés. **Chaque écran déclare ici son
// action principale** (une ligne par écran) ; un nouvel écran de Tower s'ajoute ici (docs/tower/consignes.md).
export const ECRANS_MANETTE: readonly EcranManette[] = [
  { ecran: '#pause-ecran [role="dialog"]', principal: "#pause-reprendre", retour: "#pause-reprendre" }, // la pause : « Reprendre »
  { ecran: '#fin-ecran [role="dialog"]', principal: "#fin-rejouer" }, // la fin de partie : « Rejouer »
];

/** Ce que le menu à la manette lit (chargé avec lui, à la première manette). */
export const OPTIONS_MANETTE: OptionsManette = { ecrans: ECRANS_MANETTE };
