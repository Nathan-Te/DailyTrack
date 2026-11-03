import { noterGeneration } from "@cdj/kit/branche";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Lot R8 (branché à Tower par le lot TP ; lot K3 : `noterGeneration` de `@cdj/kit/branche`) : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit. `main.ts`
// importe ce module en premier (les modules s'évaluent dans l'ordre des imports) : voir `appliquerGeneration` (`accueil.ts`, lecture du classement et de `me`) et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ».
noterGeneration(() => lireOptions(location.search, PRODUCTION).api === "demo");
