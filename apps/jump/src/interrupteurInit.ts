import { brancherInterrupteur } from "@cdj/kit/branche";
import { rankApiBase } from "./rankApi";
import { BUILD_API_URL, BUILD_RESTRICTED } from "./storage";
import { readUrlOptions } from "./urlOptions";

// Lot P — l'interrupteur des jeux, côté Jump (lot K3 : le branchement est `@cdj/kit/branche`). `main.ts` importe ce module juste après `generationInit` : il ne lance que la lecture de l'état des jeux
// (**à la demande**). Un jeu `on` (le cas de tous) ne l'attend pas ; un lien d'aperçu (`?apercu=`) ou une clé d'aperçu déjà gardée est attendu (top-level await) : la clé part dans l'en-tête
// `X-Preview-Key` avant le premier appel à l'API.
try {
  const options = readUrlOptions(location.search, BUILD_RESTRICTED);
  const base = rankApiBase(options.api, BUILD_API_URL, location.origin, BUILD_RESTRICTED);
  if (base && base !== "demo") await brancherInterrupteur("jump", "Jump", base, !!options.apercu);
} catch {
  /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
}
