import type { ThemePinball } from "@cdj/pinball-sim";
import { ESPACE } from "./espace";
import { FOIRE } from "./foire";
import { OCEAN } from "./ocean";
import type { ModelesDuTheme } from "./types";
import { VOLCAN } from "./volcan";

// Lot PBV4 : les modèles des modules communs, un fichier par thème. **Ajouter un thème** : un fichier `<theme>.ts` (ses quatre modèles en volume et à plat, ses lumières) et sa ligne ici ; ses noms dans les catalogues
// (`module.<type>.<theme>`). `test/modeles.test.ts` refuse un thème sans ses quatre modèles et un modèle qui sort de l'emprise de collision de son module.
export const MODELES: Readonly<Record<ThemePinball, ModelesDuTheme>> = { foire: FOIRE, ocean: OCEAN, espace: ESPACE, volcan: VOLCAN };
