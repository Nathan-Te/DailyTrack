import type { Catalogue } from "@cdj/ui";
import { en as accueil } from "./catalogue.accueil.en";
import { en as base } from "./catalogue.base.en";
import { en as course } from "./catalogue.course.en";
import { en as reglages } from "./catalogue.reglages.en";
import { en as salon } from "./catalogue.salon.en";

// L'anglais de DailyTrack (lot I4), toutes zones réunies : un module à part, chargé par `import()` seulement quand la langue du joueur est l'anglais (i18n.ts).
export const CATALOGUE_EN: Catalogue = Object.assign({}, base, accueil, course, reglages, salon);
