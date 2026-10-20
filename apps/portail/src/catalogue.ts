import type { Catalogues } from "@cdj/ui";

// Le catalogue du portail (lot I1) : français et anglais, clés `portail.*`. Les textes des composants (barre, langue, médailles) et les noms
// des jeux sont dans le catalogue commun de `@cdj/ui`. Ton (charte § 7) : Du Jour est chaleureux, simple, court ; tutoiement en français.
// Parité (mêmes clés, mêmes paramètres, aucune valeur vide) : packages/ui/test/catalogues.test.ts.

const fr = {
  "portail.titre": "Du Jour",
  "portail.description": "Du Jour : un jeu par jour, le même pour tous. Track et Jump.",
  "portail.jeux.titre": "Les jeux du jour",
  "portail.track.accroche": "Un circuit par jour, le même pour tous.",
  "portail.jump.accroche": "Un niveau de plateforme par jour, le même pour tous.",
  "portail.jouer": "Jouer",
  "portail.jouer.aria": "Jouer à {jeu}",
  "portail.pied": "Nouveau jour à minuit, heure de Paris. Ton profil est le même dans tous les jeux.",
  "portail.mentions": "Mentions légales et confidentialité",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "portail.titre": "Du Jour",
  "portail.description": "Du Jour: one game a day, the same for everyone. Track and Jump.",
  "portail.jeux.titre": "Today's games",
  "portail.track.accroche": "One track a day, the same for everyone.",
  "portail.jump.accroche": "One platform level a day, the same for everyone.",
  "portail.jouer": "Play",
  "portail.jouer.aria": "Play {jeu}",
  "portail.pied": "A new day at midnight, Paris time. Your profile is the same in every game.",
  "portail.mentions": "Legal notice and privacy (in French)",
} as const;

export const CATALOGUE_PORTAIL = { fr, en } as const;
