import type { Catalogue } from "@cdj/ui";

// Le français de Tower (lot T1). Les textes de l'interface vivent ici et dans `catalogue.en.ts` (parité vérifiée : packages/ui/test/catalogues.test.ts) ; les outils de
// Nathan (`?debug&tune`, la démonstration `?scenario=banc`) restent en français et n'y sont pas. Ton de Tower (charte rév. 13, § 7) : tendre et inquiet, **une seule réplique
// par écran au plus**. L'anglais est un autre fichier, chargé à la demande (i18n.ts).
export const CATALOGUE_FR: Catalogue = {
  "page.titre": "Tower — Du Jour",
  "page.sansWebgl": "Ton navigateur ne peut pas afficher Tower : WebGL est nécessaire.",
  "chargement.texte": "Chargement de la physique…",
  "chargement.echec": "La physique n'a pas pu se charger. Recharge la page.",

  "hud.aria": "Interface de la partie",
  "hud.pause": "Pause",
  "hud.hauteur.aria": "Hauteur de la tour : {hauteur}",
  "hud.pieces.aria": "Pièce {n} sur {total}",
  "hud.vies.aria": { one: "{n} vie sur {total}", other: "{n} vies sur {total}" },
  "hud.suivante": "Suivante",
  "hud.suivante.aria": "Pièce suivante : {forme}",
  "hud.commandes": "Commandes",
  "commande.gauche": "Gauche",
  "commande.droite": "Droite",
  "commande.tourner": "Tourner",
  "commande.descendre": "Descendre vite (maintenir)",
  "fantome.bouton": "Fantôme : {nom}",
  "fantome.aucun": "Aucun",
  "fantome.meilleure": "Ma meilleure",

  "pause.aria": "Pause",
  "pause.titre": "Pause",
  "pause.etat": "Pièce {n} sur {total} · {hauteur}",
  "pause.phrase": "Les pièces retiennent leur souffle.",
  "pause.reprendre": "Reprendre",
  "pause.recommencer": "Recommencer",

  "fin.aria": "Fin de la partie",
  "fin.eyebrow": "TOWER · Suite d'essai",
  "fin.hauteurStable": "Hauteur stable",
  "fin.plusHaute": "Plus haute atteinte : {hauteur} (ne compte pas)",
  "fin.vies": "Vies",
  "fin.partie": "Ta partie",
  "fin.posees": "Pièces posées",
  "fin.tombees": "Pièces tombées",
  "fin.temps": "Temps",
  "fin.rejouer": "Rejouer",
  "fin.phrase.pieces": "Les pièces respirent enfin.",
  "fin.phrase.vies": "Les pièces ne t'en veulent pas. Presque pas.",
};
