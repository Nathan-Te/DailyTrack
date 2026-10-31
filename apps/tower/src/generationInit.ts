import { initialiserGeneration } from "@cdj/profile";
import { gameStorage } from "./stockage";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Lot R8 (branché à Tower par le lot TP) : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit. `main.ts` importe ce module en
// premier (les modules s'évaluent dans l'ordre des imports) : voir `appliquerGeneration` (`accueil.ts`, lecture du classement et de `me`) et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ».
try {
  const store = gameStorage();
  if (store && lireOptions(location.search, PRODUCTION).api !== "demo") initialiserGeneration(store);
} catch {
  /* stockage refusé : rien ne s'efface */
}
