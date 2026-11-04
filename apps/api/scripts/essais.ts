// Lot K4f — **le module d'essais d'un jeu neuf** : ce que `smoke`, `recette:seed` et `routesChaudes` ont besoin de lui pour jouer à sa place, sans qu'un script ne porte son nom. Le jeu l'écrit dans son
// dossier (`apps/api/scripts/<id>-essais.ts`, qui exporte `ESSAIS_<CODE>`) ; `npm run fiches` génère `essais.generated.ts`, qui les réunit pour tous les jeux qui se classent sur la table commune.
// **Pur** : aucune base, aucun réseau ; le module rend une rediffusion que le serveur rejouera pour de vrai.

export interface PartieEssai {
  /** Le texte envoyé à `POST /api/<jeu>/submit` (`replay`). */
  rediffusion: string;
  /** Les colonnes de classement que le serveur doit rendre pour cette partie (noms de la fiche, hors départages), pour que l'essai vérifie ce qu'il a rejoué. */
  attendu: Readonly<Record<string, number>>;
}

export interface ModuleEssais {
  /**
   * Une partie scriptée valide pour le jour `jour` (numéro de jour civil), avec les versions que le serveur annonce (`GET /api/<jeu>/info`). `variante` (0, 1, 2…) donne des parties DIFFÉRENTES (le serveur
   * refuse une copie : deux joueurs ne peuvent pas envoyer les mêmes entrées) et de plus en moins bonnes : 0 est la meilleure.
   */
  partie(jour: number, versions: { simVersion: number; generatorVersion: number }, variante: number): PartieEssai;
  /** Combien de variantes distinctes `partie` sait donner (au moins 8, de quoi remplir un classement de recette). */
  variantes: number;
}
