import type { Catalogues } from "@cdj/ui";

// Catalogue de DailyTrack (lot I4) : la course (surimpressions), la pause, l'arrivée, le partage et les messages. Clés `course.*`. Un fichier par zone (une zone = un responsable à la fois) ; ils sont réunis par
// `catalogue.ts`. Ton (charte § 7) : Track est sec et précis, les chiffres d'abord ; tutoiement en français, « you » direct en anglais, sans
// traduction mot à mot. Parité (mêmes clés, mêmes paramètres, mêmes pluriels, aucune valeur vide) : packages/ui/test/catalogues.test.ts.

const fr = {
  "course.titre": "Courir",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "course.titre": "Race",
};

export const CATALOGUE_COURSE = { fr, en };
