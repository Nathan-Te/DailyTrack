import { unpackCatalog } from "../modules";
import { registerLegacyCatalog } from "../legacyRegistry";
import { LEGACY_PACKED } from "./catalogue";
import { LEGACY_ALT_B_REFUSED, LEGACY_PARASITE_CLOSED, LEGACY_PHASE_REFUSED } from "./refuses";

// Lot 30 : charge le catalogue d'avant le maintien minimal du saut (voir `legacyRegistry.ts`). Tests et outils seulement : le jeu ne l'importe pas, il n'est donc pas dans ses paquets.
// Idempotent. Ne fait partie ni de `index.ts` ni du premier chargement.
let loaded = false;
export function useLegacyCatalog(): void {
  if (loaded) return;
  registerLegacyCatalog({ solutions: unpackCatalog(LEGACY_PACKED), phaseRefused: LEGACY_PHASE_REFUSED, altBRefused: LEGACY_ALT_B_REFUSED, parasiteClosed: LEGACY_PARASITE_CLOSED });
  loaded = true;
}
