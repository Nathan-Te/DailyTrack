import { fr } from "./catalogue.course.fr";
import { en } from "./catalogue.course.en";
import { fr as figuresFr } from "./catalogue.course.figures.fr";
import { en as figuresEn } from "./catalogue.course.figures.en";

// La zone « course » en français et en anglais, réunis : pour les tests (parité des catalogues). Le jeu, lui, ne charge que le français au départ (i18n.ts) ;
// lot 49 : la page des nouvelles figures (`catalogue.course.figures.*.ts`) est réunie ici, mais le jeu ne la charge qu'avec les scénarios (`scenarios.ts`).
export const CATALOGUE_COURSE = { fr: { ...fr, ...figuresFr }, en: { ...en, ...figuresEn } };
