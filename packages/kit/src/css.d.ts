// Lot « écrans du kit » : les modules à la demande de `brancherJeu` importent leur feuille (`jeu/ecrans.css`, chargée avec la partie) ; l'empaqueteur des jeux la traite, TypeScript n'a qu'à la connaître.
declare module "*.css";
