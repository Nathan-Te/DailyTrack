// `@cdj/musique` : la musique commune de Du Jour (Track, Jump, Tower, portail). Consignes : packages/musique/CLAUDE.md ; procédure d'ajout d'un morceau : docs/plateforme/musique.md.
// **Un jeu importe `@cdj/musique/branche`, jamais ce fichier** (il tirerait la logique et le lecteur dans le premier chargement). Cet index sert à Node (la commande
// `npm run musique`) et aux tests.
export * from "./types";
export * from "./description";
export * from "./scenes";
export * from "./liste";
export * from "./logique";
export * from "./lecteur";
export * from "./branche";
