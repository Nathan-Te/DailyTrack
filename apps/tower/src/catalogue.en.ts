import type { Catalogue } from "@cdj/ui";

// L'anglais de Tower (lot T1) : adapté, pas traduit mot à mot. Chargé à la demande avec l'anglais du catalogue commun (i18n.ts).
export { CATALOGUE_COMMUN_EN } from "@cdj/ui";

export const CATALOGUE_EN: Catalogue = {
  "page.titre": "Tower — Du Jour",
  "page.sansWebgl": "Your browser can't show Tower: WebGL is required.",
  "chargement.texte": "Loading the physics…",
  "chargement.echec": "The physics couldn't load. Reload the page.",

  "hud.aria": "Game interface",
  "hud.pause": "Pause",
  "hud.hauteur.aria": "Tower height: {hauteur}",
  "hud.pieces.aria": "Piece {n} of {total}",
  "hud.vies.aria": { one: "{n} life out of {total}", other: "{n} lives out of {total}" },
  "hud.suivante": "Next",
  "hud.suivante.aria": "Next piece: {forme}",
  "hud.commandes": "Controls",
  "commande.gauche": "Left",
  "commande.droite": "Right",
  "commande.tourner": "Rotate",
  "commande.descendre": "Drop fast (hold)",
  "fantome.bouton": "Ghost: {nom}",
  "fantome.aucun": "None",
  "fantome.meilleure": "My best",

  "pause.aria": "Pause",
  "pause.titre": "Pause",
  "pause.etat": "Piece {n} of {total} · {hauteur}",
  "pause.phrase": "The pieces are holding their breath.",
  "pause.reprendre": "Resume",
  "pause.recommencer": "Restart",

  "fin.aria": "End of the game",
  "fin.eyebrow": "TOWER · Practice run",
  "fin.hauteurStable": "Stable height",
  "fin.plusHaute": "Highest reached: {hauteur} (doesn't count)",
  "fin.vies": "Lives",
  "fin.partie": "Your game",
  "fin.posees": "Pieces placed",
  "fin.tombees": "Pieces fallen",
  "fin.temps": "Time",
  "fin.rejouer": "Play again",
  "fin.phrase.pieces": "The pieces can finally breathe.",
  "fin.phrase.vies": "The pieces don't hold it against you. Not much.",
};
