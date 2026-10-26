import { initialiserGeneration } from "@cdj/profile";
import { stockageDuPortail } from "./stockage";

// Lot R8 : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le portail (ou l'un de ses modules) écrive quoi que ce soit.
// `portail.ts` importe ce module en premier. Voir `appliquerGeneration` et `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ».
const stockage = stockageDuPortail();
if (stockage) initialiserGeneration(stockage);
