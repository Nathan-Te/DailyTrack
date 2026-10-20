import type { Catalogues } from "@cdj/ui";

// Lot I2 : les textes du lien `/?demo=joueur` (recette et aperçus seulement). Catalogue à part : importé par `demo.ts` seulement, il n'entre
// jamais dans la construction de production (test `construction.test.ts`). Parité : packages/ui/test/catalogues.test.ts.

const fr = {
  "demo.titre": "Joueur de démonstration",
  "demo.texte": "Ce lien installe sur cet appareil le joueur « {nom} » de la recette, pour voir le portail plein. Il remplacera le profil de cet appareil ({actuel}), dans tous les jeux.",
  "demo.installer": "Installer le joueur de démonstration",
  "demo.annuler": "Garder mon profil",
  "demo.installe": "Joueur de démonstration installé : {nom}.",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "demo.titre": "Demo player",
  "demo.texte": "This link installs the test server's player \"{nom}\" on this device, to see the portal full. It will replace this device's profile ({actuel}), in every game.",
  "demo.installer": "Install the demo player",
  "demo.annuler": "Keep my profile",
  "demo.installe": "Demo player installed: {nom}.",
} as const;

export const CATALOGUE_DEMO = { fr, en } as const;
