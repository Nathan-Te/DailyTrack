import { fr } from "./catalogue.base.fr";
import { en } from "./catalogue.base.en";
import { fr as garageFr } from "./catalogue.base.garage.fr";
import { en as garageEn } from "./catalogue.base.garage.en";

// La zone « base » en français et en anglais, réunis : pour les tests (parité des catalogues) et le relevé des traductions. Le jeu, lui, ne charge que le français au
// départ (i18n.ts) ; lot 41 : le Garage (`catalogue.base.garage.*.ts`) est réuni ici, mais le jeu ne le charge qu'avec le Garage (`garage.ts`, `ajouterTextes`).
export const CATALOGUE_BASE = { fr: { ...fr, ...garageFr }, en: { ...en, ...garageEn } };
