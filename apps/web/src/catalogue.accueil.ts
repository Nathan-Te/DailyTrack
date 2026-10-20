import type { Catalogues } from "@cdj/ui";

// Catalogue de DailyTrack (lot I4) : l'accueil du jeu, les archives, le classement du jour et le lien vers le profil commun. Clés `accueil.*`. Un fichier par zone (une zone = un responsable à la fois) ; ils sont réunis par
// `catalogue.ts`. Ton (charte § 7) : Track est sec et précis, les chiffres d'abord ; tutoiement en français, « you » direct en anglais, sans
// traduction mot à mot. Parité (mêmes clés, mêmes paramètres, mêmes pluriels, aucune valeur vide) : packages/ui/test/catalogues.test.ts.

const fr = {
  "accueil.titre": "Courir",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "accueil.titre": "Race",
};

export const CATALOGUE_ACCUEIL = { fr, en };
