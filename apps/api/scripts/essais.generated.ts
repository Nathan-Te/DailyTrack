// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → serveur) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
import type { ModuleEssais } from "./essais";
import { ESSAIS_CIBLES } from "./cibles-essais";
import { ESSAIS_BLOCKS } from "./blocks-essais";

// Le code (`id` de la fiche) → son module d'essais.
export const ESSAIS_DES_JEUX_NEUFS: Readonly<Record<string, ModuleEssais>> = {
  "cibles": ESSAIS_CIBLES,
  "blocks": ESSAIS_BLOCKS,
};
