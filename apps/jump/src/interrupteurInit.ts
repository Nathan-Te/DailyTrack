import { rankApiBase } from "./rankApi";
import { BUILD_API_URL, BUILD_RESTRICTED, gameStorage } from "./storage";
import { readUrlOptions } from "./urlOptions";

// Lot P — l'interrupteur des jeux, côté Jump. `main.ts` importe ce module juste après `generationInit` : il ne lance que la lecture de l'état des jeux (`interrupteur.ts`, **à la demande**). Un jeu
// `on` (le cas de tous) ne l'attend pas ; un lien d'aperçu (`?apercu=`) ou une clé d'aperçu déjà gardée est attendu (top-level await) : la clé part dans l'en-tête `X-Preview-Key` avant le premier appel à l'API.
try {
  const options = readUrlOptions(location.search, BUILD_RESTRICTED);
  const base = rankApiBase(options.api, BUILD_API_URL, location.origin, BUILD_RESTRICTED);
  if (base && base !== "demo") {
    const l = import("./interrupteur").then((m) => m.demarrer(base));
    if (options.apercu || gameStorage()?.getItem("cdj:apercu:jump")) await l;
  }
} catch {
  /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
}
