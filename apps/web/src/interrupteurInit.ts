import { brancherInterrupteur } from "@cdj/kit/branche";
import { apiBase } from "./api";

// Lot P — l'interrupteur des jeux, côté Track (lot K3 : le branchement est `@cdj/kit/branche`). `main.ts` importe ce module juste après `generationInit` : il ne lance que la lecture de l'état des jeux
// (**à la demande** : un fichier à part, hors du premier chargement). Un jeu `on` (le cas de tous) ne l'attend pas ; un lien d'aperçu (`?apercu=`) ou une clé d'aperçu déjà gardée est attendu (top-level await) :
// la clé part dans l'en-tête `X-Preview-Key` avant le premier appel à l'API.
try {
  const base = apiBase();
  if (base && base !== "demo") await brancherInterrupteur("track", "Track", base, /apercu=/.test(location.search));
} catch {
  /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
}
