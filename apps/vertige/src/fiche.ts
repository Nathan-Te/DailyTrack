import { VARIANTE } from "@cdj/vertige-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Vertige » telle que le client la lit : le sous-ensemble de `config/jeux/vertige.json` dont `brancherJeu` a besoin. **`packages/kit/test/fiche.test.ts` vérifie qu'elle dit la même chose que la fiche** (les fiches ne se lisent
// pas à l'exécution : les jeux embarqueraient toutes les fiches).
export const FICHE: FicheClient = {
  id: "vertige",
  nom: "Vertige",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: ["clair", "sombre"],
  prefixe: "vertige:",
  premierJour: "2026-11-02",
  categorie: "arcade",
};
