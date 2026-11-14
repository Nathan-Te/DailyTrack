import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";

// Le catalogue français de « Gravity » : le vocabulaire des écrans (le kit) et ce qui est propre au jeu.
export const CATALOGUE_FR = {
  ...CATALOGUE_KIT_FR,
  "page.titre": "Gravity — Du Jour",
  "scene.aria": "Plateau de jeu (texte à remplacer)",
  "theme.clair": "Clair (à remplacer)",
  "theme.sombre": "Sombre (à remplacer)",
  "accueil.phrase.clair": "À remplacer : une phrase d'accroche pour le thème « Clair ».",
  "accueil.phrase.sombre": "À remplacer : une phrase d'accroche pour le thème « Sombre ».",
  "aide.point1": "À remplacer : le but du jeu en une phrase.",
  "aide.point2": "À remplacer : ce que fait le joueur, en une phrase.",
  "aide.point3": "À remplacer : comment les égalités se départagent.",
  "commandes.action.gauche": "Curseur à gauche",
  "commandes.action.droite": "Curseur à droite",
  "commandes.action.haut": "Curseur en haut",
  "commandes.action.bas": "Curseur en bas",
  "commandes.action.toucher": "Toucher la case",
} as const;
