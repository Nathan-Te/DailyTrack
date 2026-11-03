import { brancherInterrupteur } from "@cdj/kit/branche";
import { baseApi } from "./apiTower";
import { BUILD_API_URL } from "./stockage";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Lot P (branché à Tower par le lot TP ; lot K3 : le branchement est `@cdj/kit/branche`) — l'interrupteur des jeux, côté Tower. `main.ts` importe ce module juste après `generationInit` : il ne lance que la
// lecture de l'état des jeux (**à la demande** : il ne pèse rien dans le premier chargement). Un jeu `on` ne l'attend pas ; un lien d'aperçu (`?apercu=`) ou une clé d'aperçu déjà gardée est attendu
// (`pret`) : la clé part dans l'en-tête `X-Preview-Key` avant le premier appel à l'API. Tower naît `off` : « Bientôt » sans clé.
/** Résolue quand le jeu peut appeler le serveur : tout de suite, sauf avec une clé d'aperçu (la clé doit être portée par l'en-tête avant le premier appel). Ne rejette jamais. */
export const pret: Promise<void> = (async () => {
  try {
    const options = lireOptions(location.search, PRODUCTION);
    const base = baseApi(options.api, BUILD_API_URL, location.origin, PRODUCTION);
    if (base) await brancherInterrupteur("tower", "Tower", base, !!options.apercu);
  } catch {
    /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
  }
})();
