import { apiBase } from "./api";
import { gameStorage } from "./storage";

// Lot C1 : le seul `import()` du dialogue « Un bug ? Une idée ? » dans le premier chargement (la pause et Réglages l'appellent) : un appel d'`import()` coûte son lot de dépendances à précharger,
// donc un seul endroit. Tout le reste est à la demande (`retoursJeu.ts`).
export const ouvrirRetours = (): void => void import("./retoursJeu").then((m) => m.ouvrir(apiBase(), gameStorage()));
