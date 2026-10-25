import { initialiserGeneration } from "@cdj/profile";
import { gameStorage } from "./storage";

// Lot R8 : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit. `main.ts` importe ce module en
// premier (les modules s'évaluent dans l'ordre des imports) : voir `appliquerGeneration` et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ».
try {
  const store = gameStorage();
  if (store) initialiserGeneration(store);
} catch {
  /* stockage refusé : rien ne s'efface */
}
