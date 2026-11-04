import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";

// Le catalogue français de « Cibles » : le vocabulaire des écrans (le kit) et ce qui est propre au jeu.
export const CATALOGUE_FR = {
  ...CATALOGUE_KIT_FR,
  "page.titre": "Cibles — Du Jour",
  "scene.aria": "Plateau de 8 colonnes sur 6 lignes : touche la case où apparaît la cible",
  "theme.sable": "Sable",
  "theme.ardoise": "Ardoise",
  "accueil.phrase.sable": "Vingt cibles, trente secondes : le sable ne pardonne pas la lenteur.",
  "accueil.phrase.ardoise": "L'ardoise est sombre, tes réflexes doivent être clairs.",
  "aide.point1": "Une cible apparaît sur une case : touche cette case avant qu'elle disparaisse.",
  "aide.point2": "Vingt cibles en trente secondes, de plus en plus brèves ; une cible ratée ne revient pas.",
  "aide.point3": "À score égal, le plus rapide à toucher sa dernière cible passe devant.",
  "commandes.action.gauche": "Curseur à gauche",
  "commandes.action.droite": "Curseur à droite",
  "commandes.action.haut": "Curseur en haut",
  "commandes.action.bas": "Curseur en bas",
  "commandes.action.toucher": "Toucher la case",
} as const;
