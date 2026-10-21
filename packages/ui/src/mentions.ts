import type { Langue } from "./i18n";

// Lot I6 (plateforme) : les mentions légales existent dans les deux langues, deux pages statiques du portail (sans script) : la française
// (`/mentions-legales/`) fait foi, l'anglaise (`/legal/`) en est la traduction fidèle. Tout lien « Mentions légales » (pied du portail, pause et
// réglages des jeux) ouvre celle de la langue choisie : son adresse vient d'ici, jamais d'un chemin écrit dans l'application.

/** La page des mentions de chaque langue, relative à la racine du site. */
export const PAGES_MENTIONS = { fr: "mentions-legales/", en: "legal/" } as const satisfies Record<Langue, string>;

/** L'adresse des mentions dans la langue `langue`, relative à la page (`racine` : `""` à la racine du site, `"../"` dans un jeu ou une sous-page). */
export function cheminMentions(langue: Langue, racine = ""): string {
  return racine + PAGES_MENTIONS[langue];
}
