import type { Catalogue } from "@cdj/ui";
import { CATALOGUE_EN } from "./catalogue.en";
import { CATALOGUE_FR } from "./catalogue.fr";
import { CATALOGUE_JEU_FR } from "./catalogue.jeu.fr";

// Le catalogue de Tower dans les deux langues, réunies : **pour les tests et l'outil de relecture** (parité, clés lues, `npm run traductions`). Le jeu ne passe pas par là :
// il charge le français et, seulement si besoin, l'anglais (i18n.ts).
export const CATALOGUE_TOWER: { fr: Catalogue; en: Catalogue } = { fr: { ...CATALOGUE_FR, ...CATALOGUE_JEU_FR }, en: CATALOGUE_EN };
