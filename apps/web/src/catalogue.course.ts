import { fr } from "./catalogue.course.fr";
import { en } from "./catalogue.course.en";
import { fr as figuresFr } from "./catalogue.course.figures.fr";
import { en as figuresEn } from "./catalogue.course.figures.en";
import { fr as fantomesFr } from "./catalogue.course.fantomes.fr";
import { en as fantomesEn } from "./catalogue.course.fantomes.en";

// La zone « course » en français et en anglais, réunis : pour les tests (parité des catalogues). Le jeu, lui, ne charge que le français au départ (i18n.ts) ;
// lot 49 : la page des nouvelles figures (`catalogue.course.figures.*.ts`) est réunie ici, mais le jeu ne la charge qu'avec les scénarios (`scenarios.ts`) ; lot 55 : les textes du choix des fantômes (`catalogue.course.fantomes.*.ts`) viennent avec lui (`fantomesJeu.ts`).
export const CATALOGUE_COURSE = { fr: { ...fr, ...figuresFr, ...fantomesFr }, en: { ...en, ...figuresEn, ...fantomesEn } };
