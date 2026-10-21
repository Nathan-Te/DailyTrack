// Catalogue de base de DailyTrack (lot I4) : ce que tous les écrans partagent — titre de la page, noms des thèmes, médailles en mots, erreurs
// d'ordre local (réseau, délai), mots courants. Clés `page.*`, `theme.*`, `medaille.*` hors catalogue commun, `commun.*`, `erreur.local.*`.
// Les autres catalogues du jeu (un fichier par zone : accueil, course, réglages, Salon) sont réunis dans `catalogue.ts`. Ton (charte § 7) :
// Track est sec et précis, les chiffres d'abord ; tutoiement en français, « you » direct en anglais. Parité : packages/ui/test/catalogues.test.ts.

// Le français : chargé avec le jeu. L'anglais est dans `catalogue.base.en.ts` (un autre fichier, chargé à la demande : voir i18n.ts).

export const fr = {
  "page.titre": "Track — Du Jour",
  "page.description": "Un circuit court par jour, le même pour tout le monde : une minute dans le navigateur, un fantôme à battre, un résultat à partager.",
  "page.sansJs": "Track a besoin de JavaScript.",
  // Thèmes du jour (codes de @cdj/sim : THEME_NAMES) ; les mêmes noms que le portail (`portail.theme.cdj.*`)
  "theme.stade": "Stade",
  "theme.rallye": "Rallye",
  "theme.banquise": "Banquise",
  "theme.nuit": "Nuit",
  "theme.campagne": "Campagne",
  "theme.canyon": "Canyon",
  "theme.col": "Col alpin",
  "theme.ville": "Ville",
  // Médailles de Track (les noms viennent du catalogue commun : medaille.auteur…) ; mot court pour les lignes de classement
  // Le cadre crème de Du Jour (barre des jeux)
  "cadre.retourTrack": "Retour à l'accueil de Track",
  // Mots courants
  "commun.reessayer": "Réessayer",
  "commun.valider": "Valider",
  "commun.toi": "Toi",
  // Erreurs qui ne viennent pas du serveur (pas de réponse, délai dépassé) : celles du serveur sont `erreur.<code>` (catalogue commun)
  "erreur.local.network": "Serveur injoignable.",
  "erreur.local.timeout": "Le serveur ne répond pas.",
  "erreur.local.http_error": "Le serveur a répondu par une erreur.",
  "erreur.local.inconnue": "Quelque chose n'a pas marché.",
} as const;
