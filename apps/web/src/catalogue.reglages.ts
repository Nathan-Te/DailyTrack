import type { Catalogues } from "@cdj/ui";

// Catalogue de DailyTrack (lot I4) : les réglages, l'aide « Comment jouer » et les commandes tactiles. Clés `reglages.*`. Un fichier par zone (une zone = un responsable à la fois) ; ils sont réunis par
// `catalogue.ts`. Ton (charte § 7) : Track est sec et précis, les chiffres d'abord ; tutoiement en français, « you » direct en anglais, sans
// traduction mot à mot. Parité (mêmes clés, mêmes paramètres, mêmes pluriels, aucune valeur vide) : packages/ui/test/catalogues.test.ts.

const fr = {
  "reglages.titre": "Réglages",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "reglages.titre": "Settings",
};

export const CATALOGUE_REGLAGES = { fr, en };
