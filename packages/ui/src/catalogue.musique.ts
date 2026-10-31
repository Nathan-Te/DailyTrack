import type { Catalogues } from "./i18n";

// Lot « musique » (plateforme) : les textes des réglages de la musique (`panneauMusique.ts`, commun à Track, Jump et Tower). **Un catalogue à part, chargé à la demande avec le panneau**
// (jamais dans le premier chargement d'un jeu : le catalogue commun y est, et chaque clé de plus y pèse). La langue est celle de la page (`<html lang>`). Parité des deux langues :
// packages/ui/test/catalogues.test.ts.
const fr = {
  "musique.titre": "Musique",
  "musique.volume": "Volume de la musique",
  "musique.valeur": "{n} %",
  "musique.couper": "Couper la musique",
  "musique.suivant": "Morceau suivant",
  "musique.enEcoute": "En écoute : {titre} — {artiste}",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "musique.titre": "Music",
  "musique.volume": "Music volume",
  "musique.valeur": "{n}%",
  "musique.couper": "Mute the music",
  "musique.suivant": "Next track",
  "musique.enEcoute": "Now playing: {titre} — {artiste}",
};

export const CATALOGUE_MUSIQUE = { fr, en };
