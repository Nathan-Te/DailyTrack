import { noterGeneration } from "@cdj/kit/branche";
import { readUrlOptions } from "./urlOptions";

// Lot R8 : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit (lot K3 : `noterGeneration` de `@cdj/kit/branche`, sur le stockage du jeu). `main.ts` importe
// ce module en premier (les modules s'évaluent dans l'ordre des imports) : voir `appliquerGeneration` et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ». La démonstration (`?api=demo`) n'écrit rien
// dans le vrai stockage (tout est sous `demo:`) et ne parle à aucun serveur : pas de génération à noter. L'adresse ne se lit que dans urlOptions.ts.
noterGeneration(() => readUrlOptions(location.search).api === "demo");
