import { en } from "./catalogue.base.en";
import { fr } from "./catalogue.base.fr";

// La zone « base » en français et en anglais, réunis : pour les tests (parité des catalogues). Le jeu, lui, ne charge que le français au départ (i18n.ts).
export const CATALOGUE_BASE = { fr, en };
