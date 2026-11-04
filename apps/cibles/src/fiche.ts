import { VARIANTE } from "@cdj/cibles-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Cibles » telle que le client la lit : le sous-ensemble de `config/jeux/cibles.json` dont `brancherJeu` a besoin. **`packages/kit/test/fiche.test.ts` vérifie qu'elle dit la même chose que la fiche** (les fiches ne se lisent
// pas à l'exécution : les trois jeux embarqueraient les trois fiches).
export const FICHE: FicheClient = {
  id: "cibles",
  nom: "Cibles",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: ["sable", "ardoise"],
  prefixe: "cibles:",
  premierJour: "2026-11-02",
};
