import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";

// Le catalogue français de « Pile poil » : le vocabulaire des écrans (le kit) et ce qui est propre au jeu.
export const CATALOGUE_FR = {
  ...CATALOGUE_KIT_FR,
  "page.titre": "Pile poil — Du Jour",
  "scene.aria": "Plateau de jeu (texte à remplacer)",
  "theme.unique": "Du jour (à remplacer)",
  "accueil.phrase.unique": "À remplacer : une phrase d'accroche pour le thème « Du jour ».",
  "aide.point1": "À remplacer : le but du jeu en une phrase.",
  "aide.point2": "À remplacer : ce que fait le joueur, en une phrase.",
  "aide.point3": "À remplacer : comment les égalités se départagent.",
  "bilan.cause": "Le temps est écoulé",
  "bilan.touches": "Touches réussies",
  "bilan.theme": "Thème",
  "bilan.vide": "Ligne vide (ignorée)",
  "bilan.duree": "Durée de la partie",
  "bilan.dureeValeur": "30 s",
  "bilan.pilepoil": "Total à viser",
  "commandes.action.gauche": "Curseur à gauche",
  "commandes.action.droite": "Curseur à droite",
  "commandes.action.haut": "Curseur en haut",
  "commandes.action.bas": "Curseur en bas",
  "commandes.action.toucher": "Toucher la case",
} as const;
