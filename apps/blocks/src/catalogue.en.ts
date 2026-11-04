import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Blocks » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Blocks — Du Jour",
  "scene.aria": "8 by 8 grid: drag the current piece to place it.",
  "theme.clair": "Light",
  "theme.sombre": "Dark",
  "accueil.phrase.clair": "Place, clear, chain: the same run of pieces for everyone.",
  "accueil.phrase.sombre": "One glance, one gesture: the grid is waiting, the same for all.",
  "aide.point1": "Drag the current piece into the 8 × 8 grid: every full row or column disappears.",
  "aide.point2": "Chain clears to build your combo: it survives two placements without a clear.",
  "aide.point3": "Everyone gets the same run of pieces today. On equal scores, the bigger combo wins.",
  "commandes.action.gauche": "Shadow left",
  "commandes.action.droite": "Shadow right",
  "commandes.action.haut": "Shadow up",
  "commandes.action.bas": "Shadow down",
  "commandes.action.poser": "Place the piece",
  "score.valeur": "{n} pts",
  "hud.score": "Score",
  "hud.combo": "Combo",
  "hud.combo.lecteur": "Combo ×{n}",
  "hud.combo.annonce": "Combo ×{n}!",
  "hud.plateauVide": "Board cleared! +{n}",
  "hud.piece": "Your piece",
  "hud.suivante": "Next",
  "hud.aide.glisser": "Drag the piece onto the grid",
  "hud.aide.bureau": "Drag a piece onto the grid, or move the shadow with the arrow keys",
  "fin.plusDePlace": "No room left!",
};
