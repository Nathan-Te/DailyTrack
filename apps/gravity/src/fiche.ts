import { VARIANTE, THEMES_GRAVITY } from "@cdj/gravity-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Gravity » telle que le client la lit : le sous-ensemble de `config/jeux/gravity.json` dont `brancherJeu` a besoin. **`apps/gravity/test/fiche.test.ts` et `packages/kit/test/fiche.test.ts` vérifient qu'elle dit la
// même chose que la fiche** (les fiches ne se lisent pas à l'exécution : les jeux embarqueraient toutes les fiches).
export const FICHE: FicheClient = {
  id: "gravity",
  nom: "Gravity",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: THEMES_GRAVITY,
  prefixe: "gravity:",
  premierJour: "2026-11-02",
  categorie: "arcade",
};
