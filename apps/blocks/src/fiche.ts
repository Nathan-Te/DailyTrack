import { THEMES_BLOCKS, VARIANTE } from "@cdj/blocks-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Blocks » telle que le client la lit : le sous-ensemble de `config/jeux/blocks.json` dont `brancherJeu` a besoin. **`packages/kit/test/fiche.test.ts` vérifie qu'elle dit la même chose que la fiche** (les fiches ne se lisent
// pas à l'exécution : les trois jeux embarqueraient les trois fiches).
export const FICHE: FicheClient = {
  id: "blocks",
  nom: "Blocks",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: [...THEMES_BLOCKS], // les six thèmes de Tower, tirés par le sac commun (`@cdj/blocks-sim`, lot B3)
  prefixe: "blocks:",
  premierJour: "2026-11-02",
};
