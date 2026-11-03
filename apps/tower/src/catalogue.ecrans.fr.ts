import { CATALOGUE_FR } from "./catalogue.fr";

// Les textes français que seuls les écrans À LA DEMANDE lisent (lot T7 : « Comment jouer », Réglages, Archives et l'écran des commandes) : à part de `catalogue.jeu.fr.ts`, que le jeu embarque,
// pour que le jeu ne grossisse pas de ce que la partie ne lit pas. Chacun de ces écrans les ajoute au catalogue français en se chargeant (`installerCataloguesDesEcrans`) ; l'anglais
// (`catalogue.en.ts`, à la demande) les a déjà. Les tests et `npm run traductions` voient le tout réuni (`catalogue.ts`).
export const CATALOGUE_ECRANS_FR = {
  "aide.pause": "Pause",
  "aide.manette": "À la manette : le stick ou la croix déplacent, {m_tourner} tourne, {m_descendre} descend, {m_taquetGauche} et {m_taquetDroite} lancent le taquet, Start met en pause.",
  "aide.taquet": "Taquet",
  "aide.taquet.note": "Le taquet est un coup de côté donné à la pièce que tu tiens, avant de la poser : elle avance d'un mètre et demi d'un coup, exactement là où tu la pousses, sans aucun recalage. Si elle percute un bloc, elle t'échappe : tu ne la contrôles plus, elle tombe en poussant le bloc de toute sa force — de quoi faire tomber une pièce mal placée. Quand la pièce touche un appui, tu la gardes en main un quart de seconde (sauf si tu tiens « descendre ») : de quoi la glisser d'un taquet dans une fente à sa mesure.",
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
  "reglages.vibration": "Vibration",
  "reglages.vibration.aide": "Une courte vibration du téléphone quand un taquet percute un bloc. Sans effet sur ordinateur.",
  "reglages.niveau.normal": "Normal",
  "reglages.niveau.reduit": "Réduit",
  "reglages.niveau.aucun": "Aucun",
  "reglages.oui": "Oui",
  "reglages.non": "Non",
  "reglages.profil": "Mon profil Du Jour ›",
  "reglages.mentions": "Mentions légales ›",
  "reglages.retours": "Un bug ? Une idée ? ›",

  "commandes.action.gauche": "Aller à gauche",
  "commandes.action.droite": "Aller à droite",
  "commandes.action.tourner": "Tourner",
  "commandes.action.descendre": "Descendre vite",
  "commandes.action.recommencer": "Recommencer",
  "commandes.action.pause": "Pause",
  "commandes.action.fantome": "Fantôme",
  "commandes.action.taquetGauche": "Taquet à gauche",
  "commandes.action.taquetDroite": "Taquet à droite",
  "commandes.manette.deplacer": "Déplacer",
  "commandes.manette.descendre": "Descendre vite",
  "commandes.fixe.stick": "Stick ou croix",
  "commandes.fixe.stickBas": "Bas du stick ou de la croix",
  "commandes.tactile": "Six boutons à l'écran suffisent : gauche, droite, tourner et descendre (maintiens-le pour accélérer la chute), plus les deux petits boutons du taquet au-dessus de gauche et de droite (un coup vers le côté, avant la pose).",

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
