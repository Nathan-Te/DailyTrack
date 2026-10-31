// Les types communs de la musique de Du Jour (lot « musique »). Ce fichier ne contient que des types et des constantes : il est lu par le lecteur (navigateur),
// par la commande `npm run musique` (Node) et par les tests.

/** Les applications qui peuvent jouer de la musique. `tous` (dans la description) veut dire Track, Jump et Tower — **pas le portail**, qui doit être nommé. */
export const JEUX_MUSIQUE = ["track", "jump", "tower", "portail"] as const;
export type JeuMusique = (typeof JEUX_MUSIQUE)[number];
/** Ce que `tous` désigne. */
export const JEUX_DE_TOUS: readonly JeuMusique[] = ["track", "jump", "tower"];

/** Les licences admises : un morceau de Nathan, du domaine public (CC0), CC-BY (crédit exigé), ou acheté. Rien d'autre n'est publié. */
export const LICENCES = ["mienne", "CC0", "CC-BY-4.0", "achetee"] as const;
export type Licence = (typeof LICENCES)[number];

/** Un morceau tel que Nathan le décrit dans `musique/musiques.json`. */
export interface PisteDescription {
  /** Identifiant court et stable (`a-z`, `0-9`, `-`) : il nomme les fichiers servis et la reprise d'une page à l'autre. */
  id: string;
  titre: string;
  artiste: string;
  /** Le fichier source, relatif à `musique/pistes/` (mp3, wav, flac, ogg, m4a, aac, opus). */
  fichier: string;
  /** Où il passe : un ou plusieurs jeux (`track`, `jump`, `tower`, `portail`), ou `tous`. */
  jeux: string[];
  /**
   * Quand il passe, dans ces jeux : `menu` (l'accueil du jeu), `theme:<code>` (un thème de niveaux : `theme:nuit`…). **Absent : le morceau passe partout** dans ses jeux (là où aucun morceau
   * n'est réservé à la scène). Les scènes connues de chaque jeu sont dans `scenes.ts`.
   */
  scenes?: string[];
  licence: Licence;
  /** Le texte de crédit exigé (obligatoire en CC-BY-4.0). Sinon, « Titre — Artiste » est écrit à sa place. */
  credit?: string;
  /** D'où il vient (adresse, facture) : obligatoire pour CC0, CC-BY-4.0 et achetee. */
  source?: string;
  /** Poids de tirage (1 par défaut) : 2 passe deux fois plus souvent qu'un morceau de poids 1. */
  poids?: number;
  /** Correction de volume en décibels (0 par défaut) : après l'harmonisation automatique, pour un morceau qui reste trop fort ou trop doux. */
  volumeDb?: number;
}

/** Le fichier `musique/musiques.json`. */
export interface Description {
  pistes: PisteDescription[];
}

/** Un morceau tel que le jeu le reçoit (`musique/servi/liste.json`) : jeux résolus, crédit toujours écrit, fichier préparé. */
export interface PisteServie {
  id: string;
  titre: string;
  artiste: string;
  credit: string;
  /** Le fichier préparé, relatif au dossier `/musique/` du site : `<id>-<empreinte>.m4a` (l'empreinte permet un cache sans fin). */
  fichier: string;
  jeux: JeuMusique[];
  /** Les scènes où il passe (`menu`, `theme:nuit`…) ; vide : partout dans ses jeux. */
  scenes: string[];
  /** L'empreinte (SHA-256) du fichier source : les sources ne sont pas dans le dépôt, c'est elle qui dit à quelle source le fichier préparé correspond. */
  sha: string;
  poids: number;
  /** Correction de volume en dB. */
  volumeDb: number;
  /** Durée en secondes (mesurée à la préparation). */
  duree: number;
}

/** La liste servie au jeu. */
export interface ListeServie {
  version: 1;
  /** Le débit de la préparation (information). */
  debit: string;
  pistes: PisteServie[];
}

/** Les réglages communs à toute la plateforme (clé `cdj:musique`). */
export interface Reglages {
  /** Volume de la musique ∈ [0, 1]. */
  volume: number;
  /** « Couper la musique ». */
  coupee: boolean;
}
