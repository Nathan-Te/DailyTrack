import { CATALOGUE_FR } from "./catalogue.fr";

// Les textes français que seuls les écrans À LA DEMANDE lisent (lot T7 : « Comment jouer », Réglages, Archives et l'écran des commandes) : à part de `catalogue.jeu.fr.ts`, que le jeu embarque,
// pour que le jeu ne grossisse pas de ce que la partie ne lit pas. Chacun de ces écrans les ajoute au catalogue français en se chargeant (`installerCataloguesDesEcrans`) ; l'anglais
// (`catalogue.en.ts`, à la demande) les a déjà. Les tests et `npm run traductions` voient le tout réuni (`catalogue.ts`).
export const CATALOGUE_ECRANS_FR = {
  "aide.pause": "Pause",
  "aide.manette": "À la manette : le stick ou la croix déplacent, {m_tourner} tourne, {m_descendre} descend, Start met en pause.",
  "aide.reglables": "Les touches se changent dans Réglages › Commandes.",

  "ecran.retour": "Retour à Tower",
  "reglages.aria": "Réglages",
  "reglages.titre": "Réglages",
  "reglages.son": "Son",
  "reglages.affichage": "Affichage",
  "reglages.commandes": "Commandes",
  "reglages.fantome": "Fantôme au départ",
  "reglages.fantome.aide": "Le fantôme posé quand une partie commence. Le Diamant se choisit en jeu, au bouton, une fois classé.",
  "reglages.secousses": "Secousses de l'écran",
  "reglages.secousses.aide": "Quand une pièce tombe. Elles sont déjà coupées si ton système demande moins d'animations.",
  "reglages.yeux": "Panique des yeux",
  "reglages.yeux.aide": "Les yeux des pièces s'écarquillent et tremblent quand la tour vacille.",
  "reglages.visee": "Visée",
  "reglages.visee.aide": "La grille et la ligne de chute qui aident à poser la pièce.",
  "reglages.niveau.normal": "Normal",
  "reglages.niveau.reduit": "Réduit",
  "reglages.niveau.aucun": "Aucun",
  "reglages.oui": "Oui",
  "reglages.non": "Non",
  "reglages.profil": "Mon profil Du Jour ›",
  "reglages.mentions": "Mentions légales ›",

  "commandes.action.gauche": "Aller à gauche",
  "commandes.action.droite": "Aller à droite",
  "commandes.action.tourner": "Tourner",
  "commandes.action.descendre": "Descendre vite",
  "commandes.action.recommencer": "Recommencer",
  "commandes.action.pause": "Pause",
  "commandes.action.fantome": "Fantôme",
  "commandes.manette.deplacer": "Déplacer",
  "commandes.manette.descendre": "Descendre vite",
  "commandes.fixe.stick": "Stick ou croix",
  "commandes.fixe.stickBas": "Bas du stick ou de la croix",
  "commandes.tactile": "Quatre boutons à l'écran suffisent : gauche, droite, tourner et descendre (maintiens-le pour accélérer la chute).",

  "archives.aria": "Archives",
  "archives.titre": "Archives",
  "archives.intro": "Rejoue une tour passée. Une partie d'archive n'est jamais classée.",
  "archives.vide": "Aucune tour passée pour l'instant.",
  "archives.pasJoue": "Pas jouée",
  "archives.tour": "Tour n° {numero}",
  "archives.sousTitre": "{date} · {theme}",
};

/** Ajoute les textes de ces écrans au catalogue français (le traducteur lit ce même objet : rien à reconstruire). */
export function installerCataloguesDesEcrans(): void {
  Object.assign(CATALOGUE_FR, CATALOGUE_ECRANS_FR);
}
