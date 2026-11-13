import { VARIANTE } from "@cdj/gravity-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Gravity » telle que le client la lit : le sous-ensemble de `config/jeux/gravity.json` dont `brancherJeu` a besoin. **`packages/kit/test/fiche.test.ts` vérifie qu'elle dit la même chose que la fiche** (les fiches ne se lisent
// pas à l'exécution : les trois jeux embarqueraient les trois fiches).
export const FICHE: FicheClient = {
  id: "gravity",
  nom: "Gravity",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: ["clair", "sombre"],
  prefixe: "gravity:",
  premierJour: "2026-11-02",
};
