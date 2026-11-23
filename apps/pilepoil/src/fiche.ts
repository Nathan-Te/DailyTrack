import { COLONNES_CLASSEMENT } from "@cdj/pilepoil-sim";
import type { FicheClient } from "@cdj/kit/jeu/types";

// La fiche de « Pile poil » telle que le client la lit : le sous-ensemble de `config/jeux/pilepoil.json` dont `brancherJeu` a besoin. **`packages/kit/test/fiche.test.ts` vérifie qu'elle dit la même chose que la fiche** (les fiches ne se lisent
// pas à l'exécution : les trois jeux embarqueraient les trois fiches).
export const FICHE: FicheClient = {
  id: "pilepoil",
  nom: "Pile poil",
  colonnes: COLONNES_CLASSEMENT, // le score, puis les « pile » (`classement.ts` de la simulation)
  themes: [], // lot PA1 : un jeu Party n'a pas de thème
  categorie: "party",
  prefixe: "pilepoil:",
  premierJour: "2026-11-02",
};
