import { CATALOGUE_COMMUN_EN } from "@cdj/ui";
import { CATALOGUE_KIT_EN } from "@cdj/kit/jeu/catalogue";
import type { CATALOGUE_FR } from "./catalogue.fr";

// L'anglais de « Blocks » (chargé à la demande) : le vocabulaire des écrans (le kit) et ce qui est propre au jeu ; avec l'anglais du catalogue commun de `@cdj/ui`.
export { CATALOGUE_COMMUN_EN };
export const CATALOGUE_EN: { readonly [K in keyof typeof CATALOGUE_FR]: string } = {
  ...CATALOGUE_KIT_EN,
  "page.titre": "Blocks — Du Jour",
  "scene.aria": "8 by 8 grid: drag the current piece to place it.",
  "theme.port": "Harbor",
  "theme.chantier": "Building site",
  "theme.canyon": "Canyon",
  "theme.banquise": "Ice floe",
  "theme.jungle": "Jungle",
  "theme.nuit": "Night",
  "accueil.phrase.port": "“The harbor is waking up. The pieces line up on the quay, the same run for everyone.”",
  "accueil.phrase.chantier": "“The site is open. The pieces wait to be placed, in the same order for all.”",
  "accueil.phrase.canyon": "“The canyon echoes. Every piece finds its place, the same for all.”",
  "accueil.phrase.banquise": "“On the ice floe everything slides but the pieces. They fall in the same order for all.”",
  "accueil.phrase.jungle": "“The jungle grew back overnight. The pieces cling to it, the same for all.”",
  "accueil.phrase.nuit": "“It is night. The pieces glow in the dark, the same run for everyone.”",
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
  "partage.combo": "combo ×{n}",
  "hud.combo.annonce": "Combo ×{n}!",
  "hud.plateauVide": "Board cleared! +{n}",
  "hud.piece": "Your piece",
  "hud.suivante": "Next",
  "hud.aide.glisser": "Drag the piece onto the grid",
  "hud.aide.bureau": "Drag a piece onto the grid, or move the shadow with the arrow keys",
  "fin.plusDePlace": "No room left!",
};
