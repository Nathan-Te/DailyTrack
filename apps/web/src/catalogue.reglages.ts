import { fr } from "./catalogue.reglages.fr";
import { en } from "./catalogue.reglages.en";
import { en as gyroEn, fr as gyroFr } from "./catalogue.reglages.gyroscope";
import { en as commandesEn, fr as commandesFr } from "./catalogue.reglages.commandes";
import { en as glissiereEn, fr as glissiereFr } from "./catalogue.reglages.glissiere";
import { en as volantEn, fr as volantFr } from "./catalogue.reglages.volant";

// La zone « reglages » en français et en anglais, réunis : pour les tests (parité des catalogues). Le jeu, lui, ne charge que le français au départ (i18n.ts).
// Lot 52 : les textes de la glissière, du volant et du gyroscope (`catalogue.reglages.<mode>.ts`) sont réunis ici, mais le jeu ne les charge qu'avec le mode (`ajouterTextes`).
export const CATALOGUE_REGLAGES = { fr: { ...fr, ...commandesFr, ...glissiereFr, ...volantFr, ...gyroFr }, en: { ...en, ...commandesEn, ...glissiereEn, ...volantEn, ...gyroEn } };
