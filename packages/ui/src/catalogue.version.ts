import type { Catalogues } from "./i18n";

// Lot D2 : le texte du bandeau « Nouvelle version en ligne — recharger » (`versionPerimee.ts`). **Un catalogue à part, chargé avec le bandeau** (à la demande) : ni le portail ni le premier chargement d'un
// jeu ne le portent. La langue est celle que l'hôte donne au bandeau. Parité : packages/ui/test/catalogues.test.ts.
const fr = {
  "version.perimee": "Nouvelle version en ligne — recharger",
  "version.recharger": "Recharger",
  "version.rechargerAria": "Recharger la page pour passer à la nouvelle version",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "version.perimee": "New version online — reload",
  "version.recharger": "Reload",
  "version.rechargerAria": "Reload the page to switch to the new version",
};

export const CATALOGUE_VERSION = { fr, en };
