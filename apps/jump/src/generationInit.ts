import { initialiserGeneration } from "@cdj/profile";
import { gameStorage } from "./storage";
import { readUrlOptions } from "./urlOptions";

// Lot R8 : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit. `main.ts` importe ce module en
// premier (les modules s'évaluent dans l'ordre des imports) : voir `appliquerGeneration` et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ».
try {
  // La démonstration (`?api=demo`) n'écrit rien dans le vrai stockage (tout est sous `demo:`) et ne parle à aucun serveur : pas de génération à noter.
  const demonstration = readUrlOptions(location.search).api === "demo"; // l'adresse ne se lit que dans urlOptions.ts
  const store = demonstration ? null : gameStorage();
  if (store) initialiserGeneration(store);
} catch {
  /* stockage refusé : rien ne s'efface */
}
