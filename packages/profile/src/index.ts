// `@cdj/profile` (lot P0 de la plateforme) : le profil commun à tous les jeux, côté client — identité (identifiant secret, pseudo), code de
// transfert `CDJ2`, rotation et révocation du code, synchronisation avec le serveur (le meilleur gagne), vérification et suggestions de pseudo.
// Aucune logique de jeu, aucun accès direct au stockage ni au réseau (injectés). Consignes : packages/profile/CLAUDE.md.
export * from "./identity";
export * from "./transfer";
export * from "./client";
export * from "./sync";
export * from "./profile";
export * from "./langue";
export * from "./jeuSuivant";
export * from "./apiAdresse";
export * from "./generation";
export * from "./annonce";
// Lot 53 : `./retrouver` (« Retrouver mon profil ») n'est volontairement PAS ici : les applications l'importent par son chemin (`@cdj/profile/src/retrouver`) depuis un module chargé à la demande.
// Dans ce fichier, l'empaqueteur le rangerait dans le morceau du profil que le premier chargement d'un jeu télécharge.
