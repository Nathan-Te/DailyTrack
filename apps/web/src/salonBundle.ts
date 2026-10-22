// Le Salon et le mode spectateur, chargés à la demande (lot 36) : `main.ts` ne les importe que par `import("./salonBundle")`, quand l'adresse demande le Salon
// (`?mode=salon`) ou « revoir le meilleur tour » (`?watch=best`). Un joueur du circuit du jour ne les télécharge pas. Le Salon est toujours un chargement de page
// (l'accueil y mène par `modeHref`) : le morceau est chargé avant le premier écran du mode, jamais au milieu d'une course.
export { SalonController, bootSalon, isBootError } from "./salonMode";
export type { SalonHost, SalonRunResult } from "./salonMode";
export { GhostField, createNameLabel } from "./salonGhosts";
export type { GhostEntry, NameLabel } from "./salonGhosts";
export { showSalonArrival, showSessionOver, showWatchArrival } from "./salonArrivee";
export { GHOST_COLORS, MY_GHOST_COLOR, salonShareLine } from "./salon";
export { mountWatchUi } from "./watchUi";
export type { WatchUi } from "./watchUi";
