import type { Catalogue } from "@cdj/ui";
import { CATALOGUE_EN } from "./catalogue.en";
import { CATALOGUE_FR } from "./catalogue.fr";

// Le catalogue de « Rush » dans les deux langues, réunies : pour les tests et l'outil de relecture (parité, clés lues, `npm run traductions`). Le jeu charge le français puis, seulement si besoin, l'anglais.
export const CATALOGUE_RUSH: { fr: Catalogue; en: Catalogue } = { fr: CATALOGUE_FR, en: CATALOGUE_EN };
