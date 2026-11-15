import { THEMES_PINBALL, VARIANTE } from "@cdj/pinball-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Pinball » telle que le client la lit : le sous-ensemble de `config/jeux/pinball.json` dont `brancherJeu` a besoin. **`apps/pinball/test/fiche.test.ts` et `packages/kit/test/fiche.test.ts` vérifient qu'elle dit
// la même chose que la fiche** (les fiches ne se lisent pas à l'exécution : les jeux embarqueraient toutes les fiches).
export const FICHE: FicheClient = {
  id: "pinball",
  nom: "Pinball",
  colonnes: VARIANTE.fiche.colonnes, // la variante (`variante.ts`) est le seul endroit qui sait comment ce jeu se classe
  themes: THEMES_PINBALL,
  prefixe: "pinball:",
  premierJour: "2026-11-02",
  categorie: "arcade",
};
