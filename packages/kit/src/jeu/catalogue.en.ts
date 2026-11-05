import type { CATALOGUE_KIT_PLURIELS_FR } from "./catalogue";

// Lot K5 — l'anglais des pluriels du kit (voir `catalogue.ts`) : un module à part, chargé avec l'anglais du jeu (`creerI18n`), pour que le premier chargement des joueurs en français n'en porte pas un octet.
export const CATALOGUE_KIT_PLURIELS_EN: { readonly [K in keyof typeof CATALOGUE_KIT_PLURIELS_FR]: { readonly one: string; readonly other: string } } = {
  "kit.accueil.serie.jours": { one: "{n} day", other: "{n} days" },
  "kit.classement.participants": { one: "{n} ranked", other: "{n} ranked" },
};
