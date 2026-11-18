import type { Catalogues } from "./i18n";

// Lot U6 : les textes du composant de classement (`classement.ts` : le podium, la liste, « Ta course »). **Un catalogue à part, chargé avec le composant** (jamais dans le premier chargement d'un jeu : le
// catalogue commun y est, et chaque clé de plus y pèse). Le composant ne nomme aucun jeu : le nom d'un jeu (« Rejouer Track »), d'une médaille et d'un joueur sont des paramètres. Parité des deux
// langues : packages/ui/test/catalogues.test.ts.
const fr = {
  "classement.podium.aria": "Podium",
  "classement.libre": "Place à prendre",
  "classement.avance": "{ecart} d'avance",
  "classement.monte": { one: "{n} place gagnée depuis ta dernière visite", other: "{n} places gagnées depuis ta dernière visite" },
  "classement.descend": { one: "{n} place perdue depuis ta dernière visite", other: "{n} places perdues depuis ta dernière visite" },
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "classement.podium.aria": "Podium",
  "classement.libre": "Spot up for grabs",
  "classement.avance": "{ecart} ahead",
  "classement.monte": { one: "{n} place gained since your last visit", other: "{n} places gained since your last visit" },
  "classement.descend": { one: "{n} place lost since your last visit", other: "{n} places lost since your last visit" },
};

export const CATALOGUE_CLASSEMENT = { fr, en };
