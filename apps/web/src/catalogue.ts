import type { Catalogue } from "@cdj/ui";
import { CATALOGUE_ACCUEIL } from "./catalogue.accueil";
import { CATALOGUE_BASE } from "./catalogue.base";
import { CATALOGUE_COURSE } from "./catalogue.course";
import { CATALOGUE_REGLAGES } from "./catalogue.reglages";
import { CATALOGUE_SALON } from "./catalogue.salon";

// Le catalogue de DailyTrack (lot I4) : les catalogues par zone, réunis. Les textes des composants du socle, les noms des jeux et les codes
// d'erreur du serveur sont dans le catalogue commun de `@cdj/ui` (`i18n.ts` les ajoute après celui-ci). Une clé n'est définie qu'une fois
// (packages/ui/test/catalogues.test.ts : aucune clé dans deux catalogues).
const ZONES = [CATALOGUE_BASE, CATALOGUE_ACCUEIL, CATALOGUE_COURSE, CATALOGUE_REGLAGES, CATALOGUE_SALON] as const;

export const CATALOGUE_TRACK: { fr: Catalogue; en: Catalogue } = {
  fr: Object.assign({}, ...ZONES.map((z) => z.fr)),
  en: Object.assign({}, ...ZONES.map((z) => z.en)),
};
