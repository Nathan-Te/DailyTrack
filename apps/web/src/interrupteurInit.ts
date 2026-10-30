import { apiBase } from "./api";
import { gameStorage } from "./storage";

// Lot P — l'interrupteur des jeux, côté Track. `main.ts` importe ce module juste après `generationInit` : il ne lance que la lecture de l'état des jeux (`interrupteur.ts`, **à la demande** : un
// fichier à part, hors du premier chargement). Un jeu `on` (le cas de tous) ne l'attend pas ; un lien d'aperçu (`?apercu=`) ou une clé d'aperçu déjà gardée est attendu (top-level await) : la clé
// part dans l'en-tête `X-Preview-Key` avant le premier appel à l'API.
try {
  const base = apiBase();
  if (base && base !== "demo") {
    const l = import("./interrupteur").then((m) => m.demarrer(base));
    if (/apercu=/.test(location.search) || gameStorage().getItem("cdj:apercu:track")) await l;
  }
} catch {
  /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
}
