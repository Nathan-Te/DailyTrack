import type { Catalogues } from "@cdj/ui";

// Catalogue de DailyTrack (lot I4) : le Salon (salle d'attente, course, finale, résultats), le podium et « Revoir le meilleur tour ». Clés `salon.*`. Un fichier par zone (une zone = un responsable à la fois) ; ils sont réunis par
// `catalogue.ts`. Ton (charte § 7) : Track est sec et précis, les chiffres d'abord ; tutoiement en français, « you » direct en anglais, sans
// traduction mot à mot. Parité (mêmes clés, mêmes paramètres, mêmes pluriels, aucune valeur vide) : packages/ui/test/catalogues.test.ts.

const fr = {
  "salon.titre": "Salon",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "salon.titre": "Room",
};

export const CATALOGUE_SALON = { fr, en };
