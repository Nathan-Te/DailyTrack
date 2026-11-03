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
export * from "./jeux";
// Lot F2 : les amis (client des routes `/api/amis/…`, lien d'invitation, filtre « Tous / Amis » de l'adresse).
export * from "./amis";
export * from "./favoris";
// Lot C1, partie B : l'adresse d'une image d'avatar et le client des routes `/api/avatar…`.
export * from "./avatar";
// Lot 53 : `./retrouver` (« Retrouver mon profil ») n'est volontairement PAS ici : les applications l'importent par son chemin (`@cdj/profile/src/retrouver`) depuis un module chargé à la demande.
// Dans ce fichier, l'empaqueteur le rangerait dans le morceau du profil que le premier chargement d'un jeu télécharge.
