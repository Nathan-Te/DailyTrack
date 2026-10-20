// `@cdj/profile` (lot P0 de la plateforme) : le profil commun à tous les jeux, côté client — identité (identifiant secret, pseudo), code de
// transfert `CDJ2`, rotation et révocation du code, synchronisation avec le serveur (le meilleur gagne), vérification et suggestions de pseudo.
// Aucune logique de jeu, aucun accès direct au stockage ni au réseau (injectés). Consignes : packages/profile/CLAUDE.md.
export * from "./identity";
export * from "./transfer";
export * from "./client";
export * from "./sync";
export * from "./profile";
