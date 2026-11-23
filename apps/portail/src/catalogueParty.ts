// Lot PA1b — les textes de la section « Party » de l'accueil (fr et en). **Un fichier à part** : seul l'accueil l'importe ; la page `/classement/` charge le catalogue du portail (`catalogue.ts`) et n'a pas à payer ces
// textes (son budget `portail.classement` est serré). L'accueil les réunit au catalogue du portail (`portail.ts`).
export const CATALOGUE_PARTY = {
  fr: {
    "portail.party.titre": "Party",
    "portail.party.sous": "Un jeu en tête chaque jour, lui seul est classé ; les autres se jouent librement.",
    "portail.party.classe": "Classé aujourd'hui",
    "portail.party.libre": "Jeu libre",
    "portail.party.libreLe": "Jeu libre · classé le {date}",
  },
  en: {
    "portail.party.titre": "Party",
    "portail.party.sous": "One game leads each day and only it is ranked; the others are free play.",
    "portail.party.classe": "Ranked today",
    "portail.party.libre": "Free play",
    "portail.party.libreLe": "Free play · ranked on {date}",
  },
} as const;
