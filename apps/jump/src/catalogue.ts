import { CATALOGUE_EN } from "./catalogue.en";
import { CATALOGUE_FR } from "./catalogue.fr";

// Le catalogue de Jump dans les deux langues, réunies : **pour les tests** (parité, clés appelées par le code). Le jeu ne passe pas par là : il charge le français
// (`catalogue.fr.ts`) et, seulement si besoin, l'anglais (`catalogue.en.ts`), pour que l'anglais ne pèse pas sur le premier chargement (i18n.ts).
export const CATALOGUE_JUMP = { fr: CATALOGUE_FR, en: CATALOGUE_EN };
