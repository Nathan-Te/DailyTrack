// `@cdj/ui` (lot I1 de la plateforme, phase 3) : le socle commun de l'interface hors partie — jetons de la charte « Cartouches »
// (docs/plateforme/identite.md), styles de base, polices hébergées, composants de base (TypeScript et DOM, sans framework), icônes, moteur de
// traduction et formats par langue, catalogue commun (composants, codes d'erreur du serveur). Consignes : packages/ui/CLAUDE.md.
// Feuilles : `@cdj/ui/src/styles.css` (jetons, base, composants) et une feuille par face de polices (`@cdj/ui/src/polices/<famille>-<graisse>[-italique].css`).
export * from "./jetons";
export * from "./contraste";
export * from "./i18n";
export * from "./formats";
export * from "./catalogue";
export * from "./icones";
export * from "./composants";
export { el, svg } from "./dom";
