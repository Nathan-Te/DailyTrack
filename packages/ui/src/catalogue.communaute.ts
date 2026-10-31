import type { Catalogues } from "./i18n";

// Lot S1 (plateforme) : les noms lus des boutons Discord et Ko-fi de l'accueil des jeux (`liensCommunauteJeu.ts`). **Un catalogue à part, chargé à la demande avec le groupe** : les clés ne pèsent ni dans le catalogue
// commun du portail ni dans le premier chargement d'un jeu. La langue est celle de la page (`<html lang>`). Parité : packages/ui/test/catalogues.test.ts.
const fr = {
  "communaute.groupe": "Communauté",
  "communaute.discord": "Rejoindre le Discord",
  "communaute.kofi": "Soutenir sur Ko-fi",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "communaute.groupe": "Community",
  "communaute.discord": "Join the Discord",
  "communaute.kofi": "Support on Ko-fi",
};

export const CATALOGUE_COMMUNAUTE = { fr, en };
